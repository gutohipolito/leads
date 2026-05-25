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
    let verificationChannel: BroadcastChannel | null = null;

    // 1. Setup do Realtime Presence caso haja usuário autenticado e verificação de abas
    const checkSessionAndSetupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Se temos o usuário autenticado
      if (user) {
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
            // Outra aba está ativa, então esta sessão é válida nesta nova aba
            sessionStorage.setItem('asthros_session_active', 'true');
          } else {
            // Nenhuma outra aba ativa respondeu (navegador foi fechado e reaberto)
            // Desloga o usuário e limpa o banco
            await fetch('/api/auth/offline', { method: 'POST' });
            await supabase.auth.signOut();
            window.location.href = '/login';
            return;
          }
        }

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
