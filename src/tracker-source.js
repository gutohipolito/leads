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

    function sanitize(value) {
        if (!value) return '';
        return String(value).replace(/[<>]/g, '').substring(0, 500).trim();
    }

    const trackingLocks = new WeakSet();

    function queueFailedLead(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('asthros_queue', JSON.stringify(queue.slice(-5))); // max 5
        } catch (e) {}
    }

    async function sendPayload(payload) {
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        
        // Remove o secret do corpo para envio seguro e exclusivo via cabeçalhos HTTP
        const safePayload = { ...payload };
        if (safePayload.secret) {
            delete safePayload.secret;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Asthros-Secret': config.secret
                },
                body: JSON.stringify(safePayload),
                keepalive: true
            });
            
            if (!response.ok) {
                queueFailedLead(safePayload);
            }
        } catch (err) {
            queueFailedLead(safePayload);
        }
    }

    async function flushQueue() {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            if (!queue.length) return;

            // Só tenta reenviar se tiver passado mais de 1 minuto desde a última tentativa
            const lastTry = parseInt(localStorage.getItem('asthros_queue_last_try') || '0');
            if (Date.now() - lastTry < 60 * 1000) {
                return;
            }
            localStorage.setItem('asthros_queue_last_try', Date.now().toString());

            const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
            const failedItems = [];

            for (const payload of queue) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-Asthros-Secret': config.secret
                        },
                        body: JSON.stringify(payload),
                        keepalive: true
                    });
                    if (!response.ok) {
                        failedItems.push(payload);
                    }
                } catch (e) {
                    failedItems.push(payload);
                }
            }

            if (failedItems.length > 0) {
                localStorage.setItem('asthros_queue', JSON.stringify(failedItems.slice(-5)));
            } else {
                localStorage.removeItem('asthros_queue');
                localStorage.removeItem('asthros_queue_last_try');
            }
        } catch (err) {}
    }

    function saveUtmsToStorageAndJourney() {
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

            // 1. Gravar UTMs na sessão
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

            // 2. Gravar o Touchpoint na jornada do LocalStorage (Atribuição Multitouch)
            const referrer = document.referrer || 'direto';
            const sourceFromRef = getSourceFromReferrer(referrer);
            let touchpointSource = 'direto';

            if (hasNewUtms) {
                touchpointSource = utmsToSave.source;
            } else if (sourceFromRef !== 'direto') {
                touchpointSource = sourceFromRef;
            } else {
                // Se for visita direta pura, registramos apenas se a jornada estiver vazia
                const existing = localStorage.getItem('asthros_journey');
                if (existing) return;
            }

            const touchpoint = {
                source: touchpointSource,
                medium: utmsToSave.medium || (hasNewUtms ? 'cpc' : (sourceFromRef !== 'direto' ? 'referência' : 'direto')),
                campaign: utmsToSave.campaign || 'N/A',
                timestamp: new Date().toISOString(),
                page_url: window.location.href,
                page_title: document.title
            };

            let journey = [];
            try {
                const existingJourney = localStorage.getItem('asthros_journey');
                if (existingJourney) {
                    journey = JSON.parse(existingJourney);
                }
            } catch (e) {}

            // Evitar gravar múltiplos cliques/visitas seguidos no mesmo canal e na mesma página em menos de 5 min
            if (journey.length > 0) {
                const last = journey[journey.length - 1];
                const diff = Date.now() - new Date(last.timestamp).getTime();
                const isSameUrl = last.page_url === touchpoint.page_url;
                if (last.source === touchpoint.source && diff < 5 * 60 * 1000 && isSameUrl) {
                    return;
                }
            }

            journey.push(touchpoint);
            if (journey.length > 10) {
                journey.shift(); // Limita a jornada em 10 touchpoints
            }

            localStorage.setItem('asthros_journey', JSON.stringify(journey));
        } catch (e) {}
    }

    saveUtmsToStorageAndJourney();

    // Controle de tempo ativo na página e scroll máximo (Page Visibility API e Reset em SPAs)
    let totalActive = 0;
    let lastVisible = Date.now();
    let maxScroll = 0;

    try {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                totalActive += Date.now() - lastVisible;
            } else {
                lastVisible = Date.now();
            }
        });
    } catch (e) {}

    function getActiveTimeOnPage() {
        try {
            const currentActive = totalActive + (document.hidden ? 0 : Date.now() - lastVisible);
            return Math.round(currentActive / 1000) + 's';
        } catch (e) {
            return '0s';
        }
    }

    function resetPageContext() {
        totalActive = 0;
        lastVisible = Date.now();
        maxScroll = 0;
    }

    window.addEventListener('scroll', () => {
        try {
            const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
            if (scrollPercent > maxScroll) maxScroll = Math.round(scrollPercent);
        } catch (e) {}
    }, { passive: true });

    // Suporte a SPAs (React, Next.js, Vue) - Monitoramento de mudança de rota universal e compatível
    try {
        window.addEventListener('popstate', () => {
            saveUtmsToStorageAndJourney();
            resetPageContext();
        });

        let lastHref = location.href;
        setInterval(() => {
            if (location.href !== lastHref) {
                lastHref = location.href;
                saveUtmsToStorageAndJourney();
                resetPageContext();
            }
        }, 500);
    } catch (e) {}

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
        const ua = navigator.userAgent;
        return {
            platform: navigator.platform, // Mantido para compatibilidade histórica do banco
            os: /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro',
            is_mobile: /Mobi|Android/i.test(ua),
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            user_agent: ua
        };
    }

    function getReferrerContext() {
        try {
            return sessionStorage.getItem('asthros_referrer') || document.referrer || 'direto';
        } catch (e) {
            return document.referrer || 'direto';
        }
    }

    function getJourneyContext() {
        try {
            return JSON.parse(localStorage.getItem('asthros_journey') || '[]');
        } catch (e) {
            return [];
        }
    }

    function buildMarketingContext() {
        return {
            ...getUtms(),
            referrer: getReferrerContext(),
            page_title: document.title,
            page_url: window.location.href,
            journey: getJourneyContext()
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
        const lowerUrl = url.toLowerCase();
        const id = (link.id || '').toLowerCase();
        const className = (link.className || '').toLowerCase();
        
        // 1. WhatsApp (Verificação expandida com suporte a encurtadores e classes de plugins)
        const isWpp = isWhatsAppLink(url) || 
                      lowerUrl.includes('whatsapp') || 
                      id.includes('whatsapp') || 
                      id.includes('wpp') || 
                      className.includes('whatsapp') || 
                      className.includes('wpp') ||
                      className.includes('wa-link') ||
                      className.includes('wa_btn') ||
                      className.includes('whatsapp-button');

        if (isWpp) {
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
                if (keyword && lowerUrl.includes(keyword.toLowerCase())) {
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
        // Encontra o elemento de link clicado
        const link = e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('.btn') || e.target.closest('.button') || e.target.closest('[class*="whatsapp"]') || e.target.closest('[class*="wpp"]') || e.target.closest('[id*="whatsapp"]') || e.target.closest('[id*="wpp"]');
        if (!link) return;

        const trackerMatch = getTrackingMatch(link);
        if (!trackerMatch) {
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link comum ignorado:', link.href);
            }
            return;
        }

        // Proteção contra duplo clique e race condition de envio por elemento
        if (trackingLocks.has(link)) return;
        trackingLocks.add(link);
        setTimeout(() => { trackingLocks.delete(link); }, 2000);

        // console.log(`%c[Asthros] CAPTURANDO LEAD (${trackerMatch.label})!`, 'color: #56d7fd; font-weight: bold;');

        const payload = {
            source: trackerMatch.source,
            name: 'Lead Identificado via ' + trackerMatch.label,
            marketing: buildMarketingContext(),
            behavior: {
                time_on_page: getActiveTimeOnPage(),
                scroll_depth: maxScroll + '%',
                button_text: link.innerText.trim() || link.getAttribute('aria-label') || trackerMatch.label,
                match_type: trackerMatch.label,
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: new Date().toISOString()
        };

        sendPayload(payload);
    }

    // 4. Captura Inteligente de Formulários no Frontend (Opcional)
    async function trackFormSubmit(e) {
        try {
            const form = e.target;
            const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
            const formDataFields = {};
            
            let leadName = '';
            let leadEmail = '';
            let leadPhone = '';
            
            inputs.forEach(input => {
                const nameAttr = (input.name || input.id || '').toLowerCase();
                const value = (input.value || '').trim();
                if (!value) return;
                
                // Ignorar campos confidenciais
                if (input.type === 'password' || nameAttr.includes('password') || nameAttr.includes('token') || nameAttr.includes('nonce')) {
                    return;
                }
                
                const cleanValue = sanitize(value);
                if (!cleanValue) return;
                
                if (nameAttr.includes('name') || nameAttr.includes('nome')) {
                    leadName = cleanValue;
                } else if (nameAttr.includes('email') || nameAttr.includes('e-mail') || input.type === 'email') {
                    leadEmail = cleanValue;
                } else if (nameAttr.includes('phone') || nameAttr.includes('tel') || nameAttr.includes('whats') || nameAttr.includes('cel') || input.type === 'tel') {
                    leadPhone = cleanValue;
                } else {
                    formDataFields[input.name || input.id] = cleanValue;
                }
            });
            
            // Validação básica do formato do e-mail capturado
            if (leadEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
                leadEmail = '';
            }
            
            if (leadName && (leadEmail || leadPhone)) {
                const payload = {
                    source: 'form',
                    name: leadName,
                    email: leadEmail,
                    phone: leadPhone,
                    fields: formDataFields,
                    marketing: buildMarketingContext(),
                    behavior: {
                        time_on_page: getActiveTimeOnPage(),
                        scroll_depth: maxScroll + '%',
                        button_text: form.querySelector('[type="submit"]')?.innerText?.trim() || 'Enviar Formulário',
                        match_type: 'Auto-captura de Formulário'
                    },
                    device: getDeviceContext(),
                    timestamp: new Date().toISOString()
                };
                
                sendPayload(payload);
            }
        } catch (err) {}
    }

    document.addEventListener('click', trackLead, { capture: true });

    // Habilita a escuta de formulários apenas se configurado explicitamente autoTrackForms: true
    if (config.autoTrackForms === true || config.autoTrackForms === 'true') {
        document.addEventListener('submit', trackFormSubmit, { capture: true });
    }

    // Tenta esvaziar a fila de reenvio offline
    flushQueue();
    // console.log('%c[Asthros] Escuta de eventos ativada com sucesso!', 'color: #25d366;');
})();

