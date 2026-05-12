# QA Checklist — NOVA

## Geral

- [ ] `git status` limpo.
- [ ] `pnpm install` passa.
- [ ] TypeScript web passa.
- [ ] Prisma generate passa.
- [ ] Prisma migrate status em dia.
- [ ] Build web passa.
- [ ] Build API passa.

## Autenticação

- [ ] `/login` abre.
- [ ] Login válido funciona.
- [ ] Login inválido mostra erro.
- [ ] Remember marcado funciona.
- [ ] Remember desmarcado funciona.
- [ ] Logout funciona.
- [ ] Redirect por role funciona.

## Recuperação de senha

- [ ] `/esqueci-senha` abre.
- [ ] E-mail inválido mostra erro.
- [ ] E-mail válido mostra mensagem genérica.
- [ ] `/redefinir-senha` abre.
- [ ] Senha fraca é rejeitada.
- [ ] Token inválido é rejeitado.
- [ ] Reset válido finaliza.

## Dashboard

- [ ] `/dashboard` abre.
- [ ] KPIs carregam.
- [ ] Empty state funciona.
- [ ] Erro parcial não quebra.
- [ ] SLA aparece.
- [ ] Telemetria aparece.

## Operação

- [ ] `/operacao` abre.
- [ ] `/operacao/fila` abre.
- [ ] `/operacao/sla` abre.
- [ ] `/operacao/atividade` abre.
- [ ] Filtros funcionam.

## Chamados

- [ ] `/chamados` abre.
- [ ] `/chamados/novo` abre.
- [ ] Detalhe abre.
- [ ] Breadcrumb aparece.
- [ ] Criar/editar funciona.

## Exceções

- [ ] `/excecoes` abre.
- [ ] `/excecoes/nova` abre.
- [ ] Detalhe abre.
- [ ] SLA aparece.
- [ ] Comentário funciona.

## Alertas

- [ ] `/alertas` abre.
- [ ] Detalhe abre.
- [ ] Breadcrumb aparece.

## Usuários

- [ ] `/usuarios` abre.
- [ ] `/usuarios/nova` abre.
- [ ] Detalhe abre.
- [ ] Ícones não estouram.
- [ ] Shell é `NovaLitShell`.

## Perfis

- [ ] `/perfis` abre.
- [ ] Layout não estoura.

## Parceiros

- [ ] `/parceiros` abre.
- [ ] Detalhe abre.
- [ ] Anexos funcionam.

## Unidades

- [ ] `/unidades` abre.
- [ ] Detalhe abre.
- [ ] Telemetria aparece.

## Ativos

- [ ] `/ativos` abre.
- [ ] Detalhe abre.
- [ ] Credenciais sensíveis ficam mascaradas.

## Responsividade

Testar:

- [ ] 360px;
- [ ] 768px;
- [ ] desktop.

Verificar:

- [ ] sem overflow crítico;
- [ ] menu acessível;
- [ ] tabelas controladas;
- [ ] cards legíveis.

## Acessibilidade

- [ ] Inputs com label.
- [ ] Botões com texto.
- [ ] Breadcrumb com aria-label.
- [ ] Alertas com role quando necessário.
- [ ] Navegação por teclado.
