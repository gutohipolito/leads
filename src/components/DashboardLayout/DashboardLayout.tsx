'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './DashboardLayout.module.css';
import { supabase } from '@/lib/supabase';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
}

export default function DashboardLayout({ children, title = '' }: DashboardLayoutProps) {
  const [impersonatedClient, setImpersonatedClient] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let activeChannel: any = null;

    // 1. Verificação de sessão assíncrona para novas abas/janelas e setup de Presence
    const checkSessionAndSetupPresence = async () => {
      const hasActiveSession = sessionStorage.getItem('asthros_session_active');
      const { data: { user } } = await supabase.auth.getUser();

      if (!hasActiveSession) {
        if (user) {
          // Marca o usuário como offline no banco de dados imediatamente
          await supabase
            .from('system_users')
            .update({ last_active_at: null })
            .eq('email', user.email);

          await supabase.auth.signOut();
          window.location.href = '/login';
          return;
        }
        sessionStorage.setItem('asthros_session_active', 'true');
      }

      // Se temos o usuário autenticado, configuramos o canal de presença
      if (user) {
        // Criar o canal de Realtime Presence do Supabase
        const channel = supabase.channel('online_users', {
          config: {
            presence: {
              key: user.email, // Agrupa pela chave única do e-mail do usuário
            },
          },
        });

        channel
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Envia o payload de track de presença
              await channel.track({
                email: user.email,
                online_at: new Date().toISOString(),
              });
            }
          });

        activeChannel = channel;
      }
    };
    checkSessionAndSetupPresence();

    // 2. Registro do evento de descarregamento da página para marcar offline
    const handleUnload = () => {
      fetch('/api/auth/offline', {
        method: 'POST',
        keepalive: true,
      });
    };

    window.addEventListener('pagehide', handleUnload);

    const saved = localStorage.getItem('impersonated_client');
    if (saved) {
      setImpersonatedClient(JSON.parse(saved));
    }

    return () => {
      window.removeEventListener('pagehide', handleUnload);
      if (activeChannel) {
        activeChannel.unsubscribe();
      }
    };
  }, []);

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_client');
    window.location.reload();
  };
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
