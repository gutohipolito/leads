import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Webhook, BarChart3, Settings, LogOut, ChevronRight } from 'lucide-react';
import styles from './Sidebar.module.css';
import { mockClients } from '@/lib/store';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>A</div>
        <span className={styles.logoText}>Asthros Leads</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>Principal</span>
          <Link href="/" className={styles.navLink}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link href="/clients" className={styles.navLink}>
            <Users size={20} />
            <span>Clientes</span>
          </Link>
          <Link href="/webhooks" className={styles.navLink}>
            <Webhook size={20} />
            <span>Webhooks</span>
          </Link>
        </div>

        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>Clientes Ativos</span>
          <div className={styles.clientList}>
            {mockClients.map(client => (
              <Link key={client.id} href={`/dashboard/${client.id}`} className={styles.clientLink}>
                <div className={styles.clientDot} />
                <span>{client.name}</span>
                <ChevronRight size={14} className={styles.chevron} />
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>Sistema</span>
          <Link href="/settings" className={styles.navLink}>
            <Settings size={20} />
            <span>Configurações</span>
          </Link>
        </div>
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn}>
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
