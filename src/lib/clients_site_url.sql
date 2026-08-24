-- Adicionar URL do site na tabela de clientes e marcar origem dos monitores de uptime
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS site_url TEXT;

-- Identifica se o monitor foi criado automaticamente a partir do cadastro do cliente,
-- para permitir sincronizar (sem duplicar) quando o site_url do cliente for editado.
ALTER TABLE public.uptime_monitors
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
CHECK (source IN ('manual', 'auto'));
