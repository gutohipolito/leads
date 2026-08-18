import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logAction } from '@/utils/logger';
import { decodeHtml } from '@/utils/decode';
import { isPaidMedia, formatPhone, getSanitizedLeads } from './leadsHelpers';

export const exportSingleLeadPDF = async (leadToExport: any, currentClient: any) => {
  if (!leadToExport) return;

  const clientName = currentClient?.name || leadToExport.clients?.name || 'asthros';
  const formattedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const formattedLeadName = (leadToExport.name || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const webhookName = leadToExport.webhooks?.name || leadToExport.data?.captured_by?.name || 'N/A';

  const doc = new jsPDF({
    orientation: 'portrait'
  });

  // 1. Cabeçalho Escuro Padrão (Altura de 40mm)
  doc.setFillColor(10, 20, 35);
  doc.rect(0, 0, 210, 40, 'F');

  try {
    const logoUrl = '/asthros-leads.png';
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = logoUrl;
    });
    const logoWidth = 40;
    const logoHeight = (img.height * logoWidth) / img.width;
    const logoY = (40 - logoHeight) / 2;
    doc.addImage(img, 'PNG', 15, logoY, logoWidth, logoHeight);
  } catch (err) {
    doc.setTextColor(86, 215, 253);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ASTHROS', 15, 25);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Lead Único', 195, 16, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName}`, 195, 22, { align: 'right' });
  doc.text(`Terminal: ${webhookName}`, 195, 28, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 195, 34, { align: 'right' });

  // Subtítulo do relatório
  doc.setTextColor(10, 20, 35);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Detalhes do Lead', 15, 52);

  // Separador principal
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, 55, 195, 55);

  let currentY = 62;
  const isPaid = isPaidMedia(leadToExport);

  // Função de Desenhar Cards Estruturados (2 colunas)
  const drawCard = (title: string, items: { label: string, value: string, highlight?: boolean, isFallback?: boolean }[], borderGold: boolean = false) => {
    if (items.length === 0) return;

    const half = Math.ceil(items.length / 2);
    const cardHeight = 15 + (half * 8) + 5;

    // Quebra de página se passar de Y = 275
    if (currentY + cardHeight > 275) {
      doc.addPage();
      currentY = 20;
    }

    // Fundo e Borda do Card
    if (borderGold) {
      doc.setDrawColor(245, 158, 11); // Gold
      doc.setFillColor(254, 252, 232); // Fundo dourado sutil
    } else {
      doc.setDrawColor(226, 232, 240); // Borda neutra
      doc.setFillColor(248, 250, 252); // Fundo neutro sutil
    }
    doc.rect(15, currentY, 180, cardHeight - 5, 'FD');

    // Título da Seção
    if (borderGold) {
      doc.setTextColor(217, 119, 6);
    } else {
      doc.setTextColor(14, 165, 233);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);

    let titleText = title.toUpperCase();
    if (borderGold) titleText += "  [ MÍDIA PAGA ]";
    doc.text(titleText, 20, currentY + 8);

    // Separador interno
    if (borderGold) {
      doc.setDrawColor(253, 230, 138);
    } else {
      doc.setDrawColor(230, 235, 240);
    }
    doc.line(20, currentY + 11, 190, currentY + 11);

    // Renderização dos campos em 2 colunas
    doc.setFontSize(8.5);
    let itemY = currentY + 16;

    for (let i = 0; i < half; i++) {
      // Coluna 1
      const item1 = items[i];
      if (item1) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139); // Label cor cinza médio
        doc.text(`${item1.label}:`, 20, itemY);

        doc.setFont('helvetica', item1.highlight ? 'bold' : 'normal');
        if (item1.isFallback) {
          doc.setTextColor(160, 174, 192); // Fallback cor cinza apagado
        } else if (item1.highlight && borderGold) {
          doc.setTextColor(217, 119, 6); // Destaque gold
        } else {
          doc.setTextColor(15, 23, 42); // Valor padrão
        }
        doc.text(String(item1.value || 'N/A'), 55, itemY);
      }

      // Coluna 2
      const item2 = items[i + half];
      if (item2) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(`${item2.label}:`, 110, itemY);

        doc.setFont('helvetica', item2.highlight ? 'bold' : 'normal');
        if (item2.isFallback) {
          doc.setTextColor(160, 174, 192);
        } else if (item2.highlight && borderGold) {
          doc.setTextColor(217, 119, 6);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(String(item2.value || 'N/A'), 145, itemY);
      }

      itemY += 8;
    }

    currentY += cardHeight;
  };

  // Função de Desenhar a Jornada do Visitante (Timeline)
  const drawJourneyCard = (journey: any[]) => {
    if (!journey || journey.length === 0) return;

    const cardHeight = 15 + (journey.length * 12) + 5;

    if (currentY + cardHeight > 275) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(15, currentY, 180, cardHeight - 5, 'FD');

    doc.setTextColor(14, 165, 233);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('JORNADA DO VISITANTE (HISTÓRICO)', 20, currentY + 8);

    doc.setDrawColor(230, 235, 240);
    doc.line(20, currentY + 11, 190, currentY + 11);

    // Linha do tempo vertical
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.5);
    doc.line(24, currentY + 17, 24, currentY + 15 + ((journey.length - 1) * 12));

    let stepY = currentY + 18;
    doc.setFontSize(8);

    journey.forEach((step: any) => {
      // Marcador da timeline
      doc.setFillColor(14, 165, 233);
      doc.circle(24, stepY - 1, 1.2, 'FD');

      // URL formatada
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const urlStr = decodeHtml(step.url || step.page_url || 'URL desconhecida');
      doc.text(urlStr, 29, stepY - 1);

      // Data/Hora & Referrer
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const timeStr = step.timestamp ? new Date(step.timestamp).toLocaleString('pt-BR') : 'Data não registrada';
      const refStr = step.referrer ? `  •  Referência: ${decodeHtml(step.referrer)}` : '';
      doc.text(`${timeStr}${refStr}`, 29, stepY + 2.5);

      stepY += 12;
    });

    currentY += cardHeight;
  };

  // 1. Perfil & Sistema
  const perfilItems = [
    { label: 'ID do Lead', value: leadToExport.id },
    { label: 'Data', value: new Date(leadToExport.created_at).toLocaleString('pt-BR') },
    { label: 'Nome', value: leadToExport.name || 'Sem nome', isFallback: !leadToExport.name },
    { label: 'E-mail', value: leadToExport.email || 'Sem e-mail', isFallback: !leadToExport.email },
    { label: 'Telefone', value: leadToExport.phone || 'Sem telefone', isFallback: !leadToExport.phone },
    { label: 'Terminal', value: leadToExport.webhooks?.name || leadToExport.data?.captured_by?.name || 'N/A', isFallback: !leadToExport.webhooks?.name && !leadToExport.data?.captured_by?.name }
  ];

  if (leadToExport.data) {
    perfilItems.push({ label: 'IP', value: leadToExport.data.location?.ip || 'N/A', isFallback: !leadToExport.data.location?.ip });
    const locStr = leadToExport.data.location?.city
      ? `${decodeHtml(decodeURIComponent(leadToExport.data.location.city))}/${decodeHtml(decodeURIComponent(leadToExport.data.location.region || ''))} (${leadToExport.data.location.country || 'BR'})`
      : 'N/A';
    perfilItems.push({ label: 'Localização', value: locStr, isFallback: !leadToExport.data.location?.city });

    if (leadToExport.data.device) {
      const device = leadToExport.data.device;
      perfilItems.push({ label: 'SO', value: device.os || 'N/A', isFallback: !device.os });
      perfilItems.push({ label: 'Dispositivo', value: device.is_mobile ? 'Mobile' : 'Desktop' });
      perfilItems.push({ label: 'Idioma', value: device.language || 'N/A', isFallback: !device.language });
      perfilItems.push({ label: 'Timezone', value: device.timezone ? decodeHtml(device.timezone) : 'N/A', isFallback: !device.timezone });
      perfilItems.push({ label: 'Resolução', value: device.screen || 'N/A', isFallback: !device.screen });
    }
  }
  drawCard('Perfil & Sistema', perfilItems);

  // 2. Comportamento & Engajamento
  const comportamentoItems = [];
  const sourceLabel = leadToExport.source === 'whatsapp_tracker' ? 'WhatsApp Click' : (leadToExport.source === 'custom_tracker' ? 'Rastreador' : 'Formulário');
  comportamentoItems.push({ label: 'Origem', value: sourceLabel });

  if (leadToExport.data) {
    comportamentoItems.push({ label: 'Pág. Origem', value: decodeHtml(leadToExport.data.behavior?.page_url || leadToExport.data.page_url || 'N/A'), isFallback: !leadToExport.data.behavior?.page_url && !leadToExport.data.page_url });
    comportamentoItems.push({ label: 'Ação / Botão', value: leadToExport.data.behavior?.button_text || leadToExport.data.button_text || 'N/A', isFallback: !leadToExport.data.behavior?.button_text && !leadToExport.data.button_text });
    comportamentoItems.push({ label: 'Tempo Pág.', value: leadToExport.data.behavior?.time_on_page || leadToExport.data.time_on_page || 'N/A', isFallback: !leadToExport.data.behavior?.time_on_page && !leadToExport.data.time_on_page });

    if (leadToExport.data.behavior) {
      const behavior = leadToExport.data.behavior;
      comportamentoItems.push({ label: 'Scroll Máx.', value: behavior.scroll_depth || 'N/A', isFallback: !behavior.scroll_depth });
      const sessionDur = behavior.session_duration_seconds !== undefined ? `${behavior.session_duration_seconds}s` : 'N/A';
      comportamentoItems.push({ label: 'Dur. Sessão', value: sessionDur, isFallback: behavior.session_duration_seconds === undefined });
      const convTime = behavior.conversion_time_seconds !== undefined ? `${behavior.conversion_time_seconds}s` : 'N/A';
      comportamentoItems.push({ label: 'Tempo Conv.', value: convTime, isFallback: behavior.conversion_time_seconds === undefined });
    }
    if (leadToExport.data.lead_score !== undefined) {
      comportamentoItems.push({ label: 'Lead Score', value: `${leadToExport.data.lead_score}/100`, highlight: true });
    }
    const consentVal = leadToExport.data.consent_given !== undefined
      ? (leadToExport.data.consent_given ? 'Autorizado' : 'Negado')
      : 'Não especificado';
    comportamentoItems.push({ label: 'Consent. LGPD', value: consentVal, isFallback: leadToExport.data.consent_given === undefined });
  }
  drawCard('Comportamento & Engajamento', comportamentoItems);

  // 3. Aquisição & UTMs (Destaque Dourado)
  const marketingItems = [];
  const marketing = leadToExport.data?.marketing || {};
  const sourceVal = marketing.source || leadToExport.data?.utm_source || 'Direto / Orgânico';
  const isSourceEmpty = !marketing.source && !leadToExport.data?.utm_source;
  marketingItems.push({ label: 'UTM Source', value: sourceVal, highlight: isPaid && !isSourceEmpty, isFallback: isSourceEmpty });

  const mediumVal = marketing.medium || leadToExport.data?.utm_medium || 'N/A';
  const isMediumEmpty = !marketing.medium && !leadToExport.data?.utm_medium;
  marketingItems.push({ label: 'UTM Medium', value: mediumVal, highlight: isPaid && !isMediumEmpty, isFallback: isMediumEmpty });

  const campaignVal = marketing.campaign || leadToExport.data?.utm_campaign || 'N/A';
  const isCampaignEmpty = !marketing.campaign && !leadToExport.data?.utm_campaign;
  marketingItems.push({ label: 'UTM Campaign', value: campaignVal, highlight: isPaid && !isCampaignEmpty, isFallback: isCampaignEmpty });

  const termVal = marketing.term || 'N/A';
  marketingItems.push({ label: 'UTM Term', value: termVal, highlight: isPaid && marketing.term, isFallback: !marketing.term });

  const contentVal = marketing.content || 'N/A';
  marketingItems.push({ label: 'UTM Content', value: contentVal, highlight: isPaid && marketing.content, isFallback: !marketing.content });

  const idVal = marketing.id || 'N/A';
  marketingItems.push({ label: 'UTM ID', value: idVal, highlight: isPaid && marketing.id, isFallback: !marketing.id });

  if (marketing.gclid) marketingItems.push({ label: 'Google Ads ID', value: 'Ativo (GCLID)', highlight: true });
  if (marketing.fbclid) marketingItems.push({ label: 'Facebook Ads ID', value: 'Ativo (FBCLID)', highlight: true });
  if (marketing.ttclid) marketingItems.push({ label: 'TikTok Ads ID', value: 'Ativo (TTCLID)', highlight: true });
  drawCard('Aquisição & UTMs', marketingItems, isPaid);

  // 4. Jornada do Visitante (Histórico)
  if (leadToExport.data?.marketing?.journey && leadToExport.data.marketing.journey.length > 0) {
    drawJourneyCard(leadToExport.data.marketing.journey);
  }

  // 5. Campos Extras/Customizados
  if (leadToExport.data) {
    const extraFields: any[] = [];
    Object.keys(leadToExport.data).forEach(k => {
      if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign', 'lead_score', 'consent_given', 'consent_timestamp', 'source', 'name', 'email', 'phone', 'fields', 'session_id', 'visitor_id', 'device', 'timestamp', 'lead_id', 'event_hash'].includes(k)) {
        extraFields.push({ label: k, value: String(leadToExport.data[k]) });
      }
    });
    drawCard('Campos Customizados do Formulário', extraFields);
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Asthros | CO-B. - Relatório de Leads - Confidencial`, 15, 285);
    doc.text(`Página ${i} de ${pageCount}`, 195, 285, { align: 'right' });
  }

  doc.save(`lead_${formattedClientName}_${formattedLeadName}_${new Date().getTime()}.pdf`);
  logAction('Exportação Lead Individual', 'lead', leadToExport.id, {
    format: 'pdf',
    paid: isPaid
  });
};

