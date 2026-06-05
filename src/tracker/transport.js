    function queueFailedLead(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            const exists = queue.some(item => item.lead_id === payload.lead_id);
            if (!exists) {
                const priority = (payload.source === 'form' || payload.source === 'manual') ? 1 : 2;
                const itemToQueue = { ...payload, priority };
                queue.push(itemToQueue);
                
                // Ordenação decrescente: prioridade 2 (menos importante) vem antes de prioridade 1 (mais importante)
                queue.sort((a, b) => (b.priority || 2) - (a.priority || 2));
                
                localStorage.setItem('asthros_queue', JSON.stringify(queue.slice(-5))); // max 5
            }
        } catch (e) {}
    }

    async function sendPayload(payload) {
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        const cleanPayload = removeEmpty(payload);
        
        // Beacon apenas no fechamento
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...cleanPayload };
            if (config.webhookId) {
                beaconPayload.webhookId = config.webhookId;
            }
            if (config.secret) {
                beaconPayload.secret = config.secret;
            }
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

        const safePayload = { ...cleanPayload };
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
