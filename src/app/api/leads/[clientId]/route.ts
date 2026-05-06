import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Rota de Webhook para captura de leads com autenticação via Secret Key.
 * URL: /api/leads/[clientId]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    
    // 1. Validar Autenticação (Secret Key)
    // Pode vir via Header ou Query Param
    const secret = request.headers.get('x-asthros-secret') || request.nextUrl.searchParams.get('secret');

    if (!secret) {
      return NextResponse.json({ error: 'Chave secreta ausente (X-Asthros-Secret)' }, { status: 401 });
    }

    // 2. Verificar se o segredo pertence a um webhook ativo do cliente
    const { data: webhook, error: authError } = await supabase
      .from('webhooks')
      .select('id, status')
      .eq('client_id', clientId)
      .eq('secret', secret)
      .eq('status', 'active')
      .single();

    if (authError || !webhook) {
      return NextResponse.json({ error: 'Chave secreta inválida ou webhook inativo' }, { status: 401 });
    }

    // 3. Validação básica de dados do lead
    if (!body.email && !body.name && !body.nome && !body.phone && !body.telefone) {
      return NextResponse.json(
        { error: 'Dados insuficientes para criar um lead (nome, email ou telefone)' },
        { status: 400 }
      );
    }

    // 4. Salvar o Lead associado ao Webhook
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([
        {
          client_id: clientId,
          webhook_id: webhook.id,
          name: body.name || body.nome || null,
          email: body.email || null,
          phone: body.phone || body.telefone || null,
          data: body
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Criar notificação para o cliente
    // Buscamos o primeiro usuário do sistema vinculado a este cliente para notificar
    const { data: userData } = await supabase
      .from('system_users')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)
      .single();

    if (userData) {
      await supabase.from('notifications').insert([{
        user_id: userData.id,
        client_id: clientId,
        title: 'Novo Lead Capturado',
        message: `O lead "${lead.name || 'Sem Nome'}" foi recebido via ${webhook.name}.`,
        type: 'success'
      }]);
    }

    return NextResponse.json(
      { 
        message: 'Sinal recebido e lead processado!', 
        leadId: lead.id,
        webhook: webhook.id
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no processamento do uplink:', error);
    return NextResponse.json(
      { error: 'Falha crítica no processamento do lead' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Asthros-Secret, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
