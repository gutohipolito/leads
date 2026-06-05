    function sanitize(value) {
        if (!value) return '';
        return String(value).replace(/[<>]/g, '').substring(0, 500).trim();
    }

    function sanitizeButtonText(text) {
        if (!text) return '';
        return String(text)
            .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[cartão]')
            .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[cpf]')
            .substring(0, 100)
            .trim();
    }

    function generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback robusto usando Math.random
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function randomId() {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' && typeof Uint8Array !== 'undefined') {
            try {
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                return Array.from(arr)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } catch (e) {}
        }
        // Fallback robusto usando Math.random se crypto não estiver disponível
        return 'temp_' + Math.random().toString(36).substring(2, 18);
    }
