import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Rota de Webhook para captura de leads ultra-compatível (Elementor, WPForms, etc).
 * URL: /api/leads/[clientId]?secret=SUA_CHAVE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    // Suporte a JSON ou Form Data (Elementor pode enviar ambos)
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    }
    
    const secret = request.headers.get('x-asthros-secret') || request.nextUrl.searchParams.get('secret');

    if (!secret) {
      return NextResponse.json({ error: 'Chave secreta ausente. Use ?secret= no final da URL ou o header X-Asthros-Secret.' }, { status: 401 });
    }

    const { data: webhook, error: authError } = await supabase
      .from('webhooks')
      .select('id, status, name, outbound_url, notification_email')
      .eq('client_id', clientId)
      .eq('secret', secret)
      .eq('status', 'active')
      .single();

    if (authError || !webhook) {
      return NextResponse.json({ error: 'Chave secreta inválida ou webhook inativo para este cliente.' }, { status: 401 });
    }

    const isWppTracker = body.source === 'whatsapp_tracker';
    const fields = body.fields || {};
    
    let name = body.name || body.nome || body.full_name || fields.name || fields.nome || 'Lead s/ Nome';
    const email = body.email || body.e_mail || fields.email || fields.e_mail || null;
    const phone = body.phone || body.telefone || body.whatsapp || fields.phone || fields.telefone || null;

    if (isWppTracker) {
      name = `Click Wpp: ${body.marketing?.source || 'Direto'}`;
    }

    const source = body.source === 'test_simulation' 
      ? 'test_simulation' 
      : (isWppTracker ? 'whatsapp_tracker' : 'form');

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([
        {
          client_id: clientId,
          webhook_id: webhook.id,
          name: name,
          email: email,
          phone: phone,
          data: body,
          source: source
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    let outboundStatus = null;
    let outboundResponse = null;
    let outboundError = null;

    if (webhook.outbound_url) {
      try {
        const response = await fetch(webhook.outbound_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'lead.captured',
            lead_id: lead.id,
            name,
            email,
            phone,
            source: isWppTracker ? 'whatsapp_tracker' : 'form',
            raw_data: body,
            timestamp: new Date().toISOString()
          })
        });
        outboundStatus = response.status;
        outboundResponse = await response.text();
      } catch (err: any) {
        outboundError = err.message;
      }
    }

    await supabase.from('webhook_logs').insert([{
      webhook_id: webhook.id,
      client_id: clientId,
      status_code: outboundStatus || 201,
      request_body: body,
      response_body: outboundResponse,
      error_message: outboundError
    }]);

    if (webhook.notification_email) {
      console.log(`[Email] Disparando alerta para ${webhook.notification_email}`);
      // resend.emails.send({ from: 'Asthros <leads@asthros.com.br>', to: webhook.notification_email, ... });
    }

    const { data: userData } = await supabase
      .from('system_users')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)
      .maybeSingle();

    const origin = request.headers.get('origin') || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (userData) {
      const notificationTitle = isWppTracker ? 'Intercepção de WhatsApp' : 'Novo Lead via Form';
      const notificationMsg = isWppTracker 
        ? `Um usuário de ${body.marketing?.source || 'origem direta'} clicou no WhatsApp.`
        : `Recebemos os dados de "${name}" através do webhook ${webhook.name}.`;

      await supabase.from('notifications').insert([{
        user_id: userData.id,
        client_id: clientId,
        title: notificationTitle,
        message: notificationMsg,
        type: isWppTracker ? 'info' : 'success'
      }]);
    }

    return NextResponse.json(
      { 
        status: 'success',
        message: 'Sinal de Uplink processado com sucesso!', 
        lead_id: lead.id
      }, 
      { 
        status: 201,
        headers: corsHeaders
      }
    );
  } catch (error: any) {
    console.error('Erro no processamento do uplink:', error);
    const origin = request.headers.get('origin') || '*';
    return NextResponse.json(
      { error: 'Falha no processamento: ' + (error.message || 'Erro interno') },
      { 
        status: 500,
        headers: { 
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
