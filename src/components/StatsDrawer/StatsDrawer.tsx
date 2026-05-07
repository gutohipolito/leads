'use client';

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Users, Target, Activity, Zap, Calendar } from 'lucide-react';
import styles from './StatsDrawer.module.css';
import AnalyticsChart from '../DashboardCharts/AnalyticsChart';
import { supabase } from '@/lib/supabase';
import Loader from '../Loader/Loader';

interface StatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
}

export default function StatsDrawer({ isOpen, onClose, client }: StatsDrawerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    conversionRate: '100%'
  });

  useEffect(() => {
    if (isOpen) {
      loadClientStats();
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, client.id]);

  async function loadClientStats() {
    setLoading(true);
    
    // 1. Buscar Leads dos últimos 7 dias para o gráfico
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: leads } = await supabase
      .from('leads')
      .select('created_at')
      .eq('client_id', client.id)
      .gte('created_at', weekAgo.toISOString());

    if (leads) {
      const data = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        const count = leads.filter(l => {
          const ts = new Date(l.created_at).getTime();
          return ts >= dayStart && ts < dayEnd;
        }).length;

        return { date: dateStr, leads: count };
      });
      setChartData(data);
      setStats(prev => ({ ...prev, total: leads.length }));
    }

    setLoading(false);
  }

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`} onClick={onClose}>
      <div className={`${styles.drawer} ${isVisible ? styles.open : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleInfo}>
            <div className={styles.avatar}>{client.name.charAt(0)}</div>
            <div>
              <h3>Inteligência de Leads</h3>
              <p>{client.name} • ID: {client.id.slice(0, 8)}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div style={{ padding: '4rem' }}><Loader text="Processando Dados" /></div>
          ) : (
            <>
              <div className={styles.metricsGrid}>
                <div className={`${styles.metricCard} glass`}>
                  <div className={styles.metricHeader}>
                    <TrendingUp size={16} className={styles.iconBlue} />
                    <span>Conversão Total</span>
                  </div>
                  <div className={styles.metricValue}>{client.leadsCount || 0}</div>
                  <div className={styles.metricSub}>Sinais acumulados</div>
                </div>

                <div className={`${styles.metricCard} glass`}>
                  <div className={styles.metricHeader}>
                    <Activity size={16} className={styles.iconGreen} />
                    <span>Status Uplink</span>
                  </div>
                  <div className={styles.metricValue}>{client.status === 'active' ? 'Estável' : 'Inativo'}</div>
                  <div className={styles.metricSub}>Conectividade real</div>
                </div>

                <div className={`${styles.metricCard} glass`}>
                  <div className={styles.metricHeader}>
                    <Zap size={16} className={styles.iconPurple} />
                    <span>Eficiência</span>
                  </div>
                  <div className={styles.metricValue}>100%</div>
                  <div className={styles.metricSub}>Taxa de processamento</div>
                </div>
              </div>

              <div className={`${styles.chartSection} glass`}>
                <div className={styles.sectionHeader}>
                  <div className={styles.titleIcon}>
                    <Target size={16} />
                    <h4>Desempenho (Últimos 7 dias)</h4>
                  </div>
                </div>
                <div className={styles.chartContainer}>
                  <AnalyticsChart data={chartData} />
                </div>
              </div>

              <div className={styles.webhooksSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.titleIcon}>
                    <Zap size={16} />
                    <h4>Pontos de Entrada Ativos</h4>
                  </div>
                </div>
                <div className={styles.webhookList}>
                  {client.webhooks?.map((wh: any) => (
                    <div key={wh.id} className={`${styles.webhookCard} glass`}>
                      <div className={styles.whInfo}>
                        <span className={styles.whName}>{wh.name}</span>
                        <span className={styles.whStatus}>● Canal Ativo</span>
                      </div>
                      <div className={styles.urlCopy}>
                        <input 
                          readOnly 
                          value={`${currentOrigin}/api/leads/${client.id}`} 
                          className={styles.urlInput}
                        />
                        <button 
                          className={styles.copyBtn}
                          onClick={() => {
                            navigator.clipboard.writeText(`${currentOrigin}/api/leads/${client.id}`);
                            alert('Endpoint copiado!');
                          }}
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!client.webhooks || client.webhooks.length === 0) && (
                    <p className={styles.emptyMsg}>Nenhum terminal configurado.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.actionBtn} onClick={onClose}>Fechar Painel</button>
          <button className={`${styles.actionBtn} ${styles.primary}`}>Exportar Relatório</button>
        </div>
      </div>
    </div>
  );
}
