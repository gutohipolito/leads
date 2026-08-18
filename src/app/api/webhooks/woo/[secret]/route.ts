import { NextRequest, NextResponse } from 'next/server';
import {
  PURCHASE_CORS_HEADERS,
  handlePurchaseIngest,
} from '@/lib/handlePurchaseIngest';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: PURCHASE_CORS_HEADERS });
}

async function readPayload(request: NextRequest): Promise<any> {
  const rawText = await request.text();
  if (!rawText) return {};
  try {
    if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
      return JSON.parse(rawText);
    }
  } catch {
    return {};
  }
  const params = new URLSearchParams(rawText);
  const body: Record<string, string> = {};
  params.forEach((value, key) => {
    body[key] = value;
  });
  return body;
}

function normalizeSecret(raw: string) {
  let secret = String(raw || '').trim();
  try {
    secret = decodeURIComponent(secret);
  } catch {
    // keep
  }
  return secret.replace(/\/+$/, '').trim();
}

/**
 * URL estável para WooCommerce (sem UUID e sem query string):
 * POST /api/webhooks/woo/<secret-do-asthros>
 * GET  /api/webhooks/woo/<secret-do-asthros>  → valida se o secret existe
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret: raw } = await params;
  const secret = normalizeSecret(raw);

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Secret ausente na URL.' },
      { status: 400, headers: PURCHASE_CORS_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('webhooks')
    .select('id, client_id, status, name')
    .eq('secret', secret)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Webhook WooCommerce] Erro ao consultar webhook:', error);
    return NextResponse.json(
      { ok: false, error: 'Falha ao consultar webhooks.' },
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        matched: false,
        secret_prefix: secret.slice(0, 10),
        secret_length: secret.length,
        error: 'Secret não encontrado. Copie de novo em Vendas com a loja selecionada.',
      },
      { status: 401, headers: PURCHASE_CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      matched: true,
      service: 'asthros-woocommerce',
      webhook_name: data.name,
      webhook_status: data.status,
      client_id: data.client_id,
    },
    { status: 200, headers: PURCHASE_CORS_HEADERS }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  try {
    const { secret: raw } = await params;
    const secret = normalizeSecret(raw);
    const rawBody = await readPayload(request);
    return await handlePurchaseIngest({
      request,
      rawBody,
      secretOverride: secret,
    });
  } catch (error: any) {
    console.error('Erro no webhook WooCommerce:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }
}
