'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './users.module.css';
import { 
  UserPlus, 
  Search, 
  UserCheck, 
  UserMinus, 
  X,
  Trash2,
  Edit2,
  Key,
  RefreshCw,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAction } from '@/utils/logger';
import Loader from '@/components/Loader/Loader';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';

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
    password: '',
    role: 'viewer',
    client_id: '',
    avatar_style: 'avataaars'
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Estilos de Avatar (Usaremos DiceBear com micro-animações CSS e Lordicon para o modal)
  const avatarStyles = [
    { id: 'avataaars', label: 'Humano' },
    { id: 'bottts', label: 'Robô' },
    { id: 'adventurer', label: 'Herói' },
    { id: 'big-smile', label: 'Alegre' },
    { id: 'pixel-art', label: 'Pixel' }
  ];

  // Estados para o Modal de Confirmação Customizado
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirmar',
    onConfirm: () => {}
  });

  useEffect(() => {
    loadData();
    // Carregar script do Lordicon para avatares animados
    const script = document.createElement('script');
    script.src = "https://cdn.lordicon.com/lordicon.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.from('system_users').select('*, clients(name)').order('name');
    const { data: clientData } = await supabase.from('clients').select('id, name');
    
    if (userData) setUsers(userData);
    if (clientData) setClients(clientData);
    setLoading(false);
  }

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser({ ...newUser, password: pass });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditMode && editingUserId) {
      const { password, ...userData } = newUser;
      const dataToUpdate = {
        ...userData,
        client_id: newUser.client_id === '' ? null : newUser.client_id
      };

      const { error } = await supabase
        .from('system_users')
        .update(dataToUpdate)
        .eq('id', editingUserId);

      if (!error) {
        await logAction('Usuário Atualizado', 'user', editingUserId, { email: newUser.email, avatar: newUser.avatar_style });
        closeModal();
        loadData();
      } else {
        alert('Erro ao atualizar perfil: ' + error.message);
      }
    } else {
      try {
        setLoading(true);
        // 1. Criar o usuário no Supabase Auth (Sistema de Acesso)
        console.log('Provisionando acesso para:', newUser.email);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
            data: {
              display_name: newUser.name,
              role: newUser.role
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Falha ao gerar UID de autenticação');

        // 2. Criar o perfil na tabela system_users (Vinculado ao Auth)
        const { password, ...userDataWithoutPassword } = newUser;
        const userToInsert = {
          ...userDataWithoutPassword,
          id: authData.user.id, // Usa o mesmo ID do Auth
          client_id: newUser.client_id === '' ? null : newUser.client_id,
          status: 'active'
        };

        const { error: profileError } = await supabase
          .from('system_users')
          .insert([userToInsert]);

        if (profileError) throw profileError;

        await logAction('Usuário Provisionado', 'user', authData.user.id, { email: newUser.email });
        alert('Usuário criado com sucesso! Se a confirmação de e-mail estiver ativa no seu Supabase, o usuário precisará confirmar o e-mail antes do primeiro login.');
        closeModal();
        loadData();
      } catch (error: any) {
        console.error('Erro no provisionamento:', error);
        alert('Erro ao provisionar usuário: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditClick = (user: any) => {
    setNewUser({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      client_id: user.client_id || '',
      avatar_style: user.avatar_style || 'avataaars'
    });
    setEditingUserId(user.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingUserId(null);
    setNewUser({ name: '', email: '', password: '', role: 'viewer', client_id: '', avatar_style: 'avataaars' });
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

  const handleDeleteUser = async (user: any) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Usuário',
      message: `Deseja excluir permanentemente o acesso de ${user.name}? Esta ação não pode ser desfeita.`,
      type: 'danger',
      confirmLabel: 'Excluir Acesso',
      onConfirm: async () => {
        const { error } = await supabase
          .from('system_users')
          .delete()
          .eq('id', user.id);

        if (!error) {
          await logAction('Exclusão de Usuário', 'user', user.id, { name: user.name });
          loadData();
        } else {
          alert('Erro ao excluir usuário: ' + error.message);
        }
      }
    });
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
                  <th>Acesso</th>
                  <th>Status</th>
                  <th>Permissão</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const isOnline = user.last_active_at && (new Date().getTime() - new Date(user.last_active_at).getTime() < 300000);
                  const avatarUrl = `https://api.dicebear.com/7.x/${user.avatar_style || 'avataaars'}/svg?seed=${user.email}`;
                  
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.avatarContainer}>
                            <div className={styles.avatar}>
                              <img src={avatarUrl} alt={user.name} />
                            </div>
                            {isOnline && <div className={styles.onlineBadge} />}
                          </div>
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
                        <div className={styles.loginInfo}>
                          {user.last_login ? (
                            <>
                              <div className={styles.loginRow}>
                                <span>{new Date(user.last_login).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className={styles.loginTimeRow}>
                                <Clock size={12} />
                                <span>{new Date(user.last_login).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </>
                          ) : (
                            <span className={styles.never}>Nunca acessou</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={`${styles.onlineStatus} ${isOnline ? styles.online : styles.offline}`}>
                          <div className={styles.onlineDot} />
                          <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                      </td>
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
                          <button 
                            className={styles.actionIcon} 
                            onClick={() => handleEditClick(user)}
                            title="Editar Usuário"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            className={`${styles.actionIcon} ${styles.danger}`} 
                            onClick={() => handleDeleteUser(user)}
                            title="Excluir Usuário"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Novo Usuário */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modal} glass`}>
              <div className={styles.modalHeader}>
                <h3>{isEditMode ? 'Editar Perfil de Usuário' : 'Provisionar Novo Usuário'}</h3>
                <button onClick={closeModal}><X size={20} /></button>
              </div>
              <form className={styles.form} onSubmit={handleCreateUser}>
                <div className={styles.field}>
                  <label>Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: João Silva"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className={styles.field}>
                  <label>E-mail Corporativo</label>
                  <input 
                    required
                    type="email" 
                    placeholder="usuario@empresa.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>

                <div className={styles.field}>
                  <label>Identidade Visual (Avatar Animado)</label>
                  <div className={styles.avatarSelector}>
                    {avatarStyles.map(style => (
                      <div 
                        key={style.id}
                        className={`${styles.avatarOption} ${newUser.avatar_style === style.id ? styles.active : ''}`}
                        onClick={() => setNewUser({ ...newUser, avatar_style: style.id })}
                      >
                        <img 
                          src={`https://api.dicebear.com/7.x/${style.id}/svg?seed=${newUser.email || 'preview'}`} 
                          alt={style.id} 
                        />
                        <span>{style.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!isEditMode && (
                  <div className={styles.field}>
                    <label>Senha de Acesso</label>
                    <div className={styles.passwordInputWrapper}>
                      <Key size={16} className={styles.inputIcon} />
                      <input 
                        required
                        type="text" 
                        placeholder="Mínimo 8 caracteres"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      />
                      <button 
                        type="button" 
                        className={styles.generateBtn} 
                        onClick={generatePassword}
                        title="Gerar senha forte"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>
                )}
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
                  {isEditMode ? 'Salvar Alterações' : 'Confirmar Provisionamento'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmLabel={confirmConfig.confirmLabel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
}
