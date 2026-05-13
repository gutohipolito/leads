(function() {
    console.log('%c[Asthros] Iniciando depuração do rastreador...', 'color: #56d7fd; font-weight: bold;');

    // 1. Busca de Configuração
    let config = window.AsthrosConfig || null;

    if (!config) {
        const script = document.currentScript || 
                       document.querySelector('script[src*="tracker.js"]') || 
                       document.querySelector('script[src*="tracker.min.js"]');
        
        if (script) {
            config = {
                clientId: script.getAttribute('data-client-id'),
                secret: script.getAttribute('data-secret'),
                apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br',
                trackKeywords: script.getAttribute('data-keywords') ? script.getAttribute('data-keywords').split(',') : [],
                trackSelectors: script.getAttribute('data-selectors') ? script.getAttribute('data-selectors').split(',') : []
            };
        }
    }

    if (!config || !config.clientId || !config.secret) {
        console.error('[Asthros] CONFIGURAÇÃO NÃO ENCONTRADA! Certifique-se de que window.AsthrosConfig está definido ou a tag <script> tem os atributos data-.');
        return;
    }

    console.log('[Asthros] Configuração Carregada:', {
        clientId: config.clientId,
        apiUrl: config.apiUrl,
        keywords: config.trackKeywords || [],
        selectors: config.trackSelectors || [],
        // Ocultamos parte do secret por segurança no log
        secret: config.secret.substring(0, 10) + '...'
    });

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
            campaign: urlParams.get('utm_campaign') || 'nenhuma'
        };
    }

    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        const matches = /wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/.test(lowerUrl);
        return matches;
    }

    function getTrackingMatch(link) {
        if (!link) return null;
        const url = link.href || '';
        
        // 1. WhatsApp (Sempre ativo por padrão)
        if (isWhatsAppLink(url)) {
            return { source: 'whatsapp_tracker', label: 'WhatsApp' };
        }

        // 2. Custom Keywords (ex: 'checkout', 'comprar')
        if (config.trackKeywords && Array.isArray(config.trackKeywords)) {
            for (const keyword of config.trackKeywords) {
                if (keyword && url.toLowerCase().includes(keyword.toLowerCase())) {
                    return { source: 'custom_tracker', label: `Keyword: ${keyword}` };
                }
            }
        }

        // 3. Custom Selectors (ex: '.btn-checkout', '#buy-now')
        if (config.trackSelectors && Array.isArray(config.trackSelectors)) {
            for (const selector of config.trackSelectors) {
                if (selector && link.matches(selector)) {
                    return { source: 'custom_tracker', label: `Selector: ${selector}` };
                }
            }
        }

        return null;
    }

    async function trackLead(e) {
        const link = e.target.closest('a') || e.target.closest('button');
        if (!link) return;

        const match = getTrackingMatch(link);
        if (!match) {
            // Se for link mas não deu match, ignoramos
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link ignorado.');
            }
            return;
        }

        console.log(`%c[Asthros] CAPTURANDO LEAD (${match.label})!`, 'color: #56d7fd; font-weight: bold;');

        const payload = {
            source: match.source,
            name: 'Lead Identificado via ' + match.label,
            marketing: { ...getUtms(), referrer: document.referrer || 'direto' },
            behavior: {
                time_on_page: Math.round((Date.now() - startTime) / 1000) + 's',
                scroll_depth: maxScroll + '%',
                page_url: window.location.href,
                button_text: link.innerText.trim() || link.getAttribute('aria-label') || match.label,
                match_type: match.label
            },
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}?secret=${config.secret}`;

        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                if (navigator.sendBeacon(endpoint, blob)) {
                    console.log('[Asthros] Sucesso: Sinal enviado via Beacon API.');
                    return;
                }
            }

            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            })
            .then(() => console.log('[Asthros] Sucesso: Sinal enviado via Fetch API.'))
            .catch(err => console.error('[Asthros] Falha no envio (Fetch):', err));

        } catch (err) {
            console.error('[Asthros] Erro crítico no processamento:', err);
        }
    }

    document.addEventListener('click', trackLead, { capture: true });
    console.log('%c[Asthros] Escuta de eventos ativada com sucesso!', 'color: #25d366;');
})();

