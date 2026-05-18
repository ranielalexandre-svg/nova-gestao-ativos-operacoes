# Arquitetura de informação - poda global operacional

## Decisão

A navegação principal deve priorizar telas de ação e consulta recorrente. Telas narrativas, derivadas ou de fechamento não devem competir no menu com a fila de trabalho.

## Mantido no menu

- Resumo do turno
- Pendências
- Handoff
- War Room
- Playbooks
- Relatório do turno
- Atividade
- Fila priorizada
- Alertas
- Chamados
- Exceções
- Políticas SLA
- Automações
- Importação
- Reconciliação
- Monitoramento NOC

## Removido do menu principal

- Evidências
- Pós-incidente
- Auditoria operacional
- Comunicação do turno

Essas rotas podem continuar existindo como compatibilidade ou visão interna, mas não devem aparecer como produto principal porque repetem os mesmos sinais operacionais: fila, SLA, NOC, automações, reconciliação, rastro e handoff.

## Destinos consolidados

- Evidências: Relatório do turno
- Pós-incidente: War Room
- Auditoria operacional: Atividade
- Comunicação do turno: Handoff

## Regra para próximas features

Antes de criar uma nova tela operacional, validar se ela é:

1. uma nova ação real;
2. uma nova entidade de domínio;
3. uma consulta frequente e distinta;
4. ou apenas uma narrativa diferente dos mesmos dados.

Se for apenas narrativa, deve virar seção interna, CTA contextual ou export, não item de menu.

## Compatibilidade de rotas narrativas

As rotas narrativas removidas da navegação principal devem permanecer apenas como entradas de compatibilidade, sem renderizar uma experiência paralela.

- `/operacao/evidencias` redireciona para `/operacao/relatorio-turno`
- `/operacao/pos-incidente` redireciona para `/operacao/war-room`
- `/operacao/auditoria-operacional` redireciona para `/operacao/atividade`
- `/operacao/comunicacao-turno` redireciona para `/operacao/handoff`

A regra é evitar telas duplicadas que apresentam os mesmos dados com outro nome. Quando uma visão existir apenas como narrativa, ela deve virar redirect, seção interna ou export contextual.

## Aliases legados canonizados

Aliases antigos devem redirecionar no nível de `next.config.mjs`, antes do App Router, para evitar páginas intermediárias, duplicidade de build e divergência de autenticação.

Aliases mantidos apenas por compatibilidade:

- `/relatorios` -> `/operacao/relatorios`
- `/relatorios/monitoramento` -> `/operacao/relatorios/monitoramento`
- `/integracoes` -> `/monitoramento/fontes`
- `/automacao` -> `/operacao/automacoes`
- `/administracao/*` -> módulos canônicos de operação
- `/importacao` -> `/operacao/importacao`
- `/reconciliacao` e `/reconciliacao-central` -> `/operacao/reconciliacao`
- `/sensores` -> `/monitoramento/sensores`
- `/equipamentos` -> `/ativos`

A navegação nova deve sempre apontar para a rota canônica. Alias não deve ganhar card, menu, CTA ou tela própria.

## Aliases profundos remanescentes

Subrotas antigas também devem ser tratadas no `next.config.mjs`, não por páginas intermediárias no App Router.

Aliases profundos canonizados:

- `/relatorios/consumo` -> `/operacao/relatorios/consumo`
- `/relatorios/disponibilidade` -> `/operacao/relatorios/disponibilidade`
- `/relatorios/performance` -> `/operacao/relatorios/performance`
- `/relatorios/monitoramento/*` -> `/operacao/relatorios/monitoramento/*`
- `/automacao/export` -> `/operacao/automacoes/export`
- `/equipamentos/cadastro` -> `/ativos/cadastro`
- `/equipamentos/:id` -> `/ativos/:id`

Exceção transitória: `/equipamentos/nova` continua apontando para `/equipamentos/cadastro` para preservar o contrato legado de criação até a próxima rodada de migração dos fluxos de cadastro.

## Aliases legados de criação

Rotas antigas de criação com `/novo` ou `/nova` devem existir apenas como redirect HTTP em `next.config.mjs`.

Aliases canonizados:

