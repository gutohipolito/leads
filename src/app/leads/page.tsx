'use client';

import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './leads.module.css';
import { 
  Users, 
  Database, 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal, 
  FileText, 
  Table as TableIcon, 
  FileJson,
  ArrowLeft,
  Webhook,
  X,
  Edit2,
  Save,
  Zap,
  MessageCircle,
  FlaskConical,
  FileDown,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Globe,
  Monitor,
  Cpu,
  MapPin,
  Copy,
  Check,
  Send,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportModal from '@/components/ExportModal/ExportModal';
import DeleteModal from '@/components/DeleteModal/DeleteModal';

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/^N\/A\s*/i, '').trim();
  return cleaned || 'N/A';
};

const formatTimeOnPage = (time: any): string => {
  if (time === undefined || time === null) return 'N/A';
  const str = String(time).toLowerCase();
  const num = parseInt(str.replace(/[^0-9]/g, '')) || 0;
  return `${num} segundos`;
};

const formatScrollDepth = (depth: any): string => {
  if (depth === undefined || depth === null) return 'N/A';
  const str = String(depth);
  const num = parseInt(str.replace(/[^0-9]/g, '')) || 0;
  return `${num}%`;
};

const getSanitizedLeads = (rawLeads: any[]): any[] => {
  return rawLeads
    .filter(l => l.source !== 'test_simulation')
    .map(l => {
      if (l.data?.behavior?.whatsapp_destination_phone) {
        const clone = {
          ...l,
          data: {
            ...l.data,
            behavior: {
              ...l.data.behavior
            }
          }
        };
        delete clone.data.behavior.whatsapp_destination_phone;
        return clone;
      }
      return l;
    });
};

