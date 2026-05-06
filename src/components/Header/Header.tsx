'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Search, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';
import { supabase } from '@/lib/supabase';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
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
    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.read).length);
        }
      }
    }
    loadNotifications();

    // Realtime subscription
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
          setNotifications(prev => [newNotif, ...prev].slice(0, 5));
          setUnreadCount(prev => prev + 1);
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
          <button className={styles.actionBtn} onClick={handleLogout} title="Sair do Sistema">
            <LogOut size={20} />
          </button>
          
          <div className={styles.notifWrapper}>
            <button className={styles.actionBtn} onClick={() => setIsNotifOpen(!isNotifOpen)}>
              <Bell size={20} />
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div className={`${styles.notifPanel} glass`}>
                <div className={styles.notifHeader}>
                  <h4>Notificações</h4>
                  <button onClick={markAllAsRead}>Limpar todas</button>
                </div>
                <div className={styles.notifList}>
                  {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`${styles.notifItem} ${n.read ? '' : styles.unread}`}>
                      <div className={styles.notifContent}>
                        <p className={styles.notifTitle}>{n.title}</p>
                        <p className={styles.notifMsg}>{n.message}</p>
                        <span className={styles.notifTime}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )) : (
                    <div className={styles.emptyNotif}>Nenhuma notificação nova</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.profile}>
          <div className={styles.profileInfo}>
            <span className={styles.name}>{user?.email?.split('@')[0] || 'Usuário'}</span>
            <span className={styles.id}>{user?.email || 'Carregando...'}</span>
          </div>
          <div className={styles.avatar}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'default'}`} alt="Avatar" />
          </div>
        </div>
      </div>
    </header>
  );
}
