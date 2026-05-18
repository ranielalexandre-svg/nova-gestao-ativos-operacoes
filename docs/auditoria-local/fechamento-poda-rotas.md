# Auditoria de fechamento da poda de rotas

## Resultado

- Redirects mapeados no `next.config.mjs`: 40
- Arquivos sombra candidatos a remoção segura: 7
- Rotas com implementação própria sob redirect: 0

## Interpretação

A poda estrutural já removeu aliases e legados técnicos principais. O próximo corte só deve ocorrer quando a auditoria indicar que o arquivo é redirect simples ou re-export simples.

## Rotas com implementação própria sob redirect

- Nenhuma.

## Arquivos sombra candidatos a remoção segura

- `/operacao/evidencias` -> `/operacao/relatorio-turno`
  - arquivo: `apps/web/app/operacao/evidencias/page.tsx`
  - classificação: `shadowed-simple-redirect`
- `/operacao/pos-incidente` -> `/operacao/war-room`
  - arquivo: `apps/web/app/operacao/pos-incidente/page.tsx`
  - classificação: `shadowed-simple-redirect`
- `/operacao/auditoria-operacional` -> `/operacao/atividade`
  - arquivo: `apps/web/app/operacao/auditoria-operacional/page.tsx`
  - classificação: `shadowed-simple-redirect`
- `/operacao/comunicacao-turno` -> `/operacao/handoff`
  - arquivo: `apps/web/app/operacao/comunicacao-turno/page.tsx`
  - classificação: `shadowed-simple-redirect`
- `/relatorios/monitoramento/automacoes` -> `/operacao/relatorios/monitoramento/automacoes`
  - arquivo: `apps/web/app/relatorios/monitoramento/automacoes/route.ts`
  - classificação: `shadowed-reexport`
- `/relatorios/monitoramento/export-jobs` -> `/operacao/relatorios/monitoramento/export-jobs`
  - arquivo: `apps/web/app/relatorios/monitoramento/export-jobs/route.ts`
  - classificação: `shadowed-reexport`
- `/relatorios/monitoramento/templates` -> `/operacao/relatorios/monitoramento/templates`
  - arquivo: `apps/web/app/relatorios/monitoramento/templates/route.ts`
  - classificação: `shadowed-reexport`

## Regra de continuidade

1. Redirect em `next.config.mjs` sem arquivo no App Router é compatibilidade saudável.
2. Redirect em `next.config.mjs` com arquivo simples de redirect/re-export é candidato a remoção.
3. Redirect em `next.config.mjs` com arquivo de implementação própria exige inversão de dono técnico antes de remoção.
4. Toda remoção precisa manter smoke, verificador runtime e build limpos.
