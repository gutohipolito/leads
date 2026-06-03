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

    // Validação de segurança da URL da API (deve utilizar HTTPS para prevenir sequestro de requisição ou injeção XSS)
    if (config.apiUrl && !config.apiUrl.startsWith('https://')) {
        config.apiUrl = 'https://leads.asthros.com.br';
    } else if (!config.apiUrl) {
        config.apiUrl = 'https://leads.asthros.com.br';
    }

    function sanitize(value) {
        if (!value) return '';
        return String(value).replace(/[<>]/g, '').substring(0, 500).trim();
    }

    function sanitizeButtonText(text) {
        if (!text) return '';
        return String(text)
            .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[cartão]')
            .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[cpf]')
            .substring(0, 100)
            .trim();
    }

    function parseUtmsFromUrl() {
        const utms = {};
        try {
            const queryParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash || '';
            const hashQueryPart = hash.includes('?') 
                ? hash.split('?')[1]          // hash com query: #/page?utm_source=...
                : hash.includes('utm_') 
                    ? hash.replace(/^#\/?/, '') // hash direto com UTM: #utm_source=...
                    : '';                        // âncora normal: #secao — ignora
            const hashParams = new URLSearchParams(hashQueryPart);

            ['source', 'medium', 'campaign', 'term', 'content'].forEach(key => {
                const valQuery = queryParams.get(`utm_${key}`);
                const valHash = hashParams.get(`utm_${key}`);
                const val = valQuery || valHash;
                if (val) {
                    utms[key] = val;
                }
            });
        } catch (e) {}
        return utms;
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
        
        // Beacon apenas no fechamento — com secret no corpo como fallback seguro (o backend já aceita)
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...payload, secret: config.secret };
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

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

    let isFlushing = false;
    async function flushQueue() {
        if (isFlushing) return;
        
        const lockKey = 'asthros_flush_lock';
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            if (!queue.length) return;

            // Só tenta reenviar se tiver passado mais de 1 minuto desde a última tentativa
            const lastTry = parseInt(localStorage.getItem('asthros_queue_last_try') || '0');
            if (Date.now() - lastTry < 60 * 1000) {
                return;
            }

            // Lock distribuído entre abas
            const lock = localStorage.getItem(lockKey);
            if (lock && Date.now() - parseInt(lock) < 10000) return; // outra aba está processando
            localStorage.setItem(lockKey, Date.now().toString());

            isFlushing = true;
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

            // Apenas atualiza o localStorage no final do processamento
            if (failedItems.length > 0) {
                try {
                    // Mescla os itens que falharam com novos leads que possam ter entrado na fila no meio do caminho
                    const currentQueue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
                    const mergedQueue = [...failedItems];
                    
                    currentQueue.forEach(item => {
                        const isDuplicate = failedItems.some(f => f.timestamp === item.timestamp && f.name === item.name);
                        if (!isDuplicate) {
                            mergedQueue.push(item);
                        }
                    });
                    
                    localStorage.setItem('asthros_queue', JSON.stringify(mergedQueue.slice(-5)));
                } catch (e) {
                    localStorage.setItem('asthros_queue', JSON.stringify(failedItems.slice(-5)));
                }
            } else {
                try {
                    // Limpa apenas os leads que foram enviados com sucesso, mantendo novos leads que entraram no meio do caminho
                    const currentQueue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
                    const remainingQueue = currentQueue.filter(item => 
                        !queue.some(q => q.timestamp === item.timestamp && q.name === item.name)
                    );
                    
                    if (remainingQueue.length > 0) {
                        localStorage.setItem('asthros_queue', JSON.stringify(remainingQueue.slice(-5)));
                    } else {
                        localStorage.removeItem('asthros_queue');
                        localStorage.removeItem('asthros_queue_last_try');
                    }
                } catch (e) {
                    localStorage.removeItem('asthros_queue');
                    localStorage.removeItem('asthros_queue_last_try');
                }
            }
        } catch (err) {
        } finally {
            isFlushing = false;
            localStorage.removeItem(lockKey);
        }
    }

    function saveUtmsToStorageAndJourney() {
        try {
            const utmsToSave = parseUtmsFromUrl();
            const hasNewUtms = Object.keys(utmsToSave).length > 0;

            // 1. Gravar referrer e UTMs na sessão
            if (!sessionStorage.getItem('asthros_referrer')) {
                sessionStorage.setItem('asthros_referrer', document.referrer || 'direto');
            }
            if (hasNewUtms) {
                sessionStorage.setItem('asthros_utms', JSON.stringify(utmsToSave));
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
                if (localStorage.getItem('asthros_journey')) return;
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
                
                // Exit intent: enriquece o último touchpoint com dados de saída
                try {
                    const journey = getJourneyContext();
                    if (journey.length > 0) {
                        journey[journey.length - 1].exit_scroll = maxScroll + '%';
                        journey[journey.length - 1].exit_time = getActiveTimeOnPage();
                        localStorage.setItem('asthros_journey', JSON.stringify(journey));
                    }
                } catch (e) {}
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
        const handleRoutePopstate = () => {
            saveUtmsToStorageAndJourney();
            resetPageContext();
        };

        window.addEventListener('popstate', handleRoutePopstate);

        let lastHref = location.href;
        const spaInterval = setInterval(() => {
            if (location.href !== lastHref) {
                lastHref = location.href;
                saveUtmsToStorageAndJourney();
                resetPageContext();
            }
        }, 500);

        // Expõe uma função de limpeza global (boa prática de ciclo de vida)
        window._asthrosCleanup = () => {
            clearInterval(spaInterval);
            window.removeEventListener('popstate', handleRoutePopstate);
        };
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
        
        // 1. Tenta obter da URL atual (query ou hash)
        const urlUtms = parseUtmsFromUrl();
        const hasUrlUtms = Object.keys(urlUtms).length > 0;
        if (hasUrlUtms) {
            utms = urlUtms;
        }

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
            // A detecção de Android DEVE vir antes de Linux, pois dispositivos Android também contém 'Linux' no User Agent
            os: /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro',
            is_mobile: /Mobi|Android/i.test(ua),
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            user_agent: ua
        };
    }

    function getSessionId() {
        try {
            let sessionId = sessionStorage.getItem('asthros_session_id');
            if (!sessionId) {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    sessionId = crypto.randomUUID();
                } else {
                    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                }
                sessionStorage.setItem('asthros_session_id', sessionId);
            }
            return sessionId;
        } catch (e) {
            return 'temp_' + Math.random().toString(36).substring(2, 10);
        }
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
        const className = (typeof link.className === 'string' ? link.className : link.getAttribute('class') || '').toLowerCase();
        
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
                try {
                    if (selector && link.matches(selector)) {
                        return { source: 'custom_tracker', label: `Selector: ${selector}` };
                    }
                } catch (e) {}
            }
        }

        return null;
    }

    function trackLead(e) {
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
            session_fingerprint: getSessionId(),
            marketing: buildMarketingContext(),
            behavior: {
                time_on_page: getActiveTimeOnPage(),
                scroll_depth: maxScroll + '%',
                // Precedência de captura: innerText -> aria-label -> correspondência de rastreamento (funciona como fallback se innerText for undefined/vazio em SVGs/elementos ocultos)
                button_text: sanitizeButtonText(link.innerText || link.getAttribute('aria-label') || trackerMatch.label),
                match_type: trackerMatch.label,
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: new Date().toISOString()
        };

        sendPayload(payload);
    }

    // 4. Captura Inteligente de Formulários no Frontend (Opcional)
    function trackFormSubmit(e) {
        try {
            const form = e.target;
            
            // Proteção contra duplo submit do mesmo formulário
            if (trackingLocks.has(form)) return;
            trackingLocks.add(form);
            setTimeout(() => { trackingLocks.delete(form); }, 3000);

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
                    session_fingerprint: getSessionId(),
                    marketing: buildMarketingContext(),
                    behavior: {
                        time_on_page: getActiveTimeOnPage(),
                        scroll_depth: maxScroll + '%',
                        button_text: sanitizeButtonText(form.querySelector('[type="submit"]')?.innerText || 'Enviar Formulário'),
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

