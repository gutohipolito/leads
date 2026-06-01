'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './uptime.module.css';
import { 
  Activity, 
  Plus, 
  Globe, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Pencil,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import { logAction } from '@/utils/logger';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

export default function UptimePage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [newMonitorName, setNewMonitorName] = useState('');
  const [newMonitorUrl, setNewMonitorUrl] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Controle de edição de monitor
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<any | null>(null);
  const [editMonitorName, setEditMonitorName] = useState('');
  const [editMonitorUrl, setEditMonitorUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para o modal de confirmação
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    cancelLabel: string | null;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    onConfirm: () => {}
  });

  const openEditModal = (monitor: any) => {
    setEditingMonitor(monitor);
    setEditMonitorName(monitor.name);
    setEditMonitorUrl(monitor.url);
    setIsEditModalOpen(true);
  };

  const handleUpdateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonitor || !editMonitorName.trim() || !editMonitorUrl.trim() || isSubmitting) return;

    let formattedUrl = editMonitorUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('uptime_monitors')
        .update({
          name: editMonitorName.trim(),
          url: formattedUrl
        })
        .eq('id', editingMonitor.id);

      if (error) throw error;

      await logAction('Monitor de Uptime Editado', 'client', editingMonitor.client_id, {
        id: editingMonitor.id,
        old_name: editingMonitor.name,
        new_name: editMonitorName.trim(),
        old_url: editingMonitor.url,
        new_url: formattedUrl
      });

      showToast('Monitor atualizado com sucesso!', 'success');
      setIsEditModalOpen(false);
      setEditingMonitor(null);
      await loadMonitors(activeClientId);
    } catch (err: any) {
      showToast('Erro ao atualizar monitor: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper para exibir notificações temporárias (toasts)
  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Carregar cliente ativo e configurações
  useEffect(() => {
    async function initPage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('system_users')
            .select('*')
            .eq('email', user.email)
            .single();

          const isUserAdmin = profile?.role === 'admin';
          setIsAdmin(isUserAdmin);

          // Restrição temporária de Uptime: somente admins
          if (!isUserAdmin) {
            router.push('/');
            return;
          }

          // Carregar todos os clientes do banco para o seletor no modal
          const { data: clientsData } = await supabase
            .from('clients')
            .select('id, name')
            .order('name');
          if (clientsData) {
            setClients(clientsData);
          }

          const impersonated = localStorage.getItem('impersonated_client');
          let clientId = profile?.client_id;

          if (isUserAdmin && impersonated) {
            const impData = JSON.parse(impersonated);
            clientId = impData.id;
            setImpersonatedName(impData.name);
          } else {
            setImpersonatedName(null);
          }

          setActiveClientId(clientId);
          // Carrega monitores (se clientId for nulo, carrega todos)
          await loadMonitors(clientId);
        }
      } catch (err) {
        console.error('Erro ao inicializar página de Uptime:', err);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  // Carregar os monitores e buscar os logs de histórico para cada um
  async function loadMonitors(clientId: string | null) {
    try {
      let query = supabase
        .from('uptime_monitors')
        .select('*, clients(name)');

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data: monitorsData, error: monitorsError } = await query
        .order('created_at', { ascending: false });

      if (monitorsError) throw monitorsError;

      if (monitorsData) {
        const monitorsWithLogs = await Promise.all(
          monitorsData.map(async (monitor) => {
            const { data: logsData } = await supabase
              .from('uptime_logs')
              .select('*')
              .eq('monitor_id', monitor.id)
              .order('created_at', { ascending: false })
              .limit(30);

            const reversedLogs = logsData ? [...logsData].reverse() : [];

            // Calcular porcentagem de uptime nas últimas 30 verificações
            const totalPings = reversedLogs.length;
            const upPings = reversedLogs.filter(l => l.is_up).length;
            const uptimePercent = totalPings > 0 ? (upPings / totalPings) * 100 : 100;

            // Calcular latência média
            const averageLatency = totalPings > 0 
              ? Math.round(reversedLogs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / totalPings)
              : 0;

            return {
              ...monitor,
              logs: reversedLogs,
              uptimePercent: uptimePercent.toFixed(2),
              averageLatency
            };
          })
        );
        setMonitors(monitorsWithLogs);
      }
    } catch (err) {
      console.error('Erro ao carregar monitores:', err);
    }
  }

  // Adicionar monitor de Uptime
  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonitorName.trim() || !newMonitorUrl.trim() || isSubmitting) return;

    const targetClientId = activeClientId || selectedClientId;

    if (!targetClientId) {
      showToast('Por favor, selecione um cliente para vincular este monitor.', 'error');
      return;
    }

    let formattedUrl = newMonitorUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('uptime_monitors')
        .insert({
          client_id: targetClientId,
          name: newMonitorName.trim(),
          url: formattedUrl,
          status: 'checking'
        })
        .select()
        .single();

      if (error) throw error;

      await logAction('Monitor de Uptime Adicionado', 'client', targetClientId, {
        name: newMonitorName.trim(),
        url: formattedUrl
      });

      setNewMonitorName('');
      setNewMonitorUrl('');
      setSelectedClientId('');
      setIsModalOpen(false);
      showToast('Monitor de Uptime cadastrado com sucesso!', 'success');
      
      // Recarrega e força um ping imediato para atualizar o status
      await loadMonitors(activeClientId);
      handleCheckAll();
    } catch (err: any) {
      showToast('Erro ao cadastrar monitor: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir monitor
  const handleDeleteMonitor = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Monitor',
      message: `Tem certeza que deseja excluir o monitor "${name}"? Esta ação removerá o monitor de Uptime e todos os seus logs associados.`,
      type: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('uptime_monitors')
            .delete()
            .eq('id', id);

          if (error) throw error;

          const targetLogClientId = activeClientId || monitors.find(m => m.id === id)?.client_id;
          if (targetLogClientId) {
            await logAction('Monitor de Uptime Excluído', 'client', targetLogClientId, { name });
          }
          showToast('Monitor excluído com sucesso!', 'success');
          await loadMonitors(activeClientId);
        } catch (err: any) {
          showToast('Erro ao remover monitor: ' + err.message, 'error');
        }
      }
    });
  };

  // Disparar pings manuais via API interna
  const handleCheckAll = async () => {
    if (monitors.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch('/api/uptime/check');
      const data = await res.json();
      if (data.success && activeClientId) {
        await loadMonitors(activeClientId);
      }
    } catch (err) {
      console.error('Erro ao verificar uptime:', err);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Loader text="Carregando Monitores de Uptime" />
      </DashboardLayout>
    );
  }

  // Estatísticas gerais
  const totalMonitors = monitors.length;
  const onlineMonitors = monitors.filter(m => m.status === 'online').length;
  const offlineMonitors = monitors.filter(m => m.status === 'offline').length;
  const averageLatencyGlobal = totalMonitors > 0 
    ? Math.round(monitors.reduce((sum, m) => sum + (m.averageLatency || 0), 0) / totalMonitors)
    : 0;

  const uptimeTitle = impersonatedName ? `Uptime: ${impersonatedName}` : "Monitoramento de Uptime";

  return (
    <DashboardLayout>
      <div className={styles.container}>
        
        {/* Sistema de Toasts (Notificações) */}
        {notification && (
          <div className={styles.toastContainer}>
            <div className={`${styles.toast} ${styles[notification.type]}`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        <div className={styles.headerRow}>
          <h2>{uptimeTitle}</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              type="button" 
              className={styles.submitBtn} 
              onClick={() => setIsModalOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', height: '36px' }}
            >
              <Plus size={14} />
              <span>Adicionar Monitor</span>
            </button>

            {totalMonitors > 0 && (
              <button 
                type="button" 
                className={styles.manualCheckBtn} 
                onClick={handleCheckAll}
                disabled={checking}
                style={{ height: '36px' }}
              >
                {checking ? (
                  <>
                    <div className={styles.spinnerMini} />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Verificar Agora</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linha de Estatísticas */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.success}`}>
              <CheckCircle2 size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Online</span>
              <span className={styles.statValue}>{onlineMonitors} / {totalMonitors} Sites</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.info}`}>
              <Clock size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Latência Média</span>
              <span className={styles.statValue}>{averageLatencyGlobal} ms</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.warning}`}>
              <Activity size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Status Operacional</span>
              <span className={styles.statValue}>
                {offlineMonitors > 0 ? `${offlineMonitors} instabilidade(s)` : '100% Operacional'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Listagem de Monitores */}
          <div className={styles.monitorsList}>
            {monitors.map(monitor => {
              // Preenche histórico com barras vazias caso haja menos de 30 verificações
              const emptyBarsCount = Math.max(0, 30 - monitor.logs.length);
              const emptyBars = Array.from({ length: emptyBarsCount });

              return (
                <div 
                  key={monitor.id} 
                  className={`${styles.monitorCard} ${
                    monitor.status === 'online' 
                      ? styles.onlineCard 
                      : monitor.status === 'offline' 
                      ? styles.offlineCard 
                      : ''
                  }`}
                >
                  <div className={styles.monitorHeader}>
                    <div className={styles.monitorInfo}>
                      <h3>
                        {monitor.name}
                        <button 
                          type="button" 
                          className={styles.editTitleBtn} 
                          onClick={() => openEditModal(monitor)}
                          title="Editar Monitor"
                        >
                          <Pencil size={12} />
                        </button>
                      </h3>
                    </div>
                    
                    <div className={styles.statusWrapper}>
                      {monitor.status === 'online' ? (
                        <div className={styles.badgeOnline}>
                          <div className={`${styles.pulseDot} ${styles.online}`} />
                          <span>Online</span>
                        </div>
                      ) : monitor.status === 'offline' ? (
                        <div className={styles.badgeOffline}>
                          <div className={`${styles.pulseDot} ${styles.offline}`} />
                          <span>Offline</span>
                        </div>
                      ) : (
                        <div className={styles.badgeChecking}>
                          <div className={`${styles.pulseDot} ${styles.checking}`} />
                          <span>Checando</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <a 
                    href={monitor.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.monitorUrl}
                  >
                    <span>{monitor.url}</span>
                    <ExternalLink size={12} />
                  </a>

                  {/* Histórico Visual de Pings */}
                  <div className={styles.chartAndUptime}>
                    <div className={styles.chartMeta}>
                      <span>Histórico (Últimos 30 pings)</span>
                      <span className={styles.chartMetaStrong}>Uptime: {monitor.uptimePercent}%</span>
                    </div>
                    
                    <div className={styles.pingHistoryList}>
                      {emptyBars.map((_, i) => (
                        <div key={`empty-${i}`} className={`${styles.pingBar} ${styles.empty}`} title="Aguardando dados..." />
                      ))}
                      {monitor.logs.map((log: any) => (
                        <div 
                           key={log.id} 
                           className={`${styles.pingBar} ${log.is_up ? styles.up : styles.down}`} 
                           title={`${new Date(log.created_at).toLocaleString('pt-BR')} - Latência: ${log.response_time_ms}ms${log.error_message ? ` - Erro: ${log.error_message}` : ''}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.monitorFooter}>
                    <div className={styles.footerMeta}>
                      <span>
                        Último Ping
                        <span className={styles.pingTooltipWrapper}>
                          <HelpCircle size={14} className={styles.pingHelpIcon} />
                          <span className={styles.pingTooltipText}>
                            O Ping é o tempo de resposta do servidor (latência) em milissegundos. Um ping menor indica que o servidor do seu site responde rapidamente à conexão inicial, embora não garanta o tempo de carregamento completo da página (que depende do peso das imagens e scripts).
                          </span>
                        </span>: <strong>{monitor.last_ping_ms ? `${monitor.last_ping_ms}ms` : 'N/A'}</strong>
                        {monitor.last_ping_ms && (
                          <span className={`${styles.latencyLabel} ${
                            monitor.last_ping_ms <= 150 
                              ? styles.latencyFast 
                              : monitor.last_ping_ms <= 400 
                              ? styles.latencyMedium 
                              : styles.latencySlow
                          }`}>
                            {monitor.last_ping_ms <= 150 ? 'Rápido' : monitor.last_ping_ms <= 400 ? 'Moderado' : 'Lento'}
                          </span>
                        )}
                      </span>
                      <span>Última checagem: <strong>
                        {monitor.last_checked ? new Date(monitor.last_checked).toLocaleTimeString('pt-BR') : 'N/A'}
                      </strong></span>
                    </div>

                    <button 
                      type="button" 
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteMonitor(monitor.id, monitor.name)}
                      title="Excluir Monitor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {monitors.length === 0 && (
              <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
                <Globe size={48} />
                <p>Nenhuma página de vendas está cadastrada para monitoramento de uptime.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Clique no botão "Adicionar Monitor" no topo para começar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cadastro de Novo Monitor */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Novo Monitor de Uptime</h3>
                <button className={styles.modalCloseBtn} onClick={() => setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddMonitor} className={styles.form}>
                <div className={styles.field}>
                  <label>Nome do Site</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Página de Vendas Produto A"
                    value={newMonitorName}
                    onChange={e => setNewMonitorName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Endereço URL</label>
                  <input 
                    type="text" 
                    placeholder="Ex: minhapagina.com.br"
                    value={newMonitorUrl}
                    onChange={e => setNewMonitorUrl(e.target.value)}
                    required
                  />
                </div>

                {/* Seletor de Cliente — aparece quando admin não tem cliente impersonado */}
                {!activeClientId && clients.length > 0 && (
                  <div className={styles.field}>
                    <label>Vincular ao Cliente</label>
                    <select
                      className={styles.selectField}
                      value={selectedClientId}
                      onChange={e => setSelectedClientId(e.target.value)}
                      required
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <Plus size={16} />
                  <span>{isSubmitting ? 'Adicionando...' : 'Adicionar Monitor'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edição de Monitor */}
        {isEditModalOpen && editingMonitor && (
          <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Editar Monitor de Uptime</h3>
                <button className={styles.modalCloseBtn} onClick={() => setIsEditModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleUpdateMonitor} className={styles.form}>
                <div className={styles.field}>
                  <label>Nome do Site</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Página de Vendas Produto A"
                    value={editMonitorName}
                    onChange={e => setEditMonitorName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Endereço URL</label>
                  <input 
                    type="text" 
                    placeholder="Ex: minhapagina.com.br"
                    value={editMonitorUrl}
                    onChange={e => setEditMonitorUrl(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmação HUD */}
        <ConfirmModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />

      </div>
    </DashboardLayout>
  );
}
