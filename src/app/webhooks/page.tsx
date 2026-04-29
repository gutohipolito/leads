'use client';

import { useState } from 'react';
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
  Server
} from 'lucide-react';
import { mockClients, currentUser, Client, Webhook as WebhookType } from '@/lib/store';

export default function WebhooksManagePage() {
  const isAdmin = currentUser.role === 'admin';
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Filtrar webhooks com base no usuário
  const allWebhooks = isAdmin 
    ? mockClients.flatMap(c => c.webhooks.map(w => ({ ...w, clientName: c.name })))
    : mockClients.filter(c => c.id === currentUser.clientId).flatMap(c => c.webhooks.map(w => ({ ...w, clientName: c.name })));

  const toggleSecret = (id: string) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  const handleRegenerate = (id: string) => {
    if (confirm('Tem certeza que deseja regenerar este segredo? Aplicações antigas pararão de funcionar.')) {
      alert(`Segredo para o webhook ${id} regenerado com sucesso!`);
    }
  };

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
          <button className={styles.primaryBtn}>
            <Plus size={20} />
            <span>Gerar Novo Webhook</span>
          </button>
        </div>

        <div className={styles.webhookGrid}>
          {allWebhooks.map((webhook) => (
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
                  <div className={styles.urlText}>{webhook.url}</div>
                  <button className={styles.copyBtn} onClick={() => handleCopy(webhook.url)} title="Copiar URL">
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
                    defaultValue={webhook.validationType}
                  >
                    <option value="header">Header (Recomendado)</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <button className={styles.regenBtn} onClick={() => handleRegenerate(webhook.id)}>
                  <RefreshCcw size={16} />
                  <span>Regenerar Sinal</span>
                </button>
                <button className={styles.saveBtn}>
                  <CheckCircle2 size={16} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          ))}
        </div>

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

      </div>
    </DashboardLayout>
  );
}
