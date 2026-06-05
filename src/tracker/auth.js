    let tempToken = null;
    let tokenExpiry = 0;
    let authPromise = null;

    function getAuthToken() {
        if (tempToken && Date.now() < tokenExpiry) {
            return Promise.resolve(tempToken);
        }
        
        // Tenta obter do sessionStorage para persistir entre recarregamentos
        try {
            const cached = sessionStorage.getItem('asthros_auth_token');
            const expiry = parseInt(sessionStorage.getItem('asthros_token_expiry') || '0', 10);
            if (cached && Date.now() < expiry) {
                tempToken = cached;
                tokenExpiry = expiry;
                return Promise.resolve(tempToken);
            }
        } catch (e) {}

        if (authPromise) return authPromise;

        authPromise = fetchNewToken().then(data => {
            authPromise = null;
            if (data && data.token) {
                tempToken = data.token;
                tokenExpiry = Date.now() + 10 * 60 * 1000; // Cache por 10 minutos
                try {
                    sessionStorage.setItem('asthros_auth_token', tempToken);
                    sessionStorage.setItem('asthros_token_expiry', tokenExpiry.toString());
                } catch (e) {}
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

    function signPayload(payload, token) {
        if (!token) return payload;
        // Mensagem baseada em dados chaves do payload para computar a assinatura
        const message = [
            payload.lead_id || '',
            payload.visitor_id || '',
            payload.timestamp || ''
        ].join('|');
        
        const signature = hmacSha256(token, message);
        
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
