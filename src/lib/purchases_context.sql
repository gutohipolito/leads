-- Contexto rico da venda (device, localização, jornada, marketing) + UTMs extras
-- Rode no SQL Editor do Supabase (projeto do Asthros Leads).

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS utm_term TEXT;

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS utm_content TEXT;

COMMENT ON COLUMN public.purchases.context IS
  'Snapshot de atribuição: device, location, behavior, marketing, journey';
