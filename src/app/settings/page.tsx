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
  Volume2
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
                    <span>Autenticação em duas etapas</span>
                  </div>
                </div>
                <button className={styles.actionLink}>Configurar</button>
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
    </DashboardLayout>
  );
}
