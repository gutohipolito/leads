'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './page.module.css';
import { Users, Webhook, Activity, Shield, Clock, BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AnalyticsChart from '@/components/DashboardCharts/AnalyticsChart';
import Loader from '@/components/Loader/Loader';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsToday: 0,
    leads7Days: 0,
    activeClientsCount: 0,
    chartData: [] as any[],
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

        // 1. Buscar Leads
        let leadsQuery = supabase.from('leads').select('*', { count: 'exact' });
        if (activeClientId) {
          leadsQuery = leadsQuery.eq('client_id', activeClientId);
        }
        const { count: totalLeads, data: allLeads } = await leadsQuery;

        // 2. Buscar Clientes Ativos (apenas para Admin real, não no modo impersonação)
        let activeClientsCount = 0;
        if (isUserAdmin && !impersonated) {
          const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active');
          activeClientsCount = count || 0;
        }

        // 3. Buscar Últimos Leads
        let recentLeadsQuery = supabase
          .from('leads')
          .select('*, clients (name)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (activeClientId) {
          recentLeadsQuery = recentLeadsQuery.eq('client_id', activeClientId);
        }
        const { data: recentLeads } = await recentLeadsQuery;

        // 4. Cálculos e Gráfico
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
      <DashboardLayout title="Carregando Inteligência...">
        <Loader text="Sincronizando Dashboard" />
      </DashboardLayout>
    );
  }

  const dashboardTitle = impersonatedName ? `Dashboard: ${impersonatedName}` : (isAdmin ? "Dashboard Administrador" : "Dashboard do Cliente");

  const getLastSignalText = () => {
    if (!stats.lastSignalTime) return 'Sem Sinais';
    const mins = Math.floor((Date.now() - stats.lastSignalTime) / 60000);
    if (mins < 1) return 'Sinal: Agora';
    if (mins < 60) return `Sinal: ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Sinal: ${hours}h`;
    return `Sinal: ${Math.floor(hours / 24)}d`;
  };

  const isRecent = stats.lastSignalTime && (Date.now() - stats.lastSignalTime) < 300000; // 5 minutos

  return (
    <DashboardLayout title={dashboardTitle}>
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
                <span className={styles.statLabel}>Terminal Uplink</span>
                <div className={styles.statusContainer}>
                  <div className={`${styles.pulse} ${isRecent ? styles.pulseGreen : styles.pulseYellow}`} />
                  <h2 className={styles.statValue}>{getLastSignalText()}</h2>
                </div>
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
