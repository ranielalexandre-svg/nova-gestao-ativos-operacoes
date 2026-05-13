# Comandos locais de desenvolvimento e QA

Este guia resume os comandos locais usados no projeto.

## Subir ambiente local

```bash
corepack pnpm dev:up
```

Sobe a API em `http://127.0.0.1:4000` e a Web em `http://127.0.0.1:3010`.

Logs:

- `.run-logs/api.log`
- `.run-logs/web.log`

PIDs:

- `.run-pids/api.pid`
- `.run-pids/web.pid`

## Ver status

```bash
corepack pnpm dev:status
```

Mostra portas 3010/4000 e últimas linhas dos logs.

## Parar ambiente local

```bash
corepack pnpm dev:down
```

Encerra processos locais da API/Web e libera as portas 3010/4000.

## QA local completo

```bash
corepack pnpm qa:local
```

Executa testes, builds, auditoria, sobe API/Web temporariamente, roda smoke local e limpa `.tmp` ao final.

## QA local estático

```bash
corepack pnpm qa:local:static
```

Executa testes, build Web, build API e auditoria sem subir servidores temporários.

## Smoke local

```bash
corepack pnpm test:smoke
```

Requer API/Web já rodando. Atualmente cobre 39 rotas Web e 2 endpoints API.

## Builds

```bash
corepack pnpm build:web
corepack pnpm build:api
corepack pnpm build
```

## Testes

```bash
corepack pnpm test:api
corepack pnpm test:web
corepack pnpm test:all
```

## Auditoria de módulos

```bash
corepack pnpm audit:modules
```

Atualiza `docs/auditoria-local/revisao-modulos.md`.

## Fluxo recomendado antes de PR

```bash
corepack pnpm qa:local
git status
```

Critérios:

- `qa:local` passa;
- portas 3010/4000 ficam livres ao final;
- `.tmp` não aparece no status;
- working tree fica limpo antes do push.
