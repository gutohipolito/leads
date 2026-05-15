'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './simulator.module.css';
import { Play, Copy, CheckCircle2, AlertCircle, Cpu, Zap, Link as LinkIcon, Database, Terminal, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function WebhooksPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedSecret, setSelectedSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [response, setResponse] = useState<string | null>(null);

  useEffect(() => {
    async function loadClients() {
      setLoading(true);
      const { data } = await supabase.from('clients').select('*, webhooks(*)').order('name');
      if (data && data.length > 0) {
        setClients(data);
        const firstClient = data[0];
        setSelectedClient(firstClient.id);
        const activeWebhook = firstClient.webhooks?.find((w: any) => w.status === 'active');
        setSelectedSecret(activeWebhook?.secret || '');
      }
      setLoading(false);
    }
    loadClients();
  }, []);

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    const activeWebhook = client?.webhooks?.find((w: any) => w.status === 'active');
    setSelectedSecret(activeWebhook?.secret || '');
  };

  const simulateWebhook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSecret) {
      setStatus('error');
      setResponse('Erro: Este cliente não possui um terminal (webhook) ativo para teste.');
      return;
    }
    setStatus('loading');
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`/api/leads/${selectedClient}?secret=${selectedSecret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      setResponse(JSON.stringify(result, null, 2));
      
      if (res.ok) setStatus('success');
      else setStatus('error');
    } catch (err) {
      setStatus('error');
      setResponse('Uplink failed: Connection refused by the remote server.');
    }
  };

  const webhookUrl = selectedClient ? `${window.location.origin}/api/leads/${selectedClient}` : '';

  return (
    <DashboardLayout title="Simulador de Webhook">
      <div className={styles.container}>
        
        {/* Configuration Card */}
        <section className={`${styles.configCard} glass`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <div className={styles.iconCircle}><Cpu size={20} /></div>
              <div>
                <h3>Injeção de Sinal</h3>
                <p>Teste seus endpoints de captura com payloads personalizados.</p>
              </div>
            </div>
          </div>

          <form className={styles.form} onSubmit={simulateWebhook}>
            <div className={styles.fieldGroup}>
              <label>Selecionar Cliente Alvo</label>
              <select 
                value={selectedClient} 
                onChange={(e) => handleClientChange(e.target.value)}
                className={styles.select}
                disabled={loading}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.activeEndpoint}>
              <div className={styles.endpointLabel}>
                <LinkIcon size={14} />
                <span>URL de Uplink</span>
              </div>
              <div className={styles.codeBox}>
                <code>{webhookUrl}</code>
                <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label>Nome do Lead</label>
                <input type="text" name="name" className={styles.input} placeholder="ex: João Silva" required />
              </div>
              <div className={styles.fieldGroup}>
                <label>E-mail</label>
                <input type="email" name="email" className={styles.input} placeholder="john@example.com" required />
              </div>
              <div className={styles.fieldGroup}>
                <label>Telefone</label>
                <input type="text" name="phone" className={styles.input} placeholder="+1 (555) 000-0000" />
              </div>
              <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                <label>Payload de Dados Personalizados</label>
                <textarea name="message" className={styles.textarea} placeholder="Injetar JSON ou texto adicional..." rows={3} />
              </div>
            </div>

            <button 
              type="submit" 
              className={styles.triggerBtn} 
              disabled={status === 'loading' || !selectedClient}
            >
              <Zap size={18} fill={status === 'loading' ? 'none' : 'currentColor'} />
              <span>{status === 'loading' ? 'PROCESSANDO...' : 'EXECUTAR UPLINK'}</span>
            </button>
          </form>
        </section>

        <div className={styles.sideContent}>
          {/* Terminal Response Card */}
          <section className={`${styles.statusCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.iconCircle}><Terminal size={20} /></div>
                <div>
                  <h3>Resposta do Sistema</h3>
                  <p>Logs de uplink e códigos de status.</p>
                </div>
              </div>
            </div>
            
            <div className={styles.terminalContent}>
              {status === 'idle' && (
                <div className={styles.idleState}>
                  <Database size={48} strokeWidth={1} />
                  <p>Aguardando comando...</p>
                </div>
              )}
              
              {status !== 'idle' && (
                <div className={styles.logBox}>
                  <div className={`${styles.statusBadge} ${styles[status]}`}>
                    {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{status === 'success' ? '201 CRIADO' : 'ERRO'}</span>
                  </div>
                  <pre className={styles.jsonOutput}>{response}</pre>
                </div>
              )}
            </div>
          </section>

          {/* Notification Test Center */}
          <section className={`${styles.statusCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.iconCircle}><Bell size={20} /></div>
                <div>
                  <h3>Centro de Alertas</h3>
                  <p>Teste as notificações e sons.</p>
                </div>
              </div>
            </div>
            
            <div className={styles.testActions}>
              <p>Simule a chegada de um lead para testar o som e o browser:</p>
              <button 
                type="button" 
                className={styles.testBtn}
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  
                  await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: '📢 Novo Lead Recebido!',
                    message: 'Um novo lead acabou de entrar pelo terminal WP-01.',
                    read: false
                  });
                }}
              >
                <Zap size={18} />
                <span>DISPARAR TESTE</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
