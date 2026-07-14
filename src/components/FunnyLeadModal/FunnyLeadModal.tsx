'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare, AlertCircle, Sparkles, Check, Zap } from 'lucide-react';
import styles from './FunnyLeadModal.module.css';

interface FunnyLeadModalProps {
  lead: any;
  client: any;
  onClose: () => void;
}

interface ThemeConfig {
  name: string;
  badge: string;
  emoji: string;
  title: string;
  messages: string[];
  emojis: string[];
  soundUrl: string;
}

const THEMES: Record<string, ThemeConfig> = {
  pix: {
    name: 'pix',
    badge: '',
    emoji: '🤑',
    title: '',
    messages: [
      'Entrou um lead fresquinho! Corre para garantir essa comissão!',
      'Alerta de Pix em potencial! Não deixa esse cliente esfriar!',
      'Dinheiro na mesa! O comercial que lute, mas esse lead é ouro!'
    ],
    emojis: ['💸', '💰', '🤑', '💎', '📈', '✨'],
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' // Cash register
  },
  fbi: {
    name: 'fbi',
    badge: 'ALERTA MÁXIMO 🚨',
    emoji: '🚨',
    title: 'HUMANO DETECTADO NA ÁREA!',
    messages: [
      'Isso NÃO é um treinamento! Um lead real acabou de morder a isca!',
      'Mãos no teclado! O espécime está pronto para ser abordado!',
      'Detectamos atividade humana de altíssimo interesse comercial!'
    ],
    emojis: ['🚨', '🕵️‍♂️', '🛸', '🛰️', '📡', '⚠️'],
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3' // Sci-Fi Alarm
  },
  panic: {
    name: 'panic',
    badge: 'Desespero Comercial 🏃‍♂️',
    emoji: '🏃‍♂️',
    title: 'CORRE QUE O LEAD TÁ FUGINDO!',
    messages: [
      'Rápido, mande mensagem antes que ele desista e vá ver TikTok!',
      'Atenção operador, o lead está esfriando a cada segundo! AGILIZA!',
      'Não durma no ponto! Tem um cliente querendo atenção agora mesmo!'
    ],
    emojis: ['🏃‍♂️', '🔥', '⏰', '⚡', '💣', '🐱'],
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3' // Boing/Slip
  }
};

function hexToRgb(hex: string) {
  if (!hex) return '168, 85, 247';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '168, 85, 247';
}

