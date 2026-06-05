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

    function sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        const lengthProperty = 'length';
        let i, j;
        let result = '';

        const words = [];
        const asciiLength = ascii[lengthProperty] * 8;
        
        const hash = sha256.h = sha256.h || [];
        const k = sha256.k = sha256.k || [];
        let primeCounter = k[lengthProperty];

        const isComposite = {};
        for (let candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        
        ascii += '\x80';
        while (ascii[lengthProperty] % 64 - 56) {
            ascii += '\x00';
        }
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return ''; // supports only ASCII
            words[i >> 2] |= j << ((3 - i % 4) * 8);
        }
        words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
        words[words[lengthProperty]] = (asciiLength | 0);
        
        const hashCurrent = hash.slice(0);
        for (i = 0; i < words[lengthProperty]; i += 16) {
            const w = words.slice(i, i + 16);
            let oldHash = hashCurrent.slice(0);
            for (j = 0; j < 64; j++) {
                const w16 = w[j - 16];
                const w15 = w[j - 15];
                const w7 = w[j - 7];
                const w2 = w[j - 2];

                const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
                const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
                
                const registerWord = w[j] = j < 16 ? (w[j] || 0) : (
                    (w16 + s0 + w7 + s1) | 0
                );
                
                const a = oldHash[0], b = oldHash[1], c = oldHash[2], d = oldHash[3];
                const e = oldHash[4], f = oldHash[5], g = oldHash[6], h = oldHash[7];

                const s0_2 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = s0_2 + maj;
                
                const s1_2 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
                const ch = (e & f) ^ ((~e) & g);
                const t1 = h + s1_2 + ch + k[j] + registerWord;

                oldHash = [(t1 + t2) | 0, a, b, c, (d + t1) | 0, e, f, g];
            }
            
            for (j = 0; j < 8; j++) {
                hashCurrent[j] = (hashCurrent[j] + oldHash[j]) | 0;
            }
        }
        
        for (i = 0; i < 8; i++) {
            const word = hashCurrent[i];
            result += ((word >>> 24) & 255).toString(16).padStart(2, '0') +
                      ((word >>> 16) & 255).toString(16).padStart(2, '0') +
                      ((word >>> 8) & 255).toString(16).padStart(2, '0') +
                      (word & 255).toString(16).padStart(2, '0');
        }
        return result;
    }

    function hexToAscii(hex) {
        let ascii = '';
        for (let i = 0; i < hex.length; i += 2) {
            ascii += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
        }
        return ascii;
    }

    function hmacSha256(key, message) {
        const blocksize = 64;
        if (key.length > blocksize) {
            key = hexToAscii(sha256(key));
        }
        while (key.length < blocksize) {
            key += '\x00';
        }
        
        let ipad = '';
        let opad = '';
        for (let i = 0; i < blocksize; i++) {
            const charCode = key.charCodeAt(i);
            ipad += String.fromCharCode(charCode ^ 0x36);
            opad += String.fromCharCode(charCode ^ 0x5c);
        }
        
        const innerHash = hexToAscii(sha256(ipad + message));
        return sha256(opad + innerHash);
    }

