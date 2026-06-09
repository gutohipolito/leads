import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { clientId, archive } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório' }, { status: 400 });
    }

    // Inicializa o cliente do Supabase com privilégios de Admin (Service Role)
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
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem resetar dados.' }, { status: 403 });
    }

    // Buscar o nome do cliente para fins de log
    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();
    
    const clientName = clientData?.name || 'Cliente';

    if (archive) {
      // 2. Buscar todos os leads atuais do cliente
      const { data: leadsToArchive, error: fetchError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('client_id', clientId);

      if (fetchError) throw fetchError;

      // 3. Se houver leads, arquivá-los em lote na tabela archived_leads
      if (leadsToArchive && leadsToArchive.length > 0) {
        const archivedData = leadsToArchive.map(l => ({
          client_id: l.client_id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          data: l.data,
          source: l.source,
          created_at: l.created_at
        }));

        const { error: archiveError } = await supabaseAdmin
          .from('archived_leads')
          .insert(archivedData);

        if (archiveError) throw archiveError;
      }
    }

    // 4. Excluir os leads originais da tabela leads
    const { error: deleteError } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('client_id', clientId);

    if (deleteError) throw deleteError;

    // 5. Registrar no log de auditoria
    const actionDetails = archive 
      ? { action: 'reset_with_archive', client_name: clientName }
      : { action: 'reset_permanent', client_name: clientName };

    await supabaseAdmin.from('system_logs').insert([{
      action: archive ? 'Reset com Arquivamento' : 'Reset Permanente',
      entity: 'client',
      entity_id: clientId,
      details: actionDetails
    }]);

    return NextResponse.json({ 
      success: true, 
      message: archive 
        ? 'Resultados resetados e leads arquivados com sucesso!' 
        : 'Resultados deletados permanentemente!' 
    });

  } catch (error: any) {
    console.error('Erro ao resetar dados do cliente:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
