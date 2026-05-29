import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { sendLeadToIntegrations } from '@/utils/integrations';

export async function POST(request: NextRequest) {
  try {
    const { leadId } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório.' }, { status: 400 });
    }

    // 1. Validar autenticação do usuário
    const authHeader = request.headers.get('Authorization') || '';
    let user: any = null;

    // Tentar ler a sessão local através do supabase admin
    const token = authHeader.replace('Bearer ', '');
    if (token) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    // Fallback: se não veio token no header, tenta pegar a sessão dos cookies/supabase.auth do request original
    if (!user) {
      // Como o Next.js lida com cookies HTTP no backend, podemos usar getSession do client padrão,
      // mas no contexto de API Router, a melhor prática é obter o usuário ativo
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      user = sessionUser;
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // 2. Buscar o perfil do usuário para verificar permissões
    const { data: profile } = await supabase
      .from('system_users')
      .select('role, client_id')
      .eq('email', user.email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Usuário sem perfil cadastrado.' }, { status: 403 });
    }

    // 3. Buscar os dados do Lead no banco
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, webhooks (id, name, outbound_url)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
    }

    // 4. Validar permissão de acesso ao cliente
    const isUserAdmin = profile.role === 'admin';
    const isMatchClient = String(profile.client_id) === String(lead.client_id);

    if (!isUserAdmin && !isMatchClient) {
      return NextResponse.json({ error: 'Sem permissão para este cliente.' }, { status: 403 });
    }

    // 5. Estruturar parâmetros e repassar para o hub de integrações
    const webhookMock = {
      id: lead.webhooks?.id || lead.webhook_id || 'manual_retry',
      name: lead.webhooks?.name || lead.data?.captured_by?.name || 'Manual Retry',
      outbound_url: lead.webhooks?.outbound_url || null
    };

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // Gravar log de auditoria
    await supabase.from('system_logs').insert([{
      action: 'Reenvio de Integração',
      entity: 'lead',
      entity_id: lead.id,
      user_id: user.id,
      details: { 
        name: lead.name,
        source: lead.source,
        webhook_name: webhookMock.name,
        triggered_by: user.email
      },
      ip_address: clientIp
    }]);

    // Disparar integrações reutilizando a função utilitária unificada!
    await sendLeadToIntegrations({
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source
      },
      clientId: lead.client_id,
      webhook: webhookMock,
      body: lead.data
    });

    return NextResponse.json({ 
      status: 'success', 
      message: 'Integrações disparadas e reprocessadas com sucesso!' 
    });

  } catch (error: any) {
    console.error('Erro na rota de retry de integrações:', error);
    return NextResponse.json({ error: 'Falha no processamento: ' + error.message }, { status: 500 });
  }
}
