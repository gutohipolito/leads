-- Tabela para guardar leads resetados/arquivados historicamente
CREATE TABLE IF NOT EXISTS public.archived_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    phone TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    source TEXT,
    created_at TIMESTAMPTZ, -- Mantém a data de criação original do lead
    archived_at TIMESTAMPTZ DEFAULT now() -- Data de quando foi arquivado/resetado
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.archived_leads ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "ArchivedLeads: Admin vê tudo, Cliente vê apenas o seu" ON public.archived_leads;

-- Criar política unificada similar à de leads
CREATE POLICY "ArchivedLeads: Admin vê tudo, Cliente vê apenas o seu" ON public.archived_leads
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'admin' OR client_id = public.archived_leads.client_id)
    )
);
