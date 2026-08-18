import crypto from 'crypto';

/**
 * Meta Conversions API (Meta CAPI) Server-Side Service
 * Integração oficial com a Meta Graph API v19.0
 */

export interface MetaCapiParams {
  pixelId: string;
  accessToken: string;
  eventName: 'Lead' | 'Purchase' | 'Contact' | 'PageView';
  eventTime?: number;
  eventId: string;
  eventSourceUrl?: string;
  userData: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    fbc?: string | null;
    fbp?: string | null;
  };
  customData?: {
    currency?: string;
    value?: number;
    content_name?: string;
  };
  testEventCode?: string; // Código opcional para teste no Gerenciador de Eventos da Meta
}

function hashSha256(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove caracteres não numéricos
  let digits = phone.replace(/\D/g, '');
  // Se for número brasileiro sem DDI (+55), adiciona 55
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

export async function sendMetaCapiEvent(params: MetaCapiParams) {
  const { pixelId, accessToken, eventName, eventTime, eventId, eventSourceUrl, userData, customData, testEventCode } = params;

  if (!pixelId || !accessToken) {
    return { success: false, error: 'Pixel ID ou Access Token do Meta CAPI ausente' };
  }

  try {
    const hashedEmail = userData.email ? hashSha256(userData.email) : undefined;
    const normalizedPhone = userData.phone ? normalizePhone(userData.phone) : '';
    const hashedPhone = normalizedPhone ? hashSha256(normalizedPhone) : undefined;
    
    let hashedFirstName: string | undefined;
    let hashedLastName: string | undefined;

    if (userData.name) {
      const parts = userData.name.trim().split(' ');
      if (parts.length > 0) hashedFirstName = hashSha256(parts[0]);
      if (parts.length > 1) hashedLastName = hashSha256(parts.slice(1).join(' '));
    }

    const payload: any = {
      data: [
        {
          event_name: eventName,
          event_time: eventTime || Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl || 'https://leads.asthros.com.br',
          action_source: 'website',
          user_data: {
            em: hashedEmail ? [hashedEmail] : undefined,
            ph: hashedPhone ? [hashedPhone] : undefined,
            fn: hashedFirstName ? [hashedFirstName] : undefined,
            ln: hashedLastName ? [hashedLastName] : undefined,
            client_ip_address: userData.ipAddress || undefined,
            client_user_agent: userData.userAgent || undefined,
            fbc: userData.fbc || undefined,
            fbp: userData.fbp || undefined,
          },
          custom_data: customData ? {
            currency: customData.currency || 'BRL',
            value: customData.value !== undefined ? customData.value : undefined,
            content_name: customData.content_name || undefined
          } : undefined
        }
      ]
    };

    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const url = `https://graph.facebook.com/v19.0/${pixelId.trim()}/events?access_token=${accessToken.trim()}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultText = await res.text();
    let resultJson: any = null;
    try { resultJson = JSON.parse(resultText); } catch(e) {}

    if (res.ok && resultJson && !resultJson.error) {
      return { success: true, response: resultJson };
    } else {
      console.error(`[Meta CAPI Erro]`, resultJson || resultText);
      return { success: false, error: resultJson?.error?.message || resultText };
    }
  } catch (err: any) {
    console.error(`[Meta CAPI Exceção]`, err);
    return { success: false, error: err.message || String(err) };
  }
}