export const convertToCSV = (data: any[], selectedFields: string[]) => {
  const dynamicKeys = new Set<string>();
  if (selectedFields.includes('custom_fields')) {
    data.forEach(l => {
      if (l.data) {
        Object.keys(l.data).forEach(k => {
          if (!['behavior', 'marketing', 'location', 'captured_by', 'page_url', 'button_text', 'time_on_page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(k)) {
            dynamicKeys.add(k);
          }
        });
      }
    });
  }
  const dynamicKeysArray = Array.from(dynamicKeys);
  const mapping = data[0]?.webhooks?.field_mapping || {};

  const headers: string[] = [];
  if (selectedFields.includes('id')) headers.push('ID');
  if (selectedFields.includes('created_at')) headers.push('Data');
  if (selectedFields.includes('name')) headers.push('Nome');
  if (selectedFields.includes('email')) headers.push('E-mail');
  if (selectedFields.includes('phone')) headers.push('Telefone');
  if (selectedFields.includes('webhook')) headers.push('Terminal/Webhook');
  if (selectedFields.includes('page_url')) headers.push('Página');
  if (selectedFields.includes('button_text')) headers.push('Botão Clicado');
  if (selectedFields.includes('time_on_page')) headers.push('Tempo na Pág.');
  if (selectedFields.includes('utm')) {
    headers.push('UTM Source');
    headers.push('UTM Medium');
    headers.push('UTM Campaign');
  }
  if (selectedFields.includes('location')) {
    headers.push('Cidade');
    headers.push('Estado');
    headers.push('IP');
  }
  dynamicKeysArray.forEach(k => {
    headers.push(mapping[k] || k);
  });

  const rows = data.map(l => {
    const row: string[] = [];
    if (selectedFields.includes('id')) row.push(l.id || '');
    if (selectedFields.includes('created_at')) row.push(new Date(l.created_at).toLocaleString('pt-BR'));
    if (selectedFields.includes('name')) row.push(l.name || '');
    if (selectedFields.includes('email')) row.push(l.email || '');
    if (selectedFields.includes('phone')) row.push(formatPhone(l.phone));
    if (selectedFields.includes('webhook')) {
      const webhookLabel = l.webhooks?.name || (l.data?.captured_by?.name ? `${l.data.captured_by.name} (Removido)` : 'N/A');
      row.push(webhookLabel);
    }
    if (selectedFields.includes('page_url')) {
      row.push(l.data?.behavior?.page_url || l.data?.page_url || '');
    }
    if (selectedFields.includes('button_text')) {
      row.push(l.data?.behavior?.button_text || l.data?.button_text || '');
    }
    if (selectedFields.includes('time_on_page')) {
      row.push(l.data?.behavior?.time_on_page || l.data?.time_on_page || '');
    }
    if (selectedFields.includes('utm')) {
      row.push(l.data?.marketing?.source || l.data?.utm_source || '');
      row.push(l.data?.marketing?.medium || l.data?.utm_medium || '');
      row.push(l.data?.marketing?.campaign || l.data?.utm_campaign || '');
    }
    if (selectedFields.includes('location')) {
      row.push(l.data?.location?.city || '');
      row.push(l.data?.location?.region || '');
      row.push(l.data?.location?.ip || '');
    }
    dynamicKeysArray.forEach(k => {
      row.push(l.data?.[k] !== undefined ? String(l.data[k]) : '');
    });
    return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
  });

  return "﻿" + [headers.join(','), ...rows].join('\n');
};

export const handleExportPDF = async (
  password: string | null,
  selectedFields: string[],
  filteredLeads: any[],
  selectedWebhookId: string | null,
  currentClient: any,
  onDone: () => void
) => {
  const leadsToExport = getSanitizedLeads(filteredLeads);
  if (leadsToExport.length === 0) return;

  // No jsPDF moderno, a criptografia deve ser passada no construtor
  const doc = new jsPDF({
    orientation: 'landscape',
    encryption: password ? {
      userPassword: password,
      ownerPassword: password,
      userPermissions: ["print", "modify", "copy", "annot-forms"]
    } : undefined
  });

  const webhookName = selectedWebhookId
    ? currentClient?.webhooks?.find((w: any) => w.id === selectedWebhookId)?.name
    : (currentClient?.webhooks?.length === 1 ? currentClient.webhooks[0].name : 'Todos');

  // 1. Cabeçalho Personalizado (Ajustado para Landscape - 297mm de largura)
  doc.setFillColor(10, 20, 35);
  doc.rect(0, 0, 297, 40, 'F');

  try {
    const logoUrl = '/asthros-leads.png';
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = logoUrl;
    });
    const logoWidth = 40;
    const logoHeight = (img.height * logoWidth) / img.width;
    const logoY = (40 - logoHeight) / 2;
    doc.addImage(img, 'PNG', 15, logoY, logoWidth, logoHeight);
  } catch (err) {
    doc.setTextColor(86, 215, 253);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ASTHROS', 15, 22);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Leads', 282, 16, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${currentClient?.name || 'Geral'}`, 282, 22, { align: 'right' });
  doc.text(`Terminal: ${webhookName || 'Todos'}`, 282, 28, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 34, { align: 'right' });

  const whatsappLeads = leadsToExport.filter(l => l.source === 'whatsapp_tracker');
  const customLeads = leadsToExport.filter(l => l.source === 'custom_tracker');
  const formLeads = leadsToExport.filter(l => l.source !== 'whatsapp_tracker' && l.source !== 'custom_tracker');

  const generateGroupTable = (title: string, groupLeads: any[], startY: number) => {
    if (groupLeads.length === 0) return startY;

    const hasEmail = selectedFields.includes('email');
    const hasPhone = selectedFields.includes('phone');
    const hasPage = selectedFields.includes('page_url');
    const hasButton = selectedFields.includes('button_text');
    const hasTime = selectedFields.includes('time_on_page');
    const hasLocation = selectedFields.includes('location');
    const hasUtm = selectedFields.includes('utm');

    const headers: string[] = [];
    if (selectedFields.includes('created_at')) headers.push('Data/Hora (captura)');
    if (selectedFields.includes('name')) headers.push('Nome');
    if (hasEmail) headers.push('E-mail');
    if (hasPhone) headers.push(title.includes('Formulário') ? 'Telefone/Whatsapp' : 'Telefone');
    if (hasPage) headers.push('Página');
    if (hasButton) headers.push('Nome Btn');
    if (hasTime) headers.push('Tempo na Pág.');
    if (hasLocation) headers.push('Localização');
    if (hasUtm) headers.push('UTM Source');

    const tableRows = groupLeads.map(l => {
      const row: string[] = [];
      if (selectedFields.includes('created_at')) {
        row.push(new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
      }
      if (selectedFields.includes('name')) {
        row.push(l.name || 'S/ Nome');
      }
      if (hasEmail) row.push(l.email || 'N/A');
      if (hasPhone) row.push(formatPhone(l.phone));

      if (hasPage) {
        const url = l.data?.behavior?.page_url || l.data?.page_url || 'N/A';
        row.push(url !== 'N/A' ? (url.length > 30 ? '...' + url.substring(url.length - 27) : url) : 'N/A');
      }
      if (hasButton) row.push(l.data?.behavior?.button_text || l.data?.button_text || 'N/A');
      if (hasTime) row.push(l.data?.behavior?.time_on_page || l.data?.time_on_page || 'N/A');
      if (hasLocation) {
        const city = l.data?.location?.city ? decodeURIComponent(l.data.location.city) : '';
        const region = l.data?.location?.region ? decodeURIComponent(l.data.location.region) : '';
        row.push(city && region ? `${city}/${region}` : (city || region || 'N/A'));
      }
      if (hasUtm) {
        const utm = l.data?.marketing?.source || l.data?.utm_source || 'N/A';
        row.push(utm !== 'N/A' ? decodeURIComponent(utm) : 'N/A');
      }

      return row;
    });

    doc.setFillColor(10, 20, 35);
    doc.rect(15, startY, 133.5, 10, 'F');

    doc.setTextColor(86, 215, 253);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 22, startY + 6.5);

    autoTable(doc, {
      head: [headers],
      body: tableRows,
      startY: startY + 12,
      theme: 'striped',
      headStyles: {
        fillColor: [10, 20, 35],
        textColor: [86, 215, 253],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      margin: { top: 50, left: 15 },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          const header = data.table.head[0].cells[data.column.index].raw as string;
          const cellValue = data.cell.raw as string;

          if (cellValue && cellValue !== 'N/A') {
            if (header === 'E-mail') {
              doc.setTextColor(86, 215, 253);
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: `mailto:${cellValue}` });
            }
            else if (header === 'Telefone' || header === 'Telefone/Whatsapp') {
              const cleanPhone = cellValue.replace(/\D/g, '');
              const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
              // Encontrar a coluna de Nome no cabeçalho
              const nameColIndex = headers.indexOf('Nome');
              const leadName = nameColIndex !== -1 ? (data.row.cells[nameColIndex].raw as string) : '';
              const message = encodeURIComponent(`Olá ${leadName || ''}, Tudo bem?`);
              const url = `https://wa.me/${finalPhone}?text=${message}`;

              doc.setTextColor(37, 211, 102);
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
            }
          }
        }
      }
    });

    return (doc as any).lastAutoTable.finalY + 15;
  };

  const drawStatBox = (x: number, y: number, w: number, h: number, title: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(24, 28, 41);
    doc.rect(x, y, w, h, 'F');

    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, 3, h, 'F');

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(title.toUpperCase(), x + 8, y + 6);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 8, y + 13);
  };

  drawStatBox(15, 46, 62, 18, 'Total de Leads', String(leadsToExport.length), [86, 215, 253]);
  drawStatBox(85, 46, 62, 18, 'WhatsApp & Cliques', String(whatsappLeads.length), [37, 211, 102]);
  drawStatBox(155, 46, 62, 18, 'Cliques & Seletores', String(customLeads.length), [168, 85, 247]);
  drawStatBox(225, 46, 62, 18, 'Leads de Formulários', String(formLeads.length), [86, 215, 253]);

  let currentY = 72;
  currentY = generateGroupTable('WhatsApp', whatsappLeads, currentY);
  currentY = generateGroupTable('Cliques & Seletores', customLeads, currentY);
  currentY = generateGroupTable('Formulário', formLeads, currentY);

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Asthros | CO-B. - Relatório de Leads - Confidencial`, 15, 200);
    doc.text(`Página ${i} de ${pageCount}`, 260, 200);
  }

  const formattedWebhookName = webhookName ? webhookName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'todos';
  const formattedClientName = (currentClient?.name || 'asthros').toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`relatorio_leads_${formattedClientName}_${formattedWebhookName}_${new Date().getTime()}.pdf`);
  logAction('Exportação Realizada', 'lead', undefined, {
    format: 'pdf',
    count: leadsToExport.length,
    protected: !!password,
    fields: selectedFields
  });
  onDone();
};
