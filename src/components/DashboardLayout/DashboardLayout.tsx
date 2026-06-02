'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './DashboardLayout.module.css';
import { supabase } from '@/lib/supabase';
import Loader from '../Loader/Loader';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
}

export default function DashboardLayout({ children, title = '' }: DashboardLayoutProps) {
  const [impersonatedClient, setImpersonatedClient] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let activeChannel: any = null;
    let verificationChannel: BroadcastChannel | null = null;

    const checkSessionAndSetup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user_role');
          localStorage.removeItem('user_avatar_style');
          localStorage.removeItem('user_password_changed');
          localStorage.removeItem('user_client_id');
          localStorage.removeItem('impersonated_client');
        }
        window.location.href = '/login';
        return;
      }

      setHasUser(true);

      // Verificação de sessão inter-abas para logout automático ao fechar o navegador
      const hasActiveSession = sessionStorage.getItem('asthros_session_active');

      if (!hasActiveSession) {
        let receivedPong = false;
        let tempChannel: BroadcastChannel | null = null;

        if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
          tempChannel = new BroadcastChannel('asthros_session_verification');
          tempChannel.onmessage = (event) => {
            if (event.data === 'pong') {
              receivedPong = true;
            }
          };
          tempChannel.postMessage('ping');
        }

        // Aguarda 150ms pela resposta das outras abas
        await new Promise((resolve) => setTimeout(resolve, 150));

        if (tempChannel) {
          tempChannel.close();
        }

        if (receivedPong) {
          sessionStorage.setItem('asthros_session_active', 'true');
        } else {
          // Nenhuma outra aba ativa respondeu (navegador foi fechado e reaberto)
          await fetch('/api/auth/offline', { method: 'POST' });
          await supabase.auth.signOut();
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_avatar_style');
            localStorage.removeItem('user_password_changed');
            localStorage.removeItem('user_client_id');
            localStorage.removeItem('impersonated_client');
          }
          window.location.href = '/login';
          return;
        }
      }

      // Sessão validada
      setLoading(false);

      // Busca de perfil em background
      fetchProfileInBackground(user.email!);

      // Criar o canal de Realtime Presence do Supabase
      const channel = supabase.channel('online_users', {
        config: {
          presence: {
            key: user.email,
          },
        },
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

      activeChannel = channel;
    };

    const fetchProfileInBackground = async (email: string) => {
      try {
        const { data: profile } = await supabase
          .from('system_users')
          .select('role, avatar_style, password_changed, client_id')
          .eq('email', email)
          .single();
        
        if (profile) {
          localStorage.setItem('user_role', profile.role || 'user');
          localStorage.setItem('user_avatar_style', profile.avatar_style || 'avataaars');
          localStorage.setItem('user_password_changed', String(profile.password_changed ?? true));
          localStorage.setItem('user_client_id', profile.client_id || '');
        }
      } catch (e) {
        console.error('Erro ao atualizar perfil em background:', e);
      }
    };

    checkSessionAndSetup();

    // 2. Ouvinte global para responder a pings de outras abas
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      verificationChannel = new BroadcastChannel('asthros_session_verification');
      verificationChannel.onmessage = (event) => {
        if (event.data === 'ping') {
          const isSelfActive = sessionStorage.getItem('asthros_session_active') === 'true';
          if (isSelfActive && verificationChannel) {
            verificationChannel.postMessage('pong');
          }
        }
      };
    }

    const saved = localStorage.getItem('impersonated_client');
    if (saved) {
      setImpersonatedClient(JSON.parse(saved));
    }

    return () => {
      if (verificationChannel) {
        verificationChannel.close();
      }
      if (activeChannel) {
        activeChannel.unsubscribe();
      }
    };
  }, []);

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_client');
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--background)',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}>
        <Loader text="Verificando autenticação..." />
      </div>
    );
  }

  return (
    <div className={styles.layoutWrapper}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className={styles.mainContainer}>
        {impersonatedClient && (
          <div className={styles.impersonationBanner}>
            <div className={styles.bannerContent}>
              <UserCheck size={18} />
              <span>Você está visualizando o painel de <strong>{impersonatedClient.name}</strong></span>
            </div>
            <button className={styles.stopBtn} onClick={stopImpersonating}>
              <span>Sair do Modo de Visualização</span>
              <X size={16} />
            </button>
          </div>
        )}
        <Header title={title} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className={styles.pageContent}>
          <div className={styles.innerWrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
