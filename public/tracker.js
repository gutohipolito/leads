/**
 * ASTHROS LEADS - WhatsApp Tracker
 * Este script deve ser inserido no site do cliente.
 */
(function() {
    const startTime = Date.now();
    let maxScroll = 0;
    
    // 1. Monitorar Scroll
    window.addEventListener('scroll', () => {
        const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
        if (scrollPercent > maxScroll) maxScroll = scrollPercent;
    });

    // 2. Coletar Dados do Navegador
    function getBrowserData() {
        return {
            ua: navigator.userAgent,
            lang: navigator.language,
            res: `${window.screen.width}x${window.screen.height}`,
            vp: `${window.innerWidth}x${window.innerHeight}`,
            ref: document.referrer || 'direto',
            url: window.location.href,
            title: document.title
        };
    }

    // 3. Coletar UTMs
    function getUTMs() {
        const params = new URLSearchParams(window.location.search);
        return {
            source: params.get('utm_source'),
            medium: params.get('utm_medium'),
            campaign: params.get('utm_campaign'),
            term: params.get('utm_term'),
            content: params.get('utm_content'),
            gclid: params.get('gclid'),
            fbclid: params.get('fbclid')
        };
    }

    // 4. Enviar Lead
    async function sendLead(targetUrl, buttonId = 'unknown') {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        const utms = getUTMs();
        const browser = getBrowserData();

        const payload = {
            name: "Lead via WhatsApp",
            source: "whatsapp_tracker",
            button_id: buttonId,
            target_url: targetUrl,
            behavior: {
                time_on_page: `${timeOnPage}s`,
                max_scroll: `${maxScroll}%`
            },
            marketing: utms,
            device: browser
        };

        // Captura o ClientID e Secret do script tag
        const scriptTag = document.currentScript || document.querySelector('script[src*="tracker.js"]');
        const clientId = scriptTag?.getAttribute('data-client-id');
        const secret = scriptTag?.getAttribute('data-secret');
        const apiUrl = scriptTag?.getAttribute('data-api-url') || 'https://leads-asthros.vercel.app';

        if (!clientId || !secret) {
            console.error('Asthros Tracker: ClientID ou Secret ausentes.');
            return;
        }

        try {
            await fetch(`${apiUrl}/api/leads/${clientId}?secret=${secret}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true // Garante que a requisição complete mesmo mudando de página
            });
        } catch (e) {
            console.error('Asthros Tracker Error:', e);
        }
    }

    // 5. Interceptar Cliques em WhatsApp
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com/send"]');
        if (link) {
            const buttonId = link.id || link.className || 'wa-button';
            sendLead(link.href, buttonId);
        }
    });

    console.log('Asthros Leads Tracker Ativo 🚀');
})();
