import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    const { email, password, name, role, client_id, avatar_style } = userData;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'E-mail, senha e nome são obrigatórios' }, { status: 400 });
    }

    // Cliente com permissões administrativas (Service Role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Criar o usuário no Auth (sem disparar login automático e sem confirmação se desejar)
    // Usamos admin.createUser para evitar o fluxo de confirmação se as configs permitirem
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Já cria como confirmado
      user_metadata: { display_name: name, role },
    });

    if (authError) throw authError;

    // 2. Criar o perfil na tabela system_users
    const { error: profileError } = await supabaseAdmin
      .from('system_users')
      .insert([{
        id: authData.user.id,
        name,
        email,
        role,
        client_id: client_id || null,
        avatar_style: avatar_style || 'avataaars',
        status: 'active',
        password_changed: false
      }]);

    if (profileError) {
      // Rollback: deletar o usuário do auth se o perfil falhar
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ message: 'Usuário provisionado com sucesso', userId: authData.user.id });
  } catch (error: any) {
    console.error('Erro no provisionamento administrativo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
