'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './settings.module.css';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Monitor, 
  Key, 
  Save, 
  CheckCircle2,
  Settings as SettingsIcon,
  LogOut,
  X,
  Volume2,
  ShieldCheck,
  Smartphone,
  History,
  Info,
  MapPin,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [theme, setTheme] = useState('dark');
  
  const [newName, setNewName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);
  const [pendingSound, setPendingSound] = useState(true);
  
  // Security Modal States
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityTab, setSecurityTab] = useState<'sessions' | 'activity' | 'mfa'>('sessions');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [whitelist, setWhitelist] = useState<string[]>([]);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('system_users')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (data) {
          setProfile(data);
          setNewName(data.name);
        }
      }
      setLoading(false);
    }
    loadProfile();

    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('asthros-theme') || 'dark';
      setTheme(savedTheme);
      
      const savedSound = localStorage.getItem('asthros-sound-enabled');
      setSoundEnabled(savedSound === null ? true : savedSound === 'true');
    }
  }, []);

  const loadSecurityData = async () => {
    setLoadingSecurity(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Logs de Atividade (Focados em segurança)
    const { data: logs } = await supabase
      .from('system_logs')
      .select('*')
      .eq('user_id', user.id)
      .in('action', ['Login Realizado', 'Perfil Atualizado', 'Exportação Realizada', 'Troca de Senha'])
      .order('created_at', { ascending: false })
      .limit(15);
    
    setSecurityLogs(logs || []);

    // 2. Dados reais de Segurança do Perfil
    const { data: profile } = await supabase
      .from('system_users')
      .select('mfa_enabled, ip_whitelist')
      .eq('user_id', user.id)
      .single();
    
    if (profile) {
      setMfaEnabled(profile.mfa_enabled || false);
      setWhitelist(profile.ip_whitelist || []);
    }

    // 3. Simulação de Sessões Ativas
    setActiveSessions([
      { 
        id: 'current', 
        device: 'Chrome no Windows (Atual)', 
        location: 'São Paulo, BR', 
        last_active: 'Agora mesmo',
        is_current: true,
        ip: '187.64.XXX.XX'
      }
    ]);

    setLoadingSecurity(false);
  };

  const toggleMfa = async (type: 'email' | 'app') => {
    const newValue = !mfaEnabled;
    const { error } = await supabase
      .from('system_users')
      .update({ mfa_enabled: newValue })
      .eq('id', profile.id);

    if (!error) {
      setMfaEnabled(newValue);
      await logAction('Segurança: 2FA ' + (newValue ? 'Ativado' : 'Desativado'), 'user', profile.id, { type });
      alert(`Autenticação de dois fatores ${newValue ? 'ativada' : 'desativada'} com sucesso!`);
    }
  };

  const handleAddIp = async () => {
    if (!ipInput || whitelist.includes(ipInput)) return;
    const newWhitelist = [...whitelist, ipInput];
    
    const { error } = await supabase
      .from('system_users')
      .update({ ip_whitelist: newWhitelist })
      .eq('id', profile.id);

    if (!error) {
      setWhitelist(newWhitelist);
      setIpInput('');
      await logAction('Segurança: IP Adicionado à Whitelist', 'user', profile.id, { ip: ipInput });
    }
  };

  const handleRemoveIp = async (ipToRemove: string) => {
    const newWhitelist = whitelist.filter(ip => ip !== ipToRemove);
    const { error } = await supabase
      .from('system_users')
      .update({ ip_whitelist: newWhitelist })
      .eq('id', profile.id);

    if (!error) {
      setWhitelist(newWhitelist);
      await logAction('Segurança: IP Removido da Whitelist', 'user', profile.id, { ip: ipToRemove });
    }
  };

  const handleOpenSecurity = () => {
    setIsSecurityModalOpen(true);
    loadSecurityData();
  };

  const toggleSound = (enabled: boolean) => {
    if (enabled === soundEnabled) return;
    setPendingSound(enabled);
    setIsSoundModalOpen(true);
  };

  const confirmSoundToggle = () => {
    setSoundEnabled(pendingSound);
    localStorage.setItem('asthros-sound-enabled', String(pendingSound));
    setIsSoundModalOpen(false);
    
    if (pendingSound) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    }
  };

  const toggleTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('asthros-theme', newTheme);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('system_users')
      .update({ name: newName })
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, name: newName });
      await logAction('Perfil Atualizado', 'user', profile.id, { new_name: newName });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      alert('Erro ao atualizar perfil: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <DashboardLayout title="Configurações">
      <Loader text="Carregando Preferências" />
    </DashboardLayout>
  );

  return (
    <DashboardLayout title="Configurações do Sistema">
      <div className={styles.container}>
        <div className={styles.settingsGrid}>
          
          {/* Profile Section */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <User size={20} className={styles.icon} />
              <h3>Perfil da Conta</h3>
            </div>
            <form className={styles.form} onSubmit={handleUpdateProfile}>
              <div className={styles.field}>
                <label>Nome de Exibição</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Seu nome completo"
                />
              </div>
              <div className={styles.field}>
                <label>E-mail de Acesso</label>
                <div className={styles.inputDisabled}>
                  <Mail size={16} />
                  <span>{profile?.email}</span>
                </div>
              </div>
              <div className={styles.field}>
                <label>Nível de Acesso</label>
                <div className={styles.badgeWrapper}>
                  <Shield size={16} />
                  <span className={styles.roleBadge}>{profile?.role.toUpperCase()}</span>
                </div>
              </div>
              
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {success ? <CheckCircle2 size={18} /> : <Save size={18} />}
                <span>{saving ? 'Salvando...' : (success ? 'Atualizado!' : 'Salvar Alterações')}</span>
              </button>
            </form>
          </div>

          {/* Preferences Section */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <SettingsIcon size={20} className={styles.icon} />
              <h3>Preferências de Interface</h3>
            </div>
            <div className={styles.optionsList}>
              <div className={styles.optionItem}>
                <div className={styles.optionInfo}>
                  <Monitor size={18} />
                  <div>
                    <p>Tema do Dashboard</p>
                    <span>{theme === 'dark' ? 'Ultra-Premium Dark' : 'Aura Light Mode'}</span>
                  </div>
                </div>
                <div className={styles.themeToggleGroup}>
                  <button 
                    className={`${styles.themeBtn} ${theme === 'dark' ? styles.activeTheme : ''}`}
                    onClick={() => toggleTheme('dark')}
                  >
                    Escuro
                  </button>
                  <button 
                    className={`${styles.themeBtn} ${theme === 'light' ? styles.activeTheme : ''}`}
                    onClick={() => toggleTheme('light')}
                  >
                    Claro
                  </button>
                </div>
              </div>
              
              <div className={styles.optionItem}>
                <div className={styles.optionInfo}>
                  <Bell size={18} />
                  <div>
                    <p>Notificações de Som</p>
                    <span>Alertas sonoros para novos leads</span>
                  </div>
                </div>
                <div className={styles.toggleGroup}>
                  <button 
                    className={`${styles.toggleBtn} ${soundEnabled ? styles.toggleActive : ''}`}
                    onClick={() => toggleSound(true)}
                  >
                    Ativado
                  </button>
                  <button 
                    className={`${styles.toggleBtn} ${!soundEnabled ? styles.toggleActiveDanger : ''}`}
                    onClick={() => toggleSound(false)}
                  >
                    Desativado
                  </button>
                </div>
              </div>

              <div className={styles.optionItem}>
                <div className={styles.optionInfo}>
                  <Key size={18} />
                  <div>
                    <p>Segurança Avançada</p>
                    <span>Gerenciar sessões e proteção</span>
                  </div>
                </div>
                <button className={styles.actionLink} onClick={handleOpenSecurity}>Configurar</button>
              </div>
            </div>
          </div>

          {/* Account Management */}
          <div className={`${styles.card} ${styles.dangerCard} glass`}>
            <div className={styles.cardHeader}>
              <LogOut size={20} className={styles.iconDanger} />
              <h3>Gestão de Acesso</h3>
            </div>
            <p className={styles.cardDesc}>
              Encerre sua sessão atual ou gerencie dispositivos conectados à sua conta Asthros.
            </p>
            <button className={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
              Encerrar Sessão
            </button>
          </div>

        </div>
      </div>

      {isSoundModalOpen && typeof window !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={() => setIsSoundModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <button className={styles.closeModal} onClick={() => setIsSoundModalOpen(false)}>
                <X size={20} />
              </button>
              <div className={`${styles.modalIcon} ${pendingSound ? styles.iconSuccess : styles.iconDanger}`}>
                <Volume2 size={32} />
              </div>
              <h3>{pendingSound ? 'Ativar Alertas Sonoros?' : 'Desativar Alertas Sonoros?'}</h3>
              <p>
                {pendingSound 
                  ? 'O sistema emitirá um sinal sonoro premium sempre que um novo lead for detectado ou uma notificação chegar.' 
                  : 'Você deixará de ouvir os alertas sonoros, mas continuará recebendo as notificações visuais normalmente.'}
              </p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsSoundModalOpen(false)}>
                Cancelar
              </button>
              <button 
                className={`${styles.confirmBtn} ${pendingSound ? styles.confirmSuccess : styles.confirmDanger}`}
                onClick={confirmSoundToggle}
              >
                {pendingSound ? 'Sim, Ativar' : 'Sim, Desativar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isSecurityModalOpen && typeof window !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={() => setIsSecurityModalOpen(false)}>
          <div className={`${styles.modal} ${styles.securityModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.securityHeader}>
              <div className={styles.securityTitle}>
                <ShieldCheck size={24} className={styles.icon} />
                <div>
                  <h3>Centro de Segurança</h3>
                  <p>Proteção avançada para sua conta Asthros</p>
                </div>
              </div>
              <button className={styles.closeModal} onClick={() => setIsSecurityModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.securityTabs}>
              <button 
                className={`${styles.tabBtn} ${securityTab === 'sessions' ? styles.activeTab : ''}`}
                onClick={() => setSecurityTab('sessions')}
              >
                <Smartphone size={16} />
                <span>Dispositivos</span>
              </button>
              <button 
                className={`${styles.tabBtn} ${securityTab === 'activity' ? styles.activeTab : ''}`}
                onClick={() => setSecurityTab('activity')}
              >
                <History size={16} />
                <span>Atividade</span>
              </button>
              <button 
                className={`${styles.tabBtn} ${securityTab === 'mfa' ? styles.activeTab : ''}`}
                onClick={() => setSecurityTab('mfa')}
              >
                <Key size={16} />
                <span>Acesso (2FA)</span>
              </button>
            </div>

            <div className={styles.securityContent}>
              {loadingSecurity ? (
                <div className={styles.securityLoader}>
                  <div className={styles.spinner} />
                  <p>Sincronizando dados de segurança...</p>
                </div>
              ) : (
                <>
                  {securityTab === 'sessions' && (
                    <div className={styles.sessionsList}>
                      {activeSessions.map(session => (
                        <div key={session.id} className={styles.sessionItem}>
                          <div className={styles.sessionIcon}>
                            <Monitor size={20} />
                          </div>
                          <div className={styles.sessionInfo}>
                            <div className={styles.sessionMain}>
                              <p>{session.device}</p>
                              {session.is_current && <span className={styles.currentBadge}>Sessão Atual</span>}
                            </div>
                            <div className={styles.sessionMeta}>
                              <span><MapPin size={12} /> {session.location}</span>
                              <span className={styles.dotSeparator}>•</span>
                              <span><Info size={12} /> IP: {session.ip}</span>
                            </div>
                          </div>
                          {!session.is_current && (
                            <button className={styles.terminateBtn}>Encerrar</button>
                          )}
                        </div>
                      ))}
                      <div className={styles.securityTip}>
                        <ShieldCheck size={16} />
                        <p>Dica: Sempre encerre sessões em dispositivos que você não utiliza mais.</p>
                      </div>
                    </div>
                  )}

                  {securityTab === 'activity' && (
                    <div className={styles.activityList}>
                      {securityLogs.length > 0 ? securityLogs.map(log => (
                        <div key={log.id} className={styles.activityItem}>
                          <div className={styles.activityDot} />
                          <div className={styles.activityInfo}>
                            <p className={styles.activityAction}>{log.action}</p>
                            <span className={styles.activityTime}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <ChevronRight size={16} className={styles.chevron} />
                        </div>
                      )) : (
                        <div className={styles.emptyActivity}>
                          <p>Nenhum log de segurança recente.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {securityTab === 'mfa' && (
                    <div className={styles.mfaContainer}>
                      <div className={styles.mfaHero}>
                        <div className={styles.mfaIcon}>
                          <Key size={32} />
                        </div>
                        <h4>Dupla Camada de Proteção</h4>
                        <p>Adicione uma barreira extra solicitando um código de segurança a cada novo login.</p>
                      </div>
                      
                      <div className={styles.mfaOptions}>
                        <div className={styles.mfaOption}>
                          <div className={styles.optionText}>
                            <p>Autenticação por App</p>
                            <span>Google Authenticator ou Authy</span>
                          </div>
                          <button 
                            className={`${styles.setupBtn} ${mfaEnabled ? styles.btnDanger : ''}`}
                            onClick={() => toggleMfa('app')}
                          >
                            {mfaEnabled ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                        <div className={styles.mfaOption}>
                          <div className={styles.optionText}>
                            <p>Código por E-mail</p>
                            <span>Receber código no e-mail cadastrado</span>
                          </div>
                          <button 
                            className={`${styles.setupBtn} ${mfaEnabled ? styles.btnDanger : ''}`}
                            onClick={() => toggleMfa('email')}
                          >
                            {mfaEnabled ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </div>

                      <div className={styles.ipWhitelist}>
                        <div className={styles.ipHeader}>
                          <ShieldCheck size={16} />
                          <p>Whitelist de IPs Autorizados</p>
                        </div>
                        <div className={styles.ipField}>
                          <input 
                            type="text" 
                            placeholder="Adicionar IP (ex: 187.64...)" 
                            value={ipInput}
                            onChange={(e) => setIpInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddIp()}
                          />
                          <button onClick={handleAddIp}>Adicionar</button>
                        </div>
                        <div className={styles.ipList}>
                          {whitelist.map(ip => (
                            <div key={ip} className={styles.ipItem}>
                              <span>{ip}</span>
                              <button onClick={() => handleRemoveIp(ip)}><X size={14} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </DashboardLayout>
  );
}
