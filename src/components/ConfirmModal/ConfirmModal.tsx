'use client';

import React from 'react';
import styles from './ConfirmModal.module.css';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'warning': return <AlertTriangle size={32} className={styles.warningIcon} />;
      case 'danger': return <AlertTriangle size={32} className={styles.dangerIcon} />;
      case 'success': return <CheckCircle2 size={32} className={styles.successIcon} />;
      default: return <Info size={32} className={styles.infoIcon} />;
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onCancel}>
          <X size={20} />
        </button>
        
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            {getIcon()}
          </div>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button 
            className={`${styles.confirmBtn} ${styles[type]}`} 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
