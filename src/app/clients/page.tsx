'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './clients.module.css';
import { 
  Plus, 
  Search, 
  UserCog, 
  Power, 
  PowerOff, 
  RefreshCcw, 
  BarChart3, 
  MoreHorizontal,
  Mail,
  Calendar,
  Globe,
  ShieldCheck,
  UserPlus,
  Building2,
  Fingerprint,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  RotateCcw,
  Database,
  Eye,
  FileJson,
  Users,
  Clock,
  X,
  Eraser,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import StatsDrawer from '@/components/StatsDrawer/StatsDrawer';

export default function ClientsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedClientForStats, setSelectedClientForStats] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCnpj, setNewClientCnpj] = useState('');
  const [newClientLogo, setNewClientLogo] = useState('');
  const [newClientLogoBg, setNewClientLogoBg] = useState('#ffffff');
  const [newClientPrimaryColor, setNewClientPrimaryColor] = useState('#56d7fd');
  const [isLookingUpCnpj, setIsLookingUpCnpj] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para Abas
  const [activeTab, setActiveTab] = useState<'clients' | 'archived_leads'>('clients');

  // Estados para Leads Arquivados
  const [archivedLeads, setArchivedLeads] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [searchArchived, setSearchArchived] = useState('');
  const [selectedClientForArchivedLeads, setSelectedClientForArchivedLeads] = useState<string | null>(null);
  const [currentPageArchived, setCurrentPageArchived] = useState(1);
  const [selectedArchivedLeadForDetails, setSelectedArchivedLeadForDetails] = useState<any | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  // Estados para Modal de Reset de Resultados
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetClientId, setResetClientId] = useState<string | null>(null);
  const [resetClientName, setResetClientName] = useState('');
  const [archiveBeforeReset, setArchiveBeforeReset] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const handleLogoError = (clientId: string) => {
    setFailedLogos(prev => ({ ...prev, [clientId]: true }));
  };
  
  // Paginação
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  // Estados para o Modal de Confirmação Customizado
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    cancelLabel?: string | null;
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

  const showAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info') => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      type,
      confirmLabel: 'Entendido',
      cancelLabel: null,
      onConfirm: () => {}
    });
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          webhooks(count),
          leads(count)
        `);
      
      if (data) {
        const normalizedData = data.map(client => ({
          ...client,
          webhookCount: client.webhooks?.[0]?.count || 0,
          leadsCount: client.leads?.[0]?.count || 0
        }));
        setClients(normalizedData);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const action = searchParams?.get('action');

  useEffect(() => {
    loadClients();
    if (action === 'new') {
      setIsModalOpen(true);
    }
  }, [action]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Paginação e Filtros para Leads Arquivados
  const ARCHIVED_ITEMS_PER_PAGE = 10;

  const filteredArchivedLeads = archivedLeads.filter(lead => {
    const matchesSearch = 
      (lead.name || '').toLowerCase().includes(searchArchived.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchArchived.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchArchived.toLowerCase());
    
    const matchesClient = selectedClientForArchivedLeads ? lead.client_id === selectedClientForArchivedLeads : true;
    
    return matchesSearch && matchesClient;
  });

  const totalPagesArchived = Math.ceil(filteredArchivedLeads.length / ARCHIVED_ITEMS_PER_PAGE);
  const startIndexArchived = (currentPageArchived - 1) * ARCHIVED_ITEMS_PER_PAGE;
  const paginatedArchivedLeads = filteredArchivedLeads.slice(startIndexArchived, startIndexArchived + ARCHIVED_ITEMS_PER_PAGE);

  // Resetar para página 1 ao buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleToggleStatus = async (id: string, currentStatus: string, clientName: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      await logAction(
        newStatus === 'active' ? 'Conta Reativada' : 'Conta Suspensa', 
        'client', 
        id, 
        { name: clientName, previousStatus: currentStatus }
      );
      loadClients();
    }
  };

  const handleLookupCNPJ = async () => {
    if (!newClientCnpj || newClientCnpj.length < 14) return;
    
    setIsLookingUpCnpj(true);
    try {
      const cleanCnpj = newClientCnpj.replace(/\D/g, '');
      const response = await fetch(`/api/cnpj?cnpj=${cleanCnpj}`);
      const data = await response.json();
      
      if (!response.ok) {
        showAlert('Consulta de CNPJ', data.error || 'Erro ao buscar CNPJ.', 'danger');
        return;
      }
      
      if (data && data.razao_social) {
        setNewClientName(data.razao_social);
        if (data.email) setNewClientEmail(data.email);
      } else {
        showAlert('CNPJ Não Encontrado', 'Dados do CNPJ incompletos ou não encontrados.', 'warning');
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      showAlert('Erro de Conexão', 'Erro na conexão com o serviço de busca.', 'danger');
    } finally {
      setIsLookingUpCnpj(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{ 
          name: newClientName,
          logo_url: newClientLogo,
          logo_bg: newClientLogoBg,
          primary_color: newClientPrimaryColor
        }])
        .select()
        .single();

      if (error) {
        showAlert('Erro ao Criar', 'Erro ao criar cliente: ' + error.message, 'danger');
      } else {
        if (data) {
          await logAction('Cliente Criado', 'client', data.id, { name: data.name });
        }
        showAlert('Sucesso', 'Cliente provisionado com sucesso!', 'success');
        setIsModalOpen(false);
        setNewClientName('');
        setNewClientEmail('');
        setNewClientLogo('');
        loadClients();
      }
    } catch (err: any) {
      showAlert('Erro ao Criar', 'Erro inesperado: ' + err.message, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ 
          name: editingClient.name,
          logo_url: editingClient.logo_url,
          logo_bg: editingClient.logo_bg,
          primary_color: editingClient.primary_color
        })
        .eq('id', editingClient.id);

      if (error) {
        showAlert('Erro ao Atualizar', 'Erro ao atualizar cliente: ' + error.message, 'danger');
      } else {
        await logAction('Cliente Atualizado', 'client', editingClient.id, { name: editingClient.name });
        showAlert('Sucesso', 'Dados atualizados com sucesso!', 'success');
        setIsEditModalOpen(false);
        loadClients();
      }
    } catch (err: any) {
      showAlert('Erro ao Atualizar', 'Erro inesperado: ' + err.message, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetWebhook = async (clientId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Resetar Webhooks',
      message: 'Deseja resetar TODOS os webhooks deste cliente? Esta ação removerá os pontos de captura atuais e é irreversível.',
      type: 'danger',
      confirmLabel: 'Resetar Tudo',
      onConfirm: async () => {
        const { error } = await supabase
          .from('webhooks')
          .delete()
          .eq('client_id', clientId);

        if (error) {
          showAlert('Erro ao Resetar', 'Não foi possível resetar os webhooks: ' + error.message, 'danger');
        } else {
          await logAction('Reset de Webhooks', 'client', clientId, { action: 'delete_all_webhooks' });
          loadClients();
        }
      }
    });
  };

  const handleImpersonate = (client: any) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Ativar Modo Impersonação',
      message: `Você será redirecionado para o dashboard com a visão exclusiva de ${client.name}.`,
      type: 'info',
      confirmLabel: 'Acessar Painel',
      onConfirm: () => {
        localStorage.setItem('impersonated_client', JSON.stringify({
          id: client.id,
          name: client.name
        }));
        router.push('/');
      }
    });
  };

  const handleDeleteClient = async (client: any) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Cliente',
      message: `Tem certeza que deseja excluir permanentemente ${client.name}? Todos os leads, usuários e webhooks vinculados a esta conta serão removidos. Esta ação não pode ser desfeita.`,
      type: 'danger',
      confirmLabel: 'Excluir Permanentemente',
      onConfirm: async () => {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', client.id);

        if (error) {
          showAlert('Erro ao Excluir', 'Não foi possível excluir o cliente: ' + error.message, 'danger');
        } else {
          await logAction('Exclusão de Cliente', 'client', client.id, { name: client.name });
          loadClients();
        }
      }
    });
  };

  const loadArchivedLeads = async () => {
    setLoadingArchived(true);
    try {
      const { data, error } = await supabase
        .from('archived_leads')
        .select('*')
        .order('archived_at', { ascending: false });
      
      if (error) throw error;

      if (data) {
        const { decryptLeadsList } = await import('@/utils/frontendEncryption');
        const decrypted = await decryptLeadsList(data);
        setArchivedLeads(decrypted);
      } else {
        setArchivedLeads([]);
      }
    } catch (e: any) {
      console.error('Erro ao carregar leads arquivados:', e);
      showAlert('Erro ao Carregar', 'Não foi possível carregar os leads arquivados: ' + e.message, 'danger');
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'archived_leads') {
      loadArchivedLeads();
    }
  }, [activeTab]);

  const handleResetClientResults = async () => {
    if (!resetClientId || isResetting) return;
    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showAlert('Não autorizado', 'Sessão expirada. Faça login novamente.', 'danger');
        return;
      }

      const response = await fetch('/api/admin/clients/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clientId: resetClientId,
          archive: archiveBeforeReset
        })
      });

      const result = await response.json();

      if (response.ok) {
        showAlert('Sucesso', result.message || 'Resultados resetados com sucesso!', 'success');
        setIsResetModalOpen(false);
        loadClients();
        if (activeTab === 'archived_leads') {
          loadArchivedLeads();
        }
      } else {
        showAlert('Erro ao Resetar', result.error || 'Ocorreu um erro no servidor.', 'danger');
      }
    } catch (err: any) {
      showAlert('Erro de Conexão', err.message || 'Falha ao se conectar à API.', 'danger');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteArchivedLead = async (leadId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Lead Arquivado',
      message: 'Tem certeza que deseja excluir permanentemente este lead arquivado? Esta ação é irreversível.',
      type: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        const { error } = await supabase
          .from('archived_leads')
          .delete()
          .eq('id', leadId);
        
        if (!error) {
          showAlert('Sucesso', 'Lead arquivado excluído com sucesso!', 'success');
          setArchivedLeads(prev => prev.filter(l => l.id !== leadId));
        } else {
          showAlert('Erro ao Excluir', 'Não foi possível excluir o lead: ' + error.message, 'danger');
        }
      }
    });
  };

  const handleClearArchivedLeads = async () => {
    const filteredClientName = clients.find(c => c.id === selectedClientForArchivedLeads)?.name;
    const queryMsg = selectedClientForArchivedLeads 
      ? `Deseja excluir permanentemente TODOS os leads arquivados do cliente "${filteredClientName}"?`
      : 'Deseja excluir permanentemente TODOS os leads arquivados de TODOS os clientes?';
    
    setConfirmConfig({
      isOpen: true,
      title: 'Limpar Leads Arquivados',
      message: `${queryMsg} Esta ação é irreversível e removerá permanentemente os registros salvos.`,
      type: 'danger',
      confirmLabel: 'Excluir Todos',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        let query = supabase.from('archived_leads').delete();
        if (selectedClientForArchivedLeads) {
          query = query.eq('client_id', selectedClientForArchivedLeads);
        } else {
          query = query.neq('id', '00000000-0000-0000-0000-000000000000');
        }

        const { error } = await query;
        
        if (!error) {
          showAlert('Sucesso', 'Histórico limpo com sucesso!', 'success');
          if (selectedClientForArchivedLeads) {
            setArchivedLeads(prev => prev.filter(l => l.client_id !== selectedClientForArchivedLeads));
          } else {
            setArchivedLeads([]);
          }
        } else {
          showAlert('Erro ao Limpar', 'Não foi possível limpar o histórico: ' + error.message, 'danger');
        }
      }
    });
  };

  return (
    <DashboardLayout>
      <div className={styles.container}>
        
        {/* Admin Stats Summary */}
        <div className={styles.adminStats}>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Total de Clientes</span>
            <h3 className={styles.miniValue}>{clients.length}</h3>
          </div>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Leads Gerados (Total)</span>
            <h3 className={styles.miniValue}>
              {clients.reduce((acc, c) => acc + (c.leads?.[0]?.count || 0), 0)}
            </h3>
          </div>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Webhooks Ativos</span>
            <h3 className={styles.miniValue}>
              {clients.reduce((acc, c) => acc + (c.webhookCount || 0), 0)}
            </h3>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'clients' ? styles.activeTab : ''}`} 
            onClick={() => setActiveTab('clients')}
          >
            <Users size={18} />
            <span>Gestão de Clientes</span>
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'archived_leads' ? styles.activeTab : ''}`} 
            onClick={() => setActiveTab('archived_leads')}
          >
            <Database size={18} />
            <span>Leads Salvos (Histórico)</span>
          </button>
        </div>

        {activeTab === 'clients' ? (
          <>
            <div className={styles.headerActions}>
            <div className={styles.searchBox}>
              <Search size={20} />
              <input 
                type="text" 
                placeholder="Buscar clientes por nome..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className={styles.viewSwitcher}>
              <button 
                className={`${styles.viewBtn} ${viewMode === 'table' ? styles.activeView : ''}`}
                onClick={() => setViewMode('table')}
                title="Ver Lista"
              >
                <List size={20} />
              </button>
              <button 
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.activeView : ''}`}
                onClick={() => setViewMode('grid')}
                title="Ver Cards"
              >
                <LayoutGrid size={20} />
              </button>
            </div>

            <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
              <Plus size={20} />
              <span>Novo Cliente</span>
            </button>
          </div>

        <div className={`${styles.tableSection} ${viewMode === 'table' ? styles.tableSectionVisible : ''}`}>
          {viewMode === 'table' ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Uso (Leads)</th>
                  <th>Webhooks</th>
                  <th>Ações de Controle</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className={styles.clientCell}>
                        <div 
                          className={styles.clientAvatar} 
                          style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.1)' }}
                        >
                          {client.logo_url && !failedLogos[client.id] ? (
                            <img 
                              src={client.logo_url} 
                              alt={client.name} 
                              className={styles.avatarImg} 
                              onError={() => handleLogoError(client.id)}
                            />
                          ) : (
                            <span className={styles.avatarInitial}>{client.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className={styles.clientInfo}>
                          <span className={styles.clientName}>{client.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`${styles.statusBadge} ${client.status === 'active' ? styles.active : styles.inactive}`}>
                        {client.status === 'active' ? 'Ativo' : 'Desativado'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.usageCell}>
                        <span className={styles.usageValue}>{client.leadsCount}</span>
                        <div className={styles.usageBar}>
                          <div className={styles.usageProgress} style={{ width: `${Math.min((client.leadsCount / 200) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.webhookCount}>{client.webhookCount} Terminais</span>
                    </td>
                    <td>
                      <div className={styles.actionGrid}>
                        <button 
                          className={styles.iconAction} 
                          title="Editar Cliente"
                          onClick={() => {
                            setEditingClient(client);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          className={styles.iconAction} 
                          title="Impersonar Cliente"
                          onClick={() => handleImpersonate(client)}
                        >
                          <UserCog size={18} />
                        </button>
                        <button 
                          className={`${styles.iconAction} ${client.status === 'active' ? styles.btnPowerOff : styles.btnPowerOn}`} 
                          title={client.status === 'active' ? 'Desativar Conta' : 'Ativar Conta'}
                          onClick={() => handleToggleStatus(client.id, client.status, client.name)}
                        >
                          {client.status === 'active' ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        <button 
                          className={styles.iconAction} 
                          title="Resetar Webhooks"
                          onClick={() => handleResetWebhook(client.id)}
                        >
                          <RefreshCcw size={18} />
                        </button>
                        <button 
                          className={`${styles.iconAction} ${styles.btnReset}`} 
                          title="Resetar Resultados (Leads)"
                          onClick={() => {
                            setResetClientId(client.id);
                            setResetClientName(client.name);
                            setArchiveBeforeReset(true);
                            setIsResetModalOpen(true);
                          }}
                        >
                          <Eraser size={18} />
                        </button>
                        <button 
                          className={styles.iconAction} 
                          title="Estatísticas"
                          onClick={() => {
                            setSelectedClientForStats(client);
                            setIsDrawerOpen(true);
                          }}
                        >
                          <BarChart3 size={18} />
                        </button>
                        <button 
                          className={`${styles.iconAction} ${styles.btnDelete}`} 
                          title="Excluir Cliente"
                          onClick={() => handleDeleteClient(client)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className={styles.clientsGrid}>
              {paginatedClients.map((client) => (
                <div key={client.id} className={`${styles.clientCard} glass`}>
                  <div className={styles.cardHeader}>
                    <div 
                      className={styles.cardAvatar} 
                      style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.1)' }}
                    >
                      {client.logo_url && !failedLogos[client.id] ? (
                        <img 
                          src={client.logo_url} 
                          alt={client.name} 
                          className={styles.avatarImg} 
                          onError={() => handleLogoError(client.id)}
                        />
                      ) : (
                        <span className={styles.avatarInitial}>{client.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className={`${styles.cardBadge} ${client.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}>
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardName} title={client.name}>{client.name}</h3>
                    <div className={styles.cardStats}>
                      <div className={styles.cardStat}>
                        <span className={styles.statLabel}>Leads</span>
                        <span className={styles.statValue}>{client.leadsCount}</span>
                      </div>
                      <div className={styles.cardStat}>
                        <span className={styles.statLabel}>Terminais</span>
                        <span className={styles.statValue}>{client.webhookCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button onClick={() => { setEditingClient(client); setIsEditModalOpen(true); }} title="Editar"><Edit2 size={18} /></button>
                    <button onClick={() => handleImpersonate(client)} title="Impersonar"><UserCog size={18} /></button>
                    <button onClick={() => { setSelectedClientForStats(client); setIsDrawerOpen(true); }} title="Estatísticas"><BarChart3 size={18} /></button>
                    <button 
                      onClick={() => handleToggleStatus(client.id, client.status, client.name)}
                      className={client.status === 'active' ? styles.colorDanger : styles.colorSuccess}
                      title={client.status === 'active' ? 'Desativar' : 'Ativar'}
                    >
                      {client.status === 'active' ? <Power size={18} /> : <PowerOff size={18} />}
                    </button>
                    <button 
                      onClick={() => {
                        setResetClientId(client.id);
                        setResetClientName(client.name);
                        setArchiveBeforeReset(true);
                        setIsResetModalOpen(true);
                      }}
                      className={styles.btnReset}
                      title="Resetar Resultados (Leads)"
                    >
                      <Eraser size={18} />
                    </button>
                    <button onClick={() => handleDeleteClient(client)} className={styles.colorDanger} title="Excluir"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredClients.length === 0 && (
                <div className={styles.emptyGrid}>Nenhum cliente encontrado.</div>
              )}
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
              Mostrando <strong>{startIndex + 1}</strong> - <strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)}</strong> de <strong>{filteredClients.length}</strong> clientes
            </div>
            <div className={styles.pageControls}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button 
                  key={page}
                  className={`${styles.pageBtn} ${currentPage === page ? styles.activePage : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </button>
            </div>
          </div>
        )}
          </>
        ) : (
          <div className={styles.leadsTableWrapper}>
            {selectedClientForArchivedLeads === null ? (
              // Visualização Inicial: Grade com todos os clientes e contagem de leads salvos
              <>
                <div className={styles.archivedTitleBar}>
                  <div className={styles.archivedTitleText}>
                    <h3>Clientes com Leads Salvos</h3>
                    <p>Selecione um cliente para explorar os leads arquivados separadamente.</p>
                  </div>
                  <button 
                    className={styles.clearAllBtn}
                    onClick={() => {
                      setSelectedClientForArchivedLeads(null);
                      handleClearArchivedLeads();
                    }}
                    disabled={archivedLeads.length === 0}
                  >
                    <Trash2 size={16} />
                    <span>Limpar Todo o Histórico</span>
                  </button>
                </div>

                {loadingArchived ? (
                  <div className={styles.loadingState}>
                    <RefreshCcw className={styles.spin} size={28} />
                    <span>Carregando dados históricos...</span>
                  </div>
                ) : (
                  <div className={styles.archivedClientsGrid}>
                    {clients.map(client => {
                      const count = archivedLeads.filter(l => l.client_id === client.id).length;
                      return (
                        <div 
                          key={client.id} 
                          className={styles.archivedClientCard}
                          onClick={() => setSelectedClientForArchivedLeads(client.id)}
                        >
                          <div 
                            className={styles.archivedClientAvatar}
                            style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.1)' }}
                          >
                            {client.logo_url && !failedLogos[client.id] ? (
                              <img 
                                src={client.logo_url} 
                                alt={client.name} 
                                className={styles.avatarImg} 
                                onError={() => handleLogoError(client.id)}
                              />
                            ) : (
                              <span className={styles.avatarInitial}>{client.name.charAt(0)}</span>
                            )}
                          </div>
                          
                          <div className={styles.archivedClientInfo}>
                            <span className={styles.archivedClientName}>{client.name}</span>
                            <span className={styles.archivedClientCount}>
                              {count} {count === 1 ? 'lead salvo' : 'leads salvos'}
                            </span>
                          </div>

                          <button className={styles.viewArchivedBtn}>
                            Ver Leads Salvos
                          </button>
                        </div>
                      );
                    })}
                    {clients.length === 0 && (
                      <div className={styles.emptyGrid}>Nenhum cliente cadastrado no sistema.</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Visualização Detalhada: Tabela de leads do cliente selecionado
              <>
                <div className={styles.archivedTitleBar}>
                  <div className={styles.archivedTitleInfo}>
                    <button 
                      className={styles.backBtn}
                      onClick={() => {
                        setSelectedClientForArchivedLeads(null);
                        setSearchArchived('');
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Voltar para Clientes</span>
                    </button>
                    <div className={styles.archivedTitleText}>
                      <h3>Leads Salvos de {clients.find(c => c.id === selectedClientForArchivedLeads)?.name}</h3>
                      <p>
                        Total de {archivedLeads.filter(l => l.client_id === selectedClientForArchivedLeads).length} leads arquivados.
                      </p>
                    </div>
                  </div>
                  <button 
                    className={styles.clearAllBtn}
                    onClick={handleClearArchivedLeads}
                    disabled={filteredArchivedLeads.length === 0}
                  >
                    <Trash2 size={16} />
                    <span>Limpar Leads deste Cliente</span>
                  </button>
                </div>

                <div className={styles.filtersBar}>
                  <div className={styles.filterField} style={{ maxWidth: '400px' }}>
                    <label>Buscar por Nome/Email/Telefone</label>
                    <input 
                      type="text" 
                      placeholder="Filtrar por nome, e-mail..." 
                      className={styles.filterInput}
                      value={searchArchived}
                      onChange={(e) => { setSearchArchived(e.target.value); setCurrentPageArchived(1); }}
                    />
                  </div>
                </div>

                {loadingArchived ? (
                  <div className={styles.loadingState}>
                    <RefreshCcw className={styles.spin} size={28} />
                    <span>Carregando leads arquivados...</span>
                  </div>
                ) : (
                  <>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Contato</th>
                          <th>Origem</th>
                          <th>Data de Captura</th>
                          <th>Arquivado em</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedArchivedLeads.map((lead) => {
                          const isSelector = lead.source === 'custom_tracker' && (
                            lead.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
                            lead.data?.match_type?.toLowerCase().includes('selector') || 
                            lead.name?.toLowerCase().includes('selector')
                          );
                          const isKeyword = lead.source === 'custom_tracker' && (
                            lead.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
                            lead.data?.match_type?.toLowerCase().includes('keyword') || 
                            lead.name?.toLowerCase().includes('keyword')
                          );

                          return (
                            <tr key={lead.id}>
                              <td>
                                <div className={styles.clientCell}>
                                  <span className={styles.clientName}>{lead.name || 'Sem nome'}</span>
                                </div>
                              </td>
                              <td>
                                <div className={styles.contactCell}>
                                  <span className={styles.contactEmail}>{lead.email || 'N/A'}</span>
                                  {lead.phone && <span className={styles.contactPhone}>{lead.phone}</span>}
                                </div>
                              </td>
                              <td>
                                {lead.source === 'whatsapp_tracker' ? (
                                  <span className={`${styles.sourceBadge} ${styles.sourceWhatsApp}`}>WhatsApp</span>
                                ) : isSelector ? (
                                  <span className={`${styles.sourceBadge} ${styles.sourceCustom}`} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>Seletor</span>
                                ) : isKeyword ? (
                                  <span className={`${styles.sourceBadge} ${styles.sourceCustom}`} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>Palavra-Chave</span>
                                ) : lead.source === 'custom_tracker' ? (
                                  <span className={`${styles.sourceBadge} ${styles.sourceCustom}`}>Botão</span>
                                ) : (
                                  <span className={`${styles.sourceBadge} ${styles.sourceForm}`}>Formulário</span>
                                )}
                              </td>
                              <td>{lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : 'N/A'}</td>
                              <td>{new Date(lead.archived_at).toLocaleString('pt-BR')}</td>
                              <td>
                                <div className={styles.actionGrid}>
                                  <button 
                                    className={styles.iconAction} 
                                    title="Ver Detalhes do Lead"
                                    onClick={() => {
                                      setSelectedArchivedLeadForDetails(lead);
                                      setIsJsonModalOpen(true);
                                    }}
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button 
                                    className={`${styles.iconAction} ${styles.btnDelete}`} 
                                    title="Excluir Lead"
                                    onClick={() => handleDeleteArchivedLead(lead.id)}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedArchivedLeads.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                              Nenhum lead arquivado encontrado para este cliente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {totalPagesArchived > 1 && (
                      <div className={styles.pagination}>
                        <div className={styles.pageInfo}>
                          Mostrando <strong>{startIndexArchived + 1}</strong> - <strong>{Math.min(startIndexArchived + ARCHIVED_ITEMS_PER_PAGE, filteredArchivedLeads.length)}</strong> de <strong>{filteredArchivedLeads.length}</strong> leads
                        </div>
                        <div className={styles.pageControls}>
                          <button 
                            className={styles.pageBtn} 
                            onClick={() => setCurrentPageArchived(prev => Math.max(prev - 1, 1))}
                            disabled={currentPageArchived === 1}
                          >
                            Anterior
                          </button>
                          {Array.from({ length: totalPagesArchived }, (_, i) => i + 1).map(page => (
                            <button 
                              key={page}
                              className={`${styles.pageBtn} ${currentPageArchived === page ? styles.activePage : ''}`}
                              onClick={() => setCurrentPageArchived(page)}
                            >
                              {page}
                            </button>
                          ))}
                          <button 
                            className={styles.pageBtn} 
                            onClick={() => setCurrentPageArchived(prev => Math.min(prev + 1, totalPagesArchived))}
                            disabled={currentPageArchived === totalPagesArchived}
                          >
                            Próximo
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Modal de Nova Conta */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Novo Cliente Asthros</h3>
                <p>Configure a nova conta e gere os primeiros sinais de uplink.</p>
              </div>
              <form className={styles.form} onSubmit={handleCreateClient}>
                <div className={styles.inputGroup}>
                  <label>CNPJ (Opcional - Para busca automática)</label>
                  <div className={styles.inputWithAction}>
                    <input 
                      type="text" 
                      placeholder="00.000.000/0000-00" 
                      value={newClientCnpj}
                      maxLength={18}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 14) val = val.slice(0, 14);
                        
                        // Máscara 00.000.000/0000-00
                        val = val.replace(/^(\d{2})(\d)/, '$1.$2');
                        val = val.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                        val = val.replace(/\.(\d{3})(\d)/, '.$1/$2');
                        val = val.replace(/(\d{4})(\d)/, '$1-$2');
                        
                        setNewClientCnpj(val);
                      }}
                    />
                    <button 
                      type="button" 
                      className={styles.inlineActionBtn}
                      onClick={handleLookupCNPJ}
                      disabled={isLookingUpCnpj || !newClientCnpj}
                    >
                      {isLookingUpCnpj ? <RefreshCcw size={16} className={styles.spin} /> : 'Consultar'}
                    </button>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Nome da Empresa/Cliente</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Suprema Odontologia" 
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    required 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>E-mail Administrativo (Opcional)</label>
                  <input 
                    type="email" 
                    placeholder="empresa@exemplo.com" 
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>URL do Logotipo (PNG/SVG)</label>
                  <input 
                    type="text" 
                    placeholder="https://exemplo.com/logo.png" 
                    value={newClientLogo}
                    onChange={(e) => setNewClientLogo(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Cor Primária (Identidade Visual)</label>
                  <div className={styles.colorPickerWrapper}>
                    <input 
                      type="color" 
                      value={newClientPrimaryColor}
                      onChange={(e) => setNewClientPrimaryColor(e.target.value)}
                      className={styles.colorInput}
                    />
                    <input 
                      type="text"
                      value={newClientPrimaryColor.toUpperCase()}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (!val.startsWith('#')) val = '#' + val;
                        if (val.length > 7) val = val.slice(0, 7);
                        setNewClientPrimaryColor(val);
                      }}
                      className={styles.colorTextInput}
                    />
                  </div>
                </div>

                <div className={styles.colorSelector}>
                  <label>Cor de Fundo do Quadro</label>
                  <div className={styles.colorOptions}>
                    {[
                      { hex: '#ffffff', label: 'Branco' },
                      { hex: '#56d7fd', label: 'Azul Claro' },
                      { hex: '#0a1423', label: 'Marinho' }
                    ].map(color => (
                      <button
                        key={color.hex}
                        type="button"
                        className={`${styles.colorBtn} ${newClientLogoBg === color.hex ? styles.colorActive : ''}`}
                        onClick={() => setNewClientLogoBg(color.hex)}
                        style={{ backgroundColor: color.hex }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                    {isSubmitting ? 'Provisionando...' : 'Provisionar Conta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edição */}
        {isEditModalOpen && editingClient && (
          <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Editar Dados do Cliente</h3>
                <p>Atualize as informações de branding e identificação da conta.</p>
              </div>
              <form className={styles.form} onSubmit={handleUpdateClient}>
                <div className={styles.inputGroup}>
                  <label>Nome da Empresa/Cliente</label>
                  <input 
                    type="text" 
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                    required 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>URL do Logotipo (PNG/SVG)</label>
                  <input 
                    type="text" 
                    placeholder="https://exemplo.com/logo.png" 
                    value={editingClient.logo_url || ''}
                    onChange={(e) => setEditingClient({...editingClient, logo_url: e.target.value})}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Cor Primária (Identidade Visual)</label>
                  <div className={styles.colorPickerWrapper}>
                    <input 
                      type="color" 
                      value={editingClient.primary_color || '#56d7fd'}
                      onChange={(e) => setEditingClient({...editingClient, primary_color: e.target.value})}
                      className={styles.colorInput}
                    />
                    <input 
                      type="text"
                      value={(editingClient.primary_color || '#56d7fd').toUpperCase()}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (!val.startsWith('#')) val = '#' + val;
                        if (val.length > 7) val = val.slice(0, 7);
                        setEditingClient({...editingClient, primary_color: val});
                      }}
                      className={styles.colorTextInput}
                    />
                  </div>
                </div>

                <div className={styles.colorSelector}>
                  <label>Cor de Fundo do Quadro</label>
                  <div className={styles.colorOptions}>
                    {[
                      { hex: '#ffffff', label: 'Branco' },
                      { hex: '#56d7fd', label: 'Azul Claro' },
                      { hex: '#0a1423', label: 'Marinho' }
                    ].map(color => (
                      <button
                        key={color.hex}
                        type="button"
                        className={`${styles.colorBtn} ${editingClient.logo_bg === color.hex ? styles.colorActive : ''}`}
                        onClick={() => setEditingClient({ ...editingClient, logo_bg: color.hex })}
                        style={{ backgroundColor: color.hex }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {selectedClientForStats && (
        <StatsDrawer 
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          client={selectedClientForStats}
        />
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmLabel={confirmConfig.confirmLabel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Modal de Reset de Resultados */}
      {isResetModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsResetModalOpen(false)}>
          <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Resetar Resultados - {resetClientName}</h3>
              <p>Esta ação irá remover todos os leads capturados ativos deste cliente do dashboard principal.</p>
            </div>
            
            <div className={styles.form} style={{ gap: '1rem' }}>
              <div className={styles.checkboxGroup} onClick={() => setArchiveBeforeReset(!archiveBeforeReset)}>
                <input 
                  type="checkbox" 
                  checked={archiveBeforeReset} 
                  onChange={(e) => {}} 
                />
                <div className={styles.checkboxText}>
                  <span className={styles.checkboxTitle}>Salvar cópia histórica na aba de Leads Salvos</span>
                  <span className={styles.checkboxDesc}>Os leads serão movidos para o histórico antes de serem zerados.</span>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setIsResetModalOpen(false)}>Cancelar</button>
              <button 
                type="button" 
                className={`${styles.submitBtn} ${styles.colorDanger}`} 
                onClick={handleResetClientResults}
                disabled={isResetting}
                style={{
                  background: '#ef4444',
                  color: '#ffffff'
                }}
              >
                {isResetting ? 'Resetando...' : 'Resetar Dados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes JSON do Lead */}
      {isJsonModalOpen && selectedArchivedLeadForDetails && (
        <div className={styles.modalOverlay} onClick={() => setIsJsonModalOpen(false)}>
          <div className={`${styles.modal} ${styles.jsonDetailsModal} glass`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Detalhes do Lead Arquivado</h3>
              <p>Metadados, parâmetros UTM e comportamento do rastreador.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <strong>Nome:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.name || 'Sem nome'}</span>
                </div>
                <div>
                  <strong>E-mail:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.email || 'N/A'}</span>
                </div>
                <div>
                  <strong>Telefone:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.phone || 'N/A'}</span>
                </div>
                <div>
                  <strong>Origem:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.source}</span>
                </div>
                <div>
                  <strong>Captura:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.created_at ? new Date(selectedArchivedLeadForDetails.created_at).toLocaleString('pt-BR') : 'N/A'}</span>
                </div>
                <div>
                  <strong>Arquivamento:</strong> <span style={{ color: 'var(--muted-foreground)' }}>{selectedArchivedLeadForDetails.archived_at ? new Date(selectedArchivedLeadForDetails.archived_at).toLocaleString('pt-BR') : 'N/A'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <FileJson size={16} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Metadados e Variáveis do Lead (JSON)</span>
              </div>
              <pre className={styles.jsonPre}>
                <code>
                  {JSON.stringify(selectedArchivedLeadForDetails.data || {}, null, 2)}
                </code>
              </pre>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.submitBtn} onClick={() => setIsJsonModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
