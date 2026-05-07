(function() {
    // Busca robusta pelo script (suporta GTM e injeção dinâmica)
    const script = document.currentScript || document.querySelector('script[src*="tracker.js"]') || document.querySelector('script[src*="tracker.min.js"]');
    
    if (!script) {
        console.warn('[Asthros] Erro crítico: Não foi possível localizar a tag do rastreador.');
        return;
    }

    const config = {
        clientId: script.getAttribute('data-client-id'),
        secret: script.getAttribute('data-secret'),
        apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br'
    };

    if (!config.clientId || !config.secret) {
        console.warn('[Asthros] Faltando client-id ou secret no script.');
        return;
    }

    console.log('[Asthros] Rastreador Ativo: ' + config.clientId);

    const startTime = Date.now();
    let maxScroll = 0;

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        if (scrollPercent > maxScroll) maxScroll = Math.round(scrollPercent);
    }, { passive: true });

    function getUtms() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            source: urlParams.get('utm_source'),
            medium: urlParams.get('utm_medium'),
            campaign: urlParams.get('utm_campaign'),
            term: urlParams.get('utm_term'),
            content: urlParams.get('utm_content'),
            gclid: urlParams.get('gclid'),
            fbclid: urlParams.get('fbclid')
        };
    }

    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        return /wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:\/\//.test(lowerUrl);
    }

    async function trackLead(e) {
        const link = e.target.closest('a');
        if (!link || !isWhatsAppLink(link.href)) return;

        const utms = getUtms();
        const payload = {
            source: 'whatsapp_tracker',
            marketing: {
                ...utms,
                referrer: document.referrer || 'direto'
            },
            behavior: {
                time_on_page: Math.round((Date.now() - startTime) / 1000) + 's',
                scroll_depth: maxScroll + '%',
                page_url: window.location.href,
                button_text: link.innerText.trim() || 'Botão WhatsApp'
            },
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}?secret=${config.secret}`;

        // Prioridade absoluta para Beacon (assíncrono e resiliente)
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(endpoint, blob);
        } else {
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});
        }
    }

    document.addEventListener('click', trackLead, { capture: true });
})();
