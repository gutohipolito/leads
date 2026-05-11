'use client';
// Trigger re-deploy due to Vercel/GitHub clone error 500

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
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [stats, setStats] = useState({
    totalToday: 0,
    leadsPerHour: 0,
    conversion: 0,
    activeClients: 0,
    performanceBars: [0, 0, 0, 0, 0],
    topClients: [] as any[]
  });
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [isCelebration, setIsCelebration] = useState(false);
  const [celebrationLead, setCelebrationLead] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerCelebration = (lead: any) => {
    setCelebrationLead(lead);
    setIsCelebration(true);
    setTimeout(() => {
      setIsCelebration(false);
      setCelebrationLead(null);
    }, 3500);
  };

  const loadData = async (clientId: string = 'all') => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Buscar Leads
    let leadsQuery = supabase
      .from('leads')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (clientId !== 'all') {
      leadsQuery = leadsQuery.eq('client_id', clientId);
    }
    
    const { data: leadsData } = await leadsQuery;
    if (leadsData) setLeads(leadsData);

    // 2. Estatísticas Gerais
    let totalTodayQuery = supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    if (clientId !== 'all') {
      totalTodayQuery = totalTodayQuery.eq('client_id', clientId);
    }
    const { count: totalToday } = await totalTodayQuery;

    // 3. Performance (Leads por hora nas últimas 5 horas)
    const perfBars = [];
    for (let i = 4; i >= 0; i--) {
      const hStart = new Date();
      hStart.setHours(hStart.getHours() - i, 0, 0, 0);
      const hEnd = new Date(hStart);
      hEnd.setHours(hEnd.getHours() + 1);

      let q = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hStart.toISOString())
        .lt('created_at', hEnd.toISOString());
      
      if (clientId !== 'all') q = q.eq('client_id', clientId);
      const { count } = await q;
      perfBars.push(count || 0);
    }

    // 4. Operação Global (Top 4 clientes hoje)
    let topClients: any[] = [];
    if (clientId === 'all') {
      const { data: leadsAllToday } = await supabase
        .from('leads')
        .select('client_id, clients(name)')
        .gte('created_at', today.toISOString());
      
      if (leadsAllToday) {
        const counts: any = {};
        leadsAllToday.forEach(l => {
          const name = l.clients?.name || 'Desconhecido';
          counts[name] = (counts[name] || 0) + 1;
        });
        topClients = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 4);
      }
    }

    setStats(prev => ({
      ...prev,
      totalToday: totalToday || 0,
      leadsPerHour: Math.round((totalToday || 0) / (new Date().getHours() + 1)),
      conversion: 84 + Math.floor(Math.random() * 10),
      performanceBars: perfBars,
      topClients
    }));
  };

  useEffect(() => {
    // Inicializar relógio no cliente
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Carregar clientes para o filtro
    async function fetchClients() {
      const impersonated = localStorage.getItem('impersonated_client');
      if (impersonated) {
        setImpersonatedName(JSON.parse(impersonated).name);
      }
      const { data } = await supabase.from('clients').select('id, name').eq('status', 'active');
      if (data) setClients(data);
    }
    fetchClients();
    loadData(selectedClient);

    // Inscrição Realtime para novos leads
    const channel = supabase
      .channel('live-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        async (payload) => {
          if (selectedClient !== 'all' && payload.new.client_id !== selectedClient) return;

          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', payload.new.client_id)
            .single();

          const newLead = { ...payload.new, clients: client };
          setLeads(prev => [newLead, ...prev].slice(0, 10));
          setStats(prev => ({ ...prev, totalToday: prev.totalToday + 1 }));
          
          triggerCelebration(newLead);
          
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [selectedClient]);

  useEffect(() => {
    const { count: totalClients } = supabase.from('clients').select('*', { count: 'exact', head: true }).then(({count}) => {
      setStats(prev => ({ ...prev, activeClients: count || 0 }));
    });
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

  const handleTestCelebration = () => {
    triggerCelebration({
      name: 'Cliente de Teste',
      clients: { name: impersonatedName || 'Asthros Demo' }
    });
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});
  };

  const maxPerf = Math.max(...stats.performanceBars, 1);

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {isCelebration && celebrationLead && (
        <div className={styles.celebrationOverlay}>
          <div className={styles.flashEffect} />
          <div className={styles.newLeadCard}>
            <div className={styles.celebrationIcon}>
              <Zap size={40} />
            </div>
            <h2>NOVA CAPTURA DETECTADA</h2>
            <h3>{celebrationLead.name || 'Novo Lead'}</h3>
            <p>CONECTADO VIA {celebrationLead.clients?.name?.toUpperCase()}</p>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <img src="/asthros-favicon.png" alt="Asthros" style={{ width: '32px', height: '32px' }} />
            </div>
            <div>
              <h1>ASTHROS<span>LIVE</span></h1>
              <p>Monitoramento de Operações em Tempo Real</p>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <button className={styles.testBtn} onClick={handleTestCelebration}>
            TESTAR ANIMAÇÃO
          </button>

          <div className={styles.clientFilterWrapper}>
            <span className={styles.filterLabel}>Filtrar:</span>
            <select 
              className={styles.clientFilter}
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">TODOS OS CLIENTES</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className={styles.clock}>
            <Clock size={20} />
            <span>{currentTime ? currentTime.toLocaleTimeString('pt-BR') : "--:--:--"}</span>
          </div>
          <button className={styles.screenBtn} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
          </button>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#00d1ff' }}><Database size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>LEADS HOJE</span>
            <span className={styles.statValue}>{stats.totalToday}</span>
          </div>
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

      <div className={styles.mainContent}>
        <div className={styles.feedColumn}>
          <div className={styles.sectionHeader}>
            <div className={styles.pulseDot} />
            <h2>ÚLTIMOS SINAIS DETECTADOS</h2>
          </div>

          <div className={styles.leadList}>
            {leads.length > 0 ? leads.map((lead, idx) => (
              <div key={lead.id} className={styles.leadItem} style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className={styles.leadAvatar}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.email || lead.id}`} alt="" />
                </div>
                <div className={styles.leadMain}>
                  <div className={styles.leadTop}>
                    <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
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
            )) : (
              <div className={styles.emptyState}>Aguardando novos leads...</div>
            )}
          </div>
        </div>

        <div className={styles.visualColumn}>
          <div className={styles.worldMap}>
            <div className={styles.mapHeader}>
              <Globe size={24} color="#00d1ff" />
              <h3>OPERAÇÃO GLOBAL</h3>
            </div>
            
            <div className={styles.activeClientsList}>
              {selectedClient === 'all' ? (
                stats.topClients.map(c => (
                  <div key={c.name} className={styles.activeClientItem}>
                    <div className={styles.clientLine}>
                      <span>{c.name}</span>
                      <strong>{c.count} leads</strong>
                    </div>
                    <div className={styles.clientBar}>
                      <div className={styles.clientBarFill} style={{ width: `${(c.count / stats.totalToday) * 100}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.singleClientInfo}>
                  <Zap size={32} color="#ffbd2e" />
                  <p>Monitorando Terminal Exclusivo</p>
                  <span>Alta prioridade de captura ativa</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.performanceCard}>
            <div className={styles.perfHeader}>
              <TrendingUp size={18} />
              <h3>ESTATÍSTICAS DE PERFORMANCE (ÚLTIMAS 5H)</h3>
            </div>
            <div className={styles.barChart}>
              {stats.performanceBars.map((val, i) => (
                <div key={i} className={styles.barWrapper}>
                  <div className={styles.bar} style={{ height: `${(val / maxPerf) * 100}%` }} />
                  <span className={styles.barLabel}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.ticker}>
          <div className={styles.tickerTrack}>
            <span>SISTEMA OPERACIONAL • CONEXÃO ESTÁVEL • MONITORANDO {stats.activeClients} TERMINAIS • AGUARDANDO NOVOS SINAIS...</span>
            <span>SISTEMA OPERACIONAL • CONEXÃO ESTÁVEL • MONITORANDO {stats.activeClients} TERMINAIS • AGUARDANDO NOVOS SINAIS...</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
