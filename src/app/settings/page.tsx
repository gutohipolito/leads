'use client';

import { useState, useEffect } from 'react';
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
  LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [newName, setNewName] = useState('');

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
  }, []);

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
                    <span>Padrão Ultra-Premium Dark</span>
                  </div>
                </div>
                <div className={styles.toggleActive}>Ativo</div>
              </div>
              
              <div className={styles.optionItem}>
                <div className={styles.optionInfo}>
                  <Bell size={18} />
                  <div>
                    <p>Notificações de Som</p>
                    <span>Alertas sonoros para novos leads</span>
                  </div>
                </div>
                <div className={styles.toggleOff}>Desativado</div>
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
    </DashboardLayout>
  );
}
