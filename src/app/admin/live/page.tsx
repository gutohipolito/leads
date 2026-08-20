'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { JetBrains_Mono } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import styles from './live.module.css';
import {
  Zap,
  Users,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Clock,
  Globe,
  MessageCircle,
  MousePointerClick,
  Type,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['600', '700', '800'] });

// Só os campos necessários pra agregação — sem name/email/phone, que são PII
// criptografada e não têm razão de ser buscados numa tela pública de TV.
type LiveLead = {
  id: string;
  client_id: string;
  source: string | null;
  data: any;
  created_at: string;
  clients: { name: string; logo_url: string | null; logo_bg: string | null } | null;
};

type LeadCategory = 'whatsapp' | 'selector' | 'keyword' | 'form';

// Mesma lógica de categorização usada no dashboard principal (HomeClient),
// sem o fallback em `name` porque essa tela não busca esse campo.
function getLeadCategory(l: LiveLead): LeadCategory {
  if (l.source === 'whatsapp_tracker') return 'whatsapp';
  if (l.source === 'custom_tracker') {
    const matchType = (l.data?.behavior?.match_type || l.data?.match_type || '').toLowerCase();
    if (matchType.includes('selector')) return 'selector';
    if (matchType.includes('keyword')) return 'keyword';
  }
  return 'form';
}

const CHANNEL_META: Record<LeadCategory, { label: string; color: string; icon: any }> = {
  whatsapp: { label: 'WhatsApp', color: '#25d366', icon: MessageCircle },
  form: { label: 'Formulários', color: '#00d1ff', icon: FileText },
  selector: { label: 'Seletores', color: '#a855f7', icon: MousePointerClick },
  keyword: { label: 'Palavras-chave', color: '#f97316', icon: Type },
};

function formatRelativeTime(date: Date | null): string {
  if (!date) return '—';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'agora';
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
  const diffHours = Math.floor(diffSec / 3600);
  if (diffHours < 24) return `há ${diffHours}h`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Isolado num componente próprio: só ele re-renderiza a cada segundo, em vez da
// página inteira (incluindo o gráfico recharts) num monitor ligado 24/7.
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.clock}>
      <span className={jetbrainsMono.className}>{now ? now.toLocaleTimeString('pt-BR') : '--:--:--'}</span>
    </div>
  );
}

