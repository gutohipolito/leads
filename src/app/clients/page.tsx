'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './clients.module.css';
import { 
  Plus, 
  Search, 
  UserCog, 
  Power, 
  PowerOff, 
  RefreshCcw, 
  BarChart3, 
  MoreHorizontal,
  Mail,
  Calendar,
  Zap,
  Globe,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { mockClients, currentUser } from '@/lib/store';

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const filteredClients = mockClients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'desativar' : 'ativar';
    alert(`Conta ${id} será ${action}da.`);
  };

  const handleImpersonate = (name: string) => {
    alert(`Iniciando sessão como: ${name}\nRedirecionando para o dashboard do cliente...`);
  };

  const handleResetWebhook = (id: string) => {
    if (confirm('Deseja resetar TODOS os webhooks deste cliente? Esta ação é irreversível.')) {
      alert(`Webhooks do cliente ${id} foram resetados.`);
    }
  };

  return (
    <DashboardLayout title="Painel de Controle Administrativo">
      <div className={styles.container}>
        
        {/* Admin Stats Summary */}
        <div className={styles.adminStats}>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Total de Clientes</span>
            <h3 className={styles.miniValue}>{mockClients.length}</h3>
          </div>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Leads Gerados (Total)</span>
            <h3 className={styles.miniValue}>67.659</h3>
          </div>
          <div className={`${styles.miniStat} glass`}>
            <span className={styles.miniLabel}>Sistemas Online</span>
            <h3 className={styles.miniValue}>100%</h3>
          </div>
        </div>

        <div className={styles.topBar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <UserPlus size={18} />
            <span>Criar Nova Conta</span>
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th>Uso (Leads)</th>
                <th>Webhooks</th>
                <th>Ações de Controle</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className={styles.clientCell}>
                      <div className={styles.clientAvatar}>
                        <Globe size={18} />
                      </div>
                      <div className={styles.clientInfo}>
                        <span className={styles.clientName}>{client.name}</span>
                        <span className={styles.clientDate}>Desde {client.createdAt}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={`${styles.statusBadge} ${client.status === 'active' ? styles.active : styles.inactive}`}>
                      {client.status === 'active' ? 'Ativo' : 'Desativado'}
                    </div>
                  </td>
                  <td>
                    <div className={styles.usageCell}>
                      <span className={styles.usageValue}>{client.leadsCount}</span>
                      <div className={styles.usageBar}>
                        <div className={styles.usageProgress} style={{ width: `${Math.min((client.leadsCount / 200) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.webhookCount}>{client.webhooks.length} Terminais</span>
                  </td>
                  <td>
                    <div className={styles.actionGrid}>
                      <button 
                        className={styles.iconAction} 
                        title="Impersonar Cliente"
                        onClick={() => handleImpersonate(client.name)}
                      >
                        <UserCog size={18} />
                      </button>
                      <button 
                        className={`${styles.iconAction} ${client.status === 'active' ? styles.btnPowerOff : styles.btnPowerOn}`} 
                        title={client.status === 'active' ? 'Desativar Conta' : 'Ativar Conta'}
                        onClick={() => handleToggleStatus(client.id, client.status)}
                      >
                        {client.status === 'active' ? <Power size={18} /> : <PowerOff size={18} />}
                      </button>
                      <button 
                        className={styles.iconAction} 
                        title="Resetar Webhooks"
                        onClick={() => handleResetWebhook(client.id)}
                      >
                        <RefreshCcw size={18} />
                      </button>
                      <button className={styles.iconAction} title="Estatísticas">
                        <BarChart3 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de Nova Conta */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Novo Cliente Asthros</h3>
                <p>Configure a nova conta e gere os primeiros sinais de uplink.</p>
              </div>
              <form className={styles.form} onSubmit={(e) => { e.preventDefault(); alert('Conta criada!'); setIsModalOpen(false); }}>
                <div className={styles.inputGroup}>
                  <label>Nome da Empresa/Cliente</label>
                  <input type="text" placeholder="Ex: Suprema Odontologia" required />
                </div>
                <div className={styles.inputGroup}>
                  <label>E-mail Administrativo</label>
                  <input type="email" placeholder="admin@cliente.com" required />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn}>Provisionar Conta</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
