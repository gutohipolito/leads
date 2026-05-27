import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint de teste de envio de webhook externo (outbound).
 * URL: /api/webhooks/test-outbound
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { type, config, outboundUrl } = body;

    // Retrocompatibilidade
    if (!type && outboundUrl) {
      type = 'webhook';
      config = { url: outboundUrl };
    }

    if (!type) {
      return NextResponse.json({ error: 'Tipo de integração não especificado.' }, { status: 400 });
    }

    // Payload de teste simulando um lead capturado
    const payload = {
      event: 'lead.test',
      lead_id: 'test-uuid-1234-5678',
      name: 'Cliente de Teste Asthros',
      email: 'teste-webhook@asthros.com.br',
      phone: '5511999999999',
      source: 'form',
      lead_score: 85,
      raw_data: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'campanha_teste_glow'
      },
      timestamp: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const startTime = Date.now();
    let response: Response;

    try {
      if (type === 'webhook') {
        const url = config?.url?.trim();
        if (!url) {
          throw new Error('URL de destino do Webhook vazia ou inválida.');
        }
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } 
      else if (type === 'hubspot') {
        const portalId = config?.portalId?.trim();
        const formId = config?.formId?.trim();
        if (!portalId || !formId) {
          throw new Error('Portal ID (Hub ID) ou Form ID (GUID do Formulário) ausentes.');
        }
        response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            fields: [
              { name: 'email', value: payload.email },
              { name: 'firstname', value: payload.name },
              { name: 'phone', value: payload.phone }
            ],
            context: {
              pageUri: 'https://asthros.com.br/teste',
              pageName: 'Página de Teste Asthros'
            }
          }),
          signal: controller.signal
        });
      } 
      else if (type === 'activecampaign') {
        const apiUrl = config?.apiUrl?.trim();
        const apiKey = config?.apiKey?.trim();
        const listId = config?.listId?.trim();
        if (!apiUrl || !apiKey) {
          throw new Error('API URL ou API Key do ActiveCampaign ausentes.');
        }
        
        // Criar contato de teste
        response = await fetch(`${apiUrl}/api/3/contacts`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            contact: {
              email: payload.email,
              firstName: payload.name,
              phone: payload.phone
            }
          }),
          signal: controller.signal
        });

        // Se deu sucesso e tem lista, tenta colocar na lista (opcional/não-bloqueante)
        if (response.ok && listId) {
          try {
            const json = await response.clone().json();
            if (json.contact?.id) {
              await fetch(`${apiUrl}/api/3/contactLists`, {
                method: 'POST',
                headers: {
                  'Api-Token': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  contactList: {
                    list: listId,
                    contact: json.contact.id,
                    status: 1
                  }
                }),
                signal: controller.signal
              });
            }
          } catch (listErr) {
            console.error('Erro de teste ao adicionar contato à lista AC:', listErr);
          }
        }
      } 
      else if (type === 'zapi') {
        const instanceId = config?.instanceId?.trim();
        const token = config?.token?.trim();
        const targetPhone = config?.targetPhone?.trim();
        if (!instanceId || !token || !targetPhone) {
          throw new Error('Instance ID, Token ou Telefone do Destinatário ausentes.');
        }

        const msg = `⚡ *Conexão Asthros Leads*\n\nSeu canal Z-API foi configurado com sucesso! Este é um disparo automático de validação do Hub de Integrações.\n\n*Horário:* ${new Date().toLocaleTimeString('pt-BR')}`;
        
        response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            phone: targetPhone,
            message: msg
          }),
          signal: controller.signal
        });
      } 
      else {
        throw new Error(`Provedor de integração '${type}' não é suportado.`);
      }

      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        success: false,
        error: fetchErr.name === 'AbortError' 
          ? 'Timeout: O servidor de destino demorou mais de 10 segundos para responder.' 
          : `Falha na conexão externa: ${fetchErr.message}`,
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
      responseBody: responseBody.slice(0, 1000), // Previne estourar payload
      payloadSent: payload
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno no servidor de teste' }, { status: 500 });
  }
}
