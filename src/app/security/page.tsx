'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './security.module.css';
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
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SecurityPage() {
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulando dados por enquanto, já que não temos tabela de API Keys ainda
    // Mas removendo a dependência do mock fixo que quebra a build
    setApiKeys([
      { id: '1', name: 'Produção Webhook A', key: 'ak_live_••••••••••••4j2', status: 'active', lastUsed: 'Há 5 min' },
      { id: '2', name: 'Desenvolvimento Local', key: 'ak_test_••••••••••••k9s', status: 'active', lastUsed: 'Ontem' },
    ]);

    setEvents([
      { id: '1', type: 'login', description: 'Novo login administrativo detectado: IP 189.23.44.10', timestamp: 'Há 12 min', severity: 'low' },
      { id: '2', type: 'threat', description: 'Tentativa de brute-force bloqueada no endpoint /api/leads', timestamp: 'Há 2h', severity: 'high' },
    ]);
    
    setLoading(false);
  }, []);

  return (
    <DashboardLayout title="Centro de Segurança">
      <div className={styles.container}>
        
        {/* Top Section: Score & Summary */}
        <div className={styles.topSection}>
          <div className={`${styles.scoreCard} glass`}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreValue}>98</span>
              <span className={styles.scoreLabel}>Health Score</span>
            </div>
            <div className={styles.statusInfo}>
              <h3>Sistema Protegido</h3>
              <p>Nenhuma vulnerabilidade crítica detectada nas últimas 24h.</p>
            </div>
          </div>

          <div className={`${styles.eventsCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.iconCircle}><Activity size={20} /></div>
                <div>
                  <h3>Eventos de Segurança</h3>
                  <p>Registros recentes de integridade do sistema.</p>
                </div>
              </div>
              <button className={styles.actionBtn}>Ver Logs</button>
            </div>

            <div className={styles.eventList}>
              {events.map(event => (
                <div key={event.id} className={styles.eventItem}>
                  <div className={`${styles.severityIndicator} ${styles[event.severity]}`} />
                  <div className={styles.eventInfo}>
                    <p className={styles.eventDesc}>{event.description}</p>
                    <div className={styles.eventMeta}>
                      <span>{event.timestamp}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'uppercase' }}>{event.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API Keys Management */}
        <section className={`${styles.keysSection} glass`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerInfo}>
              <div className={styles.iconCircle}><Key size={20} /></div>
              <div>
                <h3>Chaves de API</h3>
                <p>Gerencie chaves de acesso para integração de webhooks.</p>
              </div>
            </div>
            <button className={styles.addKeyBtn}>
              <Plus size={18} />
              <span>Gerar Nova Chave</span>
            </button>
          </div>

          <table className={styles.keysTable}>
            <thead>
              <tr>
                <th>NOME DA CHAVE</th>
                <th>CHAVE (TOKEN)</th>
                <th>STATUS</th>
                <th>ÚLTIMO USO</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id}>
                  <td><span className={styles.keyName}>{key.name}</span></td>
                  <td><code className={styles.keyCode}>{key.key}</code></td>
                  <td>
                    <span className={`${styles.statusBadge} ${key.status === 'active' ? styles.activeStatus : styles.revokedStatus}`}>
                      {key.status === 'active' ? 'ATIVA' : 'REVOGADA'}
                    </span>
                  </td>
                  <td>{key.lastUsed}</td>
                  <td>
                    <button className={styles.actionBtn}><MoreVertical size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Advanced Firewall Config */}
        <div className={styles.firewallGrid}>
          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><Globe size={20} /></div>
              <h4>IP Whitelisting</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Restringir transmissões apenas de endereços IP confiáveis.
            </p>
            <div className={styles.toggleWrapper}>
              <span>Ativar Filtro de IP</span>
              <div 
                className={`${styles.toggle} ${securityEnabled ? styles.on : ''}`}
                onClick={() => setSecurityEnabled(!securityEnabled)}
              >
                <div className={styles.toggleDot} />
              </div>
            </div>
          </section>

          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><Lock size={20} /></div>
              <h4>Autenticação 2FA</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Adicione uma camada extra de segurança ao seu login.
            </p>
            <button className={styles.actionBtn} style={{ width: '100%', padding: '0.75rem' }}>
              Configurar 2FA
            </button>
          </section>

          <section className={`${styles.configCard} glass`}>
            <div className={styles.configHeader}>
              <div className={styles.iconCircle}><ShieldAlert size={20} /></div>
              <h4>Modo Pânico</h4>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Revoga todas as chaves e encerra sessões ativas imediatamente.
            </p>
            <button className={styles.actionBtn} style={{ width: '100%', padding: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              ATIVAR MODO PÂNICO
            </button>
          </section>
        </div>

      </div>
    </DashboardLayout>
  );
}
