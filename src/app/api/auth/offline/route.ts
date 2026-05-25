import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Obter o usuário conectado na sessão atual baseada em cookies
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 1. Atualizar last_active_at para null na tabela system_users
      const { error: dbError } = await supabase
        .from('system_users')
        .update({ last_active_at: null })
        .eq('email', user.email);

      if (dbError) {
        console.error('Erro ao atualizar status offline no banco:', dbError);
      }
      
      // 2. Fazer signOut no Supabase (limpa a sessão remota e remove os cookies)
      await supabase.auth.signOut();
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao processar status offline via API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
