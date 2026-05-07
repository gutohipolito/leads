(function() {
    const config = {
        clientId: document.currentScript.getAttribute('data-client-id'),
        secret: document.currentScript.getAttribute('data-secret'),
        apiUrl: document.currentScript.getAttribute('data-api-url') || window.location.origin
    };

    if (!config.clientId || !config.secret) {
        console.warn('Asthros Tracker: Faltando client-id ou secret.');
        return;
    }

    const startTime = Date.now();
    let maxScroll = 0;

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        if (scrollPercent > maxScroll) maxScroll = Math.round(scrollPercent);
    });

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
        return (
            lowerUrl.includes('wa.me') || 
            lowerUrl.includes('api.whatsapp.com') || 
            lowerUrl.includes('chat.whatsapp.com') || 
            lowerUrl.includes('web.whatsapp.com') || 
            lowerUrl.startsWith('whatsapp://')
        );
    }

    async function trackLead(e) {
        const link = e.target.closest('a');
        if (!link || !isWhatsAppLink(link.href)) return;

        const utms = getUtms();
        const payload = {
            name: 'Lead via WhatsApp',
            email: 'whatsapp@tracker.internal',
            phone: link.href.split('phone=')[1]?.split('&')[0] || 'N/A',
            source: 'whatsapp_tracker',
            data: {
                marketing: {
                    ...utms,
                    referrer: document.referrer || 'direto'
                },
                behavior: {
                    time_on_page: Math.round((Date.now() - startTime) / 1000) + 's',
                    scroll_depth: maxScroll + '%',
                    page_url: window.location.href,
                    clicked_url: link.href
                },
                device: {
                    user_agent: navigator.userAgent,
                    platform: navigator.platform,
                    screen_res: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language
                }
            }
        };

        try {
            // Usamos fetch com keepalive para garantir que a requisição seja completada
            // mesmo que o redirecionamento aconteça instantaneamente
            fetch(`${config.apiUrl}/api/leads/${config.clientId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Asthros-Secret': config.secret
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (err) {
            console.error('Asthros Tracker Error:', err);
        }
    }

    document.addEventListener('click', trackLead, { capture: true });
})();
