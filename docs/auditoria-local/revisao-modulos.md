# Auditoria local de módulos

Branch: codex/cobertura-modulos-api-2
Atualizado em: gerado por `corepack pnpm audit:modules`

## Resumo executivo

- Arquivos estruturais da API encontrados: 69
- Testes API existentes: 21
- Grupos/módulos API mapeados: 23
- Rotas Web mapeadas: 91
- Componentes Web mapeados: 28
- Módulos API de prioridade alta sem teste direto: 8
- Grupos Web de prioridade alta: 8

## Prioridades recomendadas

### API - prioridade alta

- attachments: sem teste de controller/service
- automations: sem teste de controller/service
- exceptions: sem teste de controller/service
- integrations: sem teste de controller/service
- maintenances: sem teste de controller/service
- monitoring: sem teste de controller/service
- occurrences: sem teste de controller/service
- starlinks: sem teste de controller/service

### API - prioridade média

- prisma: sem teste de service

### Web - prioridade alta

- ativos: 7 page(s), 0 route handler(s)
- chamados: 4 page(s), 0 route handler(s)
- contratos: 4 page(s), 0 route handler(s)
- dashboard: 1 page(s), 0 route handler(s)
- excecoes: 3 page(s), 1 route handler(s)
- parceiros: 3 page(s), 0 route handler(s)
- unidades: 3 page(s), 0 route handler(s)
- usuarios: 3 page(s), 1 route handler(s)

## Matriz API

| Módulo | Controllers | Services | Specs | Status | Prioridade |
| --- | --- | --- | --- | --- | --- |
| (root) | 2 | 1 | 2 | com teste | baixa |
| activities | 1 | 1 | 2 | com teste | baixa |
| attachments | 1 | 1 | 0 | sem teste de controller/service | alta |
| audits | 1 | 1 | 2 | com teste | baixa |
| auth | 1 | 1 | 1 | com teste | baixa |
| automations | 1 | 1 | 0 | sem teste de controller/service | alta |
| contracts | 1 | 1 | 1 | com teste | baixa |
| dashboard | 1 | 1 | 2 | com teste | baixa |
| e2e | 0 | 0 | 1 | com teste | baixa |
| equipments | 1 | 1 | 2 | com teste | baixa |
| exceptions | 1 | 1 | 0 | sem teste de controller/service | alta |
| import-export | 1 | 1 | 1 | com teste | baixa |
| integrations | 1 | 1 | 0 | sem teste de controller/service | alta |
| legacy | 2 | 1 | 1 | com teste | baixa |
| maintenances | 1 | 1 | 0 | sem teste de controller/service | alta |
| monitoring | 1 | 3 | 0 | sem teste de controller/service | alta |
| occurrences | 1 | 1 | 0 | sem teste de controller/service | alta |
| partners | 1 | 1 | 1 | com teste | baixa |
| prisma | 0 | 1 | 0 | sem teste de service | média |
| settings | 1 | 1 | 2 | com teste | baixa |
| starlinks | 1 | 1 | 0 | sem teste de controller/service | alta |
| units | 1 | 1 | 2 | com teste | baixa |
| users | 1 | 1 | 1 | com teste | baixa |

## Matriz Web

| Grupo | Pages | Route handlers | Layouts | Prioridade |
| --- | --- | --- | --- | --- |
| (root) | 1 | 0 | 1 | baixa |
| administracao | 4 | 0 | 0 | média |
| alertas | 4 | 0 | 0 | média |
| api routes | 0 | 3 | 0 | baixa |
| ativos | 7 | 0 | 0 | alta |
| attachments | 0 | 1 | 0 | baixa |
| automacao | 1 | 1 | 0 | baixa |
| chamados | 4 | 0 | 0 | alta |
| configuracoes | 1 | 0 | 0 | baixa |
| contratos | 4 | 0 | 0 | alta |
| dashboard | 1 | 0 | 0 | alta |
| equipamentos | 4 | 0 | 0 | média |
| esqueci-senha | 1 | 0 | 0 | baixa |
| excecoes | 3 | 1 | 0 | alta |
| export | 0 | 1 | 0 | baixa |
| importacao | 1 | 0 | 0 | baixa |
| integracoes | 1 | 0 | 0 | baixa |
| login | 1 | 0 | 0 | baixa |
| manutencoes | 4 | 0 | 0 | média |
| mapas | 1 | 0 | 0 | baixa |
| monitoramento | 4 | 0 | 0 | média |
| ocorrencias | 4 | 0 | 0 | média |
| operacao | 8 | 0 | 0 | média |
| parceiros | 3 | 0 | 0 | alta |
| perfis | 1 | 0 | 0 | baixa |
| reconciliacao | 1 | 0 | 0 | baixa |
| reconciliacao-central | 1 | 0 | 0 | baixa |
| redefinir-senha | 1 | 0 | 0 | baixa |
| relatorios | 5 | 4 | 0 | média |
| sensores | 1 | 0 | 0 | baixa |
| unidades | 3 | 0 | 0 | alta |
| usuarios | 3 | 1 | 0 | alta |