export default function LiveMonitorPage() {
  const [leadsToday, setLeadsToday] = useState<LiveLead[]>([]);
  const [avgPerDay7d, setAvgPerDay7d] = useState(0);
  const [activePartners, setActivePartners] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  const loadLeadsToday = useCallback(async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [{ data: leadsData }, { count: last7DaysCount }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, client_id, source, data, created_at, clients(name, logo_url, logo_bg)')
        .neq('source', 'test_simulation')
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .neq('source', 'test_simulation')
        .gte('created_at', sevenDaysAgo.toISOString()),
    ]);

    setLeadsToday((leadsData as unknown as LiveLead[]) || []);
    setAvgPerDay7d((last7DaysCount || 0) / 7);
  }, []);

  const loadActivePartners = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, webhooks(status)')
      .eq('status', 'active');

    const count = (data || []).filter((c: any) => c.webhooks?.some((w: any) => w.status === 'active')).length;
    setActivePartners(count);
  }, []);

  useEffect(() => {
    loadLeadsToday();
    loadActivePartners();

    // Rede de segurança além do realtime: garante que a TV nunca fique
    // travada com dados velhos se um evento passar batido.
    const pollInterval = setInterval(loadLeadsToday, 30000);

    setConnectionStatus('connecting');
    const channel = supabase
      .channel('live-monitor-tv')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeadsToday();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('online');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnectionStatus('error');
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [loadLeadsToday, loadActivePartners]);

  const summary = useMemo(() => {
    const totalToday = leadsToday.length;
    const leadsPerHour = parseFloat((totalToday / (new Date().getHours() + 1)).toFixed(1));
    const deltaPercent = avgPerDay7d > 0 ? Math.round(((totalToday - avgPerDay7d) / avgPerDay7d) * 100) : 0;
    const lastCaptureAt = leadsToday[0] ? new Date(leadsToday[0].created_at) : null;

    // Totais por canal, hoje
    const channelTotals: Record<LeadCategory, number> = { whatsapp: 0, form: 0, selector: 0, keyword: 0 };
    leadsToday.forEach((l) => { channelTotals[getLeadCategory(l)]++; });

    // Top fontes UTM
    const utmMap: Record<string, number> = {};
    leadsToday.forEach((l) => {
      let utm = l.data?.marketing?.source || l.data?.utm_source || 'Direto / Orgânico';
      try { utm = decodeURIComponent(utm); } catch {}
      utmMap[utm] = (utmMap[utm] || 0) + 1;
    });
    const topUtms = Object.entries(utmMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const topUtmMax = topUtms[0]?.value || 1;

    // Performance por parceiro
    const partnerMap: Record<string, { name: string; logoUrl: string | null; logoBg: string | null; value: number }> = {};
    leadsToday.forEach((l) => {
      if (!l.clients) return;
      const key = l.client_id;
      if (!partnerMap[key]) {
        partnerMap[key] = { name: l.clients.name, logoUrl: l.clients.logo_url, logoBg: l.clients.logo_bg, value: 0 };
      }
      partnerMap[key].value++;
    });
    const clientPerformance = Object.values(partnerMap).sort((a, b) => b.value - a.value).slice(0, 5);

    // Capturas por hora (últimas 12h)
    const hourlyData = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setHours(d.getHours() - (11 - i), 0, 0, 0);
      const targetHour = d.getHours();
      const count = leadsToday.filter((l) => new Date(l.created_at).getHours() === targetHour).length;
      return { hour: `${targetHour}h`, leads: count };
    });

    return { totalToday, leadsPerHour, deltaPercent, lastCaptureAt, channelTotals, topUtms, topUtmMax, clientPerformance, hourlyData };
  }, [leadsToday]);

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
      <div className={styles.bloomA} />
      <div className={styles.bloomB} />
      <div className={styles.bloomC} />

      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" className={styles.backBtn}>
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.logo}>
            <img src="/asthros-favicon.png" alt="Asthros" width={22} height={22} />
          </div>
          <span className={styles.brand}>
            Asthros <span>Live</span>
          </span>
        </div>

        <div className={styles.right}>
          <div className={`${styles.statusPill} ${styles[connectionStatus]}`}>
            <span className={styles.statusDot} />
            <span>Ao vivo</span>
          </div>
          <div className={styles.divider} />
          <LiveClock />
          <button className={styles.iconBtn} onClick={toggleFullscreen} aria-label="Tela cheia">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      <div className={styles.heroGrid}>
        <div className={styles.heroPrimary}>
          <div>
            <div className={`${styles.heroNumber} ${jetbrainsMono.className}`}>{summary.totalToday}</div>
            <div className={styles.heroLabel}>leads capturados hoje</div>
          </div>
          {summary.deltaPercent !== 0 && (
            <div className={styles.heroTrend}>
              <div className={`${styles.trendBadge} ${summary.deltaPercent >= 0 ? styles.trendUp : styles.trendDown}`}>
                {summary.deltaPercent >= 0 ? '↑' : '↓'} {Math.abs(summary.deltaPercent)}%
              </div>
              <span>vs. média 7 dias</span>
            </div>
          )}
        </div>

        <div className={styles.heroSecondary}>
          <div className={styles.heroRow}>
            <Zap size={18} color="#f1c40f" />
            <span>Leads por hora</span>
            <strong className={jetbrainsMono.className}>{summary.leadsPerHour}</strong>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroRow}>
            <Users size={18} color="#a29bfe" />
            <span>Parceiros ativos</span>
            <strong className={jetbrainsMono.className}>{activePartners}</strong>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroRow}>
            <Clock size={18} color="#00d1ff" />
            <span>Última captura</span>
            <strong className={jetbrainsMono.className}>{formatRelativeTime(summary.lastCaptureAt)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3>Capturas por hora</h3>
            <span className={styles.cardSubtitle}>últimas 12h</span>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.hourlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="liveAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d1ff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#00d1ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }} allowDecimals={false} width={28} />
                <RechartsTooltip
                  contentStyle={{ background: '#0a1018', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  labelStyle={{ color: '#fff', fontSize: 12, fontWeight: 700 }}
                  itemStyle={{ color: '#00d1ff', fontSize: 12 }}
                />
                <Area type="monotone" name="Leads" dataKey="leads" stroke="#00d1ff" strokeWidth={3} fillOpacity={1} fill="url(#liveAreaFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.channelLegend}>
            {(Object.keys(CHANNEL_META) as LeadCategory[]).map((key) => {
              const meta = CHANNEL_META[key];
              return (
                <div key={key} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: meta.color }} />
                  <span className={styles.legendLabel}>{meta.label}</span>
                  <strong className={jetbrainsMono.className}>{summary.channelTotals[key]}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <h3>Performance por parceiro</h3>
            <div className={styles.partnerList}>
              {summary.clientPerformance.length > 0 ? (
                summary.clientPerformance.map((p, idx) => (
                  <div key={p.name + idx} className={styles.partnerRow}>
                    <div className={styles.partnerLogo} style={{ background: p.logoBg || 'rgba(0, 209, 255, 0.12)' }}>
                      {p.logoUrl && !failedLogos[p.name] ? (
                        <img src={p.logoUrl} alt={p.name} onError={() => setFailedLogos((prev) => ({ ...prev, [p.name]: true }))} />
                      ) : (
                        <span>{p.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className={styles.partnerName}>{p.name}</span>
                    <strong className={jetbrainsMono.className}>{p.value}</strong>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>Nenhum parceiro com leads hoje.</div>
              )}
            </div>
          </div>

          <div className={styles.sideCard}>
            <h3>Top fontes (UTM)</h3>
            <div className={styles.utmList}>
              {summary.topUtms.length > 0 ? (
                summary.topUtms.map((u) => (
                  <div key={u.name} className={styles.utmRow}>
                    <div className={styles.utmTop}>
                      <span>{u.name}</span>
                      <strong className={jetbrainsMono.className}>{u.value}</strong>
                    </div>
                    <div className={styles.utmBar}>
                      <div className={styles.utmBarFill} style={{ width: `${Math.round((u.value / summary.topUtmMax) * 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <Globe size={16} />
                  Nenhuma origem detectada hoje.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
