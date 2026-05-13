# NOVA Telecom Layout Board Implementation

Fonte visual oficial: `docs/design/nova-layout-board.png`.

Este documento registra os tokens extraidos da prancha **NOVA TELECOM - SITE DE GESTAO - OPCOES DE LAYOUT**. A prancha e a fonte da verdade visual. O sistema deve reproduzir proporcao, densidade, hierarquia, bordas, radius, tabelas, badges e navegacao da imagem, nao apenas se inspirar nela.

## Variantes

### `layoutA` - Dark Modern / Laranja

Padrao inicial do produto. Cor primaria laranja NOVA, cards azul-petroleo escuros, sidebar fixa compacta.

### `layoutB` - Dark Vibrante / Roxo

Mesmo grid e densidade do `layoutA`, trocando acento principal para violeta/roxo. Usado como variante visual controlada.

### `layoutC` - Dark Soft / Ciano-Verde

Mesmo grid e densidade do `layoutA`, trocando acento principal para ciano/esmeralda. Usado para visual mais tecnico/soft.

### `layoutD` - Dark Grafite / Ambar

Mesmo grid e densidade do `layoutA`, com base grafite e acento ambar. Usado como alternativa operacional quente sem perder contraste.

### `layoutE` - Dark Ruby / Vermelho

Mesmo grid e densidade do `layoutA`, com acento ruby para cenarios de criticidade, auditoria ou ambientes de demonstracao.

### `layoutF` - Dark Cobalto / Azul

Mesmo grid e densidade do `layoutA`, com acento cobalto para ambientes mais neutros/tecnicos.

### `layoutG` - Dark Verde / Lime

Mesmo grid e densidade do `layoutA`, com acento verde-lime para leitura de rede, disponibilidade e status operacional.

## Tokens De Cor

### Base

| Token | Layout A | Layout B | Layout C | Uso |
| --- | --- | --- | --- | --- |
| `--nova-bg` | `#050b12` | `#050914` | `#041111` | Fundo geral quase preto |
| `--nova-bg-2` | `#07111a` | `#080a18` | `#061615` | Gradiente secundario |
| `--nova-sidebar` | `#071019` | `#080914` | `#061211` | Sidebar |
| `--nova-topbar` | `rgba(5,11,18,.92)` | `rgba(6,7,17,.92)` | `rgba(4,14,14,.92)` | Topbar |
| `--nova-surface` | `#0b141f` | `#0b1020` | `#0a1717` | Cards principais |
| `--nova-surface-2` | `#101a26` | `#11162a` | `#102121` | Header/table/cards elevados |
| `--nova-surface-3` | `#07101a` | `#080d1a` | `#071615` | Inputs e tabelas |
| `--nova-border` | `rgba(148,163,184,.16)` | `rgba(167,139,250,.18)` | `rgba(45,212,191,.18)` | Bordas principais |
| `--nova-border-soft` | `rgba(148,163,184,.09)` | `rgba(167,139,250,.10)` | `rgba(45,212,191,.10)` | Divisores |

### Acentos

| Token | Layout A | Layout B | Layout C | Uso |
| --- | --- | --- | --- | --- |
| `--nova-primary` | `#ff7a00` | `#8b5cf6` | `#14b8a6` | Botao principal, ativo, foco |
| `--nova-primary-2` | `#f97316` | `#a855f7` | `#22d3ee` | Gradiente/acento |
| `--nova-primary-soft` | `rgba(249,115,22,.14)` | `rgba(139,92,246,.16)` | `rgba(20,184,166,.15)` | Fundo ativo/badge |
| `--nova-success` | `#22c55e` | `#34d399` | `#34d399` | Online/conectado |
| `--nova-warning` | `#f59e0b` | `#fbbf24` | `#f59e0b` | Atenção/pendente |
| `--nova-danger` | `#fb3f6c` | `#fb7185` | `#fb7185` | Critico/offline |
| `--nova-info` | `#38bdf8` | `#60a5fa` | `#22d3ee` | Informativo/graficos |