## API - arquivos mapeados

### (root)

- apps/api/src/app.module.ts
- apps/api/src/app.controller.ts
- apps/api/src/health.controller.ts
- apps/api/src/app.service.ts
- apps/api/src/app.controller.spec.ts
- apps/api/src/health.controller.spec.ts

### activities

- apps/api/src/activities/activities.module.ts
- apps/api/src/activities/activities.controller.ts
- apps/api/src/activities/activities.service.ts
- apps/api/src/activities/activities.controller.spec.ts
- apps/api/src/activities/activities.service.spec.ts

### attachments

- apps/api/src/attachments/attachments.module.ts
- apps/api/src/attachments/attachments.controller.ts
- apps/api/src/attachments/attachments.service.ts

### audits

- apps/api/src/audits/audits.module.ts
- apps/api/src/audits/audits.controller.ts
- apps/api/src/audits/audits.service.ts
- apps/api/src/audits/audits.controller.spec.ts
- apps/api/src/audits/audits.service.spec.ts

### auth

- apps/api/src/auth/auth.module.ts
- apps/api/src/auth/auth.controller.ts
- apps/api/src/auth/auth.service.ts
- apps/api/src/auth/auth.service.spec.ts

### automations

- apps/api/src/automations/automations.module.ts
- apps/api/src/automations/automations.controller.ts
- apps/api/src/automations/automations.service.ts

### contracts

- apps/api/src/contracts/contracts.module.ts
- apps/api/src/contracts/contracts.controller.ts
- apps/api/src/contracts/contracts.service.ts
- apps/api/src/contracts/contracts.service.spec.ts

### dashboard

- apps/api/src/dashboard/dashboard.module.ts
- apps/api/src/dashboard/dashboard.controller.ts
- apps/api/src/dashboard/dashboard.service.ts
- apps/api/src/dashboard/dashboard.controller.spec.ts
- apps/api/src/dashboard/dashboard.service.spec.ts

### e2e

- apps/api/test/app.e2e-spec.ts

### equipments

- apps/api/src/equipments/equipments.module.ts
- apps/api/src/equipments/equipments.controller.ts
- apps/api/src/equipments/equipments.service.ts
- apps/api/src/equipments/equipments.controller.spec.ts
- apps/api/src/equipments/equipments.service.spec.ts

### exceptions

- apps/api/src/exceptions/exceptions.module.ts
- apps/api/src/exceptions/exceptions.controller.ts
- apps/api/src/exceptions/exceptions.service.ts

### import-export

- apps/api/src/import-export/import-export.module.ts
- apps/api/src/import-export/import-export.controller.ts
- apps/api/src/import-export/import-export.service.ts
- apps/api/src/import-export/csv.spec.ts

### integrations

- apps/api/src/integrations/integrations.module.ts
- apps/api/src/integrations/integrations.controller.ts
- apps/api/src/integrations/integrations.service.ts

### legacy

- apps/api/src/legacy/legacy.module.ts
- apps/api/src/legacy/legacy.controller.ts
- apps/api/src/legacy/operational-data.controller.ts
- apps/api/src/legacy/legacy.service.ts
- apps/api/src/legacy/operational-data.controller.spec.ts

### maintenances

- apps/api/src/maintenances/maintenances.module.ts
- apps/api/src/maintenances/maintenances.controller.ts
- apps/api/src/maintenances/maintenances.service.ts

### monitoring

