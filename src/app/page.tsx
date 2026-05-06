import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3, TrendingUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import AnalyticsChart from '@/components/DashboardCharts/AnalyticsChart';

export default async function Home() {
  const supabase = await createClient();
  
  // Obter usuário da sessão
  const { data: { user } } = await supabase.auth.getUser();
  
  // Buscar perfil no banco para saber se é Admin ou Cliente
  const { data: profile } = await supabase
    .from('system_users')
    .select('*')
    .eq('email', user?.email)
    .single();

  const isAdmin = profile?.role === 'admin';
  const clientId = profile?.client_id;

  // 1. Buscar Total de Leads
  let leadsQuery = supabase.from('leads').select('*', { count: 'exact' });
  if (!isAdmin && clientId) {
    leadsQuery = leadsQuery.eq('client_id', clientId);
  }
  const { count: totalLeads, data: allLeads } = await leadsQuery;

  // 2. Buscar Clientes Ativos (apenas para Admin)
  let activeClientsCount = 0;
  if (isAdmin) {
    const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active');
    activeClientsCount = count || 0;
  }

  // 3. Buscar Últimos Leads (com join de cliente se for admin)
  let recentLeadsQuery = supabase
    .from('leads')
    .select(`
      *,
      clients (name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!isAdmin && clientId) {
    recentLeadsQuery = recentLeadsQuery.eq('client_id', clientId);
  }
  const { data: recentLeads } = await recentLeadsQuery;

  // 4. Cálculo de leads por período e dados para o gráfico
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  // Gerar últimos 7 dias para o gráfico
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    
    const count = allLeads?.filter(l => {
      const ts = new Date(l.created_at).getTime();
      return ts >= dayStart && ts < dayEnd;
    }).length || 0;

    return { date: dateStr, leads: count };
  });

  const leadsToday = allLeads?.filter(l => l.created_at >= todayStart).length || 0;
  const leads7Days = allLeads?.filter(l => l.created_at >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()).length || 0;

  const webhookStatus = !isAdmin && !clientId ? "Inativo" : "Ativo";

  return (
    <DashboardLayout title={isAdmin ? "Dashboard Administrador" : "Dashboard do Cliente"}>
      <div className={styles.dashboard}>
        
        {/* Statistics Grid */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><TrendingUp size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Leads Totais</span>
              <h2 className={styles.statValue}>{totalLeads || 0}</h2>
              <span className={styles.statSub}>Acumulado total</span>
            </div>
          </div>
          
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Activity size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Capturas Hoje</span>
              <h2 className={styles.statValue}>{leadsToday}</h2>
              <span className={styles.statSub}>Últimas 24 horas</span>
            </div>
          </div>
          
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Clock size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Últimos 7 dias</span>
              <h2 className={styles.statValue}>{leads7Days}</h2>
              <span className={styles.statSub}>Volume semanal</span>
            </div>
          </div>

          {!isAdmin ? (
            <div className={`${styles.statCard} glass`}>
              <div className={styles.statIcon}><Webhook size={20} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Terminal Uplink</span>
                <div className={styles.statusContainer}>
                  <div className={styles.pulse} />
                  <h2 className={styles.statValue}>{webhookStatus}</h2>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.statCard} glass`}>
              <div className={styles.statIcon}><Users size={20} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Parceiros Ativos</span>
                <h2 className={styles.statValue}>{activeClientsCount}</h2>
                <span className={styles.statSub}>Clientes no sistema</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.mainGrid}>
          {/* Traffic Chart */}
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <BarChart3 size={18} className={styles.iconPrimary} />
                <h3>Análise de Conversão</h3>
              </div>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={styles.dot} />
                  <span>Sinais de Uplink</span>
                </div>
              </div>
            </div>
            <div className={styles.chartArea}>
              <AnalyticsChart data={chartData} />
            </div>
          </div>

          {/* Recent Leads */}
          <div className={`${styles.logsCard} glass`}>
            <div className={styles.cardHeader}>
              <h3>Últimos Leads Recebidos</h3>
              <button className={styles.textBtn}>Ver Todos</button>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {isAdmin && <th>Cliente</th>}
                    <th>Lead</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads && recentLeads.length > 0 ? recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      {isAdmin && <td>{(lead.clients as any)?.name || 'N/A'}</td>}
                      <td>
                        <div className={styles.leadInfoMini}>
                          <span className={styles.leadName}>{lead.name || 'Sem nome'}</span>
                          <span className={styles.leadEmail}>{lead.email || 'Sem e-mail'}</span>
                        </div>
                      </td>
                      <td>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span className={styles.statusBadge}>OK</span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className={styles.emptyTable}>
                        Nenhum registro encontrado no banco.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

