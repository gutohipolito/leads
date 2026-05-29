-- Tabela para regras personalizadas de Lead Scoring por Cliente
CREATE TABLE IF NOT EXISTS public.lead_scoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    whatsapp_score INTEGER DEFAULT 50,
    time_on_page_60 INTEGER DEFAULT 20,
    time_on_page_20 INTEGER DEFAULT 10,
    scroll_depth_80 INTEGER DEFAULT 25,
    scroll_depth_50 INTEGER DEFAULT 15,
    paid_traffic INTEGER DEFAULT 20,
    journey_3 INTEGER DEFAULT 15,
    journey_2 INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id)
);

-- Habilitar RLS
ALTER TABLE public.lead_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Admins podem tudo em lead_scoring_rules" ON public.lead_scoring_rules;
CREATE POLICY "Admins podem tudo em lead_scoring_rules" 
ON public.lead_scoring_rules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Clientes podem ver e editar suas regras de lead_scoring_rules" ON public.lead_scoring_rules;
CREATE POLICY "Clientes podem ver e editar suas regras de lead_scoring_rules" 
ON public.lead_scoring_rules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND client_id = public.lead_scoring_rules.client_id
    )
);

-- Adicionar a tabela à publicação realtime do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_scoring_rules;
