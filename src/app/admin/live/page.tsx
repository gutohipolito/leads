'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './live.module.css';
import { 
  Database, 
  Zap, 
  TrendingUp, 
  Users, 
  Maximize2, 
  Minimize2, 
  ArrowLeft,
  Clock,
  MapPin,
  Globe
} from 'lucide-react';
import Link from 'next/link';

export default function LiveMonitorPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalToday: 0,
    leadsPerHour: 0,
    conversion: 0,
    activeClients: 0
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Relógio em tempo real
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Carregar dados iniciais
    async function loadData() {
      const today = new Date();
      today.setHours(0,0,0,0);

      const { data: leadsData } = await supabase
        .from('leads')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (leadsData) setLeads(leadsData);

      const { count: totalToday } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      setStats(prev => ({
        ...prev,
        totalToday: totalToday || 0,
        activeClients: totalClients || 0,
        leadsPerHour: Math.round((totalToday || 0) / (new Date().getHours() + 1)),
        conversion: 84 // Simulado por enquanto
      }));
    }
    loadData();

    // Inscrição Realtime para novos leads
    const channel = supabase
      .channel('live-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        async (payload) => {
          // Buscar nome do cliente para o novo lead
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', payload.new.client_id)
            .single();

          const newLead = { ...payload.new, clients: client };
          setLeads(prev => [newLead, ...prev].slice(0, 10));
          setStats(prev => ({ ...prev, totalToday: prev.totalToday + 1 }));
          
          // Som de Alerta (opcional para TV)
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><Zap size={24} fill="currentColor" /></div>
            <div>
              <h1>ASTHROS<span>LIVE</span></h1>
              <p>Monitoramento de Operações em Tempo Real</p>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.clock}>
            <Clock size={20} />
            <span>{currentTime.toLocaleTimeString('pt-BR')}</span>
          </div>
          <button className={styles.screenBtn} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
          </button>
        </div>
      </header>

      {/* KPI Section */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#00d1ff' }}><Database size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>LEADS HOJE</span>
            <span className={styles.statValue}>{stats.totalToday}</span>
          </div>
          <div className={styles.statTrend}><TrendingUp size={14} /> +12%</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#ffbd2e' }}><Zap size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>SINAIS / HORA</span>
            <span className={styles.statValue}>{stats.leadsPerHour}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#2ecc71' }}><TrendingUp size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>CONVERSÃO</span>
            <span className={styles.statValue}>{stats.conversion}%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#a29bfe' }}><Users size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>CLIENTES ATIVOS</span>
            <span className={styles.statValue}>{stats.activeClients}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        <div className={styles.feedColumn}>
          <div className={styles.sectionHeader}>
            <div className={styles.pulseDot} />
            <h2>ÚLTIMOS SINAIS DETECTADOS</h2>
          </div>

          <div className={styles.leadList}>
            {leads.map((lead, idx) => (
              <div key={lead.id} className={styles.leadItem} style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className={styles.leadAvatar}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.email}`} alt="" />
                </div>
                <div className={styles.leadMain}>
                  <div className={styles.leadTop}>
                    <span className={styles.leadName}>{lead.name}</span>
                    <span className={styles.leadClient}>{lead.clients?.name}</span>
                  </div>
                  <div className={styles.leadMeta}>
                    <span><MapPin size={12} /> Brazil</span>
                    <span><Clock size={12} /> {new Date(lead.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className={styles.leadStatus}>
                  <div className={styles.statusBadge}>CAPTURED</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.visualColumn}>
          <div className={styles.worldMap}>
            <Globe size={180} opacity={0.1} strokeWidth={1} />
            <div className={styles.mapOverlay}>
              <h3>OPERAÇÃO GLOBAL</h3>
              <p>Sincronizando com terminais WP e simuladores...</p>
            </div>
            {/* Aqui poderiam ir gráficos ou um mapa real futuramente */}
          </div>
          
          <div className={styles.performanceCard}>
            <h3>ESTATÍSTICAS DE PERFORMANCE</h3>
            <div className={styles.barChart}>
              <div className={styles.bar} style={{ height: '60%' }} />
              <div className={styles.bar} style={{ height: '80%' }} />
              <div className={styles.bar} style={{ height: '40%' }} />
              <div className={styles.bar} style={{ height: '90%' }} />
              <div className={styles.bar} style={{ height: '70%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Ticker */}
      <footer className={styles.footer}>
        <div className={styles.ticker}>
          <div className={styles.tickerTrack}>
            <span>SISTEMA OPERACIONAL • CONEXÃO ESTÁVEL • MONITORANDO 4 TERMINAIS • AGUARDANDO NOVOS SINAIS...</span>
            <span>SISTEMA OPERACIONAL • CONEXÃO ESTÁVEL • MONITORANDO 4 TERMINAIS • AGUARDANDO NOVOS SINAIS...</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
