'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './webhooks-manage.module.css';
import { 
  Webhook, 
  Copy, 
  RefreshCcw, 
  Shield, 
  Zap, 
  Plus, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  Server,
  X,
  BookOpen,
  Code2,
  Lightbulb,
  AlertTriangle,
  Terminal,
  ArrowRight,
  Info,
  ShieldCheck,
  Cpu,
  Globe,
  Link,
  Mail,
  Play
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

export default function WebhooksManagePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  
  const [activeTab, setActiveTab] = useState<'webhooks' | 'whatsapp'>('webhooks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [selectedDocsWebhook, setSelectedDocsWebhook] = useState<any>(null);

  const [newWebhook, setNewWebhook] = useState({
    name: '',
    client_id: '',
    validation_type: 'header' as 'header' | 'query'
  });

  useEffect(() => {
    loadWebhooksData();
  }, []);

  async function loadWebhooksData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('system_users').select('*').eq('email', user.email).single();
      const isUserAdmin = profile?.role === 'admin';
      setIsAdmin(isUserAdmin);
      const impersonated = localStorage.getItem('impersonated_client');
      let activeClientId = profile?.client_id;
      if (isUserAdmin && impersonated) {
        activeClientId = JSON.parse(impersonated).id;
      }
      setUserClientId(activeClientId);
      setNewWebhook(prev => ({ ...prev, client_id: activeClientId || '' }));
      let query = supabase.from('webhooks').select('*, clients (name)');
      if (activeClientId) query = query.eq('client_id', activeClientId);
      const { data: webhooksData } = await query;
      if (webhooksData) {
        setWebhooks(webhooksData.map(w => ({
          ...w,
          clientName: w.clients?.name || 'N/A',
          fullUrl: `${window.location.origin}/api/leads/${w.client_id}`
        })));
      }
      if (isUserAdmin && !impersonated) {
        const { data: clientsData } = await supabase.from('clients').select('id, name').eq('status', 'active');
        if (clientsData) setClients(clientsData);
      }
    }
    setLoading(false);
  }

  const toggleSecret = (id: string) => setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  const [testStatus, setTestStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const handleTestWebhook = async () => {
    if (!selectedWebhook) return;
    setTestStatus({ status: 'loading' });

    try {
      const response = await fetch(`/api/leads/${selectedWebhook.client_id}?secret=${selectedWebhook.secret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'test_simulation',
          name: 'Teste de Conexão Asthros',
          email: 'teste@asthros.com.br',
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTestStatus({ 
          status: 'success', 
          message: 'Sinal recebido com sucesso! O lead de teste já deve aparecer na sua lista.' 
        });
      } else {
        setTestStatus({ 
          status: 'error', 
          message: result.error || 'Erro desconhecido na API.' 
        });
      }
    } catch (err: any) {
      setTestStatus({ status: 'error', message: 'Falha na requisição: ' + err.message });
    }
  };

  const handleUpdateWebhook = async () => {
    if (!selectedWebhook) return;
    const { error } = await supabase
      .from('webhooks')
      .update({
        outbound_url: selectedWebhook.outbound_url,
        notification_email: selectedWebhook.notification_email
      })
      .eq('id', selectedWebhook.id);

    if (error) {
      alert('Erro ao salvar: ' + error.message);
    } else {
      alert('Configurações salvas com sucesso!');
      setIsDetailsModalOpen(false);
      loadWebhooks();
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhook.name || !newWebhook.client_id) return;
    const secret = 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const slug = newWebhook.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const { data, error } = await supabase.from('webhooks').insert([{
      name: newWebhook.name,
      client_id: newWebhook.client_id,
      url_slug: slug,
      secret: secret,
      validation_type: newWebhook.validation_type,
      status: 'active'
    }]).select().single();
    if (!error && data) {
      await logAction('Webhook Ativado', 'webhook', data.id, { name: newWebhook.name });
      setIsModalOpen(false);
      setNewWebhook({ name: '', client_id: isAdmin ? '' : userClientId || '', validation_type: 'header' });
      loadWebhooksData();
    }
  };

  const handleRegenerate = async (id: string) => {
    if (confirm('Tem certeza que deseja regenerar este segredo? Aplicações antigas pararão de funcionar.')) {
      const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase.from('webhooks').update({ secret: newSecret }).eq('id', id);
      if (!error) {
        setWebhooks(prev => prev.map(w => w.id === id ? { ...w, secret: newSecret } : w));
        if (selectedWebhook?.id === id) setSelectedWebhook({ ...selectedWebhook, secret: newSecret });
        alert(`Segredo regenerado com sucesso!`);
      }
    }
  };

  if (loading) return <DashboardLayout title="Gerenciamento"><Loader text="Sincronizando Sistema" /></DashboardLayout>;

  return (
    <DashboardLayout title="Gerenciamento de Webhooks">
      <div className={styles.container}>
        <div className={styles.headerActions}>
          <div className={styles.headerText}>
            <h2>Terminais de Uplink</h2>
            <p>Gerencie seus pontos de captura de leads e scripts de rastreamento.</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
            <Plus size={20} /><span>Novo Terminal</span>
          </button>
        </div>

        <div className={styles.tabsContainer}>
          <button className={`${styles.tabBtn} ${activeTab === 'webhooks' ? styles.activeTab : ''}`} onClick={() => setActiveTab('webhooks')}>
            <Webhook size={18} /><span>Gestão de Webhooks</span>
          </button>
          <button className={`${styles.tabBtn} ${activeTab === 'whatsapp' ? styles.activeTab : ''}`} onClick={() => setActiveTab('whatsapp')}>
            <Zap size={18} /><span>Rastreador de WhatsApp</span>
          </button>
        </div>

        {activeTab === 'webhooks' ? (
          <div className={styles.webhookGrid}>
              {webhooks.map((webhook) => (
                <div key={webhook.id} className={`${styles.compactCard} glass`} onClick={() => { setSelectedWebhook(webhook); setIsDetailsModalOpen(true); }}>
                  <div className={styles.cardHeaderCompact}>
                    <div className={styles.typeIcon}><Server size={18} /></div>
                    <div className={styles.mainInfo}>
                      {isAdmin && <span className={styles.clientTag}>{webhook.clientName}</span>}
                      <h4>{webhook.name}</h4>
                    </div>
                    <div className={`${styles.miniStatus} ${webhook.status === 'active' ? styles.active : styles.inactive}`} />
                  </div>
                  <div className={styles.cardBrief}>
                    <div className={styles.briefItem}><Zap size={14} /><span>Ativo</span></div>
                    <ArrowRight size={16} className={styles.arrow} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.whatsappTrackerSection}>
            <div className={`${styles.trackerHero} glass`}>
              <div className={styles.heroText}>
                <h3>Rastreamento de Conversões via WhatsApp</h3>
                <p>Monitore cliques em botões de contato e capture dados de origem e comportamento sem interromper o fluxo.</p>
              </div>
            </div>
            <div className={styles.trackerGrid}>
              <div className={`${styles.trackerCard} glass`}>
                <div className={styles.cardHeader}><Terminal size={18} /><h4>Configuração de Instalação</h4></div>
                <div className={styles.trackerSelectionArea}>
                  <label className={styles.areaLabel}>Origens de Captura</label>
                  <div className={styles.compactTrackerGrid}>
                    {webhooks.map(w => (
                      <div key={w.id} className={`${styles.trackerMiniCard} ${selectedDocsWebhook?.id === w.id ? styles.activeTracker : ''} glass`} onClick={() => setSelectedDocsWebhook(selectedDocsWebhook?.id === w.id ? null : w)}>
                        <div className={styles.dotIndicator} /><span>{w.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedDocsWebhook ? (
                  <div className={styles.codeWrapper}>
                    <div className={styles.codeHeader}>
                      <div className={styles.titleWithHelp}>
                        <span>Código de Integração (HTML/JS)</span>
                        <div className={styles.helpTooltip}>
                          <Info size={14} />
                          <span className={styles.tooltipText}>Instalação Global</span>
                        </div>
                      </div>
                      <button className={styles.copyCodeBtn} onClick={() => handleCopy(`<script src="${window.location.origin}/tracker.js" data-client-id="${selectedDocsWebhook.client_id}" data-secret="${selectedDocsWebhook.secret}" data-api-url="${window.location.origin}"></script>`)}>
                        <Copy size={14} /><span>Copiar Script</span>
                      </button>
                    </div>
                    <pre className={styles.codeBlock}>{`<script 
  src="${window.location.origin}/tracker.js" 
  data-client-id="${selectedDocsWebhook.client_id}" 
  data-secret="${selectedDocsWebhook.secret}"
  data-api-url="${window.location.origin}">
</script>`}</pre>

                    <div className={styles.installGuide}>
                      <div className={styles.guideHeader}>
                        <Globe size={14} />
                        <span>Onde instalar este código?</span>
                      </div>
                      <p>Para um rastreamento preciso, cole este código em todas as páginas do seu site, preferencialmente logo antes da tag <strong>&lt;/body&gt;</strong> ou utilize o <strong>Google Tag Manager</strong>.</p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.noWebhookSelectedInline}>
                    <AlertTriangle size={18} />
                    <p>Selecione uma das origens acima para visualizar as credenciais.</p>
                  </div>
                )}
              </div>
              <div className={styles.stepsCard}>
                <div className={styles.stepsHeader}><h4>Funcionamento</h4></div>
                <div className={styles.stepsList}>
                  <div className={styles.stepItem}><div className={styles.stepNum}>01</div><div className={styles.stepContent}><strong>Monitoramento</strong><p>Identifica cliques em links wa.me automaticamente.</p></div></div>
                  <div className={styles.stepItem}><div className={styles.stepNum}>02</div><div className={styles.stepContent}><strong>Atribuição</strong><p>Captura UTMs, referrer e tempo de sessão.</p></div></div>
                  <div className={styles.stepItem}><div className={styles.stepNum}>03</div><div className={styles.stepContent}><strong>Uplink</strong><p>Envia os dados via Beacon API de alta prioridade.</p></div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Novo Webhook */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}><h3>Novo Ponto de Captura</h3></div>
              <form className={styles.form} onSubmit={handleCreateWebhook}>
                <div className={styles.inputGroup}><label>Nome do Ponto</label><input type="text" placeholder="Ex: Site Principal" value={newWebhook.name} onChange={e => setNewWebhook({...newWebhook, name: e.target.value})} required /></div>
                {isAdmin && (<div className={styles.inputGroup}><label>Cliente</label><select value={newWebhook.client_id} onChange={e => setNewWebhook({...newWebhook, client_id: e.target.value})} required><option value="">Selecionar...</option>{clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>)}
                <div className={styles.inputGroup}><label>Autenticação</label><select value={newWebhook.validation_type} onChange={e => setNewWebhook({...newWebhook, validation_type: e.target.value})}><option value="header">Header (Recomendado)</option><option value="query">URL Parameter</option></select></div>
                <div className={styles.modalActions}><button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button><button type="submit" className={styles.modalSubmitBtn}>ATIVAR</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Detalhes do Webhook */}
        {isDetailsModalOpen && selectedWebhook && (
          <div className={styles.modalOverlay} onClick={() => setIsDetailsModalOpen(false)}>
            <div className={`${styles.premiumModal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.premiumModalHeader}>
                <div className={styles.titleSection}>
                  <div className={styles.clientBadge}>{selectedWebhook.clientName}</div>
                  <h3>{selectedWebhook.name}</h3>
                </div>
                <div className={styles.detailGroup}>
                  <label>Webhook de Saída (Integração CRM/Zapier)</label>
                  <div className={styles.inputWithIcon}>
                    <Link size={16} />
                    <input 
                      type="text" 
                      placeholder="https://hooks.zapier.com/..." 
                      value={selectedWebhook.outbound_url || ''}
                      onChange={(e) => setSelectedWebhook({...selectedWebhook, outbound_url: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.detailGroup}>
                  <label>E-mail de Alerta Instantâneo</label>
                  <div className={styles.inputWithIcon}>
                    <Mail size={16} />
                    <input 
                      type="email" 
                      placeholder="alertas@cliente.com" 
                      value={selectedWebhook.notification_email || ''}
                      onChange={(e) => setSelectedWebhook({...selectedWebhook, notification_email: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.testSection}>
                  <div className={styles.testHeader}>
                    <label>Teste de Conexão</label>
                    <p>Verifique se o uplink está configurado corretamente disparando um sinal fictício.</p>
                  </div>
                  
                  <button 
                    className={`${styles.testBtn} ${styles[testStatus.status]}`}
                    onClick={handleTestWebhook}
                    disabled={testStatus.status === 'loading'}
                  >
                    {testStatus.status === 'loading' ? <RefreshCcw size={16} className={styles.spin} /> : <Play size={16} />}
                    <span>{testStatus.status === 'loading' ? 'Disparando...' : 'Simular Sinal de Teste'}</span>
                  </button>

                  {testStatus.status !== 'idle' && (
                    <div className={`${styles.testFeedback} ${styles[testStatus.status]}`}>
                      {testStatus.status === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                      <span>{testStatus.message}</span>
                    </div>
                  )}
                </div>

                <div className={styles.modalActions}>
                  <button className={styles.secondaryBtn} onClick={() => setIsDetailsModalOpen(false)}>Cancelar</button>
                  <button className={styles.primaryBtn} onClick={handleUpdateWebhook}>Salvar Configurações</button>
                </div>
                <button className={styles.closeBtn} onClick={() => setIsDetailsModalOpen(false)}><X size={20} /></button>
              </div>
              <div className={styles.premiumModalBody}>
                <div className={styles.infoSection}>
                  <label><ExternalLink size={14} /> URL DE UPLINK</label>
                  <div className={styles.copyBox}>
                    <code>{selectedWebhook.fullUrl}</code>
                    <button onClick={() => handleCopy(selectedWebhook.fullUrl)}><Copy size={16} /></button>
                  </div>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoSection}>
                    <label><Shield size={14} /> CHAVE SECRETA</label>
                    <div className={styles.copyBox}>
                      <code>{showSecret[selectedWebhook.id] ? selectedWebhook.secret : '••••••••••••••••'}</code>
                      <button onClick={() => toggleSecret(selectedWebhook.id)}>{showSecret[selectedWebhook.id] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      <button onClick={() => handleCopy(selectedWebhook.secret)}><Copy size={16} /></button>
                    </div>
                  </div>
                  <div className={styles.infoSection}>
                    <label><Cpu size={14} /> VALIDAÇÃO</label>
                    <div className={styles.staticValue}>{selectedWebhook.validation_type === 'header' ? 'X-Asthros-Secret' : 'URL Parameter'}</div>
                  </div>
                </div>
                <div className={styles.premiumActionGrid}>
                  <button className={styles.mainAction} onClick={() => { setSelectedDocsWebhook(selectedWebhook); setIsDocsModalOpen(true); }}><BookOpen size={18} /><span>Guia Técnico</span></button>
                  <button className={styles.secAction} onClick={() => handleRegenerate(selectedWebhook.id)}><RefreshCcw size={18} /><span>Regenerar Chave</span></button>
                  <button className={styles.dangerAction}><ShieldAlert size={18} /><span>Desativar</span></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Guia Técnico */}
        {isDocsModalOpen && selectedDocsWebhook && (
          <div className={styles.modalOverlay} onClick={() => setIsDocsModalOpen(false)}>
            <div className={`${styles.docsPremiumModal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.docsHeaderPremium}>
                <div className={styles.docsTitle}>
                  <Code2 size={24} className={styles.docsIcon} />
                  <div>
                    <h3>Implementação Técnica</h3>
                    <p>{selectedDocsWebhook.name}</p>
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setIsDocsModalOpen(false)}><X size={20} /></button>
              </div>
              <div className={styles.docsBodyPremium}>
                <div className={styles.docsStep}>
                  <div className={styles.stepLabel}>OPÇÃO 1: FETCH API (JAVASCRIPT)</div>
                  <p>Ideal para disparos manuais em formulários personalizados.</p>
                  <div className={styles.premiumCodeBlock}>
                    <pre>{`fetch('${selectedDocsWebhook.fullUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Asthros-Secret': '${selectedDocsWebhook.secret}'
  },
  body: JSON.stringify({
    name: 'Nome do Lead',
    email: 'lead@exemplo.com'
  })
});`}</pre>
                  </div>
                </div>
                <div className={styles.docsStep}>
                  <div className={styles.stepLabel}>OPÇÃO 2: ELEMENTOR / WEBHOOKS</div>
                  <p>Configure a URL abaixo no campo Webhook do seu formulário.</p>
                  <div className={styles.premiumCodeBlock}>
                    <pre>{selectedDocsWebhook.validation_type === 'header' 
                      ? `${selectedDocsWebhook.fullUrl}\n(Requer Header X-Asthros-Secret)` 
                      : `${selectedDocsWebhook.fullUrl}?secret=${selectedDocsWebhook.secret}`}</pre>
                  </div>
                </div>
                <div className={styles.docsSafetyTip}>
                  <ShieldCheck size={18} />
                  <p>Sinal transmitido via canal criptografado SSL 256-bit.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
