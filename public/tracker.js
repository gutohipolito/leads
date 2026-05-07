(function() {
    // Log imediato para confirmar carregamento
    console.log('%c[Asthros] Iniciando carregamento do rastreador...', 'color: #56d7fd; font-size: 10px;');

    // 1. Busca de Configuração (Prioridade: Global > Atributos da Tag)
    let config = window.AsthrosConfig || null;

    if (!config) {
        const script = document.currentScript || 
                       document.querySelector('script[src*="tracker.js"]') || 
                       document.querySelector('script[src*="tracker.min.js"]');
        
        if (script) {
            config = {
                clientId: script.getAttribute('data-client-id'),
                secret: script.getAttribute('data-secret'),
                apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br'
            };
        }
    }

    if (!config || !config.clientId || !config.secret) {
        console.error('[Asthros] Erro crítico: Configurações não encontradas. Use window.AsthrosConfig.');
        return;
    }

    console.log('%c[Asthros] Rastreador Ativo e Configurado!', 'color: #25d366; font-weight: bold;');

    const startTime = Date.now();
    let maxScroll = 0;

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        if (scrollPercent > maxScroll) maxScroll = Math.round(scrollPercent);
    }, { passive: true });

    function getUtms() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            source: urlParams.get('utm_source') || 'direto',
            medium: urlParams.get('utm_medium') || 'organico',
            campaign: urlParams.get('utm_campaign') || 'nenhuma',
            term: urlParams.get('utm_term'),
            content: urlParams.get('utm_content'),
            gclid: urlParams.get('gclid'),
            fbclid: urlParams.get('fbclid')
        };
    }

    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        // Regex mais abrangente para links curtos e protocolos
        return /wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/.test(lowerUrl);
    }

    async function trackLead(e) {
        // Buscamos o link mais próximo (suporta ícones ou spans dentro do <a>)
        const link = e.target.closest('a');
        if (!link || !isWhatsAppLink(link.href)) return;

        console.log('[Asthros] Capturando clique em:', link.href);

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

        try {
            // Tentamos o Beacon primeiro (mais resiliente a trocas de página)
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                if (navigator.sendBeacon(endpoint, blob)) {
                    console.log('[Asthros] Sinal enviado (Beacon)');
                    return;
                }
            }

            // Fallback via Fetch (com keepalive para garantir o envio)
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            })
            .then(() => console.log('[Asthros] Sinal enviado (Fetch)'))
            .catch(err => console.error('[Asthros] Erro no envio:', err));

        } catch (err) {
            console.error('[Asthros] Falha crítica no rastreador:', err);
        }
    }

    // Usamos capture: true para garantir que pegamos o evento antes de outros scripts do Elementor
    document.addEventListener('click', trackLead, { capture: true });
})();
