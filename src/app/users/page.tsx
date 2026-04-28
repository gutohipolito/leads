'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout/DashboardLayout';
import styles from './users.module.css';
import { 
  UserPlus, 
  Shield, 
  Mail, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { mockSystemUsers, SystemUser } from '@/lib/store';

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>(mockSystemUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
                      <button className={styles.actionBtn} title="Editar Permissões"><Edit2 size={16} /></button>
                      <button className={styles.actionBtn} title="Remover"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de Criação (Simulado) */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modal} glass`}>
              <div className={styles.modalHeader}>
                <h3>Novo Usuário</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                  A conta será criada e o convite enviado por e-mail.
                </p>
              </div>

              <form className={styles.form} onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
                <div className={styles.inputGroup}>
                  <label>Nome Completo</label>
                  <input type="text" placeholder="Ex: João Silva" required />
                </div>
                <div className={styles.inputGroup}>
                  <label>E-mail Corporativo</label>
                  <input type="email" placeholder="joao@asthros.com" required />
                </div>
                <div className={styles.inputGroup}>
                  <label>Nível de Acesso</label>
                  <select>
                    <option value="viewer">Visualizador (Apenas Leitura)</option>
                    <option value="manager">Gestor (Edição de Clientes)</option>
                    <option value="admin">Administrador (Acesso Total)</option>
                  </select>
                </div>
                
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className={styles.submitBtn}>Criar Conta</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
