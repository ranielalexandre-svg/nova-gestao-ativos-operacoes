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

### `layoutD`, `layoutE`, `layoutF`, `layoutG`

Reservados. Inicialmente clonam `layoutA` por token, sem CSS espalhado por pagina.

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

- Fundo do app: gradiente radial discreto laranja no topo/esquerda + gradiente azul escuro.
- Cards: `linear-gradient(180deg, color-mix(in srgb, var(--nova-surface-2) 70%, transparent), var(--nova-surface))`.
- Inputs e tabelas: base mais escura `--nova-surface-3`.
- Graficos: fundo preto-azulado com grid sutil.
- Mapas: fundo `#07101a` com linhas de mapa em `rgba(148,163,184,.08)`.

## Bordas, Radius e Sombras

| Elemento | Radius | Borda | Sombra |
| --- | --- | --- | --- |
| App shell/sidebar | `0` | `1px solid var(--nova-border-soft)` | nenhuma pesada |
| Card/surface | `8px` | `1px solid var(--nova-border)` | `0 14px 34px rgba(0,0,0,.22)` |
| Card interno | `6px` | `1px solid var(--nova-border-soft)` | `inset 0 1px 0 rgba(255,255,255,.025)` |
| Botao | `4px` | `1px solid transparent` | primary: glow leve do acento |
| Input/select | `4px` | `1px solid var(--nova-border)` | sem sombra |
| Badge | `999px` | `1px solid current/acento` | sem sombra |
| Tabela | `6px` | `1px solid var(--nova-border-soft)` | sem sombra pesada |

## Espacamentos e Densidade

- Largura sidebar desktop: `148px` no mockup pequeno; no produto usar `156px` para preservar texto sem quebrar.
- Topbar: `34px` a `38px`.
- Padding conteudo desktop: `12px`.
- Gap geral entre blocos: `8px` a `10px`.
- Gap entre cards KPI: `8px`.
- Padding card: `10px` a `12px`.
- Padding tabela: `7px 9px`.
- Altura input/select: `30px`.
- Altura botao: `30px`.
- Altura badge: `18px` a `20px`.

## Tipografia

- Fonte: stack sans-serif nativa com peso forte para densidade operacional.
- Page title: `18px`, `font-weight: 800`, line-height `1.12`.
- Card title: `12px` a `14px`, `font-weight: 800`.
- KPI value: `20px` a `24px`, `font-weight: 900`.
- Labels/eyebrows: `8px`, uppercase, letter-spacing `0.12em`.
- Body/table: `11px` a `12px`.
- Metadata: `10px`.

## Sidebar

- Fixa a esquerda no desktop.
- Largura alvo produto: `156px`; mockup aparenta entre `112px` e `148px` dependendo do bloco.
- Logo NOVA no topo, branco com `A` laranja.
- Secoes uppercase pequenas: Geral, Monitoramento, Gestao, Relatorios, Configuracoes.
- Item ativo: barra vertical `2px`/`3px` laranja, fundo laranja translúcido, icone destacado.
- Itens compactos: altura `26px` a `30px`.
- Sem drawer/estado recolhido persistente no desktop para evitar quebra.

## Topbar

- Altura `36px`.
- Fundo escuro translúcido.
- Esquerda: icone de menu pequeno + texto `Sistema de gestão operacional`.
- Direita: acoes pequenas quadradas, badge de notificacao, usuario.
- Sem elementos grandes.

## Botoes

- Primario: fundo `linear-gradient(180deg, var(--nova-primary), var(--nova-primary-2))`, texto branco, altura `30px`, radius `4px`.
- Secundario: fundo `rgba(255,255,255,.035)`, borda `var(--nova-border)`, texto `--nova-text`.
- Ghost: fundo transparente, hover com `rgba(255,255,255,.05)`.
- Disabled: opacidade `.45`, cursor `not-allowed`, sem glow.

## Badges

- Uppercase, fonte `8px`, peso `800`, letter-spacing `.08em`.
- Padding `2px 7px`.
- Online/success: verde translúcido.
- Warning: amarelo translúcido.
- Danger: rosa/vermelho translúcido.
- Info: azul/ciano translúcido.
- Primary: acento da variante translúcido.

## Tabelas

- Header `#0e1824` ou token surface-2.
- Header uppercase `8px`, letter-spacing `.1em`.
- Body `11px`.
- Row border `1px solid rgba(148,163,184,.075)`.
- Hover `rgba(255,255,255,.025)`.
- Acoes na ultima coluna compactas.
- Nao usar linhas altas nem cards dentro de linhas.

## Graficos

- Cards com altura compacta.
- Chart area entre `110px` e `160px` conforme pagina.
- Linha de grafico fina, acento da variante ou status.
- Grid com linhas muito sutis.

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

## Regras De Implementacao

1. `layoutA` e o padrao.
2. Tema/variante deve ser definido em um unico ponto por atributo `data-nova-layout` ou provider equivalente.
3. Rotas existentes devem ser preservadas.
4. Endpoints, hooks, exportacao DOCX/PDF e logica de dados nao devem ser removidos.
5. Placeholders visuais devem ser marcados com `TODO` quando backend ainda nao existir.
6. Evitar overrides globais por pagina. Se precisar compatibilidade temporaria, concentrar em `nova-design-system.css` ou bloco unico central.
7. Comparar visualmente com a prancha antes de finalizar cada lote.

## Checklist Pixel-Like

- Sidebar fina e fixa.
- Topbar baixa.
- Cards pequenos, densos e escuros.
- Tabelas compactas.
- Botao principal laranja forte no `layoutA`.
- Item ativo do menu com acento vertical.
- Badges pequenos uppercase.
- Radius predominante entre `4px` e `8px`.
- Gaps predominantes entre `8px` e `10px`.
- Nada claro, nada espaçado demais, nada com card hero grande sem necessidade.
