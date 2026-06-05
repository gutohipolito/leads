'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3, TrendingUp, PieChart as PieIcon, MapPin, Tv, Zap, Bell, BellOff, Globe, MessageCircle, MousePointerClick, Type, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AnalyticsChart from '@/components/DashboardCharts/AnalyticsChart';
import Loader from '@/components/Loader/Loader';

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
                      <tr key={lead.id}>
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
    </DashboardLayout>
  );
}
