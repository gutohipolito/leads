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
  Zap,
  Globe,
  ShieldCheck,
  UserPlus,
  Building2,
  Fingerprint,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import StatsDrawer from '@/components/StatsDrawer/StatsDrawer';

export default function ClientsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedClientForStats, setSelectedClientForStats] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCnpj, setNewClientCnpj] = useState('');
  const [newClientLogo, setNewClientLogo] = useState('');
  const [isLookingUpCnpj, setIsLookingUpCnpj] = useState(false);

  // Estados para o Modal de Confirmação Customizado
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirmar',
    onConfirm: () => {}
  });

  // Carregar Clientes do Supabase
  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        webhooks(count),
        leads(count)
      `);
    
    if (data) {
      // Normalizar os dados para garantir que a contagem seja acessível
      const normalizedData = data.map(client => ({
        ...client,
        webhookCount: client.webhooks?.[0]?.count || 0,
        leadsCount: client.leads?.[0]?.count || 0
      }));
      setClients(normalizedData);
    }
    setLoading(false);
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
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      const data = await response.json();
      
      if (data && data.razao_social) {
        setNewClientName(data.razao_social);
        // Opcional: preencher e-mail se disponível no cadastro do CNPJ
        if (data.email) setNewClientEmail(data.email);
      } else {
        alert('CNPJ não encontrado ou erro na consulta.');
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      alert('Erro na conexão com o serviço de busca.');
    } finally {
      setIsLookingUpCnpj(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('clients')
      .insert([{ 
        name: newClientName,
        logo_url: newClientLogo 
      }])
      .select()
      .single();

    if (error) {
      alert('Erro ao criar cliente: ' + error.message);
    } else {
      if (data) {
        await logAction('Cliente Criado', 'client', data.id, { name: data.name });
      }
      alert('Cliente provisionado com sucesso!');
      setIsModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientLogo('');
      loadClients();
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
          alert('Erro ao resetar webhooks: ' + error.message);
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
          alert('Erro ao excluir cliente: ' + error.message);
        } else {
          await logAction('Exclusão de Cliente', 'client', client.id, { name: client.name });
          loadClients();
        }
      }
    });
  };

  return (
    <DashboardLayout title="Painel de Controle Administrativo">
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

        <div className={styles.topBar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <UserPlus size={18} />
            <span>Criar Nova Conta</span>
          </button>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <Loader text="Sincronizando Carteira" />
          ) : (
            <table className={styles.adminTable}>
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
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className={styles.clientCell}>
                        <div className={styles.clientAvatar}>
                          <Globe size={18} />
                        </div>
                        <div className={styles.clientInfo}>
                          <span className={styles.clientName}>{client.name}</span>
                          <span className={styles.clientDate}>Desde {new Date(client.created_at).toLocaleDateString()}</span>
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
          )}
        </div>

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
                      onChange={(e) => setNewClientCnpj(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className={styles.inlineActionBtn}
                      onClick={handleLookupCNPJ}
                      disabled={isLookingUpCnpj || !newClientCnpj}
                    >
                      {isLookingUpCnpj ? <RefreshCcw size={16} className={styles.spin} /> : 'Buscar'}
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
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn}>Provisionar Conta</button>
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
    </DashboardLayout>
  );
}
