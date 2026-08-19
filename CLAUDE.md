# Commits e push

- Sempre que uma tarefa pedida pelo usuário for concluída neste projeto (Leads), crie um commit git com as mudanças, sem precisar perguntar antes. Isso substitui, apenas neste repositório, a regra padrão de só commitar quando explicitamente pedido.
- Antes de commitar, revise o que está sendo staged (`git status`/`git diff`) para não incluir arquivos sensíveis ou lixo (ex: `graphify-out/`, `scratch/`, `.claude/` locais) por engano.
- Depois de cada commit feito por essa regra, dê `git push` para `origin` também, sem precisar perguntar antes — o usuário testa em produção, então o deploy (que observa o GitHub) precisa receber o commit. Isso substitui, apenas neste repositório, a regra padrão de só dar push quando explicitamente pedido.
- Só pule o push automático se o próprio usuário pedir explicitamente pra não subir ainda (ex: "não sobe isso agora").
