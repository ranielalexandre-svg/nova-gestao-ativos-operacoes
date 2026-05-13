# HANDOFF — NOVA

## Estado atual

- Repositório: `ranielalexandre-svg/nova-gestao-ativos-operacoes`
- Diretório local: `~/projetos/nova-gestao-ativos-operacoes-predeploy`
- Branch estável: `main`
- Branch de docs criada: `docs/plano-finalizacao-local`
- Ambiente de trabalho: WSL local
- Banco local: PostgreSQL `nova_ops`
- Produção/servidor: adiado

## Já concluído/auditado

- `main` sincronizada com `origin/main`
- TypeScript passou
- Prisma generate passou
- Prisma migrate status passou
- Banco local em dia
- Dashboard com dados reais
- Login com lembrar acesso
- Sessão 8h/30 dias
- Recuperação de senha
- `NovaLitShell` consolidado
- Shells antigos removidos
- Breadcrumbs padronizados
- CSS novo em `nova-design-system.css`
- Ícones grandes corrigidos
- Rotas principais testadas manualmente

## Regras para continuar

- Sempre parar preview anterior:
  ```bash
  corepack pnpm dev:down
  ```
- Não reintroduzir `NAV_SECTIONS`, `function Nav(`, `function Topbar(`.
- Páginas internas devem usar `NovaLitShell`.
- CSS estrutural novo deve ir em `apps/web/app/nova-design-system.css`.
- Depois de `prisma generate`, limpar:
  ```bash
  git restore apps/api/src/generated/prisma
  ```
- Ao final de cada rodada, informar:
  - o que foi feito;
  - arquivos alterados;
  - validações executadas;
  - comando para trazer/validar localmente.

## Próxima ordem

1. Aplicar e commitar docs.
2. Rodar hardening local.
3. Implementar responsividade mobile.
4. Criar testes.
5. Revisar módulos.
6. Só depois preparar produção.

## Fluxo local atual

Use o fluxo consolidado em `docs/qa-local/fluxo-local-robusto.md`.

Comandos principais:

```bash
corepack pnpm dev:up
corepack pnpm dev:status
SMOKE_ROUTE_TIMEOUT_MS=45000 SMOKE_HEARTBEAT_MS=5000 corepack pnpm test:smoke
corepack pnpm dev:down
```

Para QA completo:

```bash
corepack pnpm qa:local
```
