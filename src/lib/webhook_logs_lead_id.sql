-- Adicionar coluna lead_id na tabela webhook_logs para vincular os envios de CRM diretamente aos leads correspondentes
ALTER TABLE public.webhook_logs 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;
