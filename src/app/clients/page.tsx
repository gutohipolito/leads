'use client';

import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './clients.module.css';
import { Plus, Search, ExternalLink, MoreVertical, Globe, Users as UsersIcon, Clock, ShieldCheck } from 'lucide-react';
import { mockClients } from '@/lib/store';

export default function ClientsPage() {
  return (
    <DashboardLayout title="Gerenciamento de Clientes">
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.headerInfo}>
            <p className={styles.subtitle}>Gerencie suas conexões e endpoints ativos.</p>
          </div>
          <div className={styles.actions}>
            <div className={styles.searchBox}>
              <Search size={18} />
              <input type="text" placeholder="Localizar cliente..." />
            </div>
            <button className={styles.addBtn}>
              <Plus size={20} />
              <span>Novo Cliente</span>
            </button>
          </div>
        </div>

        <div className={styles.clientGrid}>
          {mockClients.map((client) => (
            <div key={client.id} className={`${styles.clientCard} glass`}>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>
                  <Globe size={20} />
                </div>
                <div className={styles.info}>
                  <h4>{client.name}</h4>
                  <span className={styles.date}>Criado em {client.createdAt}</span>
                </div>
                <button className={styles.moreBtn}>
                  <MoreVertical size={18} />
                </button>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <UsersIcon size={14} />
                    <span>Total de Capturas</span>
                  </div>
                  <span className={styles.metricValue}>{client.leadsCount}</span>
                </div>
                <div className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <ShieldCheck size={14} />
                    <span>Status do Sinal</span>
                  </div>
                  <span className={styles.statusActive}>Uplink Ativo</span>
                </div>
              </div>

              <div className={styles.webhookSection}>
                <div className={styles.webhookHeader}>
                  <Clock size={14} />
                  <span>Endpoint do Webhook</span>
                </div>
                <div className={styles.urlDisplay}>
                  <code>{client.webhookUrl}</code>
                  <button 
                    className={styles.copyBtn} 
                    onClick={() => navigator.clipboard.writeText(client.webhookUrl)}
                    title="Copiar URL"
                  >
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
