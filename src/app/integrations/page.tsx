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

// Componentes SVG Inline Oficiais com Estilo Premium Geométrico robusto
const HubSpotLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FF7A59', filter: 'drop-shadow(0 0 6px rgba(255, 122, 89, 0.4))', display: 'block' }}>
    <circle cx="12" cy="12" r="3" fill="#FF7A59" />
    <line x1="12" y1="9" x2="12" y2="4" stroke="#FF7A59" strokeWidth="2.5" />
    <line x1="9.5" y1="13.5" x2="5" y2="16" stroke="#FF7A59" strokeWidth="2.5" />
    <line x1="14.5" y1="13.5" x2="19" y2="16" stroke="#FF7A59" strokeWidth="2.5" />
    <circle cx="12" cy="4" r="2.5" fill="#FF7A59" />
    <circle cx="5" cy="16" r="2.5" fill="#FF7A59" />
    <circle cx="19" cy="16" r="2.5" fill="#FF7A59" />
  </svg>
);

const ActiveCampaignLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3572ef', filter: 'drop-shadow(0 0 6px rgba(53, 114, 239, 0.4))', display: 'block' }}>
    <circle cx="6" cy="18" r="3" fill="#3572ef" />
    <circle cx="12" cy="12" r="3" fill="#3572ef" />
    <circle cx="18" cy="6" r="3" fill="#3572ef" />
    <line x1="8.1" y1="15.9" x2="9.9" y2="14.1" stroke="#3572ef" />
    <line x1="14.1" y1="11.9" x2="15.9" y2="10.1" stroke="#3572ef" />
  </svg>
);

const WhatsAppLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366', filter: 'drop-shadow(0 0 6px rgba(37, 211, 102, 0.4))', display: 'block' }}>
    <path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.76.46 3.42 1.27 4.88L2 22l5.3-.96c1.4.77 3 1.2 4.7 1.2 5.52 0 10-4.48 10-10.004C22.004 6.48 17.524 2 12.004 2zM17.2 16.3c-.2.6-.9 1.1-1.6 1.3-.5.1-1.1.2-3.1-.6-2.5-1.1-4.1-3.7-4.2-3.9 0-.1-.8-1.1-.8-2.1 0-1 .5-1.5.7-1.7.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.7.8 1.9.1.1.1.3 0 .4-.1.2-.2.3-.4.5-.2.2-.3.3-.5.5-.2.2-.1.4.1.7.4.7.9 1.3 1.6 1.9.9.8 1.6 1 1.9 1.2.3.1.5.1.7-.1.2-.2.8-.9.9-1.2.1-.3.3-.3.6-.2.3.1 1.9.9 2 1 .1.1.2.2.2.3 0 .3-.1.9-.3 1.5z" />
  </svg>
);

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

  // Controle de Teste de Conexão
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; duration?: number; response?: string } | null>(null);

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

          let activeClientId = clientId;

          // Carregar Clientes se for Admin
          if (isUserAdmin) {
            const { data: clientsData } = await supabase
              .from('clients')
              .select('*')
              .eq('status', 'active');
            
            if (clientsData) {
              setClients(clientsData);

              // Verificar Impersonação
              const impersonated = localStorage.getItem('impersonated_client');
              if (impersonated) {
                const impData = JSON.parse(impersonated);
                
                // Validar se o cliente personificado AINDA está ativo
                const isStillActive = clientsData.some(c => c.id === impData.id);
                if (isStillActive) {
                  setSelectedClientId(impData.id);
                  setImpersonatedName(impData.name);
                  activeClientId = impData.id;
                } else {
                  // Se foi desativado no banco, limpa a impersonação local
                  localStorage.removeItem('impersonated_client');
                  setSelectedClientId(null);
                  setImpersonatedName(null);
                  activeClientId = null;
                }
              } else {
                activeClientId = null;
              }
            }
          }

          // Carregar Integrações apenas para o cliente ativo selecionado
          if (activeClientId) {
            const { data: integrationsData } = await supabase
              .from('integrations')
              .select('*')
              .eq('client_id', activeClientId)
              .order('created_at', { ascending: false });
            if (integrationsData) setIntegrations(integrationsData);
          } else {
            setIntegrations([]);
          }
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
    setTestResult(null); // Reseta testes
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
    setTestResult(null); // Reseta testes
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

  // Disparar Teste de Conexão em Tempo Real
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
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

      const res = await fetch('/api/webhooks/test-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedProvider, config })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida! Disparo concluído em ${data.durationMs}ms.`,
          duration: data.durationMs,
          response: data.responseBody
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || `Falha no teste (HTTP ${data.status || res.status}): ${data.responseBody || 'Sem resposta.'}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha na requisição de teste: ${err.message}`
      });
    } finally {
      setTesting(false);
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
                <p>Gerencie conexões e repasses de leads em tempo real de cada parceiro ativo.</p>
              </div>
            </div>
            <div className={styles.clientsGridSelector}>
              {clients.map(client => (
                <div key={client.id} className={`${styles.clientSelectorCard} glass`} onClick={() => handleSelectClient(client)}>
                  <div className={styles.clientSelectorHeader}>
                    <span className={styles.clientSelectorId}>UPLINK_ID: {client.id.substring(0, 8).toUpperCase()}</span>
                    <div className={styles.clientSelectorBadge}>ATIVO</div>
                  </div>
                  <div className={styles.clientSelectorBody}>
                    <div className={styles.clientSelectorInitials} style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.08)' }}>
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className={styles.clientSelectorImg} />
                      ) : (
                        <span>{client.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className={styles.clientSelectorInfo}>
                      <h3>{client.name}</h3>
                    </div>
                  </div>
                  <div className={styles.clientSelectorFooter}>
                    <span>CONFIGURAR CONEXÕES ➔</span>
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

            {/* Diagrama Explicativo de Fluxo em Formato HUD */}
            <div className={`${styles.flowDiagram} glass`}>
              <div className={styles.flowTitle}>
                <Activity size={14} className={styles.flowTitleIcon} />
                <span>FLUXO DE REPASSE DE LEADS EM TEMPO REAL</span>
              </div>
              <div className={styles.flowSteps}>
                <div className={styles.flowStep}>
                  <div className={styles.stepNumber}>01</div>
                  <div className={styles.stepContent}>
                    <h4>Captura (Uplink)</h4>
                    <p>O lead converte no site via formulário ou botão de WhatsApp. Os dados são disparados instantaneamente.</p>
                  </div>
                </div>
                <div className={styles.flowArrow}>➔</div>
                <div className={styles.flowStep}>
                  <div className={styles.stepNumber}>02</div>
                  <div className={styles.stepContent}>
                    <h4>Processamento &amp; Scoring</h4>
                    <p>O backend Asthros calcula o Lead Score, monta a jornada de touchpoints e protege contra spams de IP.</p>
                  </div>
                </div>
                <div className={styles.flowArrow}>➔</div>
                <div className={styles.flowStep}>
                  <div className={styles.stepNumber}>03</div>
                  <div className={styles.stepContent}>
                    <h4>Repasse Direto</h4>
                    <p>Em milissegundos, o lead enriquecido é enviado paralelamente para todas as integrações ativas abaixo.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Provedores Disponíveis */}
            <div className={styles.cardsGrid}>
              
              {/* Webhook Customizado */}
              <div className={`${styles.providerCard} glass`}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(86, 215, 253, 0.1)', color: 'var(--primary)', boxShadow: '0 0 10px rgba(86, 215, 253, 0.2)' }}>
                    <Webhook size={24} />
                  </div>
                  {integrations.some(i => i.type === 'webhook' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>Webhook Customizado</h3>
                  <p>Dispare um POST HTTP em formato JSON com todos os dados do lead, jornada de touchpoints e pontuação (lead score) para uma URL externa. Excelente para alimentar plataformas como Make, n8n, Zapier ou sistemas internos.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'webhook') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'webhook')!)}>
                      <Settings size={14} /> <span>Configurar</span>
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
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(255, 122, 89, 0.1)', color: '#FF7A59', border: '1px solid rgba(255, 122, 89, 0.2)' }}>
                    <HubSpotLogo />
                  </div>
                  {integrations.some(i => i.type === 'hubspot' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>HubSpot CRM</h3>
                  <p>Envie contatos e informações contextuais do lead diretamente para sua conta do HubSpot CRM. Mapeia automaticamente nome, e-mail e telefone do lead utilizando a API oficial de submissão de formulários.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'hubspot') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'hubspot')!)}>
                      <Settings size={14} /> <span>Configurar</span>
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
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(53, 114, 239, 0.1)', color: '#3572ef', border: '1px solid rgba(53, 114, 239, 0.2)' }}>
                    <ActiveCampaignLogo />
                  </div>
                  {integrations.some(i => i.type === 'activecampaign' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>ActiveCampaign</h3>
                  <p>Adicione automaticamente os leads capturados como contatos na sua base do ActiveCampaign e vincule-os diretamente a uma lista específica. Ideal para iniciar disparos de fluxos automatizados de e-mails instantaneamente.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'activecampaign') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'activecampaign')!)}>
                      <Settings size={14} /> <span>Configurar</span>
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
                  <div className={styles.providerLogo} style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                    <WhatsAppLogo />
                  </div>
                  {integrations.some(i => i.type === 'zapi' && i.status === 'active') && (
                    <span className={`${styles.statusIndicator} ${styles.statusActive}`}>Ativo</span>
                  )}
                </div>
                <div className={styles.providerBody}>
                  <h3>WhatsApp Direct (Z-API)</h3>
                  <p>Notifique a equipe de vendas em tempo real no WhatsApp. Envia os dados completos e enriquecidos do lead (como sua temperatura/Lead Score e canais de tráfego) direto para o número do celular do vendedor pelo Z-API.</p>
                </div>
                <div className={styles.providerFooter}>
                  {integrations.find(i => i.type === 'zapi') ? (
                    <button className={styles.secondaryBtn} onClick={() => openEditModal(integrations.find(i => i.type === 'zapi')!)}>
                      <Settings size={14} /> <span>Configurar</span>
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

                {/* Seção de Teste de Conexão Integrada no Corpo */}
                <div className={styles.testSection}>
                  <div className={styles.testSectionHeader}>
                    <span>Validação de Conexão</span>
                    <button 
                      type="button" 
                      className={styles.testBtnInline} 
                      onClick={handleTestConnection}
                      disabled={testing}
                    >
                      <Send size={12} /> <span>{testing ? 'Validando...' : 'Testar Conexão'}</span>
                    </button>
                  </div>
                  
                  {testResult && (
                    <div className={`${styles.testResultBox} ${testResult.success ? styles.testSuccess : styles.testDanger}`}>
                      <div className={styles.testResultHeader}>
                        {testResult.success ? <Check size={14} className={styles.testIconSuccess} /> : <AlertTriangle size={14} className={styles.testIconDanger} />}
                        <strong>{testResult.success ? 'CONEXÃO ESTABELECIDA' : 'FALHA DE INTEGRAÇÃO'}</strong>
                      </div>
                      <p className={styles.testResultMessage}>{testResult.message}</p>
                      {testResult.response && (
                        <pre className={styles.testResultResponse}>
                          {testResult.response}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
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
                <button type="submit" className={styles.primaryBtn} disabled={testing}>
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
