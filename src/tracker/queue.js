    let isFlushing = false;
    let asthrosChannel = null;
    let flushSafetyTimeout = null;

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            asthrosChannel = new BroadcastChannel('asthros_channel');
            asthrosChannel.onmessage = (event) => {
                if (event.data) {
                    if (event.data.action === 'flush_start') {
                        isFlushing = true;
                        if (flushSafetyTimeout) clearTimeout(flushSafetyTimeout);
                        flushSafetyTimeout = setTimeout(() => {
                            isFlushing = false;
                        }, 20000); // 20 segundos de segurança
                    } else if (event.data.action === 'flush_end') {
                        isFlushing = false;
                        if (flushSafetyTimeout) clearTimeout(flushSafetyTimeout);
                    }
                }
            };
        } catch (e) {}
    }

    async function executeFlush() {
        try {
            let queue = getLocalItem('asthros_queue') || [];
            if (!queue.length) return;

            // Só tenta reenviar se tiver passado mais de 1 minuto desde a última tentativa
            const lastTry = parseInt(getLocalItem('asthros_queue_last_try') || '0');
            if (Date.now() - lastTry < 60 * 1000) {
                return;
            }

            // Expiração da fila offline: remove leads com mais de 7 dias
            const QUEUE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
            const now = Date.now();
            const originalLength = queue.length;

            queue = queue.filter(item => {
                const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : now;
                return (now - itemTime) <= QUEUE_TTL;
            });

            if (queue.length !== originalLength) {
                if (queue.length > 0) {
                    setLocalItem('asthros_queue', queue);
                } else {
                    removeLocalItem('asthros_queue');
                    removeLocalItem('asthros_queue_last_try');
                    return;
                }
            }

            isFlushing = true;
            if (asthrosChannel) {
                try {
                    asthrosChannel.postMessage({ action: 'flush_start' });
                } catch (e) {}
            }
            setLocalItem('asthros_queue_last_try', Date.now().toString());

            const endpoint = `${config.apiUrl}/api/leads/${config.clientId}`;
            const failedItems = [];

            // Força a obtenção de um token temporário fresco para o flush offline
            let token = null;
            if (config.webhookId) {
                try {
                    token = await getAuthToken();
                } catch (e) {}
            }

            for (const payload of queue) {
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

                    // Aplica uma nova assinatura válida ao lead usando o token atualizado
                    const finalPayload = config.webhookId ? await signPayload(payload, token) : payload;

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(finalPayload),
                        keepalive: true
                    });
                    if (!response.ok) {
                        failedItems.push(payload);
                    }
                } catch (e) {
                    failedItems.push(payload);
                }
            }

            // Apenas atualiza o localStorage no final do processamento
            if (failedItems.length > 0) {
                try {
                    // Mescla os itens que falharam com novos leads que possam ter entrado na fila no meio do caminho
                    const currentQueue = getLocalItem('asthros_queue') || [];
                    const mergedQueue = [...failedItems];
                    
                    currentQueue.forEach(item => {
                        const isDuplicate = failedItems.some(f => 
                            (f.lead_id && f.lead_id === item.lead_id) || 
                            (!f.lead_id && f.timestamp === item.timestamp && f.name === item.name)
                        );
                        if (!isDuplicate) {
                            mergedQueue.push(item);
                        }
                    });
                    
                    // Ordenação crescente por importância: prioridade 1 (alta), 2 (média), 3 (baixa)
                    mergedQueue.sort((a, b) => (a.priority || 3) - (b.priority || 3));
                    
                    setLocalItem('asthros_queue', mergedQueue.slice(0, 5));
                } catch (e) {
                    failedItems.sort((a, b) => (a.priority || 3) - (b.priority || 3));
                    setLocalItem('asthros_queue', failedItems.slice(0, 5));
                }
            } else {
                try {
                    // Limpa apenas os leads que foram enviados com sucesso, mantendo novos leads que entraram no meio do caminho
                    const currentQueue = getLocalItem('asthros_queue') || [];
                    const remainingQueue = currentQueue.filter(item => 
                        !queue.some(q => 
                            (q.lead_id && q.lead_id === item.lead_id) || 
                            (!q.lead_id && q.timestamp === item.timestamp && q.name === item.name)
                        )
                    );
                    
                    if (remainingQueue.length > 0) {
                        setLocalItem('asthros_queue', remainingQueue.slice(-5));
                    } else {
                        removeLocalItem('asthros_queue');
                        removeLocalItem('asthros_queue_last_try');
                    }
                } catch (e) {
                    removeLocalItem('asthros_queue');
                    removeLocalItem('asthros_queue_last_try');
                }
            }
        } catch (err) {
        } finally {
            isFlushing = false;
            if (asthrosChannel) {
                try {
                    asthrosChannel.postMessage({ action: 'flush_end' });
                } catch (e) {}
            }
            if (flushSafetyTimeout) {
                clearTimeout(flushSafetyTimeout);
            }
        }
    }

    async function flushQueue() {
        if (isFlushing) return;

        // Se o navegador suportar Web Locks API, usamos o lock atômico nativo (concorrência perfeita multi-abas)
        if (navigator.locks) {
            try {
                await navigator.locks.request('asthros_flush_lock', { ifAvailable: true }, async (lock) => {
                    if (!lock) return; // Outra aba já está processando
                    await executeFlush();
                });
                return;
            } catch (e) {}
        }

        // Fallback: Lock baseado em localStorage aprimorado com ID único e delay de verificação para atomicidade artificial
        const lockKey = 'asthros_flush_lock';
        const myTabId = randomId();

        try {
            const existingLock = getLocalItem(lockKey);
            if (existingLock) {
                const parts = existingLock.split(':');
                const lockTime = parseInt(parts[1] || '0');
                if (Date.now() - lockTime < 10000) {
                    return; // Outra aba tem um lock válido e ativo
                }
            }

            const lockValue = `${myTabId}:${Date.now()}`;
            setLocalItem(lockKey, lockValue);

            // Pequeno delay para verificar se outra aba concorrente gravou por cima
            await new Promise(function(resolve) { setTimeout(resolve, 50); });

            const currentLock = getLocalItem(lockKey);
            if (currentLock !== lockValue) {
                return; // Perdemos a disputa de concorrência
            }

            await executeFlush();
        } catch (e) {
        } finally {
            // Só remove o lock se ele ainda for nosso (evita remover locks de outras abas)
            try {
                const finalLock = getLocalItem(lockKey);
                if (finalLock && finalLock.startsWith(myTabId)) {
                    removeLocalItem(lockKey);
                }
            } catch (e) {}
        }
    }
