import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

function generateServerHmac(message: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const requestOrigin = request.headers.get('origin');
  
  const getResponseHeaders = (allowed: boolean) => {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Webhook-Id',
      'Access-Control-Allow-Credentials': 'true',
    };
    if (allowed && requestOrigin && requestOrigin !== '*') {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
    }
    return headers;
  };

  let isOriginAllowed = true;

  try {
    const { clientId } = await params;
    const body = await request.json().catch(() => ({}));
    const webhookId = request.headers.get('x-asthros-webhook-id') || body.webhookId;

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID ausente.' }, { status: 400, headers: getResponseHeaders(true) });
    }

    // Buscar o webhook no banco para validar o client_id e o allowed_origins
    // Suporta retrocompatibilidade com scripts antigos que enviam a chave secreta legada em webhookId
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(webhookId);
    let query = supabase
      .from('webhooks')
      .select('id, status, allowed_origins')
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (isUuid) {
      query = query.eq('id', webhookId);
    } else {
      query = query.eq('secret', webhookId);
    }

    const { data: webhook, error: dbError } = await query.maybeSingle();

    if (dbError || !webhook) {
      return NextResponse.json({ error: 'Webhook ID inválido ou inativo para este cliente.' }, { status: 401, headers: getResponseHeaders(true) });
    }

    // Validar whitelist de origens (CORS)
    if (webhook.allowed_origins) {
      const allowedList = webhook.allowed_origins
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
          console.warn(`[CORS/Referer Auth] Origem negada para emissão de token do webhook ${webhookId}. Origin: "${requestOrigin}", Referer: "${requestReferer}". Permitidos: "${webhook.allowed_origins}"`);
          isOriginAllowed = false;
          return NextResponse.json(
            { error: `Acesso negado: domínio de origem ou referência não autorizado.` },
            { status: 403, headers: getResponseHeaders(false) }
          );
        }
      }
    }

    // Gerar token temporário (stateless)
    const serverSecret = process.env.APP_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'asthros-secret-fallback-token-key-1823901';
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutos de validade
    
    const tokenPayload = {
      clientId,
      webhookId,
      exp: expiry
    };

    const payloadString = JSON.stringify(tokenPayload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64');
    const signature = generateServerHmac(payloadBase64, serverSecret);

    // O token final é "payloadBase64.assinatura"
    const token = `${payloadBase64}.${signature}`;

    return NextResponse.json({ token }, { status: 200, headers: getResponseHeaders(isOriginAllowed) });
  } catch (error: any) {
    console.error('[Auth API] Erro ao gerar token:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor: ' + (error.message || '') },
      { status: 500, headers: getResponseHeaders(isOriginAllowed) }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Webhook-Id',
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
