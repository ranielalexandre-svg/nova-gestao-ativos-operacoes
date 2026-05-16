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
