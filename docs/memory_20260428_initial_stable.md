# Memory: Dashboard de Leads Estável - 2026-04-28

## Status
- Projeto: Leads Dashboard
- Framework: Next.js 16 (App Router)
- Build: Sucesso (npm run build)

## Funcionalidades Implementadas
- Estrutura base com Sidebar e Header premium.
- Gestão de clientes (visualização e cards).
- Dashboards geral e por cliente.
- Webhook funcional em `/api/leads/[clientId]` com suporte a CORS.
- Simulador de webhook para testes integrados.
- Design System em CSS Vanilla com Glassmorphism.

## Dependências
- lucide-react (Ícones)
- next/font/google (Outfit)

## Observações Técnicas
- `params` em rotas dinâmicas são Promises (Next.js 15+).
- CSS Modules exigem seletores "puros" (classes em vez de tags puras).
