'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './purchases.module.css';
import { 
  ShoppingBag, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  Search, 
  Copy, 
  Check, 
  Webhook, 
  Eye, 
  X,
  Package,
  Store,
  Sparkles,
  User,
  Mail,
  Receipt,
  Tag,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  ChevronDown,
  Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import { playBoostedAudio } from '@/utils/audio';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Estados do Dropdown Customizado de Webhooks / E-commerce
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownFilterEcommerce, setDropdownFilterEcommerce] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Partículas de E-commerce ativadas ao abrir o recibo
  const [particles, setParticles] = useState<Array<{ id: number; left: number; symbol: string; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: profile } = await supabase
          .from('system_users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        const isUserAdmin = profile?.role === 'admin';
        const impersonated = typeof window !== 'undefined' ? localStorage.getItem('impersonated_client') : null;
        
        let activeClientId = profile?.client_id;
        if (isUserAdmin && impersonated) {
          try {
            activeClientId = JSON.parse(impersonated).id;
          } catch (e) {
            activeClientId = impersonated;
          }
        }

        // 1. Buscar a lista de Webhooks disponíveis (incluindo flag is_ecommerce do cliente)
        let whQuery = supabase.from('webhooks').select('*, clients(name, is_ecommerce)').eq('status', 'active');
        if (activeClientId) {
          whQuery = whQuery.eq('client_id', activeClientId);
        }

        const { data: whData } = await whQuery;
        if (whData && whData.length > 0) {
          setWebhooksList(whData);
        }

        // 2. Buscar vendas no Supabase
        let pQuery = supabase
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false });

        if (activeClientId) {
          pQuery = pQuery.eq('client_id', activeClientId);
        }

        const { data: dbPurchases, error: pError } = await pQuery;

        if (!pError && dbPurchases) {
          setPurchases(dbPurchases);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de vendas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Efeito sonoro & partículas ao selecionar/abrir um recibo de compra
  useEffect(() => {
    if (selectedOrder) {
      // 1. Tocar som de celebração de venda (Anime WOW com volume amplificado)
      try {
        playBoostedAudio('/anime-wow-sound-effect-mp3cut.mp3', 3.5);
      } catch (e) {}

      // 2. Gerar partículas festivas e-commerce (moedas, sacolas, notas de dinheiro, brilho)
      const ecomSymbols = ['💸', '✨', '🛍️', '💰', '🎉', '🌟', '🛒', '💵'];
      const tempParticles = [];
      for (let i = 0; i < 22; i++) {
        tempParticles.push({
          id: i,
          left: Math.random() * 100,
          symbol: ecomSymbols[Math.floor(Math.random() * ecomSymbols.length)],
          delay: Math.random() * 1.2,
          duration: 3 + Math.random() * 2.5,
          size: 0.9 + Math.random() * 1.3
        });
      }
      setParticles(tempParticles);
    } else {
      setParticles([]);
    }
  }, [selectedOrder]);

  // Realtime Supabase Subscription
  useEffect(() => {
    const channel = supabase
      .channel('purchases-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchases' },
        (payload) => {
          const newPurchase = payload.new;
          setPurchases((prev) => [newPurchase, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Webhook selecionado
  const currentWebhook = useMemo(() => {
    if (selectedWebhookId === 'all') return null;
    return webhooksList.find((w) => w.id === selectedWebhookId) || null;
  }, [selectedWebhookId, webhooksList]);

  // Webhooks filtrados para o Dropdown Customizado (Busca + E-commerce)
  const filteredWebhooksForDropdown = useMemo(() => {
    return webhooksList.filter((wh) => {
      if (dropdownFilterEcommerce && !wh.clients?.is_ecommerce) {
        return false;
      }
      if (dropdownSearch) {
        const term = dropdownSearch.toLowerCase();
        const matchWhName = wh.name?.toLowerCase().includes(term);
        const matchClientName = wh.clients?.name?.toLowerCase().includes(term);
        return matchWhName || matchClientName;
      }
      return true;
    });
  }, [webhooksList, dropdownFilterEcommerce, dropdownSearch]);

  // URL do Webhook calculada (apenas para webhook selecionado)
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined' || !currentWebhook) return '';
    const origin = window.location.origin;
    const secParam = currentWebhook.secret ? `?secret=${currentWebhook.secret}` : '';
    return `${origin}/api/webhooks/purchases/${currentWebhook.client_id}${secParam}`;
  }, [currentWebhook]);

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Botão de Simulação de Venda de Teste
  const handleSimulateTestOrder = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockOrder = {
      id: `test-${Date.now()}`,
      order_id: `YAMPI-${randomNum}`,
      gateway: 'yampi',
      customer_name: 'Ana Clara Silva',
      customer_email: 'ana.clara@exemplo.com.br',
      visitor_id: 'v_asthros_98f21a7c',
      total_amount: 389.70,
      status: 'approved',
      currency: 'BRL',
      items: [
        { name: 'Kit SkinCare Glow Premium', quantity: 2, price: 149.90 },
        { name: 'Sérum Facial Hialurônico 30ml', quantity: 1, price: 89.90 }
      ],
      utm_source: 'instagram_ads',
      utm_medium: 'cpc',
      utm_campaign: 'campanha_verao_2026',
      created_at: new Date().toISOString()
    };

    setPurchases((prev) => [mockOrder, ...prev]);
    setSelectedOrder(mockOrder);
  };

  // Filtragem de compras
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      if (selectedWebhookId !== 'all' && currentWebhook) {
        if (item.client_id && item.client_id !== currentWebhook.client_id) return false;
      }

      const matchSearch =
        !searchTerm ||
        item.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchGateway = gatewayFilter === 'all' || item.gateway === gatewayFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchSearch && matchGateway && matchStatus;
    });
  }, [purchases, selectedWebhookId, currentWebhook, searchTerm, gatewayFilter, statusFilter]);

  // KPIs
  const metrics = useMemo(() => {
    const approved = filteredPurchases.filter((p) => p.status === 'approved' || p.status === 'paid');
    const totalRevenue = approved.reduce((acc, p) => acc + (parseFloat(p.total_amount) || 0), 0);
    const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;
    const approvalRate = filteredPurchases.length > 0 ? (approved.length / filteredPurchases.length) * 100 : 0;

    return {
      totalRevenue,
      approvedCount: approved.length,
      avgTicket,
      approvalRate,
    };
  }, [filteredPurchases]);

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

  const getCustomerInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <DashboardLayout title="Gestão de Vendas & Conversões">
      <div className={styles.container}>
        {/* Cabeçalho da Página */}
        <div className={styles.headerBar}>
          <div className={styles.headerTitleGroup}>
            <h1 className={styles.title}>
              <Store size={26} color="var(--primary)" />
              Gestão de Vendas & E-commerce
            </h1>
            <p className={styles.subtitle}>
              Acompanhe faturamento, pedidos e integre seu checkout (Yampi, Shopify) via Webhook.
            </p>
          </div>

          <button className={styles.testBtn} onClick={handleSimulateTestOrder} title="Testar recibo de venda e modal de e-commerce">
            <Sparkles size={18} />
            <span>Simular Venda de Teste</span>
          </button>
        </div>

        {/* Seleção de Webhook & Card de Integração */}
        <div className={styles.webhookSelectorCard}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorLabelGroup}>
              <Webhook size={20} color="var(--primary)" />
              <span>Selecione a Loja / Webhook para Integração:</span>
            </div>

            {/* Dropdown Customizado de Webhooks & E-commerce */}
            <div className={styles.customSelectWrapper} ref={dropdownRef}>
              <button 
                type="button"
                className={`${styles.customSelectTrigger} ${isDropdownOpen ? styles.triggerOpen : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className={styles.triggerContent}>
                  <Store size={18} color="var(--primary)" />
                  <span className={styles.triggerText}>
                    {selectedWebhookId === 'all' 
                      ? 'Todas as Lojas (Visão Geral)' 
                      : `${currentWebhook?.name || 'Loja'} ${currentWebhook?.clients?.name ? `(${currentWebhook.clients.name})` : ''}`
                    }
                  </span>
                  {currentWebhook?.clients?.is_ecommerce && (
                    <span className={styles.miniEcomBadge}>
                      <ShoppingBag size={10} /> E-com
                    </span>
                  )}
                </div>
                <ChevronDown size={18} className={`${styles.arrowIcon} ${isDropdownOpen ? styles.arrowRotated : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className={styles.customSelectMenu}>
                  {/* Cabeçalho do Menu com Busca e Filtros */}
                  <div className={styles.menuHeader}>
                    <div className={styles.searchBoxMenu}>
                      <Search size={14} color="var(--muted-foreground)" />
                      <input 
                        type="text" 
                        placeholder="Buscar loja ou cliente..." 
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {dropdownSearch && (
                        <X size={14} style={{ cursor: 'pointer' }} onClick={() => setDropdownSearch('')} />
                      )}
                    </div>

                    <div className={styles.filterTabsMenu}>
                      <button 
                        type="button" 
                        className={`${styles.filterTabBtn} ${!dropdownFilterEcommerce ? styles.activeTabBtn : ''}`}
                        onClick={(e) => { e.stopPropagation(); setDropdownFilterEcommerce(false); }}
                      >
                        Todas ({webhooksList.length})
                      </button>
                      <button 
                        type="button" 
                        className={`${styles.filterTabBtn} ${dropdownFilterEcommerce ? styles.activeTabBtn : ''}`}
                        onClick={(e) => { e.stopPropagation(); setDropdownFilterEcommerce(true); }}
                      >
                        <ShoppingBag size={12} />
                        E-commerce ({webhooksList.filter(w => w.clients?.is_ecommerce).length})
                      </button>
                    </div>
                  </div>

                  {/* Lista de Opções */}
                  <div className={styles.menuList}>
                    <div 
                      className={`${styles.menuOption} ${selectedWebhookId === 'all' ? styles.optionSelected : ''}`}
                      onClick={() => {
                        setSelectedWebhookId('all');
                        setIsDropdownOpen(false);
                      }}
                    >
                      <div className={styles.optionInfo}>
                        <Store size={16} color="var(--primary)" />
                        <span className={styles.optionTitle}>Todas as Lojas (Visão Geral)</span>
                      </div>
                      {selectedWebhookId === 'all' && <Check size={16} color="var(--primary)" />}
                    </div>

                    {filteredWebhooksForDropdown.map((wh) => {
                      const isSelected = selectedWebhookId === wh.id;
                      const isEcom = wh.clients?.is_ecommerce;

                      return (
                        <div 
                          key={wh.id}
                          className={`${styles.menuOption} ${isSelected ? styles.optionSelected : ''}`}
                          onClick={() => {
                            setSelectedWebhookId(wh.id);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className={styles.optionInfo}>
                            <Webhook size={16} color={isEcom ? '#10b981' : 'var(--primary)'} />
                            <div className={styles.optionTextGroup}>
                              <span className={styles.optionTitle}>{wh.name}</span>
                              {wh.clients?.name && (
                                <span className={styles.optionSub}>{wh.clients.name}</span>
                              )}
                            </div>
                          </div>

                          <div className={styles.optionBadges}>
                            {isEcom && (
                              <span className={styles.ecommerceBadge}>
                                <ShoppingBag size={10} /> E-commerce
                              </span>
                            )}
                            {isSelected && <Check size={16} color="var(--primary)" />}
                          </div>
                        </div>
                      );
                    })}

                    {filteredWebhooksForDropdown.length === 0 && (
                      <div className={styles.emptyMenu}>
                        Nenhuma loja encontrada para este filtro.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Oculta a URL se estiver em "Todas as Lojas" */}
          {selectedWebhookId !== 'all' && currentWebhook && (
            <div className={styles.urlBox}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                  URL do Webhook de Compras ({currentWebhook.name}):
                </span>
                <span>{webhookUrl}</span>
              </div>
              <button className={styles.copyBtn} onClick={copyWebhookUrl}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>
          )}
        </div>

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

        {/* Toolbar de Pesquisa e Filtros */}
        <div className={styles.toolbar}>
          <div className={styles.searchGroup}>
            <Search size={18} color="var(--muted-foreground)" />
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
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <Loader />
            </div>
          ) : filteredPurchases.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Gateway</th>
                  <th>Cliente</th>
                  <th>Valor Total</th>
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
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
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
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Direto</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <button
                        className={styles.detailsBtn}
                        onClick={() => setSelectedOrder(item)}
                        title="Ver Recibo do Pedido"
                      >
                        <Receipt size={14} />
                        <span>Recibo</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <ShoppingBag size={48} opacity={0.2} />
              <h3 style={{ margin: 0 }}>Nenhuma venda encontrada</h3>
              <p style={{ maxWidth: '420px', fontSize: '0.9rem', margin: 0 }}>
                Clique no botão <strong>"Simular Venda de Teste"</strong> no topo para testar a experiência e visualizar o recibo e-commerce!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PREMIUIM E-COMMERCE (RECIBO DE COMPRA COM PARTÍCULAS E SOM) */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          {/* Partículas flutuantes festivas de E-commerce */}
          {particles.map((p) => (
            <span
              key={p.id}
              className={styles.particle}
              style={{
                left: `${p.left}%`,
                top: '-20px',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                fontSize: `${p.size}rem`
              }}
            >
              {p.symbol}
            </span>
          ))}

          <div className={styles.ecommerceModal} onClick={(e) => e.stopPropagation()}>
            {/* Header do Recibo */}
            <div className={styles.modalReceiptHeader}>
              <div className={styles.receiptBrand}>
                <div className={styles.receiptIconBox}>
                  <Receipt size={24} />
                </div>
                <div className={styles.receiptOrderInfo}>
                  <div className={styles.receiptOrderTitle}>
                    <span>Pedido #{selectedOrder.order_id}</span>
                    {getGatewayBadge(selectedOrder.gateway)}
                  </div>
                  <span className={styles.receiptOrderDate}>
                    {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <button className={styles.modalCloseBtn} onClick={() => setSelectedOrder(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {/* Hero Summary Card */}
            <div className={styles.heroSummary}>
              <div>
                <span className={styles.heroPriceLabel}>Valor Total Pago</span>
                <div className={styles.heroPriceValue}>
                  {formatCurrency(parseFloat(selectedOrder.total_amount || 0))}
                </div>
              </div>

              <div className={styles.heroBadges}>
                {getStatusBadge(selectedOrder.status)}
                <span className={styles.gatewayBadge} style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <CreditCard size={12} style={{ marginRight: '0.2rem' }} /> Aprovado
                </span>
              </div>
            </div>

            {/* Card do Cliente */}
            <div className={styles.customerCard}>
              <div className={styles.customerAvatar}>
                {getCustomerInitials(selectedOrder.customer_name)}
              </div>
              <div className={styles.customerDetails}>
                <span className={styles.customerName}>{selectedOrder.customer_name || 'Cliente'}</span>
                <div className={styles.customerMeta}>
                  <span><Mail size={12} style={{ marginRight: '0.2rem' }} />{selectedOrder.customer_email || 'E-mail não informado'}</span>
                  {selectedOrder.visitor_id && (
                    <span>• VID: <code style={{ color: '#a7f3d0' }}>{selectedOrder.visitor_id}</code></span>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de Produtos / Itens Comprados */}
            <div className={styles.itemsCard}>
              <div className={styles.itemsHeader}>
                <span>Produto(s) no Pedido</span>
                <span>Subtotal</span>
              </div>

              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                selectedOrder.items.map((prod: any, idx: number) => (
                  <div key={idx} className={styles.productRow}>
                    <div className={styles.productMain}>
                      <div className={styles.productThumb}>
                        <Package size={18} />
                      </div>
                      <div>
                        <div className={styles.productName}>{prod.name}</div>
                        <div className={styles.productQty}>Qtd: {prod.quantity || 1}x</div>
                      </div>
                    </div>
                    <div className={styles.productPrice}>
                      {formatCurrency(parseFloat(prod.price || 0) * (prod.quantity || 1))}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.productRow}>
                  <div className={styles.productMain}>
                    <div className={styles.productThumb}><Package size={18} /></div>
                    <span className={styles.productName}>Pedido de Item Único</span>
                  </div>
                  <div className={styles.productPrice}>{formatCurrency(parseFloat(selectedOrder.total_amount || 0))}</div>
                </div>
              )}
            </div>

            {/* Card de Atribuição & Origem */}
            <div className={styles.attributionCard}>
              <span className={styles.attrTitle}>
                <Tag size={14} /> Atribuição & Origem da Compra
              </span>
              <div className={styles.attrPillsGroup}>
                <div className={styles.attrPill}>
                  <span>Fonte:</span> <strong>{selectedOrder.utm_source || 'Direto'}</strong>
                </div>
                {selectedOrder.utm_medium && (
                  <div className={styles.attrPill}>
                    <span>Meio:</span> <strong>{selectedOrder.utm_medium}</strong>
                  </div>
                )}
                {selectedOrder.utm_campaign && (
                  <div className={styles.attrPill}>
                    <span>Campanha:</span> <strong>{selectedOrder.utm_campaign}</strong>
                  </div>
                )}
                <div className={styles.attrPill}>
                  <span>Gateway:</span> <strong style={{ textTransform: 'uppercase' }}>{selectedOrder.gateway}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
