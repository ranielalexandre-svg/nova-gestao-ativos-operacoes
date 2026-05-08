import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { ActionForm } from "@/components/action-form";
import {
  ConnectedRoutesPanel,
  WorkflowStatsPanel,
} from "@/components/ops-side-panels";
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
import { ListPagination } from "@/components/list-pagination";
import {
  RegistryHero,
  RegistrySummaryStrip,
} from "@/components/registry-shell";
import { apiJson } from "@/lib/server-api";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
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
import { formatDateTime } from "@/lib/formatters";
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
  queues: { queueKey: string; total: number }[];
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
  assignee: { id: string; name: string; email: string; role: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count: { comments: number; activities: number };
};

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

function FilaTable({ items, admin }: { items: ExceptionRow[]; admin: boolean }) {
  return (
    <TableShell><DenseTable><TableHead><tr>
            {admin ? <th className="px-3 py-2">Sel.</th> : null}
            <th className="px-3 py-2">Caso</th><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Triagem</th><th className="px-3 py-2">SLA</th><th className="px-3 py-2">Responsável</th><th className="px-3 py-2">Atualizado</th></tr></TableHead><tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-white/6 align-top last:border-b-0 hover:bg-white/[0.02]">
              {admin ? (
                <TableCell><input type="checkbox" name="ids" value={item.id} className="mt-1 h-4 w-4 rounded border-white/12 bg-transparent" /></TableCell>
              ) : null}
              <TableCell><Link href={`/excecoes/${item.id}`} className="font-medium text-white transition hover:text-white">{item.code} · {item.title}</Link><div className="mt-1 text-[10px] leading-5 text-slate-500">{linkLabel(item)} · prioridade {item.priorityScore}</div><div className="mt-1 text-[10px] text-slate-500">{item._count.comments} comentários · {item._count.activities} atividades</div></TableCell><TableCell className="text-slate-300"><div>{queueLabel(item.queueKey)}</div><div className="mt-1 text-[10px] text-slate-500">{item.source}</div></TableCell><TableCell><TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill></TableCell><TableCell><TonePill tone={statusTone(item.status)}>{statusLabel(item.status)}</TonePill></TableCell><TableCell><TonePill tone={triageTone(item.triageStatus)}>{triageLabel(item.triageStatus)}</TonePill></TableCell><TableCell className="text-slate-300"><div>{item.breachedAt ? <span className="text-[color:var(--nova-danger)]">estourado</span> : <span className="text-[color:var(--nova-success)]">no prazo</span>}</div><div className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.resolveDueAt, "—")}</div></TableCell><TableCell className="text-slate-300">{item.assignee ? item.assignee.name : "—"}</TableCell><TableCell className="text-slate-400">{formatDateTime(item.updatedAt, "—")}</TableCell></tr>
          ))}
        </tbody></DenseTable></TableShell>
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

  const views = [
    { key: "all", label: "Toda a fila", total: summary.views.all },
    { key: "pending", label: "Triagem", total: summary.views.pendingTriage },
    { key: "breached", label: "SLA estourado", total: summary.views.breached },
    { key: "dueSoon", label: "Vencendo", total: summary.views.dueSoon },
    { key: "unassigned", label: "Sem dono", total: summary.views.unassigned },
  ];
  const acknowledgedOnPage = response.items.filter((item) => item.status === "acknowledged").length;
  const breachedOnPage = response.items.filter((item) => Boolean(item.breachedAt)).length;
  const unassignedOnPage = response.items.filter((item) => !item.assignee).length;
  const linkedToOccurrenceOnPage = response.items.filter((item) => Boolean(item.occurrence)).length;
  const linkedToMaintenanceOnPage = response.items.filter((item) => Boolean(item.maintenance)).length;
  const connectedRoutes = [
    {
      href: "/alertas",
      title: "Alertas",
      description: "Volte para incidentes quando o item da fila já depende do caso operacional formalizado.",
      badge: <TonePill tone="info">incidente</TonePill>,
    },
    {
      href: "/chamados",
      title: "Agenda técnica",
      description: "Quando a próxima ação já é execução, reagendamento ou conclusão em campo, siga para chamados.",
      badge: <TonePill tone="success">agenda</TonePill>,
    },
    {
      href: "/sensores",
      title: "Hosts e eventos",
      description: "Use a leitura dos hosts das unidades para reduzir dúvida antes de atribuir, silenciar ou escalar.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao/fila">
      <div className="nova-operation-queue-lit-page"><RegistryHero
        eyebrow="Workbench"
        title="Fila de execução do turno"
        description="Reconhecimento, atribuição e tratativa."
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/operacao/fila"
              className="nds-button"
              data-variant="secondary"
            >
              Resetar filtros
            </Link><Link
              href="/sensores"
              className="nds-button"
              data-variant="primary"
            >
              Abrir monitoramento
            </Link></div>
        }
      /><RegistrySummaryStrip
        items={[
          {
            label: "Fila total",
            value: summary.views.all,
            meta: "volume geral do turno",
            tone: "info",
          },
          {
            label: "Na página",
            value: response.items.length,
            meta: `${pageSize} por página`,
            tone: "neutral",
          },
          {
            label: "Estourados",
            value: breachedOnPage,
            meta: "na visão atual",
            tone: breachedOnPage ? "critical" : "success",
          },
          {
            label: "Sem dono",
            value: unassignedOnPage,
            meta: "sem responsável na página",
            tone: unassignedOnPage ? "attention" : "neutral",
          },
          {
            label: "Hosts em queda",
            value: telemetry.counts.down,
            meta: `${telemetry.counts.degraded} degradados`,
            tone: telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success",
          },
        ]}
        noteTitle="Fila primeiro"
        noteCopy="O turno se orienta daqui. Alertas, chamados e monitoramento entram como continuidade de trabalho, não como competição pela tela."
      /><Surface><SectionIntro
          eyebrow="Visões"
          title="Recortes que mudam a ordem do turno"
          description="Use essas visões quando quiser trocar de foco sem refazer toda a busca."
          compact
        /><div className="mt-2 flex flex-wrap gap-2">
          {views.map((item) => (
            <FilterChip
              key={item.key}
              href={withParams("/operacao/fila", params, { view: item.key === "all" ? null : item.key, page: 1 })}
              active={view === item.key}
              label={item.label}
              count={item.total}
            />
          ))}
        </div><div className="mt-2 flex flex-wrap gap-2">
          {summary.queues.map((item) => (
            <FilterChip
              key={item.queueKey}
              href={withParams("/operacao/fila", params, { queueKey: item.queueKey, page: 1 })}
              active={queueKey === item.queueKey}
              label={queueLabel(item.queueKey)}
              count={item.total}
            />
          ))}
        </div></Surface><Surface><SectionIntro eyebrow="Filtro" title="Busca e recorte" description="O filtro muda a grade principal sem tirar a operação do trilho." compact /><form method="GET" className="nova-filter-grid nova-filter-grid--queue mt-2"><input name="q" defaultValue={q} placeholder="Buscar por código, título, vínculo ou responsável" /><select name="queueKey" defaultValue={queueKey}><option value="">Todas as filas</option>
            {summary.queues.map((item) =><option key={item.queueKey} value={item.queueKey}>{queueLabel(item.queueKey)}</option>)}
          </select><select name="severity" defaultValue={severity}><option value="all">Todas severidades</option><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select><select name="status" defaultValue={status}><option value="all">Todos status</option><option value="open">Aberta</option><option value="acknowledged">Reconhecida</option><option value="silenced">Silenciada</option><option value="resolved">Resolvida</option></select><select name="triageStatus" defaultValue={triageStatus}><option value="all">Toda triagem</option><option value="pending">Pendente</option><option value="triaged">Triada</option><option value="closed">Fechada</option></select><input type="hidden" name="view" value={view} /><button className="nds-button" data-variant="primary">Aplicar</button></form></Surface><div className="nova-side-grid nova-side-grid--380"><div className="grid gap-2">
          {isAdmin ? (
            <Surface><SectionIntro eyebrow="Despacho" title="Ação em lote" description="Reconhecer, atribuir, silenciar ou resolver." compact /><ActionForm action={bulkApply} className="mt-2 grid gap-2" submitLabel="Aplicar em selecionados" pendingLabel="Aplicando..."><div className="nova-bulk-action-grid"><select name="action" defaultValue="ack"><option value="ack">Reconhecer</option><option value="resolve">Resolver</option><option value="reopen">Reabrir</option><option value="silence_1h">Silenciar 1h</option><option value="assign">Atribuir</option><option value="unassign">Remover responsável</option></select><select name="assigneeUserId" defaultValue=""><option value="">Escolha o responsável</option>
                    {usersResponse.items.map((user) =><option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                  </select><div className="flex items-center text-[11px] leading-5 text-slate-400">A leitura principal continua na grade. Essa barra só encurta o despacho quando ele já está claro.</div></div>
                {response.items.length ? <FilaTable items={response.items} admin /> : null}
              </ActionForm></Surface>
          ) : null}

          {!isAdmin && response.items.length ? (
            <Surface><SectionIntro eyebrow="Grade" title="Casos da fila" description="Triagem, responsável e prazo." compact /><div className="mt-2"><FilaTable items={response.items} admin={false} /></div></Surface>
          ) : null}

          {!response.items.length ? <EmptyState title="Nenhum item encontrado" description="A combinação atual de filtros não retornou casos. Ajuste o recorte da fila para seguir." /> : null}
        </div><div className="grid gap-2"><WorkflowStatsPanel
            eyebrow="Turno"
            title="Sinais rápidos do backlog"
            description="Esses números ajudam a saber se a próxima ação é triagem, atribuição, correção técnica ou ida ao monitoramento."
            stats={[
              {
                label: "Reconhecidas na página",
                value: acknowledgedOnPage,
                tone: acknowledgedOnPage ? "info" : "neutral",
              },
              {
                label: "Sem responsável",
                value: unassignedOnPage,
                tone: unassignedOnPage ? "attention" : "neutral",
              },
              {
                label: "Com alerta",
                value: linkedToOccurrenceOnPage,
                tone: linkedToOccurrenceOnPage ? "info" : "neutral",
              },
              {
                label: "Com chamado",
                value: linkedToMaintenanceOnPage,
                tone: linkedToMaintenanceOnPage ? "success" : "neutral",
              },
              {
                label: "Alertas abertos",
                value: commandCenter.metrics.openOccurrences,
                tone: commandCenter.metrics.openOccurrences ? "attention" : "neutral",
              },
              {
                label: "Hosts offline",
                value: telemetry.counts.down,
                tone: telemetry.counts.down ? "critical" : "neutral",
              },
            ]}
          /><ConnectedRoutesPanel
            eyebrow="Histórico"
            title="Rotas que completam o despacho"
            description="Estas rotas continuam o trabalho da fila sem virar navegação paralela."
            routes={connectedRoutes}
          /></div></div><ListPagination pathname="/operacao/fila" searchParams={params} meta={response.meta} />      </div>
    </NovaLitShell>
  );
}
