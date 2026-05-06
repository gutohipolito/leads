-- Tabelas principais do sistema de Leads

-- 1. Clientes (Empresas)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Usuários do Sistema
CREATE TABLE IF NOT EXISTS public.system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Webhooks (Configurações de captura)
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url_slug TEXT NOT NULL, -- Parte da URL: /api/webhook/[slug]
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    secret TEXT NOT NULL,
    validation_type TEXT DEFAULT 'header' CHECK (validation_type IN ('header', 'query')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, url_slug)
);

-- 4. Leads (Capturas)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    webhook_id UUID REFERENCES public.webhooks(id) ON DELETE SET NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security) - Comando Corrigido
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
