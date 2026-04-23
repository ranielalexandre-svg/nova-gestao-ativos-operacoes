# Checklist de paridade com o legado

Levantamento feito em modo somente leitura contra `http://192.168.58.159` em
2026-04-22. Nenhuma credencial foi registrada neste documento e nenhum dado foi
alterado no servidor.

Uma segunda leitura autenticada, tambem somente leitura, confirmou estas
contagens do legado: 53 parceiros, 280 unidades, 33 equipamentos, 31 Starlinks,
5 usuarios e 238 auditorias.

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
- Compatibilidade de prefixo `/api/*` no backend.
- Endpoint dedicado de auditoria baseado em atividades (`/api/audits`).
- Endpoint dedicado de Starlinks baseado em equipamentos do tipo Starlink.
- Upload, listagem, download e remocao de anexos por entidade.
- Templates, preview, execucao de importacao e exportacao CSV para parceiros,
  unidades, equipamentos e Starlinks.
- Tela dedicada de Starlinks em `/equipamentos/starlinks`.
- Painel de anexos nas telas de unidades, parceiros, equipamentos e
  ocorrencias.
- Central administrativa de importacao/exportacao em `/operacao/importacao`.
- Rotas web autenticadas para exportar CSV e baixar anexos sem depender de
  token Bearer no navegador.

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

- Auditoria dedicada agora tem endpoint compativel; a tela de atividades do
  NOVA cobre a experiencia operacional inicial. Ainda falta decidir se o visual
  deve ser identico ao legado.
- Starlinks agora tem endpoint proprio e tela dedicada de consulta/importacao.
  CRUD profundo continua no cadastro de equipamentos.
- Anexos agora tem endpoints de backend e painel nas telas principais de
  registro. Ainda falta validar com a equipe se outras entidades precisam do
  mesmo painel.
- Importacao/exportacao CSV agora existe no backend e na central administrativa.
  Antes do corte, validar um lote real pequeno em ambiente controlado.
- Handover, RCA, playbooks, followups, mudancas, comunicacao, evidencias,
  war rooms, dependencias e despacho de campo parecem ser modulos avancados do
  legado. Podem virar fase 2 se nao forem usados no dia a dia.
- Compatibilidade de URLs `/api/*`: backend aceita o prefixo, mas contratos de
  consumidores externos ainda devem ser testados caso existam integracoes fora
  do navegador.

## Proxima investigacao segura

Quando fizer sentido usar uma credencial temporaria, limitar a investigacao a:

- Login somente leitura.
- Captura de nomes de menus/telas ativas por perfil.
- Contagem de registros por modulo.
- Formato de payload dos endpoints `GET`.
- Nada de `POST`, `PUT`, `PATCH` ou `DELETE` no legado.

Se qualquer endpoint de leitura retornar dados sensiveis, registrar apenas
contagens, campos e estrutura geral, nunca valores reais.
