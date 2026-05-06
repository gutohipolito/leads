'use client';

import React from 'react';
import styles from './Loader.module.css';

interface LoaderProps {
  text?: string;
}

export default function Loader({ text = 'CARREGANDO DADOS' }: LoaderProps) {
  return (
    <div className={styles.modernLoader}>
      <div className={styles.chargingBar}>
        <div className={styles.chargingProgress} />
      </div>
      <p className={styles.loadingText}>{text.toUpperCase()}</p>
    </div>
  );
}
