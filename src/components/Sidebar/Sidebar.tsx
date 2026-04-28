'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Webhook, 
  Settings, 
  LogOut, 
  Zap, 
  MoreHorizontal,
  ChevronDown,
  Activity,
  Box,
  Layers
} from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(true);

  const isActive = (path: string) => pathname === path;

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Clientes', path: '/clients', icon: Users },
    { name: 'Webhooks', path: '/webhooks', icon: Webhook },
  ];

  const toolsItems = [
    { name: 'Rewards', path: '/rewards', icon: Zap },
    { name: 'Activity', path: '/activity', icon: Activity },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <Box size={24} fill="currentColor" strokeWidth={1.5} />
        </div>
        <span className={styles.logoText}>Ardentis</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>Main Menu</span>
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
          <span className={styles.groupLabel}>Optimization</span>
          {toolsItems.map((item) => (
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
          <button 
            className={`${styles.navLink} ${isMoreOpen ? styles.activeGroup : ''}`}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
          >
            <div className={styles.iconCircle}>
              <Layers size={18} />
            </div>
            <span className={styles.linkText}>Uplinks</span>
            <ChevronDown size={14} className={`${styles.chevron} ${isMoreOpen ? styles.rotate : ''}`} />
          </button>

          {isMoreOpen && (
            <div className={styles.subMenu}>
              <Link href="/lock" className={styles.subLink}>
                <div className={styles.subDot} />
                <span>Security Node</span>
              </Link>
              <Link href="/liquidation" className={styles.subLink}>
                <div className={styles.subDot} />
                <span>Protocol Leak</span>
              </Link>
              <Link href="/audit" className={styles.subLink}>
                <div className={styles.subDot} />
                <span>Terminal Audit</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userSection}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ardentis" alt="Avatar" />
            </div>
            <div className={styles.userDetails}>
              <p className={styles.userName}>Ethan Carter</p>
              <p className={styles.userRole}>Security Engineer</p>
            </div>
          </div>
          <button className={styles.logoutBtn}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
