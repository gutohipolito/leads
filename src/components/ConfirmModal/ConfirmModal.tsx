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
  cancelLabel?: string | null;
  countdown?: number;
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
  countdown = 0,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const [timeLeft, setTimeLeft] = React.useState(countdown);

  React.useEffect(() => {
    if (isOpen) {
      setTimeLeft(countdown);
    }
  }, [isOpen, countdown]);

  React.useEffect(() => {
    if (isOpen && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, timeLeft]);

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
          {cancelLabel !== null && (
            <button className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button 
            className={`${styles.confirmBtn} ${styles[type]} ${timeLeft > 0 ? styles.disabled : ''}`} 
            onClick={() => {
              if (timeLeft > 0) return;
              onConfirm();
              onCancel();
            }}
            disabled={timeLeft > 0}
          >
            {timeLeft > 0 ? `${confirmLabel} (${timeLeft}s)` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
