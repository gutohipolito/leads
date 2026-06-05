import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { sendLeadToIntegrations } from '@/utils/integrations';
import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';
import { encrypt, decrypt } from '@/utils/encryption';

function sanitizeInput(val: any): any {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === 'string') {
    // Limpa tags e atributos perigosos (XSS) e mantem apenas o texto puro
    return DOMPurify.sanitize(val, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeInput);
  }
  if (typeof val === 'object') {
    const sanitizedObj: any = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        sanitizedObj[key] = sanitizeInput(val[key]);
      }
    }
    return sanitizedObj;
  }
  return val;
}

function extractDomain(urlStr: string): string | null {
  if (!urlStr) return null;
  try {
    let normUrl = urlStr.trim().toLowerCase();
    if (!/^https?:\/\//i.test(normUrl)) {
      normUrl = 'http://' + normUrl;
    }
    const url = new URL(normUrl);
    // Remove "www." para facilitar comparacoes flexiveis e ignorar variacoes de www
    return url.hostname.replace(/^www\./, '');
  } catch (e) {
    try {
      const clean = urlStr.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].split(':')[0];
      return clean.trim().toLowerCase();
    } catch (err) {
      return null;
    }
  }
}

/**
 * Rota de Webhook para captura de leads ultra-compatível (Elementor, WPForms, etc).
 * URL: /api/leads/[clientId]?secret=SUA_CHAVE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const requestOrigin = request.headers.get('origin');
  
  const getResponseHeaders = (allowed: boolean) => {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id',
      'Access-Control-Allow-Credentials': 'true',
    };
    if (allowed && requestOrigin && requestOrigin !== '*') {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
    }
    return headers;
  };

  let isOriginAllowed = true;
  const encryptionSecret = process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';

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
          { status: 429, headers: getResponseHeaders(true) }
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
    
    const secret = request.headers.get('x-asthros-secret') || body.secret || request.nextUrl.searchParams.get('secret');
    const webhookId = request.headers.get('x-asthros-webhook-id') || body.webhookId || request.nextUrl.searchParams.get('webhookId');

    if (!secret && !webhookId) {
      return NextResponse.json({ error: 'Identificador ausente. Forneça o header X-Asthros-Webhook-Id ou X-Asthros-Secret.' }, { status: 401 });
    }

    let webhook: any = null;

    if (secret) {
      // Autenticação S2S / Legada
      const { data, error: authError } = await supabase
        .from('webhooks')
        .select('id, status, name, outbound_url, notification_email')
        .eq('client_id', clientId)
        .eq('secret', secret)
        .eq('status', 'active')
        .maybeSingle();

      if (authError || !data) {
        return NextResponse.json({ error: 'Chave secreta inválida ou webhook inativo para este cliente.' }, { status: 401 });
      }
      webhook = data;
    } else {
      // Autenticação Pública do Tracker (Webhook ID) + Verificação de Domínio (CORS)
      const { data, error: authError } = await supabase
        .from('webhooks')
        .select('id, status, name, outbound_url, notification_email, allowed_origins')
        .eq('client_id', clientId)
        .eq('id', webhookId)
        .eq('status', 'active')
        .maybeSingle();

      if (authError || !data) {
        return NextResponse.json({ error: 'Webhook ID inválido ou inativo para este cliente.' }, { status: 401 });
      }

      // Validar whitelist de origens (se configurado no webhook)
      if (data.allowed_origins) {
        const allowedList = data.allowed_origins
          .split(',')
          .map((o: string) => o.trim().toLowerCase())
          .filter((o: string) => o);

        if (allowedList.length > 0) {
          const requestReferer = request.headers.get('referer') || '';

          if (!requestOrigin && !requestReferer) {
            isOriginAllowed = false;
            return NextResponse.json(
              { error: 'Acesso bloqueado: requisições do rastreador exigem cabeçalho Origin ou Referer.' },
              { status: 403, headers: getResponseHeaders(false) }
            );
          }

          const originDomain = extractDomain(requestOrigin || '');
          const refererDomain = extractDomain(requestReferer);

          const isAllowed = allowedList.some((allowed: string) => {
            const allowedDomain = extractDomain(allowed);
            if (!allowedDomain) return false;

            const checkMatch = (domain: string | null) => {
              if (!domain) return false;
              return (
                domain === allowedDomain ||
                domain.endsWith('.' + allowedDomain)
              );
            };

            return checkMatch(originDomain) || checkMatch(refererDomain);
          });

          if (!isAllowed) {
            console.warn(`[CORS/Referer] Origem negada para webhook ${webhookId}. Origin: "${requestOrigin}", Referer: "${requestReferer}". Permitidos: "${data.allowed_origins}"`);
            isOriginAllowed = false;
            return NextResponse.json(
              { error: `Acesso negado: domínio de origem ou referência não autorizado.` },
              { status: 403, headers: getResponseHeaders(false) }
            );
          }
        }
      }
      webhook = data;

      // Validar Assinatura do Payload para Webhook Público
      const token = body.token;
      const signature = body.signature;

      if (!token || !signature) {
        console.warn(`[Assinatura] Tentativa de submissão sem assinatura de payload para o webhook ${webhookId}.`);
        return NextResponse.json(
          { error: 'Acesso negado: assinatura de payload ausente.' },
          { status: 403, headers: corsHeaders }
        );
      }

      // Validar o Token
      try {
        const parts = token.split('.');
        if (parts.length !== 2) throw new Error('Formato do token inválido');
        
        const payloadBase64 = parts[0];
        const serverSig = parts[1];
        
        const serverSecret = process.env.APP_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'asthros-secret-fallback-token-key-1823901';
        
        // Verificar assinatura do token emitida pelo servidor
        const computedServerSig = crypto.createHmac('sha256', serverSecret).update(payloadBase64).digest('hex');
        if (computedServerSig !== serverSig) {
          return NextResponse.json(
            { error: 'Acesso negado: assinatura do token de autenticação inválida.' },
            { status: 403, headers: getResponseHeaders(isOriginAllowed) }
          );
        }

        // Decodificar o payload
        const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const tokenPayload = JSON.parse(decodedString);

        // Verificar expiração
        if (Date.now() > tokenPayload.exp) {
          return NextResponse.json(
            { error: 'Acesso negado: token de autenticação temporário expirado.' },
            { status: 403, headers: getResponseHeaders(isOriginAllowed) }
          );
        }

        // Verificar consistência do token
        if (tokenPayload.clientId !== clientId || tokenPayload.webhookId !== webhookId) {
          return NextResponse.json(
            { error: 'Acesso negado: token inconsistente.' },
            { status: 403, headers: getResponseHeaders(isOriginAllowed) }
          );
        }

        // Validar assinatura do payload do lead (lead_id|visitor_id|timestamp)
        const message = [
          body.lead_id || '',
          body.visitor_id || '',
          body.timestamp || ''
        ].join('|');

        const computedClientSig = crypto.createHmac('sha256', token).update(message).digest('hex');
        if (computedClientSig !== signature) {
          return NextResponse.json(
            { error: 'Acesso negado: assinatura do payload do lead inválida.' },
            { status: 403, headers: getResponseHeaders(isOriginAllowed) }
          );
        }
      } catch (err: any) {
        console.error('[Signature Error] Falha na validação do token/assinatura:', err.message);
        return NextResponse.json(
          { error: 'Acesso negado: falha na validação criptográfica.' },
          { status: 403, headers: getResponseHeaders(isOriginAllowed) }
        );
      }

      // Remover tokens e assinaturas do body para evitar gravação de dados desnecessários
      if (body.token) delete body.token;
      if (body.signature) delete body.signature;
    }

    // Remover o secret do corpo para evitar armazenamento em banco de dados
    if (body.secret) {
      delete body.secret;
    }

    // Sanitizar recursivamente todo o body contra injeção de HTML e XSS (DOMPurify)
    body = sanitizeInput(body);

    // Captura de Localização baseada em IP (Vercel Headers)
    const city = request.headers.get('x-vercel-ip-city') || 'Desconhecida';
    const region = request.headers.get('x-vercel-ip-country-region') || 'N/A';
    const country = request.headers.get('x-vercel-ip-country') || 'BR';
    
    if (!body.location) {
      body.location = { city, region, country, ip };
    }

    // 2. Verificar Rate Limiting (100 req/min por IP, 20 req/min por Visitor ID)
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      let limitExceeded = false;
      let blockReason = '';

      // A. Contar por IP (Limite: 100)
      const { count: ipCount, error: ipCountError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gt('created_at', oneMinuteAgo)
        .contains('data', { location: { ip: ip } });

      if (!ipCountError && ipCount !== null && ipCount >= 100) {
        limitExceeded = true;
        blockReason = `Rate limit por IP excedido (${ipCount} requisições no último minuto, limite: 100)`;
      }

      // B. Contar por Visitor ID se fornecido (Limite: 20)
      const visitorId = body.visitor_id;
      if (!limitExceeded && visitorId) {
        const { count: visitorCount, error: vCountError } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gt('created_at', oneMinuteAgo)
          .eq('data->>visitor_id', visitorId);

        if (!vCountError && visitorCount !== null && visitorCount >= 20) {
          limitExceeded = true;
          blockReason = `Rate limit por visitante excedido (${visitorCount} requisições no último minuto para o visitor_id ${visitorId}, limite: 20)`;
        }
      }

      if (limitExceeded) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
        
        console.warn(`[Firewall] Bloqueando IP ${ip} por excesso de requisições: ${blockReason}. Cadastrando na lista.`);
        
        await supabase.from('ip_firewall').upsert({
          ip_address: ip,
          reason: blockReason,
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
            reason: blockReason,
            city,
            country
          },
          ip_address: ip
        }]);

        return NextResponse.json(
          { error: 'Limite de requisições excedido. IP bloqueado temporariamente por medidas de segurança.' },
          { status: 429, headers: getResponseHeaders(isOriginAllowed) }
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

    const isSelector = isCustomTracker && (
      body.behavior?.match_type?.toLowerCase().includes('selector') || 
      body.match_type?.toLowerCase().includes('selector') || 
      name?.toLowerCase().includes('selector')
    );

    const isKeyword = isCustomTracker && (
      body.behavior?.match_type?.toLowerCase().includes('keyword') || 
      body.match_type?.toLowerCase().includes('keyword') || 
      name?.toLowerCase().includes('keyword')
    );

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
    const hasClickId = !!(
      body.marketing?.gclid || 
      body.marketing?.fbclid || 
      body.marketing?.ttclid || 
      body.marketing?.msclkid ||
      body.marketing?.gbraid ||
      body.marketing?.wbraid ||
      body.marketing?.li_fat_id ||
      body.marketing?.twclid
    );
    if (hasClickId || ['google', 'facebook', 'instagram', 'cpc', 'ads', 'meta'].includes(utmSource.toLowerCase())) {
      leadScore += scoringRules.paid_traffic;
    }
    
    // 5. Visitas anteriores na jornada (Atribuição)
    const journeyLength = body.marketing?.journey_length || body.marketing?.journey?.length || 0;
    if (journeyLength >= 3) leadScore += scoringRules.journey_3;
    else if (journeyLength === 2) leadScore += scoringRules.journey_2;
    
    body.lead_score = Math.min(100, leadScore);

    // Salvar memória textual do webhook que originou o lead para persistência histórica
    body.captured_by = {
      id: webhook.id,
      name: webhook.name,
      url_slug: (webhook as any).url_slug
    };

    // 3. Prevenção de Leads Duplicados e Proteção Anti-Replay
    const leadId = body.lead_id;
    const eventHash = body.event_hash;

    // A. Proteção Anti-Replay: Verifica se o lead_id já foi submetido nas últimas 24 horas (Retorna 409)
    if (leadId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: duplicateLead } = await supabase
        .from('leads')
        .select('id')
        .eq('client_id', clientId)
        .gt('created_at', twentyFourHoursAgo)
        .eq('data->>lead_id', leadId)
        .maybeSingle();

      if (duplicateLead) {
        console.warn(`[Anti-Replay] Tentativa de reenvio do lead_id: ${leadId}. Bloqueado.`);
        return NextResponse.json(
          { error: 'Lead duplicado detectado (Anti-Replay).' },
          { status: 409, headers: getResponseHeaders(isOriginAllowed) }
        );
      }
    }

    // B. Deduplicação por event_hash: Evita reenvios rápidos nos últimos 5 minutos (Retorna 200 de sucesso silencioso)
    if (eventHash) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingEvent } = await supabase
        .from('leads')
        .select('id')
        .eq('client_id', clientId)
        .gt('created_at', fiveMinutesAgo)
        .eq('data->>event_hash', eventHash)
        .maybeSingle();

      if (existingEvent) {
        console.log(`[Deduplicação] Evento duplicado detectado (event_hash: ${eventHash}) nos últimos 5 minutos. Ignorando silenciosamente.`);
        return NextResponse.json(
          { 
            status: 'success',
            message: 'Sinal de Uplink satisfeito (Evento duplicado ignorado).', 
            lead_id: existingEvent.id
          }, 
          { 
            status: 200,
            headers: getResponseHeaders(isOriginAllowed)
          }
        );
      }
    }

    // 4. Prevenção Clássica de Leads Duplicados (janela de 5 segundos para o mesmo email/telefone e cliente)
    if (email || phone) {
      const fiveSecondsAgo = new Date(Date.now() - 5 * 1000).toISOString();
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id, email, phone')
        .eq('client_id', clientId)
        .gt('created_at', fiveSecondsAgo);

      if (recentLeads && recentLeads.length > 0) {
        let isDuplicate = false;
        let duplicateId = '';
        
        for (const recent of recentLeads) {
          const decryptedEmail = recent.email ? await decrypt(recent.email, encryptionSecret) : null;
          const decryptedPhone = recent.phone ? await decrypt(recent.phone, encryptionSecret) : null;
          
          const emailMatch = email && decryptedEmail && decryptedEmail.trim().toLowerCase() === email.trim().toLowerCase();
          const phoneMatch = phone && decryptedPhone && decryptedPhone.trim() === phone.trim();
          
          if (emailMatch || phoneMatch) {
            isDuplicate = true;
            duplicateId = recent.id;
            break;
          }
        }

        if (isDuplicate) {
          console.log(`[Deduplicação] Lead duplicado detectado por email/telefone nos últimos 5 segundos. Ignorando inserção.`);
          return NextResponse.json(
            { 
              status: 'success',
              message: 'Sinal de Uplink satisfeito (Lead duplicado ignorado).', 
              lead_id: duplicateId
            }, 
            { 
              status: 200,
              headers: getResponseHeaders(isOriginAllowed)
            }
          );
        }
      }
    }

    // Criptografar e-mail e telefone para armazenamento seguro no banco (LGPD)
    const dbEmail = email ? await encrypt(email, encryptionSecret) : null;
    const dbPhone = phone ? await encrypt(phone, encryptionSecret) : null;

    // Criptografar chaves de dados sensíveis dentro de body (para a coluna data)
    const dbBody = { ...body };
    const encryptKeyIfExists = async (obj: any, k: string) => {
      if (obj && obj[k] && typeof obj[k] === 'string') {
        obj[k] = await encrypt(obj[k], encryptionSecret);
      }
    };
    await encryptKeyIfExists(dbBody, 'email');
    await encryptKeyIfExists(dbBody, 'e_mail');
    await encryptKeyIfExists(dbBody, 'phone');
    await encryptKeyIfExists(dbBody, 'telefone');
    await encryptKeyIfExists(dbBody, 'whatsapp');
    
    if (dbBody.fields) {
      dbBody.fields = { ...dbBody.fields };
      await encryptKeyIfExists(dbBody.fields, 'email');
      await encryptKeyIfExists(dbBody.fields, 'e_mail');
      await encryptKeyIfExists(dbBody.fields, 'phone');
      await encryptKeyIfExists(dbBody.fields, 'telefone');
    }

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([
        {
          client_id: clientId,
          webhook_id: webhook.id,
          name: name,
          email: dbEmail,
          phone: dbPhone,
          data: dbBody,
          source: source
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // [NOVO] Hub de Integrações (Chama o utilitário compartilhado passando dados em texto limpo)
    const cleanLeadForIntegration = {
      ...lead,
      email: email,
      phone: phone
    };
    await sendLeadToIntegrations({ lead: cleanLeadForIntegration, clientId, webhook, body });

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
      let notificationTitle = 'Novo Lead via Form';
      let notificationMsg = `Recebemos os dados de "${name}" através do webhook ${webhook.name}.`;
      let notificationType = 'success';

      if (isWppTracker) {
        notificationTitle = 'Intercepção de WhatsApp';
        notificationMsg = `Um usuário de ${body.marketing?.source || 'origem direta'} clicou no WhatsApp.`;
        notificationType = 'info';
      } else if (isSelector) {
        notificationTitle = 'Novo Lead via Seletor';
        notificationMsg = `O lead "${name}" clicou no seletor "${body.behavior?.button_text || 'Desconhecido'}".`;
        notificationType = 'info';
      } else if (isKeyword) {
        notificationTitle = 'Novo Lead via Palavra-Chave';
        notificationMsg = `O lead "${name}" acionou a palavra-chave "${body.behavior?.trigger_rule || 'Desconhecida'}".`;
        notificationType = 'info';
      } else if (isCustomTracker) {
        notificationTitle = 'Novo Lead via Botão';
        notificationMsg = `O lead "${name}" clicou em um botão personalizado no site.`;
        notificationType = 'info';
      }

      const notificationPromises = Array.from(userIds).map(async (uid) => {
        const { error } = await supabase.from('notifications').insert({
          user_id: uid,
          client_id: clientId,
          title: notificationTitle,
          message: notificationMsg,
          type: notificationType
        });
        if (error) {
          console.error(`Erro ao inserir notificação para o usuário ${uid}:`, error);
        }
      });

      await Promise.all(notificationPromises);
    }

    // [NOVO] Log de Auditoria para o Sinal de Entrada
    const logActionName = isWppTracker 
      ? 'Intercepção de WhatsApp' 
      : isSelector 
      ? 'Interação via Seletor' 
      : isKeyword 
      ? 'Interação via Palavra-Chave' 
      : isCustomTracker 
      ? 'Interação de Botão' 
      : 'Captura de Lead';

    await supabase.from('system_logs').insert([{
      action: logActionName,
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
        headers: getResponseHeaders(isOriginAllowed)
      }
    );
  } catch (error: any) {
    console.error('Erro no processamento do uplink:', error);
    return NextResponse.json(
      { error: 'Falha no processamento: ' + (error.message || 'Erro interno') },
      { 
        status: 500,
        headers: getResponseHeaders(isOriginAllowed)
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id',
    'Access-Control-Allow-Credentials': 'true',
  };
  if (origin && origin !== '*') {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
