import { NextRequest, NextResponse } from 'next/server';

/**
 * Rota de Webhook para captura de leads.
 * URL: /api/leads/[clientId]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();

    // Aqui seria a lógica de salvar no banco de dados
    console.log(`[Lead Capturado] Cliente: ${clientId}`, body);

    // Validação básica (opcional dependendo do formulário do cliente)
    if (!body.email && !body.nome && !body.telefone) {
      return NextResponse.json(
        { error: 'Dados insuficientes para criar um lead' },
        { status: 400 }
      );
    }

    // Simulando persistência
    const newLead = {
      id: Math.random().toString(36).substring(7),
      clientId,
      ...body,
      receivedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { 
        message: 'Lead capturado com sucesso!', 
        leadId: newLead.id 
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no webhook:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar lead' },
      { status: 500 }
    );
  }
}

// Suporte para CORS (caso o formulário do cliente envie direto via JS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
