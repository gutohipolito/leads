'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Key, RefreshCw, CheckCircle2, X } from 'lucide-react';
import styles from './ExportModal.module.css';

interface ExportModalProps {
  onConfirm: (password: string | null) => void;
  onCancel: () => void;
  format: string;
}

export default function ExportModal({ onConfirm, onCancel, format }: ExportModalProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setUsePassword(true);
  };

  const handleConfirm = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onConfirm(usePassword ? password : null);
    }, 1500);
  };

  if (isSuccess) {
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} glass`}>
          <div className={styles.successIcon}>
            <CheckCircle2 size={60} />
          </div>
          <div className={styles.header}>
            <h3>Proteção Aplicada!</h3>
            <p>Seu arquivo está sendo gerado com segurança e o download começará em instantes.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} glass`}>
        <div className={styles.iconWrapper}>
          <Shield size={40} />
        </div>
        
        <div className={styles.header}>
          <h3>Exportar com Segurança</h3>
          <p>Deseja adicionar uma senha de proteção ao seu arquivo {format.toUpperCase()}?</p>
        </div>

        <div 
          className={`${styles.optionCard} ${!usePassword ? styles.selected : ''}`}
          onClick={() => setUsePassword(false)}
        >
          <div className={styles.optionIcon}>
            <Unlock size={24} color={!usePassword ? 'var(--primary)' : '#666'} />
          </div>
          <div className={styles.optionInfo}>
            <h4>Sem Senha</h4>
            <span>Exportação rápida sem criptografia.</span>
          </div>
        </div>

        <div 
          className={`${styles.optionCard} ${usePassword ? styles.selected : ''}`}
          onClick={() => setUsePassword(true)}
        >
          <div className={styles.optionIcon}>
            <Lock size={24} color={usePassword ? 'var(--primary)' : '#666'} />
          </div>
          <div className={styles.optionInfo}>
            <h4>Com Senha</h4>
            <span>Proteja seus dados com uma senha personalizada.</span>
          </div>
        </div>

        {usePassword && (
          <div className={styles.passwordArea}>
            <div className={styles.inputGroup}>
              <input 
                type="text" 
                placeholder="Insira a senha desejada..." 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button className={styles.genBtn} onClick={generatePassword} title="Gerar Senha Forte">
                <RefreshCw size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
              <Key size={12} style={{ marginRight: '4px' }} /> 
              Guarde esta senha para abrir o arquivo.
            </p>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button 
            className={styles.confirmBtn} 
            onClick={handleConfirm}
            disabled={usePassword && !password}
          >
            Gerar Arquivo
          </button>
        </div>
      </div>
    </div>
  );
}
