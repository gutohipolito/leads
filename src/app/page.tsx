import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3 } from 'lucide-react';
import { mockClients, mockLeads, currentUser } from '@/lib/store';

export default function Home() {
  const isAdmin = currentUser.role === 'admin';
  const clientId = currentUser.clientId;

  // Filtra leads com base no usuário logado
  const leads = isAdmin 
    ? mockLeads 
    : mockLeads.filter(l => l.clientId === clientId);

  const totalLeads = leads.length;
  
  // Cálculo de leads por período
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const leadsToday = leads.filter(l => new Date(l.createdAt) >= todayStart).length;
  const leads7Days = leads.filter(l => new Date(l.createdAt) >= sevenDaysAgo).length;
  const leads30Days = leads.filter(l => new Date(l.createdAt) >= thirtyDaysAgo).length;

  // Últimos leads recebidos (ordenados por data)
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Status do webhook (ativo se for cliente cadastrado ou admin)
  const webhookStatus = !isAdmin && !clientId ? "Inativo" : "Ativo";

  return (
    <DashboardLayout title={isAdmin ? "Dashboard Administrador" : "Dashboard do Cliente"}>
      <div className={styles.dashboard}>
        
        {/* Statistics Grid */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Activity size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total de Leads</span>
              <h2 className={styles.statValue}>{totalLeads}</h2>
            </div>
          </div>
          
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Clock size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Hoje / 7d / 30d</span>
              <h2 className={styles.statValue}>
                {leadsToday} <span className={styles.slash}>/</span> {leads7Days} <span className={styles.slash}>/</span> {leads30Days}
              </h2>
            </div>
          </div>

          {!isAdmin ? (
            <div className={`${styles.statCard} glass`}>
              <div className={styles.statIcon}><Webhook size={20} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Status Webhook</span>
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
                <span className={styles.statLabel}>Clientes Ativos</span>
                <h2 className={styles.statValue}>{mockClients.length}</h2>
              </div>
            </div>
          )}

          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Shield size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Segurança</span>
              <h2 className={styles.statValue}>Uplink SSL</h2>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Traffic Chart */}
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <BarChart3 size={18} className={styles.iconPrimary} />
                <h3>Volume de Capturas</h3>
              </div>
            </div>
            <div className={styles.chartArea}>
              <svg viewBox="0 0 800 200" className={styles.svgChart}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path 
                  d="M0,150 Q100,140 200,160 T400,120 T600,140 T800,100 L800,200 L0,200 Z" 
                  fill="url(#chartGradient)" 
                />
                <path 
                  d="M0,150 Q100,140 200,160 T400,120 T600,140 T800,100" 
                  fill="none" 
                  stroke="var(--primary)" 
                  strokeWidth="3" 
                />
                {/* Simulated data points */}
                <circle cx="200" cy="160" r="4" fill="var(--primary)" />
                <circle cx="400" cy="120" r="4" fill="var(--primary)" />
                <circle cx="600" cy="140" r="4" fill="var(--primary)" />
              </svg>
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
                  {recentLeads.length > 0 ? recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      {isAdmin && <td>{mockClients.find(c => c.id === lead.clientId)?.name || 'N/A'}</td>}
                      <td>
                        <div className={styles.leadInfoMini}>
                          <span className={styles.leadName}>{lead.name}</span>
                          <span className={styles.leadEmail}>{lead.email}</span>
                        </div>
                      </td>
                      <td>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span className={styles.statusBadge}>OK</span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className={styles.emptyTable}>
                        Nenhum registro encontrado.
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
