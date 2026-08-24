import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Força que a API seja sempre processada de forma dinâmica
export const dynamic = 'force-dynamic';

// Traduz o erro de rede/TLS do Node (geralmente genérico, ex: "fetch failed")
// em uma mensagem legível, olhando para a causa real (err.cause) quando disponível.
function describeFetchError(err: any): string {
  if (err?.name === 'AbortError') {
    return 'Timeout (15s) — o servidor não respondeu a tempo';
  }

  const cause = err?.cause;
  const code = cause?.code || err?.code;
  const rawMessage = cause?.message || err?.message || 'Erro de rede desconhecido';

  switch (code) {
    case 'CERT_HAS_EXPIRED':
      return 'Certificado SSL expirado';
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'Certificado SSL autoassinado/inválido';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return 'Certificado SSL não confiável (cadeia incompleta)';
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return 'Certificado SSL não corresponde ao domínio (hostname mismatch)';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Domínio não encontrado (DNS)';
    case 'ECONNREFUSED':
      return 'Conexão recusada pelo servidor';
    case 'ECONNRESET':
      return 'Conexão interrompida pelo servidor';
    case 'ERR_TLS_CERT_EXPIRED':
      return 'Certificado SSL expirado';
  }

  if (/certificate|ssl|tls/i.test(rawMessage)) {
    return `Erro de SSL/TLS: ${rawMessage}`;
  }

  return rawMessage;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    const cronSecret = process.env.CRON_SECRET;
    const hasCronSecret = cronSecret && cronSecret !== 'undefined' && cronSecret !== 'null' && cronSecret.trim() !== '';
    
    let isAuthorized = false;

    // 1. Verificar se coincide com o Cron Secret
    if (hasCronSecret && token === cronSecret) {
      isAuthorized = true;
    }

    // 2. Se não coincide com o Cron Secret, verificar se é um token de sessão de Admin
    if (!isAuthorized && token) {
      try {
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && authUser) {
          const { data: profile } = await supabaseAdmin
            .from('system_users')
            .select('role')
            .eq('email', authUser.email)
            .single();

          if (profile?.role === 'admin') {
            isAuthorized = true;
          }
        }
      } catch (err) {
        console.error('Erro na validação do token do usuário:', err);
      }
    }

    // Retorna 401 se não for autorizado por nenhuma das duas formas
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 1. Obter monitores de uptime cadastrados
    const { data: monitors, error } = await supabaseAdmin
      .from('uptime_monitors')
      .select('*');

    if (error) {
      console.error('[Uptime Check] Erro ao buscar monitores:', error);
      return NextResponse.json({ error: 'Erro ao buscar monitores de uptime.' }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'Nenhum monitor cadastrado.' });
    }

    // 2. Disparar pings em paralelo para todas as URLs
    const pingPromises = monitors.map(async (monitor) => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      let startTime = Date.now();
      let status: 'online' | 'offline' = 'offline';
      let responseTimeMs = 0;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;
      let success = false;

      // Tentar HEAD primeiro (mais rápido e econômico)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(monitor.url, {
          method: 'HEAD',
          headers: {
            'User-Agent': userAgent,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: controller.signal,
          next: { revalidate: 0 } // Desativa o cache do Next.js
        });

        clearTimeout(timeoutId);
        responseTimeMs = Date.now() - startTime;
        statusCode = response.status;

        if (response.ok) {
          status = 'online';
          success = true;
        } else {
          // Se retornar status que comumente rejeita HEAD, forçar fallback para GET
          if ([405, 403, 400, 501].includes(response.status)) {
            throw new Error(`FallbackToGet: Status ${response.status}`);
          } else {
            status = 'offline';
            errorMessage = `HTTP Status ${response.status}`;
            success = true; // Não tenta fallback se for erro definitivo do servidor
          }
        }
      } catch (err: any) {
        // Se falhou ou exige fallback
        if (!success) {
          startTime = Date.now();
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(monitor.url, {
              method: 'GET',
              headers: {
                'User-Agent': userAgent,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              },
              signal: controller.signal,
              next: { revalidate: 0 } // Desativa o cache do Next.js
            });

            clearTimeout(timeoutId);
            responseTimeMs = Date.now() - startTime;
            statusCode = response.status;

            if (response.ok) {
              status = 'online';
            } else {
              status = 'offline';
              errorMessage = `HTTP Status ${response.status}`;
            }
          } catch (getErr: any) {
            responseTimeMs = Date.now() - startTime;
            status = 'offline';
            errorMessage = describeFetchError(getErr);
          }
        }
      }

      // Salva log de histórico
      await supabaseAdmin.from('uptime_logs').insert({
        monitor_id: monitor.id,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        is_up: status === 'online',
        error_message: errorMessage
      });

      // Atualiza monitor principal
      await supabaseAdmin
        .from('uptime_monitors')
        .update({
          status: status,
          last_ping_ms: responseTimeMs,
          last_checked: new Date().toISOString()
        })
        .eq('id', monitor.id);

      return {
        id: monitor.id,
        url: monitor.url,
        status,
        responseTimeMs,
        errorMessage
      };
    });

    const results = await Promise.all(pingPromises);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[Uptime Check] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro ao processar checagem de uptime.' }, { status: 500 });
  }
}
