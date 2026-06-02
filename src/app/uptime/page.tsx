'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './uptime.module.css';
import { 
  Activity, 
  Plus, 
  Globe, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Pencil,
  HelpCircle,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import { logAction } from '@/utils/logger';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

export default function UptimePage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [newMonitorName, setNewMonitorName] = useState('');
  const [newMonitorUrl, setNewMonitorUrl] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Controle de edição de monitor
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<any | null>(null);
  const [editMonitorName, setEditMonitorName] = useState('');
  const [editMonitorUrl, setEditMonitorUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para o modal de confirmação
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    cancelLabel?: string | null;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    onConfirm: () => {}
  });

  // Estados para exportação de relatório
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedClientsForExport, setSelectedClientsForExport] = useState<string[]>([]);
  const [exportPeriod, setExportPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [isExporting, setIsExporting] = useState(false);
  const [clientMonitorSelection, setClientMonitorSelection] = useState<Record<string, string>>({});

  const openEditModal = (monitor: any) => {
    setEditingMonitor(monitor);
    setEditMonitorName(monitor.name);
    setEditMonitorUrl(monitor.url);
    setIsEditModalOpen(true);
  };

  const handleUpdateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonitor || !editMonitorName.trim() || !editMonitorUrl.trim() || isSubmitting) return;

    let formattedUrl = editMonitorUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('uptime_monitors')
        .update({
          name: editMonitorName.trim(),
          url: formattedUrl
        })
        .eq('id', editingMonitor.id);

      if (error) throw error;

      await logAction('Monitor de Uptime Editado', 'client', editingMonitor.client_id, {
        id: editingMonitor.id,
        old_name: editingMonitor.name,
        new_name: editMonitorName.trim(),
        old_url: editingMonitor.url,
        new_url: formattedUrl
      });

      showToast('Monitor atualizado com sucesso!', 'success');
      setIsEditModalOpen(false);
      setEditingMonitor(null);
      await loadMonitors(activeClientId);
    } catch (err: any) {
      showToast('Erro ao atualizar monitor: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para gerar relatório de Uptime
  const handleGenerateReport = async () => {
    if (selectedClientsForExport.length === 0 || isExporting) return;
    setIsExporting(true);

    try {
      const now = new Date();
      let startDate = new Date();
      if (exportPeriod === '24h') {
        startDate.setHours(now.getHours() - 24);
      } else if (exportPeriod === '7d') {
        startDate.setDate(now.getDate() - 7);
      } else if (exportPeriod === '30d') {
        startDate.setDate(now.getDate() - 30);
      }

      // Obter monitores dos clientes selecionados com base na seleção do dropdown
      const monitorsToExport = monitors.filter(m => {
        if (!selectedClientsForExport.includes(m.client_id)) return false;
        const selection = clientMonitorSelection[m.client_id] || 'all';
        if (selection === 'all') return true;
        return m.id === selection;
      });
      if (monitorsToExport.length === 0) {
        showToast('Nenhum monitor cadastrado para os clientes selecionados.', 'error');
        setIsExporting(false);
        return;
      }

      const monitorIds = monitorsToExport.map(m => m.id);

      const { data: logsData, error: logsError } = await supabase
        .from('uptime_logs')
        .select('*')
        .in('monitor_id', monitorIds)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (logsError) throw logsError;

      const reportData = monitorsToExport.map(monitor => {
        const monitorLogs = logsData ? logsData.filter(log => log.monitor_id === monitor.id) : [];
        
        const totalChecks = monitorLogs.length;
        const upChecks = monitorLogs.filter(log => log.is_up).length;
        const realUptimePercent = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(2) : '100.00';

        const averageLatency = totalChecks > 0
          ? Math.round(monitorLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / totalChecks)
          : 0;

        const downtimes: Array<{ start: Date; end: Date | null; durationMs: number; error: string }> = [];
        let activeDowntime: any = null;

        monitorLogs.forEach((log) => {
          if (!log.is_up) {
            if (!activeDowntime) {
              activeDowntime = {
                start: new Date(log.created_at),
                error: log.error_message || 'Sem resposta do servidor'
              };
            }
          } else {
            if (activeDowntime) {
              const end = new Date(log.created_at);
              downtimes.push({
                start: activeDowntime.start,
                end: end,
                durationMs: end.getTime() - activeDowntime.start.getTime(),
                error: activeDowntime.error
              });
              activeDowntime = null;
            }
          }
        });

        if (activeDowntime) {
          const end = new Date();
          downtimes.push({
            start: activeDowntime.start,
            end: null,
            durationMs: end.getTime() - activeDowntime.start.getTime(),
            error: activeDowntime.error
          });
        }

        const totalOutages = downtimes.length;
        const totalDowntimeMs = downtimes.reduce((sum, d) => sum + d.durationMs, 0);

        return {
          ...monitor,
          realUptimePercent,
          averageLatency,
          totalChecks,
          totalOutages,
          totalDowntimeMs,
          downtimes
        };
      });

      const periodLabel = exportPeriod === '24h' ? 'Últimas 24 Horas' : exportPeriod === '7d' ? 'Últimos 7 Dias' : 'Últimos 30 Dias';
      const clientsInReport = clients.filter(c => selectedClientsForExport.includes(c.id));
      const clientsWithMonitors = clientsInReport.filter(c => reportData.some(m => m.client_id === c.id));
      
      const totalMonitorsCount = reportData.length;
      const totalOutagesCount = reportData.reduce((sum, m) => sum + m.totalOutages, 0);
      const overallUptimeAverage = totalMonitorsCount > 0
        ? (reportData.reduce((sum, m) => sum + parseFloat(m.realUptimePercent), 0) / totalMonitorsCount).toFixed(2)
        : '100.00';
      const overallLatencyAverage = totalMonitorsCount > 0
        ? Math.round(reportData.reduce((sum, m) => sum + m.averageLatency, 0) / totalMonitorsCount)
        : 0;

      let reportHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Uptime e Integridade - Asthros Leads</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 3rem;
      line-height: 1.6;
    }

    .report-container {
      max-width: 1100px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
      border: 1px solid #e2e8f0;
      padding: 3.5rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 2rem;
      margin-bottom: 2.5rem;
    }

    .brand-title h1 {
      font-size: 2.2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.03em;
      font-family: 'Outfit', sans-serif;
    }

    .brand-title p {
      font-size: 0.85rem;
      color: #64748b;
      margin-top: 0.4rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.1em;
    }

    .meta-info {
      text-align: right;
    }

    .meta-info div {
      font-size: 0.9rem;
      color: #64748b;
      margin-bottom: 0.35rem;
    }

    .meta-info strong {
      color: #0f172a;
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1rem;
      margin-bottom: 3rem;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.25rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .summary-card .label {
      font-size: 0.72rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .summary-card .value {
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      font-family: 'Outfit', sans-serif;
    }

    .summary-card.accent {
      background: rgba(14, 165, 233, 0.04);
      border-color: rgba(14, 165, 233, 0.2);
    }
    
    .summary-card.accent .value {
      color: #0284c7;
    }

    .summary-card.critical {
      background: rgba(239, 68, 68, 0.03);
      border-color: rgba(239, 68, 68, 0.15);
    }

    .summary-card.critical .value {
      color: #dc2626;
    }

    .client-section {
      margin-bottom: 3.5rem;
    }

    .client-header {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-family: 'Outfit', sans-serif;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .client-header::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 18px;
      background: #0ea5e9;
      border-radius: 2px;
    }

    .performance-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
      text-align: left;
    }

    .performance-table th, .performance-table td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .performance-table th {
      background: #f8fafc;
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .performance-table td {
      font-size: 0.85rem;
      color: #334155;
    }

    .monitor-name {
      font-weight: 700;
      color: #0f172a;
    }

    .monitor-url {
      font-size: 0.78rem;
      color: #64748b;
      display: block;
      margin-top: 0.15rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .status-badge.online {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .status-badge.offline {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    h2.section-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2.5rem;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Outfit', sans-serif;
    }

    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .insight-item {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #f97316;
      border-radius: 10px;
      padding: 1.1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.01);
    }

    .insight-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .insight-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 0.9rem;
    }

    .insight-date {
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 600;
    }

    .insight-description {
      font-size: 0.88rem;
      color: #475569;
    }

    .insight-description strong {
      color: #0f172a;
    }

    .no-outages {
      background: rgba(16, 185, 129, 0.02);
      border: 1px dashed rgba(16, 185, 129, 0.3);
      border-left: 4px solid #10b981;
      border-radius: 10px;
      padding: 1.5rem;
      text-align: center;
      color: #065f46;
      font-size: 0.9rem;
      font-weight: 600;
    }

    footer.report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 1.5rem;
      margin-top: 4rem;
      text-align: center;
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 500;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>

  <div class="report-container">
    <header>
      <div class="brand-title">
        <h1>Asthros Leads</h1>
        <p>Relatório de Uptime e Integridade</p>
      </div>
      <div class="meta-info">
        <div>Clientes: <strong>${selectedClientsForExport.length === clients.length ? 'Todos os Clientes' : clientsInReport.map(c => c.name).join(', ')}</strong></div>
        <div>Período: <strong>${periodLabel}</strong></div>
        <div>Gerado em: <strong>${now.toLocaleString('pt-BR')}</strong></div>
      </div>
    </header>

    <div class="summary-grid">
      <div class="summary-card">
        <span class="label">Clientes</span>
        <span class="value">${selectedClientsForExport.length}</span>
      </div>
      <div class="summary-card">
        <span class="label">Monitores</span>
        <span class="value">${totalMonitorsCount}</span>
      </div>
      <div class="summary-card accent">
        <span class="label">Média Uptime</span>
        <span class="value">${overallUptimeAverage}%</span>
      </div>
      <div class="summary-card">
        <span class="label">Latência Média</span>
        <span class="value">${overallLatencyAverage} ms</span>
      </div>
      <div class="summary-card critical">
        <span class="label">Instabilidades</span>
        <span class="value">${totalOutagesCount}</span>
      </div>
    </div>

    ${clientsWithMonitors.map(client => {
      const clientMonitors = reportData.filter(m => m.client_id === client.id);
      return `
        <div class="client-section">
          <h3 class="client-header">${client.name}</h3>
          <table class="performance-table">
            <thead>
              <tr>
                <th>Monitor / URL</th>
                <th>Status</th>
                <th>Uptime Real</th>
                <th>Latência Média</th>
                <th>Verificações</th>
                <th>Tempo Offline</th>
              </tr>
            </thead>
            <tbody>
              ${clientMonitors.map(monitor => {
                const totalOutageDurationStr = monitor.totalDowntimeMs > 0
                  ? formatDuration(monitor.totalDowntimeMs)
                  : '0s';
                
                return `
                  <tr>
                    <td>
                      <span class="monitor-name">${monitor.name}</span>
                      <span class="monitor-url">${monitor.url}</span>
                    </td>
                    <td>
                      <span class="status-badge ${monitor.status === 'online' ? 'online' : 'offline'}">
                        ● ${monitor.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td style="font-weight: 700; color: ${parseFloat(monitor.realUptimePercent) >= 99 ? '#15803d' : (parseFloat(monitor.realUptimePercent) >= 95 ? '#d97706' : '#b91c1c')};">
                      ${monitor.realUptimePercent}%
                    </td>
                    <td>${monitor.averageLatency} ms</td>
                    <td>${monitor.totalChecks}</td>
                    <td>${totalOutageDurationStr}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('')}

    <h2 class="section-title">Insights & Histórico de Instabilidades</h2>
    <div class="insights-list">
      ${(() => {
        const allOutages: Array<{ monitorName: string; clientName: string; start: Date; end: Date | null; durationMs: number; error: string }> = [];
        reportData.forEach(m => {
          const clientName = m.clients?.name || 'N/A';
          m.downtimes.forEach((d: any) => {
            allOutages.push({
              monitorName: m.name,
              clientName,
              ...d
            });
          });
        });

        allOutages.sort((a, b) => b.start.getTime() - a.start.getTime());

        if (allOutages.length === 0) {
          return `
            <div class="no-outages">
              ✓ Excelente! Nenhuma instabilidade ou queda foi registrada para os clientes selecionados no período analisado.
            </div>
          `;
        }

        return allOutages.map(outage => {
          const dateStr = outage.start.toLocaleDateString('pt-BR');
          const durationStr = formatDurationHMS(outage.durationMs);
          const startHour = outage.start.toLocaleTimeString('pt-BR');
          const endHour = outage.end ? outage.end.toLocaleTimeString('pt-BR') : 'agora';

          return `
            <div class="insight-item">
              <div class="insight-header">
                <span class="insight-title">${outage.monitorName} (Cliente: ${outage.clientName})</span>
                <span class="insight-date">${dateStr}</span>
              </div>
              <div class="insight-description">
                No dia <strong>${dateStr}</strong>, a página ficou fora do ar por <strong>${durationStr}</strong>, da hora <strong>${startHour}</strong> até <strong>${endHour}</strong> (Motivo: <em>${outage.error}</em>).
              </div>
            </div>
          `;
        }).join('');
      })()}
    </div>

    <footer class="report-footer">
      Gerado automaticamente pelo Asthros Leads Monitor - Relatório de Uptime de Clientes
    </footer>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
      `;

      function formatDuration(ms: number): string {
        const sec = Math.floor(ms / 1000);
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ${sec % 60}s`;
        const hr = Math.floor(min / 60);
        return `${hr}h ${min % 60}m ${sec % 60}s`;
      }

      function formatDurationHMS(ms: number): string {
        const totalSec = Math.floor(ms / 1000);
        const hr = Math.floor(totalSec / 3600);
        const min = Math.floor((totalSec % 3600) / 60);
        const sec = totalSec % 60;
        
        const hrStr = String(hr).padStart(2, '0');
        const minStr = String(min).padStart(2, '0');
        const secStr = String(sec).padStart(2, '0');
        
        return hrStr + ':' + minStr + ':' + secStr;
      }

      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.open();
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
        logAction('Exportação de Uptime', 'uptime', undefined, {
          clientsCount: selectedClientsForExport.length,
          monitorsCount: totalMonitorsCount,
          period: exportPeriod,
          outagesTotal: totalOutagesCount
        });
      } else {
        alert('O bloqueador de pop-ups impediu a abertura do relatório. Por favor, libere pop-ups para este site.');
      }

      setIsExportModalOpen(false);
    } catch (err: any) {
      alert('Erro ao gerar relatório: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper para exibir notificações temporárias (toasts)
  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Carregar cliente ativo e configurações
  useEffect(() => {
    async function initPage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('system_users')
            .select('*')
            .eq('email', user.email)
            .single();

          const isUserAdmin = profile?.role === 'admin';
          setIsAdmin(isUserAdmin);

          // Restrição temporária de Uptime: somente admins
          if (!isUserAdmin) {
            router.push('/');
            return;
          }

          // Carregar todos os clientes do banco para o seletor no modal
          const { data: clientsData } = await supabase
            .from('clients')
            .select('id, name')
            .order('name');
          if (clientsData) {
            setClients(clientsData);
          }

          const impersonated = localStorage.getItem('impersonated_client');
          let clientId = profile?.client_id;

          if (isUserAdmin && impersonated) {
            const impData = JSON.parse(impersonated);
            clientId = impData.id;
            setImpersonatedName(impData.name);
          } else {
            setImpersonatedName(null);
          }

          setActiveClientId(clientId);
          // Carrega monitores (se clientId for nulo, carrega todos)
          await loadMonitors(clientId);
        }
      } catch (err) {
        console.error('Erro ao inicializar página de Uptime:', err);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  // Carregar os monitores e buscar os logs de histórico para cada um
  async function loadMonitors(clientId: string | null) {
    try {
      let query = supabase
        .from('uptime_monitors')
        .select('*, clients(name)');

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data: monitorsData, error: monitorsError } = await query
        .order('created_at', { ascending: false });

      if (monitorsError) throw monitorsError;

      if (monitorsData) {
        const monitorsWithLogs = await Promise.all(
          monitorsData.map(async (monitor) => {
            const { data: logsData } = await supabase
              .from('uptime_logs')
              .select('*')
              .eq('monitor_id', monitor.id)
              .order('created_at', { ascending: false })
              .limit(30);

            const reversedLogs = logsData ? [...logsData].reverse() : [];

            // Calcular porcentagem de uptime nas últimas 30 verificações
            const totalPings = reversedLogs.length;
            const upPings = reversedLogs.filter(l => l.is_up).length;
            const uptimePercent = totalPings > 0 ? (upPings / totalPings) * 100 : 100;

            // Calcular latência média
            const averageLatency = totalPings > 0 
              ? Math.round(reversedLogs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / totalPings)
              : 0;

            return {
              ...monitor,
              logs: reversedLogs,
              uptimePercent: uptimePercent.toFixed(2),
              averageLatency
            };
          })
        );
        setMonitors(monitorsWithLogs);
      }
    } catch (err) {
      console.error('Erro ao carregar monitores:', err);
    }
  }

  // Adicionar monitor de Uptime
  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonitorName.trim() || !newMonitorUrl.trim() || isSubmitting) return;

    const targetClientId = activeClientId || selectedClientId;

    if (!targetClientId) {
      showToast('Por favor, selecione um cliente para vincular este monitor.', 'error');
      return;
    }

    let formattedUrl = newMonitorUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('uptime_monitors')
        .insert({
          client_id: targetClientId,
          name: newMonitorName.trim(),
          url: formattedUrl,
          status: 'checking'
        })
        .select()
        .single();

      if (error) throw error;

      await logAction('Monitor de Uptime Adicionado', 'client', targetClientId, {
        name: newMonitorName.trim(),
        url: formattedUrl
      });

      setNewMonitorName('');
      setNewMonitorUrl('');
      setSelectedClientId('');
      setIsModalOpen(false);
      showToast('Monitor de Uptime cadastrado com sucesso!', 'success');
      
      // Recarrega e força um ping imediato para atualizar o status
      await loadMonitors(activeClientId);
      handleCheckAll();
    } catch (err: any) {
      showToast('Erro ao cadastrar monitor: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir monitor
  const handleDeleteMonitor = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Monitor',
      message: `Tem certeza que deseja excluir o monitor "${name}"? Esta ação removerá o monitor de Uptime e todos os seus logs associados.`,
      type: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('uptime_monitors')
            .delete()
            .eq('id', id);

          if (error) throw error;

          const targetLogClientId = activeClientId || monitors.find(m => m.id === id)?.client_id;
          if (targetLogClientId) {
            await logAction('Monitor de Uptime Excluído', 'client', targetLogClientId, { name });
          }
          showToast('Monitor excluído com sucesso!', 'success');
          await loadMonitors(activeClientId);
        } catch (err: any) {
          showToast('Erro ao remover monitor: ' + err.message, 'error');
        }
      }
    });
  };

  // Disparar pings manuais via API interna
  const handleCheckAll = async () => {
    if (monitors.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch('/api/uptime/check');
      const data = await res.json();
      if (data.success && activeClientId) {
        await loadMonitors(activeClientId);
      }
    } catch (err) {
      console.error('Erro ao verificar uptime:', err);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Loader text="Carregando Monitores de Uptime" />
      </DashboardLayout>
    );
  }

  // Clientes com monitoramento configurado
  const activeClients = clients.filter(c => monitors.some(m => m.client_id === c.id));

  // Estatísticas gerais
  const totalMonitors = monitors.length;
  const onlineMonitors = monitors.filter(m => m.status === 'online').length;
  const offlineMonitors = monitors.filter(m => m.status === 'offline').length;
  const averageLatencyGlobal = totalMonitors > 0 
    ? Math.round(monitors.reduce((sum, m) => sum + (m.averageLatency || 0), 0) / totalMonitors)
    : 0;

  const uptimeTitle = impersonatedName ? `Uptime: ${impersonatedName}` : "Monitoramento de Uptime";

  return (
    <DashboardLayout>
      <div className={styles.container}>
        
        {/* Sistema de Toasts (Notificações) */}
        {notification && (
          <div className={styles.toastContainer}>
            <div className={`${styles.toast} ${styles[notification.type]}`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        <div className={styles.headerRow}>
          <h2>{uptimeTitle}</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {totalMonitors > 0 && (
              <button 
                type="button" 
                className={styles.exportReportBtn} 
                onClick={() => {
                  const initialSelections: Record<string, string> = {};
                  activeClients.forEach(c => {
                    initialSelections[c.id] = 'all';
                  });
                  setClientMonitorSelection(initialSelections);
                  setSelectedClientsForExport(activeClientId ? [activeClientId] : activeClients.map(c => c.id));
                  setIsExportModalOpen(true);
                }}
              >
                <FileText size={14} />
                <span>Exportar Relatório</span>
              </button>
            )}

            <button 
              type="button" 
              className={styles.submitBtn} 
              onClick={() => setIsModalOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', height: '36px' }}
            >
              <Plus size={14} />
              <span>Adicionar Monitor</span>
            </button>

            {totalMonitors > 0 && (
              <button 
                type="button" 
                className={styles.manualCheckBtn} 
                onClick={handleCheckAll}
                disabled={checking}
                style={{ height: '36px' }}
              >
                {checking ? (
                  <>
                    <div className={styles.spinnerMini} />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Verificar Agora</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linha de Estatísticas */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.success}`}>
              <CheckCircle2 size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Online</span>
              <span className={styles.statValue}>{onlineMonitors} / {totalMonitors} Sites</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.info}`}>
              <Clock size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Latência Média</span>
              <span className={styles.statValue}>{averageLatencyGlobal} ms</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.purple}`}>
              <RefreshCw size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Última Checagem</span>
              <span className={styles.statValue}>
                {monitors.length > 0 && monitors.some(m => m.last_checked)
                  ? new Date(
                      Math.max(...monitors.filter(m => m.last_checked).map(m => new Date(m.last_checked).getTime()))
                    ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Aguardando'}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.warning}`}>
              <Activity size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Status Operacional</span>
              <span className={styles.statValue}>
                {offlineMonitors > 0 ? `${offlineMonitors} instabilidade(s)` : '100% Operacional'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Listagem de Monitores */}
          <div className={styles.monitorsList}>
            {monitors.map(monitor => {
              // Preenche histórico com barras vazias caso haja menos de 30 verificações
              const emptyBarsCount = Math.max(0, 30 - monitor.logs.length);
              const emptyBars = Array.from({ length: emptyBarsCount });

              return (
                <div 
                  key={monitor.id} 
                  className={`${styles.monitorCard} ${
                    monitor.status === 'online' 
                      ? styles.onlineCard 
                      : monitor.status === 'offline' 
                      ? styles.offlineCard 
                      : ''
                  }`}
                >
                  <div className={styles.monitorHeader}>
                    <div className={styles.monitorInfo}>
                      <h3>
                        {monitor.name}
                        <button 
                          type="button" 
                          className={styles.editTitleBtn} 
                          onClick={() => openEditModal(monitor)}
                          title="Editar Monitor"
                        >
                          <Pencil size={12} />
                        </button>
                      </h3>
                      {monitor.clients?.name && (
                        <span className={styles.monitorClientName}>{monitor.clients.name}</span>
                      )}
                    </div>
                    
                    <div className={styles.statusWrapper}>
                      {monitor.status === 'online' ? (
                        <div className={styles.badgeOnline}>
                          <div className={`${styles.pulseDot} ${styles.online}`} />
                          <span>Online</span>
                        </div>
                      ) : monitor.status === 'offline' ? (
                        <div className={styles.badgeOffline}>
                          <div className={`${styles.pulseDot} ${styles.offline}`} />
                          <span>Offline</span>
                        </div>
                      ) : (
                        <div className={styles.badgeChecking}>
                          <div className={`${styles.pulseDot} ${styles.checking}`} />
                          <span>Checando</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <a 
                    href={monitor.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.monitorUrl}
                  >
                    <span>{monitor.url}</span>
                    <ExternalLink size={12} />
                  </a>

                  {/* Histórico Visual de Pings */}
                  <div className={styles.chartAndUptime}>
                    <div className={styles.chartMeta}>
                      <span>Histórico (Últimos 30 pings)</span>
                      <span className={styles.chartMetaStrong}>Uptime: {monitor.uptimePercent}%</span>
                    </div>
                    
                    <div className={styles.pingHistoryList}>
                      {emptyBars.map((_, i) => (
                        <div key={`empty-${i}`} className={`${styles.pingBar} ${styles.empty}`} title="Aguardando dados..." />
                      ))}
                      {monitor.logs.map((log: any) => (
                        <div 
                           key={log.id} 
                           className={`${styles.pingBar} ${log.is_up ? styles.up : styles.down}`} 
                           title={`${new Date(log.created_at).toLocaleString('pt-BR')} - Latência: ${log.response_time_ms}ms${log.error_message ? ` - Erro: ${log.error_message}` : ''}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.monitorFooter}>
                    <div className={styles.footerMeta}>
                      <span>
                        Último Ping
                        <span className={styles.pingTooltipWrapper}>
                          <HelpCircle size={14} className={styles.pingHelpIcon} />
                          <span className={styles.pingTooltipText}>
                            O Ping é o tempo de resposta do servidor (latência) em milissegundos. Um ping menor indica que o servidor do seu site responde rapidamente à conexão inicial, embora não garanta o tempo de carregamento completo da página (que depende do peso das imagens e scripts).
                          </span>
                        </span>: <strong>{monitor.last_ping_ms ? `${monitor.last_ping_ms}ms` : 'N/A'}</strong>
                        {monitor.last_ping_ms && (
                          <span className={`${styles.latencyLabel} ${
                            monitor.last_ping_ms <= 150 
                              ? styles.latencyFast 
                              : monitor.last_ping_ms <= 400 
                              ? styles.latencyMedium 
                              : styles.latencySlow
                          }`}>
                            {monitor.last_ping_ms <= 150 ? 'Rápido' : monitor.last_ping_ms <= 400 ? 'Moderado' : 'Lento'}
                          </span>
                        )}
                      </span>
                      <span>Última checagem: <strong>
                        {monitor.last_checked ? new Date(monitor.last_checked).toLocaleTimeString('pt-BR') : 'N/A'}
                      </strong></span>
                    </div>

                    <button 
                      type="button" 
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteMonitor(monitor.id, monitor.name)}
                      title="Excluir Monitor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {monitors.length === 0 && (
              <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
                <Globe size={48} />
                <p>Nenhuma página de vendas está cadastrada para monitoramento de uptime.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Clique no botão "Adicionar Monitor" no topo para começar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cadastro de Novo Monitor */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Novo Monitor de Uptime</h3>
                <button className={styles.modalCloseBtn} onClick={() => setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddMonitor} className={styles.form}>
                <div className={styles.field}>
                  <label>Nome do Site</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Página de Vendas Produto A"
                    value={newMonitorName}
                    onChange={e => setNewMonitorName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Endereço URL</label>
                  <input 
                    type="text" 
                    placeholder="Ex: minhapagina.com.br"
                    value={newMonitorUrl}
                    onChange={e => setNewMonitorUrl(e.target.value)}
                    required
                  />
                </div>

                {/* Seletor de Cliente — aparece quando admin não tem cliente impersonado */}
                {!activeClientId && clients.length > 0 && (
                  <div className={styles.field}>
                    <label>Vincular ao Cliente</label>
                    <select
                      className={styles.selectField}
                      value={selectedClientId}
                      onChange={e => setSelectedClientId(e.target.value)}
                      required
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <Plus size={16} />
                  <span>{isSubmitting ? 'Adicionando...' : 'Adicionar Monitor'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edição de Monitor */}
        {isEditModalOpen && editingMonitor && (
          <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Editar Monitor de Uptime</h3>
                <button className={styles.modalCloseBtn} onClick={() => setIsEditModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleUpdateMonitor} className={styles.form}>
                <div className={styles.field}>
                  <label>Nome do Site</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Página de Vendas Produto A"
                    value={editMonitorName}
                    onChange={e => setEditMonitorName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Endereço URL</label>
                  <input 
                    type="text" 
                    placeholder="Ex: minhapagina.com.br"
                    value={editMonitorUrl}
                    onChange={e => setEditMonitorUrl(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Exportação de Relatório de Uptime */}
        {isExportModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsExportModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className={styles.modalHeader}>
                <h3>Exportar Relatório de Uptime</h3>
                <button className={styles.modalCloseBtn} onClick={() => setIsExportModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.form}>
                <div className={styles.field}>
                  <label>Período de Análise</label>
                  <div className={styles.periodCardsContainer}>
                    <button
                      type="button"
                      className={`${styles.periodCard} ${exportPeriod === '24h' ? styles.activePeriod : ''}`}
                      onClick={() => setExportPeriod('24h')}
                    >
                      <span>24 Horas</span>
                      <span className={styles.periodCardSubtext}>Último dia</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.periodCard} ${exportPeriod === '7d' ? styles.activePeriod : ''}`}
                      onClick={() => setExportPeriod('7d')}
                    >
                      <span>7 Dias</span>
                      <span className={styles.periodCardSubtext}>Última semana</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.periodCard} ${exportPeriod === '30d' ? styles.activePeriod : ''}`}
                      onClick={() => setExportPeriod('30d')}
                    >
                      <span>30 Dias</span>
                      <span className={styles.periodCardSubtext}>Último mês</span>
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ margin: 0 }}>Selecione os Clientes</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (selectedClientsForExport.length === activeClients.length) {
                          setSelectedClientsForExport([]);
                        } else {
                          setSelectedClientsForExport(activeClients.map(c => c.id));
                        }
                      }}
                      className={styles.textLinkBtn}
                    >
                      {selectedClientsForExport.length === activeClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'} ({selectedClientsForExport.length}/{activeClients.length})
                    </button>
                  </div>
                  
                  <div className={styles.clientSelectionList}>
                    {activeClients.map(client => {
                      const isChecked = selectedClientsForExport.includes(client.id);
                      const clientMonitors = monitors.filter(m => m.client_id === client.id);
                      const clientMonitorCount = clientMonitors.length;
                      const currentSelection = clientMonitorSelection[client.id] || 'all';

                      return (
                        <div 
                          key={client.id} 
                          className={`${styles.clientCheckboxCard} ${isChecked ? styles.activeItem : ''}`}
                        >
                          <label className={styles.clientCheckboxItemLabel}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedClientsForExport(prev => prev.filter(id => id !== client.id));
                                } else {
                                  setSelectedClientsForExport(prev => [...prev, client.id]);
                                }
                              }}
                            />
                            <span className={styles.clientNameText}>{client.name}</span>
                          </label>

                          <div className={styles.clientActionsWrapper}>
                            {clientMonitorCount > 1 ? (
                              <select
                                className={styles.clientMonitorSelect}
                                value={currentSelection}
                                disabled={!isChecked}
                                onChange={e => {
                                  setClientMonitorSelection(prev => ({
                                    ...prev,
                                    [client.id]: e.target.value
                                  }));
                                }}
                              >
                                <option value="all">Todos os Monitores ({clientMonitorCount})</option>
                                {clientMonitors.map(m => (
                                  <option key={m.id} value={m.id}>
                                    Apenas: {m.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={styles.clientMonitorCountText}>
                                1 monitor
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {activeClients.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                        Nenhum cliente possui monitoramento ativo.
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="button" 
                  className={styles.submitBtn} 
                  onClick={handleGenerateReport}
                  disabled={selectedClientsForExport.length === 0 || isExporting}
                  style={{ marginTop: '0.5rem' }}
                >
                  <FileText size={16} />
                  <span>{isExporting ? 'Processando Relatório...' : 'Gerar Relatório'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação HUD */}
        <ConfirmModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />

      </div>
    </DashboardLayout>
  );
}
