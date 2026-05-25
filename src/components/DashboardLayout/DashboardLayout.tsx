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

  useEffect(() => {
    // 1. Verificação de sessão assíncrona para novas abas/janelas
    const checkSession = async () => {
      const hasActiveSession = sessionStorage.getItem('asthros_session_active');
      if (!hasActiveSession) {
        const { data: { user } } = await supabase.auth.getUser();
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
    };
    checkSession();

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
    };
  }, []);

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_client');
    window.location.reload();
  };
  return (
    <div className={styles.layoutWrapper}>
      <Sidebar />
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
        <Header title={title} />
        <main className={styles.pageContent}>
          <div className={styles.innerWrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
