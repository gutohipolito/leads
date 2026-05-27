-- Migração para estender o suporte aos novos provedores na tabela public.integrations
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_type_check CHECK (type IN ('webhook', 'hubspot', 'activecampaign', 'zapi', 'rdstation', 'pipedrive', 'piperun', 'kommo', 'leadlovers'));
