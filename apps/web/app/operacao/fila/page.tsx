import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  DenseTable,
  EmptyState,
  FilterChip,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
  withParams,
} from "@/lib/list-query";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import {
  exceptionQueueLabel as queueLabel,
  exceptionStatusLabel as statusLabel,
  exceptionStatusTone as statusTone,
  exceptionTriageLabel as triageLabel,
  exceptionTriageTone as triageTone,
  occurrenceSeverityLabel as severityLabel,
  occurrenceSeverityTone as severityTone,
} from "@/lib/status-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type QueueSummary = {
  views: {
    all: number;
    pendingTriage: number;
    breached: number;
    dueSoon: number;
    unassigned: number;
  };
  queues: Array<{ queueKey: string; total: number }>;
};

type UserOption = { id: string; name: string; email: string; role: string };

type ExceptionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: string;
  severity: string;
  status: string;
  source: string;
  queueKey: string;
  classification: string;
  impact: string;
  urgency: string;
  priorityScore: number;
  triageStatus: string;
  silencedUntil: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  breachedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  assignee: { id: string; name: string; email: string; role: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count: { comments: number; activities: number };
};

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function linkLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.equipment) return `Ativo ${item.equipment.tag}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

function viewFilter(view: string) {
  if (view === "pending") return { triageStatus: "pending", status: "open" };
  if (view === "breached") return { onlyBreached: "true" };
  if (view === "dueSoon") return { onlyDueSoon: "true" };
  if (view === "unassigned") return { onlyUnassigned: "true" };
  return {};
}

function viewLabel(view: string) {
  if (view === "pending") return "Triagem";
  if (view === "breached") return "SLA estourado";
  if (view === "dueSoon") return "Vencendo";
  if (view === "unassigned") return "Sem dono";
  return "Toda a fila";
}

function slaState(item: ExceptionRow, now: Date) {
  if (item.status === "resolved") return { label: "Resolvido", tone: "success" };
  if (item.breachedAt) return { label: "Estourado", tone: "critical" };

  const dueAt = item.resolveDueAt ? new Date(item.resolveDueAt) : null;
  if (dueAt && !Number.isNaN(dueAt.getTime())) {
    const minutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
    if (minutes <= 30) return { label: "Vence agora", tone: "attention" };
  }

  return { label: "No prazo", tone: "success" };
}

function FilaTable({
  items,
  admin,
  now,
}: {
  items: ExceptionRow[];
  admin: boolean;
  now: Date;
}) {
  return (
    <TableShell className="nova-queue-table-shell">
      <DenseTable>
        <TableHead>
          <tr>
            {admin ? <th className="px-3 py-2">Sel.</th> : null}
            <th className="px-3 py-2">Caso</th>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2">Fila</th>
            <th className="px-3 py-2">Sev.</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Triagem</th>
            <th className="px-3 py-2">SLA</th>
            <th className="px-3 py-2">Responsável</th>
            <th className="px-3 py-2">Ação</th>
          </tr>
        </TableHead>
        <tbody>
          {items.map((item) => {
            const sla = slaState(item, now);

            return (
              <tr key={item.id}>
                {admin ? (
                  <TableCell>
                    <input
                      type="checkbox"
                      name="ids"
                      value={item.id}
                      className="nova-queue-row-check"
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link href={`/excecoes/${item.id}`} className="nova-queue-case-link">
                    {item.code}
                  </Link>
                  <div className="mt-1 max-w-[340px] text-[11px] font-semibold leading-5 text-slate-200">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    prioridade {item.priorityScore} · {item._count.comments} comentário(s) · {item._count.activities} atividade(s)
                  </div>
                </TableCell>
                <TableCell className="text-slate-300">
                  <div>{linkLabel(item)}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{item.source}</div>
                </TableCell>
                <TableCell className="text-slate-300">{queueLabel(item.queueKey)}</TableCell>
                <TableCell>
                  <TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill>
                </TableCell>
                <TableCell>
                  <TonePill tone={statusTone(item.status)}>{statusLabel(item.status)}</TonePill>
                </TableCell>
                <TableCell>
                  <TonePill tone={triageTone(item.triageStatus)}>{triageLabel(item.triageStatus)}</TonePill>
                </TableCell>
                <TableCell className="text-slate-300">
                  <TonePill tone={sla.tone}>{sla.label}</TonePill>
                  <div className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.resolveDueAt, "-")}</div>
                </TableCell>
                <TableCell className="text-slate-300">
                  <div>{item.assignee ? item.assignee.name : "-"}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.updatedAt, "-")}</div>
                </TableCell>
                <TableCell>
                  <Link href={`/excecoes/${item.id}`} className="nova-queue-row-action">
                    Abrir
                  </Link>
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </DenseTable>
    </TableShell>
  );
}

export default async function FilaOperacionalPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/fila");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const view = readStringParam(params, "view", "all");
  const queueKey = readStringParam(params, "queueKey");
  const severity = readStringParam(params, "severity", "all");
  const status = readStringParam(params, "status", "all");
  const triageStatus = readStringParam(params, "triageStatus", "all");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 15);

  async function bulkApply(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const ids = formData.getAll("ids").map((value) => String(value || "").trim()).filter(Boolean);
      const action = String(formData.get("action") || "").trim();
      const assigneeUserId = String(formData.get("assigneeUserId") || "").trim();

      if (!ids.length) {
        return { status: "error", message: "Selecione ao menos um caso da fila." };
      }

      await apiJson("/exceptions/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, action, assigneeUserId: assigneeUserId || undefined }),
      });

      revalidatePath("/operacao/fila");
      revalidatePath("/excecoes");
      revalidatePath("/operacao");
      revalidatePath("/operacao/atividade");
    revalidatePath("/administracao/sla");
      return { status: "success", message: `Ação ${action} aplicada em ${ids.length} item(ns).` };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [response, summary, usersResponse, commandCenter, telemetry] = await Promise.all([
    apiJson<PaginatedResponse<ExceptionRow>>(
      `/exceptions${buildApiQuery({
        q,
        queueKey: queueKey || undefined,
        severity: severity !== "all" ? severity : undefined,
        status: status !== "all" ? status : undefined,
        triageStatus: triageStatus !== "all" ? triageStatus : undefined,
        page,
        pageSize,
        sortBy: "priorityScore",
        sortDir: "desc",
        ...viewFilter(view),
      })}`,
    ),
    apiJson<QueueSummary>("/exceptions/queue/summary"),
    isAdmin ? apiJson<{ items: UserOption[] }>("/users?page=1&pageSize=100") : Promise.resolve({ items: [] as UserOption[] }),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry(),
  ]);

  const now = new Date();
  const queueRows = [...summary.queues].sort((a, b) => b.total - a.total);
  const maxQueueTotal = Math.max(1, ...queueRows.map((item) => item.total));
  const priorityItem = response.items[0];
  const activeQueueLabel = queueKey ? queueLabel(queueKey) : "Todas as filas";
  const acknowledgedOnPage = response.items.filter((item) => item.status === "acknowledged").length;
  const breachedOnPage = response.items.filter((item) => Boolean(item.breachedAt)).length;
  const unassignedOnPage = response.items.filter((item) => !item.assignee).length;
  const linkedToOccurrenceOnPage = response.items.filter((item) => Boolean(item.occurrence)).length;
  const linkedToMaintenanceOnPage = response.items.filter((item) => Boolean(item.maintenance)).length;
  const pressureScore = summary.views.breached + summary.views.dueSoon + summary.views.unassigned;

  const views = [
    { key: "all", label: "Toda a fila", total: summary.views.all },
    { key: "pending", label: "Triagem", total: summary.views.pendingTriage },
    { key: "breached", label: "SLA estourado", total: summary.views.breached },
    { key: "dueSoon", label: "Vencendo", total: summary.views.dueSoon },
    { key: "unassigned", label: "Sem dono", total: summary.views.unassigned },
  ];

  const kpis = [
    {
      label: "Abertos",
      value: summary.views.all,
      detail: `${formatNumber(summary.views.pendingTriage)} em triagem`,
      tone: "info",
    },
    {
      label: "SLA vencido",
      value: summary.views.breached,
      detail: `${formatNumber(summary.views.dueSoon)} vencendo`,
      tone: summary.views.breached ? "critical" : "success",
    },
    {
      label: "Sem responsável",
      value: summary.views.unassigned,
      detail: `${formatNumber(unassignedOnPage)} nesta página`,
      tone: summary.views.unassigned ? "attention" : "success",
    },
    {
      label: "Hosts em queda",
      value: telemetry.counts.down,
      detail: `${formatNumber(telemetry.counts.degraded)} degradado(s)`,
      tone: telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success",
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao/fila">
      <div className="nova-operation-queue-lit-page">
        <Surface className="nova-queue-command-hero">
          <div className="nova-queue-command-bar">
            <div className="min-w-0">
              <div className="nds-label">Operação / Fila</div>
              <h1>Fila do turno</h1>
              <p>
                Priorização, reconhecimento e despacho dos casos que exigem tratativa operacional.
              </p>
            </div>
            <div className="nova-queue-hero-actions">
              <Link href="/operacao/fila" className="nds-button" data-variant="secondary">
                Atualizar dados
              </Link>
              <Link href="/excecoes/nova" className="nds-button" data-variant="primary">
                Nova exceção
              </Link>
            </div>
          </div>

          <div className="nova-queue-focus-strip">
            <div>
              <span>Visão ativa</span>
              <strong>{viewLabel(view)}</strong>
            </div>
            <div>
              <span>Fila</span>
              <strong>{activeQueueLabel}</strong>
            </div>
            <div>
              <span>Pressão</span>
              <strong>{formatNumber(pressureScore)}</strong>
            </div>
            <div>
              <span>Atualizado</span>
              <strong>{formatDateTime(now)}</strong>
            </div>
          </div>
        </Surface>

        <section className="nova-queue-kpi-grid">
          {kpis.map((item) => (
            <article key={item.label} className="nova-queue-kpi-card">
              <div className="nova-queue-kpi-top">
                <span>{item.label}</span>
                <i className="nova-queue-kpi-dot" data-tone={item.tone} aria-label={item.tone} />
              </div>
              <strong>{formatNumber(item.value)}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </section>

        <div className="nova-queue-layout">
          <main className="nova-queue-main-stack">
            <Surface className="nova-queue-filter-panel">
              <SectionIntro
                eyebrow="Recortes"
                title="Ordem de trabalho"
                description="Troque a visão sem sair da fila."
                compact
              />
              <div className="nova-queue-chip-row">
                {views.map((item) => (
                  <FilterChip
                    key={item.key}
                    href={withParams("/operacao/fila", params, { view: item.key === "all" ? null : item.key, page: 1 })}
                    active={view === item.key}
                    label={item.label}
                    count={item.total}
                  />
                ))}
              </div>
              <div className="nova-queue-chip-row">
                {summary.queues.map((item) => (
                  <FilterChip
                    key={item.queueKey}
                    href={withParams("/operacao/fila", params, { queueKey: item.queueKey, page: 1 })}
                    active={queueKey === item.queueKey}
                    label={queueLabel(item.queueKey)}
                    count={item.total}
                  />
                ))}
              </div>

              <form method="GET" className="nova-queue-filter-form">
                <input name="q" defaultValue={q} placeholder="Buscar por código, título, vínculo ou responsável" />
                <select name="queueKey" defaultValue={queueKey}>
                  <option value="">Todas as filas</option>
                  {summary.queues.map((item) => (
                    <option key={item.queueKey} value={item.queueKey}>
                      {queueLabel(item.queueKey)}
                    </option>
                  ))}
                </select>
                <select name="severity" defaultValue={severity}>
                  <option value="all">Todas severidades</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
                <select name="status" defaultValue={status}>
                  <option value="all">Todos status</option>
                  <option value="open">Aberta</option>
                  <option value="acknowledged">Reconhecida</option>
                  <option value="silenced">Silenciada</option>
                  <option value="resolved">Resolvida</option>
                </select>
                <select name="triageStatus" defaultValue={triageStatus}>
                  <option value="all">Toda triagem</option>
                  <option value="pending">Pendente</option>
                  <option value="triaged">Triada</option>
                  <option value="closed">Fechada</option>
                </select>
                <input type="hidden" name="view" value={view} />
                <button className="nds-button" data-variant="primary">Aplicar</button>
              </form>
            </Surface>

            <Surface className="nova-queue-board-panel">
              <SectionIntro
                eyebrow="Lista de casos"
                title="Backlog priorizado"
                description={`${formatNumber(response.meta.total)} caso(s) no recorte, ordenado por prioridade operacional.`}
                actions={<TonePill tone={breachedOnPage ? "critical" : "info"}>{formatNumber(breachedOnPage)} vencido(s)</TonePill>}
                compact
              />

              {response.items.length ? (
                isAdmin ? (
                  <ActionForm
                    action={bulkApply}
                    className="nova-queue-bulk-form"
                    submitLabel="Aplicar em selecionados"
                    pendingLabel="Aplicando..."
                  >
                    <div className="nova-queue-bulk-toolbar">
                      <select name="action" defaultValue="ack">
                        <option value="ack">Reconhecer</option>
                        <option value="resolve">Resolver</option>
                        <option value="reopen">Reabrir</option>
                        <option value="silence_1h">Silenciar 1h</option>
                        <option value="assign">Atribuir</option>
                        <option value="unassign">Remover responsável</option>
                      </select>
                      <select name="assigneeUserId" defaultValue="">
                        <option value="">Escolha o responsável</option>
                        {usersResponse.items.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} · {user.email}
                          </option>
                        ))}
                      </select>
                      <span>Marque os casos na tabela e aplique a ação de despacho.</span>
                    </div>
                    <FilaTable items={response.items} admin now={now} />
                  </ActionForm>
                ) : (
                  <FilaTable items={response.items} admin={false} now={now} />
                )
              ) : (
                <EmptyState
                  title="Nenhum item encontrado"
                  description="A combinação atual de filtros não retornou casos. Ajuste o recorte da fila para seguir."
                />
              )}
            </Surface>

            <ListPagination pathname="/operacao/fila" searchParams={params} meta={response.meta} />
          </main>

          <aside className="nova-queue-side-stack">
            <Surface className="nova-queue-side-panel">
              <SectionIntro
                eyebrow="Fila do turno"
                title="Distribuição"
                description="Volume aberto por fila."
                compact
              />
              <div className="nova-queue-rank-list">
                {queueRows.length ? (
                  queueRows.map((item) => (
                    <Link
                      key={item.queueKey}
                      href={withParams("/operacao/fila", params, { queueKey: item.queueKey, page: 1 })}
                      className="nova-queue-rank-row"
                    >
                      <span>{queueLabel(item.queueKey)}</span>
                      <strong>{formatNumber(item.total)}</strong>
                      <i style={{ width: `${Math.max(6, (item.total / maxQueueTotal) * 100)}%` }} />
                    </Link>
                  ))
                ) : (
                  <div className="nova-queue-empty-mini">Sem fila aberta.</div>
                )}
              </div>
            </Surface>

            <Surface className="nova-queue-side-panel">
              <SectionIntro
                eyebrow="Próximo despacho"
                title={priorityItem ? priorityItem.code : "Sem item"}
                description={priorityItem ? priorityItem.title : "Não há item na visão atual."}
                compact
              />
              {priorityItem ? (
                <div className="nova-queue-priority-card">
                  <div className="nova-queue-priority-meta">
                    <TonePill tone={severityTone(priorityItem.severity)}>{severityLabel(priorityItem.severity)}</TonePill>
                    <TonePill tone={slaState(priorityItem, now).tone}>{slaState(priorityItem, now).label}</TonePill>
                    <TonePill tone={priorityItem.assignee ? "info" : "attention"}>
                      {priorityItem.assignee ? priorityItem.assignee.name : "Sem dono"}
                    </TonePill>
                  </div>
                  <div className="nova-queue-priority-detail">
                    {queueLabel(priorityItem.queueKey)} · vence {formatDateTime(priorityItem.resolveDueAt, "-")}
                  </div>
                  <div className="nova-queue-quick-actions">
                    <Link href={`/excecoes/${priorityItem.id}`} className="nds-button" data-variant="secondary">
                      Abrir caso
                    </Link>
                    {isAdmin ? (
                      <>
                        <ActionForm
                          action={bulkApply}
                          className="nova-queue-quick-form"
                          submitLabel="Reconhecer"
                          pendingLabel="Reconhecendo..."
                          variant="secondary"
                        >
                          <input type="hidden" name="ids" value={priorityItem.id} />
                          <input type="hidden" name="action" value="ack" />
                        </ActionForm>
                        <ActionForm
                          action={bulkApply}
                          className="nova-queue-quick-form"
                          submitLabel="Silenciar 1h"
                          pendingLabel="Silenciando..."
                          variant="secondary"
                        >
                          <input type="hidden" name="ids" value={priorityItem.id} />
                          <input type="hidden" name="action" value="silence_1h" />
                        </ActionForm>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Surface>

            <Surface className="nova-queue-side-panel">
              <SectionIntro
                eyebrow="Sinais"
                title="Leitura rápida"
                description="Dados para decidir se o próximo passo é triagem, NOC ou execução."
                compact
              />
              <div className="nova-queue-signal-grid">
                <div><span>Reconhecidas</span><strong>{formatNumber(acknowledgedOnPage)}</strong></div>
                <div><span>Com alerta</span><strong>{formatNumber(linkedToOccurrenceOnPage)}</strong></div>
                <div><span>Com chamado</span><strong>{formatNumber(linkedToMaintenanceOnPage)}</strong></div>
                <div><span>Alertas abertos</span><strong>{formatNumber(commandCenter.metrics.openOccurrences)}</strong></div>
              </div>
              <div className="nova-queue-route-list">
                <Link href="/alertas">Alertas operacionais</Link>
                <Link href="/chamados">Agenda técnica</Link>
                <Link href="/monitoramento/sensores">Monitoramento NOC</Link>
                <Link href="/administracao/sla">Contratos SLA</Link>
              </div>
            </Surface>
          </aside>
        </div>
      </div>
    </NovaLitShell>
  );
}
