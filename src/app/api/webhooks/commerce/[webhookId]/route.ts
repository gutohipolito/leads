import { NextRequest, NextResponse } from 'next/server';
import {
  PURCHASE_CORS_HEADERS,
  handlePurchaseIngest,
} from '@/lib/handlePurchaseIngest';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function normalizeId(raw: string) {
  let id = String(raw || '').trim();
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep
  }
  return id.replace(/\/+$/, '').trim();
}

/**
 * URL recomendada para WooCommerce — usa o ID do terminal (UUID), sem secret:
 * https://leads.asthros.com.br/api/webhooks/commerce/<webhook-id>
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId: raw } = await params;
  const webhookId = normalizeId(raw);

  if (!UUID_RE.test(webhookId)) {
    return NextResponse.json(
      { ok: false, error: 'ID inválido. Use o UUID do terminal copiado em Vendas.' },
      { status: 400, headers: PURCHASE_CORS_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('webhooks')
    .select('id, client_id, status, name')
    .eq('id', webhookId)
    .maybeSingle();

  if (error) {
    console.error('[Webhook Commerce] Erro ao consultar webhook:', error);
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
        received_id: webhookId,
        error: 'Terminal não encontrado. Em Vendas, selecione a loja e copie a URL de novo.',
      },
      { status: 401, headers: PURCHASE_CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      matched: true,
      service: 'asthros-commerce',
      webhook_name: data.name,
      webhook_status: data.status,
      client_id: data.client_id,
    },
    { status: 200, headers: PURCHASE_CORS_HEADERS }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId: raw } = await params;
    const webhookId = normalizeId(raw);
    const rawBody = await readPayload(request);
    return await handlePurchaseIngest({
      request,
      clientIdParam: webhookId,
      rawBody,
    });
  } catch (error: any) {
    console.error('Erro no webhook commerce:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }
}
