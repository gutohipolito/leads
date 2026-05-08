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
  const [isWarning, setIsWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWarning && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isWarning && countdown === 0) {
      onConfirm(null);
    }
    return () => clearInterval(timer);
  }, [isWarning, countdown, onConfirm]);

  const handleConfirm = () => {
    if (usePassword) {
      setIsSuccess(true);
      setTimeout(() => {
        onConfirm(password);
      }, 1500);
    } else {
      setIsWarning(true);
    }
  };

  const stopExport = () => {
    setIsWarning(false);
    setCountdown(10);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setUsePassword(true);
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
            <p>Seu arquivo está sendo gerado com criptografia e o download começará em instantes.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} glass`} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className={styles.successIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <Shield size={60} />
          </div>
          <div className={styles.header}>
            <h3 style={{ color: '#ef4444' }}>Aviso de Segurança</h3>
            <p style={{ fontSize: '0.9rem' }}>
              Você optou por exportar dados <strong>sem proteção por senha</strong>. Ao prosseguir, você assume a responsabilidade total pela integridade e confidencialidade destas informações sensíveis em conformidade com as normas de proteção de dados.
            </p>
            <div style={{ 
              marginTop: '1.5rem', 
              fontSize: '1.2rem', 
              fontWeight: 'bold', 
              color: 'white',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '1rem',
              borderRadius: '12px'
            }}>
              Gerando arquivo em: {countdown}s
            </div>
          </div>
          <div className={styles.footer}>
            <button className={styles.confirmBtn} style={{ background: '#ef4444', color: 'white' }} onClick={stopExport}>
              Interromper Download
            </button>
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
