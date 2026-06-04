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
                if (localStorage.getItem('asthros_first_touch')) return;
            }

            const touchpoint = {
                source: touchpointSource,
                medium: utmsToSave.medium || (hasNewUtms ? 'cpc' : (sourceFromRef !== 'direto' ? 'referência' : 'direto')),
                campaign: utmsToSave.campaign || 'N/A',
                timestamp: new Date().toISOString(),
                page_url: window.location.href,
                page_title: document.title
            };

            const firstTouchStr = localStorage.getItem('asthros_first_touch');
            if (!firstTouchStr) {
                // Primeiro toque na jornada
                localStorage.setItem('asthros_first_touch', JSON.stringify(touchpoint));
                localStorage.setItem('asthros_journey', JSON.stringify([touchpoint]));
                localStorage.setItem('asthros_journey_length', '1');
            } else {
                // Toques subsequentes: verifica duplicidade com o último toque salvo
                let lastTouch = null;
                try {
                    const lastTouchStr = localStorage.getItem('asthros_last_touch');
                    lastTouch = lastTouchStr ? JSON.parse(lastTouchStr) : JSON.parse(firstTouchStr);
                } catch (e) {}

                if (lastTouch) {
                    const diff = Date.now() - new Date(lastTouch.timestamp).getTime();
                    const isSameUrl = lastTouch.page_url === touchpoint.page_url;
                    // Evitar gravar múltiplos cliques/visitas seguidos no mesmo canal e na mesma página em menos de 5 min
                    if (lastTouch.source === touchpoint.source && diff < 5 * 60 * 1000 && isSameUrl) {
                        return;
                    }
                }

                localStorage.setItem('asthros_last_touch', JSON.stringify(touchpoint));
                
                let length = 1;
                try {
                    length = parseInt(localStorage.getItem('asthros_journey_length') || '1', 10);
                } catch (e) {}
                localStorage.setItem('asthros_journey_length', (length + 1).toString());

                // Atualizar jornada mantendo no máximo os últimos 5 elementos
                let journey = [];
                try {
                    const storedJourney = localStorage.getItem('asthros_journey');
                    if (storedJourney) {
                        const parsed = JSON.parse(storedJourney);
                        if (Array.isArray(parsed)) {
                            journey = parsed;
                        }
                    }
                } catch (e) {}

                if (journey.length === 0) {
                    try {
                        journey.push(JSON.parse(firstTouchStr));
                    } catch (e) {}
                }

                journey.push(touchpoint);
                if (journey.length > 5) {
                    journey = journey.slice(-5);
                }
                localStorage.setItem('asthros_journey', JSON.stringify(journey));
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
            const j = localStorage.getItem('asthros_journey');
            if (j) {
                const parsed = JSON.parse(j);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        
        // Fallback para primeiro toque se a jornada não existir/for inválida
        try {
            const ft = localStorage.getItem('asthros_first_touch');
            return ft ? [JSON.parse(ft)] : [];
        } catch (e) {
            return [];
        }
    }

    function trackPageVisit() {
        try {
            const pathname = window.location.pathname || '/';
            let visited = [];
            const stored = localStorage.getItem('asthros_pages_visited');
            if (stored) {
                visited = JSON.parse(stored);
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
                localStorage.setItem('asthros_pages_visited', JSON.stringify(visited));
            }
        } catch (e) {}
    }

    function getPagesVisitedContext() {
        try {
            const stored = localStorage.getItem('asthros_pages_visited');
            if (stored) {
                const parsed = JSON.parse(stored);
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
            const ft = localStorage.getItem('asthros_first_touch');
            if (ft) firstTouch = JSON.parse(ft);

            const lt = localStorage.getItem('asthros_last_touch');
            if (lt) lastTouch = JSON.parse(lt);

            journeyLength = parseInt(localStorage.getItem('asthros_journey_length') || '1', 10);
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
