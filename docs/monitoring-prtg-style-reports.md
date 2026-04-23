# Relatorios de monitoramento Zabbix com entrega PRTG-like

## Decisao

O NOVA nao deve coletar dados do PRTG para este fluxo. A fonte tecnica e o
Zabbix. O objetivo e reproduzir a experiencia de entrega do PRTG: periodo,
sensores, estatisticas e graficos em layout claro para cliente.

## Primeira entrega

- Endpoint autenticado: `GET /api/monitoring/reports/prtg-style`.
- Parametros: `unitId`, `from`, `to`.
- A unidade e vinculada ao host Zabbix pelo mesmo mecanismo de match ja usado na
  mesa de monitoramento.
- O backend busca itens numericos do host e reconhece automaticamente:
  - trafego recebido/enviado;
  - ping/latencia;
  - perda de pacote;
  - uptime.
- Historico e lido via `history.get` do Zabbix.
- A tela web fica em `/relatorios/monitoramento`.
- A exportacao inicial e por impressao/salvar PDF do navegador, com CSS de
  impressao e papel timbrado simples.

## Modelo de dados entregue ao frontend

Cada bloco do relatorio possui:

- titulo no estilo sensor PRTG;
- tipo de sensor;
- caminho da sonda/grupo/dispositivo;
- series historicas normalizadas;
- estatisticas `ultimo`, `min`, `media`, `max` e quantidade de pontos.

## Proximas evolucoes

- Configurar manualmente quais itens Zabbix entram em cada relatorio.
- Salvar templates de relatorio por cliente/unidade.
- Exportar PDF server-side com Playwright para padronizar o resultado sem
  depender do navegador do usuario.
- Incluir papel timbrado oficial em alta resolucao.
- Gerar imagens PNG individuais dos graficos.
- Salvar o PDF gerado como anexo da unidade.
