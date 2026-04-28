import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './client-dashboard.module.css';
import { Mail, Phone, Calendar, ArrowLeft, Download, Filter, Database, TrendingUp, UserCheck, Shield } from 'lucide-react';
import Link from 'next/link';
import { mockClients, mockLeads } from '@/lib/store';
import { notFound } from 'next/navigation';

export default async function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = mockClients.find(c => c.id === clientId);
  
  if (!client) {
    notFound();
  }

  const clientLeads = mockLeads.filter(l => l.clientId === clientId);

  return (
    <DashboardLayout title={client.name}>
      <div className={styles.container}>
        <div className={styles.backNav}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Voltar ao Sistema</span>
          </Link>
          <div className={styles.actions}>
            <button className={styles.secondaryBtn}>
              <Filter size={18} />
              <span>Filtros</span>
            </button>
            <button className={styles.primaryBtn}>
              <Download size={18} />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div className={styles.statsSummary}>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><UserCheck size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.label}>Total Captures</span>
              <h2 className={styles.value}>{clientLeads.length}</h2>
            </div>
          </div>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><TrendingUp size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.label}>Capture Rate</span>
              <h2 className={styles.value}>+4.2%</h2>
            </div>
          </div>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Shield size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.label}>Uplink Security</span>
              <div className={styles.activeStatus}>
                <div className={styles.pulse} />
                <span>SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.leadsSection} glass`}>
          <div className={styles.sectionHeader}>
            <h3>Transmission Logs</h3>
          </div>
          
          <div className={styles.leadsGrid}>
            {clientLeads.length > 0 ? clientLeads.map((lead, i) => (
              <div key={lead.id} className={styles.leadRow}>
                <div className={styles.leadMain}>
                  <div className={styles.avatar}>
                    {lead.name.charAt(0)}
                  </div>
                  <div className={styles.leadInfo}>
                    <h4>{lead.name}</h4>
                    <span className={styles.id}>Uplink ID: {lead.id.slice(0, 8)}</span>
                  </div>
                </div>
                
                <div className={styles.contactInfo}>
                  <div className={styles.infoItem}>
                    <Mail size={14} />
                    <span>{lead.email}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <Phone size={14} />
                    <span>{lead.phone}</span>
                  </div>
                </div>

                <div className={styles.dynamicData}>
                  {Object.entries(lead.data).map(([key, value]) => (
                    <div key={key} className={styles.dataTag}>
                      <span className={styles.key}>{key}</span>
                      <span className={styles.val}>{String(value)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.meta}>
                  <div className={styles.date}>
                    <Calendar size={14} />
                    <span>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <button className={styles.viewBtn}>Details</button>
                </div>
              </div>
            )) : (
              <div className={styles.emptyState}>
                <Database size={48} strokeWidth={1} />
                <p>No transmissions detected for this entity.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
