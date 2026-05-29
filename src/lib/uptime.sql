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
DROP POLICY IF EXISTS "Permitir inserção/edição para admins e o próprio cliente" ON uptime_monitors;

CREATE POLICY "Uptime Monitors: Admin vê tudo, Cliente vê apenas o seu" ON public.uptime_monitors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.system_users 
            WHERE email = auth.jwt() ->> 'email' 
            AND (role = 'admin' OR client_id = public.uptime_monitors.client_id)
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

CREATE POLICY "Uptime Logs: Admin vê tudo, Cliente vê apenas o seu" ON public.uptime_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.uptime_monitors m
            WHERE m.id = public.uptime_logs.monitor_id AND (
                EXISTS (
                    SELECT 1 FROM public.system_users u
                    WHERE u.email = auth.jwt() ->> 'email'
                    AND (u.role = 'admin' OR u.client_id = m.client_id)
                )
            )
        )
    );
