export interface Client {
  id: string;
  name: string;
  webhookUrl: string;
  createdAt: string;
  leadsCount: number;
}

export interface Lead {
  id: string;
  clientId: string;
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
    webhookUrl: "https://leads-dash.com/api/webhook/1",
    createdAt: "2026-04-20",
    leadsCount: 124,
  },
  {
    id: "2",
    name: "Suprema Estética",
    webhookUrl: "https://leads-dash.com/api/webhook/2",
    createdAt: "2026-04-25",
    leadsCount: 85,
  },
];

export const mockLeads: Lead[] = [
  {
    id: "l1",
    clientId: "1",
    name: "João Silva",
    email: "joao@email.com",
    phone: "(11) 99999-9999",
    data: { message: "Gostaria de agendar uma consulta" },
    createdAt: "2026-04-28T10:00:00Z",
  },
  {
    id: "l2",
    clientId: "2",
    name: "Maria Oliveira",
    email: "maria@email.com",
    phone: "(48) 98888-8888",
    data: { service: "Limpeza de pele" },
    createdAt: "2026-04-28T11:30:00Z",
  },
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
  { id: '3', type: 'key_change', description: 'Nova chave de API gerada para Clínica Sanches', timestamp: '2026-04-28 12:10', severity: 'medium' },
  { id: '4', type: 'firewall', description: 'Domínio secundário adicionado ao Whitelist', timestamp: '2026-04-27 18:00', severity: 'low' },
];
