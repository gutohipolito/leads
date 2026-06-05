'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3, TrendingUp, PieChart as PieIcon, MapPin, Tv, Zap, Bell, BellOff, Globe, MessageCircle, MousePointerClick, Type, FileText, X, Download, Table as TableIcon, FileJson, FileDown, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AnalyticsChart from '@/components/DashboardCharts/AnalyticsChart';
import Loader from '@/components/Loader/Loader';
import jsPDF from 'jspdf';
import ExportModal from '@/components/ExportModal/ExportModal';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role') === 'admin';
    }
    return false;
  });
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [lastSignalTime, setLastSignalTime] = useState<number | null>(null);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'forms' | 'whatsapp' | 'selectors' | 'keywords'>('all');
  const [dashboardPeriod, setDashboardPeriod] = useState<7 | 15 | 30>(7);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [exportType, setExportType] = useState<{ show: boolean; type: string }>({ show: false, type: '' });
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let notifChannel: any = null;

    async function loadDashboardData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (user) {
          const cachedRole = localStorage.getItem('user_role');
          const cachedClientId = localStorage.getItem('user_client_id') || null;

          const isUserAdmin = cachedRole === 'admin';
          const clientId = cachedClientId;
          setIsAdmin(isUserAdmin);

          const impersonated = localStorage.getItem('impersonated_client');
          let activeClientId = clientId;
          
          if (isUserAdmin && impersonated) {
            const impData = JSON.parse(impersonated);
            activeClientId = impData.id;
            setImpersonatedName(impData.name);
          } else {
            setImpersonatedName(null);
          }

          // 1. Obter quantidade de parceiros se admin
          let activeClients = 0;
          if (isUserAdmin && !impersonated) {
            const { count } = await supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'active');
            activeClients = count || 0;
            setActiveClientsCount(activeClients);
          }

          // 2. Query de leads dos últimos 30 dias para graficos e analytics (com colunas completas)
          const dataLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          let analyticsQuery = supabase
            .from('leads')
            .select('*, clients(name), webhooks(name)')
            .neq('source', 'test_simulation')
            .gte('created_at', dataLimite)
            .order('created_at', { ascending: false });
          
          if (!(isUserAdmin && !impersonated)) {
            analyticsQuery = analyticsQuery.eq('client_id', activeClientId);
          }
          
          const { data: allLeadsRaw } = await analyticsQuery;
          const leadsList = allLeadsRaw || [];
          const { decryptLeadsList } = await import('@/utils/frontendEncryption');
          const decryptedLeads = await decryptLeadsList(leadsList);
          setAllLeads(decryptedLeads);

          const lastLead = leadsList[0];
          const lastSignal = lastLead ? new Date(lastLead.created_at).getTime() : null;
          setLastSignalTime(lastSignal);

          // Inscrição Realtime para Notificações na Home
          const channel = supabase.channel('dashboard-notifications');
          channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, async (payload: any) => {
              const newLead = payload.new;
              const canSee = isUserAdmin && !impersonated ? true : (newLead.client_id === activeClientId);
              if (!canSee) return;
              
              // Recarregar dados brutos ao receber lead em tempo real
              loadDashboardData();
            })
            .subscribe();
          notifChannel = channel;

        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
    };
  }, []);

  // Filtro de leads e computação reativa na memória
  const filteredLeads = useMemo(() => {
    return allLeads.filter(l => {
      const isSelector = l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
        l.data?.match_type?.toLowerCase().includes('selector') || 
        l.name?.toLowerCase().includes('selector')
      );
      const isKeyword = l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
        l.data?.match_type?.toLowerCase().includes('keyword') || 
        l.name?.toLowerCase().includes('keyword')
      );

      if (activeFilter === 'whatsapp') return l.source === 'whatsapp_tracker';
      if (activeFilter === 'selectors') return isSelector;
      if (activeFilter === 'keywords') return isKeyword;
      if (activeFilter === 'forms') return l.source !== 'whatsapp_tracker' && !isSelector && !isKeyword;
      return true; // 'all'
    });
  }, [allLeads, activeFilter]);

  const statsSummary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const periodStart = new Date(now.getTime() - dashboardPeriod * 24 * 60 * 60 * 1000).toISOString();

    const totalLeads = filteredLeads.length;
    const leadsToday = filteredLeads.filter(l => l.created_at >= todayStart).length;
    const leadsInPeriod = filteredLeads.filter(l => l.created_at >= periodStart);

    // Performance por Parceiro (calculado de forma reativa a partir de leadsInPeriod)
    const counts: any = {};
    leadsInPeriod.forEach(l => {
      const name = l.clients?.name || 'Desconhecido';
      counts[name] = (counts[name] || 0) + 1;
    });
    const performanceData: { name: string; count: number }[] = Object.entries(counts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Pizza (Divisão de origens)
    const wppCount = leadsInPeriod.filter(l => l.source === 'whatsapp_tracker').length;
    const selectorCount = leadsInPeriod.filter(l => 
      l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
        l.data?.match_type?.toLowerCase().includes('selector') || 
        l.name?.toLowerCase().includes('selector')
      )
    ).length;
    const keywordCount = leadsInPeriod.filter(l => 
      l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
        l.data?.match_type?.toLowerCase().includes('keyword') || 
        l.name?.toLowerCase().includes('keyword')
      )
    ).length;
    const formCount = leadsInPeriod.length - wppCount - selectorCount - keywordCount;

    const sourceData = [
      { name: 'WhatsApp', value: wppCount, color: '#25d366' },
      { name: 'Seletores', value: selectorCount, color: '#a855f7' },
      { name: 'Palavras-Chave', value: keywordCount, color: '#f97316' },
      { name: 'Formulários', value: formCount, color: '#56d7fd' }
    ].filter(s => activeFilter === 'all' ? true : s.value > 0);

    // UTMs
    const utmMap: any = {};
    leadsInPeriod.forEach(l => {
      const rawUtm = l.data?.marketing?.source || l.data?.utm_source || 'Direto / Orgânico';
      const utm = decodeURIComponent(rawUtm);
      utmMap[utm] = (utmMap[utm] || 0) + 1;
    });
    const topUtms: { name: string; value: number }[] = Object.entries(utmMap)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Localização
    const locMap: any = {};
    leadsInPeriod.forEach(l => {
      const cityRaw = l.data?.location?.city;
      if (cityRaw && cityRaw !== 'Desconhecida') {
        const city = decodeURIComponent(cityRaw);
        locMap[city] = (locMap[city] || 0) + 1;
      }
    });
    const locationData: { name: string; value: number }[] = Object.entries(locMap)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Chart Data
    const chartData = Array.from({ length: dashboardPeriod }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dashboardPeriod - 1 - i));
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      
      const dayLeads = leadsInPeriod.filter(l => {
        const ts = new Date(l.created_at).getTime();
        return ts >= dayStart && ts < dayEnd;
      });

      const dayWpp = dayLeads.filter(l => l.source === 'whatsapp_tracker').length;
      const daySel = dayLeads.filter(l => 
        l.source === 'custom_tracker' && (
          l.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
          l.data?.match_type?.toLowerCase().includes('selector') || 
          l.name?.toLowerCase().includes('selector')
        )
      ).length;
      const dayKey = dayLeads.filter(l => 
        l.source === 'custom_tracker' && (
          l.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
          l.data?.match_type?.toLowerCase().includes('keyword') || 
          l.name?.toLowerCase().includes('keyword')
        )
      ).length;
      const dayForm = dayLeads.length - dayWpp - daySel - dayKey;

      return { 
        date: dateStr, 
        leads: dayLeads.length,
        whatsapp: dayWpp,
        selectors: daySel,
        keywords: dayKey,
        forms: dayForm
      };
    });

    const recentLeads = leadsInPeriod.slice(0, 5);

    return {
      totalLeads,
      leadsToday,
      leadsInPeriod: leadsInPeriod.length,
      sourceData,
      topUtms,
      locationData,
      chartData,
      recentLeads,
      performanceData
    };
  }, [filteredLeads, activeFilter, dashboardPeriod]);

  const dashboardTitle = impersonatedName ? `Dashboard: ${impersonatedName}` : "";

  const getLastLeadTime = () => {
    if (!lastSignalTime) return 'Nenhuma captura';
    const mins = Math.floor((Date.now() - lastSignalTime) / 60000);
    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const handleExport = (format: string) => {
    setExportType({ show: true, type: format });
    setExportOpen(false);
  };

  const processExport = (password: string | null, selectedFields: string[]) => {
    if (!selectedLead) return;

    const leadToExport = selectedLead;
    const clientName = leadToExport.clients?.name || impersonatedName || 'asthros';
    const formattedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const formattedLeadName = (leadToExport.name || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '_');

    let content = '';
    
    if (exportType.type === 'pdf') {
      const doc = new jsPDF({ 
        orientation: 'portrait',
        encryption: password ? {
          userPassword: password,
          ownerPassword: password,
          userPermissions: ["print", "modify", "copy", "annot-forms"]
        } : undefined
      });

      // Desenho do PDF para um único lead
      doc.setFillColor(10, 20, 35);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(86, 215, 253);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ASTHROS LEADS', 15, 20);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 195, 18, { align: 'right' });

      doc.setTextColor(10, 20, 35);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhes do Lead', 15, 45);

      doc.setDrawColor(220, 220, 220);
      doc.line(15, 48, 195, 48);

      doc.setFontSize(11);
      let currentY = 58;

      const addRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 15, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || 'N/A'), 60, currentY);
        currentY += 10;
      };

      if (selectedFields.includes('id')) addRow('ID do Lead', leadToExport.id);
      if (selectedFields.includes('created_at')) addRow('Data/Hora', new Date(leadToExport.created_at).toLocaleString('pt-BR'));
      if (selectedFields.includes('name')) addRow('Nome', leadToExport.name);
      if (selectedFields.includes('email')) addRow('E-mail', leadToExport.email);
      if (selectedFields.includes('phone')) addRow('Telefone', leadToExport.phone || 'N/A');
      if (selectedFields.includes('webhook')) addRow('Terminal', leadToExport.webhooks?.name || leadToExport.data?.captured_by?.name || 'N/A');
      
      if (leadToExport.data) {
        if (selectedFields.includes('page_url')) addRow('Página Origem', leadToExport.data.behavior?.page_url || leadToExport.data.page_url || 'N/A');
        if (selectedFields.includes('button_text')) addRow('Botão Clicado', leadToExport.data.behavior?.button_text || leadToExport.data.button_text || 'N/A');
        if (selectedFields.includes('time_on_page')) addRow('Tempo na Página', leadToExport.data.behavior?.time_on_page || leadToExport.data.time_on_page || 'N/A');
        if (selectedFields.includes('utm')) {
          const utmStr = `Source: ${leadToExport.data.marketing?.source || leadToExport.data.utm_source || 'N/A'}, Medium: ${leadToExport.data.marketing?.medium || leadToExport.data.utm_medium || 'N/A'}, Campaign: ${leadToExport.data.marketing?.campaign || leadToExport.data.utm_campaign || 'N/A'}`;
          addRow('UTM (Tráfego)', utmStr);
        }
        if (selectedFields.includes('location')) {
          const locStr = `${leadToExport.data.location?.city || 'N/A'} - ${leadToExport.data.location?.region || 'N/A'} (IP: ${leadToExport.data.location?.ip || 'N/A'})`;
          addRow('Localização', locStr);
        }
        if (selectedFields.includes('custom_fields')) {
          const extraKeys = Object.keys(leadToExport.data).filter(k => 
            !['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp'].includes(k)
          );
          if (extraKeys.length > 0) {
            currentY += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Campos Extras:', 15, currentY);
            currentY += 8;
            extraKeys.forEach(k => {
              doc.setFont('helvetica', 'bold');
              doc.text(`  ${k}:`, 15, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(String(leadToExport.data[k]), 60, currentY);
              currentY += 8;
            });
          }
        }
      }

      doc.save(`lead_${formattedClientName}_${formattedLeadName}_${new Date().getTime()}.pdf`);
    } else if (exportType.type === 'csv') {
      const headers: string[] = [];
      const row: string[] = [];

      const addField = (header: string, val: string) => {
        headers.push(header);
        row.push(`"${String(val || '').replace(/"/g, '""')}"`);
      };

      if (selectedFields.includes('id')) addField('ID', leadToExport.id);
      if (selectedFields.includes('created_at')) addField('Data/Hora', new Date(leadToExport.created_at).toLocaleString('pt-BR'));
      if (selectedFields.includes('name')) addField('Nome', leadToExport.name);
      if (selectedFields.includes('email')) addField('E-mail', leadToExport.email);
      if (selectedFields.includes('phone')) addField('Telefone', leadToExport.phone || 'N/A');
      if (selectedFields.includes('webhook')) addField('Terminal', leadToExport.webhooks?.name || leadToExport.data?.captured_by?.name || 'N/A');
      
      if (leadToExport.data) {
        if (selectedFields.includes('page_url')) addField('Página Origem', leadToExport.data.behavior?.page_url || leadToExport.data.page_url || '');
        if (selectedFields.includes('button_text')) addField('Botão Clicado', leadToExport.data.behavior?.button_text || leadToExport.data.button_text || '');
        if (selectedFields.includes('time_on_page')) addField('Tempo na Página', leadToExport.data.behavior?.time_on_page || leadToExport.data.time_on_page || '');
        if (selectedFields.includes('utm')) {
          addField('UTM Source', leadToExport.data.marketing?.source || leadToExport.data.utm_source || '');
          addField('UTM Medium', leadToExport.data.marketing?.medium || leadToExport.data.utm_medium || '');
          addField('UTM Campaign', leadToExport.data.marketing?.campaign || leadToExport.data.utm_campaign || '');
        }
        if (selectedFields.includes('location')) {
          addField('Cidade', leadToExport.data.location?.city || '');
          addField('Estado', leadToExport.data.location?.region || '');
          addField('IP', leadToExport.data.location?.ip || '');
        }
        if (selectedFields.includes('custom_fields')) {
          Object.keys(leadToExport.data).forEach(k => {
            if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp'].includes(k)) {
              addField(k, leadToExport.data[k]);
            }
          });
        }
      }

      content = "\uFEFF" + [headers.join(','), row.join(',')].join('\n');
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead_${formattedClientName}_${formattedLeadName}_${new Date().getTime()}.csv`;
      a.click();
    } else {
      // JSON
      const item: any = {};
      if (selectedFields.includes('id')) item.id = leadToExport.id;
      if (selectedFields.includes('created_at')) item.created_at = leadToExport.created_at;
      if (selectedFields.includes('name')) item.name = leadToExport.name;
      if (selectedFields.includes('email')) item.email = leadToExport.email;
      if (selectedFields.includes('phone')) item.phone = leadToExport.phone;
      if (selectedFields.includes('webhook')) item.webhook = leadToExport.webhooks?.name || leadToExport.data?.captured_by?.name;
      
      if (leadToExport.data) {
        item.data = {};
        if (selectedFields.includes('page_url')) {
          item.data.page_url = leadToExport.data.behavior?.page_url || leadToExport.data.page_url;
        }
        if (selectedFields.includes('button_text')) {
          item.data.button_text = leadToExport.data.behavior?.button_text || leadToExport.data.button_text;
        }
        if (selectedFields.includes('time_on_page')) {
          item.data.time_on_page = leadToExport.data.behavior?.time_on_page || leadToExport.data.time_on_page;
        }
        if (selectedFields.includes('utm')) {
          item.data.marketing = leadToExport.data.marketing;
          if (leadToExport.data.utm_source) item.data.utm_source = leadToExport.data.utm_source;
        }
        if (selectedFields.includes('location')) {
          item.data.location = leadToExport.data.location;
        }
        if (selectedFields.includes('custom_fields')) {
          Object.keys(leadToExport.data).forEach(k => {
            if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp'].includes(k)) {
              item.data[k] = leadToExport.data[k];
            }
          });
        }
      }

      content = JSON.stringify(item, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead_${formattedClientName}_${formattedLeadName}_${new Date().getTime()}.json`;
      a.click();
    }

    setExportType({ show: false, type: '' });
  };

  return (
    <DashboardLayout title={
      <Link href="/admin/live" prefetch={false} className={styles.liveStatusPill}>
        <Tv size={20} className={styles.liveIconPulse} />
        <span className={styles.liveLabel}>Monitor ao Vivo</span>
      </Link>
    }>
      <div className={styles.dashboard}>
        
        {/* Cabeçalho do Dashboard */}
        <div className={styles.dashboardHeader}>
          <h2>{dashboardTitle || 'Visão Geral'}</h2>
          <div className={styles.periodSelectorBar}>
            <button 
              className={`${styles.periodBtn} ${dashboardPeriod === 7 ? styles.activePeriod : ''}`}
              onClick={() => setDashboardPeriod(7)}
            >
              07 dias
            </button>
            <button 
              className={`${styles.periodBtn} ${dashboardPeriod === 15 ? styles.activePeriod : ''}`}
              onClick={() => setDashboardPeriod(15)}
            >
              15 dias
            </button>
            <button 
              className={`${styles.periodBtn} ${dashboardPeriod === 30 ? styles.activePeriod : ''}`}
              onClick={() => setDashboardPeriod(30)}
            >
              30 dias
            </button>
          </div>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div className={styles.filterBar}>
          <button 
            className={`${styles.filterBtn} ${activeFilter === 'all' ? styles.activeAll : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <BarChart3 size={16} />
            <span>Todos os Leads</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${activeFilter === 'whatsapp' ? styles.activeWhatsapp : ''}`}
            onClick={() => setActiveFilter('whatsapp')}
          >
            <MessageCircle size={16} />
            <span>WhatsApp</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${activeFilter === 'forms' ? styles.activeForms : ''}`}
            onClick={() => setActiveFilter('forms')}
          >
            <FileText size={16} />
            <span>Formulários</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${activeFilter === 'selectors' ? styles.activeSelectors : ''}`}
            onClick={() => setActiveFilter('selectors')}
          >
            <MousePointerClick size={16} />
            <span>Seletores</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${activeFilter === 'keywords' ? styles.activeKeywords : ''}`}
            onClick={() => setActiveFilter('keywords')}
          >
            <Type size={16} />
            <span>Palavras-Chave</span>
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.blue} glass ${styles.animateFadeInUp}`}>
            <div className={styles.statLeft}>
              <div className={styles.statIcon}><TrendingUp size={22} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Leads Totais</span>
                <span className={styles.statSub}>Acumulado total (30d)</span>
              </div>
            </div>
            <h2 className={styles.statValue}>{statsSummary.totalLeads}</h2>
          </div>
          
          <div className={`${styles.statCard} ${styles.green} glass ${styles.animateFadeInUp} ${styles.delay1}`}>
            <div className={styles.statLeft}>
              <div className={styles.statIcon}><Activity size={22} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Capturas Hoje</span>
                <span className={styles.statSub}>Últimas 24 horas</span>
              </div>
            </div>
            <h2 className={styles.statValue}>{statsSummary.leadsToday}</h2>
          </div>
          
          <div className={`${styles.statCard} ${styles.purple} glass ${styles.animateFadeInUp} ${styles.delay2}`}>
            <div className={styles.statLeft}>
              <div className={styles.statIcon}><Clock size={22} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Últimos {dashboardPeriod} dias</span>
                <span className={styles.statSub}>Volume do período</span>
              </div>
            </div>
            <h2 className={styles.statValue}>{statsSummary.leadsInPeriod}</h2>
          </div>

          {isAdmin && !impersonatedName ? (
            <div className={`${styles.statCard} ${styles.orange} glass ${styles.animateFadeInUp} ${styles.delay3}`}>
              <div className={styles.statLeft}>
                <div className={styles.statIcon}><Users size={22} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Parceiros Ativos</span>
                  <span className={styles.statSub}>Clientes no sistema</span>
                </div>
              </div>
              <h2 className={styles.statValue}>{activeClientsCount}</h2>
            </div>
          ) : (
            <div className={`${styles.statCard} ${styles.orange} glass ${styles.animateFadeInUp} ${styles.delay3}`}>
              <div className={styles.statLeft}>
                <div className={styles.statIcon}><Webhook size={22} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Status do Sistema</span>
                  <div className={styles.statusContainer}>
                    <div className={`${styles.pulse} ${styles.pulseGreen}`} />
                    <span className={styles.statSub}>Última captura: {getLastLeadTime()}</span>
                  </div>
                </div>
              </div>
              <h2 className={styles.statValue}>Operacional</h2>
            </div>
          )}
        </div>

        <div className={styles.mainGrid}>
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <BarChart3 size={18} className={styles.iconPrimary} />
                <h3>Análise de Conversão</h3>
              </div>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#00D1FF', boxShadow: '0 0 10px rgba(0, 209, 255, 0.5)' }} />
                  <span>Formulários</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#25d366', boxShadow: '0 0 10px rgba(37, 211, 102, 0.5)' }} />
                  <span>WhatsApp</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#a855f7', boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)' }} />
                  <span>Seletores</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#f97316', boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)' }} />
                  <span>Palavras-Chave</span>
                </div>
              </div>
            </div>
            <div className={styles.chartArea}>
              <AnalyticsChart data={statsSummary.chartData} activeFilter={activeFilter} />
            </div>
          </div>

          {isAdmin && !impersonatedName && statsSummary.performanceData.length > 0 && (
            <div className={`${styles.chartCard} glass`}>
              <div className={styles.cardHeader}>
                <div className={styles.titleWithIcon}>
                  <Users size={18} className={styles.iconPrimary} />
                  <h3>Performance por Parceiro (Top 5)</h3>
                </div>
              </div>
              <div className={styles.performanceList}>
                {statsSummary.performanceData.map((p: any, i: number) => (
                  <div key={p.name} className={styles.perfItem}>
                    <div className={styles.perfInfo}>
                      <span className={styles.perfName}>{p.name}</span>
                      <span className={styles.perfValue}>{p.count} leads</span>
                    </div>
                    <div className={styles.perfBarContainer}>
                      <div 
                        className={styles.perfBarFill} 
                        style={{ 
                          width: `${(p.count / statsSummary.performanceData[0].count) * 100}%`,
                          background: `linear-gradient(90deg, #56d7fd, #2ecc71)`
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${styles.sideCharts} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <PieIcon size={18} className={styles.iconSuccess} />
                <h3>Divisão de Origens</h3>
              </div>
            </div>
            <div className={styles.sourcesContainer}>
              {statsSummary.sourceData.map((s: any) => {
                const percentage = statsSummary.leadsInPeriod > 0 
                  ? ((s.value / statsSummary.leadsInPeriod) * 100).toFixed(0) 
                  : '0';

                // Selecionar o ícone de forma dinâmica
                const renderIcon = () => {
                  switch (s.name) {
                    case 'WhatsApp':
                      return <MessageCircle size={18} />;
                    case 'Seletores':
                      return <MousePointerClick size={18} />;
                    case 'Palavras-Chave':
                      return <Type size={18} />;
                    case 'Formulários':
                    default:
                      return <FileText size={18} />;
                  }
                };

                return (
                  <div key={s.name} className={styles.sourcePerformanceCard}>
                    <div className={styles.sourceCardHeader}>
                      <div 
                        className={styles.sourceIconWrapper} 
                        style={{ 
                          color: s.color, 
                          background: `${s.color}15`,
                          borderColor: `${s.color}30` 
                        }}
                      >
                        {renderIcon()}
                      </div>
                      <span className={styles.sourcePercent} style={{ color: s.color }}>{percentage}%</span>
                    </div>
                    
                    <div className={styles.sourceCardBody}>
                      <span className={styles.sourceName}>{s.name}</span>
                      <h4 className={styles.sourceValue}>{s.value}</h4>
                    </div>

                    <div className={styles.sourceBarContainer}>
                      <div 
                        className={styles.sourceBarFill} 
                        style={{ 
                          width: `${percentage}%`, 
                          background: `linear-gradient(90deg, ${s.color}cc, ${s.color})`,
                          boxShadow: `0 0 10px ${s.color}40`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <div className={`${styles.utmCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <MapPin size={18} className={styles.iconWarning} />
                <h3>Top Fontes (UTMs)</h3>
              </div>
            </div>
            <div className={styles.utmList}>
              {statsSummary.topUtms.map((utm: any, i: number) => (
                <div key={utm.name} className={styles.utmItem}>
                  <div className={styles.utmInfo}>
                    <span className={styles.utmRank}>#{i + 1}</span>
                    <span className={styles.utmName}>{utm.name}</span>
                  </div>
                  <div className={styles.utmBarWrapper}>
                    <div className={styles.utmBar} style={{ width: `${(utm.value / (statsSummary.totalLeads || 1)) * 100}%` }} />
                    <span className={styles.utmValue}>
                      {utm.value} <span className={styles.separator}>•</span> {((utm.value / (statsSummary.totalLeads || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.utmCard} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <Globe size={18} className={styles.iconInfo} />
                <h3>Distribuição Geográfica</h3>
              </div>
            </div>
            <div className={styles.utmList}>
              {statsSummary.locationData.length > 0 ? statsSummary.locationData.map((loc: any, i: number) => (
                <div key={loc.name} className={styles.utmItem}>
                  <div className={styles.utmInfo}>
                    <span className={styles.utmRank}>#{i + 1}</span>
                    <span className={styles.utmName}>{loc.name}</span>
                  </div>
                  <div className={styles.utmBarWrapper}>
                    <div className={styles.locationBar} style={{ width: `${(loc.value / (statsSummary.locationData[0]?.value || 1)) * 100}%` }} />
                    <span className={styles.utmValue}>
                      {loc.value} <span className={styles.separator}>•</span> {((loc.value / (statsSummary.totalLeads || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )) : (
                <div className={styles.emptyLocations}>
                  <MapPin size={24} />
                  <p>Aguardando capturas geográficas...</p>
                </div>
              )}
            </div>
          </div>

          <div className={`${styles.logsCard} glass`}>
            <div className={styles.cardHeader}>
              <h3>Últimos Leads Recebidos</h3>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {(isAdmin && !impersonatedName) && <th>Cliente</th>}
                    <th>Lead</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statsSummary.recentLeads.map((lead) => {
                    const isSelector = lead.source === 'custom_tracker' && (
                      lead.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
                      lead.data?.match_type?.toLowerCase().includes('selector') || 
                      lead.name?.toLowerCase().includes('selector')
                    );

                    const isKeyword = lead.source === 'custom_tracker' && (
                      lead.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
                      lead.data?.match_type?.toLowerCase().includes('keyword') || 
                      lead.name?.toLowerCase().includes('keyword')
                    );

                    return (
                      <tr key={lead.id} onClick={() => setSelectedLead(lead)} className={styles.clickableRow}>
                        {(isAdmin && !impersonatedName) && (
                          <td>
                            <div className={styles.clientCell}>
                              <span className={styles.clientName}>{lead.clients?.name || 'N/A'}</span>
                              <span className={styles.webhookSub}>
                                {lead.webhooks?.name || lead.data?.captured_by?.name || 'Sem webhook'}
                              </span>
                            </div>
                          </td>
                        )}
                        <td>
                          {lead.source === 'whatsapp_tracker' ? (
                            <div className={styles.whatsappTag}>
                              <MessageCircle className={styles.whatsappIcon} />
                              <span>Whatsapp Click</span>
                            </div>
                          ) : isSelector ? (
                            <div className={styles.selectorTag}>
                              <MousePointerClick className={styles.selectorIcon} />
                              <span>Selector</span>
                            </div>
                          ) : isKeyword ? (
                            <div className={styles.keywordTag}>
                              <Type className={styles.keywordIcon} />
                              <span>Palavra-Chave</span>
                            </div>
                          ) : (
                            <div className={styles.leadInfoMini}>
                              <span className={styles.leadName}>{lead.name || 'Sem nome'}</span>
                              <span className={styles.leadEmail}>{lead.email || 'Sem e-mail'}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={styles.leadTimeWrapper}>
                            <span className={styles.leadDate}>
                              {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <span className={styles.leadTime}>
                              {new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td><span className={styles.statusBadge}>OK</span></td>
                      </tr>
                    );
                  })}
                  {statsSummary.recentLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.emptyTable}>Nenhum registro encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
      {selectedLead && (
        <div className={styles.modalOverlay} onClick={() => { setSelectedLead(null); setExportOpen(false); }}>
          <div className={`${styles.detailModal} glass`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <h3>Detalhes do Lead</h3>
                <span className={styles.modalSubtitle}>ID: {selectedLead.id}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => { setSelectedLead(null); setExportOpen(false); }}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.sectionGrid}>
                {/* Coluna 1: Perfil & Sistema */}
                <div className={styles.infoSection}>
                  <h4>Perfil & Sistema</h4>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Nome</span>
                      <span className={styles.infoVal}>{selectedLead.name || 'Sem nome'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>E-mail</span>
                      <span className={styles.infoVal}>{selectedLead.email || 'Sem e-mail'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Telefone</span>
                      <span className={styles.infoVal}>{selectedLead.phone || 'Sem telefone'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Data</span>
                      <span className={styles.infoVal}>
                        {new Date(selectedLead.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Terminal / Webhook</span>
                      <span className={styles.infoVal}>
                        {selectedLead.webhooks?.name || selectedLead.data?.captured_by?.name || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>IP</span>
                      <span className={styles.infoVal}>{selectedLead.data?.location?.ip || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Localização</span>
                      <span className={styles.infoVal}>
                        {selectedLead.data?.location?.city 
                          ? `${decodeURIComponent(selectedLead.data.location.city)}/${decodeURIComponent(selectedLead.data.location.region || '')} (${selectedLead.data.location.country || 'BR'})`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Sistema Operacional</span>
                      <span className={styles.infoVal}>{selectedLead.data?.device?.os || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Dispositivo</span>
                      <span className={styles.infoVal}>{selectedLead.data?.device?.is_mobile ? 'Mobile' : 'Desktop'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Idioma</span>
                      <span className={styles.infoVal}>{selectedLead.data?.device?.language || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Timezone</span>
                      <span className={styles.infoVal}>{selectedLead.data?.device?.timezone || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Resolução</span>
                      <span className={styles.infoVal}>{selectedLead.data?.device?.screen || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Comportamento & Consentimento */}
                <div className={styles.infoSection}>
                  <h4>Comportamento & Engajamento</h4>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Origem do Lead</span>
                      <span className={styles.infoVal}>
                        <span className={selectedLead.source === 'whatsapp_tracker' ? styles.whatsappTag : (selectedLead.source === 'custom_tracker' ? styles.selectorTag : styles.statusBadge)}>
                          {selectedLead.source === 'whatsapp_tracker' ? 'WhatsApp Click' : (selectedLead.source === 'custom_tracker' ? 'Rastreador' : 'Formulário')}
                        </span>
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Página de Origem</span>
                      <span className={styles.infoVal} title={selectedLead.data?.behavior?.page_url || selectedLead.data?.page_url || 'N/A'}>
                        {selectedLead.data?.behavior?.page_url || selectedLead.data?.page_url || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Ação / Botão</span>
                      <span className={styles.infoVal}>{selectedLead.data?.behavior?.button_text || selectedLead.data?.button_text || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Tempo Ativo na Pág.</span>
                      <span className={styles.infoVal}>{selectedLead.data?.behavior?.time_on_page || selectedLead.data?.time_on_page || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Rolagem Máxima</span>
                      <span className={styles.infoVal}>{selectedLead.data?.behavior?.scroll_depth || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Duração da Sessão</span>
                      <span className={styles.infoVal}>
                        {selectedLead.data?.behavior?.session_duration_seconds !== undefined 
                          ? `${selectedLead.data.behavior.session_duration_seconds}s`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Tempo p/ Conversão</span>
                      <span className={styles.infoVal}>
                        {selectedLead.data?.behavior?.conversion_time_seconds !== undefined 
                          ? `${selectedLead.data.behavior.conversion_time_seconds}s`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Score do Lead</span>
                      <span className={styles.infoVal} style={{ fontWeight: '800', color: selectedLead.data?.lead_score >= 70 ? '#2ecc71' : (selectedLead.data?.lead_score >= 40 ? '#f59e0b' : '#3498db') }}>
                        {selectedLead.data?.lead_score !== undefined ? `${selectedLead.data.lead_score}/100` : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Consentimento LGPD</span>
                      <span className={styles.infoVal}>
                        {selectedLead.data?.consent_given !== undefined 
                          ? (selectedLead.data.consent_given ? '✅ Autorizado' : '❌ Negado')
                          : 'Não especificado'}
                      </span>
                    </div>
                    {selectedLead.data?.consent_timestamp && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Data Consentimento</span>
                        <span className={styles.infoVal}>{new Date(selectedLead.data.consent_timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 3: Aquisição & UTMs */}
                <div className={styles.infoSection}>
                  <h4>Aquisição & UTMs</h4>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Source</span>
                      <span className={styles.infoVal}>{selectedLead.data?.marketing?.source || selectedLead.data?.utm_source || 'Direto / Orgânico'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Medium</span>
                      <span className={styles.infoVal}>{selectedLead.data?.marketing?.medium || selectedLead.data?.utm_medium || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Campaign</span>
                      <span className={styles.infoVal}>{selectedLead.data?.marketing?.campaign || selectedLead.data?.utm_campaign || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Term</span>
                      <span className={styles.infoVal}>{selectedLead.data?.marketing?.term || selectedLead.data?.utm_term || 'N/A'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Content</span>
                      <span className={styles.infoVal}>{selectedLead.data?.marketing?.content || selectedLead.data?.utm_content || 'N/A'}</span>
                    </div>
                    {selectedLead.data?.marketing?.gclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Google Ads ID</span>
                        <span className={styles.infoVal} title={selectedLead.data.marketing.gclid}>GCLID (Ativo)</span>
                      </div>
                    )}
                    {selectedLead.data?.marketing?.fbclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Facebook Ads ID</span>
                        <span className={styles.infoVal} title={selectedLead.data.marketing.fbclid}>FBCLID (Ativo)</span>
                      </div>
                    )}
                    {selectedLead.data?.marketing?.ttclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>TikTok Ads ID</span>
                        <span className={styles.infoVal} title={selectedLead.data.marketing.ttclid}>TTCLID (Ativo)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Jornada de Navegação do Visitante */}
              {selectedLead.data?.marketing?.journey && selectedLead.data.marketing.journey.length > 0 && (
                <div className={styles.extraFieldsArea}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Jornada do Visitante (Histórico de Páginas)</h4>
                  <div className={styles.infoSection}>
                    <div className={styles.journeyTimeline}>
                      {selectedLead.data.marketing.journey.map((step: any, index: number) => (
                        <div key={index} className={styles.journeyStep}>
                          <div className={styles.journeyDot} />
                          <span className={styles.journeyUrl}>
                            {step.url || step.page_url || 'URL desconhecida'}
                          </span>
                          <span className={styles.journeyTime}>
                            {step.timestamp ? new Date(step.timestamp).toLocaleString('pt-BR') : 'Data não registrada'}
                            {step.referrer && ` • Referência: ${step.referrer}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Campos Extras (Formulário) */}
              {selectedLead.data && Object.keys(selectedLead.data).some(k => 
                !['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp', 'source', 'name', 'email', 'phone', 'fields', 'session_id', 'visitor_id', 'device', 'timestamp', 'lead_id', 'event_hash'].includes(k)
              ) && (
                <div className={styles.extraFieldsArea}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Campos Customizados do Formulário</h4>
                  <div className={styles.infoSection} style={{ gap: '0.75rem' }}>
                    {Object.keys(selectedLead.data).filter(k => 
                      !['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp', 'source', 'name', 'email', 'phone', 'fields', 'session_id', 'visitor_id', 'device', 'timestamp', 'lead_id', 'event_hash'].includes(k)
                    ).map(k => (
                      <div key={k} className={styles.infoRow}>
                        <span className={styles.infoLabel}>{k}</span>
                        <span className={styles.infoVal}>{String(selectedLead.data[k])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.exportDropdownWrapper}>
                <button className={styles.exportBtn} onClick={() => setExportOpen(!exportOpen)}>
                  <Download size={16} />
                  <span>Exportar Lead</span>
                </button>
                <div className={`${styles.exportMenu} ${exportOpen ? styles.open : ''}`}>
                  <button className={styles.exportMenuItem} onClick={() => handleExport('csv')}>
                    <TableIcon size={14} /> <span>CSV</span>
                  </button>
                  <button className={styles.exportMenuItem} onClick={() => handleExport('json')}>
                    <FileJson size={14} /> <span>JSON</span>
                  </button>
                  <button className={styles.exportMenuItem} onClick={() => handleExport('pdf')}>
                    <FileDown size={14} /> <span>PDF</span>
                  </button>
                </div>
              </div>
              <button className={styles.exportBtn} style={{ borderColor: 'rgba(255,255,255,0.1)' }} onClick={() => { setSelectedLead(null); setExportOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {exportType.show && selectedLead && (
        <ExportModal 
          format={exportType.type}
          leads={[selectedLead]}
          onConfirm={(password, selectedFields) => processExport(password, selectedFields)}
          onCancel={() => setExportType({ show: false, type: '' })}
        />
      )}
    </DashboardLayout>
  );
}
