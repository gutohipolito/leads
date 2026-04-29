'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Database
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { currentUser } from '@/lib/store';

export default function Sidebar() {
  const pathname = usePathname();
  const isAdmin = currentUser.role === 'admin';

  const isActive = (path: string) => pathname === path;

  const menuItems = [
    { name: 'Geral', path: '/', icon: LayoutDashboard },
    { name: 'Clientes', path: '/clients', icon: Users },
    { name: 'Leads', path: '/leads', icon: Database },
    { name: 'Webhooks', path: '/webhooks', icon: Webhook },
    { name: 'Simulador', path: '/simulator', icon: Terminal },
  ];

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
          {menuItems.map((item) => (
            (!isAdmin && item.path === '/clients') ? null : (
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
            )
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Sistema</span>
          {isAdmin && (
            <>
              <Link href="/logs" className={styles.navLink}>
                <div className={styles.iconCircle}>
                  <Activity size={18} />
                </div>
                <span className={styles.linkText}>Logs Globais</span>
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
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} alt="Avatar" />
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{currentUser.name}</p>
            <p className={styles.userRole}>{currentUser.role === 'admin' ? 'Acesso Total' : 'Cliente'}</p>
          </div>
          <button className={styles.logoutBtn} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
