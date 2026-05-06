-- Script para criar o primeiro Administrador no banco de dados
-- IMPORTANTE: Você deve primeiro criar o usuário no painel do Supabase (Authentication > Users)
-- Depois, execute este script substituindo o e-mail pelo e-mail que você cadastrou.

INSERT INTO public.system_users (name, email, role, status)
VALUES (
    'Administrador Geral', 
    'seu-email@aqui.com', -- <--- SUBSTITUA PELO SEU E-MAIL
    'admin', 
    'active'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', status = 'active';