- apps/api/src/monitoring/monitoring.module.ts
- apps/api/src/monitoring/monitoring.controller.ts
- apps/api/src/monitoring/monitoring.service.ts
- apps/api/src/monitoring/report-export.service.ts
- apps/api/src/monitoring/report-presentation.service.ts

### occurrences

- apps/api/src/occurrences/occurrences.module.ts
- apps/api/src/occurrences/occurrences.controller.ts
- apps/api/src/occurrences/occurrences.service.ts

### partners

- apps/api/src/partners/partners.module.ts
- apps/api/src/partners/partners.controller.ts
- apps/api/src/partners/partners.service.ts
- apps/api/src/partners/partners.service.spec.ts

### prisma

- apps/api/src/prisma/prisma.module.ts
- apps/api/src/prisma/prisma.service.ts

### settings

- apps/api/src/settings/settings.module.ts
- apps/api/src/settings/settings.controller.ts
- apps/api/src/settings/settings.service.ts
- apps/api/src/settings/feature-flags.controllers.spec.ts
- apps/api/src/settings/settings.service.spec.ts

### starlinks

- apps/api/src/starlinks/starlinks.module.ts
- apps/api/src/starlinks/starlinks.controller.ts
- apps/api/src/starlinks/starlinks.service.ts

### units

- apps/api/src/units/units.module.ts
- apps/api/src/units/units.controller.ts
- apps/api/src/units/units.service.ts
- apps/api/src/units/units.controller.spec.ts
- apps/api/src/units/units.service.spec.ts

### users

- apps/api/src/users/users.module.ts
- apps/api/src/users/users.controller.ts
- apps/api/src/users/users.service.ts
- apps/api/src/users/dto/user-role.dto.spec.ts

## Web - rotas mapeadas

### (root)

- apps/web/app/layout.tsx
- apps/web/app/page.tsx

### administracao

- apps/web/app/administracao/automacoes/page.tsx
- apps/web/app/administracao/importacao/page.tsx
- apps/web/app/administracao/reconciliacao/page.tsx
- apps/web/app/administracao/sla/page.tsx

### alertas

- apps/web/app/alertas/[id]/editar/page.tsx
- apps/web/app/alertas/[id]/page.tsx
- apps/web/app/alertas/novo/page.tsx
- apps/web/app/alertas/page.tsx

### api routes

- apps/web/app/api/auth/forgot-password/route.ts
- apps/web/app/api/auth/reset-password/route.ts
- apps/web/app/api/auth/web-session/route.ts

### ativos

- apps/web/app/ativos/[id]/page.tsx
- apps/web/app/ativos/nova/page.tsx
- apps/web/app/ativos/onus/page.tsx
- apps/web/app/ativos/outros/page.tsx
- apps/web/app/ativos/page.tsx
- apps/web/app/ativos/starlinks/page.tsx
- apps/web/app/ativos/switches/page.tsx

### attachments

- apps/web/app/attachments/[id]/download/route.ts

### automacao

- apps/web/app/automacao/page.tsx
- apps/web/app/automacao/export/route.ts

### chamados

- apps/web/app/chamados/[id]/editar/page.tsx
- apps/web/app/chamados/[id]/page.tsx
- apps/web/app/chamados/novo/page.tsx
- apps/web/app/chamados/page.tsx

### configuracoes

- apps/web/app/configuracoes/page.tsx

### contratos

- apps/web/app/contratos/[id]/editar/page.tsx
- apps/web/app/contratos/[id]/page.tsx
- apps/web/app/contratos/novo/page.tsx
- apps/web/app/contratos/page.tsx

### dashboard

- apps/web/app/dashboard/page.tsx

### equipamentos

- apps/web/app/equipamentos/[id]/page.tsx
- apps/web/app/equipamentos/nova/page.tsx
- apps/web/app/equipamentos/page.tsx
- apps/web/app/equipamentos/starlinks/page.tsx

### esqueci-senha

- apps/web/app/esqueci-senha/page.tsx

### excecoes

- apps/web/app/excecoes/[id]/page.tsx
- apps/web/app/excecoes/nova/page.tsx
- apps/web/app/excecoes/page.tsx
- apps/web/app/excecoes/export/route.ts

### export

- apps/web/app/export/[resource]/route.ts

### importacao

- apps/web/app/importacao/page.tsx

### integracoes

- apps/web/app/integracoes/page.tsx

### login

- apps/web/app/login/page.tsx