### Texto

| Token | Valor | Uso |
| --- | --- | --- |
| `--nova-text` | `#f8fafc` | Titulos e numeros |
| `--nova-text-muted` | `#9fb0c4` | Descricoes curtas |
| `--nova-text-dim` | `#64748b` | Metadados e labels |
| `--nova-text-faint` | `#475569` | Linhas auxiliares |

## Backgrounds

- Fundo do app: gradiente radial discreto no acento da variante + gradiente escuro.
- Cards: `linear-gradient(180deg, color-mix(in srgb, var(--nova-surface-2) 70%, transparent), var(--nova-surface))`.
- Inputs e tabelas: base mais escura `--nova-surface-3`.
- Graficos: fundo preto-azulado com grid sutil.
- Mapas: fundo `#07101a` com linhas de mapa em `rgba(148,163,184,.08)`.

## Bordas, Radius e Sombras

| Elemento | Radius | Borda | Sombra |
| --- | --- | --- | --- |
| App shell/sidebar | `0` | `1px solid var(--nova-border-soft)` | nenhuma pesada |
| Card/surface | `12px` | `1px solid var(--nova-border)` | `0 14px 34px rgba(0,0,0,.22)` |
| Card interno | `9px` | `1px solid var(--nova-border-soft)` | `inset 0 1px 0 rgba(255,255,255,.025)` |
| Botao | `6px` | `1px solid transparent` | primary: glow leve do acento |
| Input/select | `6px` | `1px solid var(--nova-border)` | sem sombra |
| Badge | `999px` | `1px solid current/acento` | sem sombra |
| Tabela | `9px` | `1px solid var(--nova-border-soft)` | sem sombra pesada |

## Espacamentos e Densidade

- Escala base desktop: equivalente ao navegador em `150%`, aplicada nos tokens para o usuario usar zoom `100%`.
- Largura sidebar desktop: `220px`.
- Topbar: `54px`.
- Padding conteudo desktop: `18px`.
- Conteudo desktop: alinhado ao inicio da area principal, imediatamente apos a sidebar; nao centralizar com `margin: auto` em viewports largos.
- Paineis laterais usam classes explicitas do design system (`nova-side-grid--300/320/340/360/380/420`) em vez de seletores globais por substring. Em desktop largo (`1600px+`), escalam para `450px`, `480px`, `510px`, `540px`, `570px` e `630px`.
- Dimensoes legadas de icones/dots/barras tambem escalam no shell NOVA: `h-2/w-2 -> 12px`, `h-4/w-4 -> 24px`, `h-8/w-8 -> 48px`; blocos `min-h-[102px]` e `min-h-[118px]` sobem para `153px` e `177px`.
- Gap geral entre blocos: `12px`.
- Gap entre cards KPI: `12px`.
- Padding card: `15px`.
- Padding tabela: `11px 14px`.
- Altura input/select: `45px`.
- Altura botao: `45px`.
- Altura badge: `27px`.

## Tipografia

- Fonte: stack sans-serif nativa com peso forte para densidade operacional.
- Page title: `27px`, `font-weight: 800`, line-height `1.12`.
- Card title: `18px` a `20px`, `font-weight: 800`.
- KPI value: `30px` a `33px`, `font-weight: 900`.
- Labels/eyebrows: `12px`, uppercase, letter-spacing `0`.
- Body/table: `16px`.
- Metadata: `15px`.

## Sidebar

- Fixa a esquerda no desktop.
- Largura alvo produto: `220px`, com texto truncado quando necessário.
- Logo NOVA no topo, branco com `A` laranja.
- Secoes uppercase pequenas: Geral, Monitoramento, Gestao, Relatorios, Configuracoes.
- Item ativo: barra vertical `2px`/`3px` laranja, fundo laranja translúcido, icone destacado.
- Itens compactos: altura `38px` a `45px`.
- Sem drawer/estado recolhido persistente no desktop para evitar quebra.

