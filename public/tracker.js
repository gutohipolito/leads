(function() {
    const config = {
        clientId: document.currentScript.getAttribute('data-client-id'),
        secret: document.currentScript.getAttribute('data-secret'),
        apiUrl: document.currentScript.getAttribute('data-api-url') || 'https://leads.asthros.com.br'
    };

    if (!config.clientId || !config.secret) {
        console.warn('[Asthros] Faltando client-id ou secret no script.');
        return;
    }

    console.log('[Asthros] Rastreador Ativo em: ' + config.apiUrl);

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

        // Prioridade para Beacon (não bloqueia redirecionamento)
        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, JSON.stringify(payload));
        } else {
            fetch(endpoint, {
                method: 'POST',
                mode: 'no-cors', // Evita problemas de CORS em envios unidirecionais
                body: JSON.stringify(payload),
                keepalive: true
            });
        }
    }

    // Captura global no nível do document para garantir que pegamos antes de outros preventDefault()
    document.addEventListener('click', trackLead, { capture: true });
})();
