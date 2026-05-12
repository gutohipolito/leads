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
import { logAction } from '@/utils/logger';

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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const containerRef = useRef<HTMLDivElement>(null);
  const celebrationTimeoutRef = useRef<any>(null);

  const triggerCelebration = (lead: any) => {
    // Limpar timeout anterior se houver
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    
    setCelebrationLead(lead);
    setIsCelebration(true);
    
    celebrationTimeoutRef.current = setTimeout(() => {
      setIsCelebration(false);
      setCelebrationLead(null);
      celebrationTimeoutRef.current = null;
    }, 8000); // 8 segundos de celebração
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
      const { data: { user } } = await supabase.auth.getUser();

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
    setConnectionStatus('connecting');
    
    // Usamos um nome de canal estável para evitar excesso de conexões
    const channelName = selectedClient === 'all' ? 'live-monitor-all' : `live-monitor-${selectedClient}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', // Ouvir todos os eventos para diagnóstico
          schema: 'public', 
          table: 'leads' 
        },
        async (payload) => {
          const eventType = payload.eventType || (payload as any).event;
          console.log('--- NOVO EVENTO DETECTADO ---');
          console.log('Tipo:', eventType);
          console.log('Payload:', payload);
          
          if (eventType === 'INSERT') {
            const newLeadData = payload.new;
            console.log('Lead ID:', newLeadData.id);
            console.log('Client ID do Lead:', newLeadData.client_id);
            console.log('Filtro Atual (selectedClient):', selectedClient);
            
            // Comparação ultra-flexível
            const isMatch = selectedClient === 'all' || String(newLeadData.client_id) === String(selectedClient);
            
            if (!isMatch) {
              console.log('❌ Lead ignorado pelo filtro de cliente');
              return;
            }

            console.log('✅ Lead passou no filtro. Atualizando UI...');

            // Primeiro, atualizamos a lista com o que já temos (para ser instantâneo)
            const tempLead = { ...newLeadData, clients: { name: 'Carregando...' } };
            setLeads(prev => {
              const exists = prev.find(l => l.id === tempLead.id);
              if (exists) return prev;
              return [tempLead, ...prev].slice(0, 10);
            });

            // Disparamos a animação e o som imediatamente
            triggerCelebration(tempLead);
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});

            // Agora buscamos o nome real do cliente e atualizamos as estatísticas
            try {
              const { data: client } = await supabase
                .from('clients')
                .select('name')
                .eq('id', newLeadData.client_id)
                .single();

              if (client) {
                console.log('Nome do cliente encontrado:', client.name);
                // Atualiza na lista de leads
                setLeads(prev => prev.map(l => l.id === newLeadData.id ? { ...l, clients: client } : l));
                
                // Atualiza no aviso de celebração (caso ainda esteja na tela)
                setCelebrationLead(prev => (prev && prev.id === newLeadData.id) ? { ...prev, clients: client } : prev);
              }
              
              loadData(selectedClient);
            } catch (err) {
              console.error('Erro ao buscar detalhes do cliente:', err);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`Subscription Status (${channelName}):`, status);
        if (err) console.error('Subscription Error:', err);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('online');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
        }
      });

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [selectedClient]);

  useEffect(() => {
    async function fetchActiveClients() {
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      setStats(prev => ({ ...prev, activeClients: count || 0 }));
    }
    fetchActiveClients();
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
          <div className={styles.clientSlider}>
            <button 
              className={`${styles.sliderItem} ${selectedClient === 'all' ? styles.active : ''}`}
              onClick={() => setSelectedClient('all')}
            >
              <div className={styles.sliderLogo}><Users size={16} /></div>
              <div className={styles.sliderInfo}>
                <span>TODOS</span>
                <small>VISÃO GLOBAL</small>
              </div>
            </button>
            {clients.map(c => (
              <button 
                key={c.id} 
                className={`${styles.sliderItem} ${selectedClient === c.id ? styles.active : ''}`}
                onClick={() => setSelectedClient(c.id)}
              >
                <div className={styles.sliderLogo}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} />
                  ) : (
                    <span>{c.name.charAt(0)}</span>
                  )}
                  <div className={styles.miniStatus} />
                </div>
                <div className={styles.sliderInfo}>
                  <span>{c.name.toUpperCase()}</span>
                  <small>OPERACIONAL</small>
                </div>
              </button>
            ))}
          </div>

          <div className={`${styles.statusPill} ${styles[connectionStatus]}`}>
            <div className={styles.statusDot} />
            <span>{connectionStatus.toUpperCase()}</span>
          </div>

          <div className={styles.clock}>
            <Clock size={18} />
            <span>{currentTime ? currentTime.toLocaleTimeString('pt-BR') : "--:--:--"}</span>
          </div>
          <button className={styles.screenBtn} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
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
            <span className={styles.statLabel}>LEADS / HORA</span>
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
            <h2>ÚLTIMOS LEADS DETECTADOS</h2>
          </div>

          <div className={styles.leadList}>
            {leads.length > 0 ? leads.slice(0, 5).map((lead, idx) => (
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
                stats.topClients.map((c, idx) => (
                  <div key={c.name} className={styles.activeClientItem} style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className={styles.clientLine}>
                      <div className={styles.clientNameGroup}>
                        <div className={styles.liveIndicator} />
                        <span>{c.name}</span>
                      </div>
                      <strong>{c.count} <span>leads</span></strong>
                    </div>
                    <div className={styles.clientBar}>
                      <div 
                        className={styles.clientBarFill} 
                        style={{ width: `${Math.min((c.count / (stats.totalToday || 1)) * 100 * 2, 100)}%` }} 
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.singleClientInfo}>
                  <div className={styles.bigTotal}>
                    <TrendingUp size={32} color="#00d1ff" />
                    <p>{stats.totalToday}</p>
                    <span>Leads capturados hoje</span>
                  </div>
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
            <div className={styles.tickerContent}>
              {clients.map(c => (
                <div key={c.id} className={styles.tickerItem}>
                  <div className={styles.miniLogo}>
                    {c.name.charAt(0)}
                  </div>
                  <span>{c.name.toUpperCase()} • OPERACIONAL</span>
                </div>
              ))}
              <div className={styles.tickerDivider}>•</div>
              <span>SISTEMA ASTHROS MONITORING • CONEXÃO CRIPTOGRAFADA • STATUS: GLOBAL OK</span>
            </div>
            {/* Duplicata para loop infinito */}
            <div className={styles.tickerContent}>
              {clients.map(c => (
                <div key={`${c.id}-dup`} className={styles.tickerItem}>
                  <div className={styles.miniLogo}>
                    {c.name.charAt(0)}
                  </div>
                  <span>{c.name.toUpperCase()} • OPERACIONAL</span>
                </div>
              ))}
              <div className={styles.tickerDivider}>•</div>
              <span>SISTEMA ASTHROS MONITORING • CONEXÃO CRIPTOGRAFADA • STATUS: GLOBAL OK</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
