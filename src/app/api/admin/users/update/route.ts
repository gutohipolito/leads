import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'ID do usuário e senha são obrigatórios' }, { status: 400 });
    }

    // Usamos a SERVICE_ROLE_KEY para ter permissões administrativas
    // Esta chave deve ser configurada nas variáveis de ambiente do Vercel/Local
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // CHAVE SECRETA
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Validar autenticação do solicitante e permissões de administrador
    const authHeader = request.headers.get('Authorization') || '';
    let user: any = null;

    const token = authHeader.replace('Bearer ', '');
    if (token) {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('system_users')
      .select('role')
      .eq('email', user.email)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem atualizar usuários.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (error) throw error;

    return NextResponse.json({ message: 'Senha atualizada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao atualizar senha via Admin API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
