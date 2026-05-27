import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

/**
 * Rota de Webhook para captura de leads ultra-compatível (Elementor, WPForms, etc).
 * URL: /api/leads/[clientId]?secret=SUA_CHAVE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    const { clientId } = await params;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // 1. Verificar se o IP está bloqueado no Firewall
    try {
      const { data: blockedIp, error: firewallError } = await supabase
        .from('ip_firewall')
        .select('id, expires_at')
        .eq('ip_address', ip)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .maybeSingle();

      if (blockedIp) {
        console.warn(`[Firewall] Bloqueando requisição do IP ${ip} (Ban ativo)`);
        return NextResponse.json(
          { error: 'Acesso bloqueado temporariamente por medidas de segurança.' },
          { status: 429, headers: corsHeaders }
        );
      }
    } catch (e) {
      console.error('Erro ao verificar firewall (a tabela ip_firewall pode não existir):', e);
    }
    
    // Suporte a JSON ou Form Data (Elementor pode enviar ambos)
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    }
    
    const secret = request.headers.get('x-asthros-secret') || request.nextUrl.searchParams.get('secret');

    if (!secret) {
      return NextResponse.json({ error: 'Chave secreta ausente. Use ?secret= no final da URL ou o header X-Asthros-Secret.' }, { status: 401 });
    }

    const { data: webhook, error: authError } = await supabase
      .from('webhooks')
      .select('id, status, name, outbound_url, notification_email')
      .eq('client_id', clientId)
      .eq('secret', secret)
      .eq('status', 'active')
      .single();

    if (authError || !webhook) {
      return NextResponse.json({ error: 'Chave secreta inválida ou webhook inativo para este cliente.' }, { status: 401 });
    }

    // Captura de Localização baseada em IP (Vercel Headers)
    const city = request.headers.get('x-vercel-ip-city') || 'Desconhecida';
    const region = request.headers.get('x-vercel-ip-country-region') || 'N/A';
    const country = request.headers.get('x-vercel-ip-country') || 'BR';
    
    if (!body.location) {
      body.location = { city, region, country, ip };
    }

    // 2. Verificar Rate Limiting (máximo 5 leads em 1 minuto por IP)
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gt('created_at', oneMinuteAgo)
        .contains('data', { location: { ip: ip } });

      if (!countError && count !== null && count >= 5) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
        
        console.warn(`[Firewall] Bloqueando IP ${ip} por excesso de requisições. Cadastrando na lista.`);
        
        await supabase.from('ip_firewall').upsert({
          ip_address: ip,
          reason: 'Rate limit excedido (Mais de 5 leads em 1 minuto)',
          expires_at: expiresAt,
          city: city || null,
          country: country || null
        }, { onConflict: 'ip_address' });

        await supabase.from('system_logs').insert([{
          action: 'IP Bloqueado',
          entity: 'security',
          entity_id: ip,
          details: { 
            ip: ip,
            reason: 'Rate limit excedido (Mais de 5 leads em 1 minuto)',
            city,
            country
          },
          ip_address: ip
        }]);

        return NextResponse.json(
          { error: 'Limite de requisições excedido. IP bloqueado temporariamente.' },
          { status: 429, headers: corsHeaders }
        );
      }
    } catch (e) {
      console.error('Erro no processamento do rate limiter (a tabela pode não existir):', e);
    }

    const isWppTracker = body.source === 'whatsapp_tracker';
    const fields = body.fields || {};
    
    let name = body.name || body.nome || body.full_name || fields.name || fields.nome || 'Lead s/ Nome';
    const email = body.email || body.e_mail || fields.email || fields.e_mail || null;
    let phone = body.phone || body.telefone || body.whatsapp || fields.phone || fields.telefone || null;
    
    if (phone && typeof phone === 'string') {
      phone = phone.replace(/^N\/A\s*/i, '').trim();
      if (phone.toLowerCase() === 'n/a' || phone === '') {
        phone = null;
      }
    }

    const isCustomTracker = body.source === 'custom_tracker';

    if (isWppTracker) {
      name = `Click Wpp: ${body.marketing?.source || 'Direto'}`;
    } else if (isCustomTracker) {
      name = `Interação: ${body.marketing?.source || 'Botão'}`;
    }

    const source = body.source === 'test_simulation' 
      ? 'test_simulation' 
      : (isWppTracker ? 'whatsapp_tracker' : (isCustomTracker ? 'custom_tracker' : 'form'));

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([
        {
          client_id: clientId,
          webhook_id: webhook.id,
          name: name,
          email: email,
          phone: phone,
          data: body,
          source: source
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    let outboundStatus = null;
    let outboundResponse = null;
    let outboundError = null;

    if (webhook.outbound_url) {
      try {
        const response = await fetch(webhook.outbound_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'lead.captured',
            lead_id: lead.id,
            name,
            email,
            phone,
            source: isWppTracker ? 'whatsapp_tracker' : 'form',
            raw_data: body,
            timestamp: new Date().toISOString()
          })
        });
        outboundStatus = response.status;
        outboundResponse = await response.text();
      } catch (err: any) {
        outboundError = err.message;
      }
    }

    await supabase.from('webhook_logs').insert([{
      webhook_id: webhook.id,
      client_id: clientId,
      status_code: outboundStatus || 201,
      request_body: body,
      response_body: outboundResponse,
      error_message: outboundError
    }]);

    if (webhook.notification_email) {
      console.log(`[Email] Disparando alerta para ${webhook.notification_email}`);
      // resend.emails.send({ from: 'Asthros <leads@asthros.com.br>', to: webhook.notification_email, ... });
    }

    // Buscar todos os usuários ativos do cliente
    const { data: clientUsers } = await supabase
      .from('system_users')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active');

    // Buscar todos os administradores ativos do sistema
    const { data: adminUsers } = await supabase
      .from('system_users')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active');

    const userIds = new Set<string>();
    clientUsers?.forEach(u => userIds.add(u.id));
    adminUsers?.forEach(u => userIds.add(u.id));

    if (userIds.size > 0) {
      const notificationTitle = isWppTracker ? 'Intercepção de WhatsApp' : 'Novo Lead via Form';
      const notificationMsg = isWppTracker 
        ? `Um usuário de ${body.marketing?.source || 'origem direta'} clicou no WhatsApp.`
        : `Recebemos os dados de "${name}" através do webhook ${webhook.name}.`;

      const notificationPromises = Array.from(userIds).map(async (uid) => {
        const { error } = await supabase.from('notifications').insert({
          user_id: uid,
          client_id: clientId,
          title: notificationTitle,
          message: notificationMsg,
          type: isWppTracker ? 'info' : 'success'
        });
        if (error) {
          console.error(`Erro ao inserir notificação para o usuário ${uid}:`, error);
        }
      });

      await Promise.all(notificationPromises);
    }

    // [NOVO] Log de Auditoria para o Sinal de Entrada
    await supabase.from('system_logs').insert([{
      action: isWppTracker ? 'Intercepção de WhatsApp' : (isCustomTracker ? 'Interação de Botão' : 'Captura de Lead'),
      entity: 'lead',
      entity_id: lead.id,
      details: { 
        name: name, 
        source: source,
        webhook_name: webhook.name
      },
      ip_address: ip
    }]);

    return NextResponse.json(
      { 
        status: 'success',
        message: 'Sinal de Uplink processado com sucesso!', 
        lead_id: lead.id
      }, 
      { 
        status: 201,
        headers: corsHeaders
      }
    );
  } catch (error: any) {
    console.error('Erro no processamento do uplink:', error);
    return NextResponse.json(
      { error: 'Falha no processamento: ' + (error.message || 'Erro interno') },
      { 
        status: 500,
        headers: { 
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
