-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT, -- 'client', 'lead', 'webhook', 'user'
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs
CREATE POLICY "Admins podem ver todos os logs" 
ON system_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM system_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
        AND role = 'admin'
    )
);

-- Permitir inserção via trigger ou função segura (opcional, mas vamos permitir inserts por enquanto para simplificar)
CREATE POLICY "Sistema pode inserir logs" 
ON system_logs FOR INSERT 
WITH CHECK (true);
