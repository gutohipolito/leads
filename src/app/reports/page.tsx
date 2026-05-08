'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './reports.module.css';
import { 
  FileText, 
  FileJson, 
  Table as TableIcon, 
  Clock, 
  Users, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Search,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import Link from 'next/link';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('system_users').select('role').eq('email', user.email).single();
      const isUserAdmin = profile?.role === 'admin';
      setIsAdmin(isUserAdmin);

      let query = supabase
        .from('system_logs')
        .select('*')
        .eq('action', 'Exportação Realizada')
        .order('created_at', { ascending: false });

      if (!isUserAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;

      if (data) {
        const formatted = data.map(log => ({
          id: log.id,
          created_at: log.created_at,
          format: log.details?.format || 'unknown',
          count: log.details?.count || 0,
          protected: log.details?.protected || false,
          password: log.details?.password || null,
          user_id: log.user_id
        }));
        setReports(formatted);
      }
      setLoading(false);
    }
    loadReports();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(reports.length / pageSize);
  const paginatedReports = reports.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf': return <FileText size={18} />;
      case 'csv': return <TableIcon size={18} />;
      case 'json': return <FileJson size={18} />;
      default: return <FileText size={18} />;
    }
  };

  if (loading) return <DashboardLayout title="Registro de Relatórios"><Loader text="Recuperando Histórico de Exportações..." /></DashboardLayout>;

  return (
    <DashboardLayout title="Registro de Relatórios">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Histórico de Exportações</h1>
            <p>Registro completo de todos os relatórios gerados e senhas aplicadas.</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.countBadge}>
              {reports.length} Relatórios Totais
            </div>
            <Link href="/leads" className={styles.generateBtn}>
              <Plus size={18} />
              <span>Gerar Relatório</span>
            </Link>
          </div>
        </div>

        <div className={`${styles.tableWrapper} glass`}>
          {reports.length === 0 ? (
            <div className={styles.noData}>
              <Search size={48} />
              <h3>Nenhum relatório encontrado</h3>
              <p>Os relatórios que você gerar aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Formato</th>
                    <th>Volume Leads</th>
                    <th>Segurança</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map(report => (
                    <tr key={report.id}>
                      <td>
                        <div className={styles.timeInfo}>
                          <span>{new Date(report.created_at).toLocaleDateString('pt-BR')}</span>
                          <span>{new Date(report.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td>
                        <div className={`${styles.formatBadge} ${styles[report.format.toLowerCase()]}`}>
                          {getFormatIcon(report.format)}
                          <span>{report.format}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.countInfo}>
                          <Users size={14} color="#56d7fd" />
                          <span>{report.count} Leads</span>
                        </div>
                      </td>
                      <td>
                        <div className={`${styles.securityBadge} ${report.protected ? styles.protected : styles.unprotected}`}>
                          {report.protected ? <Lock size={14} /> : <ShieldAlert size={14} />}
                          <span>{report.protected ? 'Criptografado' : 'Sem Senha'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {report.protected ? (
                            <>
                              <button 
                                className={styles.passwordBtn}
                                onClick={() => setShowPasswordId(showPasswordId === report.id ? null : report.id)}
                              >
                                {showPasswordId === report.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{showPasswordId === report.id ? (report.password || 'Indisponível') : 'Ver Senha'}</span>
                              </button>
                              
                              {showPasswordId === report.id && report.password && (
                                <button 
                                  className={styles.copyBtn}
                                  onClick={() => handleCopy(report.password, report.id)}
                                  title="Copiar Senha"
                                >
                                  {copiedId === report.id ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>Nenhuma ação</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.pagination}>
                <span>Exibindo {paginatedReports.length} de {reports.length} relatórios</span>
                <div className={styles.pageActions}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft size={18} />
                  </button>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
