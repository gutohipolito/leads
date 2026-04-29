'use client';

import { useState, useMemo } from 'react';
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
  Webhook
} from 'lucide-react';
import { mockClients, mockLeads, currentUser, Client, Webhook as WebhookType, Lead } from '@/lib/store';

export default function LeadsPage() {
  const isAdmin = currentUser.role === 'admin';
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  
  // Filtros
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const currentClient = useMemo(() => {
    if (!isAdmin) return mockClients.find(c => c.id === currentUser.clientId);
    return mockClients.find(c => c.id === selectedClientId);
  }, [selectedClientId, isAdmin]);

  // Lógica de visualização inicial
  const showClientSelection = isAdmin && !selectedClientId;
  const showWebhookSelection = currentClient && currentClient.webhooks.length > 1 && !selectedWebhookId;
  const showLeadsList = (currentClient && currentClient.webhooks.length === 1) || selectedWebhookId;

  const filteredLeads = useMemo(() => {
    let leads = mockLeads;
    
    // Filtrar por cliente
    if (currentClient) {
      leads = leads.filter(l => l.clientId === currentClient.id);
    }
    
    // Filtrar por webhook (se houver seleção específica)
    if (selectedWebhookId) {
      leads = leads.filter(l => l.webhookId === selectedWebhookId);
    } else if (currentClient && currentClient.webhooks.length === 1) {
      leads = leads.filter(l => l.webhookId === currentClient.webhooks[0].id);
    }

    // Filtros de texto
    if (filterName) {
      leads = leads.filter(l => l.name.toLowerCase().includes(filterName.toLowerCase()));
    }
    if (filterEmail) {
      leads = leads.filter(l => l.email.toLowerCase().includes(filterEmail.toLowerCase()));
    }

    return leads;
  }, [currentClient, selectedWebhookId, filterName, filterEmail]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  const resetSelection = () => {
    if (selectedWebhookId && currentClient && currentClient.webhooks.length > 1) {
      setSelectedWebhookId(null);
    } else {
      setSelectedClientId(null);
      setSelectedWebhookId(null);
    }
    setCurrentPage(1);
  };

  const handleExport = (format: string) => {
    alert(`Exportando ${filteredLeads.length} leads em formato ${format.toUpperCase()}...`);
    setExportOpen(false);
  };

  return (
    <DashboardLayout title="Gerenciamento de Leads">
      <div className={styles.container}>
        
        {/* VIEW: ADMIN CLIENT SELECTION */}
        {showClientSelection && (
          <div className={styles.selectionSection}>
            <div className={styles.listHeader}>
              <h3>Selecione um Cliente para Ver os Leads</h3>
            </div>
            <div className={styles.selectionGrid}>
              {mockClients.map(client => (
                <div key={client.id} className={`${styles.card} glass`} onClick={() => setSelectedClientId(client.id)}>
                  <div className={styles.cardTop}>
                    <div className={styles.iconBox}>
                      <Users size={24} />
                    </div>
                    <div className={styles.cardBadge}>Active Client</div>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{client.name}</h3>
                    <div className={styles.cardStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Capturas</span>
                        <span className={styles.statValue}>{client.leadsCount}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Webhooks</span>
                        <span className={styles.statValue}>{client.webhooks.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.enterLabel}>Ver Terminais</span>
                    <div className={styles.arrowCircle}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: WEBHOOK SELECTION (Multi-webhook clients) */}
        {showWebhookSelection && (
          <div className={styles.selectionSection}>
            <div className={styles.listHeader}>
              <button className={styles.backBtn} onClick={resetSelection}>
                <ArrowLeft size={18} />
                <span>Voltar para Clientes</span>
              </button>
              <h3>Selecione a Origem dos Leads ({currentClient?.name})</h3>
            </div>
            <div className={styles.selectionGrid}>
              {currentClient?.webhooks.map(webhook => (
                <div key={webhook.id} className={`${styles.card} glass`} onClick={() => setSelectedWebhookId(webhook.id)}>
                  <div className={styles.cardTop}>
                    <div className={styles.iconBox}>
                      <Webhook size={24} />
                    </div>
                    <div className={styles.cardBadge}>{webhook.status === 'active' ? '● Online' : '○ Offline'}</div>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{webhook.name}</h3>
                    <div className={styles.cardStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Protocolo</span>
                        <span className={styles.statValue}>HTTPS/JSON</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>ID do Uplink</span>
                        <span className={styles.statValue}>{webhook.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.enterLabel}>Acessar Leads</span>
                    <div className={styles.arrowCircle}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: LEADS LIST */}
        {showLeadsList && (
          <div className={styles.listSection}>
            <div className={styles.listHeader}>
              <button className={styles.backBtn} onClick={resetSelection}>
                <ArrowLeft size={18} />
                <span>Voltar</span>
              </button>
              
              <div className={styles.actions}>
                <div className={styles.exportDropdown}>
                  <button className={styles.primaryBtn} onClick={() => setExportOpen(!exportOpen)}>
                    <Download size={18} />
                    <span>Exportar Leads</span>
                  </button>
                  <div className={`${styles.dropdownMenu} ${exportOpen ? styles.open : ''}`}>
                    <button className={styles.dropdownItem} onClick={() => handleExport('csv')}>
                      <TableIcon size={16} /> <span>CSV (Excel)</span>
                    </button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('xlsx')}>
                      <FileText size={16} /> <span>Excel (XLSX)</span>
                    </button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('pdf')}>
                      <FileText size={16} /> <span>PDF Document</span>
                    </button>
                    <button className={styles.dropdownItem} onClick={() => handleExport('json')}>
                      <FileJson size={16} /> <span>JSON Raw</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.leadsTableWrapper}>
              <div className={styles.filtersBar}>
                <div className={styles.filterField}>
                  <label>Filtrar por Nome</label>
                  <input 
                    type="text" 
                    placeholder="Buscar nome..." 
                    className={styles.filterInput} 
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                  />
                </div>
                <div className={styles.filterField}>
                  <label>Filtrar por E-mail</label>
                  <input 
                    type="text" 
                    placeholder="Buscar e-mail..." 
                    className={styles.filterInput} 
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                  />
                </div>
                <div className={styles.filterField}>
                  <label>Status</label>
                  <select className={styles.filterInput}>
                    <option>Todos</option>
                    <option>Recebido</option>
                    <option>Processado</option>
                  </select>
                </div>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Informações de Contato</th>
                    <th>Dados Adicionais</th>
                    <th>Data de Captura</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.length > 0 ? paginatedLeads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div className={styles.leadMain}>
                          <div className={styles.avatar}>{lead.name.charAt(0)}</div>
                          <div className={styles.leadName}>
                            <span className={styles.name}>{lead.name}</span>
                            <span className={styles.id}>ID: {lead.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.leadInfoMini}>
                          <span>{lead.email}</span>
                          <span className={styles.leadEmail}>{lead.phone}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.dataTags}>
                          {Object.entries(lead.data).map(([key, val]) => (
                            <div key={key} className={styles.tag}>
                              <span className={styles.key}>{key}:</span>
                              <span>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        <br />
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                          {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <button className={styles.secondaryBtn} style={{ padding: '0.4rem' }}>
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className={styles.emptyState}>
                        <Database size={48} strokeWidth={1} />
                        <p>Nenhum lead encontrado com estes filtros.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {filteredLeads.length > 0 && (
                <div className={styles.pagination}>
                  <div className={styles.pageInfo}>
                    Mostrando <b>{(currentPage - 1) * pageSize + 1}</b> a <b>{Math.min(currentPage * pageSize, filteredLeads.length)}</b> de <b>{filteredLeads.length}</b> leads
                  </div>
                  <div className={styles.pageControls}>
                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button 
                        key={i} 
                        className={`${styles.pageBtn} ${currentPage === i + 1 ? styles.active : ''}`}
                        onClick={() => setCurrentPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
