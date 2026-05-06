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
type TicketType = "all" | "preventive" | "corrective" | "inspection";
type TicketStatus = "all" | "planned" | "in_progress" | "done" | "cancelled";
type SortBy = "createdAt" | "code" | "title" | "type" | "status";
type SortDir = "asc" | "desc";

type PartnerOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

type EquipmentOption = {
  id: string;
  tag: string;
  name: string;
};

type OccurrenceOption = {
  id: string;
  code: string;
  title: string;
};

type MaintenanceRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  occurrence: OccurrenceOption | null;
};

type ChamadosState = {
  q: string;
  type: TicketType;
  status: TicketStatus;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const typeOptions = ["all", "preventive", "corrective", "inspection"] as const;
const statusOptions = ["all", "planned", "in_progress", "done", "cancelled"] as const;
const sortByOptions = ["createdAt", "code", "title", "type", "status"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const pageSizeOptions = [10, 20, 50] as const;

function option<T extends readonly string[]>(options: T, value: string, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function typeLabel(value: string) {
  if (value === "preventive") return "Preventiva";
  if (value === "corrective") return "Corretiva";
  if (value === "inspection") return "Inspeção";
  return value || "Sem tipo";
}

function typeTone(value: string): Tone {
  if (value === "preventive") return "green";
  if (value === "corrective") return "orange";
  if (value === "inspection") return "blue";
  return "slate";
}

function statusLabel(value: string) {
  if (value === "planned") return "Planejado";
  if (value === "in_progress") return "Em execução";
  if (value === "done") return "Concluído";
  if (value === "cancelled") return "Cancelado";
  return value || "Sem status";
}

function statusTone(value: string): Tone {
  if (value === "planned") return "orange";
  if (value === "in_progress") return "blue";
  if (value === "done") return "green";
  if (value === "cancelled") return "slate";
  return "slate";
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

function isOverdue(item: MaintenanceRow) {
  if (!item.scheduledAt) return false;
  if (["done", "cancelled"].includes(item.status)) return false;
  return new Date(item.scheduledAt).getTime() < Date.now();
}

function entityLabel(item: MaintenanceRow) {
  if (item.equipment) return `${item.equipment.tag} - ${item.equipment.name}`;
  if (item.unit) return `${item.unit.code} - ${item.unit.name}`;
  if (item.partner) return `${item.partner.code} - ${item.partner.name}`;
  return "Sem vínculo";
}

function entityHref(item: MaintenanceRow) {
  if (item.equipment) return `/ativos/${item.equipment.id}`;
  if (item.unit) return `/unidades/${item.unit.id}`;
  if (item.partner) return `/parceiros/${item.partner.id}`;
  return "/chamados";
}

function rowTone(item: MaintenanceRow): Tone {
  return isOverdue(item) ? "red" : statusTone(item.status);
}

function priorityTone(item: MaintenanceRow): Tone {
  if (isOverdue(item)) return "red";
  if (item.status === "in_progress") return "blue";
  if (item.status === "planned") return "orange";
  if (item.status === "done") return "green";
  return "slate";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: ChamadosState): RawSearchParams {
  return {
    q: state.q || undefined,
    type: state.type,
    status: state.status,
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
    <article className="nova-lit-card nova-tickets-kpi">
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
  return <span className={`nova-tickets-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-tickets-progress">
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
    <div className="nova-tickets-empty">
      <div>N</div>
      <strong>Nenhum chamado encontrado</strong>
      <span>Ajuste os filtros ou limpe a busca para voltar à agenda completa.</span>
    </div>
  );
}

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/chamados");

  const params = await resolveSearchParams(searchParams);
  const state: ChamadosState = {
    q: readStringParam(params, "q", ""),
    type: option(typeOptions, readStringParam(params, "type", "all"), "all"),
    status: option(statusOptions, readStringParam(params, "status", "all"), "all"),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "createdAt"), "createdAt"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const [response, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<MaintenanceRow>>(
      `/maintenances${buildApiQuery({
        q: state.q,
        type: state.type !== "all" ? state.type : undefined,
        status: state.status !== "all" ? state.status : undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      })}`,
    ),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const rows = response.items;
  const plannedOnPage = rows.filter((item) => item.status === "planned").length;
  const runningOnPage = rows.filter((item) => item.status === "in_progress").length;
  const doneOnPage = rows.filter((item) => item.status === "done").length;
  const cancelledOnPage = rows.filter((item) => item.status === "cancelled").length;
  const overdueOnPage = rows.filter(isOverdue).length;
  const scheduledOnPage = rows.filter((item) => Boolean(item.scheduledAt)).length;
  const linkedToOccurrenceOnPage = rows.filter((item) => Boolean(item.occurrence)).length;
  const linkedRows = rows.filter((item) => item.partner || item.unit || item.equipment).length;
  const priorityRows = [...rows]
    .sort((a, b) => {
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 7);

  const currentParams = stateParams(state);

  const kpis = [
    { label: "Chamados", value: String(response.meta.total), hint: "resultado filtrado", tone: "blue" as const },
    { label: "Planejados", value: String(plannedOnPage), hint: "nesta página", tone: plannedOnPage ? "orange" as const : "slate" as const },
    { label: "Em execução", value: String(runningOnPage), hint: "ações abertas", tone: runningOnPage ? "blue" as const : "slate" as const },
    { label: "Vencidos", value: String(overdueOnPage), hint: `${scheduledOnPage} com agenda`, tone: overdueOnPage ? "red" as const : "green" as const },
    { label: "Com alerta", value: String(linkedToOccurrenceOnPage), hint: "ligados a incidente", tone: linkedToOccurrenceOnPage ? "orange" as const : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/chamados">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Chamados</h1>
          <p className="nova-lit-page-subtitle">Agenda técnica, SLA, vínculo operacional e status do atendimento.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/operacao/fila?view=dueSoon" className="nova-lit-button nova-lit-button-secondary">Abrir fila</Link>
          <Link href="/sensores?view=events" className="nova-lit-button nova-lit-button-primary">Eventos NOC</Link>
        </div>
      </div>

      <section className="nova-tickets-kpi-grid" aria-label="Indicadores de chamados">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/chamados" className="nova-lit-card nova-tickets-filters">
        <label className="nova-tickets-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Código, título, alerta, unidade ou ativo" />
        </label>

        <label className="nova-tickets-field">
          <span>Tipo</span>
          <select name="type" defaultValue={state.type}>
            <option value="all">Todos</option>
            <option value="preventive">Preventiva</option>
            <option value="corrective">Corretiva</option>
            <option value="inspection">Inspeção</option>
          </select>
        </label>

        <label className="nova-tickets-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="planned">Planejados</option>
            <option value="in_progress">Em execução</option>
            <option value="done">Concluídos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </label>

        <label className="nova-tickets-field">
          <span>Ordem</span>
          <select name="sortBy" defaultValue={state.sortBy}>
            <option value="createdAt">Cadastro</option>
            <option value="code">Código</option>
            <option value="title">Título</option>
            <option value="type">Tipo</option>
            <option value="status">Status</option>
          </select>
        </label>

        <label className="nova-tickets-field">
          <span>Direção</span>
          <select name="sortDir" defaultValue={state.sortDir}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>

        <label className="nova-tickets-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/chamados">Limpar</Link>
      </form>

      <section className="nova-tickets-main-grid">
        <div className="nova-lit-card nova-tickets-table-card">
          <div className="nova-tickets-section-title">
            <div>
              <span>Service Desk</span>
              <h2>Chamados cadastrados</h2>
            </div>
            <div>
              <small>{rows.length} linhas</small>
              <Link href="/operacao/fila">Fila</Link>
            </div>
          </div>

          <div className="nova-tickets-table">
            <div className="nova-tickets-table-head">
              <span>Chamado</span>
              <span>Tipo</span>
              <span>Status</span>
              <span>Vínculo</span>
              <span>Alerta</span>
              <span>Agenda</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((item) => {
              const overdue = isOverdue(item);

              return (
                <div className={`nova-tickets-row is-${rowTone(item)}`} key={item.id}>
                  <div>
                    <Link href={`/chamados/${item.id}`} className="nova-tickets-target-link">{item.code}</Link>
                    <small>{item.title}</small>
                  </div>

                  <div>
                    <Badge tone={typeTone(item.type)}>{typeLabel(item.type)}</Badge>
                    <small>{item.description || "sem descrição complementar"}</small>
                  </div>

                  <div>
                    <Badge tone={overdue ? "red" : statusTone(item.status)}>{overdue ? "Vencido" : statusLabel(item.status)}</Badge>
                    <small>atualizado em {formatDateTime(item.updatedAt)}</small>
                  </div>

                  <div>
                    <Link href={entityHref(item)} className="nova-tickets-target-link">{entityLabel(item)}</Link>
                    <small>{item.partner ? `${item.partner.code} - ${item.partner.name}` : "sem parceiro vinculado"}</small>
                  </div>

                  <div>
                    {item.occurrence ? (
                      <Link href={`/alertas/${item.occurrence.id}`} className="nova-tickets-target-link">
                        {item.occurrence.code}
                      </Link>
                    ) : (
                      <b>-</b>
                    )}
                    <small>{item.occurrence?.title || "sem alerta originador"}</small>
                  </div>

                  <div>
                    <b>{formatDateTime(item.scheduledAt)}</b>
                    <small>{item.completedAt ? `concluído em ${formatDateTime(item.completedAt)}` : "janela técnica"}</small>
                  </div>

                  <div>
                    <Link href={`/chamados/${item.id}`}>Abrir</Link>
                  </div>
                </div>
              );
            }) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Turno</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{commandCenter.metrics.overdueMaintenances} vencidos</span>
            </div>
            <div className="nova-tickets-progress-list">
              <ProgressLine label="Planejados" value={percent(plannedOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Em execução" value={percent(runningOnPage, rows.length)} tone="blue" />
              <ProgressLine label="Com vínculo" value={percent(linkedRows, rows.length)} tone="green" />
              <ProgressLine label="Com alerta" value={percent(linkedToOccurrenceOnPage, rows.length)} tone="orange" />
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/chamados", currentParams, { status: "planned", page: 1 })}>Planejados <b>{plannedOnPage}</b></Link>
            <Link href={withParams("/chamados", currentParams, { status: "in_progress", page: 1 })}>Em execução <b>{runningOnPage}</b></Link>
            <Link href={withParams("/chamados", currentParams, { type: "corrective", page: 1 })}>Corretivos <b>{rows.filter((item) => item.type === "corrective").length}</b></Link>
          </section>

          <section className="nova-lit-card nova-tickets-status">
            <div className="nova-lit-title-row">
              <h2>Recorte atual</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{rows.length}</span>
            </div>
            <div className="nova-tickets-status-list">
              <article>
                <Dot tone="orange" />
                <strong>Planejados</strong>
                <b>{plannedOnPage}</b>
              </article>
              <article>
                <Dot tone="blue" />
                <strong>Em execução</strong>
                <b>{runningOnPage}</b>
              </article>
              <article>
                <Dot tone="green" />
                <strong>Concluídos</strong>
                <b>{doneOnPage}</b>
              </article>
              <article>
                <Dot tone="slate" />
                <strong>Cancelados</strong>
                <b>{cancelledOnPage}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-priority">
            <div className="nova-lit-title-row">
              <h2>Prioridade</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{commandCenter.metrics.dueTodayMaintenances} hoje</span>
            </div>
            <div className="nova-tickets-priority-list">
              {priorityRows.length ? priorityRows.map((item) => (
                <Link key={item.id} href={`/chamados/${item.id}`}>
                  <Dot tone={priorityTone(item)} />
                  <div>
                    <strong>{item.code} · {item.title}</strong>
                    <span>{statusLabel(item.status)} · {formatDateTime(item.scheduledAt)}</span>
                  </div>
                </Link>
              )) : (
                <div className="nova-tickets-list-empty">Nenhum chamado na página atual.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-tickets-pagination">
        <span>
          Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} chamado(s)
        </span>
        <div>
          <Link
            href={withParams("/chamados", currentParams, { page: Math.max(1, response.meta.page - 1) })}
            className={!response.meta.hasPrev ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasPrev}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/chamados", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })}
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
