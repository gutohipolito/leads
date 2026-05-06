'use client';

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Users, Target, Activity, Zap, Calendar } from 'lucide-react';
import styles from './StatsDrawer.module.css';
import AnalyticsChart from '../DashboardCharts/AnalyticsChart';

interface StatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
}

export default function StatsDrawer({ isOpen, onClose, client }: StatsDrawerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.metricsGrid}>
            <div className={`${styles.metricCard} glass`}>
              <div className={styles.metricHeader}>
                <TrendingUp size={18} className={styles.iconBlue} />
                <span>Conversão Total</span>
              </div>
              <div className={styles.metricValue}>{client.leads?.[0]?.count || 0}</div>
              <div className={styles.metricSub}>Sinais capturados</div>
            </div>

            <div className={`${styles.metricCard} glass`}>
              <div className={styles.metricHeader}>
                <Activity size={18} className={styles.iconGreen} />
                <span>Status Uplink</span>
              </div>
              <div className={styles.metricValue}>{client.status === 'active' ? 'Estável' : 'Offline'}</div>
              <div className={styles.metricSub}>Conectividade atual</div>
            </div>

            <div className={`${styles.metricCard} glass`}>
              <div className={styles.metricHeader}>
                <Zap size={18} className={styles.iconPurple} />
                <span>Eficiência</span>
              </div>
              <div className={styles.metricValue}>98.2%</div>
              <div className={styles.metricSub}>Taxa de sucesso</div>
            </div>
          </div>

          <div className={`${styles.chartSection} glass`}>
            <div className={styles.sectionHeader}>
              <div className={styles.titleIcon}>
                <Target size={18} />
                <h4>Volume de Tráfego (7 dias)</h4>
              </div>
            </div>
            <div className={styles.chartContainer}>
              {/* Usando o mesmo gráfico do dashboard principal */}
              <AnalyticsChart data={[]} />
              <div className={styles.chartOverlay}>
                <p>Análise Profunda Ativa</p>
              </div>
            </div>
          </div>

          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <Calendar size={16} />
              <span>Início da Parceria: {new Date(client.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className={styles.detailItem}>
              <Users size={16} />
              <span>Canais de Captação: {client.webhooks?.[0]?.count || 0} Webhooks</span>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.actionBtn} onClick={onClose}>Fechar Painel</button>
          <button className={`${styles.actionBtn} ${styles.primary}`}>Exportar Relatório</button>
        </div>
      </div>
    </div>
  );
}
