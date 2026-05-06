'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './users.module.css';
import { 
  UserPlus, 
  Search, 
  Shield, 
  Mail, 
  UserCheck, 
  UserMinus, 
  MoreHorizontal,
  ChevronRight,
  Filter,
  X,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'viewer',
    client_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.from('system_users').select('*, clients(name)');
    const { data: clientData } = await supabase.from('clients').select('id, name');
    
    if (userData) setUsers(userData);
    if (clientData) setClients(clientData);
    setLoading(false);
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('system_users')
      .insert([newUser])
      .select()
      .single();

    if (!error) {
      await logAction('Usuário Provisionado', 'user', data.id, { email: newUser.email });
      setIsModalOpen(false);
      setNewUser({ name: '', email: '', role: 'viewer', client_id: '' });
      loadData();
    } else {
      alert('Erro ao criar usuário: ' + error.message);
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('system_users')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (!error) {
      await logAction('Status de Usuário Alterado', 'user', id, { status: newStatus });
      loadData();
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Gestão de Usuários e Permissões">
      <div className={styles.container}>
        
        <div className={styles.topActions}>
          <div className={styles.searchBox}>
            <Search size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou e-mail..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <UserPlus size={20} />
            <span>Novo Usuário</span>
          </button>
        </div>

        {loading ? (
          <Loader text="Sincronizando Usuários" />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Cargo</th>
                  <th>Vínculo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userInfo}>
                        <div className={styles.avatar}>{user.name.charAt(0)}</div>
                        <div>
                          <p className={styles.name}>{user.name}</p>
                          <p className={styles.email}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.roleTag} ${styles[user.role]}`}>
                        {user.role === 'admin' ? 'Administrador' : user.role === 'manager' ? 'Gerente' : 'Visualizador'}
                      </span>
                    </td>
                    <td>{user.clients?.name || 'Nenhum (Global)'}</td>
                    <td>
                      <div className={`${styles.statusDot} ${styles[user.status]}`}>
                        <div className={styles.dot} />
                        <span>{user.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button 
                          className={styles.actionIcon} 
                          onClick={() => toggleUserStatus(user.id, user.status)}
                          title={user.status === 'active' ? 'Suspender' : 'Ativar'}
                        >
                          {user.status === 'active' ? <UserMinus size={18} /> : <UserCheck size={18} />}
                        </button>
                        <button className={styles.actionIcon}><MoreHorizontal size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Novo Usuário */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modal} glass`}>
              <div className={styles.modalHeader}>
                <h3>Provisionar Novo Usuário</h3>
                <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
              </div>
              <form className={styles.form} onSubmit={handleCreateUser}>
                <div className={styles.field}>
                  <label>Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className={styles.field}>
                  <label>E-mail Corporativo</label>
                  <input 
                    required
                    type="email" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className={styles.gridFields}>
                  <div className={styles.field}>
                    <label>Cargo / Permissão</label>
                    <select 
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    >
                      <option value="viewer">Visualizador</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Cliente Vinculado</label>
                    <select 
                      value={newUser.client_id}
                      onChange={(e) => setNewUser({...newUser, client_id: e.target.value})}
                    >
                      <option value="">Nenhum (Acesso Global)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className={styles.submitBtn}>
                  Confirmar Provisionamento
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
