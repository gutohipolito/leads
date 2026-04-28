'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './settings.module.css';
import { 
  User, 
  Monitor, 
  Bell, 
  Info, 
  Camera, 
  CheckCircle2, 
  Globe, 
  Mail,
  Smartphone,
  Shield
} from 'lucide-react';

type SettingsTab = 'profile' | 'interface' | 'notifications' | 'about';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [notifications, setNotifications] = useState({
    newLead: true,
    weeklyReport: false,
    securityAlert: true,
    webhookFail: true
  });

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <DashboardLayout title="Configurações">
      <div className={styles.container}>
        
        <div className={styles.settingsGrid}>
          {/* Navigation Menu */}
          <aside className={styles.menu}>
            <button 
              className={`${styles.menuBtn} ${activeTab === 'profile' ? styles.activeMenu : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} />
              <span>Perfil</span>
            </button>
            <button 
              className={`${styles.menuBtn} ${activeTab === 'interface' ? styles.activeMenu : ''}`}
              onClick={() => setActiveTab('interface')}
            >
              <Monitor size={18} />
              <span>Interface</span>
            </button>
            <button 
              className={`${styles.menuBtn} ${activeTab === 'notifications' ? styles.activeMenu : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} />
              <span>Notificações</span>
            </button>
            <button 
              className={`${styles.menuBtn} ${activeTab === 'about' ? styles.activeMenu : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <Info size={18} />
              <span>Sobre o Sistema</span>
            </button>
          </aside>

          {/* Content Area */}
          <main className={styles.content}>
            
            {activeTab === 'profile' && (
              <section className={`${styles.sectionCard} glass`}>
                <div className={styles.sectionHeader}>
                  <h3>Perfil do Usuário</h3>
                  <p>Gerencie suas informações pessoais e credenciais.</p>
                </div>

                <div className={styles.profileHeader}>
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatarLarge}>
                      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Avatar" />
                    </div>
                    <button className={styles.changePhoto}>
                      <Camera size={14} />
                    </button>
                  </div>
                  <div className={styles.profileText}>
                    <h4 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Administrador</h4>
                    <p style={{ color: 'var(--muted-foreground)' }}>administrador@asthros.com</p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label>Nome Completo</label>
                    <input type="text" defaultValue="Administrador Master" />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>E-mail</label>
                    <input type="email" defaultValue="admin@asthros.com" />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Cargo</label>
                    <input type="text" defaultValue="Diretor de Tecnologia" />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Idioma</label>
                    <input type="text" defaultValue="Português (Brasil)" disabled />
                  </div>
                </div>

                <div className={styles.saveActions}>
                  <button className={styles.cancelBtn}>Descartar</button>
                  <button className={styles.saveBtn}>Salvar Alterações</button>
                </div>
              </section>
            )}

            {activeTab === 'notifications' && (
              <section className={`${styles.sectionCard} glass`}>
                <div className={styles.sectionHeader}>
                  <h3>Notificações</h3>
                  <p>Escolha como e quando deseja ser alertado.</p>
                </div>

                <div className={styles.eventList}>
                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Novos Leads</h4>
                      <p>Receber alerta instantâneo para cada nova captura.</p>
                    </div>
                    <div 
                      className={`${styles.toggle} ${notifications.newLead ? styles.on : ''}`}
                      onClick={() => toggleNotif('newLead')}
                    >
                      <div className={styles.toggleDot} />
                    </div>
                  </div>

                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Falhas de Uplink</h4>
                      <p>Alertar imediatamente se um Webhook retornar erro.</p>
                    </div>
                    <div 
                      className={`${styles.toggle} ${notifications.webhookFail ? styles.on : ''}`}
                      onClick={() => toggleNotif('webhookFail')}
                    >
                      <div className={styles.toggleDot} />
                    </div>
                  </div>

                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Alertas de Segurança</h4>
                      <p>Notificar sobre novos logins e bloqueios de IP.</p>
                    </div>
                    <div 
                      className={`${styles.toggle} ${notifications.securityAlert ? styles.on : ''}`}
                      onClick={() => toggleNotif('securityAlert')}
                    >
                      <div className={styles.toggleDot} />
                    </div>
                  </div>

                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Relatório Semanal</h4>
                      <p>Enviar resumo de performance por e-mail toda segunda-feira.</p>
                    </div>
                    <div 
                      className={`${styles.toggle} ${notifications.weeklyReport ? styles.on : ''}`}
                      onClick={() => toggleNotif('weeklyReport')}
                    >
                      <div className={styles.toggleDot} />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'interface' && (
              <section className={`${styles.sectionCard} glass`}>
                <div className={styles.sectionHeader}>
                  <h3>Aparência</h3>
                  <p>Personalize a experiência visual do seu painel.</p>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label>Tema Padrão</label>
                    <input type="text" defaultValue="Dark (DeFi Sleek)" disabled />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Densidade do Layout</label>
                    <input type="text" defaultValue="Confortável" />
                  </div>
                </div>

                <div className={styles.notificationItem}>
                  <div className={styles.notifInfo}>
                    <h4>Animações de Transição</h4>
                    <p>Habilitar efeitos de fade e slide entre as páginas.</p>
                  </div>
                  <div className={`${styles.toggle} ${styles.on}`}>
                    <div className={styles.toggleDot} />
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'about' && (
              <section className={`${styles.sectionCard} glass`}>
                <div className={styles.sectionHeader}>
                  <h3>Informações do Sistema</h3>
                  <p>Detalhes técnicos e versão da plataforma.</p>
                </div>

                <div className={styles.eventList}>
                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Versão do Software</h4>
                      <p>v4.2.0 (Stable Build)</p>
                    </div>
                    <CheckCircle2 size={20} color="#10b981" />
                  </div>

                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Status do Servidor</h4>
                      <p>Operando normalmente (Latência: 12ms)</p>
                    </div>
                    <div className={styles.activeStatus} style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                  </div>

                  <div className={styles.notificationItem}>
                    <div className={styles.notifInfo}>
                      <h4>Ambiente de Execução</h4>
                      <p>Cloudflare Edge Workers / Next.js SSR</p>
                    </div>
                    <Shield size={20} color="var(--primary)" />
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>

      </div>
    </DashboardLayout>
  );
}
