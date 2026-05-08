import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpjRaw = searchParams.get('cnpj');

  if (!cnpjRaw) {
    return NextResponse.json({ error: 'CNPJ é obrigatório' }, { status: 400 });
  }

  const cnpj = cnpjRaw.replace(/\D/g, '');

  try {
    console.log(`Tentando BrasilAPI (V2) para CNPJ: ${cnpj}`);
    let response = await fetch(`https://brasilapi.com.br/api/cnpj/v2/${cnpj}`, { cache: 'no-store' });
    let data = null;

    // Se a BrasilAPI falhar por bloqueio ou erro, tentamos o Fallback (ReceitaWS)
    if (!response.ok || response.status === 403 || response.status === 429) {
      console.warn(`BrasilAPI falhou (${response.status}). Tentando Fallback ReceitaWS...`);
      const fallbackResponse = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, { cache: 'no-store' });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        data = {
          razao_social: fallbackData.nome,
          email: fallbackData.email,
          ...fallbackData
        };
        console.log('Busca concluída via Fallback ReceitaWS.');
        return NextResponse.json(data);
      } else {
        // Segundo Fallback: CNPJ.ws
        console.warn('ReceitaWS falhou. Tentando Fallback CNPJ.ws...');
        const lastChanceResponse = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { cache: 'no-store' });
        if (lastChanceResponse.ok) {
          const lastChanceData = await lastChanceResponse.json();
          data = {
            razao_social: lastChanceData.razao_social,
            email: lastChanceData.estabelecimento.email,
            ...lastChanceData
          };
          console.log('Busca concluída via Fallback CNPJ.ws.');
          return NextResponse.json(data);
        }
      }
    } else {
      data = await response.json().catch(() => null);
    }

    if (!data || data.error) {
      return NextResponse.json(
        { error: 'Serviço de busca (BrasilAPI/ReceitaWS) indisponível no momento. Por favor, preencha manualmente.' }, 
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro fatal no Proxy CNPJ:', error);
    return NextResponse.json({ error: 'Erro ao processar consulta. Tente preencher manualmente.' }, { status: 500 });
  }
}
