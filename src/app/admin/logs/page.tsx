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
  X,
  ShieldCheck,
  Key,
  Plus,
  RefreshCw,
  Globe,
  Lock,
  ShieldAlert,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import { logAction } from '@/utils/logger';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

export default function LogsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'signals' | 'security'>('activity');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSignal, setSelectedSignal] = useState<any | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const pageSize = 12;

  // Estados específicos de segurança
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [score, setScore] = useState(100);
  const [showSecretId, setShowSecretId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<any>(null);

  useEffect(() => {
    async function loadAllLogs() {
      try {
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

        // Carregar Chaves de API (Segurança)
        const { data: webhooks, error: webhooksError } = await supabase
          .from('webhooks')
          .select('id, name, secret, status, created_at, clients(name)')
          .order('created_at', { ascending: false });

        if (webhooksError) console.error('Erro ao carregar chaves:', webhooksError);

        if (webhooks) {
          setApiKeys(webhooks);
          
          // Cálculo de Score de Segurança
          let currentScore = 100;
          const inactiveCount = webhooks.filter(w => w.status !== 'active').length;
          currentScore -= (inactiveCount * 5);
          
          // Checar falhas de autenticação nas últimas 24h
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const { count: authFailures } = await supabase
            .from('webhook_logs')
            .select('*', { count: 'exact', head: true })
            .eq('status_code', 401)
            .gt('created_at', yesterday.toISOString());
          
          currentScore -= (Math.min(authFailures || 0, 10) * 3);
          setScore(Math.max(currentScore, 0));
        }

        if (signalData) setSignals(signalData);
        if (activityData) setActivity(activityData);
      } catch (error) {
        console.error('Erro ao carregar logs:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAllLogs();
  }, []);

  const handleRegenerateSecret = async (id: string, name: string) => {
    const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error } = await supabase
      .from('webhooks')
      .update({ secret: newSecret })
      .eq('id', id);

    if (!error) {
      await logAction('Chave Regenerada', 'webhook', id, { name });
      
      // Recarregar chaves
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('id, name, secret, status, created_at, clients(name)')
        .order('created_at', { ascending: false });
      if (webhooks) setApiKeys(webhooks);

      alert('Segredo da API atualizado com sucesso!');
    }
  };

  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;

    const { error } = await supabase
      .from('webhooks')
      .update({ status: 'inactive' })
      .eq('id', keyToRevoke.id);

    if (!error) {
      await logAction('Chave Revogada', 'webhook', keyToRevoke.id, { name: keyToRevoke.name });
      
      // Recarregar chaves
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('id, name, secret, status, created_at, clients(name)')
        .order('created_at', { ascending: false });
      if (webhooks) setApiKeys(webhooks);
    }
    setIsConfirmOpen(false);
  };

  const filterByDate = (createdAt: string) => {
    if (dateFilter === 'all') return true;
    const createdDate = new Date(createdAt);
    const now = new Date();
    
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return createdDate >= today;
    }
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return createdDate >= sevenDaysAgo;
    }
    if (dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= startOfMonth;
    }
    if (dateFilter === 'custom') {
      let match = true;
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00');
        match = match && createdDate >= start;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59');
        match = match && createdDate <= end;
      }
      return match;
    }
    return true;
  };

  const filteredSignals = signals.filter(log => {
    const matchesSearch = (log.clients?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.webhooks?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(log.created_at);
  });

  const filteredActivity = activity.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entity || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(log.created_at);
  });

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


  return (
    <DashboardLayout>
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
            <button 
              className={`${styles.tabBtn} ${activeTab === 'security' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('security'); setCurrentPage(1); }}
            >
              <ShieldCheck size={18} />
              <span>Segurança do Sistema</span>
            </button>
          </div>

          {activeTab !== 'security' && (
            <div className={styles.searchBox}>
              <Search size={18} />
              <input 
                type="text" 
                placeholder={activeTab === 'signals' ? "Pesquisar sinal..." : "Pesquisar ação..."} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        {activeTab !== 'security' && (
          <div className={styles.filtersBar}>
            <div className={styles.filterField}>
              <label>Período dos Logs</label>
              <select 
                className={styles.filterInput}
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
              >
                <option value="all">Sempre</option>
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="month">Este mês</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            {dateFilter === 'custom' && (
              <>
                <div className={styles.filterField}>
                  <label>Data Inicial</label>
                  <input 
                    type="date" 
                    className={styles.filterInput}
                    value={customStartDate}
                    onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className={styles.filterField}>
                  <label>Data Final</label>
                  <input 
                    type="date" 
                    className={styles.filterInput}
                    value={customEndDate}
                    onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'security' ? (
          <div className={styles.securityContainer}>
            <div className={styles.topSection}>
              <div className={`${styles.scoreCard} glass`}>
                <div className={styles.scoreCircle} style={{ borderColor: score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444') }}>
                  <span className={styles.scoreValue}>{score}</span>
                  <span className={styles.scoreLabel}>Health Score</span>
                </div>
                <div className={styles.statusInfo}>
                  <h3>{score > 80 ? 'Sistema Protegido' : (score > 50 ? 'Atenção Necessária' : 'Risco Detectado')}</h3>
                  <p style={{ fontSize: '0.8rem' }}>
                    {score === 100 ? 'Todos os protocolos de segurança estão operando perfeitamente.' : `Identificamos ${100 - score} pontos de atenção na infraestrutura.`}
                  </p>
                </div>
              </div>

              <section className={`${styles.keysSection} glass`} style={{ margin: 0 }}>
                <div className={styles.cardHeader} style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
                  <div className={styles.headerInfo}>
                    <div className={styles.iconCircle}><Key size={18} /></div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Chaves de API (Secrets)</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0 }}>Gerenciamento de segredos para captura segura de leads.</p>
                    </div>
                  </div>
                  <button type="button" className={styles.addKeyBtn} onClick={() => window.location.href='/webhooks?action=new'}>
                    <Plus size={16} />
                    <span>Gerar Novo Webhook</span>
                  </button>
                </div>

                <div className={styles.tableResponsive}>
                  <table className={styles.keysTable}>
                    <thead>
                      <tr>
                        <th>Nome / Cliente</th>
                        <th>Chave (Secret)</th>
                        <th>Status</th>
                        <th>Data Criação</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                    {apiKeys.map(key => (
                      <tr key={key.id}>
                        <td>
                          <div className={styles.keyIdentity}>
                            <strong className={styles.keyName}>{key.name}</strong>
                            <span className={styles.clientTag}>{key.clients?.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.secretWrapper}>
                            <code className={styles.keyCode}>
                              {showSecretId === key.id ? key.secret : '••••••••••••••••'}
                            </code>
                            <button type="button" onClick={() => setShowSecretId(showSecretId === key.id ? null : key.id)}>
                              {showSecretId === key.id ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${key.status === 'active' ? styles.activeStatus : styles.revokedStatus}`}>
                            {key.status === 'active' ? 'ATIVA' : 'SUSPENSA'}
                          </span>
                        </td>
                        <td>{new Date(key.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                          <div className={styles.tableActions}>
                            <button 
                              type="button"
                              className={styles.iconBtn} 
                              onClick={() => handleRegenerateSecret(key.id, key.name)}
                              title="Regenerar Segredo"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button 
                              type="button"
                              className={styles.iconBtn} 
                              style={{ color: '#ef4444' }}
                              onClick={() => {
                                setKeyToRevoke(key);
                                setIsConfirmOpen(true);
                              }}
                              title="Revogar Acesso"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className={styles.firewallGrid}>
            <section className={`${styles.configCard} glass`}>
              <div className={styles.configHeader}>
                <div className={styles.iconCircle}><Globe size={18} /></div>
                <h4>Proteção de Webhook</h4>
              </div>
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                Exigência de Header "X-Asthros-Secret" em todas as requisições de entrada.
              </p>
              <div className={styles.securityStatusTag}>
                <ShieldCheck size={12} />
                <span>ATIVO E MONITORADO</span>
              </div>
            </section>

            <section className={`${styles.configCard} glass`}>
              <div className={styles.configHeader}>
                <div className={styles.iconCircle}><Lock size={18} /></div>
                <h4>Middleware Global</h4>
              </div>
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                Bloqueio automático de indexação e acesso a arquivos sensíveis (.env, logs).
              </p>
              <div className={styles.securityStatusTag}>
                <ShieldCheck size={12} />
                <span>ATIVO E MONITORADO</span>
              </div>
            </section>
          </div>
        </div>
        ) : (
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
                        <button type="button" className={styles.detailBtn} onClick={() => setSelectedSignal(log)}>
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
                  <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}

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
                <button type="button" className={styles.closeBtn} onClick={() => setSelectedSignal(null)}>
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
                <button type="button" className={styles.secondaryBtn} onClick={() => setSelectedSignal(null)}>
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal 
          isOpen={isConfirmOpen}
          title="Revogar Chave de API"
          message={`Tem certeza que deseja suspender a chave "${keyToRevoke?.name}"? Isso interromperá a captura de leads deste webhook imediatamente.`}
          confirmLabel="Suspender Acesso"
          type="danger"
          onConfirm={handleRevokeKey}
          onCancel={() => setIsConfirmOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
