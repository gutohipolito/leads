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

// Componentes SVG Inline Oficiais com Estilo Premium
const HubSpotLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF7A59', filter: 'drop-shadow(0 0 8px rgba(255, 122, 89, 0.4))' }}>
    <path d="M18.874 10.457a3.535 3.535 0 0 0-2.822-2.845V4.23a1.415 1.415 0 0 0-2.83 0v3.382a3.535 3.535 0 1 0 1.954 5.922l2.368 2.368a3.529 3.529 0 0 0-.294.945h-2.316a3.535 3.535 0 1 0-3.327-2.358v-4.63a3.535 3.535 0 1 0-2.83 0v4.63a3.535 3.535 0 1 0 4.242 4.242h2.316a3.535 3.535 0 0 0 6.643-2.146 3.513 3.513 0 0 0-.084-.799l-2.368-2.368a3.538 3.538 0 0 0.96-2.56Zm-7.07 10.011a1.415 1.415 0 1 1 1.415-1.415 1.415 1.415 0 0 1-1.415 1.415ZM4.943 14.838a1.415 1.415 0 1 1 1.415-1.415 1.415 1.415 0 0 1-1.415 1.415Zm10.011-5.795a1.415 1.415 0 1 1-1.415 1.415 1.415 0 0 1 1.415-1.415Z" />
  </svg>
);

const ActiveCampaignLogo = () => (
  <svg width="28" height="28" viewBox="0 0 34 32" fill="currentColor" style={{ color: '#3572ef', filter: 'drop-shadow(0 0 8px rgba(53, 114, 239, 0.4))' }}>
    <path d="M12.983 23.366l3.708-3.708 6.969 6.969-3.708 3.708-6.969-6.969zm17.65-17.65a3.178 3.178 0 00-4.495 0L10.366 21.49l4.495 4.495L30.633 10.21a3.178 3.178 0 000-4.494zM7.55 17.55L2.35 22.75a1.589 1.589 0 000 2.247l2.248 2.247a1.589 1.589 0 002.247 0l5.201-5.201-4.495-4.495z" />
  </svg>
);

const WhatsAppLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366', filter: 'drop-shadow(0 0 8px rgba(37, 211, 102, 0.4))' }}>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.528 2.01 14.069.988 11.84.988c-5.452 0-9.873 4.38-9.876 9.809-.001 1.77.469 3.5 1.361 5.022L2.348 21.65l6.3-1.496zM17.15 13.9c-.28-.14-1.656-.82-1.916-.913-.26-.094-.45-.14-.64.14-.19.28-.735.914-.9 1.1-.166.186-.333.208-.613.068-.28-.14-1.18-.433-2.25-1.385-.83-.74-1.39-1.656-1.55-1.936-.16-.28-.018-.43.12-.57.126-.127.28-.328.42-.492.14-.164.186-.28.28-.466.09-.186.046-.35-.02-.49-.07-.14-.64-1.543-.876-2.11-.23-.554-.464-.477-.64-.486-.166-.008-.356-.01-.546-.01-.19 0-.5.07-.76.357-.26.28-1 .978-1 2.387s1.02 2.766 1.16 2.954c.14.188 2.007 3.06 4.86 4.29.68.29 1.21.464 1.625.596.685.218 1.31.187 1.8.113.55-.083 1.656-.677 1.89-1.332.233-.655.233-1.22.162-1.332-.07-.112-.26-.205-.54-.345z" />
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
                } else {
                  // Se foi desativado no banco, limpa a impersonação local
                  localStorage.removeItem('impersonated_client');
                  setSelectedClientId(null);
                  setImpersonatedName(null);
                }
              }
            }
          }

          // Carregar Integrações
          let integrationsQuery = supabase.from('integrations').select('*').order('created_at', { ascending: false });
          let activeClientId = clientId;

          if (isUserAdmin) {
            const impersonated = localStorage.getItem('impersonated_client');
            if (impersonated) {
              const impData = JSON.parse(impersonated);
              // Verificar se ele estava ativo na lista
              const stillActive = clients.length > 0 
                ? clients.some(c => c.id === impData.id) 
                : true; // Se os clientes ainda não carregaram, assume true temporariamente
              
              if (stillActive) {
                activeClientId = impData.id;
              }
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
  }, [clients.length]); // Executa novamente após carregar os clientes para validação cruzada

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
              </div>

              {/* Resultado do Teste de Conexão */}
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
                <button 
                  type="button" 
                  className={styles.testBtn} 
                  onClick={handleTestConnection}
                  disabled={testing}
                  style={{ marginRight: activeModal === 'create' ? 'auto' : '0' }}
                >
                  <Send size={14} /> <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
                </button>
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
