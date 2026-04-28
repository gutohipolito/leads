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
  Database, 
  CreditCard, 
  Zap, 
  UserPlus 
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { mockClients } from '@/lib/store';

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Zap size={24} fill="currentColor" />
        </div>
        <span className={styles.logoText}>Ardentis</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          <Link href="/" className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link href="/clients" className={`${styles.navLink} ${isActive('/clients') ? styles.active : ''}`}>
            <Users size={20} />
            <span>Clientes</span>
          </Link>
          <Link href="/webhooks" className={`${styles.navLink} ${isActive('/webhooks') ? styles.active : ''}`}>
            <Webhook size={20} />
            <span>Webhooks</span>
          </Link>
          <Link href="/rewards" className={styles.navLink}>
            <Zap size={20} />
            <span>Rewards</span>
          </Link>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Monitoramento</span>
          <div className={styles.clientList}>
            {mockClients.map(client => (
              <Link 
                key={client.id} 
                href={`/dashboard/${client.id}`} 
                className={`${styles.clientItem} ${isActive(`/dashboard/${client.id}`) ? styles.activeClient : ''}`}
              >
                <div className={styles.clientDot} />
                <span>{client.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>GC</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Gustavo</span>
            <span className={styles.userPlan}>Pro Plan</span>
          </div>
        </div>
        <button className={styles.logoutBtn}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
