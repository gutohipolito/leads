-- Criar tabela de monitores de uptime
CREATE TABLE IF NOT EXISTS uptime_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'checking' CHECK (status IN ('online', 'offline', 'checking')),
    last_ping_ms INT,
    last_checked TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela uptime_monitors
ALTER TABLE uptime_monitors ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para uptime_monitors
DROP POLICY IF EXISTS "Permitir leitura para o próprio cliente" ON uptime_monitors;
CREATE POLICY "Permitir leitura para o próprio cliente" ON uptime_monitors
    FOR SELECT USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM system_users WHERE client_id = uptime_monitors.client_id
        ) OR 
        EXISTS (
            SELECT 1 FROM system_users WHERE email = (select auth.jwt() ->> 'email') AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Permitir inserção/edição para admins e o próprio cliente" ON uptime_monitors;
CREATE POLICY "Permitir inserção/edição para admins e o próprio cliente" ON uptime_monitors
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM system_users WHERE client_id = uptime_monitors.client_id
        ) OR 
        EXISTS (
            SELECT 1 FROM system_users WHERE email = (select auth.jwt() ->> 'email') AND role = 'admin'
        )
    );

-- Criar tabela de histórico de logs de uptime
CREATE TABLE IF NOT EXISTS uptime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
    status_code INT,
    response_time_ms INT,
    is_up BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela uptime_logs
ALTER TABLE uptime_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para uptime_logs
DROP POLICY IF EXISTS "Permitir leitura para o próprio cliente" ON uptime_logs;
CREATE POLICY "Permitir leitura para o próprio cliente" ON uptime_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM uptime_monitors m 
            WHERE m.id = uptime_logs.monitor_id AND (
                auth.jwt() ->> 'email' IN (
                    SELECT email FROM system_users WHERE client_id = m.client_id
                ) OR 
                EXISTS (
                    SELECT 1 FROM system_users WHERE email = (select auth.jwt() ->> 'email') AND role = 'admin'
                )
            )
        )
    );
