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
