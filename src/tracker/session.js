    const trackingLocks = new Set();

    // Controle de tempo ativo na página e scroll máximo (Page Visibility API e Reset em SPAs)
    let totalActive = 0;
    let lastVisible = Date.now();
    let maxScroll = 0;
    const localSessionStart = Date.now();

    try {
        if (!getLocalItem('asthros_first_seen')) {
            setLocalItem('asthros_first_seen', Date.now().toString());
        }

        const saveExitData = () => {
            totalActive += Date.now() - lastVisible;
            lastVisible = Date.now(); // Previne contagem dupla em eventos simultâneos (ex: visibilitychange + pagehide)
            
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
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                saveExitData();
            } else {
                lastVisible = Date.now();
            }
        });

        // Suporte robusto para Safari (iOS / macOS) que ignora visibilitychange em alguns fluxos de encerramento
        window.addEventListener('pagehide', saveExitData);
        window.addEventListener('beforeunload', saveExitData);
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

    let scrollTicking = false;

    window.addEventListener('scroll', () => {
        if (scrollTicking) return;
        scrollTicking = true;

        requestAnimationFrame(() => {
            try {
                const docHeight = document.documentElement.scrollHeight || 1;
                const rawPercent = (window.scrollY + window.innerHeight) / docHeight * 100;
                const scrollPercent = Math.min(100, Math.round(rawPercent));
                if (scrollPercent > maxScroll) maxScroll = scrollPercent;
            } catch (e) {}
            scrollTicking = false;
        });
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
        let tz = 'Desconhecido';
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {}

        return {
            platform: navigator.platform, // Mantido para compatibilidade histórica do banco
            // A detecção de Android DEVE vir antes de Linux, pois dispositivos Android também contém 'Linux' no User Agent
            os: /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro',
            is_mobile: /Mobi|Android/i.test(ua),
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            timezone: tz,
            user_agent: ua
        };
    })();

    function getDeviceContext() {
        return {
            ...cachedDeviceContext,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    function getSessionDurationSeconds() {
        try {
            const start = sessionStorage.getItem('asthros_session_started');
            if (start) {
                return Math.max(0, Math.round((Date.now() - parseInt(start, 10)) / 1000));
            }
        } catch (e) {}
        return Math.max(0, Math.round((Date.now() - localSessionStart) / 1000));
    }

    function getSessionId() {
        try {
            let sessionId = sessionStorage.getItem('asthros_session_id');
            if (!sessionId) {
                sessionId = generateUUID();
                sessionStorage.setItem('asthros_session_id', sessionId);
                sessionStorage.setItem('asthros_session_started', Date.now().toString());
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
