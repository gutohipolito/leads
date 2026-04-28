import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './client-dashboard.module.css';
import { Mail, Phone, Calendar, ArrowLeft, Download, Filter, Database } from 'lucide-react';
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
    <DashboardLayout title={`Monitoramento: ${client.name}`}>
      <div className={styles.container}>
        <div className={styles.backNav}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Voltar ao Sistema</span>
          </Link>
          <div className={styles.actions}>
            <button className={styles.filterBtn}>
              <Filter size={18} />
              <span>Filtros Avançados</span>
            </button>
            <button className={styles.downloadBtn}>
              <Download size={18} />
              <span>Exportar Dados (CSV)</span>
            </button>
          </div>
        </div>

        <div className={styles.statsSummary}>
          <div className={`${styles.miniCard} hud-border`}>
            <span>Capturas Totais</span>
            <h2>{clientLeads.length}</h2>
          </div>
          <div className={`${styles.miniCard} hud-border`}>
            <span>Frequência / Dia</span>
            <h2>+4.2</h2>
          </div>
          <div className={`${styles.miniCard} hud-border`}>
            <span>Link Webhook</span>
            <div className={styles.activeStatus}>
              <div className={styles.pulse} />
              <span>Sinal Ativo</span>
            </div>
          </div>
        </div>

        <div className={`${styles.leadsList} hud-border`}>
          <div className={styles.cardHeader}>
            <h3>Leads Identificados</h3>
          </div>
          
          <div className={styles.leadsGrid}>
            {clientLeads.length > 0 ? clientLeads.map((lead, i) => (
              <div key={lead.id} className={styles.leadRow} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={styles.leadMain}>
                  <div className={styles.leadAvatar}>
                    {lead.name.charAt(0)}
                  </div>
                  <div className={styles.leadInfo}>
                    <h4>{lead.name}</h4>
                    <span className={styles.idLabel}>ID: {lead.id.toUpperCase()}</span>
                  </div>
                </div>
                
                <div className={styles.leadContact}>
                  <div className={styles.contactItem}>
                    <Mail size={12} />
                    <span>{lead.email}</span>
                  </div>
                  <div className={styles.contactItem}>
                    <Phone size={12} />
                    <span>{lead.phone}</span>
                  </div>
                </div>

                {/* Dynamic Fields Mapping */}
                <div className={styles.dynamicFields}>
                  {Object.entries(lead.data).map(([key, value]) => (
                    <div key={key} className={styles.fieldTag}>
                      <span className={styles.fieldKey}>{key}:</span>
                      <span className={styles.fieldValue}>{String(value)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.leadDate}>
                  <Calendar size={12} />
                  <span>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className={styles.leadActions}>
                  <button className={styles.detailsBtn}>Analisar Dados</button>
                </div>
              </div>
            )) : (
              <div className={styles.emptyState}>
                Nenhum sinal de lead detectado no momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
