import React, { useState, useEffect } from 'react';
import { UserCheck, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [impersonatedClient, setImpersonatedClient] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('impersonated_client');
    if (saved) {
      setImpersonatedClient(JSON.parse(saved));
    }
  }, []);

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_client');
    window.location.reload();
  };
  return (
    <div className={styles.layoutWrapper}>
      <Sidebar />
      <div className={styles.mainContainer}>
        {impersonatedClient && (
          <div className={styles.impersonationBanner}>
            <div className={styles.bannerContent}>
              <UserCheck size={18} />
              <span>Você está visualizando o painel de <strong>{impersonatedClient.name}</strong></span>
            </div>
            <button className={styles.stopBtn} onClick={stopImpersonating}>
              <span>Sair do Modo de Visualização</span>
              <X size={16} />
            </button>
          </div>
        )}
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
