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
    { ok: true, service: 'asthros-woocommerce' },
    { status: 200, headers: PURCHASE_CORS_HEADERS }
  );
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

/**
 * URL estável para WooCommerce (sem UUID e sem query string):
 * POST /api/webhooks/woo/<secret-do-asthros>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  try {
    const { secret } = await params;
    const rawBody = await readPayload(request);
    return await handlePurchaseIngest({
      request,
      rawBody,
      secretOverride: decodeURIComponent(secret),
    });
  } catch (error: any) {
    console.error('Erro no webhook WooCommerce:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }
}
