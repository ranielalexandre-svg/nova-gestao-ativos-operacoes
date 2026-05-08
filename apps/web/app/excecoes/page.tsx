import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  emptyCommandCenter,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type KindFilter = "all" | "generic" | "sla" | "integration" | "occurrence" | "maintenance" | "automation";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";
type StatusFilter = "all" | "open" | "acknowledged" | "resolved" | "silenced";
type TriageFilter = "all" | "pending" | "triaged" | "closed";
type SortBy = "createdAt" | "severity" | "status" | "priorityScore" | "resolveDueAt";
type SortDir = "asc" | "desc";
type ViewFilter = "all" | "pending" | "breached" | "dueSoon" | "unassigned";

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

type ExceptionSummary = {
  counts: {
    openCount: number;
    criticalCount: number;
    silencedCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};

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

type ExcecoesState = {
  q: string;
  view: ViewFilter;
  kind: KindFilter;
  severity: SeverityFilter;
  status: StatusFilter;
  triageStatus: TriageFilter;
  queueKey: string;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const kindOptions = ["all", "generic", "sla", "integration", "occurrence", "maintenance", "automation"] as const;
const severityOptions = ["all", "low", "medium", "high", "critical"] as const;
const statusOptions = ["all", "open", "acknowledged", "resolved", "silenced"] as const;
const triageOptions = ["all", "pending", "triaged", "closed"] as const;
const sortByOptions = ["createdAt", "severity", "status", "priorityScore", "resolveDueAt"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const viewOptions = ["all", "pending", "breached", "dueSoon", "unassigned"] as const;
const pageSizeOptions = [10, 20, 50] as const;

const emptySummary: ExceptionSummary = {
  counts: {
    openCount: 0,
    criticalCount: 0,
    silencedCount: 0,
    breachedCount: 0,
    dueSoonCount: 0,
    unassignedCount: 0,
    pendingTriageCount: 0,
  },
};

const emptyQueueSummary: QueueSummary = {
  views: {
    all: 0,
    pendingTriage: 0,
    breached: 0,
    dueSoon: 0,
    unassigned: 0,
  },
  queues: [],
};

function option<T extends readonly string[]>(options: T, value: string, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function viewFilter(view: ViewFilter) {
  if (view === "pending") return { triageStatus: "pending", status: "open" };
  if (view === "breached") return { onlyBreached: "true" };
  if (view === "dueSoon") return { onlyDueSoon: "true" };
  if (view === "unassigned") return { onlyUnassigned: "true" };
  return {};
}

function kindLabel(value: string) {
  if (value === "generic") return "Geral";
  if (value === "sla") return "SLA";
  if (value === "integration") return "Integração";
  if (value === "occurrence") return "Alerta";
  if (value === "maintenance") return "Chamado";
  if (value === "automation") return "Automação";
  return value || "Sem tipo";
}

function queueLabel(value: string) {
  if (value === "ops-general") return "Geral";
  if (value === "ops-integracoes") return "Integrações";
  if (value === "ops-ocorrencias") return "Alertas";
  if (value === "ops-manutencao") return "Chamados";
  if (value === "ops-sla") return "SLA";
  if (value === "ops-automacoes") return "Automações";
  return value || "Sem fila";
}

function severityLabel(value: string) {
  if (value === "critical") return "Crítica";
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  if (value === "low") return "Baixa";
  return value || "Sem severidade";
}

function severityTone(value: string): Tone {
  if (value === "critical") return "red";
  if (value === "high") return "orange";
  if (value === "medium") return "blue";
  if (value === "low") return "green";
  return "slate";
}

function statusLabel(value: string) {
  if (value === "open") return "Aberta";
  if (value === "acknowledged") return "Reconhecida";
  if (value === "resolved") return "Resolvida";
  if (value === "silenced") return "Silenciada";
  return value || "Sem status";
}

function statusTone(value: string): Tone {
  if (value === "open") return "orange";
  if (value === "acknowledged") return "blue";
  if (value === "resolved") return "green";
  if (value === "silenced") return "slate";
  return "slate";
}

function triageLabel(value: string) {
  if (value === "pending") return "Pendente";
  if (value === "triaged") return "Triada";
  if (value === "closed") return "Fechada";
  return value || "Sem triagem";
}

function triageTone(value: string): Tone {
  if (value === "pending") return "orange";
  if (value === "triaged") return "blue";
  if (value === "closed") return "green";
  return "slate";
}

function sourceLabel(value: string) {
  if (value === "manual") return "manual";
  if (value === "automation") return "automação";
  return value || "origem indefinida";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function slaLabel(item: ExceptionRow) {
  if (item.breachedAt) return "SLA estourado";
  if (item.resolveDueAt) return formatDateTime(item.resolveDueAt);
  if (item.firstResponseDueAt) return formatDateTime(item.firstResponseDueAt);
  return "sem SLA";
}

function linkSummary(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.equipment) return `Ativo ${item.equipment.tag}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

function linkHref(item: ExceptionRow) {
  if (item.integration) return "/integracoes";
  if (item.occurrence) return `/alertas/${item.occurrence.id}`;
  if (item.maintenance) return `/chamados/${item.maintenance.id}`;
  if (item.equipment) return `/ativos/${item.equipment.id}`;
  if (item.unit) return `/unidades/${item.unit.id}`;
  if (item.partner) return `/parceiros/${item.partner.id}`;
  return "/excecoes";
}

function rowTone(item: ExceptionRow): Tone {
  if (item.breachedAt) return "red";
  if (item.status === "resolved") return "green";
  if (item.triageStatus === "pending") return "orange";
  if (item.assignee) return "blue";
  return "slate";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: ExcecoesState): RawSearchParams {
  return {
    q: state.q || undefined,
    view: state.view,
    kind: state.kind,
    severity: state.severity,
    status: state.status,
    triageStatus: state.triageStatus,
    queueKey: state.queueKey || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className="nova-lit-card nova-exceptions-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-exceptions-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-exceptions-progress">
      <div>
        <span>{label}</span>
        <b>{safe}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safe}%` }} />
      </i>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="nova-exceptions-empty">
      <div>N</div>
      <strong>Nenhuma exceção encontrada</strong>
      <span>Ajuste os filtros ou aguarde novos casos operacionais.</span>
    </div>
  );
}

export default async function ExcecoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/excecoes");

  const params = await resolveSearchParams(searchParams);
  const state: ExcecoesState = {
    q: readStringParam(params, "q", ""),
    view: option(viewOptions, readStringParam(params, "view", "all"), "all"),
    kind: option(kindOptions, readStringParam(params, "kind", "all"), "all"),
    severity: option(severityOptions, readStringParam(params, "severity", "all"), "all"),
    status: option(statusOptions, readStringParam(params, "status", "all"), "all"),
    triageStatus: option(triageOptions, readStringParam(params, "triageStatus", "all"), "all"),
    queueKey: readStringParam(params, "queueKey", ""),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "priorityScore"), "priorityScore"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const [response, summary, queueSummary, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<ExceptionRow>>(
      `/exceptions${buildApiQuery({
        q: state.q,
        kind: state.kind !== "all" ? state.kind : undefined,
        severity: state.severity !== "all" ? state.severity : undefined,
        status: state.status !== "all" ? state.status : undefined,
        triageStatus: state.triageStatus !== "all" ? state.triageStatus : undefined,
        queueKey: state.queueKey || undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
        ...viewFilter(state.view),
      })}`,
    ),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptySummary),
    safeApiJson<QueueSummary>("/exceptions/queue/summary", emptyQueueSummary),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const rows = response.items;
  const openOnPage = rows.filter((item) => item.status === "open").length;
  const acknowledgedOnPage = rows.filter((item) => item.status === "acknowledged").length;
  const resolvedOnPage = rows.filter((item) => item.status === "resolved").length;
  const pendingOnPage = rows.filter((item) => item.triageStatus === "pending").length;
  const breachedOnPage = rows.filter((item) => Boolean(item.breachedAt)).length;
  const unassignedOnPage = rows.filter((item) => !item.assignee).length;
  const criticalOnPage = rows.filter((item) => item.severity === "critical").length;
  const automatedOnPage = rows.filter((item) => item.source === "automation").length;
  const currentParams = stateParams(state);
  const operationalPressure =
    summary.counts.breachedCount * 2 +
    summary.counts.criticalCount +
    summary.counts.pendingTriageCount +
    commandCenter.metrics.openOccurrences;
  const priorityRows = [...rows]
    .sort((a, b) => {
      if (Boolean(a.breachedAt) !== Boolean(b.breachedAt)) return a.breachedAt ? -1 : 1;
      return b.priorityScore - a.priorityScore;
    })
    .slice(0, 7);

  const kpis = [
    { label: "Abertas", value: String(summary.counts.openCount), hint: "casos na fila", tone: summary.counts.openCount ? "orange" as const : "green" as const },
    { label: "Validação", value: String(summary.counts.pendingTriageCount), hint: "pendentes de triagem", tone: summary.counts.pendingTriageCount ? "orange" as const : "green" as const },
    { label: "Resolvidas", value: String(resolvedOnPage), hint: "no recorte atual", tone: resolvedOnPage ? "green" as const : "slate" as const },
    { label: "Silenciadas", value: String(summary.counts.silencedCount), hint: "rejeitadas ou pausadas", tone: summary.counts.silencedCount ? "slate" as const : "green" as const },
    { label: "SLA", value: String(summary.counts.breachedCount), hint: "estourado", tone: summary.counts.breachedCount ? "red" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/excecoes">
      <nav className="nova-exceptions-breadcrumb" aria-label="Breadcrumb">
        <Link href="/operacao">Operação</Link>
        <span>/</span>
        <strong>Exceções</strong>
      </nav>

      <div className="nova-lit-page-heading nova-exceptions-heading">
        <div>
          <h1>Exceções</h1>
          <p className="nova-lit-page-subtitle">Casos operacionais, triagem, SLA, prioridade e vínculo com alertas ou chamados.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">Fila</Link>
          <Link href="/operacao/sla" className="nova-lit-button nova-lit-button-secondary">SLA</Link>
          <Link href={withParams("/excecoes", currentParams, { page: state.page })} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
          <Link href="/excecoes/nova" className="nova-lit-button nova-lit-button-primary">Nova exceção</Link>
        </div>
      </div>

      <section className="nova-exceptions-flow" aria-label="Fluxo de tratamento de exceções">
        <article className="is-active">
          <span>01</span>
          <strong>Detecção</strong>
          <small>Sinal capturado por alerta, chamado, SLA ou automação.</small>
        </article>
        <i>→</i>
        <article>
          <span>02</span>
          <strong>Análise</strong>
          <small>Triagem, responsável, prioridade e vínculo operacional.</small>
        </article>
        <i>→</i>
        <article>
          <span>03</span>
          <strong>Resolução</strong>
          <small>Reconhecimento, silenciamento ou fechamento do caso.</small>
        </article>
      </section>

      <section className="nova-exceptions-kpi-grid" aria-label="Indicadores de exceções">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="nova-exceptions-view-strip" aria-label="Visões rápidas de exceções">
        <Link href={withParams("/excecoes", currentParams, { view: "all", page: 1 })} className={state.view === "all" ? "is-active" : ""}>
          Todas <b>{queueSummary.views.all}</b>
        </Link>
        <Link href={withParams("/excecoes", currentParams, { view: "pending", page: 1 })} className={state.view === "pending" ? "is-active" : ""}>
          Triagem <b>{queueSummary.views.pendingTriage}</b>
        </Link>
        <Link href={withParams("/excecoes", currentParams, { view: "breached", page: 1 })} className={state.view === "breached" ? "is-active" : ""}>
          SLA estourado <b>{queueSummary.views.breached}</b>
        </Link>
        <Link href={withParams("/excecoes", currentParams, { view: "dueSoon", page: 1 })} className={state.view === "dueSoon" ? "is-active" : ""}>
          Vencendo <b>{queueSummary.views.dueSoon}</b>
        </Link>
        <Link href={withParams("/excecoes", currentParams, { view: "unassigned", page: 1 })} className={state.view === "unassigned" ? "is-active" : ""}>
          Sem dono <b>{queueSummary.views.unassigned}</b>
        </Link>
      </section>

      <form action="/excecoes" className="nova-lit-card nova-exceptions-filters">
        <label className="nova-exceptions-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Código, título, vínculo ou responsável" />
        </label>

        <label className="nova-exceptions-field">
          <span>Tipo</span>
          <select name="kind" defaultValue={state.kind}>
            <option value="all">Todos</option>
            <option value="generic">Geral</option>
            <option value="sla">SLA</option>
            <option value="integration">Integração</option>
            <option value="occurrence">Alerta</option>
            <option value="maintenance">Chamado</option>
            <option value="automation">Automação</option>
          </select>
        </label>

        <label className="nova-exceptions-field">
          <span>Severidade</span>
          <select name="severity" defaultValue={state.severity}>
            <option value="all">Todas</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </label>

        <label className="nova-exceptions-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="open">Abertas</option>
            <option value="acknowledged">Reconhecidas</option>
            <option value="resolved">Resolvidas</option>
            <option value="silenced">Silenciadas</option>
          </select>
        </label>

        <label className="nova-exceptions-field">
          <span>Triagem</span>
          <select name="triageStatus" defaultValue={state.triageStatus}>
            <option value="all">Todas</option>
            <option value="pending">Pendente</option>
            <option value="triaged">Triada</option>
            <option value="closed">Fechada</option>
          </select>
        </label>

        <label className="nova-exceptions-field">
          <span>Ordem</span>
          <select name="sortBy" defaultValue={state.sortBy}>
            <option value="priorityScore">Prioridade</option>
            <option value="resolveDueAt">SLA</option>
            <option value="createdAt">Cadastro</option>
            <option value="severity">Severidade</option>
            <option value="status">Status</option>
          </select>
        </label>

        <label className="nova-exceptions-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="view" value={state.view} />
        <input type="hidden" name="queueKey" value={state.queueKey} />
        <input type="hidden" name="sortDir" value={state.sortDir} />
        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/excecoes">Limpar</Link>
      </form>

      <section className="nova-exceptions-main-grid">
        <div className="nova-lit-card nova-exceptions-table-card">
          <div className="nova-exceptions-section-title">
            <div>
              <span>Exception Desk</span>
              <h2>Casos operacionais</h2>
            </div>
            <div>
              <small>{rows.length} linhas</small>
              <Link href="/operacao/fila">Fila</Link>
            </div>
          </div>

          <div className="nova-exceptions-table">
            <div className="nova-exceptions-table-head">
              <span>Caso</span>
              <span>Fila</span>
              <span>Sev.</span>
              <span>Status</span>
              <span>Triagem</span>
              <span>SLA</span>
              <span>Responsável</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((item) => (
              <div className={`nova-exceptions-row is-${rowTone(item)}`} key={item.id}>
                <div>
                  <Link href={`/excecoes/${item.id}`} className="nova-exceptions-target-link">{item.code} · {item.title}</Link>
                  <small>
                    <Link href={linkHref(item)}>{linkSummary(item)}</Link> · prioridade {item.priorityScore} · {item._count.comments} comentário(s)
                  </small>
                </div>

                <div>
                  <b>{queueLabel(item.queueKey)}</b>
                  <small>{kindLabel(item.kind)} · {sourceLabel(item.source)}</small>
                </div>

                <div>
                  <Badge tone={severityTone(item.severity)}>{severityLabel(item.severity)}</Badge>
                </div>

                <div>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  <small>{item.resolvedAt ? `resolvida em ${formatDateTime(item.resolvedAt)}` : "caso ativo"}</small>
                </div>

                <div>
                  <Badge tone={triageTone(item.triageStatus)}>{triageLabel(item.triageStatus)}</Badge>
                  <small>{item.acknowledgedAt ? `reconhecida em ${formatDateTime(item.acknowledgedAt)}` : "aguardando decisão"}</small>
                </div>

                <div>
                  <b className={item.breachedAt ? "is-danger-text" : ""}>{slaLabel(item)}</b>
                  <small>{item.firstResponseDueAt ? `1ª resposta ${formatDateTime(item.firstResponseDueAt)}` : "sem primeira resposta"}</small>
                </div>

                <div>
                  <b>{item.assignee?.name || "-"}</b>
                  <small>{item.assignee?.email || "sem responsável"}</small>
                </div>

                <div>
                  <Link href={`/excecoes/${item.id}`}>Abrir</Link>
                </div>
              </div>
            )) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-exceptions-right-col">
          <section className="nova-lit-card nova-exceptions-pressure">
            <div className="nova-lit-title-row">
              <h2>Pressão</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{operationalPressure}</span>
            </div>
            <div className="nova-exceptions-progress-list">
              <ProgressLine label="Abertas" value={percent(openOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Críticas" value={percent(criticalOnPage, rows.length)} tone="red" />
              <ProgressLine label="SLA estourado" value={percent(breachedOnPage, rows.length)} tone="red" />
              <ProgressLine label="Automação" value={percent(automatedOnPage, rows.length)} tone="blue" />
            </div>
          </section>

          <section className="nova-lit-card nova-exceptions-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/excecoes", currentParams, { status: "open", page: 1 })}>Abertas <b>{openOnPage}</b></Link>
            <Link href={withParams("/excecoes", currentParams, { triageStatus: "pending", page: 1 })}>Triagem <b>{pendingOnPage}</b></Link>
            <Link href={withParams("/excecoes", currentParams, { view: "unassigned", page: 1 })}>Sem dono <b>{unassignedOnPage}</b></Link>
          </section>

          <section className="nova-lit-card nova-exceptions-queues">
            <div className="nova-lit-title-row">
              <h2>Filas</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{queueSummary.queues.length}</span>
            </div>
            <div className="nova-exceptions-queue-list">
              {queueSummary.queues.length ? queueSummary.queues.slice(0, 7).map((item) => (
                <Link
                  key={item.queueKey}
                  href={withParams("/excecoes", currentParams, { queueKey: item.queueKey, page: 1 })}
                  className={state.queueKey === item.queueKey ? "is-active" : ""}
                >
                  <Dot tone="blue" />
                  <strong>{queueLabel(item.queueKey)}</strong>
                  <b>{item.total}</b>
                </Link>
              )) : (
                <div className="nova-exceptions-list-empty">Nenhuma fila ativa no recorte.</div>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-exceptions-status">
            <div className="nova-lit-title-row">
              <h2>Recorte atual</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{rows.length}</span>
            </div>
            <div className="nova-exceptions-status-list">
              <article>
                <Dot tone="orange" />
                <strong>Abertas</strong>
                <b>{openOnPage}</b>
              </article>
              <article>
                <Dot tone="blue" />
                <strong>Reconhecidas</strong>
                <b>{acknowledgedOnPage}</b>
              </article>
              <article>
                <Dot tone="green" />
                <strong>Resolvidas</strong>
                <b>{resolvedOnPage}</b>
              </article>
              <article>
                <Dot tone="red" />
                <strong>SLA</strong>
                <b>{breachedOnPage}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-exceptions-priority">
            <div className="nova-lit-title-row">
              <h2>Prioridade</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{priorityRows.length}</span>
            </div>
            <div className="nova-exceptions-priority-list">
              {priorityRows.length ? priorityRows.map((item) => (
                <Link key={item.id} href={`/excecoes/${item.id}`}>
                  <Dot tone={rowTone(item)} />
                  <div>
                    <strong>{item.code} · {item.title}</strong>
                    <span>{severityLabel(item.severity)} · {slaLabel(item)}</span>
                  </div>
                </Link>
              )) : (
                <div className="nova-exceptions-list-empty">Nenhum caso na página atual.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-exceptions-pagination">
        <span>
          Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} exceção(ões)
        </span>
        <div>
          <Link
            href={withParams("/excecoes", currentParams, { page: Math.max(1, response.meta.page - 1) })}
            className={!response.meta.hasPrev ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasPrev}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/excecoes", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })}
            className={!response.meta.hasNext ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasNext}
          >
            Próxima
          </Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
