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
