    function queueFailedLead(payload) {
        try {
            const queue = getLocalItem('asthros_queue') || [];
            const exists = queue.some(item => item.lead_id === payload.lead_id);
            if (!exists) {
                let priority = 3;
                if (payload.source === 'form' || payload.source === 'manual') {
                    priority = 1;
                } else if (payload.source === 'whatsapp_tracker') {
                    priority = 2;
                }
                
                const itemToQueue = { ...payload, priority };
                queue.push(itemToQueue);
                
                // Ordenação crescente por importância: prioridade 1 (alta), 2 (média), 3 (baixa)
                queue.sort((a, b) => (a.priority || 3) - (b.priority || 3));
                
                setLocalItem('asthros_queue', queue.slice(0, 5)); // max 5 mais prioritários
            }
        } catch (e) {}
    }

    // Rate Limiting Client-Side: Janela deslizante de 1 minuto
    const MAX_EVENTS_PER_MINUTE = 30;
    const eventTimestamps = [];

    function isRateLimited() {
        const now = Date.now();
        const windowStart = now - 60 * 1000;
        
        // Remove timestamps fora da janela
        while (eventTimestamps.length > 0 && eventTimestamps[0] < windowStart) {
            eventTimestamps.shift();
        }
        
        if (eventTimestamps.length >= MAX_EVENTS_PER_MINUTE) {
            return true;
        }
        
        eventTimestamps.push(now);
        return false;
    }

    async function sendPayload(payload) {
        // Bloqueia excessos antes de atingir o servidor
        if (isRateLimited()) {
            return;
        }

        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        const cleanPayload = removeEmpty(payload);
        
        let token = null;
        if (config.webhookId) {
            try {
                token = await getAuthToken();
            } catch (e) {}
        }
        
        const signedPayload = await signPayload(cleanPayload, token);

        // Beacon apenas no fechamento
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...signedPayload };
            if (config.webhookId) {
                beaconPayload.webhookId = config.webhookId;
            }
            if (config.secret) {
                beaconPayload.secret = config.secret;
            }
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

        const safePayload = { ...signedPayload };
        if (config.webhookId) {
            safePayload.webhookId = config.webhookId;
        }

        try {
            const headers = { 
                'Content-Type': 'application/json'
            };
            if (config.webhookId) {
                headers['X-Asthros-Webhook-Id'] = config.webhookId;
            }
            if (config.secret) {
                headers['X-Asthros-Secret'] = config.secret;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(safePayload),
                keepalive: true
            });
            
            if (!response.ok) {
                queueFailedLead(safePayload);
            }
        } catch (err) {
            queueFailedLead(safePayload);
        }
    }
