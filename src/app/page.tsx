import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, MousePointerClick, TrendingUp } from 'lucide-react';
import { mockClients, mockLeads } from '@/lib/store';

export default function Home() {
  const stats = [
    { title: 'Total de Leads', value: '209', icon: MousePointerClick, color: '#3b82f6', trend: '+12.5%' },
    { title: 'Clientes Ativos', value: mockClients.length.toString(), icon: Users, color: '#8b5cf6', trend: '+0%' },
    { title: 'Webhooks Ativos', value: '2', icon: Webhook, color: '#10b981', trend: '+1' },
    { title: 'Taxa de Conversão', value: '3.2%', icon: TrendingUp, color: '#f59e0b', trend: '+0.4%' },
  ];

  return (
    <DashboardLayout title="Visão Geral">
      <div className={styles.dashboard}>
        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {stats.map((stat, i) => (
            <div key={i} className={`${styles.statCard} glass animate-fade-in`} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={styles.statInfo}>
                <span className={styles.statTitle}>{stat.title}</span>
                <div className={styles.statValueRow}>
                  <h2 className={styles.statValue}>{stat.value}</h2>
                  <span className={styles.statTrend}>{stat.trend}</span>
                </div>
              </div>
              <div className={styles.statIcon} style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={24} />
              </div>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div className={styles.contentGrid}>
          {/* Recent Leads */}
          <div className={`${styles.mainCard} glass animate-fade-in`} style={{ animationDelay: '0.4s' }}>
            <div className={styles.cardHeader}>
              <h3>Leads Recentes</h3>
              <button className={styles.viewAllBtn}>Ver Todos</button>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.name}</td>
                      <td>{lead.email}</td>
                      <td>
                        <span className={styles.clientBadge}>
                          {mockClients.find(c => c.id === lead.clientId)?.name}
                        </span>
                      </td>
                      <td>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span className={styles.statusBadge}>Novo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`${styles.sideCard} glass animate-fade-in`} style={{ animationDelay: '0.5s' }}>
            <div className={styles.cardHeader}>
              <h3>Ações Rápidas</h3>
            </div>
            <div className={styles.actionList}>
              <button className={styles.actionBtn}>
                <div className={styles.actionIcon}><Users size={20} /></div>
                <span>Novo Cliente</span>
              </button>
              <button className={styles.actionBtn}>
                <div className={styles.actionIcon}><Webhook size={20} /></div>
                <span>Gerar Webhook</span>
              </button>
              <button className={styles.actionBtn}>
                <div className={styles.actionIcon}><MousePointerClick size={20} /></div>
                <span>Exportar Dados</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
