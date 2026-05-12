# Plano de Finalização Local — NOVA

## Objetivo

Finalizar o sistema NOVA em ambiente local WSL antes de qualquer preparação de servidor, domínio, IP público, HTTPS, Docker de produção ou deploy.

## Decisão atual

- Desenvolvimento e validação no WSL.
- `main` como base estável.
- Branches temáticas por rodada.
- Infraestrutura de produção adiada.

## Estado atual conhecido

Concluído:

- `main` sincronizada;
- TypeScript validado;
- Prisma validado;
- banco local `nova_ops` em dia;
- dashboard com dados reais;
- login com lembrar acesso;
- cookie normal 8h;
- cookie lembrar acesso 30 dias;
- recuperação de senha;
- shells antigos removidos;
- `NovaLitShell` consolidado;
- breadcrumbs padronizados;
- CSS em `nova-design-system.css`;
- ícones corrigidos;
- rotas principais carregando localmente.

## Milestones locais

### 1. Documentação

- `docs/PLANO_FINALIZACAO.md`
- `docs/ARQUITETURA.md`
- `docs/ROADMAP.md`
- `docs/QA_CHECKLIST.md`
- `docs/HANDOFF.md`

### 2. Hardening local

Validar:

```bash
pnpm approve-builds
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate status
pnpm --filter web build
pnpm --filter api build
git restore apps/api/src/generated/prisma
git status
```

### 3. Responsividade mobile

- menu hamburger;
- drawer/side menu mobile;
- topbar adaptada;
- cards responsivos;
- tabelas com scroll controlado;
- testes em 360px, 768px e desktop.

### 4. Revisão funcional por módulo

Módulos:

- login;
- recuperação de senha;
- dashboard;
- operação;
- chamados;
- exceções;
- alertas;
- usuários;
- perfis;
- parceiros;
- unidades;
- ativos;
- integrações;
- contratos;
- relatórios.

### 5. Testes automatizados

- backend unitário;
- backend integração;
- frontend básico;
- Playwright para fluxos críticos.

### 6. Produção futura

Somente depois do site fechado localmente:

- Docker;
- Caddy/Nginx;
- `.env.production.example`;
- scripts de deploy;
- backup;
- servidor.
