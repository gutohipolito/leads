'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3, TrendingUp, PieChart as PieIcon, MapPin, Tv, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AnalyticsChart from '@/components/DashboardCharts/AnalyticsChart';
import Loader from '@/components/Loader/Loader';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsToday: 0,
    leads7Days: 0,
    activeClientsCount: 0,
    chartData: [] as any[],
    sourceData: [] as any[],
    topUtms: [] as any[],
    recentLeads: [] as any[],
    lastSignalTime: null as number | null
  });
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('system_users')
          .select('*')
          .eq('email', user.email)
          .single();

        const isUserAdmin = profile?.role === 'admin';
        const clientId = profile?.client_id;
        setIsAdmin(isUserAdmin);

        // Checar Impersonação
        const impersonated = localStorage.getItem('impersonated_client');
        let activeClientId = clientId;
        
        if (isUserAdmin && impersonated) {
          const impData = JSON.parse(impersonated);
          activeClientId = impData.id;
          setImpersonatedName(impData.name);
        } else {
          setImpersonatedName(null);
        }

        // 1. Total Leads (Filtrando simulações)
        const { count: totalLeads } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .neq('source', 'test_simulation')
          .match(isUserAdmin && !impersonated ? {} : { client_id: activeClientId });

        // 2. Todos os Leads para Analytics (Filtrando simulações)
        let analyticsQuery = supabase
          .from('leads')
          .select('created_at, source, data')
          .neq('source', 'test_simulation');
        
        if (!(isUserAdmin && !impersonated)) {
          analyticsQuery = analyticsQuery.eq('client_id', activeClientId);
        }
        
        const { data: allLeadsRaw } = await analyticsQuery;
        const allLeads = allLeadsRaw || [];

        // 3. Buscar Clientes Ativos (apenas para Admin real, não no modo impersonação)
        let activeClientsCount = 0;
        if (isUserAdmin && !impersonated) {
          const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active');
          activeClientsCount = count || 0;
        }

        // 4. Buscar Últimos Leads
        let recentLeadsQuery = supabase
          .from('leads')
          .select('*, clients (name)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!(isUserAdmin && !impersonated)) {
          recentLeadsQuery = recentLeadsQuery.eq('client_id', activeClientId);
        }
        const { data: recentLeads } = await recentLeadsQuery;

        // 4. Cálculos e Gráfico
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Dados de Origem (WhatsApp vs Form)
        const wppCount = allLeads?.filter(l => l.source === 'whatsapp_tracker').length || 0;
        const formCount = (allLeads?.length || 0) - wppCount;
        const sourceData = [
          { name: 'WhatsApp', value: wppCount, color: '#25d366' },
          { name: 'Formulários', value: formCount, color: '#56d7fd' }
        ];

        // Dados de UTMs
        const utmMap: any = {};
        allLeads?.forEach(l => {
          const utm = l.data?.marketing?.source || l.data?.utm_source || 'Direto / Orgânico';
          utmMap[utm] = (utmMap[utm] || 0) + 1;
        });
        const topUtms = Object.entries(utmMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a: any, b: any) => (b.value as number) - (a.value as number))
          .slice(0, 5);

        const chartData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const dayEnd = dayStart + 24 * 60 * 60 * 1000;
          
          const count = allLeads?.filter(l => {
            const ts = new Date(l.created_at).getTime();
            return ts >= dayStart && ts < dayEnd;
          }).length || 0;

          return { date: dateStr, leads: count };
        });

        const lastLead = recentLeads?.[0];
        const lastSignalTime = lastLead ? new Date(lastLead.created_at).getTime() : null;

        setStats({
          totalLeads: totalLeads || 0,
          leadsToday: allLeads?.filter(l => l.created_at >= todayStart).length || 0,
          leads7Days: allLeads?.filter(l => l.created_at >= weekStart).length || 0,
          activeClientsCount,
          chartData,
          sourceData,
          topUtms,
          recentLeads: recentLeads || [],
          lastSignalTime
        });
      }
      setLoading(false);
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="">
        <Loader text="Sincronizando Dashboard" />
      </DashboardLayout>
    );
  }

  const dashboardTitle = impersonatedName ? `Dashboard: ${impersonatedName}` : (isAdmin ? "Dashboard Administrador" : "Dashboard do Cliente");

  const getLastLeadTime = () => {
    if (!stats.lastSignalTime) return 'Nenhuma captura';
    const mins = Math.floor((Date.now() - stats.lastSignalTime) / 60000);
    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <DashboardLayout title={
      <Link href="/admin/live" className={styles.liveStatusPill}>
        <div className={styles.liveIndicator}>
          <div className={styles.pulseDot} />
          <Tv size={16} />
        </div>
        <span className={styles.liveLabel}>Monitor ao Vivo</span>
      </Link>
    }>
      <div className={styles.dashboard}>
        
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><TrendingUp size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Leads Totais</span>
              <h2 className={styles.statValue}>{stats.totalLeads}</h2>
              <span className={styles.statSub}>Acumulado total</span>
            </div>
          </div>
          
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Activity size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Capturas Hoje</span>
              <h2 className={styles.statValue}>{stats.leadsToday}</h2>
              <span className={styles.statSub}>Últimas 24 horas</span>
            </div>
          </div>
          
          <div className={`${styles.statCard} glass`}>
            <div className={styles.statIcon}><Clock size={20} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Últimos 7 dias</span>
              <h2 className={styles.statValue}>{stats.leads7Days}</h2>
              <span className={styles.statSub}>Volume semanal</span>
            </div>
          </div>

          {isAdmin && !impersonatedName ? (
            <div className={`${styles.statCard} glass`}>
              <div className={styles.statIcon}><Users size={20} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Parceiros Ativos</span>
                <h2 className={styles.statValue}>{stats.activeClientsCount}</h2>
                <span className={styles.statSub}>Clientes no sistema</span>
              </div>
            </div>
          ) : (
            <div className={`${styles.statCard} glass`}>
              <div className={styles.statIcon}><Webhook size={20} /></div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Status do Sistema</span>
                <div className={styles.statusContainer}>
                  <div className={`${styles.pulse} ${styles.pulseGreen}`} />
                  <h2 className={styles.statValue}>Operacional</h2>
                </div>
                <span className={styles.statSub}>Última captura: {getLastLeadTime()}</span>
              </div>
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
            </div>
            <div className={styles.chartArea}>
              <AnalyticsChart data={stats.chartData} />
            </div>
          </div>

          <div className={`${styles.sideCharts} glass`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWithIcon}>
                <PieIcon size={18} className={styles.iconSuccess} />
                <h3>Divisão de Origens</h3>
              </div>
            </div>
            <div className={styles.pieArea}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.sourceData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.sourceData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ background: '#0a1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {stats.sourceData.map((s: any) => (
                  <div key={s.name} className={styles.legendItem}>
                    <div className={styles.dot} style={{ background: s.color }} />
                    <span>{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
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
              {stats.topUtms.map((utm: any, i: number) => (
                <div key={utm.name} className={styles.utmItem}>
                  <div className={styles.utmInfo}>
                    <span className={styles.utmRank}>#{i + 1}</span>
                    <span className={styles.utmName}>{utm.name}</span>
                  </div>
                  <div className={styles.utmBarWrapper}>
                    <div className={styles.utmBar} style={{ width: `${(utm.value / stats.totalLeads) * 100}%` }} />
                    <span className={styles.utmValue}>{utm.value}</span>
                  </div>
                </div>
              ))}
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
                  {stats.recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      {(isAdmin && !impersonatedName) && <td>{lead.clients?.name || 'N/A'}</td>}
                      <td>
                        <div className={styles.leadInfoMini}>
                          <span className={styles.leadName}>{lead.name || 'Sem nome'}</span>
                          <span className={styles.leadEmail}>{lead.email || 'Sem e-mail'}</span>
                        </div>
                      </td>
                      <td>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                      <td><span className={styles.statusBadge}>OK</span></td>
                    </tr>
                  ))}
                  {stats.recentLeads.length === 0 && (
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
