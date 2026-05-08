import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpjRaw = searchParams.get('cnpj');

  if (!cnpjRaw) {
    return NextResponse.json({ error: 'CNPJ é obrigatório' }, { status: 400 });
  }

  const cnpj = cnpjRaw.replace(/\D/g, '');

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v2/${cnpj}`, {
      cache: 'no-store'
    });

    if (response.status === 403 || response.status === 429) {
      return NextResponse.json(
        { error: 'O serviço de busca automática (BrasilAPI) está instável ou bloqueou a consulta temporariamente. Por favor, preencha os dados manualmente.' }, 
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return NextResponse.json(
        { error: 'CNPJ não encontrado ou serviço de busca indisponível.' }, 
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro no Proxy CNPJ:', error);
    return NextResponse.json({ error: 'Erro ao processar consulta de CNPJ.' }, { status: 500 });
  }
}
