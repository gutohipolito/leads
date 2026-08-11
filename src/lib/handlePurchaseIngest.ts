import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { encrypt } from '@/utils/encryption';
import { parsePurchasePayload } from '@/lib/parsePurchasePayload';

export const PURCHASE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id, X-Yampi-Hmac-Sha256, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function normalizeClientId(raw: string) {
  let id = String(raw || '').trim();
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep raw
  }
  id = id.split('?')[0].split('&')[0].replace(/\/$/, '');
  id = id.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
  return id.trim();
}

export function isStorePlatformRequest(request: NextRequest) {
  return Boolean(
    request.headers.get('x-wc-webhook-topic') ||
    request.headers.get('x-wc-webhook-source') ||
    request.headers.get('x-wc-webhook-signature') ||
    request.headers.get('x-shopify-topic') ||
    request.headers.get('x-shopify-shop-domain') ||
    request.headers.get('x-yampi-hmac-sha256')
  );
}

export function isWooCommercePing(body: any, request: NextRequest) {
  const topic = (request.headers.get('x-wc-webhook-topic') || '').toLowerCase();
  if (topic.includes('ping')) return true;
  const keys = Object.keys(body || {});
  return Boolean(body?.webhook_id) && keys.every((key) => key === 'webhook_id' || key === 'secret');
}

export function isCommerceWebhook(request: NextRequest, body: any) {
  if (isStorePlatformRequest(request) || isWooCommercePing(body, request)) return true;
  if (String(body?.order_key || '').startsWith('wc_order')) return true;
  if (body?.billing && (body?.line_items || body?.total)) return true;
  if (body?.line_items && (body?.total_price != null || body?.order_number != null)) return true;
  return false;
}

async function resolveBySecret(secret: string | null | undefined) {
  const value = String(secret || '').trim();
  if (!value) return null;
  const { data, error } = await supabase
    .from('webhooks')
    .select('id, client_id, secret, status')
    .eq('secret', value)
    .limit(5);
  if (error) {
    console.error('[Purchases] resolveBySecret:', error.message);
  }
  const rows = data || [];
  return rows.find((row) => row.status === 'active') || rows[0] || null;
}

async function resolveWebhook(clientId: string, secret?: string | null) {
  // 1) ID do terminal (webhook.id) — URL recomendada para WooCommerce
  if (UUID_RE.test(clientId)) {
    const { data: byWebhookId, error: byIdError } = await supabase
      .from('webhooks')
      .select('id, client_id, secret, status')
      .eq('id', clientId)
      .maybeSingle();

    if (byIdError) {
      console.error('[Purchases] resolve by webhook id:', byIdError.message);
    }

    if (byWebhookId) {
      return { webhook: byWebhookId, error: null, clientId: byWebhookId.client_id };
    }

    // 2) client_id do parceiro
    const { data: byClient, error: clientError } = await supabase
      .from('webhooks')
      .select('id, client_id, secret, status')
      .eq('client_id', clientId)
      .limit(10);

    if (clientError) {
      return { webhook: null as any, error: clientError, clientId };
    }

    const rows = byClient || [];
    const active = rows.find((row) => row.status === 'active') || rows[0];
    if (active) {
      return { webhook: active, error: null, clientId: active.client_id };
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();

    if (client) {
      return {
        webhook: { id: null, client_id: client.id, secret: null, status: 'active' },
        error: null,
        clientId: client.id,
      };
    }
  }

  // 3) Fallback: secret Asthros (whsec_...)
  const bySecret = await resolveBySecret(secret);
  if (bySecret) {
    return { webhook: bySecret, error: null, clientId: bySecret.client_id };
  }

  return { webhook: null as any, error: null, clientId };
}

export async function handlePurchaseIngest(options: {
  request: NextRequest;
  clientIdParam?: string;
  rawBody: any;
  secretOverride?: string;
}) {
  const { request, rawBody } = options;
  const searchParams = request.nextUrl.searchParams;
  const clientIdParam = normalizeClientId(options.clientIdParam || '');

  const secret =
    options.secretOverride ||
    request.headers.get('x-asthros-secret') ||
    rawBody?.secret ||
    searchParams.get('secret');

  const { webhook, error: authError, clientId } = await resolveWebhook(clientIdParam, secret);

  if (authError || !webhook) {
    return NextResponse.json(
      {
        error: 'Cliente não encontrado ou webhook inativo.',
        received_id: clientIdParam || null,
        secret_prefix: secret ? String(secret).slice(0, 10) : null,
        secret_length: secret ? String(secret).length : 0,
        hint: 'Em Vendas, selecione a loja, clique em Testar URL e cole no WooCommerce a URL /api/webhooks/commerce/<id-do-terminal>.',
      },
      { status: 401, headers: PURCHASE_CORS_HEADERS }
    );
  }

  const platformRequest = isStorePlatformRequest(request) || isWooCommercePing(rawBody, request);
  if (!platformRequest && webhook.secret && secret && webhook.secret !== secret) {
    return NextResponse.json(
      { error: 'Chave secreta inválida para este cliente.' },
      { status: 401, headers: PURCHASE_CORS_HEADERS }
    );
  }

  if (isWooCommercePing(rawBody, request)) {
    return NextResponse.json(
      { success: true, ping: true, message: 'Webhook WooCommerce ativo.' },
      { status: 200, headers: PURCHASE_CORS_HEADERS }
    );
  }

  const body = sanitizeInput(rawBody);
  const parsed = parsePurchasePayload(body, request.headers, searchParams);

  if (parsed.ignored) {
    return NextResponse.json(
      { success: true, ignored: true, reason: parsed.ignoreReason },
      { status: 200, headers: PURCHASE_CORS_HEADERS }
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

  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('client_id', clientId)
    .eq('order_id', parsed.orderId)
    .maybeSingle();

  const persist = async (payload: Record<string, any>) => {
    if (existing?.id) {
      return await supabase
        .from('purchases')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
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
      { status: 500, headers: PURCHASE_CORS_HEADERS }
    );
  }

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
  } else {
    // Notifica gestores do cliente se a coluna user_id não existir no webhook
    try {
      const { data: managers } = await supabase
        .from('system_users')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .limit(5);

      if (managers?.length) {
        const formattedAmount =
          parsed.totalAmount > 0
            ? `R$ ${parsed.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '';
        await supabase.from('notifications').insert(
          managers.map((manager) => ({
            user_id: manager.id,
            client_id: clientId,
            title: `Nova Venda (${parsed.gateway.toUpperCase()})`,
            message: `Pedido #${parsed.orderId} de ${parsed.customerName} ${formattedAmount ? `- Total: ${formattedAmount}` : ''}`.trim(),
            read: false,
          }))
        );
      }
    } catch (notifErr) {
      console.error('Erro ao enviar notificação de compra:', notifErr);
    }
  }

  return NextResponse.json(
    {
      success: true,
      message: existing?.id ? 'Compra atualizada com sucesso!' : 'Compra registrada com sucesso!',
      purchase_id: saved?.id || existing?.id || null,
      order_id: parsed.orderId,
      gateway: parsed.gateway,
      status: parsed.status,
      total_amount: parsed.totalAmount,
    },
    { status: 200, headers: PURCHASE_CORS_HEADERS }
  );
}
