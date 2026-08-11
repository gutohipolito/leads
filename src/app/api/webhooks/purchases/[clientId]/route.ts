import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { encrypt } from '@/utils/encryption';
import { parsePurchasePayload } from '@/lib/parsePurchasePayload';

function sanitizeInput(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val
      .replace(/<[^>]*>/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  if (Array.isArray(val)) return val.map(sanitizeInput);
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id, X-Yampi-Hmac-Sha256, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source',
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: CORS_HEADERS });
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
    const searchParams = request.nextUrl.searchParams;
    const rawBody = await readPayload(request);

    const secret =
      request.headers.get('x-asthros-secret') ||
      rawBody.secret ||
      searchParams.get('secret');

    const { data: webhook, error: authError } = await supabase
      .from('webhooks')
      .select('id, client_id, user_id, secret, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (authError || !webhook) {
      return NextResponse.json(
        { error: 'Cliente não encontrado ou webhook inativo.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (webhook.secret && secret && webhook.secret !== secret) {
      return NextResponse.json(
        { error: 'Chave secreta inválida para este cliente.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = sanitizeInput(rawBody);
    const parsed = parsePurchasePayload(body, request.headers, searchParams);

    if (parsed.ignored) {
      return NextResponse.json(
        { success: true, ignored: true, reason: parsed.ignoreReason },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const encryptionSecret =
      process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';
    const encryptedEmail = parsed.customerEmail
      ? await encrypt(parsed.customerEmail, encryptionSecret)
      : '';
    const encryptedPhone = parsed.customerPhone
      ? await encrypt(parsed.customerPhone, encryptionSecret)
      : '';

    const purchaseData: Record<string, any> = {
      client_id: clientId,
      visitor_id: parsed.visitorId || null,
      order_id: parsed.orderId,
      gateway: parsed.gateway,
      customer_name: parsed.customerName,
      customer_email: encryptedEmail,
      customer_phone: encryptedPhone,
      total_amount: parsed.totalAmount,
      status: parsed.status,
      currency: parsed.currency || 'BRL',
      items: parsed.items,
      utm_source: parsed.utmSource || null,
      utm_medium: parsed.utmMedium || null,
      utm_campaign: parsed.utmCampaign || null,
      raw_payload: body,
    };

    let purchaseId: string | null = null;

    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('client_id', clientId)
      .eq('order_id', parsed.orderId)
      .maybeSingle();

    const persist = async (payload: Record<string, any>) => {
      if (existing?.id) {
        const { data, error } = await supabase
          .from('purchases')
          .update(payload)
          .eq('id', existing.id)
          .select('id')
          .single();
        return { data, error };
      }
      return await supabase.from('purchases').insert(payload).select('id').single();
    };

    let { data: saved, error: dbError } = await persist(purchaseData);

    if (dbError && /customer_phone/i.test(dbError.message || '')) {
      const { customer_phone: _phone, ...withoutPhone } = purchaseData;
      ({ data: saved, error: dbError } = await persist(withoutPhone));
    }

    if (dbError) {
      console.error('[Purchases] Falha ao gravar compra:', dbError.message);
      return NextResponse.json(
        { error: 'Falha ao gravar a venda.', details: dbError.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    purchaseId = saved?.id || existing?.id || null;

    if (webhook.user_id) {
      try {
        const formattedAmount =
          parsed.totalAmount > 0
            ? `R$ ${parsed.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '';

        await supabase.from('notifications').insert({
          user_id: webhook.user_id,
          client_id: clientId,
          title: `Nova Venda (${parsed.gateway.toUpperCase()})`,
          message: `Pedido #${parsed.orderId} de ${parsed.customerName} ${formattedAmount ? `- Total: ${formattedAmount}` : ''}`.trim(),
          read: false,
        });
      } catch (notifErr) {
        console.error('Erro ao enviar notificação de compra:', notifErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: existing?.id ? 'Compra atualizada com sucesso!' : 'Compra registrada com sucesso!',
        purchase_id: purchaseId,
        order_id: parsed.orderId,
        gateway: parsed.gateway,
        status: parsed.status,
        total_amount: parsed.totalAmount,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Erro ao processar webhook de compra:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
