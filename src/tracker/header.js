(function() {
    // console.log('%c[Asthros] Iniciando depuração do rastreador...', 'color: #56d7fd; font-weight: bold;');

    // 1. Busca de Configuração
    let config = window.AsthrosConfig || null;

    if (config) {
        // Compatibilidade com configurações antigas em window.AsthrosConfig
        config.webhookId = config.webhookId || config.secret;
    }

    if (!config) {
        let script = document.currentScript;
        
        if (!script) {
            // Se currentScript for nulo (async/defer/GTM), busca scripts que ainda não foram marcados como inicializados
            const candidates = document.querySelectorAll(
                'script[src*="tracker.js"]:not([data-asthros-initialized]), ' +
                'script[src*="tracker.min.js"]:not([data-asthros-initialized])'
            );
            if (candidates.length > 0) {
                script = candidates[candidates.length - 1];
            }
        }
        
        if (script) {
            // Marca o script atual para que outras execuções assíncronas concorrentes de múltiplos scripts não o selecionem
            try {
                script.setAttribute('data-asthros-initialized', 'true');
            } catch (e) {}

            config = {
                clientId: script.getAttribute('data-client-id'),
                webhookId: script.getAttribute('data-webhook-id') || script.getAttribute('data-secret'),
                secret: script.getAttribute('data-secret'),
                apiUrl: script.getAttribute('data-api-url') || 'https://leads.asthros.com.br',
                trackKeywords: script.getAttribute('data-keywords') ? script.getAttribute('data-keywords').split(',') : [],
                trackSelectors: script.getAttribute('data-selectors') ? script.getAttribute('data-selectors').split(',') : []
            };
        }
    }

    if (!config || !config.clientId || !config.webhookId) {
        // console.error('[Asthros] CONFIGURAÇÃO NÃO ENCONTRADA! Certifique-se de que window.AsthrosConfig está definido ou a tag <script> tem os atributos data-.');
        return;
    }

    // Validação de segurança da URL da API (deve utilizar HTTPS para prevenir sequestro de requisição ou injeção XSS)
    if (config.apiUrl && !config.apiUrl.startsWith('https://')) {
        config.apiUrl = 'https://leads.asthros.com.br';
    } else if (!config.apiUrl) {
        config.apiUrl = 'https://leads.asthros.com.br';
    }
