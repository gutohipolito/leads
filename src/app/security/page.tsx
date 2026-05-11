'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Activity, 
  Lock, 
  Plus, 
  MoreVertical, 
  Trash2, 
  RefreshCw, 
  Globe, 
  Server,
  Fingerprint,
  ShieldAlert,
  AlertCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

export default function SecurityPage() {
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecretId, setShowSecretId] = useState<string | null>(null);
  const [score, setScore] = useState(100);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<any>(null);

  const loadSecurityData = async () => {
    setLoading(true);
    
    // 1. Buscar Chaves de API (Webhooks)
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('id, name, secret, status, created_at, clients(name)')
      .order('created_at', { ascending: false });

    // 2. Buscar Eventos de Segurança (Logs de Auditoria)
    const { data: logs } = await supabase
      .from('system_logs')
      .select('*, system_users(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (webhooks) {
      setApiKeys(webhooks);
      
      // Cálculo de Score básico
      let currentScore = 100;
      const inactiveCount = webhooks.filter(w => w.status !== 'active').length;
      currentScore -= (inactiveCount * 5);
      
      // Checar se houve erros de autenticação nas APIs nas últimas 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { count: authFailures } = await supabase
        .from('webhook_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status_code', 401)
        .gt('created_at', yesterday.toISOString());
      
      currentScore -= (Math.min(authFailures || 0, 10) * 3);
      setScore(Math.max(currentScore, 0));
    }

    if (logs) {
      setEvents(logs.map(l => ({
        id: l.id,
        type: l.entity || 'audit',
        description: `${l.action}${l.details?.name ? `: ${l.details.name}` : ''}`,
        timestamp: formatDistance(new Date(l.created_at)),
        severity: l.action.toLowerCase().includes('excluir') || l.action.toLowerCase().includes('suspensa') ? 'high' : 'low',
        user: l.system_users?.name || 'Sistema'
      })));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const formatDistance = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('pt-BR');
  };

  const handleRegenerateSecret = async (id: string, name: string) => {
    const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error } = await supabase
      .from('webhooks')
      .update({ secret: newSecret })
      .eq('id', id);

    if (!error) {
      await logAction('Chave Regenerada', 'webhook', id, { name });
      loadSecurityData();
      alert('Segredo da API atualizado com sucesso!');
    }
  };

  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;

    const { error } = await supabase
      .from('webhooks')
      .update({ status: 'inactive' })
      .eq('id', keyToRevoke.id);

    if (!error) {
      await logAction('Chave Revogada', 'webhook', keyToRevoke.id, { name: keyToRevoke.name });
      loadSecurityData();
    }
    setIsConfirmOpen(false);
  };

  if (loading) return <DashboardLayout title="Centro de Segurança"><Loader text="Monitorando Integridade do Sistema..." /></DashboardLayout>;

  return (
    <DashboardLayout title="Centro de Segurança">
      <div className={styles.container}>
        
        <div className={styles.topSection}>
          <div className={`${styles.scoreCard} glass`}>
            <div className={styles.scoreCircle} style={{ borderColor: score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444') }}>
              <span className={styles.scoreValue}>{score}</span>
              <span className={styles.scoreLabel}>Health Score</span>
            </div>
            <div className={styles.statusInfo}>
              <h3>{score > 80 ? 'Sistema Protegido' : (score > 50 ? 'Atenção Necessária' : 'Risco Detectado')}</h3>
              <p>
                {score === 100 ? 'Todos os protocolos de segurança estão operando perfeitamente.' : `Identificamos ${100 - score} pontos de atenção na infraestrutura.`}
              </p>
            </div>
          </div>

          <div className={`${styles.eventsCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.iconCircle}><Activity size={20} /></div>
                <div>
                  <h3>Eventos de Segurança</h3>
                  <p>Logs reais de auditoria e acessos administrativos.</p>
                </div>
              </div>
              <button className={styles.actionBtn} onClick={() => window.location.href='/logs'}>Ver Todos</button>
            </div>

            <div className={styles.eventList}>
              {events.map(event => (
                <div key={event.id} className={styles.eventItem}>
                  <div className={`${styles.severityIndicator} ${styles[event.severity]}`} />
                  <div className={styles.eventInfo}>
                    <p className={styles.eventDesc}><strong>{event.user}</strong>: {event.description}</p>
                    <div className={styles.eventMeta}>
                      <span><Clock size={10} /> {event.timestamp}</span>
                      <span>•</span>
                      <span className={styles.eventTypeTag}>{event.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className={`${styles.keysSection} glass`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <div className={styles.iconCircle}><Key size={20} /></div>
              <div>
                <h3>Chaves de API (Secrets)</h3>
                <p>Gerenciamento de segredos para captura segura de leads.</p>
              </div>
            </div>
            <button className={styles.addKeyBtn} onClick={() => window.location.href='/webhooks?action=new'}>
              <Plus size={18} />
              <span>Gerar Novo Webhook</span>
            </button>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.keysTable}>
              <thead>
                <tr>
                  <th>NOME / CLIENTE</th>
                  <th>CHAVE (SECRET)</th>
                  <th>STATUS</th>
                  <th>DATA CRIAÇÃO</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(key => (
                  <tr key={key.id}>
                    <td>
                      <div className={styles.keyIdentity}>
                        <span className={styles.keyName}>{key.name}</span>
                        <span className={styles.clientTag}>{key.clients?.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.secretWrapper}>
                        <code className={styles.keyCode}>
                          {showSecretId === key.id ? key.secret : '••••••••••••••••'}
                        </code>
                        <button onClick={() => setShowSecretId(showSecretId === key.id ? null : key.id)}>
                          {showSecretId === key.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${key.status === 'active' ? styles.activeStatus : styles.revokedStatus}`}>
                        {key.status === 'active' ? 'ATIVA' : 'SUSPENSA'}
                      </span>
                    </td>
                    <td>{new Date(key.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button 
                          className={styles.iconBtn} 
                          onClick={() => handleRegenerateSecret(key.id, key.name)}
                          title="Regenerar Segredo"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          className={styles.iconBtn} 
                          style={{ color: '#ef4444' }}
                          onClick={() => {
                            setKeyToRevoke(key);
                            setIsConfirmOpen(true);
                          }}
                          title="Revogar Acesso"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.firewallGrid}>
          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><Globe size={20} /></div>
              <h4>Proteção de Webhook</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Exigência de Header "X-Asthros-Secret" em todas as requisições de entrada.
            </p>
            <div className={styles.securityStatusTag}>
              <ShieldCheck size={14} />
              <span>ATIVO E MONITORADO</span>
            </div>
          </section>

          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><Lock size={20} /></div>
              <h4>Middleware Global</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Bloqueio automático de indexação e acesso a arquivos sensíveis (.env, logs).
            </p>
            <div className={styles.securityStatusTag}>
              <ShieldCheck size={14} />
              <span>ATIVO E MONITORADO</span>
            </div>
          </section>

          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><ShieldAlert size={20} /></div>
              <h4>Modo Pânico</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Suspende imediatamente todos os webhooks em caso de ataque coordenado.
            </p>
            <button className={styles.actionBtn} style={{ width: '100%', padding: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              ATIVAR MODO PÂNICO
            </button>
          </section>
        </div>

      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        title="Revogar Chave de API"
        message={`Tem certeza que deseja suspender a chave "${keyToRevoke?.name}"? Isso interromperá a captura de leads deste webhook imediatamente.`}
        confirmLabel="Suspender Acesso"
        type="danger"
        onConfirm={handleRevokeKey}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </DashboardLayout>
  );
}
