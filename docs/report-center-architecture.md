# Central de relatorios monitoramento

## Objetivo

Evoluir o NOVA de uma tela unica de relatorio por unidade para uma central de
relatorios com:

- exportacao real em `PDF` e `DOCX`;
- download de arquivo gerado pelo servidor;
- uso de papel timbrado oficial;
- opcao de incluir ou ocultar graficos;
- exportacao consolidada de varias unidades;
- selecao inicial por `host group` do Zabbix, com revisao manual antes da
  geracao;
- base para automacao recorrente.

## Gargalos atuais

### Abertura lenta da tela

Antes da otimizacao, `/relatorios/monitoramento`:

- consultava a telemetria de ate 300 unidades ao abrir;
- cruzava unidades com hosts no Zabbix para montar o seletor;
- carregava itens e problemas de hosts antes mesmo de o usuario pedir um
  relatorio;
- executava automaticamente um relatorio para a primeira unidade da lista.

### Exportacao limitada

Hoje a exportacao e apenas `window.print()` no navegador. Isso nao garante:

- arquivo padronizado;
- download consistente;
- fidelidade ao modelo DOCX corporativo;
- geracao em lote;
- reaproveitamento em automacoes.

## Referencia visual validada

A referencia `==Relatorio-de-Consumo-Administracao-Gurupi.docx` mostra um padrao
claro:

- capa com mes de referencia;
- bloco de interessado e data;
- identificacao de contrato, endereco e banda contratada;
- rodape corporativo fixo da NOVA Telecom;
- repeticao de cabecalho visual de "Relatorio de Consumo";
- relatorios em papel timbrado com orientacao formal/comercial.

Rodape identificado no arquivo:

- Q. 106 Norte, Alameda 2, Lote 04, Sala 1001, 10o Andar, Edificio Palmas Business
- CEP 77.006-054 - Palmas - Tocantins
- sac@novatelecom.com.br
- 0800 494 0103
- www.novatelecom.com.br

## Solucao recomendada

### 1. Separar preview de exportacao

Manter a tela web como `preview`, mas mover a geracao de arquivo para um fluxo
proprio no backend.

Fluxo:

1. usuario seleciona periodo, formato, unidades e opcoes;
2. sistema cria um `job` de exportacao;
3. worker gera artefatos;
4. arquivo final fica disponivel para download.

### 2. PDF como formato canonico

Usar HTML/CSS com layout corporativo e Playwright para gerar PDF server-side.

Motivos:

- maior fidelidade visual ao modelo corporativo;
- mesmo resultado para todos os usuarios;
- suporte natural a graficos, tabelas e papeis timbrados;
- permite consolidar varias unidades no mesmo arquivo.

### 3. DOCX como formato editavel

Gerar `DOCX` em pipeline separado, sem converter HTML para DOCX.

Motivos:

- HTML para DOCX tende a perder fidelidade;
- o modelo atual ja existe em `.docx`;
- para cabecalho, rodape e estrutura comercial, o caminho mais robusto e usar
  um template DOCX dedicado.

Abordagem recomendada:

- fase 1: gerar DOCX com cabecalho/rodape, capa, informacoes gerais e secoes por
  unidade;
- fase 2: incluir graficos PNG incorporados no DOCX quando a opcao
  `incluirGraficos` estiver ativa.

### 4. Selecao por host group do Zabbix

Usar `hostgroup.get` para listar grupos e `host.get` com `groupids` para buscar
hosts desses grupos.

Fluxo:

1. usuario escolhe um ou mais grupos do Zabbix;
2. sistema lista os hosts desses grupos;
3. sistema mapeia hosts para unidades do NOVA usando o vinculo manual e as
   heuristicas existentes;
4. usuario revisa a lista, remove unidades e reordena se quiser;
5. job e criado com o conjunto final.

### 5. Templates salvos

Criar templates no proprio NOVA, independentes do PRTG:

- nome do template;
- formato de saida: `pdf`, `docx` ou ambos;
- periodo padrao: semana, mes, intervalo customizado;
- incluir graficos: sim/nao;
- incluir secoes comerciais: sim/nao;
- origem das unidades:
  - manual;
  - host groups do Zabbix;
  - grupo salvo no NOVA.

## Estrutura sugerida

### Entidades

- `ReportTemplate`
- `ReportTemplateUnit`
- `ReportJob`
- `ReportJobUnit`
- `ReportArtifact`

### Campos essenciais

`ReportTemplate`

- `id`
- `name`
- `outputFormats`
- `includeCharts`
- `includeSummary`
- `includeCommercialSection`
- `sourceType`
- `zabbixGroupIds`
- `isActive`

`ReportJob`

- `id`
- `status`
- `requestedByUserId`
- `templateId`
- `from`
- `to`
- `outputFormats`
- `includeCharts`
- `requestedAt`
- `finishedAt`
- `errorMessage`

`ReportArtifact`

- `id`
- `jobId`
- `format`
- `fileName`
- `mimeType`
- `storagePath`
- `sizeBytes`

## Endpoints sugeridos

- `GET /monitoring/report-units`
- `GET /monitoring/report-groups/zabbix`
- `POST /monitoring/report-groups/zabbix/preview`
- `POST /monitoring/report-jobs`
- `GET /monitoring/report-jobs`
- `GET /monitoring/report-jobs/:id`
- `GET /monitoring/report-jobs/:id/download/:artifactId`

## UX sugerida

### Tela principal

Tabela estilo "central de relatorios":

- objeto/template;
- formato;
- periodo;
- origem das unidades;
- quantidade de unidades;
- status;
- ultima execucao;
- proximas automacoes.

### Wizard de geracao

Passos:

1. formato e periodo;
2. origem das unidades;
3. selecao final das unidades;
4. conteudo do relatorio;
5. exportacao.

Opcoes no passo de conteudo:

- incluir graficos;
- incluir apenas resumo;
- incluir identificacao comercial;
- gerar um arquivo consolidado;
- gerar um arquivo por unidade;
- salvar template para reutilizacao.

## Roadmap recomendado

### Fase 1

- aliviar tela atual de relatorios;
- adicionar geracao server-side de PDF;
- permitir download real de artefato;
- aplicar cabecalho e rodape do modelo corporativo;
- permitir incluir ou ocultar graficos;
- suportar varias unidades em um unico PDF.

### Fase 2

- integrar selecao por host group do Zabbix;
- salvar templates;
- gerar DOCX editavel;
- suportar um arquivo consolidado ou varios arquivos por unidade.

### Fase 3

- fila/worker para execucoes grandes;
- automacao recorrente;
- envio por e-mail;
- salvar artefatos no cadastro da unidade/cliente.

## Decisoes praticas

- `PDF` deve ser o formato oficial para entrega final.
- `DOCX` deve existir como formato editavel/corporativo.
- a exportacao deve ser assíncrona quando envolver varias unidades.
- a selecao por host group deve ser sempre revisavel antes da geracao.
- a tela de preview nao deve recalcular telemetria de todas as unidades ao abrir.
