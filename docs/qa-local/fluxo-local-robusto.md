# Fluxo local robusto de desenvolvimento e QA

Este guia consolida o fluxo local depois da padronização das rotas `/cadastro`, do smoke expandido e da unificação do cleanup dos scripts locais.

## Fluxo recomendado para desenvolvimento

```bash
corepack pnpm dev:up
corepack pnpm dev:status
SMOKE_ROUTE_TIMEOUT_MS=45000 SMOKE_HEARTBEAT_MS=5000 corepack pnpm test:smoke
corepack pnpm dev:down
```

Resultado esperado:

- API em `http://127.0.0.1:4000`;
- Web em `http://127.0.0.1:3010`;
- smoke passando com rotas Web, redirects legados e endpoints API;
- portas 3010/4000 livres após `dev:down`;
- nenhum processo `node`, `pnpm`, `nest` ou `next` relacionado sobrando.

## Subir ambiente local

```bash
corepack pnpm dev:up
```

O comando encerra ambiente anterior usando cleanup comum, sobe API/Web, grava logs em `.run-logs/`, grava PIDs em `.run-pids/` e aguarda API/Web responderem.

## Ver status

```bash
corepack pnpm dev:status
```

Mostra portas 3010/4000, processos locais relacionados e últimas linhas dos logs.

## Parar ambiente local

```bash
corepack pnpm dev:down
```

Encerra API/Web por PID e grupo de processo. Não usa `kill -9` por padrão.

Força manual explícita:

```bash
LOCAL_DEV_FORCE_KILL=1 corepack pnpm dev:down
```

## Rodar smoke com progresso

```bash
SMOKE_ROUTE_TIMEOUT_MS=45000 SMOKE_HEARTBEAT_MS=5000 corepack pnpm test:smoke
```

O smoke mostra índice da rota, rota atual, status HTTP, redirect, tempo decorrido e heartbeat quando uma rota demora.

Cobertura esperada:

- rotas Web principais;
- rotas canônicas `/cadastro`;
- redirects legados `/novo` e `/nova` para `/cadastro`;
- endpoints API `/health` e `/auth/session`.

## Rotas pesadas opcionais

```bash
SMOKE_INCLUDE_HEAVY=1 SMOKE_ROUTE_TIMEOUT_MS=90000 SMOKE_HEARTBEAT_MS=5000 corepack pnpm test:smoke
```

Use para validar páginas mais custosas, como mapas/telemetria.

## QA local completo

```bash
corepack pnpm qa:local
```

Executa testes, builds, auditoria, diff check, subida temporária de API/Web, smoke local e cleanup final.

Resultado esperado:

- `QA local concluido com sucesso.`;
- portas 3010/4000 livres ao final;
- sem processos relacionados sobrando.

Força manual no cleanup do QA:

```bash
QA_FORCE_KILL=1 corepack pnpm qa:local
```

## QA local estático

```bash
corepack pnpm qa:local:static
```

Executa testes, builds e auditoria sem subir servidores temporários.

## Rotas canônicas de cadastro

As rotas de criação seguem o padrão:

```text
/<recurso>/cadastro
```

Exemplos:

- `/alertas/cadastro`
- `/ativos/cadastro`
- `/chamados/cadastro`
- `/contratos/cadastro`
- `/equipamentos/cadastro`
- `/excecoes/cadastro`
- `/manutencoes/cadastro`
- `/ocorrencias/cadastro`
- `/parceiros/cadastro`
- `/unidades/cadastro`
- `/usuarios/cadastro`

As rotas antigas `/novo` e `/nova` continuam existindo apenas como compatibilidade e devem redirecionar para `/cadastro`.

## Variáveis úteis

| Variável | Uso |
| --- | --- |
| `WEB_PORT` | Porta da Web. Padrão: `3010`. |
| `API_PORT` | Porta da API. Padrão: `4000`. |
| `WEB_BASE_URL` | URL base da Web. |
| `API_BASE_URL` | URL base da API. |
| `SMOKE_ROUTE_TIMEOUT_MS` | Timeout por rota do smoke. |
| `SMOKE_HEARTBEAT_MS` | Intervalo do heartbeat do smoke. |
| `SMOKE_INCLUDE_HEAVY` | Inclui rotas pesadas quando `1`. |
| `LOCAL_DEV_FORCE_KILL` | Permite força no `dev:down` quando `1`. |
| `QA_FORCE_KILL` | Permite força no cleanup do `qa:local` quando `1`. |

## Fluxo recomendado antes de PR

```bash
corepack pnpm qa:local
git status
```

Critérios:

- QA passa;
- smoke passa;
- portas 3010/4000 ficam livres;
- working tree fica limpo, exceto alterações intencionais;
- não há processos locais relacionados sobrando.
