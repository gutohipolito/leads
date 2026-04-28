import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './users.module.css';
import { 
  UserPlus, 
  Shield, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  X
} from 'lucide-react';
import { mockSystemUsers, SystemUser } from '@/lib/store';

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>(mockSystemUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'viewer' as SystemUser['role'],
    status: 'active' as SystemUser['status']
  });

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setEditingUser(null);
    setUserToDelete(null);
    setFormData({ name: '', email: '', role: 'viewer', status: 'active' });
  };

  const handleEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setIsModalOpen(true);
  };

  const confirmDelete = (user: SystemUser) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (userToDelete) {
      setUsers(users.filter(u => u.id !== userToDelete.id));
      closeModal();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
    } else {
      const newUser: SystemUser = {
        id: Math.random().toString(36).substring(7),
        ...formData,
        lastLogin: 'Nunca'
      };
      setUsers([...users, newUser]);
    }
    closeModal();
  };

  return (
    <DashboardLayout title="Gestão de Usuários">
      <div className={styles.container}>
        
        <div className={styles.topBar}>
          <div className={styles.headerInfo}>
            <p>Gerencie acessos e permissões da equipe administrativa.</p>
          </div>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <UserPlus size={18} />
            <span>Novo Usuário</span>
          </button>
        </div>

        <div className={`${styles.usersTableWrapper} glass`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Cargo / Acesso</th>
                <th>Status</th>
                <th>Último Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>
                        {user.name.charAt(0)}
                      </div>
                      <div className={styles.userInfo}>
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                      <Shield size={12} />
                      {user.role === 'admin' ? 'Administrador' : user.role === 'manager' ? 'Gestor' : 'Visualizador'}
                    </span>
                  </td>
                  <td>
                    <div className={`${styles.statusBadge} ${styles[user.status]}`}>
                      <div className={styles.statusDot} />
                      {user.status === 'active' ? 'Ativo' : 'Inativo'}
                    </div>
                  </td>
                  <td>
                    <span className={styles.lastLogin}>{user.lastLogin}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleEdit(user)} title="Editar Permissões"><Edit2 size={16} /></button>
                      <button className={styles.actionBtn} onClick={() => confirmDelete(user)} title="Remover"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de Cadastro/Edição */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                  {editingUser ? 'Atualize as permissões e dados do colaborador.' : 'A conta será criada e o acesso liberado imediatamente.'}
                </p>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.inputGroup}>
                  <label>Nome Completo</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: João Silva" 
                    required 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>E-mail Corporativo</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="joao@asthros.com" 
                    required 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Nível de Acesso</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                    <option value="viewer">Visualizador (Apenas Leitura)</option>
                    <option value="manager">Gestor (Edição de Clientes)</option>
                    <option value="admin">Administrador (Acesso Total)</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Status da Conta</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn}>{editingUser ? 'Salvar Alterações' : 'Criar Conta'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {isDeleteModalOpen && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={`${styles.modal} glass`} style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div className={styles.dangerIcon}>
                <AlertTriangle size={32} />
              </div>
              <div className={styles.modalHeader}>
                <h3>Excluir Usuário?</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                  Esta ação é irreversível. O usuário <strong>{userToDelete?.name}</strong> perderá acesso imediato ao sistema.
                </p>
              </div>

              <div className={styles.modalActions} style={{ justifyContent: 'center', marginTop: '1rem' }}>
                <button className={styles.cancelBtn} onClick={closeModal}>Cancelar</button>
                <button className={styles.deleteBtn} onClick={handleDelete}>Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

