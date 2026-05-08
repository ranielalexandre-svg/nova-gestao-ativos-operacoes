# Diretrizes visuais NOVA Telecom

Este documento consolida o handoff dos mockups NOVA para orientar a implementação das telas reais do Site de Gestão.

## Objetivo

Transformar os mockups em UI real no Next/React, preservando comportamento, integrações e dados reais existentes. Os mockups são referência visual; não devem ser usados como screenshots estáticos dentro do produto.

## Não fazer

- Não usar screenshot estático como tela final.
- Não apagar integrações, rotas ou contratos de API sem necessidade.
- Não fazer patch em massa sem entender os arquivos afetados.
- Não duplicar CSS com múltiplos blocos conflitantes.
- Não tratar os mockups apenas como inspiração vaga: ajustar hierarquia, espaçamento, proporção, cards, badges, botões, cores, grids e estados até ficar visualmente equivalente ao padrão NOVA.

## Fazer

- Usar componentes reutilizáveis para shell, sidebar, topbar, card, KPI, badge, tabela, filtro e painel lateral.
- Preservar comportamento de rotas, botões, filtros, formulários e ações existentes.
- Manter estado vazio planejado quando não houver dados.
- Validar a cada etapa com typecheck, lint e testes.
- Tirar screenshots locais e comparar visualmente com os mockups quando a mudança for visual.
- Manter pageSize máximo de 100 em carregamentos administrativos.
- Evitar dados fake nas telas finais; usar API real e fallbacks vazios/planejados.

## Tokens visuais sugeridos

- Fundo: `#070b10`, `#070c12`, com radiais laranja/azul e grid sutil de 64px.
- Card: `#111923`, `#121923`, borda `rgba(84,103,132,.42)`.
- Primário: `#ff7708`.
- Texto forte: `#ffffff`.
- Texto secundário: `#9fbce0`, `#6d86ad`.
- Sucesso: `#22c96d`.
- Atenção: `#f59e0b`.
- Erro: `#ff4d83`.
- Info: `#38bdf8`.

## Checklist por tela

- Sidebar correta e item ativo.
- Topbar correta.
- Breadcrumb, título e subtítulo.
- KPIs no mesmo padrão visual.
- Filtros e ações primárias/secundárias.
- Conteúdo principal com tabela, cards ou gráficos reais.
- Painel lateral quando existir no mockup.
- Estados vazios coerentes.
- Responsividade sem destruir o layout desktop.
- Sem 404 em links principais.

## Referência específica: Exceções

A tela de Exceções deve seguir o mockup `22-operational_exceptions_management_dashboard_overvi.png`:

- Breadcrumb `Operação / Exceções`.
- Título `Exceções` e subtítulo operacional.
- Ações no topo: atualizar dados e nova exceção.
- Faixa de fluxo: Detecção -> Análise -> Resolução.
- KPIs compactos para abertas, validação, aprovadas/resolvidas e rejeitadas/silenciadas.
- Filtros em card próprio, sem ocupar a tela inteira.
- Tabela principal de exceções como centro da página.
- Painel lateral com resumo e ações rápidas.
- Botão primário laranja para criação.

## Referência específica: Chamados

A tela de Chamados deve seguir o mockup `25-modern_telecom_ticket_management_dashboard.png` e manter integração com alertas, exceções e fila operacional.

## Referência específica: Operação/Fila/SLA

As telas de operação devem preservar a ideia de fila de despacho, prioridade visual, responsável, SLA e próximos passos claros. CTAs vindos de alertas e chamados devem pré-preencher a criação de exceção com origem, vínculo e descrição contextual.