### manutencoes

- apps/web/app/manutencoes/[id]/editar/page.tsx
- apps/web/app/manutencoes/[id]/page.tsx
- apps/web/app/manutencoes/nova/page.tsx
- apps/web/app/manutencoes/page.tsx

### mapas

- apps/web/app/mapas/page.tsx

### monitoramento

- apps/web/app/monitoramento/fontes/page.tsx
- apps/web/app/monitoramento/mapas/page.tsx
- apps/web/app/monitoramento/page.tsx
- apps/web/app/monitoramento/sensores/page.tsx

### ocorrencias

- apps/web/app/ocorrencias/[id]/editar/page.tsx
- apps/web/app/ocorrencias/[id]/page.tsx
- apps/web/app/ocorrencias/nova/page.tsx
- apps/web/app/ocorrencias/page.tsx

### operacao

- apps/web/app/operacao/atividade/page.tsx
- apps/web/app/operacao/automacoes/page.tsx
- apps/web/app/operacao/excecoes/[id]/page.tsx
- apps/web/app/operacao/excecoes/page.tsx
- apps/web/app/operacao/fila/page.tsx
- apps/web/app/operacao/importacao/page.tsx
- apps/web/app/operacao/page.tsx
- apps/web/app/operacao/sla/page.tsx

### parceiros

- apps/web/app/parceiros/[id]/page.tsx
- apps/web/app/parceiros/nova/page.tsx
- apps/web/app/parceiros/page.tsx

### perfis

- apps/web/app/perfis/page.tsx

### reconciliacao

- apps/web/app/reconciliacao/page.tsx

### reconciliacao-central

- apps/web/app/reconciliacao-central/page.tsx

### redefinir-senha

- apps/web/app/redefinir-senha/page.tsx

### relatorios

- apps/web/app/relatorios/consumo/page.tsx
- apps/web/app/relatorios/disponibilidade/page.tsx
- apps/web/app/relatorios/monitoramento/page.tsx
- apps/web/app/relatorios/page.tsx
- apps/web/app/relatorios/performance/page.tsx
- apps/web/app/relatorios/monitoramento/automacoes/route.ts
- apps/web/app/relatorios/monitoramento/export-jobs/route.ts
- apps/web/app/relatorios/monitoramento/export/route.ts
- apps/web/app/relatorios/monitoramento/templates/route.ts

### sensores

- apps/web/app/sensores/page.tsx

### unidades

- apps/web/app/unidades/[id]/page.tsx
- apps/web/app/unidades/nova/page.tsx
- apps/web/app/unidades/page.tsx

### usuarios

- apps/web/app/usuarios/[id]/page.tsx
- apps/web/app/usuarios/nova/page.tsx
- apps/web/app/usuarios/page.tsx
- apps/web/app/usuarios/export/route.ts

## Web - componentes mapeados

- apps/web/components/action-form.tsx
- apps/web/components/app-shell.tsx
- apps/web/components/app-sidebar-nav.tsx
- apps/web/components/asset-reload-guard.tsx
- apps/web/components/attachment-panel.tsx
- apps/web/components/dashboard/nova-dashboard-view.tsx
- apps/web/components/entity-edit-modal.tsx
- apps/web/components/form-submit-button.tsx
- apps/web/components/guided-wizard.tsx
- apps/web/components/linked-host-panel.tsx
- apps/web/components/list-pagination.tsx
- apps/web/components/login-form.tsx
- apps/web/components/logout-button.tsx
- apps/web/components/nova-design-system.tsx
- apps/web/components/nova-lit/nova-lit-logout-button.tsx
- apps/web/components/nova-lit/nova-lit-shell.tsx
- apps/web/components/operational-delete-panel.tsx
- apps/web/components/operations-workspace.tsx
- apps/web/components/ops-side-panels.tsx
- apps/web/components/ops-ui.tsx
- apps/web/components/recent-ops-panels.tsx
- apps/web/components/registry-shell.tsx
- apps/web/components/report-print-button.tsx
- apps/web/components/sensores/nova-sensores-view.tsx
- apps/web/components/starlinks/starlink-secret-actions.tsx
- apps/web/components/unidades/nova-unidades-view.tsx
- apps/web/components/unidades/operational-secret-actions.tsx
- apps/web/components/unit-watchlist-panel.tsx
