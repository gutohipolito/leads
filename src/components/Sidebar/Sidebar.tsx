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
  Circle
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
    { name: 'Rewards', path: '/rewards', icon: Zap },
  ];

  const subMenuItems = [
    { name: 'Lock Vetoken', path: '/lock' },
    { name: 'Liquidation', path: '/liquidation' },
    { name: 'Audit', path: '/audit' },
    { name: 'Done', path: '/done' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" fill="currentColor" fillOpacity="0.3"/>
            <path d="M12 22L12 12L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 12L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className={styles.logoText}>Ardentis</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.mainMenu}>
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`${styles.navLink} ${isActive(item.path) ? styles.active : ''}`}
            >
              <div className={styles.iconWrapper}>
                <item.icon size={18} />
              </div>
              <span>{item.name}</span>
            </Link>
          ))}

          {/* "More" Menu with Sub-items */}
          <div className={styles.moreContainer}>
            <button 
              className={`${styles.navLink} ${isMoreOpen ? styles.activeMore : ''}`}
              onClick={() => setIsMoreOpen(!isMoreOpen)}
            >
              <div className={styles.iconWrapper}>
                <MoreHorizontal size={18} />
              </div>
              <span>More</span>
              <ChevronDown size={14} className={`${styles.chevron} ${isMoreOpen ? styles.rotate : ''}`} />
            </button>

            {isMoreOpen && (
              <div className={styles.subMenu}>
                <div className={styles.subLine} />
                {subMenuItems.map((sub) => (
                  <Link key={sub.path} href={sub.path} className={styles.subLink}>
                    <div className={styles.subDot} />
                    <span>{sub.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan" alt="Avatar" />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Ethan Carter</span>
            <span className={styles.userPlan}>ID: 944905011UZ</span>
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
