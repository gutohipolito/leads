    const trackingLocks = new Set();

    // Controle de tempo ativo na página e scroll máximo (Page Visibility API e Reset em SPAs)
    let totalActive = 0;
    let lastVisible = Date.now();
    let maxScroll = 0;

    try {
        if (!localStorage.getItem('asthros_first_seen')) {
            localStorage.setItem('asthros_first_seen', Date.now().toString());
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                totalActive += Date.now() - lastVisible;
                
                // Exit intent: enriquece o último touchpoint com dados de saída
                try {
                    const lastTouchStr = localStorage.getItem('asthros_last_touch');
                    if (lastTouchStr) {
                        const lastTouch = JSON.parse(lastTouchStr);
                        lastTouch.exit_scroll = maxScroll + '%';
                        lastTouch.exit_time = getActiveTimeOnPage();
                        localStorage.setItem('asthros_last_touch', JSON.stringify(lastTouch));
                    } else {
                        const firstTouchStr = localStorage.getItem('asthros_first_touch');
                        if (firstTouchStr) {
                            const firstTouch = JSON.parse(firstTouchStr);
                            firstTouch.exit_scroll = maxScroll + '%';
                            firstTouch.exit_time = getActiveTimeOnPage();
                            localStorage.setItem('asthros_first_touch', JSON.stringify(firstTouch));
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
            let visitorId = localStorage.getItem('asthros_visitor_id');
            if (!visitorId) {
                visitorId = generateUUID();
                localStorage.setItem('asthros_visitor_id', visitorId);
            }
            return visitorId;
        } catch (e) {
            return 'temp_' + randomId();
        }
    }

    function getConversionTime() {
        try {
            const firstSeen = localStorage.getItem('asthros_first_seen');
            if (firstSeen) {
                const diffMs = Date.now() - parseInt(firstSeen, 10);
                return Math.max(0, Math.round(diffMs / 1000));
            }
        } catch (e) {}
        return 0;
    }