- `/alertas/novo` -> `/alertas/cadastro`
- `/ativos/nova` -> `/ativos/cadastro`
- `/chamados/novo` -> `/chamados/cadastro`
- `/contratos/novo` -> `/contratos/cadastro`
- `/equipamentos/nova` -> `/equipamentos/cadastro`
- `/excecoes/nova` -> `/operacao/excecoes/cadastro`
- `/manutencoes/nova` -> `/manutencoes/cadastro`
- `/ocorrencias/nova` -> `/ocorrencias/cadastro`
- `/parceiros/nova` -> `/parceiros/cadastro`
- `/unidades/nova` -> `/unidades/cadastro`
- `/usuarios/nova` -> `/usuarios/cadastro`

Novos links, menus e CTAs devem sempre apontar diretamente para `/cadastro` canônico, nunca para `/novo` ou `/nova`.

## Rotas alias eclipsadas por redirects

Quando uma rota antiga já é redirecionada no `next.config.mjs`, o arquivo equivalente no App Router não deve permanecer no build. Manter os dois cria código morto, rotas fantasmas e risco de divergência entre autenticação, export e navegação.

Rotas removidas como arquivos de App Router e mantidas somente como redirect HTTP:

- `/administracao/sla`
- `/administracao/importacao`
- `/relatorios/monitoramento/automacoes`
- `/relatorios/monitoramento/export`
- `/relatorios/monitoramento/export-jobs`
- `/relatorios/monitoramento/templates`
- `/operacao/excecoes/nova`

A regra é: se uma rota existe apenas para compatibilidade, ela fica no `next.config.mjs` e em teste de redirect, não como página ou route handler paralelo.

Observação técnica: `/automacao/export`, `/equipamentos/cadastro` e `/equipamentos/:id` ainda permanecem como fontes internas usadas por rotas canônicas. Elas não devem receber novos menus ou CTAs, mas a remoção física exige primeiro inverter os re-exports para que `/operacao/automacoes/export` e `/ativos/*` sejam donos reais da implementação.

## Donos canônicos de implementação

As rotas canônicas devem ser as fontes reais da implementação. Rotas legadas só podem existir como re-export temporário ou redirect HTTP.

Inversões realizadas:

- `/ativos/cadastro` passa a ser fonte real de cadastro de ativos/equipamentos
- `/ativos/:id` passa a ser fonte real de detalhe de ativos/equipamentos
- `/operacao/automacoes/export` passa a ser fonte real do export de automações

Compatibilidade temporária mantida:

- `/equipamentos/cadastro` reexporta `/ativos/cadastro`
- `/equipamentos/:id` reexporta `/ativos/:id`
- `/automacao/export` reexporta `/operacao/automacoes/export`

A próxima remoção física desses legados só deve ocorrer depois que os verificadores confirmarem que nenhuma rota canônica depende deles.

## Lapidação do cockpit operacional

O `/operacao` deve funcionar como cockpit de turno, não como relatório longo nem mini-menu duplicado.

Regras aplicadas:

- Watchlist mostra apenas unidades com impacto real: offline, atenção, sem vínculo ou métrica fora do limite.
- A lista inicial deve ser curta para caber na leitura do turno.
- O painel lateral deve orientar a próxima ação, não repetir a navegação do menu.
- Indicadores de apoio ficam como bastidor técnico e não competem com fila, SLA e NOC.
- Acima da dobra devem aparecer decisão, pressão e despacho; abaixo ficam contexto e apoio.

## Remoção dos legados técnicos restantes

Depois da inversão dos donos canônicos, os últimos arquivos legados que ainda reexportavam implementação foram removidos do App Router.

Removidos fisicamente:

- `/equipamentos/cadastro`
- `/equipamentos/:id`
- `/automacao/export`

Compatibilidade mantida por redirect HTTP em `next.config.mjs`:

- `/equipamentos/cadastro` -> `/ativos/cadastro`
- `/equipamentos/:id` -> `/ativos/:id`
- `/automacao/export` -> `/operacao/automacoes/export`

A regra final é: rota legada não deve ter arquivo no App Router quando já existe redirect HTTP equivalente.

## Auditoria de fechamento da poda

A poda de rotas deve terminar com uma auditoria explícita de ownership:

- redirect sem arquivo no App Router é compatibilidade saudável;
- redirect com arquivo simples de redirect/re-export é sombra removível;
- redirect com implementação própria exige inversão de dono técnico antes de remoção;
- todo legado removido precisa ficar protegido por verificador automatizado.

O relatório local de auditoria fica em `docs/auditoria-local/fechamento-poda-rotas.md` e deve ser regenerado quando novos aliases forem criados.
