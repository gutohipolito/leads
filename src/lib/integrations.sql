-- Tabela de Configurações das Integrações (Hub de Integrações)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'hubspot', 'activecampaign', 'zapi')),
    config JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "Permissões de Integrações baseadas no Cliente" ON public.integrations;

-- Políticas de RLS: Admins acessam tudo, parceiros gerenciam apenas as próprias integrações
CREATE POLICY "Permissões de Integrações baseadas no Cliente" ON public.integrations
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'admin' OR client_id = public.integrations.client_id)
    )
);

-- Adicionar a tabela ao painel do Realtime do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.integrations;
