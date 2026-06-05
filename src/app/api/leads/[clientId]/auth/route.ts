import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

function generateServerHmac(message: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Webhook-Id',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    const { clientId } = await params;
    const body = await request.json().catch(() => ({}));
    const webhookId = request.headers.get('x-asthros-webhook-id') || body.webhookId;

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID ausente.' }, { status: 400, headers: corsHeaders });
    }

    // Buscar o webhook no banco para validar o client_id e o allowed_origins
    const { data: webhook, error: dbError } = await supabase
      .from('webhooks')
      .select('id, status, allowed_origins')
      .eq('client_id', clientId)
      .eq('id', webhookId)
      .eq('status', 'active')
      .maybeSingle();

    if (dbError || !webhook) {
      return NextResponse.json({ error: 'Webhook ID inválido ou inativo para este cliente.' }, { status: 401, headers: corsHeaders });
    }

    // Validar whitelist de origens (CORS)
    if (webhook.allowed_origins) {
      const allowedList = webhook.allowed_origins
        .split(',')
        .map((o: string) => o.trim().toLowerCase())
        .filter((o: string) => o);

      if (allowedList.length > 0) {
        const requestOrigin = request.headers.get('origin');
        if (!requestOrigin) {
          return NextResponse.json(
            { error: 'Acesso bloqueado: requisições do rastreador exigem cabeçalho Origin.' },
            { status: 403, headers: corsHeaders }
          );
        }

        const normOrigin = requestOrigin.trim().toLowerCase().replace(/\/$/, '');
        const isAllowed = allowedList.some((allowed: string) => {
          const normAllowed = allowed.replace(/\/$/, '');
          return (
            normOrigin === normAllowed ||
            normOrigin.endsWith('.' + normAllowed.replace(/^https?:\/\/(www\.)?/, ''))
          );
        });

        if (!isAllowed) {
          return NextResponse.json(
            { error: `Origem não autorizada: ${requestOrigin}` },
            { status: 403, headers: corsHeaders }
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

    return NextResponse.json({ token }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('[Auth API] Erro ao gerar token:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor: ' + (error.message || '') },
      { status: 500, headers: corsHeaders }
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
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Webhook-Id',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
