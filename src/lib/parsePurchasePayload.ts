export type ParsedPurchase = {
  gateway: 'woocommerce' | 'shopify' | 'yampi' | 'generic';
  orderId: string;
  status: 'approved' | 'pending' | 'canceled';
  totalAmount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  visitorId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  ignored?: boolean;
  ignoreReason?: string;
};

type HeaderMap = {
  get(name: string): string | null;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fullName(first?: unknown, last?: unknown, fallback = 'Cliente'): string {
  const name = `${pickString(first)} ${pickString(last)}`.trim();
  return name || fallback;
}

function metaValue(meta: unknown, keys: string[]): string {
  if (!Array.isArray(meta)) return '';
  const wanted = keys.map((k) => k.toLowerCase());
  const hit = meta.find((entry) => {
    const key = String(entry?.key || entry?.name || '').toLowerCase();
    return wanted.includes(key);
  });
  return pickString(hit?.value);
}

function noteAttr(attrs: unknown, keys: string[]): string {
  if (!Array.isArray(attrs)) return '';
  const wanted = keys.map((k) => k.toLowerCase());
  const hit = attrs.find((entry) => wanted.includes(String(entry?.name || '').toLowerCase()));
  return pickString(hit?.value);
}

function mapWooStatus(raw: string): ParsedPurchase['status'] {
  const status = raw.toLowerCase();
  if (['processing', 'completed', 'paid', 'approved'].includes(status)) return 'approved';
  if (['cancelled', 'canceled', 'refunded', 'failed', 'trash'].includes(status)) return 'canceled';
  return 'pending';
}

function mapShopifyStatus(body: Record<string, any>): ParsedPurchase['status'] {
  if (body.cancelled_at || String(body.cancel_reason || '').trim()) return 'canceled';
  const financial = String(body.financial_status || '').toLowerCase();
  if (['paid', 'partially_paid'].includes(financial)) return 'approved';
  if (['refunded', 'voided', 'partially_refunded'].includes(financial)) return 'canceled';
  return 'pending';
}

function mapYampiStatus(raw: string): ParsedPurchase['status'] {
  const status = raw.toLowerCase();
  if (status.includes('paid') || status.includes('approved') || status.includes('order.paid')) {
    return 'approved';
  }
  if (status.includes('refund') || status.includes('cancel')) return 'canceled';
  return 'pending';
}

function normalizeItems(items: unknown): ParsedPurchase['items'] {
  const list = Array.isArray(items)
    ? items
    : items && typeof items === 'object'
      ? Object.values(items)
      : [];

  return list.map((it: any) => ({
    name: pickString(it?.name, it?.title, it?.sku) || 'Produto',
    quantity: toNumber(it?.quantity) || 1,
    price: toNumber(it?.price ?? it?.total ?? it?.subtotal),
  }));
}

function isWooCommerce(body: Record<string, any>, headers: HeaderMap): boolean {
  const topic = (headers.get('x-wc-webhook-topic') || '').toLowerCase();
  const source = headers.get('x-wc-webhook-source') || '';
  if (topic || source) return true;
  if (String(body.order_key || '').startsWith('wc_order')) return true;
  if (typeof body.cart_hash === 'string' && body.billing) return true;
  const collection = body._links?.collection?.[0]?.href || '';
  if (String(collection).includes('/wc/')) return true;
  return false;
}

function isShopify(body: Record<string, any>, headers: HeaderMap): boolean {
  if (headers.get('x-shopify-topic') || headers.get('x-shopify-shop-domain')) return true;
  if (String(body.admin_graphql_api_id || '').includes('shopify')) return true;
  if (body.line_items && (body.total_price != null || body.order_number != null) && body.token) {
    return true;
  }
  return false;
}

function isYampi(body: Record<string, any>, headers: HeaderMap): boolean {
  if (headers.get('x-yampi-hmac-sha256')) return true;
  const event = String(body.event || '').toLowerCase();
  if (event.startsWith('order.')) return true;
  if (body.resource === 'order' && body.data) return true;
  return false;
}

function parseWooCommerce(body: Record<string, any>): ParsedPurchase {
  const order = body.data && (body.data.billing || body.data.line_items) ? asRecord(body.data) : body;
  const billing = asRecord(order.billing);
  const shipping = asRecord(order.shipping);
  const meta = order.meta_data || body.meta_data;

  return {
    gateway: 'woocommerce',
    orderId: pickString(order.number, order.id, body.id) || `WOO-${Date.now()}`,
    status: mapWooStatus(pickString(order.status, body.status, 'pending')),
    totalAmount: toNumber(order.total ?? order.total_amount ?? body.total),
    currency: pickString(order.currency, body.currency) || 'BRL',
    customerName: fullName(
      billing.first_name || order.first_name,
      billing.last_name || order.last_name,
      pickString(order.customer_name) || 'Cliente WooCommerce'
    ),
    customerEmail: pickString(billing.email, order.email, order.customer_email, body.email),
    customerPhone: pickString(billing.phone, shipping.phone, order.phone, body.phone),
    items: normalizeItems(order.line_items || body.line_items),
    visitorId: metaValue(meta, ['_asthros_vid', 'asthros_vid', 'visitor_id']),
    utmSource: metaValue(meta, ['_utm_source', 'utm_source', '_asthros_utm_source', 'asthros_utm_source']),
    utmMedium: metaValue(meta, ['_utm_medium', 'utm_medium', '_asthros_utm_medium', 'asthros_utm_medium']),
    utmCampaign: metaValue(meta, [
      '_utm_campaign',
      'utm_campaign',
      '_asthros_utm_campaign',
      'asthros_utm_campaign',
    ]),
    utmTerm: metaValue(meta, ['_utm_term', 'utm_term', '_asthros_utm_term', 'asthros_utm_term']),
    utmContent: metaValue(meta, [
      '_utm_content',
      'utm_content',
      '_asthros_utm_content',
      'asthros_utm_content',
    ]),
  };
}

function parseShopify(body: Record<string, any>): ParsedPurchase {
  const customer = asRecord(body.customer);
  const billing = asRecord(body.billing_address);
  const shipping = asRecord(body.shipping_address);

  return {
    gateway: 'shopify',
    orderId: pickString(body.order_number, body.name, body.id) || `SHOPIFY-${Date.now()}`,
    status: mapShopifyStatus(body),
    totalAmount: toNumber(body.total_price ?? body.current_total_price),
    currency: pickString(body.currency, body.presentment_currency) || 'BRL',
    customerName: fullName(
      customer.first_name || billing.first_name,
      customer.last_name || billing.last_name,
      'Cliente Shopify'
    ),
    customerEmail: pickString(customer.email, body.email, billing.email, customer.default_address?.email),
    customerPhone: pickString(body.phone, customer.phone, billing.phone, shipping.phone),
    items: normalizeItems(body.line_items),
    visitorId: noteAttr(body.note_attributes, ['asthros_vid', 'visitor_id', '_asthros_vid']),
    utmSource: noteAttr(body.note_attributes, ['utm_source', '_utm_source']) || pickString(body.landing_site_ref),
    utmMedium: noteAttr(body.note_attributes, ['utm_medium', '_utm_medium']),
    utmCampaign: noteAttr(body.note_attributes, ['utm_campaign', '_utm_campaign']),
    utmTerm: noteAttr(body.note_attributes, ['utm_term', '_utm_term']),
    utmContent: noteAttr(body.note_attributes, ['utm_content', '_utm_content']),
  };
}

function parseYampi(body: Record<string, any>): ParsedPurchase {
  const orderData =
    body.data && (body.data.id || body.data.number) ? asRecord(body.data) : asRecord(body);
  const customer = asRecord(orderData.customer);

  return {
    gateway: 'yampi',
    orderId: pickString(orderData.number, orderData.id) || `YAMPI-${Date.now()}`,
    status: mapYampiStatus(pickString(orderData.status, body.event)),
    totalAmount: toNumber(orderData.total ?? orderData.value),
    currency: pickString(orderData.currency) || 'BRL',
    customerName: fullName(
      customer.first_name,
      customer.last_name,
      pickString(customer.name) || 'Cliente Yampi'
    ),
    customerEmail: pickString(customer.email),
    customerPhone: pickString(customer.phone, customer.cellphone, customer.whatsapp),
    items: normalizeItems(orderData.items),
    visitorId: pickString(
      orderData.custom_fields?.asthros_vid,
      orderData.asthros_vid,
      orderData.visitor_id
    ),
    utmSource: pickString(orderData.utm_source, orderData.src),
    utmMedium: pickString(orderData.utm_medium),
    utmCampaign: pickString(orderData.utm_campaign),
    utmTerm: pickString(orderData.utm_term),
    utmContent: pickString(orderData.utm_content),
  };
}

function parseGeneric(body: Record<string, any>): ParsedPurchase {
  const customer = asRecord(body.customer);
  return {
    gateway: 'generic',
    orderId: pickString(body.order_id, body.id) || `ORD-${Date.now()}`,
    status: mapWooStatus(pickString(body.status, 'approved')),
    totalAmount: toNumber(body.total_amount ?? body.amount ?? body.value ?? body.total),
    currency: pickString(body.currency) || 'BRL',
    customerName: pickString(body.customer_name, body.name, customer.name) || 'Cliente',
    customerEmail: pickString(body.customer_email, body.email, customer.email),
    customerPhone: pickString(body.customer_phone, body.phone, customer.phone),
    items: normalizeItems(body.items || body.line_items),
    visitorId: pickString(body.asthros_vid, body.visitor_id),
    utmSource: pickString(body.utm_source),
    utmMedium: pickString(body.utm_medium),
    utmCampaign: pickString(body.utm_campaign),
    utmTerm: pickString(body.utm_term),
    utmContent: pickString(body.utm_content),
  };
}

export function parsePurchasePayload(
  body: Record<string, any>,
  headers: HeaderMap,
  searchParams: URLSearchParams
): ParsedPurchase {
  const wcTopic = (headers.get('x-wc-webhook-topic') || '').toLowerCase();
  const shopifyTopic = (headers.get('x-shopify-topic') || '').toLowerCase();

  if (wcTopic && !wcTopic.startsWith('order.')) {
    return {
      ...parseGeneric(body),
      gateway: 'woocommerce',
      ignored: true,
      ignoreReason: `Tópico WooCommerce ignorado: ${wcTopic}`,
    };
  }

  if (shopifyTopic && !shopifyTopic.startsWith('orders/')) {
    return {
      ...parseGeneric(body),
      gateway: 'shopify',
      ignored: true,
      ignoreReason: `Tópico Shopify ignorado: ${shopifyTopic}`,
    };
  }

  let parsed: ParsedPurchase;
  if (isWooCommerce(body, headers)) {
    parsed = parseWooCommerce(body);
  } else if (isShopify(body, headers)) {
    parsed = parseShopify(body);
  } else if (isYampi(body, headers)) {
    parsed = parseYampi(body);
  } else if (body.line_items || body.billing) {
    // Pedido com line_items sem header: Woo usa billing, Shopify usa total_price
    parsed = body.billing || body.order_key ? parseWooCommerce(body) : parseShopify(body);
  } else {
    parsed = parseGeneric(body);
  }

  parsed.visitorId =
    parsed.visitorId ||
    pickString(searchParams.get('asthros_vid'), body.asthros_vid, body.visitor_id);
  parsed.utmSource = parsed.utmSource || pickString(searchParams.get('utm_source'), body.utm_source);
  parsed.utmMedium = parsed.utmMedium || pickString(searchParams.get('utm_medium'), body.utm_medium);
  parsed.utmCampaign =
    parsed.utmCampaign || pickString(searchParams.get('utm_campaign'), body.utm_campaign);
  parsed.utmTerm = parsed.utmTerm || pickString(searchParams.get('utm_term'), body.utm_term);
  parsed.utmContent =
    parsed.utmContent || pickString(searchParams.get('utm_content'), body.utm_content);

  return parsed;
}
