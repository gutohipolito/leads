    function queueFailedLead(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('asthros_queue', JSON.stringify(queue.slice(-5))); // max 5
        } catch (e) {}
    }

    async function sendPayload(payload) {
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        
        // Beacon apenas no fechamento
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...payload };
            if (config.webhookId) {
                beaconPayload.webhookId = config.webhookId;
            }
            if (config.secret) {
                beaconPayload.secret = config.secret;
            }
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

        const safePayload = { ...payload };
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
