import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint de teste de envio de webhook externo (outbound).
 * URL: /api/webhooks/test-outbound
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outboundUrl } = body;

    if (!outboundUrl) {
      return NextResponse.json({ error: 'URL de destino ausente.' }, { status: 400 });
    }

    // Payload idêntico ao disparado no fluxo real de leads
    const payload = {
      event: 'lead.test',
      lead_id: 'test-uuid-1234-5678',
      name: 'Cliente de Teste Asthros',
      email: 'teste-webhook@asthros.com.br',
      phone: '11999999999',
      source: 'form',
      raw_data: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'campanha_teste'
      },
      timestamp: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const startTime = Date.now();
    let response;
    
    try {
      response = await fetch(outboundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Asthros-Webhook-Tester/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        success: false,
        error: fetchErr.name === 'AbortError' 
          ? 'Timeout: O servidor de destino demorou mais de 8 segundos para responder.' 
          : `Falha na conexão: ${fetchErr.message}`,
        payloadSent: payload
      }, { status: 502 });
    }

    const duration = Date.now() - startTime;
    const responseBody = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      durationMs: duration,
      responseBody: responseBody.slice(0, 1000), // Limita corpo da resposta para não estourar payload
      payloadSent: payload
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
