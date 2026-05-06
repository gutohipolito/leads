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
  ArrowRight
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
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
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
    
    // 1. Obter Usuário e Perfil
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
      
      // Checar Impersonação
      const impersonated = localStorage.getItem('impersonated_client');
      let activeClientId = clientId;
      
      if (isUserAdmin && impersonated) {
        const impData = JSON.parse(impersonated);
        activeClientId = impData.id;
      }
      
      setUserClientId(activeClientId);
      setNewWebhook(prev => ({ ...prev, client_id: activeClientId || '' }));

      // 2. Carregar Webhooks
      let query = supabase
        .from('webhooks')
        .select(`
          *,
          clients (name)
        `);
      
      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data: webhooksData } = await query;
      if (webhooksData) {
        setWebhooks(webhooksData.map(w => ({
          ...w,
          clientName: w.clients?.name || 'N/A',
          fullUrl: `${window.location.origin}/api/leads/${w.client_id}`
        })));
      }

      // 3. Carregar Clientes para o Modal (apenas se for admin e não estiver impersonando)
      if (isUserAdmin && !impersonated) {
        const { data: clientsData } = await supabase.from('clients').select('id, name').eq('status', 'active');
        if (clientsData) setClients(clientsData);
      }
    }
    
    setLoading(false);
  }

  const toggleSecret = (id: string) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhook.name || !newWebhook.client_id) return;

    const secret = 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const slug = newWebhook.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const { data, error } = await supabase
      .from('webhooks')
      .insert([
        {
          name: newWebhook.name,
          client_id: newWebhook.client_id,
          url_slug: slug,
          secret: secret,
          validation_type: newWebhook.validation_type,
          status: 'active'
        }
      ])
      .select()
      .single();

    if (error) {
      alert('Erro ao criar webhook: ' + error.message);
    } else {
      if (data) {
        await logAction('Webhook Ativado', 'webhook', data.id, { name: newWebhook.name });
      }
      setIsModalOpen(false);
      setNewWebhook({ name: '', client_id: isAdmin ? '' : userClientId || '', validation_type: 'header' });
      loadWebhooksData();
    }
  };

  const handleRegenerate = async (id: string) => {
    if (confirm('Tem certeza que deseja regenerar este segredo? Aplicações antigas pararão de funcionar.')) {
      const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase
        .from('webhooks')
        .update({ secret: newSecret })
        .eq('id', id);

      if (!error) {
        setWebhooks(prev => prev.map(w => w.id === id ? { ...w, secret: newSecret } : w));
        alert(`Segredo regenerado com sucesso!`);
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Gerenciamento de Webhooks">
        <Loader text="Sincronizando Uplinks" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gerenciamento de Webhooks">
      <div className={styles.container}>
        
        <div className={styles.headerActions}>
          <div className={styles.info}>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
              {isAdmin 
                ? 'Visualize e gerencie todos os sinais de uplink do ecossistema Asthros.' 
                : 'Configure os pontos de entrada para capturar leads do seu site.'}
            </p>
          </div>
          <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
            <Plus size={20} />
            <span>Gerar Novo Webhook</span>
          </button>
        </div>

        <div className={styles.webhookGrid}>
          {webhooks.length > 0 ? webhooks.map((webhook) => (
            <div key={webhook.id} className={`${styles.webhookCard} glass`}>
              <div className={styles.cardTop}>
                <div className={styles.webhookInfo}>
                  {isAdmin && <span className={styles.clientName}>{webhook.clientName}</span>}
                  <h3>{webhook.name}</h3>
                </div>
                <div className={styles.statusWrapper}>
                  <div className={`${styles.statusBadge} ${webhook.status === 'active' ? styles.active : styles.inactive}`}>
                    <div className={styles.dot} />
                    <span>{webhook.status === 'active' ? 'SISTEMA ATIVO' : 'SISTEMA INATIVO'}</span>
                  </div>
                </div>
              </div>

              <div className={styles.urlSection}>
                <div className={styles.labelRow}>
                  <span>Endpoint de Destino (Uplink)</span>
                  <ExternalLink size={14} style={{ opacity: 0.5 }} />
                </div>
                <div className={styles.urlBox}>
                  <div className={styles.urlText}>{webhook.fullUrl}</div>
                  <button className={styles.copyBtn} onClick={() => handleCopy(webhook.fullUrl)} title="Copiar URL">
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <div className={styles.securityGrid}>
                <div className={styles.securityItem}>
                  <label>Chave Secreta de Uplink (X-Asthros-Secret)</label>
                  <div className={styles.secretBox}>
                    <div className={styles.secretValue}>
                      {showSecret[webhook.id] ? webhook.secret : '••••••••••••••••••••'}
                    </div>
                    <button className={styles.toggleSecret} onClick={() => toggleSecret(webhook.id)}>
                      {showSecret[webhook.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button className={styles.copyBtn} style={{ width: '32px', height: '32px' }} onClick={() => handleCopy(webhook.secret)}>
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles.securityItem}>
                  <label>Método de Validação</label>
                  <select 
                    className={styles.validationSelect} 
                    defaultValue={webhook.validation_type}
                    disabled={!isAdmin}
                  >
                    <option value="header">Header (Recomendado)</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <button 
                  className={styles.secondaryBtn} 
                  style={{ marginRight: 'auto', gap: '0.5rem', background: 'rgba(255,255,255,0.05)' }}
                  onClick={() => {
                    setSelectedDocsWebhook(webhook);
                    setIsDocsModalOpen(true);
                  }}
                >
                  <BookOpen size={16} />
                  <span>Guia de Integração</span>
                </button>
                <button className={styles.regenBtn} onClick={() => handleRegenerate(webhook.id)}>
                  <RefreshCcw size={16} />
                  <span>Regenerar Sinal</span>
                </button>
                <button className={styles.saveBtn} onClick={() => alert('Alterações salvas')}>
                  <CheckCircle2 size={16} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          )) : (
            <div className={styles.emptyState}>
              Nenhum webhook configurado para este cliente.
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={`${styles.modal} glass`} style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Configurar Novo Uplink</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                  Preencha os dados abaixo para gerar um novo ponto de captura seguro.
                </p>
              </div>

              <div className={styles.minimalSteps}>
                <div className={styles.miniStep}>
                  <div className={styles.miniStepContent}>
                    <strong>1. Identificação</strong>
                    <p>Defina o nome da origem para organizar seus sinais de captura.</p>
                  </div>
                </div>
                <div className={styles.miniStep}>
                  <div className={styles.miniStepContent}>
                    <strong>2. Segurança</strong>
                    <p>Gere sua chave exclusiva para autenticar as transmissões de dados.</p>
                  </div>
                </div>
                <div className={styles.miniStep}>
                  <div className={styles.miniStepContent}>
                    <strong>3. Instalação</strong>
                    <p>Copie o endpoint gerado e insira no seu formulário ou sistema externo.</p>
                  </div>
                </div>
              </div>

              <form className={styles.form} onSubmit={handleCreateWebhook} style={{ marginTop: '0.5rem' }}>
                <div className={styles.inputGroup}>
                  <label>Nome do Ponto de Captura</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Landing Page Campanha Black Friday" 
                    value={newWebhook.name}
                    onChange={e => setNewWebhook({...newWebhook, name: e.target.value})}
                    required 
                  />
                </div>
                
                {isAdmin && (
                  <div className={styles.inputGroup}>
                    <label>Cliente Destinatário</label>
                    <select 
                      value={newWebhook.client_id}
                      onChange={e => setNewWebhook({...newWebhook, client_id: e.target.value})}
                      required
                    >
                      <option value="">Selecionar Cliente...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <label>Tipo de Autenticação</label>
                  <select 
                    value={newWebhook.validation_type}
                    onChange={e => setNewWebhook({...newWebhook, validation_type: e.target.value})}
                  >
                    <option value="header">Segurança via Header (Recomendado)</option>
                    <option value="query">Segurança via URL</option>
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.4rem' }}>
                    O uso de Header é a prática recomendada para evitar exposição de chaves em logs.
                  </p>
                </div>

                <div className={styles.modalActions} style={{ marginTop: '1.5rem', gap: '1rem' }}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.modalSubmitBtn}>
                    ATIVAR UPLINK
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className={`${styles.docsCard} glass`} style={{ padding: '2rem', marginTop: '1rem', border: '1px solid rgba(0, 209, 255, 0.2)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <Shield size={32} color="var(--primary)" />
              <div>
                <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>Instruções de Integração</h4>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Para garantir a segurança, todas as requisições para o seu webhook devem incluir o header <strong>X-Asthros-Secret</strong> com a sua chave secreta. 
                  Sinais sem esta chave ou com chaves incorretas serão descartados pelo nosso firewall.
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                  <button className={styles.regenBtn} style={{ fontSize: '0.75rem' }}>
                    <Server size={14} />
                    <span>Ver Documentação API</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Guia de Integração */}
        {isDocsModalOpen && selectedDocsWebhook && (
          <div className={styles.modalOverlay} onClick={() => setIsDocsModalOpen(false)}>
            <div className={`${styles.docsModal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.docsHeader}>
                <div className={styles.docsTitle}>
                  <h3>Guia de Integração Técnica</h3>
                  <p>{selectedDocsWebhook.name}</p>
                </div>
                <button className={styles.closeBtn} onClick={() => setIsDocsModalOpen(false)}><X size={24} /></button>
              </div>

              <div className={styles.docsBody}>
                <div className={styles.docSection}>
                  <h4>Exemplo Rápido (JavaScript)</h4>
                  <p>Utilize este código para disparar o sinal manualmente de qualquer aplicação web.</p>
                  <div className={styles.codeBlock}>
                    <pre>
{`fetch('${selectedDocsWebhook.fullUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Asthros-Secret': '${selectedDocsWebhook.secret}'
  },
  body: JSON.stringify({
    name: 'Nome do Lead',
    email: 'lead@exemplo.com',
    phone: '11999999999',
    data: { origem: 'site_principal' }
  })
});`}
                    </pre>
                  </div>
                </div>

                <div className={styles.docSection}>
                  <h4>Cenário: Formulário com Webhook Existente</h4>
                  <p>Caso seu formulário já possua um webhook configurado, utilize um disparo assíncrono para evitar interrupções no fluxo principal.</p>
                  <div className={styles.tipBox}>
                    <strong>Estratégia de Envio Paralelo</strong>
                    <p>Mantenha seu envio atual e adicione a chamada para o Asthros como uma função secundária. Isso garante que, mesmo em caso de latência, o usuário final não seja impactado.</p>
                  </div>
                  <div className={styles.codeBlock}>
                    <pre>
{`const handleSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  // 1. Envio para seu sistema atual
  await sendToCurrentCRM(formData);
  
  // 2. Envio Secundário (Asthros)
  fetch('${selectedDocsWebhook.fullUrl}', {
    method: 'POST',
    headers: { 'X-Asthros-Secret': '${selectedDocsWebhook.secret}', 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  }).catch(() => {});

  window.location.href = '/sucesso';
};`}
                    </pre>
                  </div>
                </div>

                <div className={styles.docSection}>
                  <h4>Segurança e Performance</h4>
                  <p>Recomendamos sempre o uso de blocos try/catch ou tratamento de erros vazio (.catch) em envios de webhooks secundários para manter a estabilidade da interface do usuário.</p>
                </div>
              </div>

              <div className={styles.docsFooter}>
                <button className={styles.primaryBtn} style={{ width: 'auto', padding: '0.8rem 2.5rem' }} onClick={() => setIsDocsModalOpen(false)}>
                  Concluir Leitura
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
