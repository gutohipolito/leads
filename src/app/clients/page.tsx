'use client';

import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './clients.module.css';
import { Plus, Search, ExternalLink, MoreVertical, Globe } from 'lucide-react';
import { mockClients } from '@/lib/store';

export default function ClientsPage() {
  return (
    <DashboardLayout title="Protocolos de Entidades">
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input type="text" placeholder="Localizar entidade..." />
          </div>
          <button className={styles.addBtn}>
            <Plus size={20} />
            <span>Nova Entidade</span>
          </button>
        </div>

        <div className={styles.clientGrid}>
          {mockClients.map((client, i) => (
            <div key={client.id} className={`${styles.clientCard} jarvis-card`}>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>
                  <Globe size={24} />
                </div>
                <div className={styles.info}>
                  <h4>{client.name}</h4>
                  <span>Ativo desde {client.createdAt}</span>
                </div>
                <button className={styles.moreBtn}>
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Capturas</span>
                  <span className={styles.metricValue}>{client.leadsCount}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Status</span>
                  <span className={styles.statusActive}>ONLINE</span>
                </div>
              </div>

              <div className={styles.webhookSection}>
                <label>Ponto de Extremidade (Webhook)</label>
                <div className={styles.urlDisplay}>
                  <code>{client.webhookUrl}</code>
                  <button onClick={() => navigator.clipboard.writeText(client.webhookUrl)}>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <button className={styles.primaryAction}>Monitorar Fluxo</button>
                <button className={styles.secondaryAction}>Parâmetros</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
