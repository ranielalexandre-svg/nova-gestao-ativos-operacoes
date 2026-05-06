import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { readUnitHostTelemetry, safeApiJson } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";
type StatusFilter = "all" | "open" | "investigating" | "resolved" | "closed";
type Tone = "green" | "orange" | "blue" | "red" | "slate";

type AlertOccurrence = {
  id?: string;
  code?: string;
  title?: string;
  description?: string | null;
  severity?: string;
  status?: string;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string | null;
  unit?: {
    id?: string;
    code?: string;
    name?: string;
    city?: string | null;
    state?: string | null;
  } | null;
  partner?: {
    id?: string;
    code?: string;
    name?: string;
  } | null;
  equipment?: {
    id?: string;
    tag?: string;
    name?: string;
  } | null;
};

type AlertCommandCenter = {
  metrics: {
    openOccurrences: number;
    criticalOpenOccurrences: number;
    openMaintenances?: number;
    dueMaintenances?: number;
  };
  buckets: {
    occurrenceBySeverity: Array<{ key: string; count: number }>;
    occurrenceByStatus: Array<{ key: string; count: number }>;
  };
  recentOccurrences: AlertOccurrence[];
};

type AlertsState = {
  q: string;
  severity: SeverityFilter;
  status: StatusFilter;
  page: number;
  pageSize: number;
};

const severityOptions = ["all", "critical", "high", "medium", "low", "info"] as const;
const statusOptions = ["all", "open", "investigating", "resolved", "closed"] as const;
const pageSizeOptions = [10, 20, 40] as const;

function emptyCommandCenter(): AlertCommandCenter {
  return {
    metrics: {
      openOccurrences: 0,
      criticalOpenOccurrences: 0,
      openMaintenances: 0,
      dueMaintenances: 0,
    },
    buckets: {
      occurrenceBySeverity: [],
      occurrenceByStatus: [],
    },
    recentOccurrences: [],
  };
}

function isSeverity(value: string): value is SeverityFilter {
  return severityOptions.includes(value as SeverityFilter);
}

function isStatus(value: string): value is StatusFilter {
  return statusOptions.includes(value as StatusFilter);
}

function isPageSize(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]);
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function severityLabel(value: string | undefined) {
  if (value === "critical") return "Crítico";
  if (value === "high") return "Alto";
  if (value === "medium") return "Médio";
  if (value === "low") return "Baixo";
  if (value === "info") return "Info";
  return value || "Sem severidade";
}

function statusLabel(value: string | undefined) {
  if (value === "open") return "Aberto";
  if (value === "investigating") return "Em análise";
  if (value === "resolved") return "Resolvido";
  if (value === "closed") return "Fechado";
  return value || "Sem status";
}

function severityTone(value: string | undefined): Tone {
  if (value === "critical") return "red";
  if (value === "high" || value === "medium") return "orange";
  if (value === "low" || value === "info") return "blue";
  return "slate";
}

function statusTone(value: string | undefined): Tone {
  if (value === "open") return "red";
  if (value === "investigating") return "orange";
  if (value === "resolved" || value === "closed") return "green";
  return "slate";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function targetLabel(item: AlertOccurrence) {
  if (item.unit?.name) return `${item.unit.code || "UN"} · ${item.unit.name}`;
  if (item.equipment?.name) return `${item.equipment.tag || "AT"} · ${item.equipment.name}`;
  if (item.partner?.name) return `${item.partner.code || "PR"} · ${item.partner.name}`;
  return "Sem alvo vinculado";
}

function targetHref(item: AlertOccurrence) {
  if (item.unit?.id) return `/unidades/${item.unit.id}`;
  if (item.equipment?.id) return `/ativos/${item.equipment.id}`;
  if (item.partner?.id) return `/parceiros/${item.partner.id}`;
  return "/sensores";
}

function locationLabel(item: AlertOccurrence) {
  const city = item.unit?.city || "";
  const state = item.unit?.state || "";

  if (city && state) return `${city}/${state}`;
  if (city) return city;
  if (state) return state;
  return item.source || "Sem localidade";
}

function occurrenceHref(item: AlertOccurrence) {
  return item.id ? `/alertas/${item.id}` : "/alertas";
}

function itemMatchesQuery(item: AlertOccurrence, query: string) {
  if (!query) return true;

  const haystack = [
    item.code,
    item.title,
    item.description,
    item.severity,
    item.status,
    item.source,
    item.unit?.code,
    item.unit?.name,
    item.unit?.city,
    item.unit?.state,
    item.partner?.code,
    item.partner?.name,
    item.equipment?.tag,
    item.equipment?.name,
  ].join(" ");

  return normalized(haystack).includes(normalized(query));
}

function itemMatchesFilters(item: AlertOccurrence, state: AlertsState) {
  const severityOk = state.severity === "all" || item.severity === state.severity;
  const statusOk = state.status === "all" || item.status === state.status;
  return severityOk && statusOk && itemMatchesQuery(item, state.q);
}

function bucketCount(commandCenter: AlertCommandCenter, kind: "severity" | "status", key: string) {
  const bucket = kind === "severity"
    ? commandCenter.buckets.occurrenceBySeverity.find((item) => item.key === key)
    : commandCenter.buckets.occurrenceByStatus.find((item) => item.key === key);

  return bucket?.count || 0;
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
    <article className="nova-lit-card nova-alerts-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`nova-alerts-badge is-${tone}`}>{children}</span>;
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <i className="nova-alerts-mini-bar">
      <em className={`is-${tone}`} style={{ width: `${width}%` }} />
    </i>
  );
}

