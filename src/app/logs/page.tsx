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

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setLogs(data);
      setLoading(false);
    }
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entity || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEntityIcon = (entity: string) => {
    switch(entity) {
      case 'client': return <UserIcon size={16} />;
      case 'lead': return <Database size={16} />;
      case 'webhook': return <Webhook size={16} />;
      default: return <Activity size={16} />;
    }
  };

  return (
    <DashboardLayout title="Logs Globais de Auditoria">
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

        {loading ? (
          <Loader text="Auditando Registros" />
        ) : (
          <div className={styles.logsList}>
            {filteredLogs.length > 0 ? filteredLogs.map(log => (
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
      </div>
    </DashboardLayout>
  );
}
