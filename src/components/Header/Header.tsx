import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      
      <div className={styles.actions}>
        <div className={styles.searchBar}>
          <Search size={18} />
          <input type="text" placeholder="Pesquisar leads..." />
        </div>
        
        <button className={styles.iconBtn}>
          <Bell size={20} />
          <span className={styles.badge} />
        </button>
        
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            <User size={20} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Gustavo</span>
            <span className={styles.userRole}>Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
