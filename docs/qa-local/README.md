# QA local

Esta pasta reúne os documentos de validação local do projeto.

## Documentos

- [Comandos locais de desenvolvimento e QA](./comandos-locais.md)
- [Checklist de QA visual e operacional local](./checklist-visual-operacional.md)
- [Auditoria local de módulos](../auditoria-local/revisao-modulos.md)

## Fluxo recomendado

Antes de abrir PR, execute:

```bash
corepack pnpm qa:local
git status
```

Critérios esperados:

- testes API passam;
- lint e TypeScript Web passam;
- builds Web/API passam;
- auditoria de módulos roda sem sujar o working tree;
- smoke local passa;
- portas 3010/4000 ficam livres ao final;
- `.tmp` não aparece no `git status`;
- working tree fica limpo antes do push.
