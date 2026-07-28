-- Adicionar coluna de E-commerce na tabela de clientes
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_ecommerce BOOLEAN DEFAULT FALSE;
