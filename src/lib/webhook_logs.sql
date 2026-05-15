-- Tabela de Logs de Webhooks (Sinais de Entrada)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES public.webhooks(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    status_code INTEGER,
    request_body JSONB,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Permitir que o sistema insira logs (sem autenticação, via service key ou chave anônima se permitido no API)
CREATE POLICY "Sistema pode inserir webhook_logs" 
ON public.webhook_logs FOR INSERT 
WITH CHECK (true);

-- Permitir que Admins vejam todos os logs
CREATE POLICY "Admins podem ver todos os webhook_logs" 
ON public.webhook_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND role = 'admin'
    )
);

-- Permitir que Clientes vejam logs de seus próprios webhooks
CREATE POLICY "Clientes podem ver seus próprios webhook_logs" 
ON public.webhook_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'manager' OR role = 'viewer')
        AND client_id = public.webhook_logs.client_id
    )
);
