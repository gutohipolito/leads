'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './webhooks.module.css';
import { Play, Copy, CheckCircle2, AlertCircle, Cpu, Zap, Link as LinkIcon, Database, Terminal } from 'lucide-react';
import { mockClients } from '@/lib/store';

export default function WebhooksPage() {
  const [selectedClient, setSelectedClient] = useState(mockClients[0].id);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [response, setResponse] = useState<string | null>(null);

  const client = mockClients.find(c => c.id === selectedClient);

  const simulateWebhook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`/api/leads/${selectedClient}`, {
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
                onChange={(e) => setSelectedClient(e.target.value)}
                className={styles.select}
              >
                {mockClients.map(c => (
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
                <code>{client?.webhookUrl}</code>
                <button type="button" onClick={() => navigator.clipboard.writeText(client?.webhookUrl || '')}>
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
              <div className={styles.fieldGroup}>
                <label>Payload de Dados Personalizados</label>
                <textarea name="message" className={styles.textarea} placeholder="Injetar JSON ou texto adicional..." rows={3} />
              </div>
            </div>

            <button 
              type="submit" 
              className={styles.triggerBtn} 
              disabled={status === 'loading'}
            >
              <Zap size={18} fill={status === 'loading' ? 'none' : 'currentColor'} />
              <span>{status === 'loading' ? 'PROCESSANDO...' : 'EXECUTAR UPLINK'}</span>
            </button>
          </form>
        </section>

        {/* Terminal Response Card */}
        <section className={`${styles.statusCard} glass`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <div className={styles.iconCircle}><Terminal size={20} /></div>
              <div>
                <h3>Resposta do Sistema</h3>
                <p>Logs de uplink e códigos de status do servidor.</p>
              </div>
            </div>
          </div>
          
          <div className={styles.terminalContent}>
            {status === 'idle' && (
              <div className={styles.idleState}>
                <Database size={48} strokeWidth={1} />
                <p>Aguardando execução do comando...</p>
              </div>
            )}
            
            {status !== 'idle' && (
              <div className={styles.logBox}>
                <div className={`${styles.statusBadge} ${styles[status]}`}>
                  {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>SINAL: {status === 'success' ? '201 CRIADO' : '400 REQUISIÇÃO INVÁLIDA'}</span>
                </div>
                <div className={styles.jsonWrapper}>
                  <div className={styles.jsonHeader}>
                    <span>Detalhes do Payload</span>
                    <span className={styles.lang}>JSON</span>
                  </div>
                  <pre>{response}</pre>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
