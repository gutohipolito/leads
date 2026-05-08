'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Webhook, 
  Settings, 
  LogOut, 
  Activity,
  Box,
  Terminal,
  ShieldCheck,
  UserCircle,
  Database,
  ChevronDown,
  History,
  FileText
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { supabase } from '@/lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from('system_users')
          .select('role')
          .eq('email', user.email)
          .single();
        
        setIsAdmin(profile?.role === 'admin');
      }
    }
    loadUser();

    // Checar se está impersonando
    const impersonated = localStorage.getItem('impersonated_client');
    setIsImpersonating(!!impersonated);
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/clients')) {
      setIsClientsOpen(true);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [isClientsOpen, setIsClientsOpen] = useState(false);

  const menuItems = [
    { name: 'Geral', path: '/', icon: LayoutDashboard },
    { 
      name: 'Clientes', 
      path: '/clients', 
      icon: Users,
      submenu: [
        { name: 'Listagem', path: '/clients' },
        { name: 'Novo Cadastro', path: '/clients?action=new' },
      ]
    },
    { name: 'Leads', path: '/leads', icon: Database },
    { name: 'Relatórios', path: '/reports', icon: FileText },
    { name: 'Webhooks', path: '/webhooks', icon: Webhook },
    { name: 'Simulador', path: '/simulator', icon: Terminal },
  ].filter(item => {
    // Se estiver impersonando, removemos Clientes, Webhooks (opcional) e Simulador
    if (isImpersonating) {
      return ['Geral', 'Leads'].includes(item.name);
    }
    return true;
  });

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <img src="/asthros-leads.png" alt="Asthros Logo" className={styles.logoImg} />
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>Monitoramento</span>
          {menuItems.map((item) => {
            // Se o item tiver submenu, tratamos como accordion
            if (item.submenu) {
              const hasActiveSub = item.submenu.some(sub => isActive(sub.path));
              return (
                <div key={item.name} className={styles.menuItemGroup}>
                  <button 
                    className={`${styles.navLink} ${(hasActiveSub || isClientsOpen) ? styles.active : ''}`}
                    onClick={() => setIsClientsOpen(!isClientsOpen)}
                  >
                    <div className={styles.iconCircle}>
                      <item.icon size={18} />
                    </div>
                    <span className={styles.linkText}>{item.name}</span>
                    <ChevronDown size={14} className={`${styles.chevron} ${isClientsOpen ? styles.rotated : ''}`} />
                  </button>
                  
                  {isClientsOpen && (
                    <div className={styles.submenu}>
                      {item.submenu.map(sub => (
                        <Link 
                          key={sub.path} 
                          href={sub.path}
                          className={`${styles.subLink} ${isActive(sub.path) ? styles.subActive : ''}`}
                        >
                          <div className={styles.subDot} />
                          <span>{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`${styles.navLink} ${isActive(item.path) ? styles.active : ''}`}
              >
                <div className={styles.iconCircle}>
                  <item.icon size={18} />
                </div>
                <span className={styles.linkText}>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Sistema</span>
          {isAdmin && !isImpersonating && (
            <>
              <Link href="/admin/logs" className={`${styles.navLink} ${isActive('/admin/logs') ? styles.active : ''}`}>
                <div className={styles.iconCircle}>
                  <History size={18} />
                </div>
                <span className={styles.linkText}>Auditoria de Sinais</span>
              </Link>
              <Link href="/users" className={`${styles.navLink} ${isActive('/users') ? styles.active : ''}`}>
                <div className={styles.iconCircle}>
                  <UserCircle size={18} />
                </div>
                <span className={styles.linkText}>Usuários</span>
              </Link>
              <Link href="/security" className={`${styles.navLink} ${isActive('/security') ? styles.active : ''}`}>
                <div className={styles.iconCircle}>
                  <ShieldCheck size={18} />
                </div>
                <span className={styles.linkText}>Segurança</span>
              </Link>
            </>
          )}
          <Link href="/settings" className={styles.navLink}>
            <div className={styles.iconCircle}>
              <Settings size={18} />
            </div>
            <span className={styles.linkText}>Configurações</span>
          </Link>
        </div>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'default'}`} alt="Avatar" />
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{user?.email?.split('@')[0] || 'Usuário'}</p>
            <p className={styles.userRole}>{isAdmin ? 'Acesso Total' : 'Cliente'}</p>
          </div>
          <button className={styles.logoutBtn} title="Sair" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

