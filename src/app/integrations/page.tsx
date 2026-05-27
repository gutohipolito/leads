'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './integrations.module.css';
import { 
  Plug, 
  Webhook, 
  Plus, 
  Trash2, 
  Settings, 
  Activity, 
  ArrowLeft, 
  AlertTriangle, 
  Check,
  Send,
  Save,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

interface Integration {
  id: string;
  client_id: string;
  name: string;
  type: 'webhook' | 'hubspot' | 'activecampaign' | 'zapi';
  config: any;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function IntegrationsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // Controle de Seleção de Cliente (Admin)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);

  // Modais de Criação/Edição
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'webhook' | 'hubspot' | 'activecampaign' | 'zapi' | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);

  // Dados do Formulário
  const [formName, setFormName] = useState('');
  const [configWebhookUrl, setConfigWebhookUrl] = useState('');
  const [configHubspotPortal, setConfigHubspotPortal] = useState('');
  const [configHubspotForm, setConfigHubspotForm] = useState('');
  const [configAcUrl, setConfigAcUrl] = useState('');
  const [configAcKey, setConfigAcKey] = useState('');
  const [configAcList, setConfigAcList] = useState('');
  const [configZapiInstance, setConfigZapiInstance] = useState('');
  const [configZapiToken, setConfigZapiToken] = useState('');
  const [configZapiPhone, setConfigZapiPhone] = useState('');

  // Carregar Sessão e Dados
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('system_users')
            .select('*')
            .eq('email', user.email)
            .single();

          const isUserAdmin = profile?.role === 'admin';
          const clientId = profile?.client_id;
          setIsAdmin(isUserAdmin);
          setUserClientId(clientId);

          // Carregar Clientes se for Admin
          if (isUserAdmin) {
            const { data: clientsData } = await supabase
              .from('clients')
              .select('*')
              .eq('status', 'active');
            if (clientsData) setClients(clientsData);

            // Verificar Impersonação
            const impersonated = localStorage.getItem('impersonated_client');
            if (impersonated) {
              const impData = JSON.parse(impersonated);
              setSelectedClientId(impData.id);
              setImpersonatedName(impData.name);
            }
          }

          // Carregar Integrações
          let integrationsQuery = supabase.from('integrations').select('*').order('created_at', { ascending: false });
          let activeClientId = clientId;

          if (isUserAdmin) {
            const impersonated = localStorage.getItem('impersonated_client');
            if (impersonated) {
              activeClientId = JSON.parse(impersonated).id;
            }
          }

          if (activeClientId) {
            integrationsQuery = integrationsQuery.eq('client_id', activeClientId);
          }

          const { data: integrationsData } = await integrationsQuery;
          if (integrationsData) setIntegrations(integrationsData);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações de integrações:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentClient = useMemo(() => {
    if (!isAdmin) return clients.find(c => c.id === userClientId);
    return clients.find(c => c.id === selectedClientId);
  }, [selectedClientId, isAdmin, clients, userClientId]);

  // Carregar integrações do cliente selecionado (Admin)
  const loadClientIntegrations = async (clientId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (data) setIntegrations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: any) => {
    setSelectedClientId(client.id);
    loadClientIntegrations(client.id);
  };

  const resetClientSelection = () => {
    setSelectedClientId(null);
    setIntegrations([]);
  };

  // Abrir Modal de Criação
  const openCreateModal = (provider: 'webhook' | 'hubspot' | 'activecampaign' | 'zapi') => {
    setSelectedProvider(provider);
    setFormName(provider === 'webhook' ? 'Webhook Customizado' : (provider === 'hubspot' ? 'HubSpot CRM' : (provider === 'activecampaign' ? 'ActiveCampaign' : 'WhatsApp/Z-API')));
    setConfigWebhookUrl('');
    setConfigHubspotPortal('');
    setConfigHubspotForm('');
    setConfigAcUrl('');
    setConfigAcKey('');
    setConfigAcList('');
    setConfigZapiInstance('');
    setConfigZapiToken('');
    setConfigZapiPhone('');
    setActiveModal('create');
  };

  // Abrir Modal de Edição
  const openEditModal = (integration: Integration) => {
    setEditingIntegration(integration);
    setSelectedProvider(integration.type);
    setFormName(integration.name);
    
    // Carregar configurações específicas
    if (integration.type === 'webhook') {
      setConfigWebhookUrl(integration.config?.url || '');
    } else if (integration.type === 'hubspot') {
      setConfigHubspotPortal(integration.config?.portalId || '');
      setConfigHubspotForm(integration.config?.formId || '');
    } else if (integration.type === 'activecampaign') {
      setConfigAcUrl(integration.config?.apiUrl || '');
      setConfigAcKey(integration.config?.apiKey || '');
      setConfigAcList(integration.config?.listId || '');
    } else if (integration.type === 'zapi') {
      setConfigZapiInstance(integration.config?.instanceId || '');
      setConfigZapiToken(integration.config?.token || '');
      setConfigZapiPhone(integration.config?.targetPhone || '');
    }
    setActiveModal('edit');
  };

  // Salvar Nova Integração
  const handleCreateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientIdToUse = isAdmin ? selectedClientId : userClientId;
    if (!clientIdToUse || !selectedProvider) return;

    let config: any = {};
    if (selectedProvider === 'webhook') {
      config = { url: configWebhookUrl.trim() };
    } else if (selectedProvider === 'hubspot') {
      config = { portalId: configHubspotPortal.trim(), formId: configHubspotForm.trim() };
    } else if (selectedProvider === 'activecampaign') {
      config = { apiUrl: configAcUrl.trim(), apiKey: configAcKey.trim(), listId: configAcList.trim() };
    } else if (selectedProvider === 'zapi') {
      config = { instanceId: configZapiInstance.trim(), token: configZapiToken.trim(), targetPhone: configZapiPhone.trim() };
    }

    const { data, error } = await supabase
      .from('integrations')
      .insert([{
        client_id: clientIdToUse,
        name: formName.trim(),
        type: selectedProvider,
        config,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      alert('Erro ao criar integração: ' + error.message);
    } else {
      setIntegrations(prev => [data, ...prev]);
      setActiveModal(null);
      await logAction('Integração Criada', 'webhook', data.id, { name: data.name, type: data.type });
    }
  };

  // Salvar Alterações na Integração
  const handleUpdateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntegration) return;

    let config: any = {};
    if (editingIntegration.type === 'webhook') {
      config = { url: configWebhookUrl.trim() };
    } else if (editingIntegration.type === 'hubspot') {
      config = { portalId: configHubspotPortal.trim(), formId: configHubspotForm.trim() };
    } else if (editingIntegration.type === 'activecampaign') {
      config = { apiUrl: configAcUrl.trim(), apiKey: configAcKey.trim(), listId: configAcList.trim() };
    } else if (editingIntegration.type === 'zapi') {
      config = { instanceId: configZapiInstance.trim(), token: configZapiToken.trim(), targetPhone: configZapiPhone.trim() };
    }

    const { data, error } = await supabase
      .from('integrations')
      .update({
        name: formName.trim(),
        config
      })
      .eq('id', editingIntegration.id)
      .select()
      .single();

    if (error) {
      alert('Erro ao atualizar integração: ' + error.message);
    } else {
      setIntegrations(prev => prev.map(item => item.id === editingIntegration.id ? data : item));
      setActiveModal(null);
      setEditingIntegration(null);
      await logAction('Integração Atualizada', 'webhook', data.id, { name: data.name });
    }
  };

  // Alternar Status Ativo/Inativo
  const handleToggleStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { data, error } = await supabase
      .from('integrations')
      .update({ status: nextStatus })
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      setIntegrations(prev => prev.map(item => item.id === id ? data : item));
      await logAction('Status de Integração Alterado', 'webhook', id, { status: nextStatus, name: data.name });
    }
  };

  // Excluir Integração
  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Deseja realmente remover esta integração permanentemente?')) return;

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erro ao excluir integração: ' + error.message);
    } else {
      setIntegrations(prev => prev.filter(item => item.id !== id));
      setActiveModal(null);
      setEditingIntegration(null);
      await logAction('Integração Excluída', 'webhook', id, { deleted_by: 'admin' });
    }
  };

  if (loading) return <Loader />;

  const showClientSelection = isAdmin && !selectedClientId;

  return (
    <DashboardLayout>
      <div className={styles.container}>
        
        {showClientSelection && (
          <div>
            <div className={styles.header}>
              <div>
                <h2>Selecione um Cliente (Hub de Integrações)</h2>
                <p>Gerencie conexões e repasses de leads de cada parceiro.</p>
              </div>
            </div>
            <div className={styles.clientsGrid}>
              {clients.map(client => (
                <div key={client.id} className={`${styles.clientCard} glass`} onClick={() => handleSelectClient(client)}>
                  <div className={styles.clientInitials}>{client.name.charAt(0)}</div>
                  <div className={styles.clientInfo}>
                    <h3>{client.name}</h3>
                    <span>ID: {client.id.substring(0, 8)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showClientSelection && (
          <div className={styles.hubSection}>
            <div className={styles.header}>
              <div>
                {isAdmin && (
                  <button className={styles.backBtn} onClick={resetClientSelection}>
                    <ArrowLeft size={16} /> <span>Voltar para Clientes</span>
                  </button>
                )}
                <h2 style={{ marginTop: isAdmin ? '1rem' : '0' }}>Hub de Integrações</h2>
                <p>Repasse seus leads capturados em tempo real para CRMs, automações ou WhatsApp.</p>
              </div>
            </div>

            {/* Provedores Disponíveis */}
            <div className={styles.cardsGrid}>
              
              {/* Webhook Customizado */}
              <div className={`${styles.providerCard} glass`}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(86, 215, 253, 0.1)', color: 'var(--primary)' }}>
                    <Webhook size={24} />
                  </div>
                  {integrations.some(i => i.type === 'webhook' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>Webhook Customizado</h3>
                  <p>Envie dados do lead para qualquer URL (ex: n8n, Make, Zapier ou sistema proprietário) em formato JSON.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'webhook') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'webhook')!)}>
                      <Settings size={14} /> <span>Configurações</span>
                    </button>
                  ) : (
                    <button className={styles.primaryBtn} onClick={() => openCreateModal('webhook')}>
                      <Plus size={14} /> <span>Conectar</span>
                    </button>
                  )}
                  {integrations.find(i => i.type === 'webhook') && (
                    <div className={styles.switchContainer}>
                      <span>{integrations.find(i => i.type === 'webhook')?.status === 'active' ? 'Ativo' : 'Pausado'}</span>
                      <label className={styles.switch}>
                        <input 
                          type="checkbox"
                          checked={integrations.find(i => i.type === 'webhook')?.status === 'active'}
                          onChange={() => handleToggleStatus(
                            integrations.find(i => i.type === 'webhook')!.id, 
                            integrations.find(i => i.type === 'webhook')!.status
                          )}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* HubSpot CRM */}
              <div className={`${styles.providerCard} glass`}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(255, 122, 89, 0.1)', color: '#FF7A59' }}>
                    <Plug size={24} />
                  </div>
                  {integrations.some(i => i.type === 'hubspot' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>HubSpot CRM</h3>
                  <p>Envie contatos e informações contextuais do lead de forma nativa e integrada à sua conta HubSpot.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'hubspot') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'hubspot')!)}>
                      <Settings size={14} /> <span>Configurações</span>
                    </button>
                  ) : (
                    <button className={styles.primaryBtn} onClick={() => openCreateModal('hubspot')}>
                      <Plus size={14} /> <span>Conectar</span>
                    </button>
                  )}
                  {integrations.find(i => i.type === 'hubspot') && (
                    <div className={styles.switchContainer}>
                      <span>{integrations.find(i => i.type === 'hubspot')?.status === 'active' ? 'Ativo' : 'Pausado'}</span>
                      <label className={styles.switch}>
                        <input 
                          type="checkbox"
                          checked={integrations.find(i => i.type === 'hubspot')?.status === 'active'}
                          onChange={() => handleToggleStatus(
                            integrations.find(i => i.type === 'hubspot')!.id, 
                            integrations.find(i => i.type === 'hubspot')!.status
                          )}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* ActiveCampaign */}
              <div className={`${styles.providerCard} glass`}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(53, 114, 239, 0.1)', color: '#3572ef' }}>
                    <Activity size={24} />
                  </div>
                  {integrations.some(i => i.type === 'activecampaign' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>ActiveCampaign</h3>
                  <p>Crie contatos e adicione-os automaticamente à sua lista de automação de marketing por e-mail.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'activecampaign') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'activecampaign')!)}>
                      <Settings size={14} /> <span>Configurações</span>
                    </button>
                  ) : (
                    <button className={styles.primaryBtn} onClick={() => openCreateModal('activecampaign')}>
                      <Plus size={14} /> <span>Conectar</span>
                    </button>
                  )}
                  {integrations.find(i => i.type === 'activecampaign') && (
                    <div className={styles.switchContainer}>
                      <span>{integrations.find(i => i.type === 'activecampaign')?.status === 'active' ? 'Ativo' : 'Pausado'}</span>
                      <label className={styles.switch}>
                        <input 
                          type="checkbox"
                          checked={integrations.find(i => i.type === 'activecampaign')?.status === 'active'}
                          onChange={() => handleToggleStatus(
                            integrations.find(i => i.type === 'activecampaign')!.id, 
                            integrations.find(i => i.type === 'activecampaign')!.status
                          )}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Z-API (WhatsApp notification) */}
              <div className={`${styles.providerCard} glass`}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}>
                    <MessageSquare size={24} />
                  </div>
                  {integrations.some(i => i.type === 'zapi' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>Notificação WhatsApp (Z-API)</h3>
                  <p>Envie dados de leads de forma automática direto no WhatsApp do vendedor ou administrador pelo Z-API.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'zapi') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'zapi')!)}>
                      <Settings size={14} /> <span>Configurações</span>
                    </button>
                  ) : (
                    <button className={styles.primaryBtn} onClick={() => openCreateModal('zapi')}>
                      <Plus size={14} /> <span>Conectar</span>
                    </button>
                  )}
                  {integrations.find(i => i.type === 'zapi') && (
                    <div className={styles.switchContainer}>
                      <span>{integrations.find(i => i.type === 'zapi')?.status === 'active' ? 'Ativo' : 'Pausado'}</span>
                      <label className={styles.switch}>
                        <input 
                          type="checkbox"
                          checked={integrations.find(i => i.type === 'zapi')?.status === 'active'}
                          onChange={() => handleToggleStatus(
                            integrations.find(i => i.type === 'zapi')!.id, 
                            integrations.find(i => i.type === 'zapi')!.status
                          )}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal de Conexão/Configurações */}
        {activeModal && selectedProvider && (
          <div className={styles.modalOverlay} onClick={() => setActiveModal(null)}>
            <form 
              onClick={e => e.stopPropagation()} 
              onSubmit={activeModal === 'create' ? handleCreateIntegration : handleUpdateIntegration} 
              className={`${styles.modal} glass`}
            >
              <div className={styles.modalHeader}>
                <h3>{activeModal === 'create' ? 'Conectar' : 'Configurar'} {selectedProvider === 'webhook' ? 'Webhook' : (selectedProvider === 'hubspot' ? 'HubSpot' : (selectedProvider === 'activecampaign' ? 'ActiveCampaign' : 'WhatsApp/Z-API'))}</h3>
                <p>Preencha os parâmetros abaixo para habilitar o envio de leads em tempo real.</p>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label>Apelido / Identificação</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex: Integração Principal"
                    required
                  />
                </div>

                {/* Campos Webhook */}
                {selectedProvider === 'webhook' && (
                  <div className={styles.field}>
                    <label>URL de Envio (Endpoint)</label>
                    <input 
                      type="url" 
                      value={configWebhookUrl}
                      onChange={e => setConfigWebhookUrl(e.target.value)}
                      placeholder="https://seu-sistema.com/endpoint"
                      required
                    />
                  </div>
                )}

                {/* Campos HubSpot */}
                {selectedProvider === 'hubspot' && (
                  <>
                    <div className={styles.field}>
                      <label>HubSpot Portal ID (Hub ID)</label>
                      <input 
                        type="text" 
                        value={configHubspotPortal}
                        onChange={e => setConfigHubspotPortal(e.target.value)}
                        placeholder="Ex: 1234567"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>HubSpot Form GUID (ID do Formulário)</label>
                      <input 
                        type="text" 
                        value={configHubspotForm}
                        onChange={e => setConfigHubspotForm(e.target.value)}
                        placeholder="Ex: 6a82c4eb-73b0-466d-8693-fd4d7a..."
                        required
                      />
                    </div>
                  </>
                )}

                {/* Campos ActiveCampaign */}
                {selectedProvider === 'activecampaign' && (
                  <>
                    <div className={styles.field}>
                      <label>API URL (Endereço da Conta)</label>
                      <input 
                        type="url" 
                        value={configAcUrl}
                        onChange={e => setConfigAcUrl(e.target.value)}
                        placeholder="https://suaconta.activehosted.com"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>API Key (Chave de Acesso)</label>
                      <input 
                        type="password" 
                        value={configAcKey}
                        onChange={e => setConfigAcKey(e.target.value)}
                        placeholder="Insira o Token de API do ActiveCampaign"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>List ID (ID da Lista de Contatos)</label>
                      <input 
                        type="text" 
                        value={configAcList}
                        onChange={e => setConfigAcList(e.target.value)}
                        placeholder="Ex: 1"
                      />
                    </div>
                  </>
                )}

                {/* Campos Z-API */}
                {selectedProvider === 'zapi' && (
                  <>
                    <div className={styles.field}>
                      <label>ID da Instância Z-API</label>
                      <input 
                        type="text" 
                        value={configZapiInstance}
                        onChange={e => setConfigZapiInstance(e.target.value)}
                        placeholder="Ex: 3B2D05C6..."
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Token de Acesso Z-API</label>
                      <input 
                        type="password" 
                        value={configZapiToken}
                        onChange={e => setConfigZapiToken(e.target.value)}
                        placeholder="Insira o Token do Z-API"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Telefone do Destinatário (com DDI)</label>
                      <input 
                        type="text" 
                        value={configZapiPhone}
                        onChange={e => setConfigZapiPhone(e.target.value)}
                        placeholder="Ex: 5511999999999"
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                {activeModal === 'edit' && editingIntegration && (
                  <button 
                    type="button" 
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteIntegration(editingIntegration.id)}
                    style={{ marginRight: 'auto' }}
                  >
                    <Trash2 size={16} /> <span>Excluir</span>
                  </button>
                )}
                <button type="button" className={styles.secondaryBtn} onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  <Save size={16} /> <span>{activeModal === 'create' ? 'Conectar' : 'Salvar'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
