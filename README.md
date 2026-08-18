# Asthros Leads

Sistema interno de captura e gestão de leads/vendas, usado pela agência para atender múltiplos clientes a partir de um único painel. Cada cliente tem seus próprios webhooks/terminais de captura; a equipe da agência (não os clientes finais) acessa tudo pelo painel.

## O que o sistema faz

- **Captura de leads**: um script de rastreamento (`src/tracker/*.js`, concatenado e ofuscado em `public/tracker.js` pelo `obfuscate-tracker.js`) é embutido nos sites dos clientes e envia eventos de lead (formulário, clique de WhatsApp, seletores/keywords customizados) para `POST /api/leads/[clientId]`.
- **Captura de vendas/compras**: webhooks dedicados para WooCommerce (`/api/webhooks/woo/[secret]`), integrações genéricas de e-commerce (`/api/webhooks/commerce/[webhookId]`) e um endpoint genérico (`/api/webhooks/purchases/[clientId]`).
- **Painel administrativo**: leads, compras, clientes, usuários, integrações, webhooks, relatórios (PDF/CSV/JSON), monitoramento de uptime, logs de auditoria e segurança — tudo em `src/app/*`.
- **Integrações de saída**: reenvio de leads para CRMs/automação (HubSpot, ActiveCampaign, RD Station, Pipedrive, PipeRun, Kommo, Leadlovers, Z-API, Meta CAPI, webhook genérico) via `src/lib/handlePurchaseIngest.ts` e `src/utils/integrations.ts`.
- **Segurança de dados**: email/telefone dos leads são criptografados em repouso (AES-256-GCM, `src/utils/encryption.ts`) e só são decriptados no servidor sob demanda (`/api/security/decrypt`) para usuários autenticados — a chave nunca é enviada ao navegador.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript
- **Supabase** (Postgres + Auth) — schema em `src/lib/schema.sql`, políticas de RLS em `src/lib/rls_real.sql`
- `jspdf`/`jspdf-autotable` para relatórios em PDF (carregados sob demanda)
- `recharts` para gráficos, `@react-map/brazil` para o mapa de leads por estado

## Modelo de dados (resumo)

- `clients` — empresas atendidas pela agência
- `system_users` — usuários do painel (`role`: admin/manager/viewer; `client_id` opcional)
- `webhooks` — terminais de captura por cliente (secret próprio)
- `leads` / `purchases` — dados capturados, com email/telefone criptografados

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente (`.env.local`)

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser, respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente Supabase admin (server-side, ignora RLS) |
| `LEADS_ENCRYPTION_KEY` | Chave de criptografia de email/telefone dos leads — **crítica**: mudar o valor torna dados já gravados ilegíveis |
| `APP_JWT_SECRET` | Segredo de assinatura dos tokens temporários do tracker |
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Captcha da tela de login (desativado automaticamente em `localhost`) |
| `CRON_SECRET` | Autoriza o cron externo a chamar `/api/uptime/check` |

O Turnstile e o CAPTCHA do Supabase Auth (Authentication → Attack Protection) protegem o login em produção — veja a seção de troubleshooting abaixo antes de desativar qualquer um dos dois.

## Estrutura do projeto

```
src/app/            páginas (App Router) e rotas de API (src/app/api/*)
src/components/     componentes de UI compartilhados
src/lib/            integrações de servidor, SQL de schema/migrações, ingestão de compras
src/tracker/        módulos-fonte do script de rastreamento (concatenados em build)
src/utils/          criptografia, logger, helpers
scratch/            scripts de investigação/debug locais (não versionado, `.gitignore`)
docs/               notas de sessões de desenvolvimento assistido por IA (não versionado)
```

## Notas de build

- `npm run dev`/`npm run build` rodam `obfuscate-tracker.js` antes de iniciar o Next.js: ele concatena `src/tracker/*.js` em `src/tracker-source.js` e gera `public/tracker.js`/`public/tracker.min.js` (versão ofuscada por regex, não um minificador real — ver decisão registrada no histórico do projeto antes de trocar essa etapa, pois esse script roda ao vivo nos sites dos clientes).