export default function LeadsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null);

  // Status de reenvio e logs de integração
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const handleLogoError = (clientId: string) => {
    setFailedLogos(prev => ({ ...prev, [clientId]: true }));
  };
  
  const handleCopyRowValue = (key: string, value: any) => {
    const textToCopy = typeof value === 'object' ? JSON.stringify(value) : String(value);
    navigator.clipboard.writeText(textToCopy);
    setCopiedRowKey(key);
    setTimeout(() => setCopiedRowKey(null), 2000);
  };

  const getOSLogo = (platform: string) => {
    const pf = (platform || '').toLowerCase();
    
    // Windows
    if (pf.includes('win')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0078d7' }}>
          <path d="M0 3.449L9.75 2.1v9.45H0V3.449zM0 12.45h9.75v9.45L0 20.551v-8.1zM11.25 1.9L24 0v11.55H11.25V1.9zM11.25 12.45H24v11.55l-12.75-1.9v-9.65z" />
        </svg>
      );
    }
    // Apple (Mac/iOS/iPhone/iPad)
    if (pf.includes('mac') || pf.includes('ios') || pf.includes('iphone') || pf.includes('ipad') || pf.includes('ipod')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a2aaad' }}>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z" />
        </svg>
      );
    }
    // Android
    if (pf.includes('android')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3ddc84' }}>
          <path d="M17.5 12c-.8 0-1.5-.7-1.5-1.5S16.7 9 17.5 9s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm-11 0c-.8 0-1.5-.7-1.5-1.5S5.7 9 6.5 9s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm11.2-5.8l1.7-2.9c.1-.2 0-.5-.2-.6-.2-.1-.5 0-.6.2l-1.8 3C15.4 5.3 13.8 5 12 5s-3.4.3-4.8.9L5.4 2.9c-.1-.2-.4-.3-.6-.2-.2.1-.3.4-.2.6l1.7 2.9C3.7 7.7 2 10.6 2 14h20c0-3.4-1.7-6.3-4.3-7.8z" />
        </svg>
      );
    }
    // Linux
    if (pf.includes('linux') || pf.includes('x11')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ecc94b' }}>
          <path d="M12 .007c-.424 0-1.12.213-1.6.48-1.536.853-2.585 2.507-2.88 4.293-.16.96.096 2.373.576 3.12.16.24.16.267.053.48-.32.613-.88 2.053-1.12 2.827-.453 1.493-.826 3.92-.853 5.466-.027.907.026 1.147.293 1.494.347.453.933.72 1.627.72h.426l.4-.507c1.014-1.28 2.214-1.893 3.654-1.893 1.333 0 2.453.533 3.466 1.627l.454.48h.373c1.067 0 1.947-.64 2.213-1.627.187-.667.24-2.827.107-4.133-.107-1.147-.32-2.48-.56-3.467-.213-.827-.72-2.32-.987-2.987-.08-.187-.08-.213.027-.373.48-.693.853-2.027.853-3.147 0-1.573-.773-3.173-1.947-4.053-.613-.48-1.786-.88-2.453-.88zm-2.053 5.387c.667 0 1.2.533 1.2 1.2s-.533 1.2-1.2 1.2-1.2-.533-1.2-1.2.533-1.2 1.2-1.2zm4.106 0c.667 0 1.2.533 1.2 1.2s-.533 1.2-1.2 1.2-1.2-.533-1.2-1.2.533-1.2 1.2-1.2z" />
        </svg>
      );
    }
    
    // Fallback: Ícone genérico Cpu
    return <Cpu size={14} />;
  };
  
  // Filtros
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  
  // Renomeação de campos
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameConfig, setRenameConfig] = useState({
    webhookId: '',
    originalKey: '',
    newName: ''
  });
  
  const [exportType, setExportType] = useState<{show: boolean, type: string}>({ show: false, type: '' });
  const [deleteModal, setDeleteModal] = useState<{show: boolean, leadId: string}>({ show: false, leadId: '' });
  
  // Filtro de Status do Cliente
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'active' | 'waiting' | 'disabled'>('active');
  
  const getLeadIcon = (source: string, size = 18) => {
    switch (source) {
      case 'whatsapp_tracker':
        return <MessageCircle size={size} className={styles.wppIcon} />;
      case 'custom_tracker':
        return <Zap size={size} className={styles.zapIcon} />;
      case 'test_simulation':
        return <FlaskConical size={size} className={styles.testIcon} />;
      default:
        return <FileText size={size} className={styles.formIcon} />;
    }
  };

  const handleStartRename = (key: string, currentDisplay: string, webhookId: string) => {
    setRenameConfig({
      webhookId,
      originalKey: key,
      newName: currentDisplay === key ? '' : currentDisplay
    });
    setIsRenaming(true);
  };

  const handleSaveRename = async () => {
    if (!renameConfig.webhookId) return;

    // 1. Buscar mapping atual
    const { data: webhook } = await supabase
      .from('webhooks')
      .select('field_mapping')
      .eq('id', renameConfig.webhookId)
      .single();

    const currentMapping = webhook?.field_mapping || {};
    const newMapping = { 
      ...currentMapping, 
      [renameConfig.originalKey]: renameConfig.newName 
    };

    // 2. Salvar novo mapping
    const { error } = await supabase
      .from('webhooks')
      .update({ field_mapping: newMapping })
      .eq('id', renameConfig.webhookId);

    if (!error) {
      // Atualizar estado local dos leads para refletir a mudança
      setLeads(prev => prev.map(l => {
        if (l.webhook_id === renameConfig.webhookId) {
          return { ...l, webhooks: { ...l.webhooks, field_mapping: newMapping } };
        }
        return l;
      }));
      setIsRenaming(false);
      logAction('Campo Renomeado', 'webhook', renameConfig.webhookId, { 
        key: renameConfig.originalKey, 
        alias: renameConfig.newName 
      });
    } else {
      alert('Erro ao renomear campo: ' + error.message);
    }
  };
  
  const handleDeleteLead = async (leadId: string) => {
    if (!isAdmin) return;
    
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (!error) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setSelectedLead(null);
      setDeleteModal({ show: false, leadId: '' });
      logAction('Lead Excluído', 'lead', leadId, { deleted_by: 'admin' });
    } else {
      alert('Erro ao excluir lead: ' + error.message);
    }
  };

  // Monitorar seleção do Lead para carregar logs de sincronização
  useEffect(() => {
    if (selectedLead) {
      fetchIntegrationLogs(selectedLead.id);
    } else {
      setIntegrationLogs([]);
      setExpandedLogId(null);
    }
  }, [selectedLead]);

  const fetchIntegrationLogs = async (leadId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setIntegrationLogs(data);
      }
    } catch (e) {
      console.error('Erro ao carregar logs de integração:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRetryIntegrations = async (leadId: string) => {
    setRetrying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/leads/retry', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify({ leadId })
      });
      const result = await response.json();
      if (response.ok) {
        alert('Integrações disparadas e reprocessadas com sucesso!');
        fetchIntegrationLogs(leadId); // Atualiza os logs na tela
      } else {
        alert('Falha ao reprocessar: ' + result.error);
      }
    } catch (e: any) {
      alert('Erro de conexão: ' + e.message);
    } finally {
      setRetrying(false);
    }
  };

  // Carregar Sessão e Dados
  useEffect(() => {
    async function loadAllData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('system_users').select('*').eq('email', user.email).single();
          const isUserAdmin = profile?.role === 'admin';
          const clientId = profile?.client_id;
          setIsAdmin(isUserAdmin);
          setUserClientId(clientId);

          const { data: clientsData } = await supabase.from('clients').select(`*, webhooks (*), leads(count)`);
          if (clientsData) setClients(clientsData);

          // Checar Impersonação
          const impersonated = localStorage.getItem('impersonated_client');
          let activeClientId = clientId;
          
          if (isUserAdmin && impersonated) {
            const impData = JSON.parse(impersonated);
            activeClientId = impData.id;
            setSelectedClientId(impData.id);
          }

          let leadsQuery = supabase.from('leads').select('*, webhooks(name, field_mapping)').order('created_at', { ascending: false });
          if (activeClientId) {
            leadsQuery = leadsQuery.eq('client_id', activeClientId);
          }
          
          const { data: leadsData } = await leadsQuery;
          if (leadsData) setLeads(leadsData);
        }
      } catch (error) {
        console.error('Erro ao carregar leads:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  const currentClient = useMemo(() => {
    if (!isAdmin) return clients.find(c => c.id === userClientId);
    return clients.find(c => c.id === selectedClientId);
  }, [selectedClientId, isAdmin, clients, userClientId]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const hasActiveWebhook = client.webhooks?.some((wh: any) => wh.status === 'active');
      const hasAnyWebhook = (client.webhooks?.length || 0) > 0;
      
      const isActive = client.status === 'active' && hasActiveWebhook;
      const isWaiting = client.status === 'active' && !hasActiveWebhook;
      const isDisabled = client.status !== 'active';

      if (clientStatusFilter === 'active') return isActive;
      if (clientStatusFilter === 'waiting') return isWaiting;
      if (clientStatusFilter === 'disabled') return isDisabled;
      return true;
    });
  }, [clients, clientStatusFilter]);

  const showClientSelection = isAdmin && !selectedClientId;
  const showWebhookSelection = currentClient && currentClient.webhooks?.length > 1 && !selectedWebhookId;
  const showLeadsList = (currentClient && (!currentClient.webhooks || currentClient.webhooks.length <= 1)) || selectedWebhookId;

  const [activeCategory, setActiveCategory] = useState<'all' | 'forms' | 'whatsapp'>('all');

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    
    // Filtro por Cliente
    if (currentClient) result = result.filter(l => l.client_id === currentClient.id);
    
    // Filtro por Webhook (se selecionado)
    if (selectedWebhookId) {
      result = result.filter(l => l.webhook_id === selectedWebhookId);
    } else if (currentClient && currentClient.webhooks?.length === 1) {
      result = result.filter(l => l.webhook_id === currentClient.webhooks[0].id);
    }

    // Filtro por Categoria (Abas)
    if (activeCategory === 'whatsapp') {
      result = result.filter(l => l.source === 'whatsapp_tracker' || l.source === 'custom_tracker');
    } else if (activeCategory === 'forms') {
      result = result.filter(l => l.source !== 'whatsapp_tracker' && l.source !== 'custom_tracker');
    }

    // Filtro por Período de Data
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(l => {
        const createdDate = new Date(l.created_at);
        if (dateFilter === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return createdDate >= today;
        }
        if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return createdDate >= sevenDaysAgo;
        }
        if (dateFilter === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return createdDate >= startOfMonth;
        }
        if (dateFilter === 'custom') {
          let match = true;
          if (customStartDate) {
            const start = new Date(customStartDate + 'T00:00:00');
            match = match && createdDate >= start;
          }
          if (customEndDate) {
            const end = new Date(customEndDate + 'T23:59:59');
            match = match && createdDate <= end;
          }
          return match;
        }
        return true;
      });
    }

    // Busca por Texto
    if (filterName) result = result.filter(l => (l.name || '').toLowerCase().includes(filterName.toLowerCase()));
    if (filterEmail) result = result.filter(l => (l.email || '').toLowerCase().includes(filterEmail.toLowerCase()));
    
    return result;
  }, [currentClient, selectedWebhookId, filterName, filterEmail, leads, activeCategory, dateFilter, customStartDate, customEndDate]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  const resetSelection = () => {
    if (selectedWebhookId && currentClient && currentClient.webhooks?.length > 1) {
      setSelectedWebhookId(null);
    } else {
      setSelectedClientId(null);
      setSelectedWebhookId(null);
    }
    setCurrentPage(1);
  };

  const handleExport = (format: string) => {
    setExportType({ show: true, type: format });
    setExportOpen(false);
  };

  const processExport = (password: string | null, selectedFields: string[]) => {
    if (exportType.type === 'pdf') {
      handleExportPDF(password, selectedFields);
    } else {
      const leadsToExport = getSanitizedLeads(filteredLeads);
      if (leadsToExport.length === 0) return;

      const webhookName = selectedWebhookId 
        ? currentClient?.webhooks?.find((w: any) => w.id === selectedWebhookId)?.name 
        : (currentClient?.webhooks?.length === 1 ? currentClient.webhooks[0].name : 'Todos');
      
      const formattedWebhookName = webhookName ? webhookName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'todos';
      const formattedClientName = (currentClient?.name || 'asthros').toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      let content = '';
      if (exportType.type === 'csv') {
        content = convertToCSV(leadsToExport, selectedFields);
      } else {
        const filteredLeadsData = leadsToExport.map(l => {
          const item: any = {};
          if (selectedFields.includes('id')) item.id = l.id;
          if (selectedFields.includes('created_at')) item.created_at = l.created_at;
          if (selectedFields.includes('name')) item.name = l.name;
          if (selectedFields.includes('email')) item.email = l.email;
          if (selectedFields.includes('phone')) item.phone = l.phone;
          if (selectedFields.includes('webhook') && l.webhooks) item.webhook = l.webhooks.name;
          
          if (l.data) {
            item.data = {};
            if (selectedFields.includes('page_url')) {
              if (l.data.page_url) item.data.page_url = l.data.page_url;
              if (l.data.behavior?.page_url) {
                item.data.behavior = item.data.behavior || {};
                item.data.behavior.page_url = l.data.behavior.page_url;
              }
            }
            if (selectedFields.includes('button_text')) {
              if (l.data.button_text) item.data.button_text = l.data.button_text;
              if (l.data.behavior?.button_text) {
                item.data.behavior = item.data.behavior || {};
                item.data.behavior.button_text = l.data.behavior.button_text;
              }
            }
            if (selectedFields.includes('time_on_page')) {
              if (l.data.time_on_page) item.data.time_on_page = l.data.time_on_page;
              if (l.data.behavior?.time_on_page) {
                item.data.behavior = item.data.behavior || {};
                item.data.behavior.time_on_page = l.data.behavior.time_on_page;
              }
            }
            if (selectedFields.includes('utm')) {
              if (l.data.marketing) item.data.marketing = l.data.marketing;
              if (l.data.utm_source) item.data.utm_source = l.data.utm_source;
              if (l.data.utm_medium) item.data.utm_medium = l.data.utm_medium;
              if (l.data.utm_campaign) item.data.utm_campaign = l.data.utm_campaign;
            }
            if (selectedFields.includes('location')) {
              if (l.data.location) item.data.location = l.data.location;
            }
            if (selectedFields.includes('custom_fields')) {
              Object.keys(l.data).forEach(key => {
                if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
                  item.data[key] = l.data[key];
                }
              });
            }
            if (Object.keys(item.data).length === 0) {
              delete item.data;
            }
          }
          return item;
        });
        content = JSON.stringify(filteredLeadsData, null, 2);
      }
      const blob = new Blob([content], { type: exportType.type === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${formattedClientName}_${formattedWebhookName}_${new Date().getTime()}.${exportType.type}`;
      a.click();
      logAction('Exportação Realizada', 'lead', undefined, { 
        format: exportType.type, 
        count: leadsToExport.length, 
        protected: !!password,
        fields: selectedFields
      });
    }
    setExportType({ show: false, type: '' });
  };

  const convertToCSV = (data: any[], selectedFields: string[]) => {
    const dynamicKeys = new Set<string>();
    if (selectedFields.includes('custom_fields')) {
      data.forEach(l => { 
        if (l.data) {
          Object.keys(l.data).forEach(k => {
            if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(k)) {
              dynamicKeys.add(k);
            }
          });
        }
      });
    }
    const dynamicKeysArray = Array.from(dynamicKeys);
    const mapping = data[0]?.webhooks?.field_mapping || {};

    const headers: string[] = [];
    if (selectedFields.includes('id')) headers.push('ID');
    if (selectedFields.includes('created_at')) headers.push('Data');
    if (selectedFields.includes('name')) headers.push('Nome');
    if (selectedFields.includes('email')) headers.push('E-mail');
    if (selectedFields.includes('phone')) headers.push('Telefone');
    if (selectedFields.includes('webhook')) headers.push('Terminal/Webhook');
    if (selectedFields.includes('page_url')) headers.push('Página');
    if (selectedFields.includes('button_text')) headers.push('Botão Clicado');
    if (selectedFields.includes('time_on_page')) headers.push('Tempo na Pág.');
    if (selectedFields.includes('utm')) {
      headers.push('UTM Source');
      headers.push('UTM Medium');
      headers.push('UTM Campaign');
    }
    if (selectedFields.includes('location')) {
      headers.push('Cidade');
      headers.push('Estado');
      headers.push('IP');
    }
    dynamicKeysArray.forEach(k => {
      headers.push(mapping[k] || k);
    });

    const rows = data.map(l => {
      const row: string[] = [];
      if (selectedFields.includes('id')) row.push(l.id || '');
      if (selectedFields.includes('created_at')) row.push(new Date(l.created_at).toLocaleString('pt-BR'));
      if (selectedFields.includes('name')) row.push(l.name || '');
      if (selectedFields.includes('email')) row.push(l.email || '');
      if (selectedFields.includes('phone')) row.push(formatPhone(l.phone));
      if (selectedFields.includes('webhook')) {
        const webhookLabel = l.webhooks?.name || (l.data?.captured_by?.name ? `${l.data.captured_by.name} (Removido)` : 'N/A');
        row.push(webhookLabel);
      }
      if (selectedFields.includes('page_url')) {
        row.push(l.data?.behavior?.page_url || l.data?.page_url || '');
      }
      if (selectedFields.includes('button_text')) {
        row.push(l.data?.behavior?.button_text || l.data?.button_text || '');
      }
      if (selectedFields.includes('time_on_page')) {
        row.push(l.data?.behavior?.time_on_page || l.data?.time_on_page || '');
      }
      if (selectedFields.includes('utm')) {
        row.push(l.data?.marketing?.source || l.data?.utm_source || '');
        row.push(l.data?.marketing?.medium || l.data?.utm_medium || '');
        row.push(l.data?.marketing?.campaign || l.data?.utm_campaign || '');
      }
      if (selectedFields.includes('location')) {
        row.push(l.data?.location?.city || '');
        row.push(l.data?.location?.region || '');
        row.push(l.data?.location?.ip || '');
      }
      dynamicKeysArray.forEach(k => {
        row.push(l.data?.[k] !== undefined ? String(l.data[k]) : '');
      });
      return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    return "\uFEFF" + [headers.join(','), ...rows].join('\n');
  };

  const handleExportPDF = async (password: string | null, selectedFields: string[]) => {
    const leadsToExport = getSanitizedLeads(filteredLeads);
    if (leadsToExport.length === 0) return;

    // No jsPDF moderno, a criptografia deve ser passada no construtor
    const doc = new jsPDF({ 
      orientation: 'landscape',
      encryption: password ? {
        userPassword: password,
        ownerPassword: password,
        userPermissions: ["print", "modify", "copy", "annot-forms"]
      } : undefined
    });

    const webhookName = selectedWebhookId 
      ? currentClient?.webhooks?.find((w: any) => w.id === selectedWebhookId)?.name 
      : (currentClient?.webhooks?.length === 1 ? currentClient.webhooks[0].name : 'Todos');

    // 1. Cabeçalho Personalizado (Ajustado para Landscape - 297mm de largura)
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
    doc.text('Relatório de Leads', 282, 16, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${currentClient?.name || 'Geral'}`, 282, 22, { align: 'right' });
    doc.text(`Terminal: ${webhookName || 'Todos'}`, 282, 28, { align: 'right' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 34, { align: 'right' });

    const whatsappLeads = leadsToExport.filter(l => l.source === 'whatsapp_tracker');
    const customLeads = leadsToExport.filter(l => l.source === 'custom_tracker');
    const formLeads = leadsToExport.filter(l => l.source !== 'whatsapp_tracker' && l.source !== 'custom_tracker');

    const generateGroupTable = (title: string, groupLeads: any[], startY: number) => {
      if (groupLeads.length === 0) return startY;

      const hasEmail = selectedFields.includes('email') && groupLeads.some(l => l.email && l.email !== 'N/A');
      const hasPhone = selectedFields.includes('phone') && groupLeads.some(l => {
        const p = formatPhone(l.phone);
        return p && p !== 'N/A';
      });
      const hasPage = selectedFields.includes('page_url') && groupLeads.some(l => (l.data?.behavior?.page_url || l.data?.page_url));
      const hasButton = selectedFields.includes('button_text') && groupLeads.some(l => (l.data?.behavior?.button_text || l.data?.button_text));
      const hasTime = selectedFields.includes('time_on_page') && groupLeads.some(l => (l.data?.behavior?.time_on_page || l.data?.time_on_page));

      const headers: string[] = [];
      if (selectedFields.includes('created_at')) headers.push('Data/Hora (captura)');
      if (selectedFields.includes('name')) headers.push('Nome');
      if (hasEmail) headers.push('E-mail');
      if (hasPhone) headers.push(title.includes('Formulário') ? 'Telefone/Whatsapp' : 'Telefone');
      if (hasPage) headers.push('Página');
      if (hasButton) headers.push('Nome Btn');
      if (hasTime) headers.push('Tempo na Pág.');

      const tableRows = groupLeads.map(l => {
        const row: string[] = [];
        if (selectedFields.includes('created_at')) {
          row.push(new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
        }
        if (selectedFields.includes('name')) {
          row.push(l.name || 'S/ Nome');
        }
        if (hasEmail) row.push(l.email || 'N/A');
        if (hasPhone) row.push(formatPhone(l.phone));
        
        if (hasPage) {
          const url = l.data?.behavior?.page_url || l.data?.page_url || 'N/A';
          row.push(url !== 'N/A' ? (url.length > 30 ? '...' + url.substring(url.length - 27) : url) : 'N/A');
        }
        if (hasButton) row.push(l.data?.behavior?.button_text || l.data?.button_text || 'N/A');
        if (hasTime) row.push(l.data?.behavior?.time_on_page || l.data?.time_on_page || 'N/A');
        
        return row;
      });

      doc.setFillColor(10, 20, 35);
      doc.rect(15, startY, 133.5, 10, 'F');
      
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
          fontStyle: 'bold'
        },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        margin: { top: 50, left: 15 },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            const header = data.table.head[0].cells[data.column.index].raw as string;
            const cellValue = data.cell.raw as string;
            
            if (cellValue && cellValue !== 'N/A') {
              if (header === 'E-mail') {
                doc.setTextColor(86, 215, 253); 
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: `mailto:${cellValue}` });
              } 
              else if (header === 'Telefone' || header === 'Telefone/Whatsapp') {
                const cleanPhone = cellValue.replace(/\D/g, '');
                const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                // Encontrar a coluna de Nome no cabeçalho
                const nameColIndex = headers.indexOf('Nome');
                const leadName = nameColIndex !== -1 ? (data.row.cells[nameColIndex].raw as string) : '';
                const message = encodeURIComponent(`Olá ${leadName || ''}, Tudo bem?`);
                const url = `https://wa.me/${finalPhone}?text=${message}`;
                
                doc.setTextColor(37, 211, 102); 
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
              }
            }
          }
        }
      });

      return (doc as any).lastAutoTable.finalY + 15;
    };

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

    drawStatBox(15, 46, 62, 18, 'Total de Leads', String(leadsToExport.length), [86, 215, 253]);
    drawStatBox(85, 46, 62, 18, 'WhatsApp & Cliques', String(whatsappLeads.length), [37, 211, 102]);
    drawStatBox(155, 46, 62, 18, 'Cliques & Seletores', String(customLeads.length), [168, 85, 247]);
    drawStatBox(225, 46, 62, 18, 'Leads de Formulários', String(formLeads.length), [86, 215, 253]);

    let currentY = 72;
    currentY = generateGroupTable('WhatsApp', whatsappLeads, currentY);
    currentY = generateGroupTable('Cliques & Seletores', customLeads, currentY);
    currentY = generateGroupTable('Formulário', formLeads, currentY);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Asthros | CO-B. - Relatório de Leads - Confidencial`, 15, 200);
      doc.text(`Página ${i} de ${pageCount}`, 260, 200);
    }

    const formattedWebhookName = webhookName ? webhookName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'todos';
    const formattedClientName = (currentClient?.name || 'asthros').toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`relatorio_leads_${formattedClientName}_${formattedWebhookName}_${new Date().getTime()}.pdf`);
    logAction('Exportação Realizada', 'lead', undefined, { 
      format: 'pdf', 
      count: leadsToExport.length, 
      protected: !!password,
      fields: selectedFields
    });
    setExportOpen(false);
  };


  return (
    <DashboardLayout>
      <div className={styles.container}>
        
        {showClientSelection && (
          <div className={styles.selectionSection}>
            <div className={styles.listHeader}>
              <h3>Selecione um Cliente</h3>
              <div className={styles.clientFilters}>
                <button 
                  className={`${styles.filterTab} ${clientStatusFilter === 'all' ? styles.active : ''}`}
                  onClick={() => setClientStatusFilter('all')}
                >
                  <Users size={16} />
                  Todos <span>{clients.length}</span>
                </button>
                <button 
                  className={`${styles.filterTab} ${clientStatusFilter === 'active' ? `${styles.active} ${styles.activeTab}` : ''}`}
                  onClick={() => setClientStatusFilter('active')}
                >
                  <CheckCircle2 size={16} />
                  Ativos <span>{clients.filter(c => c.status === 'active' && c.webhooks?.some((wh: any) => wh.status === 'active')).length}</span>
                </button>
                <button 
                  className={`${styles.filterTab} ${clientStatusFilter === 'waiting' ? `${styles.active} ${styles.waitingTab}` : ''}`}
                  onClick={() => setClientStatusFilter('waiting')}
                >
                  <Clock size={16} />
                  Aguardando <span>{clients.filter(c => c.status === 'active' && !c.webhooks?.some((wh: any) => wh.status === 'active')).length}</span>
                </button>
                <button 
                  className={`${styles.filterTab} ${clientStatusFilter === 'disabled' ? `${styles.active} ${styles.disabledTab}` : ''}`}
                  onClick={() => setClientStatusFilter('disabled')}
                >
                  <XCircle size={16} />
                  Desativados <span>{clients.filter(c => c.status !== 'active').length}</span>
                </button>
              </div>
            </div>
            <div className={styles.selectionGrid}>
              {filteredClients.map(client => {
                const isActive = client.status === 'active' && client.webhooks?.some((wh: any) => wh.status === 'active');
                const isWaiting = client.status === 'active' && !isActive;
                const isDisabled = client.status !== 'active';
                const statusClass = isActive ? styles.cardActive : isWaiting ? styles.cardWaiting : styles.cardDisabled;

                return (
                  <div key={client.id} className={`${styles.card} ${statusClass} glass`} onClick={() => setSelectedClientId(client.id)}>
                    <div className={styles.cardTop}>
                      <div className={styles.clientLogoBox} style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.1)' }}>
                        {client.logo_url && !failedLogos[client.id] ? (
                          <img 
                            src={client.logo_url} 
                            alt={client.name} 
                            className={styles.clientLogo} 
                            onError={() => handleLogoError(client.id)}
                          />
                        ) : (
                          <span className={styles.initials}>{client.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className={`${styles.cardBadge} ${isActive ? styles.activeNeon : isWaiting ? styles.pendingNeon : ''}`}>
                        {isActive ? '● Ativo' : isWaiting ? '● Aguardando' : 'Inativo'}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3>{client.name}</h3>
                      <div className={styles.cardStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Terminais</span>
                          <span className={styles.statValue}>{client.webhooks?.length || 0}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Volume Leads</span>
                          <span className={styles.statValue}>{client.leads?.[0]?.count || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardFooter}>
                      <span className={styles.enterLabel}>Ver Detalhes</span>
                      <div className={styles.arrowCircle}><ChevronRight size={18} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {showWebhookSelection && (
          <div className={styles.selectionSection}>
            <div className={styles.listHeader}>
              <button className={styles.backBtn} onClick={resetSelection}><ArrowLeft size={18} /><span>Voltar</span></button>
              <h3>Selecione a Origem ({currentClient?.name})</h3>
            </div>
            <div className={styles.selectionGrid}>
              {currentClient?.webhooks.map((webhook: any) => (
                <div key={webhook.id} className={`${styles.card} glass`} onClick={() => setSelectedWebhookId(webhook.id)}>
                  <div className={styles.cardTop}><div className={styles.iconBox}><Webhook size={24} /></div></div>
                  <div className={styles.cardBody}><h3>{webhook.name}</h3></div>
                  <div className={styles.cardFooter}><span className={styles.enterLabel}>Acessar Leads</span><div className={styles.arrowCircle}><ChevronRight size={18} /></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showLeadsList && (
          <div className={styles.listSection}>
            <div className={styles.listHeader}>
              <button className={styles.backBtn} onClick={resetSelection}><ArrowLeft size={18} /><span>Voltar</span></button>
              <div className={styles.actions}>
                <div className={styles.statsRow}>
                  <div className={styles.totalStatsCard}>
                    <div className={styles.totalIcon}><Database size={14} /></div>
                    <div className={styles.totalInfo}>
                      <span className={styles.totalLabel}>Total</span>
                      <strong className={styles.totalValue}>{filteredLeads.filter(l => l.source !== 'test_simulation').length}</strong>
                    </div>
                  </div>
                  
                  <div className={`${styles.totalStatsCard} ${styles.cardForms}`}>
                    <div className={styles.totalIcon}><FileText size={14} /></div>
                    <div className={styles.totalInfo}>
                      <span className={styles.totalLabel}>Forms</span>
                      <strong className={styles.totalValue}>
                        {filteredLeads.filter(l => l.source !== 'whatsapp_tracker' && l.source !== 'test_simulation').length}
                      </strong>
                    </div>
                  </div>

                  <div className={`${styles.totalStatsCard} ${styles.cardWhatsApp}`}>
                    <div className={styles.totalIcon}><Zap size={14} /></div>
                    <div className={styles.totalInfo}>
                      <span className={styles.totalLabel}>Interações</span>
                      <strong className={styles.totalValue}>
                        {filteredLeads.filter(l => l.source === 'whatsapp_tracker' || l.source === 'custom_tracker').length}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className={styles.exportDropdown}>
                  <button className={styles.primaryBtn} onClick={() => setExportOpen(!exportOpen)}><Download size={18} /><span>Exportar Leads</span></button>
                  <div className={`${styles.dropdownMenu} ${exportOpen ? styles.open : ''}`}>
                    <button className={styles.dropdownItem} onClick={() => handleExport('csv')}><TableIcon size={16} /> <span>CSV</span></button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('json')}><FileJson size={16} /> <span>JSON</span></button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('pdf')}><FileDown size={16} /> <span>PDF</span></button>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.leadsTableWrapper}>
              <div className={styles.categoryTabs}>
                <button className={`${styles.catTab} ${activeCategory === 'all' ? styles.active : ''}`} onClick={() => setActiveCategory('all')}>
                  Todos os Leads
                </button>
                <button className={`${styles.catTab} ${activeCategory === 'forms' ? styles.active : ''}`} onClick={() => setActiveCategory('forms')}>
                  Formulários
                </button>
                <button className={`${styles.catTab} ${activeCategory === 'whatsapp' ? styles.active : ''}`} onClick={() => setActiveCategory('whatsapp')}>
                  Botões & Whats
                </button>
              </div>

              <div className={styles.filtersBar}>
                <div className={styles.filterField}>
                  <label>Buscar por Nome</label>
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome..." 
                    className={styles.filterInput}
                    value={filterName}
                    onChange={(e) => { setFilterName(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className={styles.filterField}>
                  <label>Buscar por E-mail</label>
                  <input 
                    type="text" 
                    placeholder="Filtrar por e-mail..." 
                    className={styles.filterInput}
                    value={filterEmail}
                    onChange={(e) => { setFilterEmail(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className={styles.filterField}>
                  <label>Período de Data</label>
                  <select 
                    className={styles.filterInput}
                    value={dateFilter}
                    onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
                  >
                    <option value="all">Sempre</option>
                    <option value="today">Hoje</option>
                    <option value="7days">Últimos 7 dias</option>
                    <option value="month">Este mês</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
                {dateFilter === 'custom' && (
                  <>
                    <div className={styles.filterField}>
                      <label>Data Inicial</label>
                      <input 
                        type="date" 
                        className={styles.filterInput}
                        value={customStartDate}
                        onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                      />
                    </div>
                    <div className={styles.filterField}>
                      <label>Data Final</label>
                      <input 
                        type="date" 
                        className={styles.filterInput}
                        value={customEndDate}
                        onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                      />
                    </div>
                  </>
                )}
              </div>

              <table className={styles.table}>
                <thead><tr><th>Lead</th><th>Contato</th><th>Origem</th><th>Engajamento</th><th>Data</th><th>Ações</th></tr></thead>
                <tbody>
                  {paginatedLeads.map(lead => {
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

                    return (
                      <tr key={lead.id} onClick={() => setSelectedLead(lead)} className={styles.clickableRow}>
                        <td>
                          <div className={styles.leadMain}>
                            <div className={styles.avatar}>
                              {getLeadIcon(lead.source, 20)}
                            </div>
                            <div>
                              <p className={styles.name}>{lead.name || 'Sem nome'}</p>
                              <p className={styles.id}>ID: {lead.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                         <td><div className={styles.leadInfoMini}><span>{lead.email || 'N/A'}</span><span className={styles.leadEmail}>{formatPhone(lead.phone)}</span></div></td>
                        <td>
                          {lead.source === 'test_simulation' ? (
                            <div className={styles.sourceBadgeTest}><Database size={12} /> <span>Simulação</span></div>
                          ) : lead.source === 'whatsapp_tracker' ? (
                            <div className={styles.sourceBadgeZap}><Zap size={12} /> <span>WhatsApp</span></div>
                          ) : isSelector ? (
                            <div className={styles.sourceBadgeZap} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }}><Zap size={12} /> <span>Seletor</span></div>
                          ) : isKeyword ? (
                            <div className={styles.sourceBadgeZap} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.2)' }}><Zap size={12} /> <span>Palavra-Chave</span></div>
                          ) : lead.source === 'custom_tracker' ? (
                            <div className={styles.sourceBadgeZap}><Zap size={12} /> <span>Botão</span></div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div className={styles.sourceBadgeForm}><FileText size={12} /> <span>Form</span></div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', display: 'block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {lead.webhooks?.name || lead.data?.captured_by?.name || ''}
                                {(!lead.webhooks?.name && lead.data?.captured_by?.name) ? ' (Removido)' : ''}
                              </span>
                            </div>
                          )}
                        </td>
                      <td>
                        {lead.data?.lead_score !== undefined ? (
                          <div className={`${styles.scoreBadgeMini} ${
                            lead.data.lead_score >= 70 ? styles.scoreHot : (lead.data.lead_score >= 40 ? styles.scoreWarm : styles.scoreCold)
                          }`}>
                            ⚡ {lead.data.lead_score} pts
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted-foreground)' }}>N/A</span>
                        )}
                      </td>
                      <td>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button 
                            className={styles.secondaryBtn} 
                            style={{ padding: '0.4rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(lead);
                            }}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {isAdmin && (
                            <button 
                              className={styles.deleteBtnMini} 
                              title="Excluir Lead"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteModal({ show: true, leadId: lead.id });
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>

              <div className={styles.pagination}>
                <div className={styles.pageSizeSelector}>
                  <span>Exibir:</span>
                  <select 
                    className={styles.pageSizeSelect}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={50}>50</option>
                  </select>
                  <span>leads por página</span>
                </div>

                <div className={styles.pageInfo}>
                  Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong>
                </div>

                <div className={styles.pageControls}>
                  <button 
                    className={styles.pageBtn} 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => p - 1)}
                    title="Anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    className={styles.pageBtn} 
                    disabled={currentPage === totalPages || totalPages === 0} 
                    onClick={() => setCurrentPage(p => p + 1)}
                    title="Próxima"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drawer: Detalhes do Lead */}
        {selectedLead && (
          <div className={styles.drawerOverlay} onClick={() => setSelectedLead(null)}>
            <div className={`${styles.drawer} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.drawerHeader}>
                <div className={styles.drawerTitle}>
                  <div className={styles.avatarBig}>
                    {getLeadIcon(selectedLead.source, 32)}
                  </div>
                  <div><h3>{selectedLead.name || 'Lead Sem Nome'}</h3><span>ID: {selectedLead.id}</span></div>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedLead(null)}><X size={24} /></button>
              </div>
              <div className={styles.drawerBody}>
                {/* Score de Engajamento */}
                {selectedLead.data?.lead_score !== undefined && (
                  <div className={`${styles.detailSection} ${styles.scoreSection}`}>
                    <div className={styles.scoreHUDContainer}>
                      <div className={`${styles.scoreHUDRing} ${
                        selectedLead.data.lead_score >= 70 ? styles.hudHot : (selectedLead.data.lead_score >= 40 ? styles.hudWarm : styles.hudCold)
                      }`}>
                        <span className={styles.scoreHUDValue}>{selectedLead.data.lead_score}</span>
                        <span className={styles.scoreHUDLabel}>Engajamento</span>
                      </div>
                      <div className={styles.scoreHUDInfo}>
                        <h4>Status do Lead</h4>
                        <h3>
                          {selectedLead.data.lead_score >= 70 ? '🔥 Lead Quente' : (
                            selectedLead.data.lead_score >= 40 ? '⚡ Lead Morno' : '❄️ Lead Frio'
                          )}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0 }}>
                          Score calculado com base no comportamento do usuário, cliques no WhatsApp, profundidade de scroll e tempo de tela.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.detailSection}>
                  <h4>Captura & Contexto</h4>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <label>Data</label>
                      <p>{new Date(selectedLead.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Terminal (Webhook)</label>
                      <p>
                        {selectedLead.webhooks?.name || selectedLead.data?.captured_by?.name || 'N/A'}
                        {(!selectedLead.webhooks?.name && selectedLead.data?.captured_by?.name) ? ' (Removido)' : ''}
                      </p>
                    </div>
                    <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                      <label>Página de Origem</label>
                      <p className={styles.truncateText} title={selectedLead.data?.marketing?.page_title || selectedLead.data?.behavior?.page_url}>
                        {selectedLead.data?.marketing?.page_title || 'Página do Site'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raio-X de Comportamento */}
                {selectedLead.data?.behavior && (
                  <div className={`${styles.detailSection} ${styles.behaviorSection}`}>
                    <div className={styles.sectionHeader}>
                      <Zap size={16} className={styles.sectionIcon} style={{ color: '#00D1FF' }} />
                      <h4>Raio-X de Comportamento</h4>
                    </div>
                    <div className={styles.behaviorGrid}>
                      {selectedLead.data.behavior.time_on_page !== undefined && (
                        <div className={styles.behaviorItem}>
                          <div className={styles.behaviorItemHeader}>
                            <Clock size={12} />
                            <span>Tempo na Página</span>
                          </div>
                          <span className={styles.behaviorItemValue}>
                            {formatTimeOnPage(selectedLead.data.behavior.time_on_page)}
                          </span>
                        </div>
                      )}
                      
                      {selectedLead.data.behavior.trigger_rule && (
                        <div className={styles.behaviorItem}>
                          <div className={styles.behaviorItemHeader}>
                            <Database size={12} />
                            <span>Regra de Disparo</span>
                          </div>
                          <span className={styles.behaviorItemValue}>
                            {selectedLead.data.behavior.trigger_rule}
                          </span>
                        </div>
                      )}

                      {selectedLead.data.behavior.button_text && (
                        <div className={styles.behaviorItem}>
                          <div className={styles.behaviorItemHeader}>
                            <MessageCircle size={12} />
                            <span>Botão Clicado</span>
                          </div>
                          <span className={styles.behaviorItemValue} style={{ color: '#25D366' }}>
                            "{selectedLead.data.behavior.button_text}"
                          </span>
                        </div>
                      )}

                      {selectedLead.data.behavior.scroll_depth !== undefined && (
                        <div className={`${styles.behaviorItem} ${styles.behaviorItemFull}`}>
                          <div className={styles.behaviorItemHeader}>
                            <span>Profundidade de Rolagem (Scroll)</span>
                          </div>
                          <div className={styles.scrollProgressContainer}>
                            <div className={styles.scrollProgressBar}>
                              <div 
                                className={styles.scrollProgressFill} 
                                style={{ width: `${Math.min(100, Math.max(0, parseInt(String(selectedLead.data.behavior.scroll_depth).replace(/[^0-9]/g, ''))))}%` }}
                              />
                            </div>
                            <span className={styles.scrollProgressText}>
                              {formatScrollDepth(selectedLead.data.behavior.scroll_depth)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Jornada do Lead (Atribuição Multitouch) */}
                {selectedLead.data?.marketing?.journey && selectedLead.data.marketing.journey.length > 0 && (
                  <div className={styles.detailSection}>
                    <div className={styles.sectionHeader}>
                      <Globe size={16} className={styles.sectionIcon} style={{ color: '#56D7FD' }} />
                      <h4>Jornada de Atribuição (Touchpoints)</h4>
                    </div>
                    <div className={styles.timeline}>
                      {selectedLead.data.marketing.journey.map((tp: any, index: number) => (
                        <div key={index} className={styles.timelineItem}>
                          <div className={styles.timelineDot}></div>
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineHeader}>
                              <span className={styles.timelineSource}>{tp.source} ({tp.medium})</span>
                              <span className={styles.timelineTime}>
                                {new Date(tp.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={styles.timelinePage} title={tp.page_url}>
                              Visualizou: <em>{tp.page_title || 'Página do Site'}</em>
                            </p>
                            {tp.campaign && tp.campaign !== 'N/A' && (
                              <span className={styles.timelineCampaign}>Campanha: {tp.campaign}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Canal/Atendente de Destino Rastreado (Apenas para Rastreio) */}
                {selectedLead.data?.behavior?.whatsapp_destination_phone && (
                  <div className={`${styles.detailSection} ${styles.trackerWarningSection}`}>
                    <div className={styles.sectionHeader}>
                      <MessageCircle size={16} className={styles.sectionIcon} style={{ color: '#25D366' }} />
                      <h4>WhatsApp de Destino Rastreado</h4>
                    </div>
                    <div className={styles.trackerContainer}>
                      <div className={styles.trackerPhoneRow}>
                        <span className={styles.trackerPhoneLabel}>Número Destino:</span>
                        <strong className={styles.trackerPhoneValue}>
                          +{selectedLead.data.behavior.whatsapp_destination_phone}
                        </strong>
                      </div>
                      <div className={styles.trackerNotice}>
                        <AlertTriangle size={14} className={styles.trackerNoticeIcon} />
                        <p>
                          <strong>Atenção:</strong> Este número pertence ao atendente/empresa do link clicado no site. 
                          É utilizado <strong>apenas para rastreamento</strong> (identificação do canal de destino se houver mais de um botão no site) 
                          e <strong>não</strong> representa o telefone de contato deste lead.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seção de Marketing (UTMs) */}
                {(selectedLead.data?.marketing || selectedLead.data?.utm_source) && (
                  <div className={styles.detailSection}>
                    <div className={styles.sectionHeader}>
                      <Globe size={16} className={styles.sectionIcon} />
                      <h4>Inteligência de Marketing</h4>
                    </div>
                    <div className={styles.marketingBadges}>
                      <div className={styles.mktBadge}>
                        <label>Fonte</label>
                        <span>{selectedLead.data?.marketing?.source || selectedLead.data?.utm_source || 'Direto'}</span>
                      </div>
                      <div className={styles.mktBadge}>
                        <label>Meio</label>
                        <span>{selectedLead.data?.marketing?.medium || selectedLead.data?.utm_medium || 'N/A'}</span>
                      </div>
                      <div className={styles.mktBadge}>
                        <label>Campanha</label>
                        <span>{selectedLead.data?.marketing?.campaign || selectedLead.data?.utm_campaign || 'N/A'}</span>
                      </div>
                    </div>
                    {selectedLead.data?.marketing?.referrer && (
                      <div className={styles.referrerInfo}>
                        <label>Vindo de:</label>
                        <span>{selectedLead.data.marketing.referrer}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Seção de Tecnologia (Device) */}
                {selectedLead.data?.device && (
                  <div className={styles.detailSection}>
                    <div className={styles.sectionHeader}>
                      <Monitor size={16} className={styles.sectionIcon} />
                      <h4>Tecnologia e Dispositivo</h4>
                    </div>
                    <div className={styles.deviceGrid}>
                      <div className={styles.deviceItem}>
                        {getOSLogo(selectedLead.data.device.platform)}
                        <div>
                          <label>Sistema / Plataforma</label>
                          <p>{selectedLead.data.device.platform}</p>
                        </div>
                      </div>
                      <div className={styles.deviceItem}>
                        <Monitor size={14} />
                        <div>
                          <label>Resolução / Viewport</label>
                          <p>{selectedLead.data.device.screen} ({selectedLead.data.device.viewport})</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seção de Localização */}
                {selectedLead.data?.location?.city && (
                  <div className={styles.detailSection}>
                    <div className={styles.sectionHeader}>
                      <MapPin size={16} className={styles.sectionIcon} style={{ color: '#f59e0b' }} />
                      <h4>Geolocalização do Lead</h4>
                    </div>
                    <div className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <label>Cidade / Estado</label>
                        <p>{decodeURIComponent(selectedLead.data.location.city)} {selectedLead.data.location.region ? `/ ${selectedLead.data.location.region}` : ''}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <label>País</label>
                        <p>{selectedLead.data.location.country || 'Brasil'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Integrações & Sincronização */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <Cpu size={16} className={styles.sectionIcon} style={{ color: '#a855f7' }} />
                    <h4>Integrações & Sincronização</h4>
                  </div>
                  {loadingLogs ? (
                    <div style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7, fontSize: '0.8rem' }}>
                      <div className={styles.spinner} style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> <span>Carregando logs de integração...</span>
                    </div>
                  ) : integrationLogs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
                      {integrationLogs.map((log: any) => {
                        const integrationName = log.request_body?.integration_name || 'Integração';
                        const integrationType = log.request_body?.integration_type || 'webhook';
                        const isSuccess = log.status_code >= 200 && log.status_code < 300;
                        const dateFormatted = new Date(log.created_at).toLocaleString('pt-BR');
                        
                        return (
                          <div 
                            key={log.id} 
                            style={{ 
                              background: 'rgba(255, 255, 255, 0.01)', 
                              border: '1px solid var(--border)', 
                              borderRadius: '10px', 
                              padding: '0.6rem 0.85rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ 
                                  width: '8px', 
                                  height: '8px', 
                                  borderRadius: '50%', 
                                  background: isSuccess ? '#25d366' : '#ff4d4d',
                                  boxShadow: isSuccess ? '0 0 8px rgba(37, 211, 102, 0.4)' : '0 0 8px rgba(255, 77, 77, 0.4)'
                                }} />
                                <strong style={{ fontSize: '0.8rem' }}>{integrationName} ({integrationType.toUpperCase()})</strong>
                              </div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>{dateFormatted}</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                              <span style={{ color: isSuccess ? '#25d366' : '#ff4d4d', fontWeight: 700 }}>
                                Status HTTP: {log.status_code}
                              </span>
                              <button 
                                type="button" 
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                              >
                                {expandedLogId === log.id ? 'Ocultar resposta' : 'Ver resposta da API'}
                              </button>
                            </div>
                            
                            {expandedLogId === log.id && (
                              <div style={{ 
                                background: 'rgba(0,0,0,0.2)', 
                                padding: '0.6rem', 
                                borderRadius: '6px', 
                                fontSize: '0.7rem', 
                                fontFamily: 'monospace', 
                                overflowX: 'auto', 
                                color: 'var(--muted-foreground)',
                                marginTop: '0.2rem',
                                border: '1px solid rgba(255, 255, 255, 0.03)'
                              }}>
                                {log.error_message && (
                                  <div style={{ color: '#ff4d4d', marginBottom: '0.3rem' }}>
                                    <strong>Erro:</strong> {log.error_message}
                                  </div>
                                )}
                                <div>
                                  <strong>Resposta:</strong>
                                  <pre style={{ margin: '0.2rem 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {log.response_body || 'Nenhuma resposta.'}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic', margin: '0.2rem 0' }}>
                      Nenhum envio registrado para este lead.
                    </p>
                  )}
                </div>

                <div className={styles.detailSection}>
                  <h4>Dados Brutos & Personalizados</h4>
                  <div className={styles.jsonView}>
                    {Object.entries(selectedLead.data || {}).map(([key, val]) => {
                      if (['marketing', 'behavior', 'device', 'timestamp', 'url'].includes(key)) return null;
                      
                      const isSystemField = ['name', 'email', 'phone', 'nome', 'telefone', 'e_mail', 'form_name', 'page_url'].includes(key.toLowerCase());
                      const displayKey = selectedLead.webhooks?.field_mapping?.[key] || key;
                      
                      return (
                        <div key={key} className={styles.jsonRow}>
                          <div className={styles.keyContainer}>
                            <span className={`${styles.jsonKey} ${isSystemField ? '' : styles.customField}`}>
                              {displayKey}
                            </span>
                            {!isSystemField && (
                              <button 
                                className={styles.editFieldBtn} 
                                title="Renomear este campo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(key, displayKey, selectedLead.webhook_id);
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                          <div className={styles.valueContainer}>
                            <span className={styles.jsonValue}>
                              {typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://')) ? (
                                <a href={val} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{val}</a>
                              ) : (
                                typeof val === 'object' ? JSON.stringify(val) : String(val)
                              )}
                            </span>
                            <button 
                              className={styles.copyRowBtn} 
                              title="Copiar valor"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyRowValue(key, val);
                              }}
                            >
                              {copiedRowKey === key ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.drawerFooter}>
                <div className={styles.drawerActionsLeft}>
                  <button 
                    className={styles.primaryBtn} 
                    onClick={() => handleRetryIntegrations(selectedLead.id)}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <div className={styles.spinnerMini} />
                    ) : (
                      <Send size={16} />
                    )}
                    <span>{retrying ? 'Repassando...' : 'Reenviar para CRM'}</span>
                  </button>
                  {isAdmin && (
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => setDeleteModal({ show: true, leadId: selectedLead.id })}
                    >
                      <Trash2 size={16} />
                      <span>Excluir Lead</span>
                    </button>
                  )}
                </div>
                <button className={styles.secondaryBtn} onClick={() => setSelectedLead(null)}>
                  <Check size={16} />
                  <span>Fechar</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal: Renomear Campo */}
        {isRenaming && (
          <div className={styles.modalOverlay} onClick={() => setIsRenaming(false)}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Renomear Campo Técnico</h3>
                <p>O ID original <strong>{renameConfig.originalKey}</strong> será substituído por este apelido em todo o sistema.</p>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label>Apelido do Campo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Onde nos conheceu?"
                    value={renameConfig.newName}
                    onChange={(e) => setRenameConfig({...renameConfig, newName: e.target.value})}
                    autoFocus
                  />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button className={styles.secondaryBtn} onClick={() => setIsRenaming(false)}>Cancelar</button>
                <button className={styles.primaryBtn} onClick={handleSaveRename}>
                  <Save size={18} />
                  <span>Salvar Apelido</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {exportType.show && (
        <ExportModal 
          format={exportType.type}
          onConfirm={(password, selectedFields) => processExport(password, selectedFields)}
          onCancel={() => setExportType({ show: false, type: '' })}
        />
      )}

      {deleteModal.show && (
        <DeleteModal 
          title="Excluir Lead"
          message={`Você está prestes a excluir o lead "${leads.find(l => l.id === deleteModal.leadId)?.name || 'Sem Nome'}".`}
          onConfirm={() => handleDeleteLead(deleteModal.leadId)}
          onCancel={() => setDeleteModal({ show: false, leadId: '' })}
        />
      )}
    </DashboardLayout>
  );
}
