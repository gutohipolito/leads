'use client';

import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import styles from './DeleteModal.module.css';

interface DeleteModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({ title, message, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={`${styles.modal} glass`} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onCancel}>
          <X size={20} />
        </button>
        
        <div className={styles.iconWrapper}>
          <div className={styles.pulseRing} />
          <Trash2 size={40} className={styles.trashIcon} />
        </div>
        
        <div className={styles.header}>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className={styles.warningBox}>
          <AlertTriangle size={18} />
          <span>Esta ação é irreversível e os dados serão removidos permanentemente.</span>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            Sim, Excluir Lead
          </button>
        </div>
      </div>
    </div>
  );
}