## Topbar

- Altura `54px`.
- Fundo escuro translúcido.
- Esquerda: icone de menu pequeno + texto `Sistema de gestão operacional`.
- Direita: acoes pequenas quadradas, badge de notificacao, usuario.
- Sem elementos grandes.

## Botoes

- Primario: fundo `linear-gradient(180deg, var(--nova-primary), var(--nova-primary-2))`, texto branco, altura `45px`, radius `6px`.
- Secundario: fundo `rgba(255,255,255,.035)`, borda `var(--nova-border)`, texto `--nova-text`.
- Ghost: fundo transparente, hover com `rgba(255,255,255,.05)`.
- Disabled: opacidade `.45`, cursor `not-allowed`, sem glow.

## Badges

- Uppercase, fonte `12px`, peso `800`, letter-spacing `0`.
- Padding `3px 10px`.
- Online/success: verde translúcido.
- Warning: amarelo translúcido.
- Danger: rosa/vermelho translúcido.
- Info: azul/ciano translúcido.
- Primary: acento da variante translúcido.

## Tabs e Seletores de Origem

- `NovaTabs`: container dark compacto com borda `--nova-border`, padding `12px`, gap `12px`.
- Item de tab: altura `45px`, radius `6px`, fundo `rgba(255,255,255,.035)`.
- Tab ativo: fundo ainda escuro, com acento lateral/inset e borda no `--nova-primary`; nao usar bloco chapado laranja/roxo/ciano.
- Seletores de origem de relatorio: cards internos de `108px`, borda fina, left accent `3px` no ativo, texto `16px`/`15px`.

## Tabelas

- Header `#0e1824` ou token surface-2.
- Header uppercase `12px`, letter-spacing `0`.
- Body `16px`.
- Row border `1px solid rgba(148,163,184,.075)`.
- Hover `rgba(255,255,255,.025)`.
- Acoes na ultima coluna compactas.
- Nao usar linhas altas nem cards dentro de linhas.

## Graficos

- Cards com altura compacta.
- Chart area entre `110px` e `160px` conforme pagina.
- Linha de grafico fina, acento da variante ou status.
- Grid com linhas muito sutis.

## Starlinks

- A pagina `/ativos/starlinks` usa cards de terminal como bloco principal, conforme a prancha: tag/unidade no topo, badge de status, mini grafico escuro, metricas compactas de sinal/consumo/latencia e rodape com parceiro/documentos.
- O grid dos terminais escala de 2 para 4 colunas e chega a 5 colunas em desktop largo, mantendo tabela tecnica separada abaixo para auditoria.
- Enquanto nao houver endpoint real de telemetria Starlink, os valores de sinal/consumo/latencia sao placeholders determinísticos marcados em codigo com TODO para troca por dados reais.

## Alertas / Kanban

- A pagina `/alertas` usa kanban visual com quatro colunas, cards escuros pequenos, acento vertical, badge de severidade e linhas compactas de alvo/chamados/atualizacao.
- A tabela operacional permanece abaixo do kanban para preservar a leitura densa de auditoria e paginacao.

## Automacao

- A pagina `/automacao` inclui cards horizontais de rotina antes da tabela, com estado ativo/pausado, severidade, ultima execucao, proxima execucao, progresso de saude e contadores de runs/casos.
- A tabela e os formularios administrativos permanecem como camada de auditoria/edicao, mantendo a logica existente.

## Configuracoes

- A pagina `/configuracoes` inclui tabs administrativas funcionais (`Geral`, `Backup`, `Seguranca`, `Integracoes`), todas aplicadas por querystring real.
- Tabs sem backend real de edicao, como upload de logo/licenca, nao devem ser exibidas como botao clicavel ate existir acao correspondente.
- Os toggles usam `nds-toggle` escalado, mas ficam dentro de links reais para a configuracao relacionada (`/automacao` ou `/integracoes`).
- O painel lateral concentra apenas acoes administrativas nao duplicadas na area ativa.

