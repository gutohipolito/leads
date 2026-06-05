(function() {
    // console.log('%c[Asthros] Iniciando depuração do rastreador...', 'color: #56d7fd; font-weight: bold;');

    // 1. Busca de Configuração
    let config = window.AsthrosConfig || null;

    if (config) {
        // Compatibilidade com configurações antigas em window.AsthrosConfig
        config.webhookId = config.webhookId || config.secret;
    }

    if (!config) {
        let script = document.currentScript;
        
        if (!script) {
            // Se currentScript for nulo (async/defer/GTM), busca scripts que ainda não foram marcados como inicializados
            const candidates = document.querySelectorAll(
                'script[src*="tracker.js"]:not([data-asthros-initialized]), ' +
                'script[src*="tracker.min.js"]:not([data-asthros-initialized])'
            );
            if (candidates.length > 0) {
                script = candidates[0];
            }
        }
        
        if (script) {
            // Marca o script atual para que outras execuções assíncronas concorrentes de múltiplos scripts não o selecionem
            try {
                script.setAttribute('data-asthros-initialized', 'true');
            } catch (e) {}

            config = {
                clientId: script.getAttribute('data-client-id'),
                webhookId: script.getAttribute('data-webhook-id') || script.getAttribute('data-secret'),
                secret: script.getAttribute('data-secret'),
                apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br',
                trackKeywords: script.getAttribute('data-keywords') ? script.getAttribute('data-keywords').split(',') : [],
                trackSelectors: script.getAttribute('data-selectors') ? script.getAttribute('data-selectors').split(',') : []
            };
        }
    }

    if (!config || !config.clientId || !config.webhookId) {
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

    function generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback robusto usando Math.random
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function randomId() {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' && typeof Uint8Array !== 'undefined') {
            try {
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                return Array.from(arr)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } catch (e) {}
        }
        // Fallback robusto usando Math.random se crypto não estiver disponível
        return 'temp_' + Math.random().toString(36).substring(2, 18);
    }

    const STORAGE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 dias

    function setLocalItem(key, value) {
        try {
            const item = {
                value: value,
                expiry: Date.now() + STORAGE_TTL
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {}
    }

    function getLocalItem(key) {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            const item = JSON.parse(itemStr);
            if (item && typeof item === 'object' && 'expiry' in item) {
                if (Date.now() > item.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                return item.value;
            }
            return itemStr;
        } catch (e) {
            try {
                return localStorage.getItem(key);
            } catch (err) {
                return null;
            }
        }
    }

    function removeLocalItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }


    const trackingLocks = new Set();

    // Controle de tempo ativo na página e scroll máximo (Page Visibility API e Reset em SPAs)
    let totalActive = 0;
    let lastVisible = Date.now();
    let maxScroll = 0;

    try {
        if (!getLocalItem('asthros_first_seen')) {
            setLocalItem('asthros_first_seen', Date.now().toString());
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                totalActive += Date.now() - lastVisible;
                
                // Exit intent: enriquece o último touchpoint com dados de saída
                try {
                    const lastTouchStr = getLocalItem('asthros_last_touch');
                    if (lastTouchStr) {
                        const lastTouch = typeof lastTouchStr === 'string' ? JSON.parse(lastTouchStr) : lastTouchStr;
                        lastTouch.exit_scroll = maxScroll + '%';
                        lastTouch.exit_time = getActiveTimeOnPage();
                        setLocalItem('asthros_last_touch', lastTouch);
                    } else {
                        const firstTouchStr = getLocalItem('asthros_first_touch');
                        if (firstTouchStr) {
                            const firstTouch = typeof firstTouchStr === 'string' ? JSON.parse(firstTouchStr) : firstTouchStr;
                            firstTouch.exit_scroll = maxScroll + '%';
                            firstTouch.exit_time = getActiveTimeOnPage();
                            setLocalItem('asthros_first_touch', firstTouch);
                        }
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
            const rawPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
            const scrollPercent = Math.min(100, Math.round(rawPercent));
            if (scrollPercent > maxScroll) maxScroll = scrollPercent;
        } catch (e) {}
    }, { passive: true });

    // Suporte a SPAs (React, Next.js, Vue) - Interceptação de navegação por History API (event-driven, sem polling)
    try {
        const handleRouteChange = () => {
            saveUtmsToStorageAndJourney();
            resetPageContext();
        };

        window.addEventListener('popstate', handleRouteChange);

        // Intercepta pushState e replaceState para detectar navegações programáticas em qualquer framework
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            originalPushState.apply(this, arguments);
            handleRouteChange();
        };

        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            handleRouteChange();
        };

        // Expõe uma função de limpeza global (restaura os métodos originais do History API)
        window._asthrosCleanup = () => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', handleRouteChange);
        };
    } catch (e) {}

    // Cache do contexto de dispositivo — os dados são praticamente estáticos e não precisam ser recalculados a cada lead
    const cachedDeviceContext = (function() {
        const ua = navigator.userAgent;
        return {
            platform: navigator.platform, // Mantido para compatibilidade histórica do banco
            // A detecção de Android DEVE vir antes de Linux, pois dispositivos Android também contém 'Linux' no User Agent
            os: /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro',
            is_mobile: /Mobi|Android/i.test(ua),
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            user_agent: ua
        };
    })();

    function getDeviceContext() {
        return {
            ...cachedDeviceContext,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    function getSessionId() {
        try {
            let sessionId = sessionStorage.getItem('asthros_session_id');
            if (!sessionId) {
                sessionId = generateUUID();
                sessionStorage.setItem('asthros_session_id', sessionId);
            }
            return sessionId;
        } catch (e) {
            return 'temp_' + randomId();
        }
    }

    function getVisitorId() {
        try {
            let visitorId = getLocalItem('asthros_visitor_id');
            if (!visitorId) {
                visitorId = generateUUID();
                setLocalItem('asthros_visitor_id', visitorId);
            }
            return visitorId;
        } catch (e) {
            return 'temp_' + randomId();
        }
    }

    function getConversionTime() {
        try {
            const firstSeen = getLocalItem('asthros_first_seen');
            if (firstSeen) {
                const diffMs = Date.now() - parseInt(firstSeen, 10);
                return Math.max(0, Math.round(diffMs / 1000));
            }
        } catch (e) {}
        return 0;
    }


    function parseUtmsFromUrl() {
        const utms = {};
        try {
            const queryParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash || '';
            const hashQueryPart = hash.includes('?') 
                ? hash.split('?')[1]          // hash com query: #/page?utm_source=...
                : (hash.includes('utm_') || hash.includes('gclid') || hash.includes('fbclid') || hash.includes('ttclid') || hash.includes('msclkid'))
                    ? hash.replace(/^#\/?/, '') // hash direto com parâmetros rastreáveis
                    : '';                        // âncora normal: #secao — ignora
            const hashParams = new URLSearchParams(hashQueryPart);

            // 1. Capturar UTMs clássicas
            ['source', 'medium', 'campaign', 'term', 'content'].forEach(key => {
                const valQuery = queryParams.get(`utm_${key}`);
                const valHash = hashParams.get(`utm_${key}`);
                const val = valQuery || valHash;
                if (val) {
                    utms[key] = val;
                }
            });

            // 2. Capturar Ad Click IDs modernos
            ['gclid', 'fbclid', 'ttclid', 'msclkid'].forEach(key => {
                const valQuery = queryParams.get(key);
                const valHash = hashParams.get(key);
                const val = valQuery || valHash;
                if (val) {
                    utms[key] = val;
                }
            });

            // 3. Atribuição inteligente se faltar source/medium mas tiver Click ID
            if (!utms.source) {
                if (utms.gclid) {
                    utms.source = 'google';
                    utms.medium = utms.medium || 'cpc';
                } else if (utms.fbclid) {
                    utms.source = 'facebook';
                    utms.medium = utms.medium || 'cpc';
                } else if (utms.ttclid) {
                    utms.source = 'tiktok';
                    utms.medium = utms.medium || 'cpc';
                } else if (utms.msclkid) {
                    utms.source = 'bing';
                    utms.medium = utms.medium || 'cpc';
                }
            }
        } catch (e) {}
        return utms;
    }

    function saveUtmsToStorageAndJourney() {
        try {
            trackPageVisit();
            const utmsToSave = parseUtmsFromUrl();
            const hasNewUtms = Object.keys(utmsToSave).length > 0;

            // 1. Gravar referrer e UTMs na sessão
            if (!sessionStorage.getItem('asthros_referrer')) {
                sessionStorage.setItem('asthros_referrer', document.referrer || 'direto');
            }
            if (hasNewUtms) {
                sessionStorage.setItem('asthros_utms', JSON.stringify(utmsToSave));
            }

            // 2. Gravar o Touchpoint na jornada (Atribuição Multitouch Otimizada - Limite de 5 itens)
            const referrer = document.referrer || 'direto';
            const sourceFromRef = getSourceFromReferrer(referrer);
            let touchpointSource = 'direto';

            if (hasNewUtms) {
                touchpointSource = utmsToSave.source;
            } else if (sourceFromRef !== 'direto') {
                touchpointSource = sourceFromRef;
            } else {
                // Se for visita direta pura, registramos apenas se o primeiro toque estiver vazio
                if (getLocalItem('asthros_first_touch')) return;
            }

            const touchpoint = {
                source: touchpointSource,
                medium: utmsToSave.medium || (hasNewUtms ? 'cpc' : (sourceFromRef !== 'direto' ? 'referência' : 'direto')),
                campaign: utmsToSave.campaign || 'N/A',
                timestamp: new Date().toISOString(),
                page_url: window.location.href,
                page_title: document.title
            };

            const firstTouchVal = getLocalItem('asthros_first_touch');
            const firstTouch = typeof firstTouchVal === 'string' ? JSON.parse(firstTouchVal) : firstTouchVal;
            if (!firstTouch) {
                // Primeiro toque na jornada
                setLocalItem('asthros_first_touch', touchpoint);
                setLocalItem('asthros_journey', [touchpoint]);
                setLocalItem('asthros_journey_length', '1');
            } else {
                // Toques subsequentes: verifica duplicidade com o último toque salvo
                let lastTouch = null;
                try {
                    const lastTouchVal = getLocalItem('asthros_last_touch');
                    lastTouch = lastTouchVal ? (typeof lastTouchVal === 'string' ? JSON.parse(lastTouchVal) : lastTouchVal) : firstTouch;
                } catch (e) {}

                if (lastTouch) {
                    const diff = Date.now() - new Date(lastTouch.timestamp).getTime();
                    const isSameUrl = lastTouch.page_url === touchpoint.page_url;
                    // Evitar gravar múltiplos cliques/visitas seguidos no mesmo canal e na mesma página em menos de 5 min
                    if (lastTouch.source === touchpoint.source && diff < 5 * 60 * 1000 && isSameUrl) {
                        return;
                    }
                }

                setLocalItem('asthros_last_touch', touchpoint);
                
                let length = 1;
                try {
                    const lengthVal = getLocalItem('asthros_journey_length');
                    length = parseInt(lengthVal || '1', 10);
                } catch (e) {}
                setLocalItem('asthros_journey_length', (length + 1).toString());

                // Atualizar jornada mantendo no máximo os últimos 5 elementos
                let journey = [];
                try {
                    const storedJourney = getLocalItem('asthros_journey');
                    if (storedJourney) {
                        const parsed = typeof storedJourney === 'string' ? JSON.parse(storedJourney) : storedJourney;
                        if (Array.isArray(parsed)) {
                            journey = parsed;
                        }
                    }
                } catch (e) {}

                if (journey.length === 0) {
                    journey.push(firstTouch);
                }

                journey.push(touchpoint);
                if (journey.length > 5) {
                    journey = journey.slice(-5);
                }
                setLocalItem('asthros_journey', journey);
            }
        } catch (e) {}
    }

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

    function getReferrerContext() {
        try {
            return sessionStorage.getItem('asthros_referrer') || document.referrer || 'direto';
        } catch (e) {
            return document.referrer || 'direto';
        }
    }

    function getJourneyContext() {
        try {
            const j = getLocalItem('asthros_journey');
            if (j) {
                const parsed = typeof j === 'string' ? JSON.parse(j) : j;
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        
        // Fallback para primeiro toque se a jornada não existir/for inválida
        try {
            const ft = getLocalItem('asthros_first_touch');
            if (ft) {
                return [typeof ft === 'string' ? JSON.parse(ft) : ft];
            }
        } catch (e) {}
        return [];
    }

    function trackPageVisit() {
        try {
            const pathname = window.location.pathname || '/';
            let visited = [];
            const stored = getLocalItem('asthros_pages_visited');
            if (stored) {
                visited = typeof stored === 'string' ? JSON.parse(stored) : stored;
            }
            if (!Array.isArray(visited)) {
                visited = [];
            }
            // Evita registrar a mesma página se ela for idêntica à última registrada (ex: recarregamentos)
            if (visited.length === 0 || visited[visited.length - 1] !== pathname) {
                visited.push(pathname);
                if (visited.length > 10) {
                    visited = visited.slice(-10);
                }
                setLocalItem('asthros_pages_visited', visited);
            }
        } catch (e) {}
    }

    function getPagesVisitedContext() {
        try {
            const stored = getLocalItem('asthros_pages_visited');
            if (stored) {
                const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [window.location.pathname || '/'];
    }

    function buildMarketingContext() {
        let firstTouch = null;
        let lastTouch = null;
        let journeyLength = 1;
        try {
            const ftVal = getLocalItem('asthros_first_touch');
            if (ftVal) firstTouch = typeof ftVal === 'string' ? JSON.parse(ftVal) : ftVal;

            const ltVal = getLocalItem('asthros_last_touch');
            if (ltVal) lastTouch = typeof ltVal === 'string' ? JSON.parse(ltVal) : ltVal;

            const jlVal = getLocalItem('asthros_journey_length');
            journeyLength = parseInt(jlVal || '1', 10);
        } catch (e) {}

        return {
            ...getUtms(),
            referrer: getReferrerContext(),
            page_title: document.title,
            page_url: window.location.href,
            first_touch: firstTouch,
            last_touch: lastTouch,
            journey_length: journeyLength,
            journey: getJourneyContext(),
            pages_visited: getPagesVisitedContext()
        };
    }


    function queueFailedLead(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('asthros_queue', JSON.stringify(queue.slice(-5))); // max 5
        } catch (e) {}
    }

    async function sendPayload(payload) {
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        
        // Beacon apenas no fechamento
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...payload };
            if (config.webhookId) {
                beaconPayload.webhookId = config.webhookId;
            }
            if (config.secret) {
                beaconPayload.secret = config.secret;
            }
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

        const safePayload = { ...payload };
        if (config.webhookId) {
            safePayload.webhookId = config.webhookId;
        }

        try {
            const headers = { 
                'Content-Type': 'application/json'
            };
            if (config.webhookId) {
                headers['X-Asthros-Webhook-Id'] = config.webhookId;
            }
            if (config.secret) {
                headers['X-Asthros-Secret'] = config.secret;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
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
    let asthrosChannel = null;
    let flushSafetyTimeout = null;

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            asthrosChannel = new BroadcastChannel('asthros_channel');
            asthrosChannel.onmessage = (event) => {
                if (event.data) {
                    if (event.data.action === 'flush_start') {
                        isFlushing = true;
                        if (flushSafetyTimeout) clearTimeout(flushSafetyTimeout);
                        flushSafetyTimeout = setTimeout(() => {
                            isFlushing = false;
                        }, 20000); // 20 segundos de segurança
                    } else if (event.data.action === 'flush_end') {
                        isFlushing = false;
                        if (flushSafetyTimeout) clearTimeout(flushSafetyTimeout);
                    }
                }
            };
        } catch (e) {}
    }

    async function executeFlush() {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            if (!queue.length) return;

            // Só tenta reenviar se tiver passado mais de 1 minuto desde a última tentativa
            const lastTry = parseInt(localStorage.getItem('asthros_queue_last_try') || '0');
            if (Date.now() - lastTry < 60 * 1000) {
                return;
            }

            isFlushing = true;
            if (asthrosChannel) {
                try {
                    asthrosChannel.postMessage({ action: 'flush_start' });
                } catch (e) {}
            }
            localStorage.setItem('asthros_queue_last_try', Date.now().toString());

            const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
            const failedItems = [];

            for (const payload of queue) {
                try {
                    const headers = { 
                        'Content-Type': 'application/json'
                    };
                    if (config.webhookId) {
                        headers['X-Asthros-Webhook-Id'] = config.webhookId;
                    }
                    if (config.secret) {
                        headers['X-Asthros-Secret'] = config.secret;
                    }

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: headers,
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
                        const isDuplicate = failedItems.some(f => 
                            (f.lead_id && f.lead_id === item.lead_id) || 
                            (!f.lead_id && f.timestamp === item.timestamp && f.name === item.name)
                        );
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
                        !queue.some(q => 
                            (q.lead_id && q.lead_id === item.lead_id) || 
                            (!q.lead_id && q.timestamp === item.timestamp && q.name === item.name)
                        )
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
            if (asthrosChannel) {
                try {
                    asthrosChannel.postMessage({ action: 'flush_end' });
                } catch (e) {}
            }
            if (flushSafetyTimeout) {
                clearTimeout(flushSafetyTimeout);
            }
        }
    }

    async function flushQueue() {
        if (isFlushing) return;

        // Se o navegador suportar Web Locks API, usamos o lock atômico nativo (concorrência perfeita multi-abas)
        if (navigator.locks) {
            try {
                await navigator.locks.request('asthros_flush_lock', { ifAvailable: true }, async (lock) => {
                    if (!lock) return; // Outra aba já está processando
                    await executeFlush();
                });
                return;
            } catch (e) {}
        }

        // Fallback: Lock baseado em localStorage aprimorado com ID único e delay de verificação para atomicidade artificial
        const lockKey = 'asthros_flush_lock';
        const myTabId = randomId();

        try {
            const existingLock = localStorage.getItem(lockKey);
            if (existingLock) {
                const parts = existingLock.split(':');
                const lockTime = parseInt(parts[1] || '0');
                if (Date.now() - lockTime < 10000) {
                    return; // Outra aba tem um lock válido e ativo
                }
            }

            const lockValue = `${myTabId}:${Date.now()}`;
            localStorage.setItem(lockKey, lockValue);

            // Pequeno delay para verificar se outra aba concorrente gravou por cima
            await new Promise(function(resolve) { setTimeout(resolve, 50); });

            const currentLock = localStorage.getItem(lockKey);
            if (currentLock !== lockValue) {
                return; // Perdemos a disputa de concorrência
            }

            await executeFlush();
        } catch (e) {
        } finally {
            // Só remove o lock se ele ainda for nosso (evita remover locks de outras abas)
            try {
                const finalLock = localStorage.getItem(lockKey);
                if (finalLock && finalLock.startsWith(myTabId)) {
                    localStorage.removeItem(lockKey);
                }
            } catch (e) {}
        }
    }


    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        const matches = /wa\.me|wa\.link|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/.test(lowerUrl);
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
        const link = e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('[class*="whatsapp"]') || e.target.closest('[class*="wpp"]') || e.target.closest('[id*="whatsapp"]') || e.target.closest('[id*="wpp"]');
        if (!link) return;

        const trackerMatch = getTrackingMatch(link);
        if (!trackerMatch) {
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link comum ignorado:', link.href);
            }
            return;
        }

        // Proteção contra duplo clique e race condition de envio por elemento (resistente a re-renders em React/Vue)
        const rect = link.getBoundingClientRect();
        const docTop = Math.round(rect.top + (window.scrollY || window.pageYOffset || 0));
        const docLeft = Math.round(rect.left + (window.scrollX || window.pageXOffset || 0));

        const lockKey = [
            'click',
            link.id || '',
            docTop,
            docLeft,
            link.tagName,
            link.href || '',
            link.innerText || link.getAttribute('aria-label') || ''
        ].join('|');

        if (trackingLocks.has(lockKey)) return;
        trackingLocks.add(lockKey);
        setTimeout(() => { trackingLocks.delete(lockKey); }, 2000);

        // console.log(`%c[Asthros] CAPTURANDO LEAD (${trackerMatch.label})!`, 'color: #56d7fd; font-weight: bold;');

        const payload = {
            lead_id: generateUUID(),
            source: trackerMatch.source,
            name: 'Lead Identificado via ' + trackerMatch.label,
            session_fingerprint: getSessionId(),
            visitor_id: getVisitorId(),
            marketing: buildMarketingContext(),
            behavior: {
                time_on_page: getActiveTimeOnPage(),
                scroll_depth: maxScroll + '%',
                // Precedência de captura: innerText -> aria-label -> correspondência de rastreamento (funciona como fallback se innerText for undefined/vazio em SVGs/elementos ocultos)
                button_text: sanitizeButtonText(link.innerText || link.getAttribute('aria-label') || trackerMatch.label),
                match_type: trackerMatch.label,
                conversion_time_seconds: getConversionTime(),
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: new Date().toISOString()
        };

        sendPayload(payload);
    }

    // 4. Captura Inteligente de Formulários no Frontend (Opcional)
    function captureFormLead(form, matchType) {
        try {
            // Proteção contra duplo submit do mesmo formulário (resistente a re-renders em React/Vue)
            const lockKey = [
                'form',
                form.action || '',
                form.id || '',
                form.className || ''
            ].join('|');

            if (trackingLocks.has(lockKey)) return;
            trackingLocks.add(lockKey);
            setTimeout(() => { trackingLocks.delete(lockKey); }, 3000);

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
                
                if (nameAttr.includes('name') || nameAttr.includes('nome') || nameAttr.includes('fullname') || nameAttr.includes('full_name') || nameAttr.includes('cliente') || nameAttr.includes('contato')) {
                    leadName = cleanValue;
                } else if (nameAttr.includes('email') || nameAttr.includes('e-mail') || nameAttr.includes('mail') || nameAttr.includes('correo') || input.type === 'email') {
                    leadEmail = cleanValue;
                } else if (nameAttr.includes('phone') || nameAttr.includes('tel') || nameAttr.includes('whats') || nameAttr.includes('cel') || nameAttr.includes('telefone') || nameAttr.includes('celular') || nameAttr.includes('mobile') || input.type === 'tel') {
                    leadPhone = cleanValue;
                } else {
                    formDataFields[input.name || input.id] = cleanValue;
                }
            });
            
            // Validação robusta do formato do e-mail capturado (exige local-part com 2+ chars, domínio válido e TLD de 2-10 chars)
            if (leadEmail && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(leadEmail)) {
                leadEmail = '';
            }
            
            if (leadName && (leadEmail || leadPhone)) {
                const payload = {
                    lead_id: generateUUID(),
                    source: 'form',
                    name: leadName,
                    email: leadEmail,
                    phone: leadPhone,
                    fields: formDataFields,
                    session_fingerprint: getSessionId(),
                    visitor_id: getVisitorId(),
                    marketing: buildMarketingContext(),
                    behavior: {
                        time_on_page: getActiveTimeOnPage(),
                        scroll_depth: maxScroll + '%',
                        button_text: sanitizeButtonText(form.querySelector('[type="submit"]')?.innerText || 'Enviar Formulário'),
                        match_type: matchType,
                        conversion_time_seconds: getConversionTime()
                    },
                    device: getDeviceContext(),
                    timestamp: new Date().toISOString()
                };
                
                sendPayload(payload);
            }
        } catch (err) {}
    }

    function trackFormSubmit(e) {
        try {
            const form = e.target;
            
            // Se for Contact Form 7 ou Elementor (que possuem AJAX próprio), ignoramos o submit imediato
            // e aguardamos o evento de sucesso específico para evitar capturar leads inválidos/falsos.
            if (form.classList.contains('wpcf7-form') || 
                form.closest('.elementor-form') || 
                form.getAttribute('data-asthros-ajax') === 'true') {
                return;
            }

            captureFormLead(form, 'Auto-captura de Formulário');
        } catch (err) {}
    }

    document.addEventListener('click', trackLead, { capture: true });

    // Habilita a escuta de formulários apenas se configurado explicitamente autoTrackForms: true
    if (config.autoTrackForms === true || config.autoTrackForms === 'true') {
        document.addEventListener('submit', trackFormSubmit, { capture: true });
    }

    // Ouvinte de sucesso para o Contact Form 7 (Nativo)
    document.addEventListener('wpcf7mailsent', function(event) {
        try {
            const form = event.target;
            if (form) {
                captureFormLead(form, 'Contact Form 7 (Sucesso AJAX)');
            }
        } catch (e) {}
    }, false);

    // Ouvinte alternativo do Contact Form 7 para quando não dispara e-mail (status 'skipped' ou 'mail_sent')
    document.addEventListener('wpcf7submit', function(event) {
        try {
            const form = event.target;
            const status = event.detail && event.detail.status;
            if (form && (status === 'mail_sent' || status === 'skipped')) {
                captureFormLead(form, 'Contact Form 7 (Sucesso Submit)');
            }
        } catch (e) {}
    }, false);


    // Ouvinte nativo (Vanilla JS) para versões modernas do Elementor
    try {
        document.addEventListener('submit_success', function(event) {
            const form = event.target;
            if (form) {
                captureFormLead(form, 'Elementor Forms (Nativo AJAX)');
            }
        });
    } catch (e) {}

    // Ouvinte de sucesso para o Elementor Forms (Via jQuery se estiver na página)
    try {
        if (typeof jQuery !== 'undefined') {
            // 1. Ouvinte clássico via evento submit_success do jQuery
            jQuery(document).on('submit_success', function(event) {
                const form = event.target || document.querySelector('.elementor-form');
                if (form) {
                    captureFormLead(form, 'Elementor Forms (submit_success)');
                }
            });

            // 2. Ouvinte avançado via ajaxComplete para interceptar o Ajax Handler interno
            jQuery(document).ajaxComplete(function(event, xhr, settings) {
                try {
                    if (settings.data && settings.data.indexOf('action=elementor_pro_forms_send_form') !== -1) {
                        const response = xhr.responseJSON;
                        if (response && response.success) {
                            // Parsear os parâmetros enviados no corpo da requisição AJAX
                            const params = {};
                            const pairs = settings.data.split('&');
                            for (let i = 0; i < pairs.length; i++) {
                                const pair = pairs[i].split('=');
                                const key = decodeURIComponent(pair[0]);
                                const val = decodeURIComponent(pair[1] || '');
                                if (key) params[key] = val;
                            }

                            // Evitar duplo disparo se já capturamos por outro método
                            const formId = params.form_id;
                            const leadEmail = params['form_fields[email]'] || params['form_fields[e-mail]'] || params['form_fields[mail]'] || params['form_fields[correo]'] || '';
                            const leadPhone = params['form_fields[phone]'] || params['form_fields[tel]'] || params['form_fields[whats]'] || params['form_fields[cel]'] || params['form_fields[telefone]'] || params['form_fields[celular]'] || params['form_fields[mobile]'] || '';
                            
                            const lockKey = 'ajax_form|' + (formId || '') + '|' + (leadEmail || leadPhone || '');
                            if (trackingLocks.has(lockKey)) return;
                            trackingLocks.add(lockKey);
                            setTimeout(() => { trackingLocks.delete(lockKey); }, 3000);

                            // Tenta encontrar o formulário no DOM pelo form_id enviado
                            let form = null;
                            if (formId) {
                                form = document.querySelector('input[name="form_id"][value="' + formId + '"]')?.closest('form');
                            }
                            if (!form) {
                                form = document.querySelector('.elementor-form');
                            }

                            if (form) {
                                captureFormLead(form, 'Elementor Forms (AJAX Handler)');
                            } else {
                                // Fallback: se o form já foi destruído no DOM (ex: popup fechou rápido demais)
                                // extraímos os dados diretamente do settings.data
                                let leadName = '';
                                let extractedEmail = '';
                                let extractedPhone = '';
                                const formDataFields = {};

                                for (const key in params) {
                                    if (key.indexOf('form_fields[') === 0) {
                                        const fieldNameMatch = key.match(/form_fields\[(.*?)\]/);
                                        if (fieldNameMatch && fieldNameMatch[1]) {
                                            const fieldName = fieldNameMatch[1];
                                            const val = params[key].trim();
                                            if (!val) continue;
                                            const cleanValue = sanitize(val);
                                            const lowerFieldName = fieldName.toLowerCase();
                                            
                                            if (lowerFieldName.includes('name') || lowerFieldName.includes('nome') || lowerFieldName.includes('fullname') || lowerFieldName.includes('full_name') || lowerFieldName.includes('cliente') || lowerFieldName.includes('contato')) {
                                                leadName = cleanValue;
                                            } else if (lowerFieldName.includes('email') || lowerFieldName.includes('e-mail') || lowerFieldName.includes('mail') || lowerFieldName.includes('correo')) {
                                                extractedEmail = cleanValue;
                                            } else if (lowerFieldName.includes('phone') || lowerFieldName.includes('tel') || lowerFieldName.includes('whats') || lowerFieldName.includes('cel') || lowerFieldName.includes('telefone') || lowerFieldName.includes('celular') || lowerFieldName.includes('mobile')) {
                                                extractedPhone = cleanValue;
                                            } else {
                                                formDataFields[fieldName] = cleanValue;
                                            }
                                        }
                                    }
                                }

                                if (extractedEmail && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(extractedEmail)) {
                                    extractedEmail = '';
                                }

                                if (leadName && (extractedEmail || extractedPhone)) {
                                    const payload = {
                                        lead_id: generateUUID(),
                                        source: 'form',
                                        name: leadName,
                                        email: extractedEmail,
                                        phone: extractedPhone,
                                        fields: formDataFields,
                                        session_fingerprint: getSessionId(),
                                        visitor_id: getVisitorId(),
                                        marketing: buildMarketingContext(),
                                        behavior: {
                                            time_on_page: getActiveTimeOnPage(),
                                            scroll_depth: maxScroll + '%',
                                            button_text: 'Enviar Formulário (Popup/AJAX)',
                                            match_type: 'Elementor Forms (AJAX Fallback)',
                                            conversion_time_seconds: getConversionTime()
                                        },
                                        device: getDeviceContext(),
                                        timestamp: new Date().toISOString()
                                    };
                                    sendPayload(payload);
                                }
                            }
                        }
                    }
                } catch (err) {}
            });
        }
    } catch (e) {}

    // Exposição da API Pública Global para desenvolvedores
    function manualTrackLead(data) {
        try {
            if (!data) return;
            const payload = {
                lead_id: generateUUID(),
                source: 'manual',
                name: sanitize(data.name || data.nome || data.fullname || data.full_name || data.cliente || data.contato || 'Lead Manual'),
                email: sanitize(data.email || data.e_mail || data.mail || data.correo),
                phone: sanitize(data.phone || data.telefone || data.whatsapp || data.celular || data.mobile || data.whats || data.cel || data.tel),
                fields: data.fields || {},
                session_fingerprint: getSessionId(),
                visitor_id: getVisitorId(),
                marketing: buildMarketingContext(),
                behavior: {
                    time_on_page: getActiveTimeOnPage(),
                    scroll_depth: maxScroll + '%',
                    match_type: 'Disparo Manual (API)',
                    conversion_time_seconds: getConversionTime()
                },
                device: getDeviceContext(),
                timestamp: new Date().toISOString()
            };
            
            if (payload.email && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(payload.email)) {
                payload.email = '';
            }
            
            sendPayload(payload);
        } catch (e) {}
    }

    window.Asthros = window.Asthros || {};
    window.Asthros.trackLead = manualTrackLead;
    window.Asthros.trackForm = function(formElement) {
        if (formElement && formElement.tagName === 'FORM') {
            captureFormLead(formElement, 'Disparo Manual de Formulário (API)');
        }
    };


    // Tenta esvaziar a fila de reenvio offline na inicialização
    flushQueue();
    // console.log('%c[Asthros] Escuta de eventos ativada com sucesso!', 'color: #25d366;');
})();


