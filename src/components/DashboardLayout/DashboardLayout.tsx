import React from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className={styles.layoutWrapper}>
      <Sidebar />
      <div className={styles.mainContainer}>
        <Header title={title} />
        <main className={styles.pageContent}>
          <div className={styles.innerWrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
