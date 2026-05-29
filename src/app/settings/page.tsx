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
import { useRouter } from 'next/navigation';

const soundsList = [
  { id: 'bubble', name: 'Sinal Suave (Bubble)', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'digital', name: 'Bip Digital (Click)', url: 'https://assets.mixkit.co/active_storage/sfx/911/911-preview.mp3' },
  { id: 'chime', name: 'Sino Moderno (Chime)', url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' },
  { id: 'alert', name: 'Alerta Leve (Chimes)', url: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [theme, setTheme] = useState('dark');
  
  const [newName, setNewName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState('bubble');
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);
  const [pendingSound, setPendingSound] = useState(true);

  // Lead Scoring States
  const [scoringRules, setScoringRules] = useState<any>({
    whatsapp_score: 50,
    time_on_page_60: 20,
    time_on_page_20: 10,
    scroll_depth_80: 25,
    scroll_depth_50: 15,
    paid_traffic: 20,
    journey_3: 15,
    journey_2: 10
  });
  const [savingScoring, setSavingScoring] = useState(false);
  const [scoringSuccess, setScoringSuccess] = useState(false);

  // Gestão multicliente para admins
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientIdForScoring, setSelectedClientIdForScoring] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  
  // Security Modal States
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityTab, setSecurityTab] = useState<'sessions' | 'activity' | 'mfa'>('sessions');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [securityLogPage, setSecurityLogPage] = useState(1);
  const LOGS_PER_PAGE = 12;

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

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

            const isUserAdmin = data.role === 'admin';
            const impersonated = localStorage.getItem('impersonated_client');
            let activeClientId = data.client_id;

            if (isUserAdmin && impersonated) {
              const impData = JSON.parse(impersonated);
              activeClientId = impData.id;
              setIsImpersonating(true);
              setImpersonatedName(impData.name);
            }

            setSelectedClientIdForScoring(activeClientId);

            // Carregar clientes ativos se for admin
            if (isUserAdmin) {
              const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name')
                .eq('status', 'active')
                .order('name', { ascending: true });
              setClients(clientsData || []);
            }
          }
        } else {
          router.push('/login');
          return;
        }
      } catch (err) {
        router.push('/login');
        return;
      }
      setLoading(false);
    }
    loadProfile();

    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('asthros-theme') || 'dark';
      setTheme(savedTheme);
      
      const savedSound = localStorage.getItem('asthros-sound-enabled');
      setSoundEnabled(savedSound === null ? true : savedSound === 'true');
      
      const savedSoundType = localStorage.getItem('asthros-sound-type') || 'bubble';
      setSoundType(savedSoundType);
    }
  }, [router]);

  // Carregar regras de Lead Scoring quando o cliente selecionado mudar
  useEffect(() => {
    async function loadScoringRules() {
      if (!selectedClientIdForScoring) return;
      try {
        const { data: scoringData } = await supabase
          .from('lead_scoring_rules')
          .select('*')
          .eq('client_id', selectedClientIdForScoring)
          .maybeSingle();

        if (scoringData) {
          setScoringRules({
            whatsapp_score: scoringData.whatsapp_score ?? 50,
            time_on_page_60: scoringData.time_on_page_60 ?? 20,
            time_on_page_20: scoringData.time_on_page_20 ?? 10,
            scroll_depth_80: scoringData.scroll_depth_80 ?? 25,
            scroll_depth_50: scoringData.scroll_depth_50 ?? 15,
            paid_traffic: scoringData.paid_traffic ?? 20,
            journey_3: scoringData.journey_3 ?? 15,
            journey_2: scoringData.journey_2 ?? 10
          });
        } else {
          // Resetar para as regras padrão
          setScoringRules({
            whatsapp_score: 50,
            time_on_page_60: 20,
            time_on_page_20: 10,
            scroll_depth_80: 25,
            scroll_depth_50: 15,
            paid_traffic: 20,
            journey_3: 15,
            journey_2: 10
          });
        }
      } catch (err) {
        console.error('Erro ao carregar regras de scoring:', err);
      }
    }
    loadScoringRules();
  }, [selectedClientIdForScoring]);

  const loadSecurityData = async () => {
    setLoadingSecurity(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Logs de Atividade (Focados em segurança)
    const { data: logs } = await supabase
      .from('system_logs')
      .select('*')
      .eq('user_id', user.id)
      .in('action', ['Login Realizado', 'Perfil Atualizado', 'Exportação Realizada', 'Troca de Senha'])
      .order('created_at', { ascending: false })
      .limit(100);
    
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

    // 3. Dados Reais da Sessão Atual
    let userIp = 'Detectando...';
    let userLoc = 'Localizando...';
    
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      userIp = ipData.ip;
      
      // Opcional: Buscar localização aproximada via IP (Serviço gratuito limitado)
      const locRes = await fetch(`https://ipapi.co/${userIp}/json/`);
      const locData = await locRes.json();
      userLoc = locData.city ? `${locData.city}, ${locData.country_code}` : 'Localização Desconhecida';
    } catch (e) {
      userIp = 'IP Protegido';
      userLoc = 'Localização Indisponível';
    }

    const browserInfo = () => {
      const ua = navigator.userAgent;
      if (ua.includes('Chrome')) return 'Chrome no ' + (ua.includes('Windows') ? 'Windows' : 'Mac/Linux');
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Safari')) return 'Safari';
      return 'Navegador Web';
    };

    setActiveSessions([
      { 
        id: 'current', 
        device: browserInfo() + ' (Atual)', 
        location: userLoc, 
        last_active: 'Agora mesmo',
        is_current: true,
        ip: userIp
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
      const savedUrl = localStorage.getItem('asthros-sound-url') || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
      const audio = new Audio(savedUrl);
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

  const handleUpdateScoring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientIdForScoring) return;
    setSavingScoring(true);

    const { error } = await supabase
      .from('lead_scoring_rules')
      .upsert({
        client_id: selectedClientIdForScoring,
        whatsapp_score: scoringRules.whatsapp_score,
        time_on_page_60: scoringRules.time_on_page_60,
        time_on_page_20: scoringRules.time_on_page_20,
        scroll_depth_80: scoringRules.scroll_depth_80,
        scroll_depth_50: scoringRules.scroll_depth_50,
        paid_traffic: scoringRules.paid_traffic,
        journey_3: scoringRules.journey_3,
        journey_2: scoringRules.journey_2
      }, { onConflict: 'client_id' });

    if (!error) {
      if (profile?.id) {
        await logAction('Configurações: Regras de Lead Scoring Atualizadas', 'client', selectedClientIdForScoring, {
          updated_by: profile.email
        });
      }
      setScoringSuccess(true);
      setTimeout(() => setScoringSuccess(false), 3000);
    } else {
      alert('Erro ao salvar regras de pontuação: ' + error.message);
    }
    setSavingScoring(false);
  };

  if (loading) return (
    <DashboardLayout>
      <Loader text="Carregando Preferências" />
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
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
              
              <div className={`${styles.optionItemSound} ${soundEnabled ? styles.optionItemSoundExpanded : ''}`}>
                <div className={styles.optionItemSoundHeader}>
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

                {soundEnabled && (
                  <>
                    <div className={styles.soundSelectorRow}>
                      <div className={styles.optionInfo}>
                        <Volume2 size={16} style={{ opacity: 0.7 }} />
                        <div>
                          <p style={{ fontSize: '0.85rem' }}>Tipo do Sinal Sonoro</p>
                          <span style={{ fontSize: '0.75rem' }}>Escolha e teste a melodia de aviso</span>
                        </div>
                      </div>
                      <div className={styles.soundSelectorGroup}>
                        <select 
                          className={styles.soundSelect}
                          value={soundType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            setSoundType(newType);
                            const selected = soundsList.find(s => s.id === newType);
                            if (selected) {
                              localStorage.setItem('asthros-sound-type', selected.id);
                              localStorage.setItem('asthros-sound-url', selected.url);
                              new Audio(selected.url).play().catch(() => {});
                            }
                          }}
                        >
                          {soundsList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          className={styles.testSoundBtn}
                          onClick={() => {
                            const selected = soundsList.find(s => s.id === soundType);
                            if (selected) {
                              new Audio(selected.url).play().catch(() => {});
                            }
                          }}
                        >
                          Testar
                        </button>
                      </div>
                    </div>

                    <div className={styles.soundSelectorRow}>
                      <div className={styles.optionInfo}>
                        <Bell size={16} style={{ opacity: 0.7 }} />
                        <div>
                          <p style={{ fontSize: '0.85rem' }}>Teste de Alerta Completo</p>
                          <span style={{ fontSize: '0.75rem' }}>Dispara um aviso real de teste no dashboard</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className={styles.testSoundBtn}
                        onClick={async () => {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          
                          await supabase.from('notifications').insert({
                            user_id: user.id,
                            title: '📢 Teste de Alerta Realtime!',
                            message: 'Esta é uma notificação de teste disparada a partir das configurações.',
                            read: false
                          });
                        }}
                      >
                        Disparar Alerta
                      </button>
                    </div>
                  </>
                )}
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

          {/* Lead Scoring Section */}
          {(profile?.client_id || profile?.role === 'admin') && (
            <div className={`${styles.card} glass`}>
              <div className={styles.cardHeader}>
                <SettingsIcon size={20} className={styles.icon} style={{ color: '#f1c40f' }} />
                <h3>Regras de Lead Scoring</h3>
              </div>
              <form className={styles.form} onSubmit={handleUpdateScoring}>
                <p className={styles.cardDesc} style={{ marginBottom: '1.25rem', marginTop: '-0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                  Personalize a pontuação atribuída a cada ação de engajamento do lead (máximo 100 pontos por lead).
                </p>

                {/* Seletor de Cliente para Admin */}
                {profile?.role === 'admin' && (
                  <div className={styles.field} style={{ marginBottom: '1.25rem' }}>
                    <label>Cliente Gerenciado</label>
                    {isImpersonating ? (
                      <div className={styles.inputDisabled}>
                        <span>Impersonando: <strong>{impersonatedName}</strong></span>
                      </div>
                    ) : (
                      <select
                        className={styles.clientSelectScoring}
                        value={selectedClientIdForScoring || ''}
                        onChange={(e) => setSelectedClientIdForScoring(e.target.value || null)}
                      >
                        <option value="">-- Selecione um Cliente --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Só exibe os inputs se houver um client_id selecionado */}
                {selectedClientIdForScoring ? (
                  <>
                    <div className={styles.fieldRow}>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>WhatsApp Click (Score)</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.whatsapp_score} 
                          onChange={(e) => setScoringRules({ ...scoringRules, whatsapp_score: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Tráfego Pago (UTM Ads)</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.paid_traffic} 
                          onChange={(e) => setScoringRules({ ...scoringRules, paid_traffic: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Permanência ≥ 60s</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.time_on_page_60} 
                          onChange={(e) => setScoringRules({ ...scoringRules, time_on_page_60: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Permanência ≥ 20s</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.time_on_page_20} 
                          onChange={(e) => setScoringRules({ ...scoringRules, time_on_page_20: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Scroll da Página ≥ 80%</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.scroll_depth_80} 
                          onChange={(e) => setScoringRules({ ...scoringRules, scroll_depth_80: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Scroll da Página ≥ 50%</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.scroll_depth_50} 
                          onChange={(e) => setScoringRules({ ...scoringRules, scroll_depth_50: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Jornada ≥ 3 Visitas</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.journey_3} 
                          onChange={(e) => setScoringRules({ ...scoringRules, journey_3: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                      <div className={styles.field} style={{ flex: 1 }}>
                        <label>Jornada = 2 Visitas</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={scoringRules.journey_2} 
                          onChange={(e) => setScoringRules({ ...scoringRules, journey_2: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>
                    
                    <button type="submit" className={styles.saveBtn} disabled={savingScoring} style={{ marginTop: '1rem' }}>
                      {scoringSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
                      <span>{savingScoring ? 'Salvando...' : (scoringSuccess ? 'Regras Salvas!' : 'Salvar Regras')}</span>
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                    Por favor, selecione um cliente para gerenciar as regras de lead scoring.
                  </p>
                )}
              </form>
            </div>
          )}

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
                      {securityLogs.length > 0 ? (
                        <>
                          {securityLogs
                            .slice((securityLogPage - 1) * LOGS_PER_PAGE, securityLogPage * LOGS_PER_PAGE)
                            .map(log => (
                              <div key={log.id} className={styles.activityItem}>
                                <div className={styles.activityDot} />
                                <div className={styles.activityInfo}>
                                  <p className={styles.activityAction}>{log.action}</p>
                                  <span className={styles.activityTime}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                                <ChevronRight size={16} className={styles.chevron} />
                              </div>
                            ))
                          }
                          
                          {securityLogs.length > LOGS_PER_PAGE && (
                            <div className={styles.securityPagination}>
                              <button 
                                onClick={() => setSecurityLogPage(p => Math.max(1, p - 1))}
                                disabled={securityLogPage === 1}
                                className={styles.securityPageBtn}
                              >
                                Anterior
                              </button>
                              <span className={styles.pageIndicator}>
                                {securityLogPage} / {Math.ceil(securityLogs.length / LOGS_PER_PAGE)}
                              </span>
                              <button 
                                onClick={() => setSecurityLogPage(p => Math.min(Math.ceil(securityLogs.length / LOGS_PER_PAGE), p + 1))}
                                disabled={securityLogPage === Math.ceil(securityLogs.length / LOGS_PER_PAGE)}
                                className={styles.securityPageBtn}
                              >
                                Próximo
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
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
