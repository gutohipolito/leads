import React from 'react';
import { Bell, Search, Settings, User } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      
      <div className={styles.right}>
        <div className={styles.searchBar}>
          <Search size={18} strokeWidth={2} />
          <input type="text" placeholder="Pesquisar dados..." />
        </div>
        
        <div className={styles.actions}>
          <button className={styles.actionBtn}>
            <Settings size={20} />
          </button>
          <button className={styles.actionBtn}>
            <Bell size={20} />
            <span className={styles.badge} />
          </button>
        </div>
        
        <div className={styles.profile}>
          <div className={styles.profileInfo}>
            <span className={styles.name}>Ethan Carter</span>
            <span className={styles.id}>ID: 944905011UZ</span>
          </div>
          <div className={styles.avatar}>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan" alt="Avatar" />
          </div>
        </div>
      </div>
    </header>
  );
}
