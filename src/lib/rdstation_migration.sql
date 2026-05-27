-- Migração para adicionar suporte ao provedor RD Station na tabela de integrações
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_type_check CHECK (type IN ('webhook', 'hubspot', 'activecampaign', 'zapi', 'rdstation'));
