(function() {
    // console.log('%c[Asthros] Iniciando depuração do rastreador...', 'color: #56d7fd; font-weight: bold;');

    // 1. Busca de Configuração
    let config = window.AsthrosConfig || null;

    if (!config) {
        const script = document.currentScript || 
                       document.querySelector('script[src*="tracker.js"]') || 
                       document.querySelector('script[src*="tracker.min.js"]');
        
        if (script) {
            config = {
                clientId: script.getAttribute('data-client-id'),
                secret: script.getAttribute('data-secret'),
                apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br',
                trackKeywords: script.getAttribute('data-keywords') ? script.getAttribute('data-keywords').split(',') : [],
                trackSelectors: script.getAttribute('data-selectors') ? script.getAttribute('data-selectors').split(',') : []
            };
        }
    }

    if (!config || !config.clientId || !config.secret) {
        // console.error('[Asthros] CONFIGURAÇÃO NÃO ENCONTRADA! Certifique-se de que window.AsthrosConfig está definido ou a tag <script> tem os atributos data-.');
        return;
    }

    function saveUtmsToStorage() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const utmsToSave = {};
            let hasNewUtms = false;

            ['source', 'medium', 'campaign', 'term', 'content'].forEach(key => {
                const val = urlParams.get(`utm_${key}`);
                if (val) {
                    utmsToSave[key] = val;
                    hasNewUtms = true;
                }
            });

            if (hasNewUtms) {
                sessionStorage.setItem('asthros_utms', JSON.stringify(utmsToSave));
                if (!sessionStorage.getItem('asthros_referrer')) {
                    sessionStorage.setItem('asthros_referrer', document.referrer || 'direto');
                }
            } else {
                if (!sessionStorage.getItem('asthros_referrer')) {
                    sessionStorage.setItem('asthros_referrer', document.referrer || 'direto');
                }
            }
        } catch (e) {}
    }

    saveUtmsToStorage();

    /*
    console.log('[Asthros] Configuração Carregada:', {
        clientId: config.clientId,
        apiUrl: config.apiUrl,
        keywords: config.trackKeywords || [],
        selectors: config.trackSelectors || [],
        // Ocultamos parte do secret por segurança no log
        secret: config.secret.substring(0, 10) + '...'
    });
    */

    const startTime = Date.now();
    let maxScroll = 0;

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        if (scrollPercent > maxScroll) maxScroll = Math.round(scrollPercent);
    }, { passive: true });

    function getSourceFromReferrer(ref) {
        if (!ref || ref === 'direto') return 'direto';
        const lowerRef = ref.toLowerCase();
        if (lowerRef.includes('google') || lowerRef.includes('bing') || lowerRef.includes('yahoo')) return 'orgânico';
        if (lowerRef.includes('facebook') || lowerRef.includes('fb.me')) return 'facebook';
        if (lowerRef.includes('instagram') || lowerRef.includes('ig.me')) return 'instagram';
        if (lowerRef.includes('t.co') || lowerRef.includes('twitter.com') || lowerRef.includes('x.com')) return 'twitter';
        if (lowerRef.includes('linkedin')) return 'linkedin';
        if (lowerRef.includes('youtube.com') || lowerRef.includes('youtu.be')) return 'youtube';
        if (lowerRef.includes('whatsapp') || lowerRef.includes('wa.me')) return 'whatsapp';
        return 'referência';
    }

    function getUtms() {
        let utms = {};
        
        // 1. Tenta obter da URL atual
        const urlParams = new URLSearchParams(window.location.search);
        let hasUrlUtms = false;
        ['source', 'medium', 'campaign', 'term', 'content'].forEach(key => {
            const val = urlParams.get(`utm_${key}`);
            if (val) {
                utms[key] = val;
                hasUrlUtms = true;
            }
        });

        // 2. Se não tiver na URL atual, recupera do sessionStorage
        if (!hasUrlUtms) {
            try {
                const stored = sessionStorage.getItem('asthros_utms');
                if (stored) {
                    utms = JSON.parse(stored);
                }
            } catch (e) {}
        }

        // 3. Fallback se não houver UTM em lugar nenhum
        if (Object.keys(utms).length === 0) {
            try {
                const storedReferrer = sessionStorage.getItem('asthros_referrer');
                utms.source = getSourceFromReferrer(storedReferrer || document.referrer);
            } catch (e) {
                utms.source = getSourceFromReferrer(document.referrer);
            }
        }
        
        return utms;
    }

    function getDeviceContext() {
        return {
            platform: navigator.platform,
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            user_agent: navigator.userAgent
        };
    }

    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        const matches = /wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/.test(lowerUrl);
        return matches;
    }

    function extractWhatsAppPhone(url) {
        if (!url) return null;
        try {
            const wameMatch = url.match(/wa\.me\/([0-9]+)/i);
            if (wameMatch && wameMatch[1]) {
                return wameMatch[1];
            }
            const phoneMatch = url.match(/[?&]phone=([0-9]+)/i);
            if (phoneMatch && phoneMatch[1]) {
                return phoneMatch[1];
            }
        } catch (e) {}
        return null;
    }

    function getTrackingMatch(link) {
        if (!link) return null;
        const url = link.href || '';
        
        // 1. WhatsApp (Sempre ativo por padrão)
        if (isWhatsAppLink(url)) {
            const destPhone = extractWhatsAppPhone(url);
            return { 
                source: 'whatsapp_tracker', 
                label: 'WhatsApp', 
                whatsapp_destination_phone: destPhone 
            };
        }

        // 2. Custom Keywords (ex: 'checkout', 'comprar')
        if (config.trackKeywords && Array.isArray(config.trackKeywords)) {
            for (const keyword of config.trackKeywords) {
                if (keyword && url.toLowerCase().includes(keyword.toLowerCase())) {
                    return { source: 'custom_tracker', label: `Keyword: ${keyword}` };
                }
            }
        }

        // 3. Custom Selectors (ex: '.btn-checkout', '#buy-now')
        if (config.trackSelectors && Array.isArray(config.trackSelectors)) {
            for (const selector of config.trackSelectors) {
                if (selector && link.matches(selector)) {
                    return { source: 'custom_tracker', label: `Selector: ${selector}` };
                }
            }
        }

        return null;
    }

    async function trackLead(e) {
        const link = e.target.closest('a') || 
                     e.target.closest('button') || 
                     e.target.closest('[role="button"]') || 
                     e.target.closest('.btn') || 
                     e.target.closest('.button');
        if (!link) return;

        const trackerMatch = getTrackingMatch(link);
        if (!trackerMatch) {
            // Se for link mas não deu match, ignoramos
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link ignorado.');
            }
            return;
        }

        // console.log(`%c[Asthros] CAPTURANDO LEAD (${trackerMatch.label})!`, 'color: #56d7fd; font-weight: bold;');

        const payload = {
            source: trackerMatch.source,
            name: 'Lead Identificado via ' + trackerMatch.label,
            marketing: { 
                ...getUtms(), 
                referrer: (() => {
                    try {
                        return sessionStorage.getItem('asthros_referrer') || document.referrer || 'direto';
                    } catch(e) {
                        return document.referrer || 'direto';
                    }
                })(),
                page_title: document.title,
                page_url: window.location.href
            },
            behavior: {
                time_on_page: Math.round((Date.now() - startTime) / 1000) + 's',
                scroll_depth: maxScroll + '%',
                button_text: link.innerText.trim() || link.getAttribute('aria-label') || trackerMatch.label,
                match_type: trackerMatch.label,
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: new Date().toISOString()
        };

        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}?secret=${config.secret}`;

        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                if (navigator.sendBeacon(endpoint, blob)) {
                    // console.log('[Asthros] Sucesso: Sinal enviado via Beacon API.');
                    return;
                }
            }

            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            })
            .then(() => { /* console.log('[Asthros] Sucesso: Sinal enviado via Fetch API.') */ })
            .catch(err => { /* console.error('[Asthros] Falha no envio (Fetch):', err) */ });

        } catch (err) {
            // console.error('[Asthros] Erro crítico no processamento:', err);
        }
    }

    document.addEventListener('click', trackLead, { capture: true });
    // console.log('%c[Asthros] Escuta de eventos ativada com sucesso!', 'color: #25d366;');
})();

