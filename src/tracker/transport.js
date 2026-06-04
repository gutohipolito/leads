    function queueFailedLead(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('asthros_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('asthros_queue', JSON.stringify(queue.slice(-5))); // max 5
        } catch (e) {}
    }

    async function sendPayload(payload) {
        const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
        
        // Beacon apenas no fechamento — com secret no corpo como fallback seguro (o backend já aceita)
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
            const beaconPayload = { ...payload, secret: config.secret };
            const blob = new Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }

        // Remove o secret do corpo para envio seguro e exclusivo via cabeçalhos HTTP
        const safePayload = { ...payload };
        if (safePayload.secret) {
            delete safePayload.secret;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Asthros-Secret': config.secret
                },
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
