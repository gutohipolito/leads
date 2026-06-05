import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    let user: any = null;

    const token = authHeader.replace('Bearer ', '');
    if (token) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Buscar o perfil do usuário para verificar se ele está ativo
    const { data: profile } = await supabase
      .from('system_users')
      .select('status')
      .eq('email', user.email)
      .single();

    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Acesso negado: perfil inativo.' }, { status: 403 });
    }

    // Retorna a chave secreta configurada no servidor (ou um fallback estável se não configurado)
    const encryptionKey = process.env.LEADS_ENCRYPTION_KEY || 'asthros-default-secret-encryption-key-value-991823901';
    return NextResponse.json({ encryptionKey });

  } catch (error: any) {
    console.error('[Encryption Key API] Erro ao obter chave:', error);
    return NextResponse.json({ error: 'Erro interno: ' + error.message }, { status: 500 });
  }
}
