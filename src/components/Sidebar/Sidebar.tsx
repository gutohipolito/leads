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
  ShieldCheck
} from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const menuItems = [
    { name: 'Geral', path: '/', icon: LayoutDashboard },
    { name: 'Entidades', path: '/clients', icon: Users },
    { name: 'Uplink Test', path: '/webhooks', icon: Terminal },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <Box size={22} fill="currentColor" />
        </div>
        <span className={styles.logoText}>Ardentis</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>Monitoramento</span>
          {menuItems.map((item) => (
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
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Sistema</span>
          <Link href="/logs" className={styles.navLink}>
            <div className={styles.iconCircle}>
              <Activity size={18} />
            </div>
            <span className={styles.linkText}>Logs Globais</span>
          </Link>
          <Link href="/security" className={styles.navLink}>
            <div className={styles.iconCircle}>
              <ShieldCheck size={18} />
            </div>
            <span className={styles.linkText}>Segurança</span>
          </Link>
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
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Avatar" />
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>Administrador</p>
            <p className={styles.userRole}>Acesso Total</p>
          </div>
          <button className={styles.logoutBtn} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
