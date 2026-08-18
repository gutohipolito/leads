export const isPaidMedia = (lead: any): boolean => {
  if (!lead || !lead.data) return false;

  const marketing = lead.data.marketing || {};
  const medium = (marketing.medium || lead.data.utm_medium || '').toLowerCase();
  const source = (marketing.source || lead.data.utm_source || '').toLowerCase();

  const paidMediums = ['cpc', 'ppc', 'paid', 'ads', 'traffic', 'cmp-paid'];
  const hasClickId = !!(
    marketing.gclid ||
    marketing.fbclid ||
    marketing.ttclid ||
    marketing.msclkid ||
    marketing.gbraid ||
    marketing.wbraid ||
    marketing.twclid ||
    marketing.li_fat_id
  );

  return paidMediums.includes(medium) || hasClickId || source.includes('ads') || medium.includes('ads');
};


export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/^N\/A\s*/i, '').trim();
  return cleaned || 'N/A';
};

export const formatTimeOnPage = (time: any): string => {
  if (time === undefined || time === null) return 'N/A';
  const str = String(time).toLowerCase();
  const num = parseInt(str.replace(/[^0-9]/g, '')) || 0;
  return `${num} segundos`;
};

export const formatScrollDepth = (depth: any): string => {
  if (depth === undefined || depth === null) return 'N/A';
  const str = String(depth);
  const num = parseInt(str.replace(/[^0-9]/g, '')) || 0;
  return `${num}%`;
};

export const formatConversionTime = (seconds: any): string => {
  if (seconds === undefined || seconds === null) return 'N/A';
  const sec = parseInt(String(seconds)) || 0;
  if (sec < 60) return `${sec} segundo${sec !== 1 ? 's' : ''}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minuto${min !== 1 ? 's' : ''}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hora${hrs !== 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  return `${days} dia${days !== 1 ? 's' : ''}`;
};

export const getTimelineItems = (marketing: any): any[] => {
  if (!marketing) return [];

  const journey = marketing.journey || [];
  const firstTouch = marketing.first_touch;
  const lastTouch = marketing.last_touch;
  const journeyLength = marketing.journey_length || journey.length || 1;

  // Se não temos journey no localStorage, usamos a lógica clássica baseada em first_touch, last_touch e journey_length
  if (journey.length === 0) {
    const items = [];
    if (firstTouch) {
      items.push({ ...firstTouch, label: 'Primeiro Toque' });
    }
    if (journeyLength > 2 && lastTouch) {
      items.push({ isIntermediate: true, count: journeyLength - 2 });
    }
    if (lastTouch) {
      items.push({ ...lastTouch, label: 'Último Toque (Conversão)' });
    }
    return items;
  }

  // Se a jornada foi truncada (journeyLength > journey.length)
  if (journeyLength > journey.length) {
    const items = [];
    if (firstTouch) {
      items.push({ ...firstTouch, label: 'Primeiro Toque' });
    }

    const omitted = journeyLength - journey.length - 1;
    if (omitted > 0) {
      items.push({ isIntermediate: true, count: omitted });
    }

    journey.forEach((tp: any, idx: number) => {
      const isLast = idx === journey.length - 1;
      items.push({
        ...tp,
        label: isLast ? 'Último Toque (Conversão)' : undefined
      });
    });

    return items;
  } else {
    // Caso contrário (jornada clássica/completa, não truncada)
    return journey.map((tp: any, idx: number) => {
      let label = undefined;
      if (idx === 0) {
        label = 'Primeiro Toque';
      } else if (idx === journey.length - 1) {
        label = 'Último Toque (Conversão)';
      }
      return {
        ...tp,
        label
      };
    });
  }
};

export const getSanitizedLeads = (rawLeads: any[]): any[] => {
  return rawLeads
    .filter(l => l.source !== 'test_simulation')
    .map(l => {
      if (l.data?.behavior?.whatsapp_destination_phone) {
        const clone = {
          ...l,
          data: {
            ...l.data,
            behavior: {
              ...l.data.behavior
            }
          }
        };
        delete clone.data.behavior.whatsapp_destination_phone;
        return clone;
      }
      return l;
    });
};
