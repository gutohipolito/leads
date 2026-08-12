import type { ParsedPurchase } from '@/lib/parsePurchasePayload';

type SupabaseLike = {
  from: (table: string) => any;
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

function mergePreferExisting(base: Record<string, any>, extra: Record<string, any>) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value === null || value === undefined || value === '') continue;
    if (out[key] === null || out[key] === undefined || out[key] === '') {
      out[key] = value;
    } else if (
      typeof out[key] === 'object' &&
      !Array.isArray(out[key]) &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = mergePreferExisting(out[key], value);
    }
  }
  return out;
}

function contextFromOrderPayload(parsed: ParsedPurchase, body: Record<string, any>) {
  const order =
    body.data && (body.data.billing || body.data.line_items || body.data.customer)
      ? asRecord(body.data)
      : body;
  const billing = asRecord(order.billing || order.billing_address || body.billing_address);
  const shipping = asRecord(order.shipping || order.shipping_address || body.shipping_address);
  const clientDetails = asRecord(order.client_details || body.client_details);

  const location: Record<string, any> = {};
  const ip = pickString(
    order.customer_ip_address,
    body.customer_ip_address,
    clientDetails.browser_ip,
    order.browser_ip
  );
  if (ip) location.ip = ip;

  const city = pickString(billing.city, shipping.city, order.city);
  const region = pickString(billing.state, shipping.state, billing.province, shipping.province);
  const country = pickString(
    billing.country,
    shipping.country,
    billing.country_code,
    shipping.country_code
  );
  if (city) location.city = city;
  if (region) location.region = region;
  if (country) location.country = country;

  const device: Record<string, any> = {};
  const ua = pickString(
    order.customer_user_agent,
    body.customer_user_agent,
    clientDetails.user_agent
  );
  if (ua) {
    device.user_agent = ua;
    const lower = ua.toLowerCase();
    device.is_mobile = /mobile|android|iphone|ipad|ipod/.test(lower);
    if (/windows/i.test(ua)) device.os = 'Windows';
    else if (/mac os|macintosh/i.test(ua)) device.os = 'macOS';
    else if (/android/i.test(ua)) device.os = 'Android';
    else if (/iphone|ipad|ipod|ios/i.test(ua)) device.os = 'iOS';
    else if (/linux/i.test(ua)) device.os = 'Linux';
  }

  const marketing: Record<string, any> = {};
  if (parsed.utmSource) marketing.source = parsed.utmSource;
  if (parsed.utmMedium) marketing.medium = parsed.utmMedium;
  if (parsed.utmCampaign) marketing.campaign = parsed.utmCampaign;
  if (parsed.utmTerm) marketing.term = parsed.utmTerm;
  if (parsed.utmContent) marketing.content = parsed.utmContent;
  if (parsed.utmId) marketing.id = parsed.utmId;

  return {
    device,
    location,
    marketing,
    // Comportamento capturado pelo tracker no próprio checkout (tempo na página, scroll,
    // duração de sessão) — mais confiável que o fallback por lead, que só existe se o
    // comprador tiver gerado um lead antes de finalizar a compra.
    behavior: { ...parsed.behavior } as Record<string, any>,
    journey: [] as any[],
    pages_visited: [] as any[],
    first_touch: null as Record<string, any> | null,
    last_touch: null as Record<string, any> | null,
    source_lead_id: null as string | null,
  };
}

export type PurchaseEnrichment = {
  context: Record<string, any>;
  visitorId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  utmId: string;
};

export async function enrichPurchaseContext(
  supabase: SupabaseLike,
  clientId: string,
  parsed: ParsedPurchase,
  body: Record<string, any>
): Promise<PurchaseEnrichment> {
  const context = contextFromOrderPayload(parsed, body);
  const visitorId = parsed.visitorId || '';
  let utmSource = parsed.utmSource || '';
  let utmMedium = parsed.utmMedium || '';
  let utmCampaign = parsed.utmCampaign || '';
  let utmTerm = parsed.utmTerm || '';
  let utmContent = parsed.utmContent || '';
  let utmId = parsed.utmId || '';

  if (visitorId) {
    try {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, data, created_at')
        .eq('client_id', clientId)
        .eq('data->>visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(3);

      // Usa o lead mais recente com contexto útil — se o mais recente vier "vazio"
      // (ex.: evento sem marketing salvo), cai para o próximo candidato mais recente
      // em vez de desistir da atribuição.
      const candidates = Array.isArray(leads) ? leads : [];
      const lead =
        candidates.find((l) => Object.keys(asRecord(l?.data)).length > 0) ||
        candidates[0] ||
        null;
      const data = asRecord(lead?.data);
      if (lead?.id && Object.keys(data).length > 0) {
        context.source_lead_id = lead.id;
        const marketing = asRecord(data.marketing);
        context.device = mergePreferExisting(context.device, asRecord(data.device));
        context.location = mergePreferExisting(context.location, asRecord(data.location));
        context.behavior = mergePreferExisting(context.behavior, asRecord(data.behavior));
        context.marketing = mergePreferExisting(context.marketing, {
          ...marketing,
          source: marketing.source || data.utm_source,
          medium: marketing.medium || data.utm_medium,
          campaign: marketing.campaign || data.utm_campaign,
          term: marketing.term,
          content: marketing.content,
          id: marketing.id,
        });

        // A jornada completa (até 5 touchpoints com source/medium/campaign por etapa)
        // já vem dentro de data.marketing.journey — não precisa buscar em outro lugar.
        if (Array.isArray(marketing.journey) && marketing.journey.length > 0) {
          context.journey = marketing.journey;
        }
        if (marketing.first_touch) context.first_touch = marketing.first_touch;
        if (marketing.last_touch) context.last_touch = marketing.last_touch;
        if (Array.isArray(marketing.pages_visited) && marketing.pages_visited.length > 0) {
          context.pages_visited = marketing.pages_visited;
        }

        utmSource = utmSource || pickString(context.marketing.source, data.utm_source);
        utmMedium = utmMedium || pickString(context.marketing.medium, data.utm_medium);
        utmCampaign = utmCampaign || pickString(context.marketing.campaign, data.utm_campaign);
        utmTerm = utmTerm || pickString(context.marketing.term);
        utmContent = utmContent || pickString(context.marketing.content);
        utmId = utmId || pickString(context.marketing.id);
      }
    } catch (err) {
      console.error('[Purchases] enrich from lead failed:', err);
    }
  }

  // Mantém marketing alinhado aos UTMs finais
  context.marketing = mergePreferExisting(context.marketing, {
    source: utmSource || undefined,
    medium: utmMedium || undefined,
    campaign: utmCampaign || undefined,
    term: utmTerm || undefined,
    content: utmContent || undefined,
    id: utmId || undefined,
  });

  return {
    context,
    visitorId,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    utmId,
  };
}
