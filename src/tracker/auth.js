    let tempToken = null;
    let tokenExpiry = 0;
    let authPromise = null;

    function getAuthToken() {
        if (tempToken && Date.now() < tokenExpiry) {
            return Promise.resolve(tempToken);
        }

        if (authPromise) return authPromise;

        authPromise = fetchNewToken().then(data => {
            authPromise = null;
            if (data && data.token) {
                tempToken = data.token;
                tokenExpiry = Date.now() + 10 * 60 * 1000; // Cache por 10 minutos (somente em memória)
                return tempToken;
            }
            return null;
        }).catch(() => {
            authPromise = null;
            return null;
        });

        return authPromise;
    }

    async function fetchNewToken() {
        if (!config || !config.webhookId) return null;
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}/auth`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Asthros-Webhook-Id': config.webhookId
                },
                body: JSON.stringify({ webhookId: config.webhookId }),
                keepalive: true
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {}
        return null;
    }

    async function signPayload(payload, token) {
        if (!token) return payload;
        // Mensagem baseada em dados chaves do payload para computar a assinatura (context-bound)
        const message = [
            payload.lead_id || '',
            payload.visitor_id || '',
            payload.session_id || '',
            payload.source || '',
            payload.timestamp || ''
        ].join('|');
        
        let signature = '';
        
        // Tenta usar a Web Crypto API nativa do navegador
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            try {
                const enc = new TextEncoder();
                const keyData = enc.encode(token);
                const messageData = enc.encode(message);
                
                const cryptoKey = await window.crypto.subtle.importKey(
                    'raw',
                    keyData,
                    { name: 'HMAC', hash: { name: 'SHA-256' } },
                    false,
                    ['sign']
                );
                
                const sigBuffer = await window.crypto.subtle.sign(
                    'HMAC',
                    cryptoKey,
                    messageData
                );
                
                signature = Array.from(new Uint8Array(sigBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } catch (err) {
                // Em caso de falha na Web Crypto, cai no fallback manual
                signature = hmacSha256(token, message);
            }
        } else {
            // Fallback manual para navegadores antigos sem crypto.subtle
            signature = hmacSha256(token, message);
        }
        
        return {
            ...payload,
            token: token,
            signature: signature
        };
    }

    // Pré-carrega o token assim que o tracker inicializa
    if (config && config.clientId && config.webhookId) {
        getAuthToken();
    }
