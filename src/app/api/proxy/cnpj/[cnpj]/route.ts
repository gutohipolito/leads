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
    console.log(`Buscando CNPJ no Proxy: ${cnpj}`);
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);

    if (response.status === 429) {
      return NextResponse.json({ error: 'Limite de consultas excedido na BrasilAPI. Tente novamente mais tarde.' }, { status: 429 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da BrasilAPI:', response.status, errorText);
      return NextResponse.json({ error: 'CNPJ não encontrado ou indisponível.' }, { status: response.status });
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('BrasilAPI não retornou JSON:', contentType);
      return NextResponse.json({ error: 'Resposta inválida do serviço de busca.' }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro fatal no Proxy CNPJ:', error.message);
    return NextResponse.json({ error: 'Erro interno ao processar a consulta.' }, { status: 500 });
  }
}
