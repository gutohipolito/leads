'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Search, Settings, LogOut, Key, ShieldAlert, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';
import { supabase } from '@/lib/supabase';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [user, setUser] = useState<any>(null);
  const [avatarStyle, setAvatarStyle] = useState('avataaars');
  const [passwordChanged, setPasswordChanged] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from('system_users')
          .select('avatar_style, password_changed, role')
          .eq('email', user.email)
          .single();
        
        if (profile) {
          setAvatarStyle(profile.avatar_style || 'avataaars');
          setPasswordChanged(profile.password_changed ?? true);
          setIsAdmin(profile.role === 'admin');
        }
      }
    }
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission();
    }

    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.read).length);
        }
      }
    }
    loadNotifications();

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);

          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});

          if (Notification.permission === 'granted') {
            new Notification(`Asthros: ${newNotif.title}`, {
              body: newNotif.message,
              icon: '/asthros-favicon.png'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
    { label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Um caractere especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }

    const allPassed = passwordRequirements.every(req => req.test(newPassword));
    if (!allPassed) {
      alert('A senha não atende aos requisitos mínimos de segurança!');
      return;
    }

    setUpdating(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('system_users')
        .update({ password_changed: true })
        .eq('email', user.email);
      
      if (dbError) throw dbError;

      alert('Senha atualizada com sucesso!');
      setIsModalOpen(false);
      setPasswordChanged(true);
      window.location.reload();
    } catch (err: any) {
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      
      <div className={styles.right}>
        <div className={styles.searchBar}>
          <Search size={18} strokeWidth={2} />
          <input type="text" placeholder="Pesquisar dados..." />
        </div>
        
        <div className={styles.actions}>
          {!passwordChanged && !isAdmin && (
            <button 
              className={styles.passwordAlert} 
              title="Troca de senha obrigatória"
              onClick={() => setIsModalOpen(true)}
            >
              <Key size={20} />
            </button>
          )}
        </div>
        
        <div className={styles.profile}>
          <div className={styles.profileInfo}>
            <span className={styles.name}>{user?.email?.split('@')[0] || 'Usuário'}</span>
            <span className={styles.id}>{user?.email || 'Carregando...'}</span>
          </div>
          <div className={styles.avatar}>
            <img 
              src={`https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${user?.email || 'default'}`} 
              alt="Avatar" 
              style={{ animation: 'avatarBreath 4s ease-in-out infinite' }}
            />
          </div>
        </div>

        <div className={styles.notifWrapper}>
          <button className={styles.actionBtn} onClick={() => setIsNotifOpen(true)} title="Notificações">
            <Bell size={20} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>
        </div>

        <button className={styles.actionBtn} onClick={handleLogout} title="Sair do Sistema">
          <LogOut size={20} />
        </button>
      </div>

      {/* Painel Lateral de Notificações (Drawer) */}
      {isNotifOpen && (
        <div className={styles.notifOverlay} onClick={() => setIsNotifOpen(false)}>
          <div className={styles.notifDrawer} onClick={e => e.stopPropagation()}>
            <div className={styles.notifHeader}>
              <div>
                <h3>Central de Notificações</h3>
                <p>{unreadCount} novas mensagens</p>
              </div>
              <div className={styles.headerActions}>
                <button onClick={() => setIsNotifOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className={styles.notifList}>
              {notifications.length > 0 ? notifications.map(n => (
                <div key={n.id} className={`${styles.notifItem} ${n.read ? '' : styles.unread}`}>
                  <div className={styles.notifIndicator} />
                  <div className={styles.notifContent}>
                    <p className={styles.notifTitle}>{n.title}</p>
                    <p className={styles.notifMsg}>{n.message}</p>
                    <span className={styles.notifTime}>
                      <Clock size={12} />
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              )) : (
                <div className={styles.emptyNotif}>
                  <Bell size={48} strokeWidth={1} opacity={0.2} />
                  <p>Tudo limpo por aqui!</p>
                </div>
              )}
            </div>

            {unreadCount > 0 && (
              <div className={styles.notifFooter}>
                <button onClick={markAllAsRead} className={styles.clearAllBtn}>
                  Marcar tudo como lido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <ShieldAlert size={24} />
              </div>
              <h3>Segurança da Conta</h3>
              <p>Sua senha atual é provisória. Por favor, crie uma nova senha forte para continuar.</p>
            </div>

            <form onSubmit={handleUpdatePassword} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>Nova Senha</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className={styles.requirements}>
                {passwordRequirements.map((req, i) => {
                  const passed = req.test(newPassword);
                  return (
                    <div key={i} className={`${styles.reqItem} ${passed ? styles.passed : ''}`}>
                      <div className={styles.dot} />
                      <span>{req.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelBtn} 
                  onClick={() => setIsModalOpen(false)}
                  disabled={!passwordChanged}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={styles.submitBtn}
                  disabled={updating || !passwordRequirements.every(req => req.test(newPassword))}
                >
                  {updating ? 'Atualizando...' : 'Definir Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
