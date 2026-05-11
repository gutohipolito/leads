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
  Plus,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [expiringReports, setExpiringReports] = useState<any[]>([]);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const pageSize = 10;

  const loadReports = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Banner visibility from localStorage
    const bannerHidden = localStorage.getItem('hide_reports_banner');
    if (bannerHidden) setShowBanner(false);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await supabase
      .from('system_logs')
      .delete()
      .eq('action', 'Exportação Realizada')
      .lt('created_at', thirtyDaysAgo.toISOString());

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

      // Check for expiring reports (27-30 days old)
      const nearExpiryDate = new Date();
      nearExpiryDate.setDate(nearExpiryDate.getDate() - 27);
      
      const expiring = formatted.filter(r => new Date(r.created_at) < nearExpiryDate);
      if (expiring.length > 0) {
        setExpiringReports(expiring);
        const modalShown = sessionStorage.getItem('expiring_modal_shown');
        if (!modalShown) {
          setIsExpiringModalOpen(true);
          sessionStorage.setItem('expiring_modal_shown', 'true');
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const triggerTestModal = () => {
    setExpiringReports([{}, {}, {}]); // Dummy data para o contador
    setIsExpiringModalOpen(true);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;

    const { error } = await supabase
      .from('system_logs')
      .delete()
      .eq('id', reportToDelete);

    if (!error) {
      setReports(prev => prev.filter(r => r.id !== reportToDelete));
    }
    setIsConfirmOpen(false);
    setReportToDelete(null);
  };

  const handleCloseBanner = () => {
    setShowBanner(false);
    localStorage.setItem('hide_reports_banner', 'true');
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
            <button 
              onClick={triggerTestModal}
              style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              TESTAR ALERTA
            </button>
            <div className={styles.countBadge}>
              {reports.length} Relatórios Totais
            </div>
            <Link href="/leads" className={styles.generateBtn}>
              <Plus size={18} />
              <span>Gerar Relatório</span>
            </Link>
          </div>
        </div>

        {showBanner && (
          <div className={styles.retentionBanner}>
            <AlertTriangle size={20} color="#f59e0b" />
            <p className={styles.retentionText}>
              <strong>Política de Retenção:</strong> <br />
              Os registros de exportação são mantidos por no máximo <strong>30 dias</strong>. Após este período, são removidos automaticamente do servidor por segurança.
            </p>
            <button className={styles.closeBanner} onClick={handleCloseBanner} title="Fechar aviso">
              <X size={18} />
            </button>
          </div>
        )}

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
                    <th style={{ textAlign: 'right' }}>Ações</th>
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
                        <div className={styles.actionsCell}>
                          {report.protected && (
                            <>
                              <button 
                                className={styles.passwordBtn}
                                onClick={() => setShowPasswordId(showPasswordId === report.id ? null : report.id)}
                              >
                                {showPasswordId === report.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{showPasswordId === report.id ? (report.password || 'Indisponível') : 'Senha'}</span>
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
                          )}
                          
                          <button 
                            className={styles.deleteBtn}
                            onClick={() => {
                              setReportToDelete(report.id);
                              setIsConfirmOpen(true);
                            }}
                            title="Excluir Registro"
                          >
                            <Trash2 size={16} />
                          </button>
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

      <ConfirmModal 
        isOpen={isConfirmOpen}
        title="Excluir Registro de Relatório"
        message="Tem certeza que deseja remover este registro do histórico? Esta ação é irreversível."
        confirmLabel="Excluir Agora"
        type="danger"
        onConfirm={handleDeleteReport}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <ConfirmModal 
        isOpen={isExpiringModalOpen}
        title="Alerta de Expiração de Relatórios"
        message={`Identificamos que ${expiringReports.length} registro(s) de exportação irão expirar e ser removidos permanentemente em até 3 dias. Recomendamos que salve as senhas caso ainda precise delas.`}
        confirmLabel="Entendido"
        cancelLabel={null}
        type="warning"
        countdown={5}
        onConfirm={() => setIsExpiringModalOpen(false)}
        onCancel={() => setIsExpiringModalOpen(false)}
      />
    </DashboardLayout>
  );
}
