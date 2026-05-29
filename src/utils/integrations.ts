import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

/**
 * Função utilitária para repassar os dados de um lead capturado para todas
 * as integrações ativas configuradas para o cliente (CRM, Webhooks, etc.).
 */
export async function sendLeadToIntegrations(params: {
  lead: { id: string; name?: string; email?: string; phone?: string; source?: string };
  clientId: string;
  webhook: { id: string; name: string; outbound_url?: string };
  body: any;
}) {
  const { lead, clientId, webhook, body } = params;
  const name = lead.name || 'Lead s/ Nome';
  const email = lead.email || null;
  const phone = lead.phone || null;
  const source = lead.source || 'form';

  // Buscar integrações ativas do cliente no banco
  const { data: dbIntegrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active');

  const activeIntegrations = [...(dbIntegrations || [])];
  
  // Suporte ao webhook legado configurado nas configurações de webhook
  if (webhook.outbound_url) {
    activeIntegrations.push({
      id: 'legacy-webhook',
      name: 'Webhook Legado',
      type: 'webhook',
      config: { url: webhook.outbound_url }
    });
  }

  if (activeIntegrations.length > 0) {
    const repassePromises = activeIntegrations.map(async (integration) => {
      let status = 200;
      let responseText = '';
      let errorMsg = null;

      try {
        const payloadToSend = {
          event: 'lead.captured',
          lead_id: lead.id,
          name,
          email,
          phone,
          source: source,
          lead_score: body.lead_score,
          raw_data: body,
          timestamp: new Date().toISOString()
        };

        if (integration.type === 'webhook') {
          const url = integration.config?.url;
          if (url) {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadToSend)
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('URL do webhook de repasse não configurada.');
          }
        } 
        else if (integration.type === 'hubspot') {
          const portalId = integration.config?.portalId;
          const formId = integration.config?.formId;
          if (portalId && formId) {
            const res = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: [
                  { name: 'email', value: email || '' },
                  { name: 'firstname', value: name || '' },
                  { name: 'phone', value: phone || '' }
                ],
                context: {
                  pageUri: body.marketing?.page_url || '',
                  pageName: body.marketing?.page_title || ''
                }
              })
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('portalId ou formId do HubSpot ausentes.');
          }
        }
        else if (integration.type === 'activecampaign') {
          const apiUrl = integration.config?.apiUrl;
          const apiKey = integration.config?.apiKey;
          const listId = integration.config?.listId;
          if (apiUrl && apiKey) {
            const res = await fetch(`${apiUrl}/api/3/contacts`, {
              method: 'POST',
              headers: {
                'Api-Token': apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contact: {
                  email: email || '',
                  firstName: name || '',
                  phone: phone || ''
                }
              })
            });
            status = res.status;
            const json = await res.json();
            responseText = JSON.stringify(json);
            
            if (res.ok && listId && json.contact?.id) {
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
                })
              });
            }
          } else {
            throw new Error('API URL ou API Key do ActiveCampaign ausentes.');
          }
        }
        else if (integration.type === 'zapi') {
          const instanceId = integration.config?.instanceId;
          const token = integration.config?.token;
          const targetPhone = integration.config?.targetPhone;
          
          if (instanceId && token && targetPhone) {
            const msg = `🚀 *Novo Lead Asthros!*\n\n*Nome:* ${name}\n*E-mail:* ${email || 'N/A'}\n*Telefone:* ${phone || 'N/A'}\n*Origem:* ${source}\n*Score:* ${body.lead_score} pts`;
            const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: targetPhone,
                message: msg
              })
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('instanceId, token ou targetPhone do Z-API ausentes.');
          }
        }
        else if (integration.type === 'rdstation') {
          const tokenApi = integration.config?.tokenApi;
          const identifier = integration.config?.identifier || 'asthros_lead_capture';
          if (tokenApi) {
            const res = await fetch(`https://api.rd.services/platform/conversions?api_key=${tokenApi}`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Asthros-Webhook/1.0'
              },
              body: JSON.stringify({
                event_type: "CONVERSION",
                event_family: "CDP",
                payload: {
                  email: email || '',
                  name: name || '',
                  personal_phone: phone || '',
                  conversion_identifier: identifier,
                  traffic_source: body.marketing?.source || '',
                  traffic_medium: body.marketing?.medium || '',
                  traffic_campaign: body.marketing?.campaign || '',
                  cf_lead_score: body.lead_score?.toString() || '0'
                }
              })
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('API Token do RD Station ausente.');
          }
        }
        else if (integration.type === 'pipedrive') {
          const apiToken = integration.config?.apiToken;
          const stageId = integration.config?.stageId;
          if (apiToken) {
            const personRes = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${apiToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                email: email ? [email] : [],
                phone: phone ? [phone] : []
              })
            });
            
            status = personRes.status;
            const personData = await personRes.json();
            
            if (personRes.ok && personData.success && personData.data?.id) {
              const personId = personData.data.id;
              const dealRes = await fetch(`https://api.pipedrive.com/v1/deals?api_token=${apiToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `Lead - ${name}`,
                  person_id: personId,
                  stage_id: stageId ? parseInt(stageId) : undefined
                })
              });
              
              status = dealRes.status;
              const dealData = await dealRes.json();
              responseText = JSON.stringify({ person: personData.data, deal: dealData.data });
            } else {
              responseText = JSON.stringify(personData);
              throw new Error(personData.error || 'Falha ao criar pessoa no Pipedrive.');
            }
          } else {
            throw new Error('apiToken do Pipedrive ausente.');
          }
        }
        else if (integration.type === 'piperun') {
          const token = integration.config?.token;
          const stageId = integration.config?.stageId;
          if (token) {
            const res = await fetch('https://app.piperun.com/api/v1/leads', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'token': token
              },
              body: JSON.stringify({
                rules: { update: true, equal_pipeline: true },
                lead: {
                  title: `Lead - ${name}`,
                  name,
                  email,
                  phone,
                  stage_id: stageId ? parseInt(stageId) : undefined
                }
              })
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('token do PipeRun ausente.');
          }
        }
        else if (integration.type === 'kommo') {
          const subdomain = integration.config?.subdomain;
          const token = integration.config?.token;
          if (subdomain && token) {
            const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/complex`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify([
                {
                  name: `Negócio - ${name}`,
                  _embedded: {
                    contacts: [
                      {
                        first_name: name,
                        custom_fields_values: [
                          ...(email ? [{
                            field_code: "EMAIL",
                            values: [{ value: email, enum_code: "WORK" }]
                          }] : []),
                          ...(phone ? [{
                            field_code: "PHONE",
                            values: [{ value: phone, enum_code: "WORK" }]
                          }] : [])
                        ]
                      }
                    ]
                  }
                }
              ])
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('subdomain ou token do Kommo ausentes.');
          }
        }
        else if (integration.type === 'leadlovers') {
          const token = integration.config?.token;
          const machineId = integration.config?.machineId;
          const sequenceId = integration.config?.sequenceId;
          const levelCode = integration.config?.levelCode;
          if (token) {
            const res = await fetch(`https://mkt.leadlovers.com/api/v1/lead?token=${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                Name: name,
                Email: email || '',
                Phone: phone || '',
                MachineCode: machineId ? parseInt(machineId) : undefined,
                EmailSequenceCode: sequenceId ? parseInt(sequenceId) : undefined,
                SequenceLevelCode: levelCode ? parseInt(levelCode) : 1
              })
            });
            status = res.status;
            responseText = await res.text();
          } else {
            throw new Error('token do Leadlovers ausente.');
          }
        }
      } catch (err: any) {
        status = 500;
        errorMsg = err.message;
      }

      // Registrar Log de Repasse no banco com o lead_id associado!
      await supabase.from('webhook_logs').insert([{
        webhook_id: webhook.id,
        client_id: clientId,
        lead_id: lead.id,
        status_code: status,
        request_body: { ...body, integration_name: integration.name, integration_type: integration.type },
        response_body: responseText.substring(0, 1000),
        error_message: errorMsg
      }]);
    });

    await Promise.all(repassePromises);
  } else {
    await supabase.from('webhook_logs').insert([{
      webhook_id: webhook.id,
      client_id: clientId,
      lead_id: lead.id,
      status_code: 201,
      request_body: body,
      response_body: 'Lead gravado internamente com sucesso (Sem integrações adicionais).'
    }]);
  }
}
