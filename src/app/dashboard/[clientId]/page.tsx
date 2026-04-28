import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './client-dashboard.module.css';
import { Mail, Phone, Calendar, ArrowLeft, Download, Filter } from 'lucide-react';
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
    <DashboardLayout title={`Dashboard: ${client.name}`}>
      <div className={styles.container}>
        <div className={styles.backNav}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Voltar para Geral</span>
          </Link>
          <div className={styles.actions}>
            <button className={styles.filterBtn}>
              <Filter size={18} />
              <span>Filtros</span>
            </button>
            <button className={styles.downloadBtn}>
              <Download size={18} />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div className={styles.statsSummary}>
          <div className={`${styles.miniCard} glass`}>
            <span>Total de Leads</span>
            <h2>{clientLeads.length}</h2>
          </div>
          <div className={`${styles.miniCard} glass`}>
            <span>Leads na Semana</span>
            <h2>12</h2>
          </div>
          <div className={`${styles.miniCard} glass`}>
            <span>Status do Webhook</span>
            <div className={styles.activeStatus}>
              <div className={styles.pulse} />
              <span>Ativo</span>
            </div>
          </div>
        </div>

        <div className={`${styles.leadsList} glass`}>
          <div className={styles.cardHeader}>
            <h3>Leads Coletados</h3>
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
                    <span>Captação via Webhook</span>
                  </div>
                </div>
                
                <div className={styles.leadContact}>
                  <div className={styles.contactItem}>
                    <Mail size={14} />
                    <span>{lead.email}</span>
                  </div>
                  <div className={styles.contactItem}>
                    <Phone size={14} />
                    <span>{lead.phone}</span>
                  </div>
                </div>

                <div className={styles.leadDate}>
                  <Calendar size={14} />
                  <span>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className={styles.leadActions}>
                  <button className={styles.detailsBtn}>Ver Detalhes</button>
                </div>
              </div>
            )) : (
              <div className={styles.emptyState}>
                Nenhum lead encontrado para este cliente.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
