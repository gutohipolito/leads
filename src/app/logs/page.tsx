'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './logs.module.css';
import { 
  Activity, 
  Search, 
  Filter, 
  Clock, 
  ShieldAlert, 
  User as UserIcon,
  Database,
  Webhook
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import { useRouter } from 'next/navigation';

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      
      // Validar se o usuário é admin de forma síncrona/instantânea
      const cachedRole = localStorage.getItem('user_role');
      if (cachedRole !== 'admin') {
        router.push('/');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('system_logs')
        .select('*, system_users!user_id(name)')
        .order('created_at', { ascending: false })
        .limit(500); // Limita os logs para evitar lentidão no frontend
      
      if (data) setLogs(data);
      setLoading(false);
    }
    fetchLogs();
  }, [router]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entity || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    if (!matchesSearch) return false;
    if (dateFilter === 'all') return true;

    const createdDate = new Date(log.created_at);
    const now = new Date();

    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return createdDate >= today;
    }
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return createdDate >= sevenDaysAgo;
    }
    if (dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdDate >= startOfMonth;
    }
    if (dateFilter === 'custom') {
      let match = true;
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00');
        match = match && createdDate >= start;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59');
        match = match && createdDate <= end;
      }
      return match;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Resetar página ao buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getEntityIcon = (entity: string) => {
    switch(entity) {
      case 'client': return <UserIcon size={16} />;
      case 'lead': return <Database size={16} />;
      case 'webhook': return <Webhook size={16} />;
      default: return <Activity size={16} />;
    }
  };

  return (
    <DashboardLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.searchBar}>
            <Search size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por ação ou entidade..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.statusBadge}>
            <ShieldAlert size={16} />
            <span>Monitoramento Ativo</span>
          </div>
        </div>

        <div className={styles.filtersBar}>
          <div className={styles.filterField}>
            <label>Período de Ações</label>
            <select 
              className={styles.filterInput}
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
            >
              <option value="all">Sempre</option>
              <option value="today">Hoje</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="month">Este mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {dateFilter === 'custom' && (
            <>
              <div className={styles.filterField}>
                <label>Data Inicial</label>
                <input 
                  type="date" 
                  className={styles.filterInput}
                  value={customStartDate}
                  onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <div className={styles.filterField}>
                <label>Data Final</label>
                <input 
                  type="date" 
                  className={styles.filterInput}
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </>
          )}
        </div>

        {loading ? (
          <Loader text="Auditando Registros" />
        ) : (
          <div className={styles.logsList}>
            {paginatedLogs.length > 0 ? paginatedLogs.map(log => (
              <div key={log.id} className={`${styles.logItem} glass`}>
                <div className={styles.logLeft}>
                  <div className={`${styles.iconBox} ${styles[log.entity] || ''}`}>
                    {getEntityIcon(log.entity)}
                  </div>
                  <div className={styles.logMain}>
                    <p className={styles.logAction}>{log.action}</p>
                    <div className={styles.logMeta}>
                      <span>{log.entity ? `Entidade: ${log.entity}` : 'Sistema'}</span>
                      <span className={styles.dot}>•</span>
                      <span>ID: {log.entity_id || 'N/A'}</span>
                      <span className={styles.dot}>•</span>
                      <span className={styles.userTag}>Por: {log.system_users?.name || 'Sistema'}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.logRight}>
                  <div className={styles.logTime}>
                    <Clock size={14} />
                    <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className={styles.ipTag}>{log.ip_address || 'Internal'}</div>
                </div>
              </div>
            )) : (
              <div className={styles.emptyState}>
                <Activity size={48} strokeWidth={1} />
                <p>Nenhum log de auditoria encontrado.</p>
              </div>
            )}
          </div>
        )}

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </div>
            <div className={styles.pageControls}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
