import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { sendLeadToIntegrations } from '@/utils/integrations';

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

    // [NOVO] Cálculo de Lead Scoring Dinâmico
    let leadScore = 0;
    let scoringRules = {
      whatsapp_score: 50,
      time_on_page_60: 20,
      time_on_page_20: 10,
      scroll_depth_80: 25,
      scroll_depth_50: 15,
      paid_traffic: 20,
      journey_3: 15,
      journey_2: 10
    };

    try {
      const { data: dbRules } = await supabase
        .from('lead_scoring_rules')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (dbRules) {
        scoringRules = {
          whatsapp_score: dbRules.whatsapp_score ?? 50,
          time_on_page_60: dbRules.time_on_page_60 ?? 20,
          time_on_page_20: dbRules.time_on_page_20 ?? 10,
          scroll_depth_80: dbRules.scroll_depth_80 ?? 25,
          scroll_depth_50: dbRules.scroll_depth_50 ?? 15,
          paid_traffic: dbRules.paid_traffic ?? 20,
          journey_3: dbRules.journey_3 ?? 15,
          journey_2: dbRules.journey_2 ?? 10
        };
      }
    } catch (e) {
      console.error('Erro ao carregar regras de lead scoring:', e);
    }

    // 1. WhatsApp dá pontos configurados
    if (source === 'whatsapp_tracker') {
      leadScore += scoringRules.whatsapp_score;
    }
    
    // 2. Tempo na página
    const timeOnPage = body.behavior?.time_on_page 
      ? parseInt(body.behavior.time_on_page.replace('s', '')) || 0 
      : 0;
    if (timeOnPage >= 60) leadScore += scoringRules.time_on_page_60;
    else if (timeOnPage >= 20) leadScore += scoringRules.time_on_page_20;
    
    // 3. Profundidade de scroll
    const scrollDepth = body.behavior?.scroll_depth 
      ? parseInt(body.behavior.scroll_depth.replace('%', '')) || 0 
      : 0;
    if (scrollDepth >= 80) leadScore += scoringRules.scroll_depth_80;
    else if (scrollDepth >= 50) leadScore += scoringRules.scroll_depth_50;
    
    // 4. Origem de tráfego pago
    const utmSource = body.marketing?.source || '';
    if (['google', 'facebook', 'instagram', 'cpc', 'ads', 'meta'].includes(utmSource.toLowerCase())) {
      leadScore += scoringRules.paid_traffic;
    }
    
    // 5. Visitas anteriores na jornada (Atribuição)
    const journeyLength = body.marketing?.journey?.length || 0;
    if (journeyLength >= 3) leadScore += scoringRules.journey_3;
    else if (journeyLength === 2) leadScore += scoringRules.journey_2;
    
    body.lead_score = Math.min(100, leadScore);

    // Salvar memória textual do webhook que originou o lead para persistência histórica
    body.captured_by = {
      id: webhook.id,
      name: webhook.name,
      url_slug: webhook.url_slug
    };

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

    // [NOVO] Hub de Integrações (Chama o utilitário compartilhado)
    await sendLeadToIntegrations({ lead, clientId, webhook, body });

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
