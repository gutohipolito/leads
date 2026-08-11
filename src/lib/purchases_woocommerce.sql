-- WooCommerce / Shopify: telefone do cliente e upsert por pedido
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_client_order_unique
ON public.purchases (client_id, order_id);
