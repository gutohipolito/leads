    function isWhatsAppLink(url) {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        const matches = /wa\.me|wa\.link|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/.test(lowerUrl);
        return matches;
    }

    function extractWhatsAppPhone(url) {
        if (!url) return null;
        try {
            const wameMatch = url.match(/wa\.me\/([0-9]+)/i);
            if (wameMatch && wameMatch[1]) {
                return wameMatch[1];
            }
            const phoneMatch = url.match(/[?&]phone=([0-9]+)/i);
            if (phoneMatch && phoneMatch[1]) {
                return phoneMatch[1];
            }
        } catch (e) {}
        return null;
    }

    function getTrackingMatch(link) {
        if (!link) return null;
        const url = link.href || '';
        const lowerUrl = url.toLowerCase();
        const id = (link.id || '').toLowerCase();
        const className = (typeof link.className === 'string' ? link.className : link.getAttribute('class') || '').toLowerCase();
        
        // 1. WhatsApp (Verificação expandida com suporte a encurtadores e classes de plugins)
        const isWpp = isWhatsAppLink(url) || 
                      lowerUrl.includes('whatsapp') || 
                      id.includes('whatsapp') || 
                      id.includes('wpp') || 
                      className.includes('whatsapp') || 
                      className.includes('wpp') ||
                      className.includes('wa-link') ||
                      className.includes('wa_btn') ||
                      className.includes('whatsapp-button');

        if (isWpp) {
            const destPhone = extractWhatsAppPhone(url);
            return { 
                source: 'whatsapp_tracker', 
                label: 'WhatsApp', 
                whatsapp_destination_phone: destPhone 
            };
        }

        // 2. Custom Keywords (ex: 'checkout', 'comprar')
        if (config.trackKeywords && Array.isArray(config.trackKeywords)) {
            for (const keyword of config.trackKeywords) {
                if (keyword && lowerUrl.includes(keyword.toLowerCase())) {
                    return { source: 'custom_tracker', label: `Keyword: ${keyword}` };
                }
            }
        }

        // 3. Custom Selectors (ex: '.btn-checkout', '#buy-now')
        if (config.trackSelectors && Array.isArray(config.trackSelectors)) {
            for (const selector of config.trackSelectors) {
                try {
                    if (selector && link.matches(selector)) {
                        return { source: 'custom_tracker', label: `Selector: ${selector}` };
                    }
                } catch (e) {}
            }
        }

        return null;
    }

    function trackLead(e) {
        // Encontra o elemento de link clicado
        const link = e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('.btn') || e.target.closest('.button') || e.target.closest('[class*="whatsapp"]') || e.target.closest('[class*="wpp"]') || e.target.closest('[id*="whatsapp"]') || e.target.closest('[id*="wpp"]');
        if (!link) return;

        const trackerMatch = getTrackingMatch(link);
        if (!trackerMatch) {
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link comum ignorado:', link.href);
            }
            return;
        }

        // Proteção contra duplo clique e race condition de envio por elemento (resistente a re-renders em React/Vue)
        const lockKey = [
            'click',
            link.tagName,
            link.href || '',
            link.innerText || link.getAttribute('aria-label') || '',
            link.className || ''
        ].join('|');

        if (trackingLocks.has(lockKey)) return;
        trackingLocks.add(lockKey);
        setTimeout(() => { trackingLocks.delete(lockKey); }, 2000);

        // console.log(`%c[Asthros] CAPTURANDO LEAD (${trackerMatch.label})!`, 'color: #56d7fd; font-weight: bold;');

        const payload = {
            source: trackerMatch.source,
            name: 'Lead Identificado via ' + trackerMatch.label,
            session_fingerprint: getSessionId(),
            marketing: buildMarketingContext(),
            behavior: {
                time_on_page: getActiveTimeOnPage(),
                scroll_depth: maxScroll + '%',
                // Precedência de captura: innerText -> aria-label -> correspondência de rastreamento (funciona como fallback se innerText for undefined/vazio em SVGs/elementos ocultos)
                button_text: sanitizeButtonText(link.innerText || link.getAttribute('aria-label') || trackerMatch.label),
                match_type: trackerMatch.label,
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: new Date().toISOString()
        };

        sendPayload(payload);
    }

    // 4. Captura Inteligente de Formulários no Frontend (Opcional)
    function captureFormLead(form, matchType) {
        try {
            // Proteção contra duplo submit do mesmo formulário (resistente a re-renders em React/Vue)
            const lockKey = [
                'form',
                form.action || '',
                form.id || '',
                form.className || ''
            ].join('|');

            if (trackingLocks.has(lockKey)) return;
            trackingLocks.add(lockKey);
            setTimeout(() => { trackingLocks.delete(lockKey); }, 3000);

            const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
            const formDataFields = {};
            
            let leadName = '';
            let leadEmail = '';
            let leadPhone = '';
            
            inputs.forEach(input => {
                const nameAttr = (input.name || input.id || '').toLowerCase();
                const value = (input.value || '').trim();
                if (!value) return;
                
                // Ignorar campos confidenciais
                if (input.type === 'password' || nameAttr.includes('password') || nameAttr.includes('token') || nameAttr.includes('nonce')) {
                    return;
                }
                
                const cleanValue = sanitize(value);
                if (!cleanValue) return;
                
                if (nameAttr.includes('name') || nameAttr.includes('nome')) {
                    leadName = cleanValue;
                } else if (nameAttr.includes('email') || nameAttr.includes('e-mail') || input.type === 'email') {
                    leadEmail = cleanValue;
                } else if (nameAttr.includes('phone') || nameAttr.includes('tel') || nameAttr.includes('whats') || nameAttr.includes('cel') || input.type === 'tel') {
                    leadPhone = cleanValue;
                } else {
                    formDataFields[input.name || input.id] = cleanValue;
                }
            });
            
            // Validação robusta do formato do e-mail capturado (exige local-part com 2+ chars, domínio válido e TLD de 2-10 chars)
            if (leadEmail && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(leadEmail)) {
                leadEmail = '';
            }
            
            if (leadName && (leadEmail || leadPhone)) {
                const payload = {
                    source: 'form',
                    name: leadName,
                    email: leadEmail,
                    phone: leadPhone,
                    fields: formDataFields,
                    session_fingerprint: getSessionId(),
                    marketing: buildMarketingContext(),
                    behavior: {
                        time_on_page: getActiveTimeOnPage(),
                        scroll_depth: maxScroll + '%',
                        button_text: sanitizeButtonText(form.querySelector('[type="submit"]')?.innerText || 'Enviar Formulário'),
                        match_type: matchType
                    },
                    device: getDeviceContext(),
                    timestamp: new Date().toISOString()
                };
                
                sendPayload(payload);
            }
        } catch (err) {}
    }

    function trackFormSubmit(e) {
        try {
            const form = e.target;
            
            // Se for Contact Form 7 ou Elementor (que possuem AJAX próprio), ignoramos o submit imediato
            // e aguardamos o evento de sucesso específico para evitar capturar leads inválidos/falsos.
            if (form.classList.contains('wpcf7-form') || 
                form.closest('.elementor-form') || 
                form.getAttribute('data-asthros-ajax') === 'true') {
                return;
            }

            captureFormLead(form, 'Auto-captura de Formulário');
        } catch (err) {}
    }

    document.addEventListener('click', trackLead, { capture: true });

    // Habilita a escuta de formulários apenas se configurado explicitamente autoTrackForms: true
    if (config.autoTrackForms === true || config.autoTrackForms === 'true') {
        document.addEventListener('submit', trackFormSubmit, { capture: true });
    }

    // Ouvinte de sucesso para o Contact Form 7 (Nativo)
    document.addEventListener('wpcf7mailsent', function(event) {
        try {
            const form = event.target;
            if (form) {
                captureFormLead(form, 'Contact Form 7 (Sucesso AJAX)');
            }
        } catch (e) {}
    }, false);

    // Ouvinte de sucesso para o Elementor Forms (Via jQuery se estiver na página)
    try {
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('submit_success', function(event) {
                // Em Elementor, o event.target ou a resposta pode referenciar o form
                const form = event.target || document.querySelector('.elementor-form');
                if (form) {
                    captureFormLead(form, 'Elementor Forms (Sucesso AJAX)');
                }
            });
        }
    } catch (e) {}

    // Exposição da API Pública Global para desenvolvedores
    function manualTrackLead(data) {
        try {
            if (!data) return;
            const payload = {
                source: 'manual',
                name: sanitize(data.name || data.nome || 'Lead Manual'),
                email: sanitize(data.email || data.e_mail),
                phone: sanitize(data.phone || data.telefone || data.whatsapp),
                fields: data.fields || {},
                session_fingerprint: getSessionId(),
                marketing: buildMarketingContext(),
                behavior: {
                    time_on_page: getActiveTimeOnPage(),
                    scroll_depth: maxScroll + '%',
                    match_type: 'Disparo Manual (API)'
                },
                device: getDeviceContext(),
                timestamp: new Date().toISOString()
            };
            
            if (payload.email && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(payload.email)) {
                payload.email = '';
            }
            
            sendPayload(payload);
        } catch (e) {}
    }

    window.Asthros = window.Asthros || {};
    window.Asthros.trackLead = manualTrackLead;
    window.Asthros.trackForm = function(formElement) {
        if (formElement && formElement.tagName === 'FORM') {
            captureFormLead(formElement, 'Disparo Manual de Formulário (API)');
        }
    };
