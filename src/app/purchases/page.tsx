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
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  ChevronDown,
  Filter,
  Trash2,
  Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/Loader/Loader';
import DeleteModal from '@/components/DeleteModal/DeleteModal';
import { decodeHtml } from '@/utils/decode';
import { logAction } from '@/utils/logger';

const isPaidPurchase = (order: any): boolean => {
  if (!order) return false;
  const marketing = order.context?.marketing || {};
  const medium = (order.utm_medium || marketing.medium || '').toLowerCase();
  const source = (order.utm_source || marketing.source || '').toLowerCase();
  const paidMediums = ['cpc', 'ppc', 'paid', 'ads', 'traffic', 'cmp-paid'];
  const hasClickId = !!(
    marketing.gclid ||
    marketing.fbclid ||
    marketing.ttclid ||
    marketing.msclkid ||
    marketing.gbraid ||
    marketing.wbraid
  );
  return paidMediums.includes(medium) || hasClickId || source.includes('ads') || medium.includes('ads');
};

const WOO_ORDER_META_SNIPPET = `add_action('woocommerce_checkout_create_order', function ($order) {
  $vid = !empty($_POST['asthros_vid'])
    ? $_POST['asthros_vid']
    : (!empty($_COOKIE['_asthros_vid']) ? $_COOKIE['_asthros_vid'] : '');
  if ($vid) {
    $order->update_meta_data('_asthros_vid', sanitize_text_field($vid));
  }

  foreach (['source', 'medium', 'campaign', 'term', 'content', 'id'] as $key) {
    $post_key = 'utm_' . $key;
    $cookie_key = '_asthros_utm_' . $key;
    $val = !empty($_POST[$post_key])
      ? $_POST[$post_key]
      : (!empty($_COOKIE[$cookie_key]) ? $_COOKIE[$cookie_key] : '');
    if ($val) {
      $order->update_meta_data('_utm_' . $key, sanitize_text_field($val));
    }
  }
});`;

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
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderContextLoading, setOrderContextLoading] = useState(false);
  const [installTab, setInstallTab] = useState<'woocommerce' | 'shopify' | 'yampi'>('woocommerce');
  const [urlTest, setUrlTest] = useState<{ status: 'idle' | 'loading' | 'ok' | 'fail'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; orderId: string; orderLabel: string }>({
    show: false,
    orderId: '',
    orderLabel: '',
  });

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
        setIsAdmin(isUserAdmin);
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
          const { decryptPurchasesList } = await import('@/utils/frontendEncryption');
          setPurchases(await decryptPurchasesList(dbPurchases));
        }
      } catch (err) {
        console.error('Erro ao carregar dados de vendas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const isPaid = useMemo(
    () => (selectedOrder ? isPaidPurchase(selectedOrder) : false),
    [selectedOrder]
  );

  const orderCtx = useMemo(() => {
    const ctx = selectedOrder?.context || {};
    const marketing = ctx.marketing || {};
    return {
      device: ctx.device || {},
      location: ctx.location || {},
      behavior: ctx.behavior || {},
      marketing,
      journey: Array.isArray(ctx.journey)
        ? ctx.journey
        : Array.isArray(marketing.journey)
          ? marketing.journey
          : [],
      pagesVisited: Array.isArray(ctx.pages_visited)
        ? ctx.pages_visited
        : Array.isArray(marketing.pages_visited)
          ? marketing.pages_visited
          : [],
      firstTouch: ctx.first_touch || marketing.first_touch || null,
      lastTouch: ctx.last_touch || marketing.last_touch || null,
      referrer: marketing.referrer || '',
      utmSource: selectedOrder?.utm_source || marketing.source || '',
      utmMedium: selectedOrder?.utm_medium || marketing.medium || '',
      utmCampaign: selectedOrder?.utm_campaign || marketing.campaign || '',
      utmTerm: selectedOrder?.utm_term || marketing.term || '',
      utmContent: selectedOrder?.utm_content || marketing.content || '',
      utmId: marketing.id || '',
    };
  }, [selectedOrder]);

  // Enriquece o modal com contexto do lead (visitor_id) quando o pedido veio sem snapshot
  useEffect(() => {
    if (!selectedOrder?.visitor_id) return;
    const hasRich =
      selectedOrder.context?.device?.os ||
      selectedOrder.context?.location?.city ||
      (selectedOrder.context?.journey && selectedOrder.context.journey.length > 0) ||
      selectedOrder.context?.marketing?.journey?.length > 0;
    if (hasRich && (selectedOrder.utm_source || selectedOrder.context?.marketing?.source)) return;

    let cancelled = false;
    (async () => {
      try {
        setOrderContextLoading(true);
        const { data: leads } = await supabase
          .from('leads')
          .select('id, data, created_at')
          .eq('client_id', selectedOrder.client_id)
          .eq('data->>visitor_id', selectedOrder.visitor_id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (cancelled) return;
        const lead = leads?.[0];
        const data = lead?.data || {};
        if (!lead || !data) return;

        const marketing = data.marketing || {};
        setSelectedOrder((prev: any) => {
          if (!prev || prev.id !== selectedOrder.id) return prev;
          return {
            ...prev,
            utm_source: prev.utm_source || marketing.source || data.utm_source || null,
            utm_medium: prev.utm_medium || marketing.medium || data.utm_medium || null,
            utm_campaign: prev.utm_campaign || marketing.campaign || data.utm_campaign || null,
            utm_term: prev.utm_term || marketing.term || null,
            utm_content: prev.utm_content || marketing.content || null,
            context: {
              ...(prev.context || {}),
              device: { ...(prev.context?.device || {}), ...(data.device || {}) },
              location: { ...(prev.context?.location || {}), ...(data.location || {}) },
              behavior: { ...(prev.context?.behavior || {}), ...(data.behavior || {}) },
              marketing: { ...(prev.context?.marketing || {}), ...marketing },
              journey:
                (prev.context?.journey && prev.context.journey.length > 0
                  ? prev.context.journey
                  : marketing.journey) || [],
              first_touch: prev.context?.first_touch || marketing.first_touch || null,
              last_touch: prev.context?.last_touch || marketing.last_touch || null,
              pages_visited: prev.context?.pages_visited?.length > 0
                ? prev.context.pages_visited
                : marketing.pages_visited || [],
              source_lead_id: lead.id,
            },
          };
        });
      } catch (err) {
        console.error('Falha ao enriquecer pedido com lead:', err);
      } finally {
        if (!cancelled) setOrderContextLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.id, selectedOrder?.visitor_id, selectedOrder?.client_id]);

  // Realtime Supabase Subscription
  useEffect(() => {
    const channel = supabase
      .channel('purchases-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        async (payload) => {
          if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
          const { decryptPurchase, fetchEncryptionKey } = await import('@/utils/frontendEncryption');
          const key = await fetchEncryptionKey();
          const newPurchase = key
            ? await decryptPurchase(payload.new, key)
            : payload.new;
          setPurchases((prev) => {
            if (prev.some((p) => p.id === newPurchase.id || p.order_id === newPurchase.order_id)) {
              return prev.map((p) =>
                p.id === newPurchase.id || p.order_id === newPurchase.order_id ? newPurchase : p
              );
            }
            return [newPurchase, ...prev];
          });
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
    if (typeof window === 'undefined' || !currentWebhook?.id) return '';
    return `${window.location.origin}/api/webhooks/commerce/${currentWebhook.id}`;
  }, [currentWebhook]);

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhookUrl = async () => {
    if (!webhookUrl) return;
    setUrlTest({ status: 'loading', message: 'Testando...' });
    try {
      const getRes = await fetch(webhookUrl, { method: 'GET' });
      const getJson = await getRes.json().catch(() => ({}));
      if (!getRes.ok || !getJson?.matched) {
        setUrlTest({
          status: 'fail',
          message: getJson?.error || `GET falhou (${getRes.status}). Recarregue a página e selecione a loja de novo.`,
        });
        return;
      }

      const postRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'action.woocommerce_webhook_ping',
          'X-WC-Webhook-Source': window.location.origin,
        },
        body: JSON.stringify({ webhook_id: 1 }),
      });
      const postJson = await postRes.json().catch(() => ({}));
      if (!postRes.ok || !postJson?.success) {
        setUrlTest({
          status: 'fail',
          message: postJson?.error || `Ping POST falhou (${postRes.status}).`,
        });
        return;
      }

      setUrlTest({
        status: 'ok',
        message: `OK — ${getJson.webhook_name || 'loja'} autenticada. Cole exatamente esta URL no WooCommerce.`,
      });
    } catch (err: any) {
      setUrlTest({ status: 'fail', message: err?.message || 'Falha de rede ao testar a URL.' });
    }
  };

  const copyWooSnippet = () => {
    navigator.clipboard.writeText(WOO_ORDER_META_SNIPPET);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!isAdmin || !purchaseId) return;

    const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);

    if (!error) {
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      if (selectedOrder?.id === purchaseId) setSelectedOrder(null);
      setDeleteModal({ show: false, orderId: '', orderLabel: '' });
      logAction('Venda Excluída', 'purchase', purchaseId, { deleted_by: 'admin' });
    } else {
      alert('Erro ao excluir venda: ' + error.message);
    }
  };

  // Botão de Simulação de Venda de Teste
  const handleSimulateTestOrder = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockOrder = {
      id: `test-${Date.now()}`,
      client_id: currentWebhook?.client_id || null,
      order_id: `YAMPI-${randomNum}`,
      gateway: 'yampi',
      customer_name: 'Ana Clara Silva',
      customer_email: 'ana.clara@exemplo.com.br',
      customer_phone: '(11) 98877-6655',
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
      utm_term: 'skincare premium',
      utm_content: 'stories_cta',
      context: {
        device: { os: 'iOS', is_mobile: true, language: 'pt-BR', timezone: 'America/Sao_Paulo', screen: '390x844' },
        location: { ip: '177.92.10.22', city: 'São Paulo', region: 'SP', country: 'BR' },
        behavior: {
          page_url: 'https://loja.exemplo.com.br/produto/kit-glow',
          time_on_page: '2m 14s',
          scroll_depth: '78%',
          session_duration_seconds: 312,
          conversion_time_seconds: 186,
        },
        marketing: {
          source: 'instagram_ads',
          medium: 'cpc',
          campaign: 'campanha_verao_2026',
          term: 'skincare premium',
          content: 'stories_cta',
          fbclid: 'IwAR0test',
        },
        journey: [
          { url: 'https://loja.exemplo.com.br/?utm_source=instagram_ads', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { url: 'https://loja.exemplo.com.br/produto/kit-glow', timestamp: new Date(Date.now() - 1800000).toISOString() },
          { url: 'https://loja.exemplo.com.br/checkout', timestamp: new Date(Date.now() - 300000).toISOString() },
        ],
      },
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
        item.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase());

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
    if (lower === 'woocommerce') return <span className={`${styles.gatewayBadge} ${styles.gatewayWoo}`}>WooCommerce</span>;
    return <span className={`${styles.gatewayBadge} ${styles.gatewayGeneric}`}>{gtw || 'Webhook'}</span>;
  };

  const getStatusBadge = (st: string) => {
    const lower = (st || '').toLowerCase();
    if (lower === 'approved' || lower === 'paid' || lower === 'processing' || lower === 'completed') {
      return <span className={styles.statusApproved}>Aprovado</span>;
    }
    if (lower === 'pending') return <span className={styles.statusPending}>Pendente</span>;
    return <span className={styles.statusCanceled}>Cancelado</span>;
  };

  const getStatusLabel = (st: string) => {
    const lower = (st || '').toLowerCase();
    if (lower === 'approved' || lower === 'paid' || lower === 'processing' || lower === 'completed') return 'Aprovado';
    if (lower === 'pending') return 'Pendente';
    return 'Cancelado';
  };

  const handleExportPurchasesPDF = async () => {
    const ordersToExport = filteredPurchases;
    if (ordersToExport.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const clientName = currentWebhook?.clients?.name || 'Geral';
    const webhookName = currentWebhook?.name || 'Todas as Lojas';

    // 1. Cabeçalho Escuro Padrão (Ajustado para Landscape - 297mm de largura)
    doc.setFillColor(10, 20, 35);
    doc.rect(0, 0, 297, 40, 'F');

    try {
      const logoUrl = '/asthros-leads.png';
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (e) => reject(e);
        image.src = logoUrl;
      });
      const logoWidth = 40;
      const logoHeight = (img.height * logoWidth) / img.width;
      const logoY = (40 - logoHeight) / 2;
      doc.addImage(img, 'PNG', 15, logoY, logoWidth, logoHeight);
    } catch (err) {
      doc.setTextColor(86, 215, 253);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('ASTHROS', 15, 22);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Vendas', 282, 16, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${clientName}`, 282, 22, { align: 'right' });
    doc.text(`Loja: ${webhookName}`, 282, 28, { align: 'right' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 34, { align: 'right' });

    // 2. Caixas de Estatísticas
    const approved = ordersToExport.filter((p) => p.status === 'approved' || p.status === 'paid');
    const totalRevenue = approved.reduce((acc, p) => acc + (parseFloat(p.total_amount) || 0), 0);
    const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;
    const approvalRate = ordersToExport.length > 0 ? (approved.length / ordersToExport.length) * 100 : 0;

    const drawStatBox = (x: number, y: number, w: number, h: number, title: string, value: string, color: [number, number, number]) => {
      doc.setFillColor(24, 28, 41);
      doc.rect(x, y, w, h, 'F');

      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, y, 3, h, 'F');

      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(title.toUpperCase(), x + 8, y + 6);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x + 8, y + 13);
    };

    drawStatBox(15, 46, 62, 18, 'Total de Pedidos', String(ordersToExport.length), [86, 215, 253]);
    drawStatBox(85, 46, 62, 18, 'Receita Aprovada', formatCurrency(totalRevenue), [46, 204, 113]);
    drawStatBox(155, 46, 62, 18, 'Ticket Médio', formatCurrency(avgTicket), [168, 85, 247]);
    drawStatBox(225, 46, 62, 18, 'Taxa de Aprovação', `${approvalRate.toFixed(1)}%`, [245, 158, 11]);

    // 3. Tabelas Agrupadas por Gateway
    const wooOrders = ordersToExport.filter((p) => (p.gateway || '').toLowerCase() === 'woocommerce');
    const shopifyOrders = ordersToExport.filter((p) => (p.gateway || '').toLowerCase() === 'shopify');
    const yampiOrders = ordersToExport.filter((p) => (p.gateway || '').toLowerCase() === 'yampi');
    const genericOrders = ordersToExport.filter(
      (p) => !['woocommerce', 'shopify', 'yampi'].includes((p.gateway || '').toLowerCase())
    );

    const generateGroupTable = (title: string, groupOrders: any[], startY: number) => {
      if (groupOrders.length === 0) return startY;

      const headers = ['Data/Hora', 'Pedido', 'Cliente', 'E-mail', 'Telefone', 'Total', 'Status', 'Canal (UTM)'];
      const tableRows = groupOrders.map((p) => [
        new Date(p.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        `#${p.order_id}`,
        p.customer_name || 'Cliente',
        p.customer_email || 'N/A',
        p.customer_phone || 'N/A',
        formatCurrency(parseFloat(p.total_amount || 0)),
        getStatusLabel(p.status),
        p.utm_source || 'Direto',
      ]);

      doc.setFillColor(10, 20, 35);
      doc.rect(15, startY, 267, 10, 'F');

      doc.setTextColor(86, 215, 253);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), 22, startY + 6.5);

      autoTable(doc, {
        head: [headers],
        body: tableRows,
        startY: startY + 12,
        theme: 'striped',
        headStyles: {
          fillColor: [10, 20, 35],
          textColor: [86, 215, 253],
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        margin: { top: 50, left: 15 },
      });

      return (doc as any).lastAutoTable.finalY + 15;
    };

    let currentY = 72;
    currentY = generateGroupTable('WooCommerce', wooOrders, currentY);
    currentY = generateGroupTable('Shopify', shopifyOrders, currentY);
    currentY = generateGroupTable('Yampi', yampiOrders, currentY);
    currentY = generateGroupTable('Webhooks Genéricos', genericOrders, currentY);

    // 4. Rodapé com paginação
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`Asthros | CO-B. - Relatório de Vendas - Confidencial`, 15, 200);
      doc.text(`Página ${i} de ${pageCount}`, 260, 200);
    }

    const formattedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`vendas_${formattedClientName}_${new Date().getTime()}.pdf`);
    logAction('Exportação de Vendas', 'purchase', undefined, {
      format: 'pdf',
      count: ordersToExport.length,
    });
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
              Acompanhe faturamento, pedidos e integre WooCommerce, Shopify ou Yampi via webhook de compras.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.exportPdfBtn} onClick={handleExportPurchasesPDF} title="Exportar vendas filtradas em PDF">
              <Download size={18} />
              <span>Exportar PDF</span>
            </button>
            <button className={styles.testBtn} onClick={handleSimulateTestOrder} title="Simular venda de teste e abrir modal de detalhes">
              <Sparkles size={18} />
              <span>Simular Venda de Teste</span>
            </button>
          </div>
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
            <>
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
              <button className={styles.copyBtn} onClick={testWebhookUrl} type="button" disabled={urlTest.status === 'loading'}>
                {urlTest.status === 'ok' ? <CheckCircle2 size={14} /> : <Play size={14} />}
                <span>{urlTest.status === 'loading' ? 'Testando...' : 'Testar URL'}</span>
              </button>
            </div>
            {urlTest.status !== 'idle' && (
              <p style={{
                margin: '0.6rem 0 0',
                fontSize: '0.82rem',
                color: urlTest.status === 'ok' ? '#2ecc71' : urlTest.status === 'fail' ? '#f87171' : 'var(--muted-foreground)',
              }}>
                {urlTest.message}
              </p>
            )}

            <div className={styles.installBox}>
              <div className={styles.installTabs}>
                <button
                  type="button"
                  className={`${styles.installTab} ${installTab === 'woocommerce' ? styles.installTabActive : ''}`}
                  onClick={() => setInstallTab('woocommerce')}
                >
                  WooCommerce
                </button>
                <button
                  type="button"
                  className={`${styles.installTab} ${installTab === 'shopify' ? styles.installTabActive : ''}`}
                  onClick={() => setInstallTab('shopify')}
                >
                  Shopify
                </button>
                <button
                  type="button"
                  className={`${styles.installTab} ${installTab === 'yampi' ? styles.installTabActive : ''}`}
                  onClick={() => setInstallTab('yampi')}
                >
                  Yampi
                </button>
              </div>

              {installTab === 'woocommerce' && (
                <>
                  <ol className={styles.installSteps}>
                    <li>Selecione a loja acima e clique em <strong>Testar URL</strong> — só continue se aparecer OK.</li>
                    <li>WooCommerce → Configurações → Avançado → Webhooks → Adicionar webhook.</li>
                    <li>Tópico: <code>Pedido criado</code> e outro para <code>Pedido atualizado</code>.</li>
                    <li>URL de entrega: cole <strong>exatamente</strong> a URL copiada (<code>/api/webhooks/commerce/...</code>). Sem barra no final.</li>
                    <li>Campo Secret do WooCommerce: deixe o que ele gerar. <strong>Não cole nada do Asthros nesse campo.</strong></li>
                    <li>Status: Ativo · API v3 · JSON. Depois salve e confira o log da entrega.</li>
                    <li>
                      <strong>Necessário para UTM/visitor</strong> — cole o snippet no <code>functions.php</code> (ou Code Snippets).
                      Sem isso o pedido chega sem origem.
                    </li>
                  </ol>
                  <pre className={styles.phpSnippet}>{WOO_ORDER_META_SNIPPET}</pre>
                  <button className={styles.copyBtn} onClick={copyWooSnippet} type="button">
                    {copiedSnippet ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSnippet ? 'Snippet copiado!' : 'Copiar snippet PHP'}</span>
                  </button>
                </>
              )}

              {installTab === 'shopify' && (
                <ol className={styles.installSteps}>
                  <li>Marque o cliente como <strong>E-commerce</strong> em Clientes.</li>
                  <li>Shopify Admin → Configurações → Notificações → Webhooks.</li>
                  <li>Criar webhook de <code>Order creation</code> e <code>Order payment</code>, formato JSON.</li>
                  <li>Cole a URL copiada acima (o <code>?secret=</code> precisa ficar na URL).</li>
                  <li>O tracker no <code>theme.liquid</code> continua sendo para leads/cliques — vendas entram só por este webhook.</li>
                </ol>
              )}

              {installTab === 'yampi' && (
                <ol className={styles.installSteps}>
                  <li>No painel Yampi, crie um webhook de pedido pago apontando para a URL copiada.</li>
                  <li>Eventos recomendados: <code>order.paid</code> (e <code>order.canceled</code> se quiser cancelamentos).</li>
                </ol>
              )}
            </div>
            </>
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
              <option value="woocommerce">WooCommerce</option>
              <option value="shopify">Shopify</option>
              <option value="yampi">Yampi</option>
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
                  <tr
                    key={item.id || item.order_id}
                    className={styles.clickableRow}
                    onClick={() => setSelectedOrder(item)}
                  >
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{item.order_id}</td>
                    <td>{getGatewayBadge(item.gateway)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.customer_name || 'Cliente'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                          {item.customer_email || 'Não informado'}
                          {item.customer_phone ? ` · ${item.customer_phone}` : ''}
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
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          className={styles.detailsBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(item);
                          }}
                          title="Ver detalhes do pedido"
                        >
                          <Eye size={14} />
                          <span>Detalhes</span>
                        </button>
                        {isAdmin && (
                          <button
                            className={styles.deleteBtnMini}
                            title="Excluir venda"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal({ show: true, orderId: item.id, orderLabel: item.order_id });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
                Selecione a loja acima, copie a URL do webhook e conecte WooCommerce, Shopify ou Yampi. Pedidos aparecem aqui — não na aba de Leads.
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={`${styles.detailModal} glass`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <h3>Detalhes do Pedido</h3>
                <span className={styles.modalSubtitle}>
                  #{selectedOrder.order_id}
                  {selectedOrder.id ? ` · ID: ${selectedOrder.id}` : ''}
                  {orderContextLoading ? ' · carregando contexto…' : ''}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.sectionGrid}>
                <div className={styles.infoSection}>
                  <h4>Pedido & Cliente</h4>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Valor Total</span>
                      <span className={`${styles.infoVal} ${styles.amountHighlight}`}>
                        {formatCurrency(parseFloat(selectedOrder.total_amount || 0))}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoVal}>{getStatusBadge(selectedOrder.status)}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Gateway</span>
                      <span className={styles.infoVal}>{getGatewayBadge(selectedOrder.gateway)}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Nome</span>
                      <span className={`${styles.infoVal} ${!selectedOrder.customer_name ? styles.infoValEmpty : ''}`}>
                        {selectedOrder.customer_name || 'Sem nome'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>E-mail</span>
                      <span className={`${styles.infoVal} ${!selectedOrder.customer_email ? styles.infoValEmpty : ''}`}>
                        {selectedOrder.customer_email || 'Sem e-mail'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Telefone</span>
                      <span className={`${styles.infoVal} ${!selectedOrder.customer_phone ? styles.infoValEmpty : ''}`}>
                        {selectedOrder.customer_phone || 'Sem telefone'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Data</span>
                      <span className={styles.infoVal}>
                        {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Visitor ID</span>
                      <span className={`${styles.infoVal} ${!selectedOrder.visitor_id ? styles.infoValEmpty : ''}`}>
                        {selectedOrder.visitor_id || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>IP</span>
                      <span className={`${styles.infoVal} ${!orderCtx.location.ip ? styles.infoValEmpty : ''}`}>
                        {orderCtx.location.ip || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Localização</span>
                      <span className={`${styles.infoVal} ${!orderCtx.location.city ? styles.infoValEmpty : ''}`}>
                        {orderCtx.location.city
                          ? `${decodeHtml(orderCtx.location.city)}/${decodeHtml(orderCtx.location.region || '')} (${orderCtx.location.country || 'BR'})`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Sistema</span>
                      <span className={`${styles.infoVal} ${!orderCtx.device.os ? styles.infoValEmpty : ''}`}>
                        {orderCtx.device.os || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Dispositivo</span>
                      <span className={`${styles.infoVal} ${orderCtx.device.is_mobile === undefined ? styles.infoValEmpty : ''}`}>
                        {orderCtx.device.is_mobile === undefined
                          ? 'N/A'
                          : orderCtx.device.is_mobile
                            ? 'Mobile'
                            : 'Desktop'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.infoSection}>
                  <h4>Comportamento & Engajamento</h4>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Página de Origem</span>
                      <span
                        className={`${styles.infoVal} ${(!orderCtx.behavior.page_url && !orderCtx.behavior.pageUrl) ? styles.infoValEmpty : ''}`}
                        title={decodeHtml(orderCtx.behavior.page_url || orderCtx.behavior.pageUrl || 'N/A')}
                      >
                        {decodeHtml(orderCtx.behavior.page_url || orderCtx.behavior.pageUrl || 'N/A')}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Tempo Ativo na Pág.</span>
                      <span className={`${styles.infoVal} ${!orderCtx.behavior.time_on_page ? styles.infoValEmpty : ''}`}>
                        {orderCtx.behavior.time_on_page || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Rolagem Máxima</span>
                      <span className={`${styles.infoVal} ${!orderCtx.behavior.scroll_depth ? styles.infoValEmpty : ''}`}>
                        {orderCtx.behavior.scroll_depth || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Duração da Sessão</span>
                      <span className={`${styles.infoVal} ${orderCtx.behavior.session_duration_seconds === undefined ? styles.infoValEmpty : ''}`}>
                        {orderCtx.behavior.session_duration_seconds !== undefined
                          ? `${orderCtx.behavior.session_duration_seconds}s`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Tempo p/ Conversão</span>
                      <span className={`${styles.infoVal} ${orderCtx.behavior.conversion_time_seconds === undefined ? styles.infoValEmpty : ''}`}>
                        {orderCtx.behavior.conversion_time_seconds !== undefined
                          ? `${orderCtx.behavior.conversion_time_seconds}s`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Idioma</span>
                      <span className={`${styles.infoVal} ${!orderCtx.device.language ? styles.infoValEmpty : ''}`}>
                        {orderCtx.device.language || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Timezone</span>
                      <span className={`${styles.infoVal} ${!orderCtx.device.timezone ? styles.infoValEmpty : ''}`}>
                        {orderCtx.device.timezone ? decodeHtml(orderCtx.device.timezone) : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Resolução</span>
                      <span className={`${styles.infoVal} ${!orderCtx.device.screen ? styles.infoValEmpty : ''}`}>
                        {orderCtx.device.screen || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`${styles.infoSection} ${isPaid ? styles.paidMediaSection : ''}`}>
                  <div className={styles.sectionTitleRow}>
                    <h4 style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>Aquisição & UTMs</h4>
                    {isPaid && <span className={styles.paidMediaBadge}>Mídia Paga</span>}
                  </div>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Source</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmSource ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmSource || 'Direto / Orgânico'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Medium</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmMedium ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmMedium || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Campaign</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmCampaign ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmCampaign || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Term</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmTerm ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmTerm || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM Content</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmContent ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmContent || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>UTM ID</span>
                      <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''} ${!orderCtx.utmId ? styles.infoValEmpty : ''}`}>
                        {orderCtx.utmId || 'N/A'}
                      </span>
                    </div>
                    {orderCtx.marketing.gclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Google Ads ID</span>
                        <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''}`} title={orderCtx.marketing.gclid}>
                          GCLID (Ativo)
                        </span>
                      </div>
                    )}
                    {orderCtx.marketing.fbclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Facebook Ads ID</span>
                        <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''}`} title={orderCtx.marketing.fbclid}>
                          FBCLID (Ativo)
                        </span>
                      </div>
                    )}
                    {orderCtx.marketing.ttclid && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>TikTok Ads ID</span>
                        <span className={`${styles.infoVal} ${isPaid ? styles.paidHighlight : ''}`} title={orderCtx.marketing.ttclid}>
                          TTCLID (Ativo)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(orderCtx.journey.length > 0 || orderCtx.firstTouch || orderCtx.pagesVisited.length > 0) && (
                <div className={styles.extraFieldsArea}>
                  <h4 className={styles.extraFieldsTitle}>Jornada do Visitante</h4>
                  <div className={styles.infoSection}>
                    {orderCtx.firstTouch && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Primeiro Toque</span>
                        <span className={styles.infoVal}>
                          {[orderCtx.firstTouch.source, orderCtx.firstTouch.medium].filter(Boolean).join(' / ') || 'N/A'}
                          {orderCtx.firstTouch.timestamp ? ` — ${new Date(orderCtx.firstTouch.timestamp).toLocaleString('pt-BR')}` : ''}
                        </span>
                      </div>
                    )}
                    {orderCtx.lastTouch && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Último Toque</span>
                        <span className={styles.infoVal}>
                          {[orderCtx.lastTouch.source, orderCtx.lastTouch.medium].filter(Boolean).join(' / ') || 'N/A'}
                          {orderCtx.lastTouch.timestamp ? ` — ${new Date(orderCtx.lastTouch.timestamp).toLocaleString('pt-BR')}` : ''}
                        </span>
                      </div>
                    )}
                    {orderCtx.referrer && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Referência de Entrada</span>
                        <span className={styles.infoVal}>{decodeHtml(orderCtx.referrer)}</span>
                      </div>
                    )}
                    {orderCtx.pagesVisited.length > 0 && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Páginas Visitadas</span>
                        <span className={styles.infoVal} title={orderCtx.pagesVisited.map((p: any) => p.path || p).join(', ')}>
                          {orderCtx.pagesVisited.length} página(s)
                        </span>
                      </div>
                    )}
                    <div className={styles.journeyTimeline}>
                      {orderCtx.journey.map((step: any, index: number) => {
                        const channel = [step.source, step.medium].filter(Boolean).join(' / ');
                        return (
                          <div key={index} className={styles.journeyStep}>
                            <div className={styles.journeyDot} />
                            <span className={styles.journeyUrl}>
                              {decodeHtml(step.url || step.page_url || 'URL desconhecida')}
                              {channel ? ` — ${decodeHtml(channel)}` : ''}
                            </span>
                            <span className={styles.journeyTime}>
                              {step.timestamp
                                ? new Date(step.timestamp).toLocaleString('pt-BR')
                                : 'Data não registrada'}
                              {step.campaign && step.campaign !== 'N/A' ? ` • Campanha: ${decodeHtml(step.campaign)}` : ''}
                              {step.referrer ? ` • Referência: ${decodeHtml(step.referrer)}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.extraFieldsArea}>
                <h4 className={styles.extraFieldsTitle}>Itens do Pedido</h4>
                <div className={styles.infoSection}>
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((prod: any, idx: number) => (
                      <div key={idx} className={styles.productRow}>
                        <div className={styles.productMain}>
                          <div className={styles.productThumb}>
                            <Package size={18} />
                          </div>
                          <div>
                            <div className={styles.productName}>{prod.name || 'Produto'}</div>
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
                        <div className={styles.productThumb}>
                          <Package size={18} />
                        </div>
                        <span className={styles.productName}>Pedido sem itens detalhados</span>
                      </div>
                      <div className={styles.productPrice}>
                        {formatCurrency(parseFloat(selectedOrder.total_amount || 0))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              {isAdmin ? (
                <button
                  className={styles.deleteBtn}
                  onClick={() => setDeleteModal({ show: true, orderId: selectedOrder.id, orderLabel: selectedOrder.order_id })}
                >
                  <Trash2 size={16} />
                  <span>Excluir Venda</span>
                </button>
              ) : (
                <div />
              )}
              <button className={styles.closeFooterBtn} onClick={() => setSelectedOrder(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal.show && (
        <DeleteModal
          title="Excluir Venda"
          message={`Você está prestes a excluir o pedido "#${deleteModal.orderLabel}". Isso remove o registro de faturamento e o vínculo com a jornada do lead.`}
          confirmLabel="Sim, Excluir Venda"
          onConfirm={() => handleDeletePurchase(deleteModal.orderId)}
          onCancel={() => setDeleteModal({ show: false, orderId: '', orderLabel: '' })}
        />
      )}
    </DashboardLayout>
  );
}
