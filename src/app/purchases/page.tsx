'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './purchases.module.css';
import { 
  ShoppingBag, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Webhook, 
  ExternalLink, 
  Eye, 
  X,
  Package,
  User,
  Mail,
  Tag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Buscar o cliente ativo (ou impersonated)
        const impersonated = typeof window !== 'undefined' ? localStorage.getItem('impersonated_client') : null;
        let targetClientId = impersonated;

        if (!targetClientId) {
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1)
            .maybeSingle();

          if (client) targetClientId = client.id;
        }

        if (targetClientId) {
          setClientId(targetClientId);

          // Buscar webhook/secret do cliente
          const { data: wh } = await supabase
            .from('webhooks')
            .select('secret')
            .eq('client_id', targetClientId)
            .limit(1)
            .maybeSingle();

          if (wh?.secret) setClientSecret(wh.secret);

          // Buscar compras do cliente no Supabase
          const { data: dbPurchases, error } = await supabase
            .from('purchases')
            .select('*')
            .eq('client_id', targetClientId)
            .order('created_at', { ascending: false });

          if (!error && dbPurchases) {
            setPurchases(dbPurchases);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar compras:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Inscrever no Supabase Realtime para receber novas vendas em tempo real
    let channel: any;
    if (clientId) {
      channel = supabase
        .channel(`purchases-${clientId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'purchases', filter: `client_id=eq.${clientId}` },
          (payload) => {
            const newPurchase = payload.new;
            setPurchases((prev) => [newPurchase, ...prev]);
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [clientId]);

  // Webhook URL calculada para exibição
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined' || !clientId) return '';
    const origin = window.location.origin;
    const secParam = clientSecret ? `?secret=${clientSecret}` : '';
    return `${origin}/api/webhooks/purchases/${clientId}${secParam}`;
  }, [clientId, clientSecret]);

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtragem de compras por pesquisa, gateway e status
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchGateway = gatewayFilter === 'all' || item.gateway === gatewayFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchSearch && matchGateway && matchStatus;
    });
  }, [purchases, searchTerm, gatewayFilter, statusFilter]);

  // Cálculos de KPIs
  const metrics = useMemo(() => {
    const approved = purchases.filter((p) => p.status === 'approved');
    const totalRevenue = approved.reduce((acc, p) => acc + (parseFloat(p.total_amount) || 0), 0);
    const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;
    const approvalRate = purchases.length > 0 ? (approved.length / purchases.length) * 100 : 0;

    return {
      totalRevenue,
      approvedCount: approved.length,
      avgTicket,
      approvalRate,
    };
  }, [purchases]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getGatewayBadge = (gtw: string) => {
    const lower = (gtw || '').toLowerCase();
    if (lower === 'yampi') return <span className={`${styles.gatewayBadge} ${styles.gatewayYampi}`}>Yampi</span>;
    if (lower === 'shopify') return <span className={`${styles.gatewayBadge} ${styles.gatewayShopify}`}>Shopify</span>;
    return <span className={`${styles.gatewayBadge} ${styles.gatewayGeneric}`}>{gtw || 'Webhook'}</span>;
  };

  const getStatusBadge = (st: string) => {
    const lower = (st || '').toLowerCase();
    if (lower === 'approved' || lower === 'paid') return <span className={styles.statusApproved}>Aprovado</span>;
    if (lower === 'pending') return <span className={styles.statusPending}>Pendente</span>;
    return <span className={styles.statusCanceled}>Cancelado</span>;
  };

  return (
    <DashboardLayout title="Gestão de Vendas & Conversões">
      <div className={styles.container}>
        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#2ecc71' }}>
              <DollarSign size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <span className={styles.kpiLabel}>Faturamento Aprovado</span>
              <span className={styles.kpiValue}>{formatCurrency(metrics.totalRevenue)}</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <ShoppingBag size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <span className={styles.kpiLabel}>Vendas Aprovadas</span>
              <span className={styles.kpiValue}>{metrics.approvedCount}</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <span className={styles.kpiLabel}>Ticket Médio</span>
              <span className={styles.kpiValue}>{formatCurrency(metrics.avgTicket)}</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
              <CheckCircle size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <span className={styles.kpiLabel}>Taxa de Aprovação</span>
              <span className={styles.kpiValue}>{metrics.approvalRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Webhook Info Card */}
        {webhookUrl && (
          <div className={styles.webhookInfoCard}>
            <div className={styles.webhookHeader}>
              <div className={styles.webhookTitle}>
                <Webhook size={18} />
                <span>URL do Webhook para Checkout (Yampi / Shopify)</span>
              </div>
            </div>
            <div className={styles.urlBox}>
              <span>{webhookUrl}</span>
              <button className={styles.copyBtn} onClick={copyWebhookUrl}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Toolbar de Busca e Filtros */}
        <div className={styles.toolbar}>
          <div className={styles.searchGroup}>
            <Search size={18} color="#888" />
            <input
              type="text"
              placeholder="Buscar por Pedido, Nome ou E-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <select
              className={styles.filterSelect}
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
            >
              <option value="all">Todos os Gateways</option>
              <option value="yampi">Yampi</option>
              <option value="shopify">Shopify</option>
              <option value="generic">Webhooks Genéricos</option>
            </select>

            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="approved">Aprovado</option>
              <option value="pending">Pendente</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Tabela de Vendas */}
        <div className={styles.tableWrapper}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <Loader />
            </div>
          ) : filteredPurchases.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Gateway</th>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Origem (UTM)</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((item) => (
                  <tr key={item.id || item.order_id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{item.order_id}</td>
                    <td>{getGatewayBadge(item.gateway)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.customer_name || 'Cliente'}</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>
                          {item.customer_email || 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#2ecc71' }}>
                      {formatCurrency(parseFloat(item.total_amount || 0))}
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      {item.utm_source ? (
                        <span className={styles.gatewayBadge} style={{ background: 'rgba(255,255,255,0.05)' }}>
                          {item.utm_source}
                        </span>
                      ) : (
                        <span style={{ color: '#666', fontSize: '0.8rem' }}>Direto</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#aaa' }}>
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <button
                        className={styles.detailsBtn}
                        onClick={() => setSelectedOrder(item)}
                        title="Ver Detalhes do Pedido"
                      >
                        <Eye size={14} />
                        <span>Detalhes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <ShoppingBag size={48} opacity={0.3} />
              <h3>Nenhuma venda registrada até o momento</h3>
              <p style={{ maxWidth: '400px', fontSize: '0.9rem' }}>
                Conecte seu gateway (Yampi/Shopify) usando o webhook acima para rastrear vendas em tempo real.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} color="#60a5fa" />
                Detalhes do Pedido #{selectedOrder.order_id}
              </h3>
              <button className={styles.modalClose} onClick={() => setSelectedOrder(null)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalSection}>
              <span className={styles.sectionTitle}>Informações do Cliente</span>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
                <div><strong>Nome:</strong> {selectedOrder.customer_name}</div>
                <div><strong>E-mail:</strong> {selectedOrder.customer_email || 'N/A'}</div>
                <div><strong>Visitor ID:</strong> <code style={{ color: '#a7f3d0' }}>{selectedOrder.visitor_id || 'N/A'}</code></div>
              </div>
            </div>

            <div className={styles.modalSection}>
              <span className={styles.sectionTitle}>Resumo da Compra</span>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
                <div><strong>Gateway:</strong> {selectedOrder.gateway?.toUpperCase()}</div>
                <div><strong>Status:</strong> {selectedOrder.status}</div>
                <div><strong>Valor Total:</strong> <span style={{ color: '#2ecc71', fontWeight: 700 }}>{formatCurrency(parseFloat(selectedOrder.total_amount || 0))}</span></div>
              </div>
            </div>

            {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
              <div className={styles.modalSection}>
                <span className={styles.sectionTitle}>Itens Comprados</span>
                <div className={styles.itemsList}>
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className={styles.itemRow}>
                      <span>{item.quantity}x {item.name}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(item.price || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.modalSection}>
              <span className={styles.sectionTitle}>Atribuição & Marketing</span>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#ccc' }}>
                <div><strong>UTM Source:</strong> {selectedOrder.utm_source || 'Direto'}</div>
                <div><strong>UTM Medium:</strong> {selectedOrder.utm_medium || 'N/A'}</div>
                <div><strong>UTM Campaign:</strong> {selectedOrder.utm_campaign || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
