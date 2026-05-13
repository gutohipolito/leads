# Memória: Refinamento de UI do Monitor Live (13/05/2026)

## Objetivo
Finalizar a interface do "Asthros Live" para um padrão de produção, removendo elementos de distração e otimizando a navegação de clientes.

## Alterações Realizadas
1. **Remoção do Footer Slider:**
   - O ticker giratório infinito no rodapé foi removido para evitar excesso de movimento na tela.
   - Substituído por uma barra de status estática e limpa.
2. **Upgrade do Header Slider (Seletor de Clientes):**
   - Aumento da escala visual de todos os itens (Logos 42px, títulos 0.9rem).
   - Aumento do `max-width` do container para 1100px.
   - Implementação de filtro lógico: apenas clientes com **status ativo** E que possuem pelo menos um **webhook ativo** são exibidos.
3. **Navegação:**
   - As setas de navegação lateral foram mantidas para facilitar a troca de visão em telas touch ou via mouse.

## Estado de Estabilidade
O monitor está funcional, com integração Supabase Realtime ativa e filtros de cliente operacionais. Ponto de restauração marcado após push para `master` (commit `3353c9f`).

## Pendências Identificadas
- Validar se o filtro de webhooks precisa ser reativo caso o status do webhook mude sem recarregar a página (atualmente carregado no `useEffect` inicial).
- Considerar animação de transição de entrada ao trocar o cliente selecionado no dashboard principal.
