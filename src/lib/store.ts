export interface Webhook {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive';
  secret: string;
  validationType: 'header' | 'query';
}

export interface Client {
  id: string;
  name: string;
  webhooks: Webhook[];
  status: 'active' | 'inactive';
  createdAt: string;
  leadsCount: number;
}

export interface Lead {
  id: string;
  clientId: string;
  webhookId: string;
  name: string;
  email: string;
  phone: string;
  data: any;
  createdAt: string;
}

// Dados simulados iniciais
export const mockClients: Client[] = [
  {
    id: "1",
    name: "Clínica Sanches",
    webhooks: [
      { id: "w1", name: "Formulário Site", url: "https://leads-dash.com/api/webhook/1/w1", status: 'active', secret: 'whsec_7d2f...91a2', validationType: 'header' },
      { id: "w2", name: "Campanha Facebook", url: "https://leads-dash.com/api/webhook/1/w2", status: 'active', secret: 'whsec_3e1a...88b1', validationType: 'query' },
    ],
    status: 'active',
    createdAt: "2026-04-20",
    leadsCount: 124,
  },
  {
    id: "2",
    name: "Suprema Estética",
    webhooks: [
      { id: "w3", name: "Lading Page", url: "https://leads-dash.com/api/webhook/2/w3", status: 'active', secret: 'whsec_9c4d...22f3', validationType: 'header' },
    ],
    status: 'active',
    createdAt: "2026-04-25",
    leadsCount: 85,
  },
];

export const mockLeads: Lead[] = [
  { id: "l1", clientId: "1", webhookId: "w1", name: "João Silva", email: "joao@email.com", phone: "(11) 99999-9999", data: { message: "Consulta" }, createdAt: new Date().toISOString() },
  { id: "l2", clientId: "2", webhookId: "w3", name: "Maria Oliveira", email: "maria@email.com", phone: "(48) 98888-8888", data: { service: "Limpeza" }, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "l3", clientId: "1", webhookId: "w2", name: "Ricardo Souza", email: "ricardo@email.com", phone: "(11) 97777-7777", data: { plan: "Premium" }, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "l4", clientId: "2", webhookId: "w3", name: "Ana Costa", email: "ana@email.com", phone: "(21) 96666-6666", data: { source: "Instagram" }, createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "l5", clientId: "1", webhookId: "w1", name: "Pedro Rocha", email: "pedro@email.com", phone: "(11) 95555-5555", data: { interest: "SEO" }, createdAt: new Date().toISOString() },
  { id: "l6", clientId: "1", webhookId: "w1", name: "Julia Lima", email: "julia@email.com", phone: "(11) 94444-4444", data: { note: "Urgente" }, createdAt: new Date().toISOString() },
  { id: "l7", clientId: "1", webhookId: "w1", name: "Carlos Magno", email: "carlos@email.com", phone: "(11) 93333-3333", data: { budget: "5000" }, createdAt: new Date().toISOString() },
  { id: "l8", clientId: "1", webhookId: "w1", name: "Fernanda Dias", email: "fer@email.com", phone: "(11) 92222-2222", data: { from: "Google" }, createdAt: new Date().toISOString() },
];
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: 'active' | 'revoked';
  lastUsed: string;
}

export interface SecurityEvent {
  id: string;
  type: 'access' | 'key_change' | 'firewall' | 'threat';
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

export const mockApiKeys: ApiKey[] = [
  { id: '1', name: 'Main Production Key', key: 'ast_live_••••••••••••4f2d', status: 'active', lastUsed: '2026-04-28 15:30' },
  { id: '2', name: 'Staging Environment', key: 'ast_test_••••••••••••92a1', status: 'active', lastUsed: '2026-04-27 10:15' },
  { id: '3', name: 'Old CRM Integration', key: 'ast_live_••••••••••••88cc', status: 'revoked', lastUsed: '2026-04-15 11:00' },
];

export const mockSecurityEvents: SecurityEvent[] = [
  { id: '1', type: 'access', description: 'Novo login detectado: Administrador (IP: 189.12.43.10)', timestamp: '2026-04-28 15:45', severity: 'low' },
  { id: '2', type: 'threat', description: 'Bloqueio de IP por múltiplas requisições: 45.23.11.201', timestamp: '2026-04-28 14:20', severity: 'high' },
];

// O usuário logado agora é gerenciado pelo Supabase Auth.
// Removido o mock estático para evitar conflitos de sessão.
