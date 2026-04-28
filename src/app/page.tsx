import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { MousePointerClick, Users, Webhook, TrendingUp, AlertCircle, Info, ChevronRight, Bell } from 'lucide-react';
import { mockClients, mockLeads } from '@/lib/store';

export default function Home() {
  return (
    <DashboardLayout title="Overview">
      <div className={styles.dashboard}>
        
        {/* Top Grid: Main Chart and Summary Stats */}
        <div className={styles.topSection}>
          <div className={`${styles.mainChart} glass`}>
            <div className={styles.chartHeader}>
              <h3>Yield Overview</h3>
              <select className={styles.periodSelect}>
                <option>Yearly Earnings</option>
              </select>
            </div>
            <div className={styles.chartPlaceholder}>
              {/* Mock SVG Chart to look like the reference */}
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
                <circle cx="400" cy="120" r="6" fill="var(--primary)" />
                <rect x="370" y="80" width="60" height="30" rx="4" fill="#030303" stroke="var(--border)" />
                <text x="400" y="100" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">$931</text>
              </svg>
              <div className={styles.chartLabels}>
                <span>1m</span><span>3m</span><span>6m</span><span>12m</span><span>1y</span><span>2y</span><span>3y</span><span>4y</span>
              </div>
            </div>
          </div>

          <div className={styles.sideStats}>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Total de Leads</span>
              <h2 className={styles.statValue}>67,659.99</h2>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: '70%' }} />
              </div>
              <span className={styles.progressLabel}>70% do objetivo</span>
            </div>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Taxa de Captura</span>
              <h2 className={styles.statValue}>$26,949.29</h2>
              <div className={styles.miniChart}>
                {/* Simplified bar chart */}
                {[40, 70, 45, 90, 65, 80, 50, 85].map((h, i) => (
                  <div key={i} className={styles.bar} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Recompensas</span>
              <div className={styles.rewardRow}>
                <h2 className={styles.statValue}>$227.6</h2>
                <button className={styles.claimBtn}>Claim</button>
              </div>
            </div>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Depósito Total</span>
              <h2 className={styles.statValue}>$30,983.8</h2>
              <div className={styles.miniLineChart}>
                <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0,40 Q25,35 50,20 T100,5" fill="none" stroke="var(--primary)" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Leads Table */}
        <div className={styles.bottomSection}>
          <div className={styles.sectionHeader}>
            <h3>Leads Recentes</h3>
            <span className={styles.totalReturn}>Total Coletado: $0.58</span>
          </div>
          <div className={`${styles.tableWrapper} glass`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Identificador</th>
                  <th>Frequência</th>
                  <th>Origem</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {mockLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className={styles.clientCell}>
                        <div className={styles.clientIcon}>T</div>
                        <span>{mockClients.find(c => c.id === lead.clientId)?.name}</span>
                      </div>
                    </td>
                    <td>{lead.name}</td>
                    <td>2.7%</td>
                    <td>{lead.email}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn}>View</button>
                        <button className={styles.actionBtn}>Export</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Upgrade Card (Bottom Left style) */}
        <div className={`${styles.upgradeCard} glass`}>
          <div className={styles.upgradeHeader}>
            <div className={styles.bellIcon}><Bell size={16} /></div>
            <p>You've reached your limit!</p>
          </div>
          <p className={styles.upgradeText}>Please upgrade your plan to avoid losing your files.</p>
          <button className={styles.upgradeBtn}>Upgrade Plan</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
