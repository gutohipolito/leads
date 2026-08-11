import { NextRequest, NextResponse } from 'next/server';
import {
  PURCHASE_CORS_HEADERS,
  handlePurchaseIngest,
} from '@/lib/handlePurchaseIngest';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: PURCHASE_CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'asthros-purchases' },
    { status: 200, headers: PURCHASE_CORS_HEADERS }
  );
}

async function readPayload(request: NextRequest): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  const rawText = await request.text();

  if (!rawText) return {};

  if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
    try {
      return JSON.parse(rawText);
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(rawText);
  const body: Record<string, string> = {};
  params.forEach((value, key) => {
    body[key] = value;
  });
  return body;
}

/**
 * Webhook de compras: WooCommerce, Shopify, Yampi e genérico.
 * URL: /api/webhooks/purchases/[clientId]?secret=CHAVE_SECRET
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const rawBody = await readPayload(request);
    return await handlePurchaseIngest({
      request,
      clientIdParam: clientId,
      rawBody,
    });
  } catch (error: any) {
    console.error('Erro ao processar webhook de compra:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }
}
