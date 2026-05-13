# Checklist de QA visual e operacional local

Este checklist complementa o comando `corepack pnpm qa:local`.

## Ambiente

- Web: http://localhost:3010
- API: http://localhost:4000/health

Antes de validar visualmente, rode:

```bash
corepack pnpm qa:local
```

## Critérios gerais

- Sem overflow horizontal em 360px, 768px, 1366px e 1920px.
- Drawer/menu mobile abre e fecha corretamente.
- Tabelas, cards e listas ficam legíveis em mobile.
- Rotas protegidas redirecionam para login sem sessão.
- Rotas públicas carregam sem erro.
- Redirects legados apontam para rotas atuais.
- Formulários exibem validações claras.
- Dados sensíveis aparecem mascarados por padrão.
- Ações administrativas respeitam permissões e feature flags.
- Foco visível em links, botões e campos.

## Viewports mínimos

| Viewport | Uso |
| --- | --- |
| 360x800 | celular pequeno |
| 390x844 | celular comum |
| 768x1024 | tablet |
| 1366x768 | notebook |
| 1920x1080 | desktop |

## Telas prioritárias

### Login

- `/login`
- `/esqueci-senha`
- `/redefinir-senha`

Validar formulário, erros, recuperação de senha e redirecionamento após login.

### Dashboard

- `/dashboard`

Validar cards, indicadores, listas e responsividade.

### Operação

- `/operacao`
- `/operacao/atividade`
- `/operacao/fila`
- `/operacao/excecoes`
- `/operacao/sla`
- `/operacao/automacoes`
- `/operacao/importacao`

Validar fila, SLA, automações, importação, permissões e responsividade.

### Exceções

- `/excecoes`
- `/excecoes/cadastro`
- `/excecoes/[id]`
- `/operacao/excecoes`
- `/operacao/excecoes/[id]`

Validar prioridade, status, fila, SLA, comentários, histórico e estados vencidos/silenciados.

### Monitoramento

- `/monitoramento`
- `/monitoramento/fontes`
- `/monitoramento/mapas`
- `/monitoramento/sensores`

Validar summary, command center, fontes, mapas, sensores e estados de telemetria indisponível.

### Relatórios

- `/relatorios`
- `/relatorios/monitoramento`
- `/relatorios/monitoramento/automacoes`
- `/relatorios/consumo`
- `/relatorios/disponibilidade`
- `/relatorios/performance`

Validar filtros, unidades, fontes e mensagens. Exportações devem ser testadas pela ação da tela, não por GET direto.

### Ativos, unidades, parceiros, contratos e usuários

- `/ativos`
- `/ativos/starlinks`
- `/unidades`
- `/parceiros`
- `/contratos`
- `/usuarios`

Validar listas, filtros, detalhes, formulários, estados vazios e mobile.

## Checklist final antes de PR

```bash
corepack pnpm qa:local
git status
```

- `qa:local` passa.
- Nenhum processo fica aberto nas portas 3010/4000.
- `.tmp` não fica no working tree.
- `git status` fica limpo antes do push.
- PR descreve telas e viewports testados.