function EmptyState({ error }: { error: string }) {
  return (
    <div className="nova-alerts-empty">
      <div>N</div>
      <strong>{error ? "Alertas indisponíveis" : "Nenhum alerta no recorte"}</strong>
      <span>{error || "Ajuste os filtros ou aguarde novas ocorrências do monitoramento."}</span>
    </div>
  );
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/alertas");

  const params = await resolveSearchParams(searchParams);
  const rawSeverity = readStringParam(params, "severity", "all");
  const rawStatus = readStringParam(params, "status", "all");
  const rawPageSize = readPositiveIntParam(params, "pageSize", 10);

  const state: AlertsState = {
    q: readStringParam(params, "q", ""),
    severity: isSeverity(rawSeverity) ? rawSeverity : "all",
    status: isStatus(rawStatus) ? rawStatus : "all",
    page: readPositiveIntParam(params, "page", 1),
    pageSize: isPageSize(rawPageSize) ? rawPageSize : 10,
  };

  let commandCenter = emptyCommandCenter();
  let error = "";

  try {
    commandCenter = await safeApiJson<AlertCommandCenter>("/monitoring/command-center", emptyCommandCenter());
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar o command-center.";
  }

  const telemetry = await readUnitHostTelemetry({ timeoutMs: 1300, fast: true }).catch(() => null);
  const telemetryProblems = telemetry?.counts.withProblems || 0;
  const filtered = commandCenter.recentOccurrences.filter((item) => itemMatchesFilters(item, state));
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * state.pageSize, safePage * state.pageSize);
  const currentParams: RawSearchParams = {
    q: state.q || undefined,
    severity: state.severity,
    status: state.status,
    page: String(safePage),
    pageSize: String(state.pageSize),
  };

  const critical = commandCenter.metrics.criticalOpenOccurrences || bucketCount(commandCenter, "severity", "critical");
  const open = commandCenter.metrics.openOccurrences || bucketCount(commandCenter, "status", "open");
  const investigating = bucketCount(commandCenter, "status", "investigating");
  const highMedium = bucketCount(commandCenter, "severity", "high") + bucketCount(commandCenter, "severity", "medium");

  const kpis = [
    { label: "Abertos", value: String(open), hint: "fila operacional", tone: open ? "orange" as const : "green" as const },
    { label: "Críticos", value: String(critical), hint: "prioridade máxima", tone: critical ? "red" as const : "green" as const },
    { label: "Em análise", value: String(investigating), hint: "investigating", tone: investigating ? "blue" as const : "slate" as const },
    { label: "Atenção", value: String(highMedium), hint: "alto ou médio", tone: highMedium ? "orange" as const : "green" as const },
    { label: "Zabbix", value: String(telemetryProblems), hint: "hosts com problema", tone: telemetryProblems ? "orange" as const : "green" as const },
  ];

  const severityRows = [
    { key: "critical", label: "Críticos", value: bucketCount(commandCenter, "severity", "critical"), tone: "red" as const },
    { key: "high", label: "Altos", value: bucketCount(commandCenter, "severity", "high"), tone: "orange" as const },
    { key: "medium", label: "Médios", value: bucketCount(commandCenter, "severity", "medium"), tone: "orange" as const },
    { key: "low", label: "Baixos", value: bucketCount(commandCenter, "severity", "low"), tone: "blue" as const },
  ];
  const maxSeverity = Math.max(1, ...severityRows.map((item) => item.value));

  return (
    <NovaLitShell activeHref="/alertas">
      <div className="nova-lit-page-heading nova-alerts-heading">
        <div>
          <h1>Alertas</h1>
          <p className="nova-lit-page-subtitle">Fila de ocorrências, severidade, status e vínculo operacional.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/sensores" className="nova-lit-button nova-lit-button-secondary">Ver sensores</Link>
          <Link href="/chamados" className="nova-lit-button nova-lit-button-primary">Abrir chamado</Link>
        </div>
      </div>

      <section className="nova-alerts-kpi-grid" aria-label="Indicadores de alertas">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/alertas" className="nova-lit-card nova-alerts-filters">
        <label className="nova-alerts-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Código, alerta, unidade, parceiro ou origem" />
        </label>

        <label className="nova-alerts-field">
          <span>Severidade</span>
          <select name="severity" defaultValue={state.severity}>
            <option value="all">Todas</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
            <option value="info">Info</option>
          </select>
        </label>

        <label className="nova-alerts-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="open">Aberto</option>
            <option value="investigating">Em análise</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>
        </label>

        <label className="nova-alerts-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="40">40</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/alertas">Limpar</Link>
      </form>

      <section className="nova-alerts-main-grid">
        <div className="nova-lit-card nova-alerts-table-card">
          <div className="nova-alerts-section-title">
            <div>
              <span>Fila operacional</span>
              <h2>Ocorrências recentes</h2>
            </div>
            <div>
              <small>{pageItems.length} linhas</small>
              <Link href="/alertas">Base completa</Link>
            </div>
          </div>

          <div className="nova-alerts-table">
            <div className="nova-alerts-table-head">
              <span>Alerta</span>
              <span>Alvo</span>
              <span>Severidade</span>
              <span>Status</span>
              <span>Origem</span>
              <span>Criado</span>
              <span>Ações</span>
            </div>

            {pageItems.length ? pageItems.map((item, index) => (
              <div className={`nova-alerts-row is-${severityTone(item.severity)}`} key={`${item.id || item.code || "alert"}-${index}`}>
                <div>
                  <strong>{item.title || "Ocorrência sem título"}</strong>
                  <small>{item.code || "sem código"} · {item.description || "sem descrição complementar"}</small>
                </div>

                <div>
                  <Link href={targetHref(item)} className="nova-alerts-target-link">{targetLabel(item)}</Link>
                  <small>{locationLabel(item)}</small>
                </div>

                <div>
                  <Badge tone={severityTone(item.severity)}>{severityLabel(item.severity)}</Badge>
                </div>

                <div>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>

                <div>
                  <b>{item.source || "manual"}</b>
                </div>

                <div>
                  <b>{formatDateTime(item.createdAt || item.startedAt || item.updatedAt)}</b>
                </div>

                <div>
                  <Link href={occurrenceHref(item)}>Abrir</Link>
                </div>
              </div>
            )) : (
              <EmptyState error={error} />
            )}
          </div>
        </div>

        <aside className="nova-alerts-right-col">
          <section className="nova-lit-card nova-alerts-severity">
            <div className="nova-lit-title-row">
              <h2>Severidades</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{open} abertas</span>
            </div>
            <div className="nova-alerts-severity-list">
              {severityRows.map((item) => (
                <Link href={withParams("/alertas", currentParams, { severity: item.key, page: 1 })} key={item.key}>
                  <div>
                    <Dot tone={item.tone} />
                    <strong>{item.label}</strong>
                    <b>{item.value}</b>
                  </div>
                  <MiniBar value={item.value} max={maxSeverity} tone={item.tone} />
                </Link>
              ))}
            </div>
          </section>

          <section className="nova-lit-card nova-alerts-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/alertas", currentParams, { status: "open", page: 1 })}>
              Abertos <b>{open}</b>
            </Link>
            <Link href={withParams("/alertas", currentParams, { status: "investigating", page: 1 })}>
              Em análise <b>{investigating}</b>
            </Link>
            <Link href={withParams("/alertas", currentParams, { severity: "critical", page: 1 })}>
              Críticos <b>{critical}</b>
            </Link>
          </section>

          <section className="nova-lit-card nova-alerts-zabbix">
            <div className="nova-lit-title-row">
              <h2>Zabbix</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{telemetry?.sources.length || 0}</span>
            </div>
            <div className="nova-alerts-source-list">
              {(telemetry?.sources || []).length ? telemetry?.sources.map((source) => (
                <article key={source.id}>
                  <Dot tone={source.ok ? "green" : "orange"} />
                  <div>
                    <strong>{source.name || source.code}</strong>
                    <span>{source.message}</span>
                  </div>
                </article>
              )) : (
                <article>
                  <Dot tone="slate" />
                  <div>
                    <strong>Sem fonte ativa</strong>
                    <span>A fila permanece disponível, mas a telemetria não respondeu no tempo limite.</span>
                  </div>
                </article>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-alerts-pagination">
        <span>
          Página {safePage} de {totalPages} · {filtered.length} alerta(s) filtrado(s)
        </span>
        <div>
          <Link
            href={withParams("/alertas", currentParams, { page: Math.max(1, safePage - 1) })}
            className={safePage <= 1 ? "is-disabled" : ""}
            aria-disabled={safePage <= 1}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/alertas", currentParams, { page: Math.min(totalPages, safePage + 1) })}
            className={safePage >= totalPages ? "is-disabled" : ""}
            aria-disabled={safePage >= totalPages}
          >
            Próxima
          </Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
