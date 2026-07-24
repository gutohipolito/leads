'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare, Phone, Mail, Sparkles, X, UserCheck, Clock, ArrowRight } from 'lucide-react';
import styles from './FunnyLeadModal.module.css';
import { playBoostedAudio } from '@/utils/audio';

interface LeadModalProps {
  lead: any;
  client: any;
  onClose: () => void;
}

function hexToRgb(hex: string) {
  if (!hex) return '168, 85, 247';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '168, 85, 247';
}

export default function FunnyLeadModal({ lead, client, onClose }: LeadModalProps) {
  const onCloseRef = React.useRef(onClose);
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [particles, setParticles] = useState<Array<{ id: number; left: number; symbol: string; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    // Tocar o efeito sonoro anime-wow do lead com volume amplificado
    playBoostedAudio('/anime-wow-sound-effect-mp3cut.mp3', 3.5);

    // Gerar partículas elegantes de brilho de fundo
    const sparkSymbols = ['✨', '✦', '⚡', '💫', '🌟'];
    const tempParticles = [];
    for (let i = 0; i < 20; i++) {
      const randomSymbol = sparkSymbols[Math.floor(Math.random() * sparkSymbols.length)];
      tempParticles.push({
        id: i,
        left: Math.random() * 100,
        symbol: randomSymbol,
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 3,
        size: 0.9 + Math.random() * 1.2
      });
    }
    setParticles(tempParticles);

    // Fechar automaticamente após 6 segundos
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 6000);

    return () => {
      clearTimeout(timer);
    };
  }, [lead]);

  if (!lead) return null;

  // Extrai informações do lead
  const getPhone = () => {
    return lead.phone || lead.data?.phone || lead.data?.fields?.phone || lead.data?.behavior?.whatsapp || null;
  };

  const getEmail = () => {
    return lead.email || lead.data?.email || lead.data?.fields?.email || null;
  };

  // Formata o link do WhatsApp se houver telefone
  const getWhatsAppLink = () => {
    const phone = getPhone();
    if (!phone) return null;
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone) return null;
    const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(`Olá ${lead.name || ''}, vi seu interesse! Como posso te ajudar?`);
    return `https://wa.me/${finalPhone}?text=${msg}`;
  };

  const getSourceLabel = () => {
    const src = lead.source;
    if (src === 'whatsapp_tracker') return 'WhatsApp Tracker';
    if (src === 'custom_tracker') {
      const matchType = lead.data?.behavior?.match_type || lead.data?.match_type || lead.name;
      if (String(matchType).toLowerCase().includes('selector')) return 'Seletor Personalizado';
      if (String(matchType).toLowerCase().includes('keyword')) return 'Palavra-Chave';
      return 'Clique no Botão';
    }
    return 'Formulário / Integração';
  };

  const phone = getPhone();
  const email = getEmail();
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
      window.location.href = `/leads?search=${encodeURIComponent(lead.name || '')}`;
    }
    onClose();
  };

  return (
    <div className={styles.overlay}>
      {/* Efeito de partículas/brilhos suaves no fundo */}
      {particles.map(p => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}rem`,
            top: '-40px'
          }}
        >
          {p.symbol}
        </span>
      ))}

      <div className={styles.modalContainer} style={containerStyle}>
        {/* Botão fechar no topo */}
        <button className={styles.closeIconButton} onClick={onClose} title="Fechar">
          <X size={18} />
        </button>

        {/* Badges e Título Superior */}
        <div className={styles.headerSection}>
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            <span>NOVO LEAD DETECTADO</span>
          </div>
          <h2 className={styles.title}>Captura em Tempo Real</h2>
        </div>

        {/* Detalhes do Lead (Clean & Profissional) */}
        <div className={styles.leadCardBody}>
          <div className={styles.leadAvatarRow}>
            <div className={styles.leadAvatarIcon}>
              <UserCheck size={24} />
            </div>
            <div className={styles.leadTitleGroup}>
              <h3 className={styles.leadName}>{lead.name || 'Lead sem Nome'}</h3>
              {client?.name && (
                <span className={styles.clientMetaText}>
                  Parceiro: <strong>{client.name}</strong>
                </span>
              )}
            </div>
          </div>

          <div className={styles.detailsGrid}>
            {phone && (
              <div className={styles.detailRow}>
                <Phone size={15} className={styles.detailIcon} />
                <span className={styles.detailValue}>{phone}</span>
              </div>
            )}
            {email && (
              <div className={styles.detailRow}>
                <Mail size={15} className={styles.detailIcon} />
                <span className={styles.detailValue}>{email}</span>
              </div>
            )}
          </div>

          <div className={styles.leadFooterMeta}>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceDot} />
              <span>{getSourceLabel()}</span>
            </div>
            <div className={styles.timeTag}>
              <Clock size={13} />
              <span>Agora mesmo</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleAction}>
            {waLink ? (
              <>
                <MessageSquare size={18} />
                <span>Chamar no WhatsApp</span>
              </>
            ) : (
              <>
                <ExternalLink size={18} />
                <span>Ver Detalhes do Lead</span>
              </>
            )}
          </button>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
