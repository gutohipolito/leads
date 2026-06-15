'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Globe,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MousePointerClick,
  Type,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export default function LiveMonitorPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsToday, setLeadsToday] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [stats, setStats] = useState({
    totalToday: 0,
    leadsPerHour: 0,
    conversion: 0,
    activeClients: 0,
  });
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const handleLogoError = (clientId: string) => {
    setFailedLogos(prev => ({ ...prev, [clientId]: true }));
  };
  const [isCelebration, setIsCelebration] = useState(false);
  const [celebrationLead, setCelebrationLead] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');
  const [isNightMode, setIsNightMode] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const celebrationTimeoutRef = useRef<any>(null);

  // Monitoramento do Tema
  useEffect(() => {
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setAppTheme(activeTheme as 'dark' | 'light');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          setAppTheme(newTheme as 'dark' | 'light');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    const checkNightMode = () => {
      const hour = new Date().getHours();
      setIsNightMode(hour >= 19 || hour < 7);
    };
    checkNightMode();
    const interval = setInterval(checkNightMode, 60000);
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  // Som de notificação
  const playNotificationSound = (clientId: string) => {
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (!isSoundEnabled) return;

    const customSoundUrl = localStorage.getItem('asthros-sound-url');
    if (customSoundUrl) {
      new Audio(customSoundUrl).play().catch(() => {});
      return;
    }

    const sounds = [
      'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/2865/2865-preview.mp3'
    ];
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
      hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % sounds.length;
    new Audio(sounds[index]).play().catch(() => {});
  };

  const triggerCelebration = (lead: any) => {
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    setCelebrationLead(lead);
    setIsCelebration(true);
    celebrationTimeoutRef.current = setTimeout(() => {
      setIsCelebration(false);
      setCelebrationLead(null);
      celebrationTimeoutRef.current = null;
    }, 8000);
  };

  // Carregar dados principais
  const loadData = async (clientId: string = 'all') => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Buscar Leads de hoje
    let leadsQuery = supabase
      .from('leads')
      .select('*, clients(name, primary_color, logo_url)')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    
    if (clientId !== 'all') {
      leadsQuery = leadsQuery.eq('client_id', clientId);
    }
    
    const { data: leadsData } = await leadsQuery;
    const leadsList = leadsData || [];
    
    const { decryptLeadsList } = await import('@/utils/frontendEncryption');
    const decryptedLeads = await decryptLeadsList(leadsList);
    
    setLeadsToday(decryptedLeads);
    setLeads(decryptedLeads.slice(0, 10));

    // 2. Índice de Performance (Crescimento hoje vs média 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let last7DaysQuery = supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (clientId !== 'all') {
      last7DaysQuery = last7DaysQuery.eq('client_id', clientId);
    }
    
    const { count: last7DaysCount } = await last7DaysQuery;
    
    const avgPerDay = (last7DaysCount || 0) / 7;
    const growthIndex = avgPerDay > 0 ? Math.round((leadsList.length / avgPerDay) * 100) : 100;

    setStats(prev => ({
      ...prev,
      totalToday: leadsList.length,
      leadsPerHour: parseFloat((leadsList.length / (new Date().getHours() + 1)).toFixed(1)),
      conversion: growthIndex,
    }));
  };

  // Efeitos e Inscrição Realtime
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    async function fetchClients() {
      const impersonated = localStorage.getItem('impersonated_client');
      if (impersonated) {
        setImpersonatedName(JSON.parse(impersonated).name);
      }
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, webhooks(status)')
        .eq('status', 'active')
        .order('name');
      
      if (data) {
        const filteredClients = data.filter(client => 
          client.webhooks && client.webhooks.some((wh: any) => wh.status === 'active')
        );
        setClients(filteredClients);
      }
    }

    fetchClients();
    loadData(selectedClient);

    setConnectionStatus('connecting');
    const channelName = selectedClient === 'all' ? 'live-monitor-all' : `live-monitor-${selectedClient}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        async (payload) => {
          const newLeadRaw = payload.new;
          const isMatch = selectedClient === 'all' || String(newLeadRaw.client_id) === String(selectedClient);
          if (!isMatch) return;

          const { decryptLead, fetchEncryptionKey } = await import('@/utils/frontendEncryption');
          const key = await fetchEncryptionKey();
          const newLeadData = key ? await decryptLead(newLeadRaw, key) : newLeadRaw;

          const tempLead = { ...newLeadData, clients: { name: 'Carregando...' } };
          
          setLeads(prev => {
            if (prev.find(l => l.id === tempLead.id)) return prev;
            return [tempLead, ...prev].slice(0, 10);
          });
          setLeadsToday(prev => {
            if (prev.find(l => l.id === tempLead.id)) return prev;
            return [tempLead, ...prev];
          });

          triggerCelebration(tempLead);
          playNotificationSound(newLeadData.client_id);

          const { data: client } = await supabase.from('clients').select('name, primary_color, logo_url').eq('id', newLeadData.client_id).single();
          if (client) {
            const updatedLead = { ...tempLead, clients: client };
            setLeads(prev => prev.map(l => l.id === newLeadData.id ? updatedLead : l));
            setLeadsToday(prev => prev.map(l => l.id === newLeadData.id ? updatedLead : l));
            setCelebrationLead(prev => (prev && prev.id === newLeadData.id) ? updatedLead : prev);
          }
          loadData(selectedClient);
        }
      )
      .subscribe((status, err) => {
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

  // Carrega número total de clientes ativos
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

  // Agregações em Memória Reativas
  const statsSummary = useMemo(() => {
    // 1. Divisão de Origens
    const wppCount = leadsToday.filter(l => l.source === 'whatsapp_tracker').length;
    const selectorCount = leadsToday.filter(l => 
      l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
        l.data?.match_type?.toLowerCase().includes('selector') || 
        l.name?.toLowerCase().includes('selector')
      )
    ).length;
    const keywordCount = leadsToday.filter(l => 
      l.source === 'custom_tracker' && (
        l.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
        l.data?.match_type?.toLowerCase().includes('keyword') || 
        l.name?.toLowerCase().includes('keyword')
      )
    ).length;
    const formCount = leadsToday.length - wppCount - selectorCount - keywordCount;

    const sourceData = [
      { name: 'WhatsApp', value: wppCount, color: '#25d366' },
      { name: 'Formulários', value: formCount, color: '#00D1FF' },
      { name: 'Seletores', value: selectorCount, color: '#a855f7' },
      { name: 'Palavras-Chave', value: keywordCount, color: '#f97316' }
    ].filter(s => s.value > 0);

    // 2. Top Cidades (Geografia)
    const locMap: any = {};
    leadsToday.forEach(l => {
      let city = l.data?.location?.city || 'Desconhecida';
      if (city && city !== 'Desconhecida' && city !== 'null' && city !== 'undefined') {
        city = decodeURIComponent(city);
        locMap[city] = (locMap[city] || 0) + 1;
      }
    });
    const topLocations = Object.entries(locMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);

    // 3. Top UTMs (Origens de Tráfego)
    const utmMap: any = {};
    leadsToday.forEach(l => {
      let utm = l.data?.marketing?.source || l.data?.utm_source || 'Direto / Orgânico';
      if (utm) {
        utm = decodeURIComponent(utm);
        utmMap[utm] = (utmMap[utm] || 0) + 1;
      }
    });
    const topUtms = Object.entries(utmMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);

    // 4. Performance por Parceiro (se global) ou Quebra do Cliente
    const clientMap: any = {};
    leadsToday.forEach(l => {
      const cName = l.clients?.name || 'Desconhecido';
      clientMap[cName] = (clientMap[cName] || 0) + 1;
    });
    const clientPerformance = Object.entries(clientMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);

    // 5. Histórico por hora de Hoje (últimas 12 horas)
    const hourlyData = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setHours(d.getHours() - (11 - i));
      const hourStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const targetHour = d.getHours();
      
      const hourLeads = leadsToday.filter(l => {
        const leadDate = new Date(l.created_at);
        return leadDate.getHours() === targetHour;
      });

      const hourWpp = hourLeads.filter(l => l.source === 'whatsapp_tracker').length;
      const hourSel = hourLeads.filter(l => 
        l.source === 'custom_tracker' && (
          l.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
          l.data?.match_type?.toLowerCase().includes('selector') || 
          l.name?.toLowerCase().includes('selector')
        )
      ).length;
      const hourKey = hourLeads.filter(l => 
        l.source === 'custom_tracker' && (
          l.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
          l.data?.match_type?.toLowerCase().includes('keyword') || 
          l.name?.toLowerCase().includes('keyword')
        )
      ).length;
      const hourForm = hourLeads.length - hourWpp - hourSel - hourKey;

      return {
        hour: hourStr.split(':')[0] + 'h',
        leads: hourLeads.length,
        whatsapp: hourWpp,
        forms: hourForm,
        selectors: hourSel,
        keywords: hourKey
      };
    });

    return {
      sourceData,
      topLocations,
      topUtms,
      clientPerformance,
      hourlyData
    };
  }, [leadsToday]);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 200;
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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
    <div className={`${styles.wrapper} ${appTheme === 'light' ? styles.lightMode : ''} ${isNightMode && appTheme === 'dark' ? styles.nightMode : ''}`} ref={containerRef}>
      
      {/* Overlay de Celebração */}
      {isCelebration && celebrationLead && (
        <div className={styles.celebrationOverlay}>
          <div className={styles.flashEffect} />
          <div className={styles.newLeadCard}>
            <div className={styles.celebrationIcon}>
              <Zap size={40} />
            </div>
            <h2>NOVA CAPTURA DETECTADA</h2>
            <h3>{celebrationLead.name || 'Novo Lead'}</h3>
            <div className={styles.celebrationSource}>
              {celebrationLead.source === 'whatsapp_tracker' ? (
                <><MessageCircle size={16} /> <span>VIA WHATSAPP</span></>
              ) : (celebrationLead.source === 'custom_tracker' && (
                celebrationLead.data?.behavior?.match_type?.toLowerCase().includes('selector') || 
                celebrationLead.data?.match_type?.toLowerCase().includes('selector') || 
                celebrationLead.name?.toLowerCase().includes('selector')
              )) ? (
                <><MousePointerClick size={16} /> <span>VIA SELETOR</span></>
              ) : (celebrationLead.source === 'custom_tracker' && (
                celebrationLead.data?.behavior?.match_type?.toLowerCase().includes('keyword') || 
                celebrationLead.data?.match_type?.toLowerCase().includes('keyword') || 
                celebrationLead.name?.toLowerCase().includes('keyword')
              )) ? (
                <><Type size={16} /> <span>VIA PALAVRA-CHAVE</span></>
              ) : celebrationLead.source === 'custom_tracker' ? (
                <><Zap size={16} /> <span>VIA BOTÃO</span></>
              ) : (
                <><FileText size={16} /> <span>VIA FORMULÁRIO</span></>
              )}
            </div>
            <p>CONECTADO VIA {celebrationLead.clients?.name?.toUpperCase()}</p>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.logo}>
            <div className={`${styles.logoIcon} ${styles.logoPulse}`}>
              <img src="/asthros-favicon.png" alt="Asthros" style={{ width: '32px', height: '32px' }} />
            </div>
            <div>
              <h1><span>live</span></h1>
              <p>Monitoramento de Operações em Tempo Real</p>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.sliderContainer}>
            <button className={`${styles.sliderArrow} ${styles.left}`} onClick={() => scrollSlider('left')}><ChevronLeft size={18} /></button>
            <div className={styles.clientSlider} ref={sliderRef}>
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
                    {c.logo_url && !failedLogos[c.id] ? (
                      <img 
                        src={c.logo_url} 
                        alt={c.name} 
                        onError={() => handleLogoError(c.id)}
                      />
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
            <button className={`${styles.sliderArrow} ${styles.right}`} onClick={() => scrollSlider('right')}><ChevronRight size={18} /></button>
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

      {/* Grid de Métricas Superiores */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.blue} glass`}>
          <div className={styles.statIcon} style={{ color: '#00d1ff' }}><Database size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>TOTAL HOJE</span>
            <span className={styles.statValue}>{stats.totalToday}</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.green} glass`}>
          <div className={styles.statIcon} style={{ color: '#2ecc71' }}><Zap size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>LEADS / HORA</span>
            <span className={styles.statValue}>{stats.leadsPerHour}</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.yellow} glass`}>
          <div className={styles.statIcon} style={{ color: '#f1c40f' }}><TrendingUp size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>ÍNDICE PERF.</span>
            <span className={styles.statValue}>{stats.conversion}%</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.purple} glass`}>
          <div className={styles.statIcon} style={{ color: '#a29bfe' }}><Users size={24} /></div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>PARCEIROS</span>
            <span className={styles.statValue}>{stats.activeClients}</span>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal de 3 Colunas */}
      <div className={styles.mainContent}>
        
        {/* COLUNA 1: Feed de Leads (30% width) */}
        <div className={styles.feedColumn}>
          <div className={styles.sectionHeader}>
            <div className={styles.liveIndicator} />
            <h2>FEED DE CAPTURAS AO VIVO</h2>
          </div>

          <div className={styles.leadList}>
            {leads.length > 0 ? leads.slice(0, 7).map((lead, idx) => {
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

              const utm = lead.data?.marketing?.source || lead.data?.utm_source;

              return (
                <div key={lead.id} className={styles.leadItem} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className={styles.leadAvatar}>
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.email || lead.id}`} alt="" />
                  </div>
                  <div className={styles.leadMain}>
                    <div className={styles.leadTop}>
                      <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
                      <span 
                        className={styles.leadClient}
                        style={{ 
                          backgroundColor: lead.clients?.primary_color || 'rgba(0, 209, 255, 0.1)',
                          color: lead.clients?.primary_color ? '#000' : 'var(--foreground)',
                          fontWeight: 800
                        }}
                      >
                        {lead.clients?.name || 'Carregando...'}
                      </span>
                    </div>
                    <div className={styles.leadMeta}>
                      <span><MapPin size={12} /> {lead.data?.location?.city ? decodeURIComponent(lead.data.location.city) : 'Brasil'}</span>
                      <span>
                        <Clock size={12} /> 
                        {new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {utm && (
                        <span className={styles.utmBadge}>
                          {decodeURIComponent(utm)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.leadStatus}>
                    {lead.source === 'whatsapp_tracker' ? (
                      <div className={`${styles.statusBadge} ${styles.whatsapp}`}><MessageCircle size={10} /> WPP</div>
                    ) : isSelector ? (
                      <div className={`${styles.statusBadge} ${styles.selector}`}><MousePointerClick size={10} /> SELETOR</div>
                    ) : isKeyword ? (
                      <div className={`${styles.statusBadge} ${styles.keyword}`}><Type size={10} /> PALAVRA</div>
                    ) : lead.source === 'custom_tracker' ? (
                      <div className={`${styles.statusBadge} ${styles.button}`}><Zap size={10} /> BOTÃO</div>
                    ) : (
                      <div className={`${styles.statusBadge} ${styles.form}`}><FileText size={10} /> FORM</div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className={styles.emptyState}>Aguardando capturas ao vivo...</div>
            )}
          </div>
        </div>

        {/* COLUNA 2: Gráficos de Conversão e Distribuição (40% width) */}
        <div className={styles.centerColumn}>
          
          {/* Histórico Horário de Hoje */}
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitle}>
                <TrendingUp size={18} color="#00d1ff" />
                <h3>HISTÓRICO DE CAPTURAS POR HORA (HOJE)</h3>
              </div>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={0}>
                <AreaChart data={statsSummary.hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d1ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d1ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                  <RechartsTooltip 
                    contentStyle={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#00d1ff', fontSize: '11px' }}
                  />
                  <Area type="monotone" name="Leads" dataKey="leads" stroke="#00d1ff" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Divisão por Canais (Gráfico de Rosca) */}
          <div className={`${styles.chartCard} glass`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitle}>
                <Globe size={18} color="#2ecc71" />
                <h3>DIVISÃO DE CAPTURAS POR ORIGEM</h3>
              </div>
            </div>
            <div className={styles.donutGrid}>
              <div className={styles.donutChart}>
                <ResponsiveContainer width="100%" height={150} minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={statsSummary.sourceData}
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statsSummary.sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.donutLegend}>
                {statsSummary.sourceData.length > 0 ? statsSummary.sourceData.map((s, idx) => (
                  <div key={s.name} className={styles.legendItem}>
                    <div className={styles.legendDot} style={{ backgroundColor: s.color }} />
                    <span className={styles.legendName}>{s.name}</span>
                    <strong className={styles.legendValue}>{s.value}</strong>
                  </div>
                )) : (
                  <div className={styles.emptyLegend}>Aguardando dados...</div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* COLUNA 3: Rankings e Performance em Tempo Real (30% width) */}
        <div className={styles.rightColumn}>
          
          {/* Top UTMs */}
          <div className={`${styles.rankingCard} glass`}>
            <div className={styles.rankingHeader}>
              <Globe size={16} color="#f1c40f" />
              <h3>TOP FONTES (UTMS)</h3>
            </div>
            <div className={styles.rankingList}>
              {statsSummary.topUtms.length > 0 ? statsSummary.topUtms.map((utm, idx) => {
                const percent = Math.round((utm.value / (leadsToday.length || 1)) * 100);
                return (
                  <div key={utm.name} className={styles.rankingItem}>
                    <div className={styles.rankingRow}>
                      <span className={styles.rankLabel}>#{idx + 1} {utm.name}</span>
                      <strong className={styles.rankValue}>{utm.value} <small>leads</small></strong>
                    </div>
                    <div className={styles.rankingBar}>
                      <div className={styles.rankingBarFill} style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #f1c40f, #f39c12)' }} />
                    </div>
                  </div>
                );
              }) : (
                <div className={styles.emptyRanking}>Nenhuma fonte UTM detectada hoje.</div>
              )}
            </div>
          </div>

          {/* Top Localizações */}
          <div className={`${styles.rankingCard} glass`}>
            <div className={styles.rankingHeader}>
              <MapPin size={16} color="#a855f7" />
              <h3>TOP LOCALIZAÇÕES (CIDADES)</h3>
            </div>
            <div className={styles.rankingList}>
              {statsSummary.topLocations.length > 0 ? statsSummary.topLocations.map((loc, idx) => {
                const percent = Math.round((loc.value / (leadsToday.length || 1)) * 100);
                return (
                  <div key={loc.name} className={styles.rankingItem}>
                    <div className={styles.rankingRow}>
                      <span className={styles.rankLabel}>#{idx + 1} {loc.name}</span>
                      <strong className={styles.rankValue}>{loc.value} <small>leads</small></strong>
                    </div>
                    <div className={styles.rankingBar}>
                      <div className={styles.rankingBarFill} style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #a855f7, #8e44ad)' }} />
                    </div>
                  </div>
                );
              }) : (
                <div className={styles.emptyRanking}>Aguardando dados geográficos...</div>
              )}
            </div>
          </div>

          {/* Performance de Parceiros ou Quebra Detalhada */}
          <div className={`${styles.rankingCard} glass`}>
            <div className={styles.rankingHeader}>
              <Users size={16} color="#2ecc71" />
              <h3>{selectedClient === 'all' ? 'PERFORMANCE POR PARCEIRO' : 'DISTRIBUIÇÃO DE CANAIS'}</h3>
            </div>
            <div className={styles.rankingList}>
              {selectedClient === 'all' ? (
                statsSummary.clientPerformance.length > 0 ? statsSummary.clientPerformance.map((c, idx) => {
                  const percent = Math.round((c.value / (leadsToday.length || 1)) * 100);
                  return (
                    <div key={c.name} className={styles.rankingItem}>
                      <div className={styles.rankingRow}>
                        <span className={styles.rankLabel}>{c.name}</span>
                        <strong className={styles.rankValue}>{c.value} <small>leads</small></strong>
                      </div>
                      <div className={styles.rankingBar}>
                        <div className={styles.rankingBarFill} style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }} />
                      </div>
                    </div>
                  );
                }) : (
                  <div className={styles.emptyRanking}>Nenhum parceiro ativo com leads hoje.</div>
                )
              ) : (
                // Detalhamento do Cliente Selecionado
                statsSummary.sourceData.length > 0 ? statsSummary.sourceData.map((source, idx) => {
                  const percent = Math.round((source.value / (leadsToday.length || 1)) * 100);
                  return (
                    <div key={source.name} className={styles.rankingItem}>
                      <div className={styles.rankingRow}>
                        <span className={styles.rankLabel}>{source.name}</span>
                        <strong className={styles.rankValue}>{source.value} <small>leads</small></strong>
                      </div>
                      <div className={styles.rankingBar}>
                        <div className={styles.rankingBarFill} style={{ width: `${percent}%`, backgroundColor: source.color }} />
                      </div>
                    </div>
                  );
                }) : (
                  <div className={styles.emptyRanking}>Nenhuma captura registrada para este cliente hoje.</div>
                )
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Rodapé */}
      <footer className={styles.footer}>
        <div className={styles.footerInfo}>
          <span>SISTEMA ASTHROS MONITORING • CONEXÃO CRIPTOGRAFADA • STATUS: REALTIME ONLINE</span>
        </div>
      </footer>
    </div>
  );
}