## Perfis

- A pagina `/perfis` inclui painel circular de permissões com distribuicao real da matriz: concedidas, parciais e negadas.
- A matriz tabular permanece como fonte detalhada para auditoria dos modulos e papeis.

## Relatorios / Performance

- A pagina `/relatorios/performance` inclui area tracejada de upload/validacao, alinhada ao bloco da prancha, com resumo real de sensores validados.
- Os graficos compactos e ranking tecnico permanecem na mesma pagina para manter a operacao densa.

## Importacao

- A pagina `/importacao` inclui stepper visual de template/validacao/importacao e area tracejada de carga antes do formulario real.
- O textarea CSV continua como entrada funcional ate existir endpoint de upload direto; o painel lateral mostra resumo esperado, templates e exportacoes.

## Mapas

- A pagina `/mapas` usa tiles reais do OpenStreetMap em Web Mercator dentro do `nova-map-canvas`, com filtro escuro para manter a variante A da prancha.
- Como a API atual entrega cidade/UF e nao latitude/longitude por unidade, os marcadores usam dicionario centralizado de coordenadas por cidade; localidades fora do dicionario aparecem no painel "Sem coordenada" ate a base expor coordenadas reais.
- O canvas principal usa proporcao `1.45:1` e min-height desktop de `720px` para ocupar a area vertical disponivel, evitando uma coluna principal vazia abaixo do mapa.
- KPIs grandes nao ficam acima do mapa nessa rota; o resumo operacional vai para o painel lateral em cards compactos, deixando o mapa ser o primeiro bloco visual.
- O grid da pagina usa breakpoint proprio (`1900px`) para evitar painel lateral cortado quando a escala nativa do design deixa a area principal estreita; nesse modo o painel lateral fica sticky e rola internamente.
- A camada do mapa usa apenas bolhas geograficas compactas para evitar sobreposicao de nomes sobre o tile; os nomes ficam no painel "Cidades no mapa".
- Os pontos e linhas do painel linkam para a listagem filtrada de unidades e carregam a cor operacional: online, atencao ou offline.
- O painel de camadas usa links reais com querystring `layers=units,alerts`; camadas sem implementacao visual nao devem aparecer como toggle falso.

## Integracoes

- A pagina `/integracoes` inclui faixa de cards de saude por conector, com status conectado/falha, latencia, HTTP e alvo operacional.
- A tela preserva os paineis de readiness Zabbix, sincronizacao e formularios administrativos existentes.

## Reconciliacao

- A pagina `/reconciliacao` inclui painel de acoes de divergencia com total priorizado, unidades sem match, matches fracos e ativos legados pendentes.
- A tabela de saneamento e os paineis de parceiros/ativos permanecem como camada operacional detalhada.

## Componentes Base

Todos os componentes devem ler tokens centrais e nao ter cor fixa por pagina:

