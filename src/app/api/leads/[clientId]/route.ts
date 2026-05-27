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

    const source = body.source === 'test_simulation' 
      ? 'test_simulation' 
      : (isWppTracker ? 'whatsapp_tracker' : (isCustomTracker ? 'custom_tracker' : 'form'));

    // [NOVO] Cálculo do Lead Scoring
    let leadScore = 0;
    
    // 1. WhatsApp dá +50 pontos
    if (source === 'whatsapp_tracker') {
      leadScore += 50;
    }
    
    // 2. Tempo na página
    const timeOnPage = body.behavior?.time_on_page 
      ? parseInt(body.behavior.time_on_page.replace('s', '')) || 0 
      : 0;
    if (timeOnPage >= 60) leadScore += 20;
    else if (timeOnPage >= 20) leadScore += 10;
    
    // 3. Profundidade de scroll
    const scrollDepth = body.behavior?.scroll_depth 
      ? parseInt(body.behavior.scroll_depth.replace('%', '')) || 0 
      : 0;
    if (scrollDepth >= 80) leadScore += 25;
    else if (scrollDepth >= 50) leadScore += 15;
    
    // 4. Origem de tráfego pago
    const utmSource = body.marketing?.source || '';
    if (['google', 'facebook', 'instagram', 'cpc', 'ads', 'meta'].includes(utmSource.toLowerCase())) {
      leadScore += 20;
    }
    
    // 5. Visitas anteriores na jornada (Atribuição)
    const journeyLength = body.marketing?.journey?.length || 0;
    if (journeyLength >= 3) leadScore += 15;
    else if (journeyLength === 2) leadScore += 10;
    
    body.lead_score = Math.min(100, leadScore);

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

    // [NOVO] Hub de Integrações
    // Buscar integrações ativas do cliente no banco
    const { data: dbIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active');

    const activeIntegrations = [...(dbIntegrations || [])];
    
    // Suporte ao webhook legado configurado nas configurações de webhook
    if (webhook.outbound_url) {
      activeIntegrations.push({
        id: 'legacy-webhook',
        name: 'Webhook Legado',
        type: 'webhook',
        config: { url: webhook.outbound_url }
      });
    }

    if (activeIntegrations.length > 0) {
      const repassePromises = activeIntegrations.map(async (integration) => {
        let status = 200;
        let responseText = '';
        let errorMsg = null;

        try {
          const payloadToSend = {
            event: 'lead.captured',
            lead_id: lead.id,
            name,
            email,
            phone,
            source: source,
            lead_score: body.lead_score,
            raw_data: body,
            timestamp: new Date().toISOString()
          };

          if (integration.type === 'webhook') {
            const url = integration.config?.url;
            if (url) {
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadToSend)
              });
              status = res.status;
              responseText = await res.text();
            } else {
              throw new Error('URL do webhook de repasse não configurada.');
            }
          } 
          else if (integration.type === 'hubspot') {
            const portalId = integration.config?.portalId;
            const formId = integration.config?.formId;
            if (portalId && formId) {
              const res = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: [
                    { name: 'email', value: email || '' },
                    { name: 'firstname', value: name || '' },
                    { name: 'phone', value: phone || '' }
                  ],
                  context: {
                    pageUri: body.marketing?.page_url || '',
                    pageName: body.marketing?.page_title || ''
                  }
                })
              });
              status = res.status;
              responseText = await res.text();
            } else {
              throw new Error('portalId ou formId do HubSpot ausentes.');
            }
          }
          else if (integration.type === 'activecampaign') {
            const apiUrl = integration.config?.apiUrl;
            const apiKey = integration.config?.apiKey;
            const listId = integration.config?.listId;
            if (apiUrl && apiKey) {
              const res = await fetch(`${apiUrl}/api/3/contacts`, {
                method: 'POST',
                headers: {
                  'Api-Token': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  contact: {
                    email: email || '',
                    firstName: name || '',
                    phone: phone || ''
                  }
                })
              });
              status = res.status;
              const json = await res.json();
              responseText = JSON.stringify(json);
              
              if (res.ok && listId && json.contact?.id) {
                await fetch(`${apiUrl}/api/3/contactLists`, {
                  method: 'POST',
                  headers: {
                    'Api-Token': apiKey,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    contactList: {
                      list: listId,
                      contact: json.contact.id,
                      status: 1
                    }
                  })
                });
              }
            } else {
              throw new Error('API URL ou API Key do ActiveCampaign ausentes.');
            }
          }
          else if (integration.type === 'zapi') {
            const instanceId = integration.config?.instanceId;
            const token = integration.config?.token;
            const targetPhone = integration.config?.targetPhone;
            
            if (instanceId && token && targetPhone) {
              const msg = `🚀 *Novo Lead Asthros!*\n\n*Nome:* ${name}\n*E-mail:* ${email || 'N/A'}\n*Telefone:* ${phone || 'N/A'}\n*Origem:* ${source}\n*Score:* ${body.lead_score} pts`;
              const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: targetPhone,
                  message: msg
                })
              });
              status = res.status;
              responseText = await res.text();
            } else {
              throw new Error('instanceId, token ou targetPhone do Z-API ausentes.');
            }
          }
          else if (integration.type === 'rdstation') {
            const tokenApi = integration.config?.tokenApi;
            const identifier = integration.config?.identifier || 'asthros_lead_capture';
            if (tokenApi) {
              const res = await fetch(`https://api.rd.services/platform/conversions?api_key=${tokenApi}`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'User-Agent': 'Asthros-Webhook/1.0'
                },
                body: JSON.stringify({
                  event_type: "CONVERSION",
                  event_family: "CDP",
                  payload: {
                    email: email || '',
                    name: name || '',
                    personal_phone: phone || '',
                    conversion_identifier: identifier,
                    traffic_source: body.marketing?.source || '',
                    traffic_medium: body.marketing?.medium || '',
                    traffic_campaign: body.marketing?.campaign || '',
                    cf_lead_score: body.lead_score?.toString() || '0'
                  }
                })
              });
              status = res.status;
              responseText = await res.text();
            } else {
              throw new Error('API Token do RD Station ausente.');
            }
          }
        } catch (err: any) {
          status = 500;
          errorMsg = err.message;
        }

        // Registrar Log de Repasse no banco
        await supabase.from('webhook_logs').insert([{
          webhook_id: webhook.id,
          client_id: clientId,
          status_code: status,
          request_body: { ...body, integration_name: integration.name, integration_type: integration.type },
          response_body: responseText.substring(0, 1000), // Prevenir estouro de texto
          error_message: errorMsg
        }]);
      });

      await Promise.all(repassePromises);
    } else {
      await supabase.from('webhook_logs').insert([{
        webhook_id: webhook.id,
        client_id: clientId,
        status_code: 201,
        request_body: body,
        response_body: 'Lead gravado internamente com sucesso (Sem integrações adicionais).'
      }]);
    }

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
