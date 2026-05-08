import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj.replace(/\D/g, '');

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      next: { revalidate: 86400 } // Cache por 24 horas
    });

    if (response.status === 429) {
      return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro no Proxy CNPJ:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar CNPJ' }, { status: 500 });
  }
}
