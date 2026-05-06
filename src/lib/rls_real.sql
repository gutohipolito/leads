-- Políticas de Segurança RLS (Row Level Security) Avançadas
-- Estas políticas garantem que um cliente só veja seus próprios dados

-- 1. Remover políticas de teste anteriores (se existirem)
DROP POLICY IF EXISTS "Permitir tudo" ON public.clients;
DROP POLICY IF EXISTS "Permitir tudo" ON public.leads;
DROP POLICY IF EXISTS "Permitir tudo" ON public.webhooks;
DROP POLICY IF EXISTS "Permitir tudo" ON public.system_users;

-- 2. Política para Leads
CREATE POLICY "Leads: Admin vÊ tudo, Cliente vê apenas o seu" ON public.leads
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'admin' OR client_id = public.leads.client_id)
    )
);

-- 3. Política para Clientes
CREATE POLICY "Clients: Admin vê tudo, Cliente vê apenas o seu" ON public.clients
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'admin' OR id = public.clients.id)
    )
);

-- 4. Política para Webhooks
CREATE POLICY "Webhooks: Admin vê tudo, Cliente vê apenas o seu" ON public.webhooks
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = auth.jwt() ->> 'email' 
        AND (role = 'admin' OR client_id = public.webhooks.client_id)
    )
);

-- 5. Política para System Users (Perfil)
CREATE POLICY "Users: Cada um vê o seu ou Admin vê todos" ON public.system_users
FOR ALL USING (
    email = auth.jwt() ->> 'email' OR 
    EXISTS (SELECT 1 FROM public.system_users WHERE email = auth.jwt() ->> 'email' AND role = 'admin')
);
