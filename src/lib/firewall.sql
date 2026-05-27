-- Tabela de Firewall de IPs
CREATE TABLE IF NOT EXISTS public.ip_firewall (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    blocked_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    city TEXT,
    country TEXT
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.ip_firewall ENABLE ROW LEVEL SECURITY;

-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "Admins podem fazer tudo no firewall" ON public.ip_firewall;

-- Política de RLS única: Admin tem acesso completo (ALL)
CREATE POLICY "Admins podem fazer tudo no firewall"
ON public.ip_firewall FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND role = 'admin'
    )
);

-- Adicionar a tabela ao canal de Realtime do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_firewall;
