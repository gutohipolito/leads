'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Key, RefreshCw, CheckCircle2, List } from 'lucide-react';
import styles from './ExportModal.module.css';

interface ExportModalProps {
  onConfirm: (password: string | null, selectedFields: string[]) => void;
  onCancel: () => void;
  format: string;
}

const AVAILABLE_FIELDS = [
  { id: 'name', label: 'Nome', category: 'Dados Pessoais', defaultChecked: true },
  { id: 'email', label: 'E-mail', category: 'Dados Pessoais', defaultChecked: true },
  { id: 'phone', label: 'Telefone', category: 'Dados Pessoais', defaultChecked: true },
  { id: 'created_at', label: 'Data e Hora', category: 'Sistema', defaultChecked: true },
  { id: 'webhook', label: 'Terminal / Webhook', category: 'Sistema', defaultChecked: true },
  { id: 'id', label: 'ID do Lead', category: 'Sistema', defaultChecked: false },
  { id: 'page_url', label: 'Página de Origem', category: 'Comportamento', defaultChecked: true },
  { id: 'button_text', label: 'Botão Clicado', category: 'Comportamento', defaultChecked: true },
  { id: 'time_on_page', label: 'Tempo na Página', category: 'Comportamento', defaultChecked: false },
  { id: 'utm', label: 'Parâmetros UTM (Tráfego)', category: 'Campanha', defaultChecked: true },
  { id: 'location', label: 'Localização (Cidade/Estado)', category: 'Geografia', defaultChecked: true },
  { id: 'custom_fields', label: 'Campos Extras', category: 'Formulários', defaultChecked: true }
];

export default function ExportModal({ onConfirm, onCancel, format }: ExportModalProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  
  const [selectedFields, setSelectedFields] = useState<string[]>(
    AVAILABLE_FIELDS.filter(f => f.defaultChecked).map(f => f.id)
  );

  const handleToggleField = (id: string) => {
    setSelectedFields(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWarning && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isWarning && countdown === 0) {
      onConfirm(null, selectedFields);
    }
    return () => clearInterval(timer);
  }, [isWarning, countdown, onConfirm, selectedFields]);

  const handleConfirm = () => {
    if (usePassword) {
      setIsSuccess(true);
      setTimeout(() => {
        onConfirm(password, selectedFields);
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
          <p>Selecione os dados do relatório e as diretrizes de criptografia {format.toUpperCase()}.</p>
        </div>

        {/* Seção de Seleção de Campos */}
        <div className={styles.fieldsSection}>
          <div className={styles.fieldsHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <List size={16} color="var(--primary)" />
              <h4>Campos para Exportação</h4>
            </div>
            <div className={styles.fieldsActions}>
              <button type="button" onClick={() => setSelectedFields(AVAILABLE_FIELDS.map(f => f.id))}>Todos</button>
              <span>|</span>
              <button type="button" onClick={() => setSelectedFields([])}>Limpar</button>
            </div>
          </div>
          <div className={styles.fieldsGrid}>
            {AVAILABLE_FIELDS.map((field) => (
              <label key={field.id} className={styles.fieldCheckboxLabel}>
                <input 
                  type="checkbox"
                  checked={selectedFields.includes(field.id)}
                  onChange={() => handleToggleField(field.id)}
                />
                <span className={styles.checkboxCustom} />
                <div className={styles.fieldInfo}>
                  <span className={styles.fieldName}>{field.label}</span>
                  <span className={styles.fieldCat}>{field.category}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Opções de Criptografia */}
        <div 
          className={`${styles.optionCard} ${!usePassword ? styles.selected : ''}`}
          onClick={() => setUsePassword(false)}
        >
          <div className={styles.optionIcon}>
            <Unlock size={20} color={!usePassword ? 'var(--primary)' : '#666'} />
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
            <Lock size={20} color={usePassword ? 'var(--primary)' : '#666'} />
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
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.5rem', textAlign: 'left' }}>
              <Key size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> 
              Guarde esta senha para abrir o arquivo.
            </p>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button 
            className={styles.confirmBtn} 
            onClick={handleConfirm}
            disabled={(usePassword && !password) || selectedFields.length === 0}
          >
            Gerar Arquivo
          </button>
        </div>
      </div>
    </div>
  );
}
