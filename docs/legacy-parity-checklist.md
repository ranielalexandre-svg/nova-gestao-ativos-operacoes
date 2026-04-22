# Checklist de paridade com o legado

Levantamento feito em modo somente leitura contra `http://192.168.58.159` em
2026-04-22. Nenhuma credencial foi registrada neste documento e nenhum dado foi
alterado no servidor.

## Objetivo

Este checklist orienta a substituicao gradual do site legado pelo NOVA. A meta
nao e copiar o legado linha por linha, mas garantir que os fluxos usados pela
operacao continuem disponiveis ou tenham um caminho claro de migracao.

## O que o legado expoe hoje

O legado na porta 80 entrega uma SPA estatica com backend em `/api/*`.
Pelo JavaScript publico, os modulos centrais sao:

- Login e sessao com token Bearer.
- Dashboard / Command Center.
- Unidades.
- Parceiros.
- Equipamentos.
- Starlinks.
- Ocorrencias.
- Manutencoes.
- Monitoramento.
- Integracoes Zabbix/Grafana.
- Usuarios.
- Auditoria.
- Perfil do usuario.
- Importacao/exportacao.
- Anexos.

Tambem existem modulos avancados ou historicos no `app.js` do legado:

- Central de Plantao / handover.
- Qualidade e RCA / postmortems.
- Playbooks e cobranca / followups.
- Mudancas e janelas.
- Comunicacao e evidencias.
- Torre de Controle 360 / war rooms.
- Dependencias e blast radius.
- Campo e despacho.

## Endpoints observados no legado

Principais endpoints chamados pela SPA legada:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/profile`
- `/api/dashboard`
- `/api/partners`
- `/api/units`
- `/api/equipments`
- `/api/starlinks`
- `/api/occurrences`
- `/api/maintenances`
- `/api/monitoring/overview`
- `/api/settings/integrations`
- `/api/users`
- `/api/audits`
- `/api/export/*`
- `/api/import/templates/*`
- `/api/import/preview/*`
- `/api/import/execute/*`
- `/api/zabbix/reconcile-route-geral`
- `/api/zabbix/upsert-units`
- `/api/handover`
- `/api/postmortems`
- `/api/playbooks`
- `/api/followups`
- `/api/changes`
- `/api/comms`
- `/api/evidences`
- `/api/warrooms`
- `/api/control-tower/overview`
- `/api/dependencies`
- `/api/dependencies/overview`
- `/api/dependencies/impact`
- `/api/field/overview`
- `/api/field/technicians`
- `/api/field/dispatches`

Observacao: a nossa aplicacao nova nao precisa manter exatamente esses mesmos
paths se todo acesso passar pelo Next. Mas se existir integracao externa usando
`/api/*` no legado, esses contratos devem ser mapeados antes da troca final.

## Cobertura atual no NOVA

Ja existe cobertura funcional no NOVA para:

- Login e sessao web.
- Dashboard.
- Unidades.
- Parceiros.
- Equipamentos.
- Ocorrencias.
- Manutencoes.
- Usuarios.
- Integracoes.
- Monitoramento.
- Atividades operacionais.
- Fila, excecoes, SLA e automacoes.
- Reconciliacao com pacote legado via `NOVA_LEGACY_IMPORT_PATH`.
- Healthcheck e readiness da API.

## Itens criticos antes da troca

Estes pontos devem estar ok antes de trocar o proxy do legado para o NOVA:

- Login com usuario administrador funciona no ambiente de producao.
- O seed cria ou atualiza o usuario administrador esperado.
- Banco esta migrado com `prisma migrate deploy`.
- `curl http://127.0.0.1:4000/health/ready` retorna sucesso no servidor.
- Next responde localmente em `http://127.0.0.1:3010/login`.
- Fluxos de cadastro e edicao funcionam para unidades, parceiros, equipamentos,
  ocorrencias e manutencoes.
- Monitoramento basico mostra unidades/hosts esperados ou exibe fallback claro.
- Integracoes Zabbix/Grafana tem variaveis, segredos e testes revisados.
- Plano de importacao dos dados do legado esta definido.
- Backup do nginx/site legado foi feito antes da troca.
- Rollback do proxy foi testado.

## Gaps para decidir

Estes itens aparecem no legado, mas ainda precisam de decisao de produto ou
implementacao equivalente no NOVA:

- Auditoria dedicada: o NOVA tem atividades operacionais, mas nao uma tela
  identica de auditoria do legado.
- Starlinks como modulo proprio: o NOVA trata parte disso via equipamento e
  reconciliacao legado, mas nao ha rota independente de Starlinks.
- Anexos: o legado possui endpoints de upload/remocao por entidade.
- Importacao/exportacao via UI: o NOVA hoje prioriza pacote legado e
  reconciliacao, nao necessariamente os mesmos CSV/templates do legado.
- Handover, RCA, playbooks, followups, mudancas, comunicacao, evidencias,
  war rooms, dependencias e despacho de campo parecem ser modulos avancados do
  legado. Podem virar fase 2 se nao forem usados no dia a dia.
- Compatibilidade de URLs `/api/*`: verificar se algum consumidor externo chama
  diretamente a API legada.

## Proxima investigacao segura

Quando fizer sentido usar uma credencial temporaria, limitar a investigacao a:

- Login somente leitura.
- Captura de nomes de menus/telas ativas por perfil.
- Contagem de registros por modulo.
- Formato de payload dos endpoints `GET`.
- Nada de `POST`, `PUT`, `PATCH` ou `DELETE` no legado.

Se qualquer endpoint de leitura retornar dados sensiveis, registrar apenas
contagens, campos e estrutura geral, nunca valores reais.
