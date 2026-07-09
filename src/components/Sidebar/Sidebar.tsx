'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Webhook, 
  Settings, 
  Activity,
  History,
  ShieldCheck,
  UserCircle,
  Database,
  ChevronDown,
  FileText,
  Terminal,
  Tv,
  X,
  Plug,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isOpen, onClose, isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role') === 'admin';
    }
    return false;
  });
  const [user, setUser] = useState<any>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      if (currentUser) {
        setUser(currentUser);
        const cachedRole = localStorage.getItem('user_role');
        setIsAdmin(cachedRole === 'admin');
      }
    }
    loadUser();

    const impersonated = localStorage.getItem('impersonated_client');
    setIsImpersonating(!!impersonated);
  }, []);

  // Heartbeat para status Online
  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      await supabase
        .from('system_users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('email', user.email);
    };

    updateActivity();
    const interval = setInterval(updateActivity, 120000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (pathname.startsWith('/clients')) {
      setIsClientsOpen(true);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;
  const [isClientsOpen, setIsClientsOpen] = useState(false);

  const menuItems = [
    { name: 'Geral', path: '/', icon: LayoutDashboard },
    { 
      name: 'Clientes', 
      path: '/clients', 
      icon: Users
    },
    { name: 'Leads', path: '/leads', icon: Database },
    { name: 'Relatórios', path: '/reports', icon: FileText },
    { name: 'Webhooks', path: '/webhooks', icon: Webhook },
    { name: 'Integrações', path: '/integrations', icon: Plug },
    { name: 'Uptime', path: '/uptime', icon: Activity },
  ].filter(item => {
    if (item.name === 'Integrações' && !isAdmin) {
      return false;
    }
    if (item.name === 'Uptime' && !isAdmin) {
      return false;
    }
    if (isImpersonating) {
      return ['Geral', 'Leads', 'Integrações', 'Uptime'].includes(item.name);
    }
    return true;
  });

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={`${styles.logoContainer} ${isCollapsed ? styles.logoContainerCollapsed : ''}`}>
        <div className={styles.logoIcon}>
          <img 
            src={isCollapsed ? "/asthros-favicon.png" : "/asthros-leads.png"} 
            alt="Asthros Logo" 
            className={isCollapsed ? styles.logoImgCollapsed : styles.logoImg} 
          />
        </div>
        
        {/* Botão de Toggle para Desktop */}
        {onToggle && (
          <button 
            className={styles.sidebarToggleBtn} 
            onClick={onToggle} 
            aria-label={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        {onClose && (
          <button className={styles.sidebarCloseBtn} onClick={onClose} aria-label="Fechar Menu">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className={styles.nav}>
        <div className={styles.group}>
          {!isCollapsed && <span className={styles.groupLabel}>Monitoramento</span>}
          {menuItems.map((item) => {
            if (item.submenu) {
              const hasActiveSub = item.submenu.some(sub => isActive(sub.path));
              return (
                <div key={item.name} className={styles.menuItemGroup}>
                  <button 
                    className={`${styles.navLink} ${(hasActiveSub || isClientsOpen) ? styles.active : ''} ${isCollapsed ? styles.navLinkCollapsed : ''}`}
                    onClick={() => setIsClientsOpen(!isClientsOpen)}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className={styles.iconCircle}>
                      <item.icon size={18} />
                    </div>
                    {!isCollapsed && <span className={styles.linkText}>{item.name}</span>}
                    {!isCollapsed && <ChevronDown size={14} className={`${styles.chevron} ${isClientsOpen ? styles.rotated : ''}`} />}
                  </button>
                  
                  {isClientsOpen && !isCollapsed && (
                    <div className={styles.submenu}>
                      {item.submenu.map(sub => (
                        <Link 
                          key={sub.path} 
                          href={sub.path}
                          prefetch={false}
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
                prefetch={false}
                className={`${styles.navLink} ${isActive(item.path) ? styles.active : ''} ${isCollapsed ? styles.navLinkCollapsed : ''}`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className={styles.iconCircle}>
                  <item.icon size={18} />
                </div>
                {!isCollapsed && <span className={styles.linkText}>{item.name}</span>}
              </Link>
            );
          })}
        </div>

        <div className={styles.group}>
          {!isCollapsed && <span className={styles.groupLabel}>Sistema</span>}
          {isAdmin && !isImpersonating && (
            <>
              <Link 
                href="/admin/logs" 
                prefetch={false} 
                className={`${styles.navLink} ${isActive('/admin/logs') ? styles.active : ''} ${isCollapsed ? styles.navLinkCollapsed : ''}`}
                title={isCollapsed ? "Auditoria" : undefined}
              >
                <div className={styles.iconCircle}>
                  <History size={18} />
                </div>
                {!isCollapsed && <span className={styles.linkText}>Auditoria</span>}
              </Link>
              <Link 
                href="/users" 
                prefetch={false} 
                className={`${styles.navLink} ${isActive('/users') ? styles.active : ''} ${isCollapsed ? styles.navLinkCollapsed : ''}`}
                title={isCollapsed ? "Usuários" : undefined}
              >
                <div className={styles.iconCircle}>
                  <UserCircle size={18} />
                </div>
                {!isCollapsed && <span className={styles.linkText}>Usuários</span>}
              </Link>
            </>
          )}
          <Link 
            href="/settings" 
            prefetch={false} 
            className={`${styles.navLink} ${isCollapsed ? styles.navLinkCollapsed : ''}`}
            title={isCollapsed ? "Configurações" : undefined}
          >
            <div className={styles.iconCircle}>
              <Settings size={18} />
            </div>
            {!isCollapsed && <span className={styles.linkText}>Configurações</span>}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