- `NovaShell`
- `NovaSidebar`
- `NovaTopbar`
- `NovaPageHeader`
- `NovaButton`
- `NovaSurface`
- `NovaCard`
- `NovaStatCard`
- `NovaBadge`
- `NovaTable`
- `NovaFilterBar`
- `NovaPanel`
- `NovaChartCard`
- `NovaStepper`
- `NovaReportPreview`
- `NovaKanban`
- `NovaEmptyState`
- `NovaTabs`
- `NovaInput`
- `NovaSelect`
- `NovaToggle`
- `NovaProgress`
- `NovaThemeProvider` ou estrutura equivalente.
- Loading states operacionais usam `nova-loading-stack`, `nova-loading-grid` e `nova-loading-block` com shimmer escuro do NOVA DS; nao usar `animate-pulse` solto em paginas.
- Layouts em duas colunas usam `nova-side-grid--300/320/340/360/380/420` ou classes especificas documentadas, evitando `grid-cols-[...]` repetido nas rotas.
- Filtros e barras de acao usam `nova-filter-toolbar`, `nova-action-toolbar` e variantes `nova-filter-grid--monitoring/queue/ops-wide/activity/occurrences/units/equipment/users/starlink/five/six`; proporcoes de formulario ficam centralizadas no NOVA DS.
- Workbenches e rows tecnicas usam classes nomeadas (`nova-inventory-grid`, `nova-report-workbench`, `nova-report-date-grid`, `nova-events-grid`, `nova-monitoring-workbench`, `nova-equipment-row`, `nova-integration-card-row`, `nova-settings-*`) em vez de medidas inline por pagina.
- Cards pequenos/list links reutilizam `nova-micro-card` e `nova-micro-link`; barras percentuais de inventario usam `ProgressLine` central em `ops-ui`.
- Formatacao de datas e labels de select fica em `apps/web/lib/formatters.ts`; nao recriar `formatDate`, `formatDateTime` ou `optionLabel` dentro das paginas.
- Labels e tones de badges operacionais compartilhados ficam em `apps/web/lib/status-ui.ts`: severidade/status de alertas, tipo/status de chamados e status de ativos.
- O mapa usa tile real OpenStreetMap e dicionario local ampliado de cidades TO/GO enquanto latitude/longitude ainda nao vem da API.

## Regras De Implementacao

1. `layoutA` e o padrao.
2. Tema/variante deve ser definido em um unico ponto por atributo `data-nova-layout` ou provider equivalente. O shell principal e a pagina de login usam `NOVA_WEB_LAYOUT=layoutA|layoutB|layoutC|layoutD|layoutE|layoutF|layoutG`; valor invalido volta para `layoutA`.
3. Rotas existentes devem ser preservadas.
4. Endpoints, hooks, exportacao DOCX/PDF e logica de dados nao devem ser removidos.
5. Placeholders visuais devem ser marcados com `TODO` quando backend ainda nao existir.
6. Evitar overrides globais por pagina. Se precisar compatibilidade temporaria, concentrar em `nova-design-system.css` ou bloco unico central.
7. Comparar visualmente com a prancha antes de finalizar cada lote.

## Rotas Canonicas

A superficie visual e a navegacao principal usam os nomes da prancha. As rotas legadas continuam existindo como compatibilidade e como fonte dos modulos reais quando a pagina ja estava implementada:

| Canonica | Compatibilidade mantida |
| --- | --- |
| `/sensores` | `/monitoramento` |
| `/alertas` e `/alertas/[id]` | `/ocorrencias` e `/ocorrencias/[id]` |
| `/ativos`, `/ativos/[id]`, `/ativos/cadastro`, `/ativos/starlinks` | `/equipamentos`, `/equipamentos/[id]`, `/equipamentos/cadastro`, `/equipamentos/starlinks` |
| `/chamados` e `/chamados/[id]` | `/manutencoes` e `/manutencoes/[id]` |
| `/excecoes` e `/excecoes/[id]` | `/operacao/excecoes` e `/operacao/excecoes/[id]` |
| `/automacao` | `/operacao/automacoes` |
| `/importacao` | `/operacao/importacao` |
| `/reconciliacao` | `/reconciliacao-central` |
| `/relatorios/consumo` | `/relatorios` |

O menu lateral, os atalhos e os links de listagem devem apontar para as rotas canonicas. O componente `AppSidebarNav` normaliza rotas legadas apenas para manter o item ativo correto quando um link antigo ainda for aberto diretamente.

## Checklist Pixel-Like

- Sidebar fixa, com largura visual calibrada para zoom real de `100%`.
- Topbar baixa proporcional ao mockup.
- Cards densos e escuros, mas na escala nativa do navegador sem exigir zoom manual.
- Tabelas compactas na escala `16px`.
- Botao principal laranja forte no `layoutA`.
- Item ativo do menu com acento vertical.
- Badges pequenos uppercase.
- Radius predominante entre `6px` e `12px`.
- Gaps predominantes em `12px`.
- Nada claro, nada espaçado demais, nada com card hero grande sem necessidade.
