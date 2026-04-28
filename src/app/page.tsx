import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { MousePointerClick, Users, Webhook, TrendingUp, Activity, Terminal, Shield } from 'lucide-react';
import { mockClients, mockLeads } from '@/lib/store';

export default function Home() {
  return (
    <DashboardLayout title="Terminal de Monitoramento">
      <div className={styles.dashboard}>
        
        {/* Statistics Grid */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Activity size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Capturas Totais</span>
              <h2 className={styles.statValue}>67.659</h2>
            </div>
          </div>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Users size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Entidades Ativas</span>
              <h2 className={styles.statValue}>{mockClients.length}</h2>
            </div>
          </div>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Webhook size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Webhooks Uplink</span>
              <h2 className={styles.statValue}>12</h2>
            </div>
          </div>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Shield size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Segurança</span>
              <h2 className={styles.statValue}>SSL 100%</h2>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Traffic Chart */}
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.cardHeader}>
              <h3>Fluxo de Transmissão (24h)</h3>
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
              </svg>
            </div>
          </div>

          {/* Recent Transmissions */}
          <div className={`${styles.logsCard} glass`}>
            <div className={styles.cardHeader}>
              <h3>Últimos Registros</h3>
              <button className={styles.textBtn}>Ver Todos</button>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Entidade</th>
                    <th>Lead</th>
                    <th>Origem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeads.slice(0, 5).map((lead) => (
                    <tr key={lead.id}>
                      <td>{mockClients.find(c => c.id === lead.clientId)?.name}</td>
                      <td>{lead.name}</td>
                      <td>{lead.email}</td>
                      <td>
                        <span className={styles.statusBadge}>RECEBIDO</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
