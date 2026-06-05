    function parseUtmsFromUrl() {
        const utms = {};
        try {
            const queryParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash || '';
            const hashQueryPart = hash.includes('?') 
                ? hash.split('?')[1]          // hash com query: #/page?utm_source=...
                : (hash.includes('utm_') || hash.includes('gclid') || hash.includes('fbclid') || hash.includes('ttclid') || hash.includes('msclkid') || hash.includes('gbraid') || hash.includes('wbraid') || hash.includes('li_fat_id') || hash.includes('twclid'))
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
            ['gclid', 'fbclid', 'ttclid', 'msclkid', 'gbraid', 'wbraid', 'li_fat_id', 'twclid'].forEach(key => {
                const valQuery = queryParams.get(key);
                const valHash = hashParams.get(key);
                const val = valQuery || valHash;
                if (val) {
                    utms[key] = val;
                }
            });

            // 3. Atribuição inteligente se faltar source/medium mas tiver Click ID
            if (!utms.source) {
                if (utms.gclid || utms.gbraid || utms.wbraid) {
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
                } else if (utms.li_fat_id) {
                    utms.source = 'linkedin';
                    utms.medium = utms.medium || 'cpc';
                } else if (utms.twclid) {
                    utms.source = 'twitter';
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
                const firstTouchTouchpoint = {
                    ...touchpoint,
                    landing_page: window.location.href
                };
                setLocalItem('asthros_first_touch', firstTouchTouchpoint);
                setLocalItem('asthros_journey', [firstTouchTouchpoint]);
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
            const title = document.title || '';
            const ts = new Date().toISOString();

            let visited = [];
            const stored = getLocalItem('asthros_pages_visited');
            if (stored) {
                visited = typeof stored === 'string' ? JSON.parse(stored) : stored;
            }
            if (!Array.isArray(visited)) {
                visited = [];
            }
            
            // Evita registrar a mesma página se ela for idêntica à última registrada
            const lastPage = visited[visited.length - 1];
            const isSamePath = lastPage && typeof lastPage === 'object' && lastPage.path === pathname;
            const isSamePathLegacy = lastPage && typeof lastPage === 'string' && lastPage === pathname;

            if (visited.length === 0 || (!isSamePath && !isSamePathLegacy)) {
                visited.push({
                    path: pathname,
                    title: title,
                    ts: ts
                });
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
        return [{
            path: window.location.pathname || '/',
            title: document.title || '',
            ts: new Date().toISOString()
        }];
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
