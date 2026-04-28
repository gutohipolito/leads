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
