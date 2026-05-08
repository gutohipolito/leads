'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './logs.module.css';
import { 
  History, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Info,
  Clock,
  Database,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const { data, error } = await supabase
        .from('webhook_logs')
        .select(`
          *,
          webhooks (name),
          clients (name)
        `)
        .order('created_at', { ascending: false });

      if (data) setLogs(data);
      setLoading(false);
    }
    loadLogs();
  }, []);

  const totalPages = Math.ceil(logs.length / pageSize);
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) return <DashboardLayout title="Auditoria"><Loader text="Sincronizando Registros..." /></DashboardLayout>;

  return (
    <DashboardLayout title="Auditoria">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <CheckCircle2 size={18} className={styles.successIcon} />
              <span>{logs.filter(l => l.status_code >= 200 && l.status_code < 300).length} Sucessos</span>
            </div>
            <div className={styles.statItem}>
              <XCircle size={18} className={styles.errorIcon} />
              <span>{logs.filter(l => l.status_code >= 400 || l.error_message).length} Falhas</span>
            </div>
          </div>
        </div>

        <div className={`${styles.tableWrapper} glass`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Cliente / Terminal</th>
                <th>Evento</th>
                <th>Data / Hora</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map(log => (
                <tr key={log.id}>
                  <td>
                    <div className={`${styles.statusBadge} ${log.status_code < 300 ? styles.success : styles.error}`}>
                      {log.status_code < 300 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{log.status_code}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.clientInfo}>
                      <strong>{log.clients?.name}</strong>
                      <span>{log.webhooks?.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.eventInfo}>
                      <Database size={14} />
                      <span>{log.error_message ? 'Erro de Repasse' : 'Lead Processado'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.timeInfo}>
                      <Clock size={14} />
                      <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </td>
                  <td>
                    <button className={styles.detailBtn} onClick={() => alert(JSON.stringify(log.request_body, null, 2))}>
                      <Terminal size={16} />
                      <span>Ver JSON</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <span>Página {currentPage} de {totalPages}</span>
            <div className={styles.pageActions}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
