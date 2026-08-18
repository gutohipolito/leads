import { NextRequest, NextResponse } from 'next/server';
import { sendMetaCapiEvent } from '@/lib/capiService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function getActiveUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('system_users')
    .select('status')
    .eq('email', user.email)
    .single();

  if (!profile || profile.status !== 'active') return null;
  return user;
}

/**
 * Endpoint de teste de envio de webhook externo (outbound).
 * URL: /api/webhooks/test-outbound
 *
 * Este endpoint dispara requisições HTTP do servidor para uma URL fornecida
 * pelo chamador (SSRF por design, já que é justamente um "testador" de
 * integrações externas) — por isso exige um usuário autenticado e ativo,
 * evitando que qualquer visitante anônimo use o servidor como proxy.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getActiveUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

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
      else if (type === 'rdstation') {
        const tokenApi = config?.tokenApi?.trim();
        const identifier = config?.identifier?.trim() || 'asthros_lead_capture';
        if (!tokenApi) {
          throw new Error('API Token do RD Station ausente.');
        }
        
        response = await fetch(`https://api.rd.services/platform/conversions?api_key=${tokenApi}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            event_type: "CONVERSION",
            event_family: "CDP",
            payload: {
              email: payload.email,
              name: payload.name,
              personal_phone: payload.phone,
              conversion_identifier: identifier,
              traffic_source: payload.raw_data.utm_source,
              traffic_medium: payload.raw_data.utm_medium,
              traffic_campaign: payload.raw_data.utm_campaign,
              cf_lead_score: payload.lead_score.toString()
            }
          }),
          signal: controller.signal
        });
      }
      else if (type === 'pipedrive') {
        const apiToken = config?.apiToken?.trim();
        const stageId = config?.stageId?.trim();
        if (!apiToken) {
          throw new Error('API Token do Pipedrive ausente.');
        }
        
        response = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${apiToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            name: payload.name,
            email: [payload.email],
            phone: [payload.phone]
          }),
          signal: controller.signal
        });
        
        if (response.ok && stageId) {
          try {
            const json = await response.clone().json();
            if (json.success && json.data?.id) {
              await fetch(`https://api.pipedrive.com/v1/deals?api_token=${apiToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `Lead de Teste - ${payload.name}`,
                  person_id: json.data.id,
                  stage_id: parseInt(stageId)
                }),
                signal: controller.signal
              });
            }
          } catch (dealErr) {
            console.error('Erro de teste ao criar negócio Pipedrive:', dealErr);
          }
        }
      }
      else if (type === 'piperun') {
        const token = config?.token?.trim();
        const stageId = config?.stageId?.trim();
        if (!token) {
          throw new Error('Token do PipeRun ausente.');
        }
        
        response = await fetch('https://app.piperun.com/api/v1/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': token,
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            rules: { update: true, equal_pipeline: true },
            lead: {
              title: `Lead de Teste - ${payload.name}`,
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              stage_id: stageId ? parseInt(stageId) : undefined
            }
          }),
          signal: controller.signal
        });
      }
      else if (type === 'kommo') {
        const subdomain = config?.subdomain?.trim();
        const token = config?.token?.trim();
        if (!subdomain || !token) {
          throw new Error('Subdomain ou Token do Kommo ausentes.');
        }
        
        response = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/complex`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify([
            {
              name: `Negócio de Teste - ${payload.name}`,
              _embedded: {
                contacts: [
                  {
                    first_name: payload.name,
                    custom_fields_values: [
                      {
                        field_code: "EMAIL",
                        values: [{ value: payload.email, enum_code: "WORK" }]
                      },
                      {
                        field_code: "PHONE",
                        values: [{ value: payload.phone, enum_code: "WORK" }]
                      }
                    ]
                  }
                ]
              }
            }
          ]),
          signal: controller.signal
        });
      }
      else if (type === 'leadlovers') {
        const token = config?.token?.trim();
        const machineId = config?.machineId?.trim();
        const sequenceId = config?.sequenceId?.trim();
        const levelCode = config?.levelCode?.trim();
        if (!token) {
          throw new Error('Token do Leadlovers ausente.');
        }
        
        response = await fetch(`https://mkt.leadlovers.com/api/v1/lead?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Asthros-Webhook-Tester/1.0'
          },
          body: JSON.stringify({
            Name: payload.name,
            Email: payload.email,
            Phone: payload.phone,
            MachineCode: machineId ? parseInt(machineId) : undefined,
            EmailSequenceCode: sequenceId ? parseInt(sequenceId) : undefined,
            SequenceLevelCode: levelCode ? parseInt(levelCode) : 1
          }),
          signal: controller.signal
        });
      }
      else if (type === 'meta_capi') {
        const pixelId = config?.pixelId?.trim();
        const accessToken = config?.accessToken?.trim();
        const testEventCode = config?.testEventCode?.trim();

        if (!pixelId || !accessToken) {
          throw new Error('Pixel ID ou Access Token do Meta CAPI ausentes.');
        }

        const capiResult = await sendMetaCapiEvent({
          pixelId,
          accessToken,
          eventName: 'Lead',
          eventId: payload.lead_id,
          eventSourceUrl: 'https://leads.asthros.com.br/teste',
          userData: {
            email: payload.email,
            phone: payload.phone,
            name: payload.name,
            ipAddress: '189.10.20.30',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Asthros-CAPI-Test/1.0',
            fbc: 'fb.1.1554763741205.IwAR123456789',
            fbp: 'fb.1.1554763741205.1098272494'
          },
          testEventCode
        });

        if (capiResult.success) {
          return NextResponse.json({
            success: true,
            durationMs: Date.now() - startTime,
            status: 200,
            responseBody: JSON.stringify(capiResult.response)
          });
        } else {
          return NextResponse.json({
            success: false,
            durationMs: Date.now() - startTime,
            status: 400,
            error: capiResult.error
          }, { status: 400 });
        }
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
    console.error('[Webhook Test Outbound] Erro:', error);
    return NextResponse.json({ error: 'Erro interno no servidor de teste.' }, { status: 500 });
  }
}
