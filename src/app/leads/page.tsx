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
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportModal from '@/components/ExportModal/ExportModal';
import DeleteModal from '@/components/DeleteModal/DeleteModal';

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
  
  // Filtros
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
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
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'active' | 'waiting' | 'disabled'>('all');
  
  const getLeadIcon = (source: string, size = 18) => {
    switch (source) {
      case 'whatsapp_tracker':
        return <MessageCircle size={size} className={styles.wppIcon} />;
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

  // Carregar Sessão e Dados
  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
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

        let leadsQuery = supabase.from('leads').select('*, webhooks(field_mapping)').order('created_at', { ascending: false });
        if (activeClientId) {
          leadsQuery = leadsQuery.eq('client_id', activeClientId);
        }
        
        const { data: leadsData } = await leadsQuery;
        if (leadsData) setLeads(leadsData);
      }
      setLoading(false);
    }
    loadAllData();
  }, []);

  const currentClient = useMemo(() => {
    if (!isAdmin) return clients.find(c => c.id === userClientId);
    return clients.find(c => c.id === selectedClientId);
  }, [selectedClientId, isAdmin, clients, userClientId]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const isActive = client.status === 'active' && (client.webhooks?.length || 0) > 0;
      const isWaiting = client.status === 'active' && (client.webhooks?.length || 0) === 0;
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
      result = result.filter(l => l.source === 'whatsapp_tracker');
    } else if (activeCategory === 'forms') {
      result = result.filter(l => l.source !== 'whatsapp_tracker');
    }

    // Busca por Texto
    if (filterName) result = result.filter(l => (l.name || '').toLowerCase().includes(filterName.toLowerCase()));
    if (filterEmail) result = result.filter(l => (l.email || '').toLowerCase().includes(filterEmail.toLowerCase()));
    
    return result;
  }, [currentClient, selectedWebhookId, filterName, filterEmail, leads, activeCategory]);

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

  const processExport = (password: string | null) => {
    if (exportType.type === 'pdf') {
      handleExportPDF(password);
    } else {
      const leadsToExport = filteredLeads.filter(l => l.source !== 'test_simulation');
      if (leadsToExport.length === 0) return;
      
      const content = exportType.type === 'csv' ? convertToCSV(leadsToExport) : JSON.stringify(leadsToExport, null, 2);
      const blob = new Blob([content], { type: exportType.type === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${currentClient?.name || 'asthros'}_${new Date().getTime()}.${exportType.type}`;
      a.click();
      logAction('Exportação Realizada', 'lead', undefined, { 
        format: exportType.type, 
        count: leadsToExport.length, 
        protected: !!password,
        password: password // Gravamos para consulta posterior no menu de relatórios
      });
    }
    setExportType({ show: false, type: '' });
  };

  const convertToCSV = (data: any[]) => {
    const dynamicKeys = new Set<string>();
    data.forEach(l => { if (l.data) Object.keys(l.data).forEach(k => dynamicKeys.add(k)); });
    const dynamicKeysArray = Array.from(dynamicKeys);
    const mapping = data[0]?.webhooks?.field_mapping || {};
    const headers = ['ID', 'Nome', 'E-mail', 'Telefone', 'Data', ...dynamicKeysArray.map(k => mapping[k] || k)];
    const rows = data.map(l => {
      const base = [l.id, l.name || '', l.email || '', l.phone || '', new Date(l.created_at).toLocaleString('pt-BR')];
      const extra = dynamicKeysArray.map(k => l.data?.[k] !== undefined ? String(l.data[k]) : '');
      return [...base, ...extra].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });
    return "\uFEFF" + [headers.join(','), ...rows].join('\n');
  };

  const handleExportPDF = async (password: string | null) => {
    const leadsToExport = filteredLeads.filter(l => l.source !== 'test_simulation');
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
    doc.text(`Cliente: ${currentClient?.name || 'Geral'}`, 282, 24, { align: 'right' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 30, { align: 'right' });

    const whatsappLeads = leadsToExport.filter(l => l.source === 'whatsapp_tracker');
    const formLeads = leadsToExport.filter(l => l.source !== 'whatsapp_tracker');

    const generateGroupTable = (title: string, groupLeads: any[], startY: number) => {
      if (groupLeads.length === 0) return startY;

      const hasEmail = groupLeads.some(l => l.email && l.email !== 'N/A');
      const hasPhone = groupLeads.some(l => l.phone && l.phone !== 'N/A');
      const hasPage = groupLeads.some(l => (l.data?.behavior?.page_url || l.data?.page_url));
      const hasButton = groupLeads.some(l => (l.data?.behavior?.button_text || l.data?.button_text));
      const hasTime = groupLeads.some(l => (l.data?.behavior?.time_on_page || l.data?.time_on_page));

      const headers = ['Data/Hora (captura)', 'Nome'];
      if (hasEmail) headers.push('E-mail');
      if (hasPhone) headers.push(title.includes('Formulário') ? 'Telefone/Whatsapp' : 'Telefone');
      if (hasPage) headers.push('Página');
      if (hasButton) headers.push('Nome Btn');
      if (hasTime) headers.push('Tempo na Pág.');

      const tableRows = groupLeads.map(l => {
        const row = [
          new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
          l.name || 'S/ Nome'
        ];
        if (hasEmail) row.push(l.email || 'N/A');
        if (hasPhone) row.push(l.phone || 'N/A');
        
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
                // Nome está na coluna 1
                const leadName = data.row.cells[1].raw as string;
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

    let currentY = 48;
    currentY = generateGroupTable('Whatsapp', whatsappLeads, currentY);
    currentY = generateGroupTable('Formulário', formLeads, currentY);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Asthros | CO-B. - Relatório de Leads - Confidencial`, 15, 200);
      doc.text(`Página ${i} de ${pageCount}`, 260, 200);
    }

    doc.save(`relatorio_leads_${currentClient?.name || 'asthros'}_${new Date().getTime()}.pdf`);
    logAction('Exportação Realizada', 'lead', undefined, { 
      format: 'pdf', 
      count: leadsToExport.length, 
      protected: !!password,
      password: password 
    });
    setExportOpen(false);
  };

  if (loading) {
    return (
      <DashboardLayout title="Gerenciamento de Leads">
        <Loader text="Sincronizando Leads" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gerenciamento de Leads">
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
                  Ativos <span>{clients.filter(c => c.status === 'active' && (c.webhooks?.length || 0) > 0).length}</span>
                </button>
                <button 
                  className={`${styles.filterTab} ${clientStatusFilter === 'waiting' ? `${styles.active} ${styles.waitingTab}` : ''}`}
                  onClick={() => setClientStatusFilter('waiting')}
                >
                  <Clock size={16} />
                  Aguardando <span>{clients.filter(c => c.status === 'active' && (c.webhooks?.length || 0) === 0).length}</span>
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
                const isActive = client.status === 'active' && (client.webhooks?.length || 0) > 0;
                const isWaiting = client.status === 'active' && (client.webhooks?.length || 0) === 0;
                const isDisabled = client.status !== 'active';
                const statusClass = isActive ? styles.cardActive : isWaiting ? styles.cardWaiting : styles.cardDisabled;

                return (
                  <div key={client.id} className={`${styles.card} ${statusClass} glass`} onClick={() => setSelectedClientId(client.id)}>
                    <div className={styles.cardTop}>
                      <div className={styles.clientLogoBox} style={{ backgroundColor: client.logo_bg || 'rgba(86, 215, 253, 0.1)' }}>
                        {client.logo_url ? (
                          <img src={client.logo_url} alt={client.name} className={styles.clientLogo} />
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
                <div className={styles.totalStatsCard}>
                  <div className={styles.totalIcon}><Database size={16} /></div>
                  <div className={styles.totalInfo}>
                    <span className={styles.totalLabel}>Total de Leads</span>
                    <strong className={styles.totalValue}>{filteredLeads.filter(l => l.source !== 'test_simulation').length}</strong>
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
                  WhatsApp
                </button>
              </div>


              <table className={styles.table}>
                <thead><tr><th>Lead</th><th>Contato</th><th>Origem</th><th>Data</th><th>Ações</th></tr></thead>
                <tbody>
                  {paginatedLeads.map(lead => (
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
                      <td><div className={styles.leadInfoMini}><span>{lead.email || 'N/A'}</span><span className={styles.leadEmail}>{lead.phone || 'N/A'}</span></div></td>
                      <td>
                        {lead.source === 'test_simulation' ? (
                          <div className={styles.sourceBadgeTest}><Database size={12} /> <span>Simulação</span></div>
                        ) : lead.source === 'whatsapp_tracker' ? (
                          <div className={styles.sourceBadgeZap}><Zap size={12} /> <span>WhatsApp</span></div>
                        ) : (
                          <div className={styles.sourceBadgeForm}><FileText size={12} /> <span>Form</span></div>
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
                  ))}
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
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
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
                <div className={styles.detailSection}><h4>Contato</h4><div className={styles.detailGrid}><div className={styles.detailItem}><label>E-mail</label><p>{selectedLead.email || 'N/A'}</p></div><div className={styles.detailItem}><label>Telefone</label><p>{selectedLead.phone || 'N/A'}</p></div></div></div>
                <div className={styles.detailSection}><h4>Captura</h4><div className={styles.detailGrid}><div className={styles.detailItem}><label>Data</label><p>{new Date(selectedLead.created_at).toLocaleString('pt-BR')}</p></div></div></div>
                <div className={styles.detailSection}>
                  <h4>Dados da Captura</h4>
                  <div className={styles.jsonView}>
                    {Object.entries(selectedLead.data || {}).map(([key, val]) => {
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
                          <span className={styles.jsonValue}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.drawerFooter}>
                <div className={styles.drawerActionsLeft}>
                  <button className={styles.primaryBtn} onClick={() => alert('Integrando com CRM...')}>Exportar para CRM</button>
                  {isAdmin && (
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => setDeleteModal({ show: true, leadId: selectedLead.id })}
                    >
                      <Trash2 size={18} />
                      <span>Excluir Lead</span>
                    </button>
                  )}
                </div>
                <button className={styles.secondaryBtn} onClick={() => setSelectedLead(null)}>Fechar</button>
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
          onConfirm={processExport}
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
