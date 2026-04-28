'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './webhooks.module.css';
import { Play, Copy, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
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
      setResponse('Falha na conexão com o servidor de uplink.');
    }
  };

  return (
    <DashboardLayout title="Teste de Uplink (Webhook)">
      <div className={styles.container}>
        <section className={`${styles.configCard} jarvis-card`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <h3>Módulo de Simulação</h3>
              <p>Injetar dados de teste no fluxo de captação.</p>
            </div>
            <Cpu size={24} className={styles.headerIcon} />
          </div>

          <form className={styles.form} onSubmit={simulateWebhook}>
            <div className={styles.fieldGroup}>
              <label>Ponto de Origem</label>
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

            <div className={styles.uplinkInfo}>
              <label>Endpoint Ativo</label>
              <div className={styles.codeBox}>
                <code>{client?.webhookUrl}</code>
                <button type="button" onClick={() => navigator.clipboard.writeText(client?.webhookUrl || '')}>
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label>Identificador</label>
                <input type="text" name="name" className={styles.input} placeholder="Ex: Usuário Alfa" required />
              </div>
              <div className={styles.fieldGroup}>
                <label>Frequência (Email)</label>
                <input type="email" name="email" className={styles.input} placeholder="alfa@universo.com" required />
              </div>
              <div className={styles.fieldGroup}>
                <label>Vetor de Contato</label>
                <input type="text" name="phone" className={styles.input} placeholder="+55 (00) 00000-0000" />
              </div>
              <div className={styles.fieldGroup}>
                <label>Pacote de Dados (Mensagem)</label>
                <textarea name="message" className={styles.textarea} placeholder="Injetar metadados adicionais..." rows={3} />
              </div>
            </div>

            <button 
              type="submit" 
              className={styles.triggerBtn} 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'PROCESSANDO...' : 'EXECUTAR UPLINK'}
            </button>
          </form>
        </section>

        <section className={`${styles.statusCard} jarvis-card`}>
          <div className={styles.cardHeader}>
            <h3>Resposta do Terminal</h3>
          </div>
          
          <div className={styles.terminalContent}>
            {status === 'idle' && (
              <div className={styles.idleState}>
                Aguardando execução de comando...
              </div>
            )}
            
            {status !== 'idle' && (
              <div className={styles.logBox}>
                <div className={`${styles.statusTag} ${styles[status]}`}>
                  {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>STATUS: {status === 'success' ? '201 OK' : 'ERRO CRÍTICO'}</span>
                </div>
                <div className={styles.jsonWrapper}>
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
