import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './clients.module.css';
import { Plus, Search, ExternalLink, MoreVertical } from 'lucide-react';
import { mockClients } from '@/lib/store';

export default function ClientsPage() {
  return (
    <DashboardLayout title="Gestão de Clientes">
      <div className={styles.container}>
        <div className={styles.topActions}>
          <div className={styles.search}>
            <Search size={18} />
            <input type="text" placeholder="Filtrar clientes..." />
          </div>
          <button className={styles.addBtn}>
            <Plus size={20} />
            <span>Novo Cliente</span>
          </button>
        </div>

        <div className={styles.grid}>
          {mockClients.map((client, i) => (
            <div key={client.id} className={`${styles.clientCard} glass animate-fade-in`} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={styles.cardHeader}>
                <div className={styles.clientAvatar}>
                  {client.name.charAt(0)}
                </div>
                <div className={styles.clientInfo}>
                  <h4>{client.name}</h4>
                  <span>Desde {new Date(client.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <button className={styles.moreBtn}>
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.label}>Leads Coletados</span>
                  <span className={styles.value}>{client.leadsCount}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Status</span>
                  <span className={styles.statusBadge}>Ativo</span>
                </div>
              </div>

              <div className={styles.webhookBox}>
                <span className={styles.webhookLabel}>Webhook URL</span>
                <div className={styles.webhookInput}>
                  <input type="text" value={client.webhookUrl} readOnly />
                  <button title="Copiar URL">
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button className={styles.viewBtn}>Ver Leads</button>
                <button className={styles.editBtn}>Configurações</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
