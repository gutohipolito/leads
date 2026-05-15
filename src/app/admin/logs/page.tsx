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
  Search,
  User as UserIcon,
  X
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
  const [selectedSignal, setSelectedSignal] = useState<any | null>(null);
  const pageSize = 12;

  useEffect(() => {
    async function loadAllLogs() {
      setLoading(true);
      
      const { data: signalData, error: signalError } = await supabase
        .from('webhook_logs')
        .select('*, webhooks (name), clients (name)')
        .order('created_at', { ascending: false });

      if (signalError) console.error('Erro ao carregar sinais:', signalError);

      // Carregar Atividade (Sistema)
      const { data: activityData, error: activityError } = await supabase
        .from('system_logs')
        .select('*, system_users!user_id(name, email)')
        .order('created_at', { ascending: false });

      if (activityError) console.error('Erro ao carregar atividade:', activityError);

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
                  <th>Responsável</th>
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
                      <td>
                        <div className={styles.userInfo}>
                          <strong>{log.system_users?.name || 'Sistema'}</strong>
                          {log.system_users?.email && <span>{log.system_users.email}</span>}
                        </div>
                      </td>
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
                      <button className={styles.detailBtn} onClick={() => setSelectedSignal(log)}>
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

        {/* Drawer: Detalhes do Sinal JSON */}
        {selectedSignal && (
          <div className={styles.drawerOverlay} onClick={() => setSelectedSignal(null)}>
            <div className={`${styles.drawer} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.drawerHeader}>
                <div className={styles.drawerTitle}>
                  <div className={styles.iconCircleBig}>
                    <Terminal size={24} />
                  </div>
                  <div>
                    <h3>Detalhes do Sinal</h3>
                    <span>ID: {selectedSignal.id}</span>
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedSignal(null)}>
                  <X size={24} />
                </button>
              </div>

              <div className={styles.drawerBody}>
                <div className={styles.detailSection}>
                  <h4>Informações Gerais</h4>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <label>Terminal / Webhook</label>
                      <p>{selectedSignal.webhooks?.name || 'Uplink Direto'}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Cliente</label>
                      <p>{selectedSignal.clients?.name || 'N/A'}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Status HTTP</label>
                      <p className={selectedSignal.status_code < 300 ? styles.textSuccess : styles.textError}>
                        {selectedSignal.status_code}
                      </p>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Data/Hora</label>
                      <p>{new Date(selectedSignal.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <h4>Payload do Webhook (JSON)</h4>
                  <div className={styles.jsonWrapper}>
                    <pre className={styles.jsonContent}>
                      {JSON.stringify(selectedSignal.request_body, null, 2)}
                    </pre>
                  </div>
                </div>

                {selectedSignal.error_message && (
                  <div className={styles.detailSection}>
                    <h4 className={styles.errorTitle}>Mensagem de Erro</h4>
                    <div className={styles.errorBox}>
                      {selectedSignal.error_message}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.drawerFooter}>
                <button className={styles.secondaryBtn} onClick={() => setSelectedSignal(null)}>
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
