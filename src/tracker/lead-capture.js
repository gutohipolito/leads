    let consentGivenState = null;
    let consentTimestampState = null;

    if (config && (config.consentGiven === true || config.consentGiven === 'true' || config.consentGiven === '1')) {
        consentGivenState = true;
        consentTimestampState = new Date().toISOString();
    }

    function setConsent(given) {
        consentGivenState = given === null ? null : !!given;
        consentTimestampState = consentGivenState ? new Date().toISOString() : null;
    }

    function getConsentContext() {
        if (consentGivenState === null) return {};
        return {
            consent_given: consentGivenState,
            consent_timestamp: consentTimestampState
        };
    }

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
        const link = e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('[class*="whatsapp"]') || e.target.closest('[class*="wpp"]') || e.target.closest('[id*="whatsapp"]') || e.target.closest('[id*="wpp"]');
        if (!link) return;

        const trackerMatch = getTrackingMatch(link);
        if (!trackerMatch) {
            if (link.tagName === 'A') {
                // console.log('[Asthros] Link comum ignorado:', link.href);
            }
            return;
        }

        if (trackerMatch.source === 'custom_tracker' && isEcommerceCheckoutPage()) {
            return;
        }

        // Proteção contra duplo clique e race condition de envio por elemento (resistente a re-renders em React/Vue)
        const rect = link.getBoundingClientRect();
        const docTop = Math.round(rect.top + (window.scrollY || window.pageYOffset || 0));
        const docLeft = Math.round(rect.left + (window.scrollX || window.pageXOffset || 0));

        const lockKey = [
            'click',
            link.id || '',
            docTop,
            docLeft,
            link.tagName,
            link.href || '',
            link.innerText || link.getAttribute('aria-label') || ''
        ].join('|');

        if (trackingLocks.has(lockKey)) return;
        trackingLocks.add(lockKey);
        setTimeout(() => { trackingLocks.delete(lockKey); }, 2000);

        // console.log(`%c[Asthros] CAPTURANDO LEAD (${trackerMatch.label})!`, 'color: #56d7fd; font-weight: bold;');

        const timestamp = new Date().toISOString();
        const visitorId = getVisitorId();
        const source = trackerMatch.source;
        const payload = {
            lead_id: generateUUID(),
            event_hash: generateEventHash(visitorId, source, timestamp),
            source: source,
            name: 'Lead Identificado via ' + trackerMatch.label,
            session_id: getSessionId(),
            visitor_id: visitorId,
            marketing: buildMarketingContext(),
            behavior: {
                time_on_page: getActiveTimeOnPage(),
                scroll_depth: maxScroll + '%',
                button_text: sanitizeButtonText(link.innerText || link.getAttribute('aria-label') || trackerMatch.label),
                match_type: trackerMatch.label,
                conversion_time_seconds: getConversionTime(),
                session_duration_seconds: getSessionDurationSeconds(),
                ...(trackerMatch.whatsapp_destination_phone ? { whatsapp_destination_phone: trackerMatch.whatsapp_destination_phone } : {})
            },
            device: getDeviceContext(),
            timestamp: timestamp,
            ...(getConsentContext())
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
                
                if (nameAttr.includes('name') || nameAttr.includes('nome') || nameAttr.includes('fullname') || nameAttr.includes('full_name') || nameAttr.includes('cliente') || nameAttr.includes('contato')) {
                    leadName = cleanValue;
                } else if (nameAttr.includes('email') || nameAttr.includes('e-mail') || nameAttr.includes('mail') || nameAttr.includes('correo') || input.type === 'email') {
                    leadEmail = cleanValue;
                } else if (nameAttr.includes('phone') || nameAttr.includes('tel') || nameAttr.includes('whats') || nameAttr.includes('cel') || nameAttr.includes('telefone') || nameAttr.includes('celular') || nameAttr.includes('mobile') || input.type === 'tel') {
                    leadPhone = cleanValue;
                } else {
                    formDataFields[input.name || input.id] = cleanValue;
                }
            });
            
            // Validação robusta do formato do e-mail capturado (exige local-part com 2+ chars, domínio válido e TLD de 2-10 chars)
            if (leadEmail && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(leadEmail)) {
                leadEmail = '';
            }

            if (leadPhone) {
                leadPhone = leadPhone.replace(/[^\d+]/g, '');
            }
            
            if (leadName && (leadEmail || leadPhone)) {
                const timestamp = new Date().toISOString();
                const visitorId = getVisitorId();
                const source = 'form';
                const payload = {
                    lead_id: generateUUID(),
                    event_hash: generateEventHash(visitorId, source, timestamp),
                    source: source,
                    name: leadName,
                    email: leadEmail,
                    phone: leadPhone,
                    fields: formDataFields,
                    session_id: getSessionId(),
                    visitor_id: visitorId,
                    marketing: buildMarketingContext(),
                    behavior: {
                        time_on_page: getActiveTimeOnPage(),
                        scroll_depth: maxScroll + '%',
                        button_text: sanitizeButtonText(form.querySelector('[type="submit"]')?.innerText || 'Enviar Formulário'),
                        match_type: matchType,
                        conversion_time_seconds: getConversionTime(),
                        session_duration_seconds: getSessionDurationSeconds()
                    },
                    device: getDeviceContext(),
                    timestamp: timestamp,
                    ...(getConsentContext())
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

            // Checkout WooCommerce/Shopify vai para Vendas via webhook, não para Leads
            if (isEcommerceCheckoutForm(form) || isEcommerceCheckoutPage()) {
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

    // Ouvinte alternativo do Contact Form 7 para quando não dispara e-mail (status 'skipped' ou 'mail_sent')
    document.addEventListener('wpcf7submit', function(event) {
        try {
            const form = event.target;
            const status = event.detail && event.detail.status;
            if (form && (status === 'mail_sent' || status === 'skipped')) {
                captureFormLead(form, 'Contact Form 7 (Sucesso Submit)');
            }
        } catch (e) {}
    }, false);


    // Ouvinte nativo (Vanilla JS) para versões modernas do Elementor
    try {
        document.addEventListener('submit_success', function(event) {
            const form = event.target;
            if (form) {
                captureFormLead(form, 'Elementor Forms (Nativo AJAX)');
            }
        });
    } catch (e) {}

    // Ouvinte de sucesso para o Elementor Forms (Via jQuery se estiver na página)
    try {
        if (typeof jQuery !== 'undefined') {
            // 1. Ouvinte clássico via evento submit_success do jQuery
            jQuery(document).on('submit_success', function(event) {
                const form = event.target || document.querySelector('.elementor-form');
                if (form) {
                    captureFormLead(form, 'Elementor Forms (submit_success)');
                }
            });

            // 2. Ouvinte avançado via ajaxComplete para interceptar o Ajax Handler interno
            jQuery(document).ajaxComplete(function(event, xhr, settings) {
                try {
                    if (settings.data && settings.data.indexOf('action=elementor_pro_forms_send_form') !== -1) {
                        const response = xhr.responseJSON;
                        if (response && response.success) {
                            // Parsear os parâmetros enviados no corpo da requisição AJAX
                            const params = {};
                            const pairs = settings.data.split('&');
                            for (let i = 0; i < pairs.length; i++) {
                                const pair = pairs[i].split('=');
                                const key = decodeURIComponent(pair[0]);
                                const val = decodeURIComponent(pair[1] || '');
                                if (key) params[key] = val;
                            }

                            // Evitar duplo disparo se já capturamos por outro método
                            const formId = params.form_id;
                            const leadEmail = params['form_fields[email]'] || params['form_fields[e-mail]'] || params['form_fields[mail]'] || params['form_fields[correo]'] || '';
                            const leadPhone = params['form_fields[phone]'] || params['form_fields[tel]'] || params['form_fields[whats]'] || params['form_fields[cel]'] || params['form_fields[telefone]'] || params['form_fields[celular]'] || params['form_fields[mobile]'] || '';
                            
                            const lockKey = 'ajax_form|' + (formId || '') + '|' + (leadEmail || leadPhone || '');
                            if (trackingLocks.has(lockKey)) return;
                            trackingLocks.add(lockKey);
                            setTimeout(() => { trackingLocks.delete(lockKey); }, 3000);

                            // Tenta encontrar o formulário no DOM pelo form_id enviado
                            let form = null;
                            if (formId) {
                                form = document.querySelector('input[name="form_id"][value="' + formId + '"]')?.closest('form');
                            }
                            if (!form) {
                                form = document.querySelector('.elementor-form');
                            }

                            if (form) {
                                captureFormLead(form, 'Elementor Forms (AJAX Handler)');
                            } else {
                                // Fallback: se o form já foi destruído no DOM (ex: popup fechou rápido demais)
                                // extraímos os dados diretamente do settings.data
                                let leadName = '';
                                let extractedEmail = '';
                                let extractedPhone = '';
                                const formDataFields = {};

                                for (const key in params) {
                                    if (key.indexOf('form_fields[') === 0) {
                                        const fieldNameMatch = key.match(/form_fields\[(.*?)\]/);
                                        if (fieldNameMatch && fieldNameMatch[1]) {
                                            const fieldName = fieldNameMatch[1];
                                            const val = params[key].trim();
                                            if (!val) continue;
                                            const cleanValue = sanitize(val);
                                            const lowerFieldName = fieldName.toLowerCase();
                                            
                                            if (lowerFieldName.includes('name') || lowerFieldName.includes('nome') || lowerFieldName.includes('fullname') || lowerFieldName.includes('full_name') || lowerFieldName.includes('cliente') || lowerFieldName.includes('contato')) {
                                                leadName = cleanValue;
                                            } else if (lowerFieldName.includes('email') || lowerFieldName.includes('e-mail') || lowerFieldName.includes('mail') || lowerFieldName.includes('correo')) {
                                                extractedEmail = cleanValue;
                                            } else if (lowerFieldName.includes('phone') || lowerFieldName.includes('tel') || lowerFieldName.includes('whats') || lowerFieldName.includes('cel') || lowerFieldName.includes('telefone') || lowerFieldName.includes('celular') || lowerFieldName.includes('mobile')) {
                                                extractedPhone = cleanValue;
                                            } else {
                                                formDataFields[fieldName] = cleanValue;
                                            }
                                        }
                                    }
                                }

                                if (extractedEmail && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(extractedEmail)) {
                                    extractedEmail = '';
                                }

                                if (extractedPhone) {
                                    extractedPhone = extractedPhone.replace(/[^\d+]/g, '');
                                }

                                if (leadName && (extractedEmail || extractedPhone)) {
                                    const timestamp = new Date().toISOString();
                                    const visitorId = getVisitorId();
                                    const source = 'form';
                                    const payload = {
                                        lead_id: generateUUID(),
                                        event_hash: generateEventHash(visitorId, source, timestamp),
                                        source: source,
                                        name: leadName,
                                        email: extractedEmail,
                                        phone: extractedPhone,
                                        fields: formDataFields,
                                        session_id: getSessionId(),
                                        visitor_id: visitorId,
                                        marketing: buildMarketingContext(),
                                        behavior: {
                                            time_on_page: getActiveTimeOnPage(),
                                            scroll_depth: maxScroll + '%',
                                            button_text: 'Enviar Formulário (Popup/AJAX)',
                                            match_type: 'Elementor Forms (AJAX Fallback)',
                                            conversion_time_seconds: getConversionTime(),
                                            session_duration_seconds: getSessionDurationSeconds()
                                        },
                                        device: getDeviceContext(),
                                        timestamp: timestamp,
                                        ...(getConsentContext())
                                    };
                                    sendPayload(payload);
                                }
                            }
                        }
                    }
                } catch (err) {}
            });
        }
    } catch (e) {}

    // Exposição da API Pública Global para desenvolvedores
    function manualTrackLead(data) {
        try {
            if (!data) return;
            const timestamp = new Date().toISOString();
            const visitorId = getVisitorId();
            const source = 'manual';
            const payload = {
                lead_id: generateUUID(),
                event_hash: generateEventHash(visitorId, source, timestamp),
                source: source,
                name: sanitize(data.name || data.nome || data.fullname || data.full_name || data.cliente || data.contato || 'Lead Manual'),
                email: sanitize(data.email || data.e_mail || data.mail || data.correo),
                phone: sanitize(data.phone || data.telefone || data.whatsapp || data.celular || data.mobile || data.whats || data.cel || data.tel),
                fields: data.fields || {},
                session_id: getSessionId(),
                visitor_id: visitorId,
                marketing: buildMarketingContext(),
                behavior: {
                    time_on_page: getActiveTimeOnPage(),
                    scroll_depth: maxScroll + '%',
                    match_type: 'Disparo Manual (API)',
                    conversion_time_seconds: getConversionTime(),
                    session_duration_seconds: getSessionDurationSeconds()
                },
                device: getDeviceContext(),
                timestamp: timestamp,
                ...((data.consent_given !== undefined) 
                    ? { consent_given: !!data.consent_given, consent_timestamp: data.consent_timestamp || new Date().toISOString() }
                    : getConsentContext()
                )
            };
            
            if (payload.email && !/^[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(payload.email)) {
                                payload.email = '';
                            }
                            if (payload.phone) {
                                payload.phone = payload.phone.replace(/[^\d+]/g, '');
                            }
            
            sendPayload(payload);
        } catch (e) {}
    }

    function isEcommerceCheckoutPage() {
        try {
            const path = (window.location.pathname || '').toLowerCase();
            const bodyClass = (document.body && document.body.className)
                ? String(document.body.className).toLowerCase()
                : '';
            return (
                bodyClass.includes('woocommerce-checkout') ||
                bodyClass.includes('woocommerce-order-received') ||
                bodyClass.includes('woocommerce-cart') ||
                path.includes('/checkout') ||
                path.includes('/order-received') ||
                path.includes('/order-pay')
            );
        } catch (e) {
            return false;
        }
    }

    function isEcommerceCheckoutForm(form) {
        if (!form) return false;
        try {
            const cls = String(form.className || '').toLowerCase();
            const id = String(form.id || '').toLowerCase();
            const action = String(form.getAttribute('action') || '').toLowerCase();
            if (form.classList.contains('woocommerce-checkout')) return true;
            if (id === 'checkout' || id === 'order_review') return true;
            if (cls.includes('woocommerce') && cls.includes('checkout')) return true;
            if (form.closest && form.closest('.woocommerce-checkout')) return true;
            if (action.includes('wc-ajax') || action.includes('order-pay')) return true;
        } catch (e) {}
        return false;
    }

    function isCheckoutLink(url) {
        if (!url) return false;
        const lowerUrl = String(url).toLowerCase();
        return /yampi\.com|pay\.yampi|kiwify\.com|hotmart\.com|cartpanda\.com|eduzz\.com|monetizze\.com|checkout\.shopify\.com|\/checkout|order-received|order-pay/.test(lowerUrl);
    }

    function decorateCheckoutLinks() {
        if (typeof document === 'undefined') return;
        const visitorId = getVisitorId();
        const utms = getUtms();
        if (!visitorId) return;

        const links = document.querySelectorAll('a[href]');
        links.forEach(function(link) {
            const href = link.getAttribute('href');
            if (href && isCheckoutLink(href)) {
                try {
                    const url = new URL(href, window.location.origin);
                    let updated = false;
                    if (!url.searchParams.has('asthros_vid')) {
                        url.searchParams.set('asthros_vid', visitorId);
                        updated = true;
                    }
                    if (!url.searchParams.has('src')) {
                        url.searchParams.set('src', visitorId);
                        updated = true;
                    }
                    if (utms) {
                        const map = {
                            source: 'utm_source',
                            medium: 'utm_medium',
                            campaign: 'utm_campaign',
                            term: 'utm_term',
                            content: 'utm_content',
                            id: 'utm_id'
                        };
                        for (const key in map) {
                            if (utms[key] && !url.searchParams.has(map[key])) {
                                url.searchParams.set(map[key], utms[key]);
                                updated = true;
                            }
                        }
                        ['gclid', 'fbclid', 'ttclid', 'msclkid'].forEach(function(clickId) {
                            if (utms[clickId] && !url.searchParams.has(clickId)) {
                                url.searchParams.set(clickId, utms[clickId]);
                                updated = true;
                            }
                        });
                    }
                    if (updated) {
                        link.setAttribute('href', url.toString());
                    }
                } catch (e) {}
            }
        });
    }

    function ensureHiddenInput(form, name, value) {
        if (!form || !name || value === null || value === undefined || value === '') return;
        let input = form.querySelector('input[name="' + name + '"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = String(value);
    }

    function injectWooCheckoutAttribution() {
        try {
            if (!isEcommerceCheckoutPage()) return;
            const form = document.querySelector('form.woocommerce-checkout, form.checkout, form#checkout');
            if (!form) return;
            const visitorId = getVisitorId();
            const utms = getUtms() || {};
            ensureHiddenInput(form, 'asthros_vid', visitorId);
            ensureHiddenInput(form, 'utm_source', utms.source);
            ensureHiddenInput(form, 'utm_medium', utms.medium);
            ensureHiddenInput(form, 'utm_campaign', utms.campaign);
            ensureHiddenInput(form, 'utm_term', utms.term);
            ensureHiddenInput(form, 'utm_content', utms.content);
            ensureHiddenInput(form, 'utm_id', utms.id);
            // Comportamento & Engajamento — captura o mesmo dado que já vai num lead, pra chegar
            // completo no pedido mesmo quando o comprador nunca virou lead antes de comprar.
            ensureHiddenInput(form, 'asthros_time_on_page', getActiveTimeOnPage());
            ensureHiddenInput(form, 'asthros_scroll_depth', maxScroll + '%');
            ensureHiddenInput(form, 'asthros_conversion_time_seconds', getConversionTime());
            ensureHiddenInput(form, 'asthros_session_duration_seconds', getSessionDurationSeconds());
            ensureHiddenInput(form, 'asthros_page_url', window.location.href);
        } catch (e) {}
    }

    function syncShopifyCartAttributes() {
        try {
            const isShopify =
                typeof window.Shopify !== 'undefined' ||
                !!document.querySelector('script[src*="cdn.shopify.com"]');
            if (!isShopify) return;

            const visitorId = getVisitorId();
            const utms = getUtms() || {};
            const attributes = {};
            if (visitorId) attributes.asthros_vid = visitorId;
            if (utms.source) attributes.utm_source = utms.source;
            if (utms.medium) attributes.utm_medium = utms.medium;
            if (utms.campaign) attributes.utm_campaign = utms.campaign;
            if (utms.term) attributes.utm_term = utms.term;
            if (utms.content) attributes.utm_content = utms.content;
            if (utms.id) attributes.utm_id = utms.id;

            // Comportamento & Engajamento só é anexado no checkout — fora dele o tempo na
            // página muda a cada tick e forçaria reenvio continuo ao /cart/update.js em
            // toda pagina do site, sem necessidade.
            const isCheckout = isEcommerceCheckoutPage();
            if (isCheckout) {
                attributes.asthros_time_on_page = getActiveTimeOnPage();
                attributes.asthros_scroll_depth = maxScroll + '%';
                attributes.asthros_conversion_time_seconds = String(getConversionTime());
                attributes.asthros_session_duration_seconds = String(getSessionDurationSeconds());
                attributes.asthros_page_url = window.location.href;
            }

            if (Object.keys(attributes).length === 0) return;

            const signature = JSON.stringify(attributes);
            // No checkout o comportamento muda a cada tick por natureza — não faz sentido
            // dedupelar ali. Fora do checkout, mantém a dedupe original.
            if (!isCheckout && window.__asthrosShopifyAttrs === signature) return;
            window.__asthrosShopifyAttrs = signature;

            fetch('/cart/update.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ attributes: attributes }),
                credentials: 'same-origin'
            }).catch(function() {});
        } catch (e) {}
    }

    function syncEcommerceAttribution() {
        injectWooCheckoutAttribution();
        syncShopifyCartAttributes();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', decorateCheckoutLinks);
            document.addEventListener('DOMContentLoaded', syncEcommerceAttribution);
        } else {
            decorateCheckoutLinks();
            syncEcommerceAttribution();
        }
        setInterval(decorateCheckoutLinks, 3000);
        setInterval(syncEcommerceAttribution, 4000);
    }

    window.Asthros = window.Asthros || {};
    window.Asthros.trackLead = manualTrackLead;
    window.Asthros.setConsent = setConsent;
    window.Asthros.trackForm = function(formElement) {
        if (formElement && formElement.tagName === 'FORM') {
            captureFormLead(formElement, 'Disparo Manual de Formulário (API)');
        }
    };
    window.Asthros.decorateCheckoutLinks = decorateCheckoutLinks;
    window.Asthros.syncEcommerceAttribution = syncEcommerceAttribution;
