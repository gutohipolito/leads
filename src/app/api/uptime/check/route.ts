import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Força que a API seja sempre processada de forma dinâmica
export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
            errorMessage = getErr.name === 'AbortError' ? 'Timeout (15s)' : (getErr.message || 'Erro de rede');
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
