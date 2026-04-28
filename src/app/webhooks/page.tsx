'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './webhooks.module.css';
import { Play, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
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
      // Usando a rota de API relativa do projeto
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
      setResponse('Falha na conexão com o servidor.');
    }
  };

  return (
    <DashboardLayout title="Teste de Webhooks">
      <div className={styles.container}>
        <div className={`${styles.testCard} glass animate-fade-in`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <h3>Simulador de Envio</h3>
              <p>Teste como seus formulários enviarão dados para o dashboard.</p>
            </div>
            <Play size={24} className={styles.headerIcon} />
          </div>

          <form className={styles.form} onSubmit={simulateWebhook}>
            <div className={styles.inputGroup}>
              <label>Selecionar Cliente</label>
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

            <div className={styles.webhookUrl}>
              <label>Endpoint URL</label>
              <div className={styles.urlBox}>
                <code>{client?.webhookUrl}</code>
                <button type="button" onClick={() => navigator.clipboard.writeText(client?.webhookUrl || '')}>
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <hr className={styles.divider} />

            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label>Nome do Lead</label>
                <input type="text" name="name" className={styles.input} placeholder="Ex: João das Couves" required />
              </div>
              <div className={styles.inputGroup}>
                <label>E-mail</label>
                <input type="email" name="email" className={styles.input} placeholder="joao@email.com" required />
              </div>
              <div className={styles.inputGroup}>
                <label>Telefone</label>
                <input type="text" name="phone" className={styles.input} placeholder="(11) 99999-9999" />
              </div>
              <div className={styles.inputGroup}>
                <label>Mensagem / Observação</label>
                <textarea name="message" className={styles.textarea} placeholder="Olá, gostaria de mais informações..." rows={3} />
              </div>
            </div>

            <button 
              type="submit" 
              className={styles.submitBtn} 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Enviando...' : 'Enviar Lead de Teste'}
            </button>
          </form>
        </div>

        <div className={`${styles.resultCard} glass animate-fade-in`} style={{ animationDelay: '0.2s' }}>
          <div className={styles.cardHeader}>
            <h3>Resposta do Servidor</h3>
          </div>
          
          <div className={styles.resultContent}>
            {status === 'idle' && (
              <div className={styles.emptyState}>
                Aguardando envio de teste...
              </div>
            )}
            
            {status !== 'idle' && (
              <div className={styles.responseBox}>
                <div className={`${styles.statusIndicator} ${styles[status]}`}>
                  {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{status === 'success' ? 'Sucesso (201)' : 'Erro'}</span>
                </div>
                <pre>{response}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
