# Memory: ARDENTIS LEADS - Versão Ardentis - 2026-04-28

## Status
- Versão: 4.0 (Ardentis Sleek UI)
- Estética: Modern DeFi, Dark Mode (`#030303`), Cyan Accent (`#56D7FD`), Fundo Granulado (Noise).
- Build: Sucesso (npm run build)

## Mudanças de Design
- **Paleta de Cores**: Migração para a paleta Ardentis baseada nas referências.
- **Textura**: Adição de overlay de ruído (grain) no fundo para um aspecto premium e orgânico.
- **Componentes**:
  - Sidebar minimalista com estados ativos em pílula.
  - Header com perfil detalhado e busca minimalista.
  - Gráficos SVG customizados imitando a referência DeFi.
  - Card de "Upgrade Plan" flutuante para simular uma plataforma real.
- **Tipografia**: Uso consistente da fonte Outfit.

## Correções Técnicas
- `Sidebar` convertida para Client Component para suportar `usePathname`.
- Correção de imports de ícones ausentes (`Bell`).
- Ajuste de margens e responsividade do `innerWrapper`.
