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

    const STORAGE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 dias

    function setLocalItem(key, value) {
        try {
            const item = {
                value: value,
                expiry: Date.now() + STORAGE_TTL
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {}
    }

    function getLocalItem(key) {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            const item = JSON.parse(itemStr);
            if (item && typeof item === 'object' && 'expiry' in item) {
                if (Date.now() > item.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                return item.value;
            }
            return itemStr;
        } catch (e) {
            try {
                return localStorage.getItem(key);
            } catch (err) {
                return null;
            }
        }
    }

    function removeEmpty(obj) {
        if (Array.isArray(obj)) {
            return obj
                .map(v => (v && typeof v === 'object' ? removeEmpty(v) : v))
                .filter(v => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0));
        }
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj)
                    .map(([k, v]) => [k, v && typeof v === 'object' ? removeEmpty(v) : v])
                    .filter(([_, v]) => {
                        if (v === null || v === undefined || v === '') return false;
                        if (Array.isArray(v)) return v.length > 0;
                        if (typeof v === 'object') return Object.keys(v).length > 0;
                        return true;
                    })
            );
        }
        return obj;
    }

    function removeLocalItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }

    function generateEventHash(visitorId, source, timestamp) {
        try {
            const date = new Date(timestamp);
            date.setSeconds(0);
            date.setMilliseconds(0);
            const roundedTime = date.getTime();
            
            const rawString = `${visitorId}:${source}:${roundedTime}`;
            
            let hash = 0;
            for (let i = 0; i < rawString.length; i++) {
                const char = rawString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return Math.abs(hash).toString(16);
        } catch (e) {
            return 'hash_' + randomId();
        }
    }