export default function FunnyLeadModal({ lead, client, onClose }: FunnyLeadModalProps) {
  const [theme, setTheme] = useState<ThemeConfig>(THEMES.pix);
  const [message, setMessage] = useState('');
  const [particles, setParticles] = useState<Array<{ id: number; left: number; emoji: string; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    // Escolhe um tema aleatório ao abrir
    const themeKeys = Object.keys(THEMES);
    const randomKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    const chosenTheme = THEMES[randomKey];
    setTheme(chosenTheme);

    // Escolhe uma mensagem aleatória
    const randomMsg = chosenTheme.messages[Math.floor(Math.random() * chosenTheme.messages.length)];
    setMessage(randomMsg);

    // Tocar o efeito sonoro do tema correspondente
    const isSoundEnabled = localStorage.getItem('asthros-sound-enabled') !== 'false';
    if (isSoundEnabled) {
      const audio = new Audio(chosenTheme.soundUrl);
      audio.play().catch(() => {});
    }

    // Gerar confete de emojis
    const tempParticles = [];
    for (let i = 0; i < 25; i++) {
      const randomEmoji = chosenTheme.emojis[Math.floor(Math.random() * chosenTheme.emojis.length)];
      tempParticles.push({
        id: i,
        left: Math.random() * 100, // porcentagem da largura da tela
        emoji: randomEmoji,
        delay: Math.random() * 2, // segundos de delay
        duration: 3 + Math.random() * 3, // segundos de queda
        size: 1.2 + Math.random() * 1.5 // tamanho do emoji em rem
      });
    }
    setParticles(tempParticles);

    // Fechar automaticamente após 5 segundos
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [lead, onClose]);

  if (!lead) return null;

  // Formata o link do WhatsApp se houver telefone
  const getWhatsAppLink = () => {
    const phone = lead.phone || lead.data?.phone || lead.data?.fields?.phone || lead.data?.behavior?.whatsapp;
    if (!phone) return null;
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone) return null;
    const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(`Olá ${lead.name || ''}, como posso te ajudar?`);
    return `https://wa.me/${finalPhone}?text=${msg}`;
  };

  const getSourceLabel = () => {
    const src = lead.source;
    if (src === 'whatsapp_tracker') return 'WhatsApp Tracker';
    if (src === 'custom_tracker') {
      const matchType = lead.data?.behavior?.match_type || lead.data?.match_type || lead.name;
      if (String(matchType).toLowerCase().includes('selector')) return 'Seletor Personalizado';
      if (String(matchType).toLowerCase().includes('keyword')) return 'Palavra-Chave';
      return 'Botão de Clique';
    }
    return 'Formulário / Integração';
  };

  const waLink = getWhatsAppLink();
  const clientColor = client?.primary_color || '#a855f7';
  const clientColorRgb = hexToRgb(clientColor);

  const containerStyle = {
    '--client-color': clientColor,
    '--client-color-rgb': clientColorRgb
  } as React.CSSProperties;

  const handleAction = () => {
    if (waLink) {
      window.open(waLink, '_blank');
    } else {
      // Redireciona para a página de leads
      window.location.href = `/leads?search=${encodeURIComponent(lead.name || '')}`;
    }
    onClose();
  };

  const getOverlayClass = () => {
    if (theme.name === 'fbi') return styles.overlayFbi;
    return styles.overlay;
  };

  const getContainerClass = () => {
    if (theme.name === 'panic') return styles.modalContainerShake;
    return styles.modalContainer;
  };

  return (
    <div className={getOverlayClass()}>
      {/* Raining particles */}
      {particles.map(p => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}rem`,
            top: '-50px'
          }}
        >
          {p.emoji}
        </span>
      ))}

      <div className={getContainerClass()} style={containerStyle}>
        <div className={styles.themeHeader}>
          {theme.badge && (
            <div className={styles.themeBadge}>
              {theme.name === 'pix' && <Sparkles size={14} />}
              {theme.name === 'fbi' && <Zap size={14} />}
              {theme.name === 'panic' && <AlertCircle size={14} />}
              {theme.badge}
            </div>
          )}
          <span className={theme.name === 'fbi' ? styles.fbiEmoji : styles.mainEmoji}>
            {theme.emoji}
          </span>
          {theme.title && <h2 className={styles.title}>{theme.title}</h2>}
        </div>

        {/* Informações do Cliente parceiro */}
        <div className={styles.clientContainer}>
          {client?.logo_url ? (
            <img src={client.logo_url} alt={client.name} className={styles.clientLogo} />
          ) : (
            <div className={styles.clientLogoPlaceholder}>
              {client?.name ? client.name.substring(0, 2).toUpperCase() : 'PT'}
            </div>
          )}
          <div className={styles.clientMeta}>
            <span className={styles.clientLabel}>Parceiro</span>
            <span className={styles.clientName}>{client?.name || 'Cliente Geral'}</span>
          </div>
        </div>

        {/* Detalhes do Lead */}
        <div className={styles.leadDetails}>
          <h3 className={styles.leadName}>{lead.name || 'Sem Nome'}</h3>
          <div className={styles.leadSource}>
            <span className={styles.sourceDot} />
            {getSourceLabel()}
          </div>
          <p className={styles.funnyMessage}>"{message}"</p>
        </div>

        {/* Ações */}
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleAction}>
            {waLink ? (
              <>
                <MessageSquare size={18} />
                <span>Chamar no WhatsApp!</span>
              </>
            ) : (
              <>
                <ExternalLink size={18} />
                <span>Ver Detalhes do Lead</span>
              </>
            )}
          </button>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Dispensar (Vou deixar ele fugir...)
          </button>
        </div>
      </div>
    </div>
  );
}
