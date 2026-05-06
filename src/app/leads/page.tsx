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
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

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
  const pageSize = 5;

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

        const { data: clientsData } = await supabase.from('clients').select(`*, webhooks (*)`);
        if (clientsData) setClients(clientsData);

        // Checar Impersonação
        const impersonated = localStorage.getItem('impersonated_client');
        let activeClientId = clientId;
        
        if (isUserAdmin && impersonated) {
          const impData = JSON.parse(impersonated);
          activeClientId = impData.id;
          setSelectedClientId(impData.id);
        }

        let leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
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

  const showClientSelection = isAdmin && !selectedClientId;
  const showWebhookSelection = currentClient && currentClient.webhooks?.length > 1 && !selectedWebhookId;
  const showLeadsList = (currentClient && (!currentClient.webhooks || currentClient.webhooks.length <= 1)) || selectedWebhookId;

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (currentClient) result = result.filter(l => l.client_id === currentClient.id);
    if (selectedWebhookId) {
      result = result.filter(l => l.webhook_id === selectedWebhookId);
    } else if (currentClient && currentClient.webhooks?.length === 1) {
      result = result.filter(l => l.webhook_id === currentClient.webhooks[0].id);
    }
    if (filterName) result = result.filter(l => (l.name || '').toLowerCase().includes(filterName.toLowerCase()));
    if (filterEmail) result = result.filter(l => (l.email || '').toLowerCase().includes(filterEmail.toLowerCase()));
    return result;
  }, [currentClient, selectedWebhookId, filterName, filterEmail, leads]);

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
    if (filteredLeads.length === 0) return;

    if (format === 'json') {
      const dataStr = JSON.stringify(filteredLeads, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asthros_leads_${new Date().getTime()}.json`;
      link.click();
    } else if (format === 'csv') {
      // Obter todas as chaves únicas de todos os leads.data para as colunas
      const dynamicKeys = new Set<string>();
      filteredLeads.forEach(l => {
        if (l.data) Object.keys(l.data).forEach(k => dynamicKeys.add(k));
      });
      const dynamicKeysArray = Array.from(dynamicKeys);

      const headers = ['ID', 'Nome', 'E-mail', 'Telefone', 'Data', ...dynamicKeysArray];
      
      const rows = filteredLeads.map(l => {
        const base = [
          l.id,
          l.name || '',
          l.email || '',
          l.phone || '',
          new Date(l.created_at).toLocaleString('pt-BR'),
        ];
        const extra = dynamicKeysArray.map(k => l.data?.[k] !== undefined ? String(l.data[k]) : '');
        return [...base, ...extra].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asthros_leads_${new Date().getTime()}.csv`;
      link.click();
    }

    logAction('Exportação Realizada', 'lead', undefined, { format, count: filteredLeads.length });
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
            <div className={styles.listHeader}><h3>Selecione um Cliente</h3></div>
            <div className={styles.selectionGrid}>
              {clients.map(client => (
                <div key={client.id} className={`${styles.card} glass`} onClick={() => setSelectedClientId(client.id)}>
                  <div className={styles.cardTop}>
                    <div className={styles.iconBox}><Users size={24} /></div>
                    <div className={styles.cardBadge}>{client.status === 'active' ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{client.name}</h3>
                    <div className={styles.cardStats}>
                      <div className={styles.statItem}><span className={styles.statLabel}>Webhooks</span><span className={styles.statValue}>{client.webhooks?.length || 0}</span></div>
                    </div>
                  </div>
                  <div className={styles.cardFooter}><span className={styles.enterLabel}>Ver Terminais</span><div className={styles.arrowCircle}><ChevronRight size={18} /></div></div>
                </div>
              ))}
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
                <div className={styles.exportDropdown}>
                  <button className={styles.primaryBtn} onClick={() => setExportOpen(!exportOpen)}><Download size={18} /><span>Exportar Leads</span></button>
                  <div className={`${styles.dropdownMenu} ${exportOpen ? styles.open : ''}`}>
                    <button className={styles.dropdownItem} onClick={() => handleExport('csv')}><TableIcon size={16} /> <span>CSV</span></button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('json')}><FileJson size={16} /> <span>JSON</span></button>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.leadsTableWrapper}>
              <div className={styles.filtersBar}>
                <div className={styles.filterField}><label>Nome</label><input type="text" className={styles.filterInput} value={filterName} onChange={(e) => setFilterName(e.target.value)}/></div>
                <div className={styles.filterField}><label>E-mail</label><input type="text" className={styles.filterInput} value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)}/></div>
                <div className={styles.filterField}><label>Total</label><div className={styles.countBadge}>{filteredLeads.length}</div></div>
              </div>

              <table className={styles.table}>
                <thead><tr><th>Lead</th><th>Contato</th><th>Data</th><th>Ações</th></tr></thead>
                <tbody>
                  {paginatedLeads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} className={styles.clickableRow}>
                      <td><div className={styles.leadMain}><div className={styles.avatar}>{(lead.name || 'U').charAt(0)}</div><div><p className={styles.name}>{lead.name || 'Sem nome'}</p><p className={styles.id}>ID: {lead.id.substring(0, 8)}</p></div></div></td>
                      <td><div className={styles.leadInfoMini}><span>{lead.email || 'N/A'}</span><span className={styles.leadEmail}>{lead.phone || 'N/A'}</span></div></td>
                      <td>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                      <td><button className={styles.secondaryBtn} style={{ padding: '0.4rem' }}><MoreHorizontal size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.pagination}>
                <div className={styles.pageControls}>
                  <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
                  <button className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} /></button>
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
                  <div className={styles.avatarBig}>{(selectedLead.name || 'U').charAt(0)}</div>
                  <div><h3>{selectedLead.name || 'Lead Sem Nome'}</h3><span>ID: {selectedLead.id}</span></div>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedLead(null)}><X size={24} /></button>
              </div>
              <div className={styles.drawerBody}>
                <div className={styles.detailSection}><h4>Contato</h4><div className={styles.detailGrid}><div className={styles.detailItem}><label>E-mail</label><p>{selectedLead.email || 'N/A'}</p></div><div className={styles.detailItem}><label>Telefone</label><p>{selectedLead.phone || 'N/A'}</p></div></div></div>
                <div className={styles.detailSection}><h4>Captura</h4><div className={styles.detailGrid}><div className={styles.detailItem}><label>Data</label><p>{new Date(selectedLead.created_at).toLocaleString('pt-BR')}</p></div></div></div>
                <div className={styles.detailSection}><h4>Payload JSON</h4><div className={styles.jsonView}>
                    {Object.entries(selectedLead.data || {}).map(([key, val]) => (
                      <div key={key} className={styles.jsonRow}><span className={styles.jsonKey}>{key}:</span><span className={styles.jsonValue}>{JSON.stringify(val)}</span></div>
                    ))}
                </div></div>
              </div>
              <div className={styles.drawerFooter}>
                <button className={styles.primaryBtn} onClick={() => alert('Integrando com CRM...')}>Exportar para CRM</button>
                <button className={styles.secondaryBtn} onClick={() => setSelectedLead(null)}>Fechar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
