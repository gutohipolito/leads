import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, MousePointerClick, TrendingUp, ChevronRight } from 'lucide-react';
import { mockClients, mockLeads } from '@/lib/store';

export default function Home() {
  const stats = [
    { title: 'Protocolos Ativos', value: '209', icon: MousePointerClick, color: '#00ffff', trend: '+12.5%' },
    { title: 'Entidades Cliente', value: mockClients.length.toString(), icon: Users, color: '#00ffff', trend: 'Sync' },
    { title: 'Webhooks Uplink', value: '2', icon: Webhook, color: '#00ffff', trend: 'Estável' },
    { title: 'Taxa de Sincronia', value: '3.2%', icon: TrendingUp, color: '#00ffff', trend: '+0.4%' },
  ];

  return (
    <DashboardLayout title="Terminal de Monitoramento">
      <div className={styles.dashboardContainer}>
        {/* Stats Section */}
        <div className={styles.statsGrid}>
          {stats.map((stat, i) => (
            <div key={i} className={`${styles.statCard} jarvis-card`}>
              <div className={styles.statIconWrapper}>
                <stat.icon size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>{stat.title}</span>
                <div className={styles.statValueGroup}>
                  <span className={styles.statValue}>{stat.value}</span>
                  <span className={styles.statTrend}>{stat.trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className={styles.contentGrid}>
          {/* Recent Transmissions */}
          <section className={`${styles.recentSection} jarvis-card`}>
            <div className={styles.sectionHeader}>
              <h3>Transmissões Recentes</h3>
              <button className={styles.headerAction}>Histórico Completo</button>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.jarvisTable}>
                <thead>
                  <tr>
                    <th>Identificador</th>
                    <th>Frequência (Email)</th>
                    <th>Origem</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className={styles.boldCell}>{lead.name}</td>
                      <td>{lead.email}</td>
                      <td>
                        <span className={styles.originTag}>
                          {mockClients.find(c => c.id === lead.clientId)?.name}
                        </span>
                      </td>
                      <td>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div className={styles.statusGroup}>
                          <div className={styles.statusDot} />
                          <span>RECEBIDO</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Quick Access */}
          <aside className={`${styles.quickAccess} jarvis-card`}>
            <div className={styles.sectionHeader}>
              <h3>Ações de Sistema</h3>
            </div>
            <div className={styles.actionGrid}>
              <button className={styles.systemBtn}>
                <Users size={18} />
                <span>Registrar Cliente</span>
              </button>
              <button className={styles.systemBtn}>
                <Webhook size={18} />
                <span>Gerar Uplink</span>
              </button>
              <button className={styles.systemBtn}>
                <TrendingUp size={18} />
                <span>Relatório Analítico</span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
