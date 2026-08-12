-- Permite excluir vendas: admin exclui qualquer uma, cliente exclui apenas as suas.
-- Sem essa policy o botao "Excluir Venda" falha silenciosamente (RLS bloqueia DELETE por padrao).
-- Rode no SQL Editor do Supabase (projeto do Asthros Leads).

CREATE POLICY "Purchases: admin exclui tudo, cliente exclui o seu" ON public.purchases
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.system_users
        WHERE email = auth.jwt() ->> 'email'
        AND (role = 'admin' OR client_id = public.purchases.client_id)
    )
);
