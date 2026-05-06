-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Usuários podem ver suas próprias notificações" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver notificações de seus clientes" 
ON notifications FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM system_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
        AND role = 'admin'
    )
);
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
