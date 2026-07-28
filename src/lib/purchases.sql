-- Tabela de Vendas / Compras (Ingestão de Webhooks Shopify, Yampi, etc.)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    visitor_id TEXT,
    order_id TEXT NOT NULL,
    gateway TEXT DEFAULT 'generic',
    customer_name TEXT,
    customer_email TEXT,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'approved',
    currency TEXT DEFAULT 'BRL',
    items JSONB DEFAULT '[]'::jsonb,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Permissivo para leitura e inserção
CREATE POLICY "Permitir leitura de compras" ON public.purchases
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de compras" ON public.purchases
    FOR INSERT WITH CHECK (true);

-- Adicionar a publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
