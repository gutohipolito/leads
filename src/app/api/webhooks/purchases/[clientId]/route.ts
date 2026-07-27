import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { encrypt } from '@/utils/encryption';

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

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id, X-Yampi-Hmac-Sha256, X-Shopify-Topic',
      },
    }
  );
}

/**
 * Webhook Universal para Ingestão de Compras/Conversões (Yampi, Shopify, Generic)
 * URL: /api/webhooks/purchases/[clientId]?secret=CHAVE_SECRET
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, X-Asthros-Webhook-Id',
  };

  try {
    const { clientId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Suporte a JSON ou Form Data
    const contentType = request.headers.get('content-type') || '';
    let rawBody: any = {};

    if (contentType.includes('application/json')) {
      rawBody = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        rawBody[key] = value;
      });
    }

    const secret =
      request.headers.get('x-asthros-secret') ||
      rawBody.secret ||
      searchParams.get('secret');

    // 1. Validar a chave do cliente no banco
    const { data: webhook, error: authError } = await supabase
      .from('webhooks')
      .select('id, client_id, user_id, secret, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle();

    if (authError || !webhook) {
      return NextResponse.json(
        { error: 'Cliente não encontrado ou webhook inativo.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Se houver secret cadastrado e um secret for enviado, validar se correspondem
    if (webhook.secret && secret && webhook.secret !== secret) {
      return NextResponse.json(
        { error: 'Chave secreta inválida para este cliente.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = sanitizeInput(rawBody);

    // 2. Parser Normalizador (Yampi, Shopify, Genérico)
    let gateway = 'generic';
    let orderId = '';
    let status = 'approved';
    let totalAmount = 0;
    let customerName = 'Cliente';
    let customerEmail = '';
    let items: any[] = [];
    let visitorId = searchParams.get('asthros_vid') || body.asthros_vid || body.visitor_id || '';
    let utmSource = searchParams.get('utm_source') || body.utm_source || '';
    let utmMedium = searchParams.get('utm_medium') || body.utm_medium || '';
    let utmCampaign = searchParams.get('utm_campaign') || body.utm_campaign || '';

    // A) YAMPI PAYLOAD PARSER
    if (body.event || body.resource === 'order' || body.data?.number || body.data?.id) {
      gateway = 'yampi';
      const orderData = body.data || body;
      orderId = String(orderData.number || orderData.id || `YAMPI-${Date.now()}`);
      
      const rawStatus = String(orderData.status || body.event || '').toLowerCase();
      if (rawStatus.includes('paid') || rawStatus.includes('approved') || rawStatus.includes('order.paid')) {
        status = 'approved';
      } else if (rawStatus.includes('refund') || rawStatus.includes('canceled')) {
        status = 'canceled';
      } else {
        status = 'pending';
      }

      totalAmount = parseFloat(orderData.total || orderData.value || '0');
      
      if (orderData.customer) {
        const fname = orderData.customer.first_name || '';
        const lname = orderData.customer.last_name || '';
        customerName = `${fname} ${lname}`.trim() || orderData.customer.name || 'Cliente Yampi';
        customerEmail = orderData.customer.email || '';
      }

      if (Array.isArray(orderData.items)) {
        items = orderData.items.map((it: any) => ({
          name: it.title || it.name || 'Produto',
          quantity: it.quantity || 1,
          price: parseFloat(it.price || '0')
        }));
      }

      visitorId = visitorId || orderData.src || orderData.utm_content || orderData.custom_fields?.asthros_vid || '';
      utmSource = utmSource || orderData.utm_source || orderData.src || '';
      utmMedium = utmMedium || orderData.utm_medium || '';
      utmCampaign = utmCampaign || orderData.utm_campaign || '';
    }
    // B) SHOPIFY PAYLOAD PARSER
    else if (body.line_items || request.headers.get('x-shopify-topic')) {
      gateway = 'shopify';
      orderId = String(body.order_number || body.id || `SHOPIFY-${Date.now()}`);
      status = body.financial_status === 'paid' ? 'approved' : 'pending';
      totalAmount = parseFloat(body.total_price || '0');

      if (body.customer) {
        customerName = `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() || 'Cliente Shopify';
        customerEmail = body.customer.email || body.email || '';
      } else {
        customerEmail = body.email || '';
      }

      if (Array.isArray(body.line_items)) {
        items = body.line_items.map((it: any) => ({
          name: it.title || it.name || 'Produto',
          quantity: it.quantity || 1,
          price: parseFloat(it.price || '0')
        }));
      }

      if (Array.isArray(body.note_attributes)) {
        const vidAttr = body.note_attributes.find((a: any) => a.name === 'asthros_vid' || a.name === 'visitor_id');
        if (vidAttr) visitorId = vidAttr.value;
      }
    }
    // C) PARSER GENÉRICO
    else {
      gateway = 'generic';
      orderId = String(body.order_id || body.id || `ORD-${Date.now()}`);
      status = String(body.status || 'approved').toLowerCase();
      totalAmount = parseFloat(body.total_amount || body.amount || body.value || '0');
      customerName = body.customer_name || body.name || body.customer?.name || 'Cliente';
      customerEmail = body.customer_email || body.email || body.customer?.email || '';

      if (Array.isArray(body.items)) {
        items = body.items;
      }
    }

    const encryptionSecret = process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';
    const encryptedEmail = customerEmail ? encrypt(customerEmail, encryptionSecret) : '';

    // 3. Salvar no Banco de Dados (tabela purchases)
    const purchaseData = {
      client_id: clientId,
      visitor_id: visitorId || null,
      order_id: orderId,
      gateway,
      customer_name: customerName,
      customer_email: encryptedEmail,
      total_amount: totalAmount,
      status,
      currency: 'BRL',
      items,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      raw_payload: body,
      created_at: new Date().toISOString(),
    };

    let purchaseId: string | null = null;

    try {
      const { data: inserted, error: dbError } = await supabase
        .from('purchases')
        .insert(purchaseData)
        .select('id')
        .single();

      if (!dbError && inserted) {
        purchaseId = inserted.id;
      } else if (dbError) {
        console.warn('[Purchases] Aviso ao inserir compra no DB (tabela purchases pode precisar ser criada):', dbError.message);
      }
    } catch (err: any) {
      console.warn('[Purchases] Erro na inserção no banco:', err.message);
    }

    // 4. Enviar notificação em tempo real para o usuário
    if (webhook.user_id) {
      try {
        const formattedAmount = totalAmount > 0 
          ? `R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
          : '';

        await supabase.from('notifications').insert({
          user_id: webhook.user_id,
          client_id: clientId,
          title: `🎉 Nova Venda (${gateway.toUpperCase()})`,
          message: `Pedido #${orderId} de ${customerName} ${formattedAmount ? `- Total: ${formattedAmount}` : ''}`.trim(),
          read: false,
        });
      } catch (notifErr) {
        console.error('Erro ao enviar notificação de compra:', notifErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Compra registrada com sucesso!',
        purchase_id: purchaseId,
        order_id: orderId,
        gateway,
        status,
        total_amount: totalAmount,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Erro ao processar webhook de compra:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook de compra.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
