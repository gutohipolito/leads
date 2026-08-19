'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './DashboardLayout.module.css';
import { supabase } from '@/lib/supabase';
import Loader from '../Loader/Loader';
import { decryptLead, fetchEncryptionKey } from '@/utils/frontendEncryption';
import { clearImpersonatedClientCookie } from '@/utils/impersonation';
import FunnyLeadModal from '../FunnyLeadModal/FunnyLeadModal';
import { primeAudio } from '@/utils/audio';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  /** Home: prende o layout à altura da tela; overflow fica dentro dos cards */
  lockViewport?: boolean;
}

export default function DashboardLayout({ children, title = '', lockViewport = false }: DashboardLayoutProps) {
  const [impersonatedClient, setImpersonatedClient] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeLeadNotif, setActiveLeadNotif] = useState<any>(null);
  const [activeLeadClient, setActiveLeadClient] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('asthros_sidebar_collapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!lockViewport) return;
    document.documentElement.setAttribute('data-layout', 'viewport');
    return () => {
      document.documentElement.removeAttribute('data-layout');
    };
  }, [lockViewport]);

  const toggleSidebar = () => {
    const newVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(newVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('asthros_sidebar_collapsed', String(newVal));
    }
  };

  useEffect(() => {
    // Autoriza o áudio do navegador na primeira interação do usuário (clique, toque, tecla)
    const handleFirstUserInteraction = () => {
      primeAudio();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleFirstUserInteraction, { once: true });
      window.addEventListener('keydown', handleFirstUserInteraction, { once: true });
      window.addEventListener('touchstart', handleFirstUserInteraction, { once: true });
    }

    let activeChannel: any = null;
    let verificationChannel: BroadcastChannel | null = null;
    let leadsChannel: any = null;

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
          clearImpersonatedClientCookie();
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
            clearImpersonatedClientCookie();
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

      const processedLeadIds = new Set<string>();

      const triggerFunnyModal = async (clientId: string | null, rawLead?: any, notifPayload?: any) => {
        try {
          let leadObj = rawLead;
          const targetClientId = clientId || rawLead?.client_id || notifPayload?.client_id;

          if (!leadObj && targetClientId) {
            const { data: latestLead } = await supabase
              .from('leads')
              .select('*')
              .eq('client_id', targetClientId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            leadObj = latestLead;
          }

          if (!leadObj && notifPayload) {
            leadObj = {
              name: notifPayload.title || 'Novo Lead',
              source: 'custom_tracker',
              data: {
                phone: notifPayload.message || '',
              }
            };
          }

          if (!leadObj) return;

          const dedupeKey = leadObj.id || `${notifPayload?.id || notifPayload?.title}`;
          if (dedupeKey && processedLeadIds.has(dedupeKey)) return;
          if (dedupeKey) {
            processedLeadIds.add(dedupeKey);
            setTimeout(() => processedLeadIds.delete(dedupeKey), 4000);
          }

          const key = await fetchEncryptionKey();
          let decryptedLead = leadObj;
          if (key && leadObj.data) {
            try {
              decryptedLead = await decryptLead(leadObj, key);
            } catch (decErr) {}
          }

          let clientInfo = null;
          if (targetClientId) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('name, logo_url, primary_color')
              .eq('id', targetClientId)
              .single();
            clientInfo = clientData;
          }

          setActiveLeadClient(clientInfo || { name: 'Cliente Geral' });
          setActiveLeadNotif(decryptedLead);
        } catch (e) {
          console.error('Erro ao processar FunnyLeadModal:', e);
        }
      };

      // Criar canal de Leads/Notificações em tempo real para o modal engraçado
      const channelName = `realtime-funny-${user.id}-${Math.random().toString(36).substring(2, 7)}`;
      const lChannel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'leads' },
          async (payload) => {
            const newLeadRaw = payload.new;
            if (!newLeadRaw) return;

            const cachedRole = localStorage.getItem('user_role');
            const cachedClientId = localStorage.getItem('user_client_id') || null;
            const isUserAdmin = cachedRole === 'admin';
            const impersonated = localStorage.getItem('impersonated_client');
            let activeClientId = cachedClientId;
            let isImpersonating = false;

            if (isUserAdmin && impersonated) {
              try {
                const impData = JSON.parse(impersonated);
                activeClientId = impData.id;
                isImpersonating = true;
              } catch (e) {}
            }

            const canSee = (isUserAdmin && !isImpersonating) || (newLeadRaw.client_id === activeClientId);
            if (canSee) {
              await triggerFunnyModal(newLeadRaw.client_id, newLeadRaw);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          async (payload) => {
            const newNotif = payload.new;
            if (!newNotif) return;
            if (newNotif.user_id && newNotif.user_id !== user.id) return;
            await triggerFunnyModal(newNotif.client_id || null, null, newNotif);
          }
        );
      
      lChannel.subscribe();
      leadsChannel = lChannel;
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
      if (leadsChannel) {
        supabase.removeChannel(leadsChannel);
      }
    };
  }, []);

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_client');
    clearImpersonatedClientCookie();
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
    <div
      className={`${styles.layoutWrapper} ${lockViewport ? styles.layoutWrapperViewport : ''}`}
      onPointerDown={primeAudio}
    >
      {activeLeadNotif && (
        <FunnyLeadModal 
          lead={activeLeadNotif} 
          client={activeLeadClient} 
          onClose={() => {
            setActiveLeadNotif(null);
            setActiveLeadClient(null);
          }} 
        />
      )}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <div className={`${styles.mainContainer} ${isSidebarCollapsed ? styles.mainContainerCollapsed : ''} ${lockViewport ? styles.mainContainerViewport : ''}`}>
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
        <main className={`${styles.pageContent} ${lockViewport ? styles.pageContentViewport : ''}`}>
          <div className={`${styles.innerWrapper} ${lockViewport ? styles.innerWrapperViewport : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
