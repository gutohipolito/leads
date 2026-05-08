'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './logs.module.css';
import { 
  History, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Info,
  Clock,
  Database,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';

export default function LogsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'signals'>('activity');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    async function loadAllLogs() {
      setLoading(true);
      
      // Carregar Sinais (Webhooks)
      const { data: signalData } = await supabase
        .from('webhook_logs')
        .select('*, webhooks (name), clients (name)')
        .order('created_at', { ascending: false });

      // Carregar Atividade (Sistema)
      const { data: activityData } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (signalData) setSignals(signalData);
      if (activityData) setActivity(activityData);
      setLoading(false);
    }
    loadAllLogs();
  }, []);

  const filteredSignals = signals.filter(log => 
    (log.clients?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.webhooks?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredActivity = activity.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entity || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentLogs = activeTab === 'signals' ? filteredSignals : filteredActivity;
  const totalPages = Math.ceil(currentLogs.length / pageSize);
  const paginatedLogs = currentLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getEntityIcon = (entity: string) => {
    switch(entity) {
      case 'user': return <UserIcon size={16} />;
      case 'client': return <Database size={16} />;
      case 'lead': return <History size={16} />;
      default: return <Info size={16} />;
    }
  };

  if (loading) return <DashboardLayout title="Auditoria"><Loader text="Sincronizando Registros..." /></DashboardLayout>;

  return (
    <DashboardLayout title="Auditoria">
      <div className={styles.container}>
        
        <div className={styles.topActions}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'activity' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('activity'); setCurrentPage(1); }}
            >
              <History size={18} />
              <span>Ações de Usuários</span>
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'signals' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('signals'); setCurrentPage(1); }}
            >
              <Terminal size={18} />
              <span>Sinais de Entrada</span>
            </button>
          </div>

          <div className={styles.searchBox}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder={activeTab === 'signals' ? "Pesquisar sinal..." : "Pesquisar ação..."} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={`${styles.tableWrapper} glass`}>
          <table className={styles.table}>
            <thead>
              {activeTab === 'signals' ? (
                <tr>
                  <th>Status</th>
                  <th>Cliente / Terminal</th>
                  <th>Evento</th>
                  <th>Data / Hora</th>
                  <th>Ações</th>
                </tr>
              ) : (
                <tr>
                  <th>Evento</th>
                  <th>Tipo</th>
                  <th>ID Afetado</th>
                  <th>Data / Hora</th>
                  <th>Origem</th>
                </tr>
              )}
            </thead>
            <tbody>
              {paginatedLogs.map(log => (
                <tr key={log.id}>
                  {activeTab === 'signals' ? (
                    <>
                      <td>
                        <div className={`${styles.statusBadge} ${log.status_code < 300 ? styles.success : styles.error}`}>
                          {log.status_code < 300 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          <span>{log.status_code}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.clientInfo}>
                          <strong>{log.clients?.name || 'Sistema'}</strong>
                          <span>{log.webhooks?.name || 'Uplink'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.eventInfo}>
                          <Database size={14} />
                          <span>{log.error_message ? 'Erro de Repasse' : 'Lead Processado'}</span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className={styles.activityInfo}>
                          <div className={`${styles.iconBox} ${styles[log.entity] || ''}`}>
                            {getEntityIcon(log.entity)}
                          </div>
                          <strong>{log.action}</strong>
                        </div>
                      </td>
                      <td><span className={styles.entityTag}>{log.entity || 'Sistema'}</span></td>
                      <td><code className={styles.idCode}>{log.entity_id?.substring(0, 8) || 'N/A'}</code></td>
                    </>
                  )}
                  
                  <td>
                    <div className={styles.timeInfo}>
                      <Clock size={14} />
                      <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </td>

                  <td>
                    {activeTab === 'signals' ? (
                      <button className={styles.detailBtn} onClick={() => alert(JSON.stringify(log.request_body, null, 2))}>
                        <Terminal size={16} />
                        <span>Ver JSON</span>
                      </button>
                    ) : (
                      <div className={styles.ipTag}>{log.ip_address || 'Interno'}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span>Página {currentPage} de {totalPages}</span>
              <div className={styles.pageActions}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
