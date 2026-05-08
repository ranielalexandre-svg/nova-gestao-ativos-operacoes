import Link from "next/link";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { withParams, type RawSearchParams } from "@/lib/list-query";
import type { UnitHostTelemetryItem } from "@/lib/noc-overview";

export type NovaSensorsHealthFilter =
  | "all"
  | "online"
  | "degraded"
  | "down"
  | "unmapped"
  | "ambiguous"
  | "unknown";

export type NovaSensorsSearchState = {
  q: string;
  health: NovaSensorsHealthFilter;
  page: number;
  pageSize: number;
};

export type NovaSensorsTelemetry = {
  generatedAt?: string;
  mode?: string;
  counts: {
    units: number;
    matched: number;
    online: number;
    degraded: number;
    down: number;
    unmapped: number;
    unknown?: number;
    ambiguous: number;
    syncReady?: number;
    avgLatencyMs?: number | null;
    avgLossPct?: number | null;
    maxTemperatureC?: number | null;
    withProblems: number;
  };
  sources: Array<{
    id: string;
    code: string;
    name: string;
    ok: boolean;
    message: string;
    totalHosts?: number;
  }>;
  items: UnitHostTelemetryItem[];
};

type Tone = "green" | "orange" | "blue" | "red" | "slate";

const healthLabels: Record<NovaSensorsHealthFilter, string> = {
  all: "Todos",
  online: "Online",
  degraded: "Atenção",
  down: "Offline",
  unmapped: "Sem vínculo",
  ambiguous: "Ambíguo",
  unknown: "Sem item",
};

function searchParamsFromState(state: NovaSensorsSearchState): RawSearchParams {
  return {
    q: state.q || undefined,
    health: state.health,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function toneForHealth(health: string): Tone {
  if (health === "online") return "green";
  if (health === "degraded" || health === "ambiguous") return "orange";
  if (health === "down") return "red";
  if (health === "unmapped" || health === "unknown") return "slate";
  return "blue";
}

function labelForHealth(health: string) {
  if (health === "online") return "Online";
  if (health === "degraded") return "Atenção";
  if (health === "down") return "Offline";
  if (health === "unmapped") return "Sem vínculo";
  if (health === "ambiguous") return "Ambíguo";
  return "Sem item";
}

function lower(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function unitLabel(item: UnitHostTelemetryItem) {
  const code = item.unit?.code || "SEM-CODIGO";
  const name = item.unit?.name || "Unidade sem nome";
  return `${code} · ${name}`;
}

function locationLabel(item: UnitHostTelemetryItem) {
  const city = item.unit?.city || "";
  const state = item.unit?.state || "";

  if (city && state) return `${city}/${state}`;
  if (city) return city;
  if (state) return state;
  return "Sem cidade/UF";
}

function hostLabel(item: UnitHostTelemetryItem) {
  return item.match?.hostName || item.match?.host || "Sem host";
}

function matchLabel(item: UnitHostTelemetryItem) {
  if (item.match?.status === "matched") return "Vinculado";
  if (item.match?.status === "ambiguous") return "Ambíguo";
  if (item.match?.status === "unmatched") return "Sem vínculo";
  return "Sem item";
}

function metricMs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

function metricPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function metricTemp(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
}

function pingLabel(item: UnitHostTelemetryItem) {
  if (item.metrics.ping?.ok === true) return "OK";
  if (item.metrics.ping?.ok === false) return "Falha";
  return "-";
}

function itemMatchesQuery(item: UnitHostTelemetryItem, query: string) {
  if (!query) return true;

  const haystack = [
    item.unit?.code,
    item.unit?.name,
    item.unit?.city,
    item.unit?.state,
    item.partner?.code,
    item.partner?.name,
    item.match?.host,
    item.match?.hostName,
    item.equipments?.map((equipment) => `${equipment.tag} ${equipment.name} ${equipment.serialNumber || ""}`).join(" "),
  ].join(" ");

  return lower(haystack).includes(lower(query));
}

function EmptyState({ error }: { error: string }) {
  return (
    <div className="nova-sensors-empty">
      <div>N</div>
      <strong>{error ? "Telemetria indisponível" : "Nenhum sensor encontrado"}</strong>
      <span>{error || "Ajuste os filtros ou revise a integração Zabbix."}</span>
    </div>
  );
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
    <article className="nova-lit-card nova-sensors-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

export default function NovaSensoresView({
  telemetry,
  state,
  error,
}: {
  telemetry: NovaSensorsTelemetry | null;
  state: NovaSensorsSearchState;
  error?: string;
}) {
  const sourceItems = telemetry?.items || [];
  const filteredItems = sourceItems.filter((item) => {
    const healthMatch = state.health === "all" || item.health === state.health;
    return healthMatch && itemMatchesQuery(item, state.q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / state.pageSize));
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const start = (safePage - 1) * state.pageSize;
  const pageItems = filteredItems.slice(start, start + state.pageSize);
  const currentParams = searchParamsFromState({ ...state, page: safePage });

  const counts = telemetry?.counts;
  const matched = counts?.matched || 0;
  const units = counts?.units || 0;
  const online = counts?.online || 0;
  const critical = (counts?.down || 0) + (counts?.degraded || 0);
  const unmapped = (counts?.unmapped || 0) + (counts?.ambiguous || 0);
  const coverage = units ? Math.round((matched / units) * 100) : 0;

  const kpis = [
    { label: "Unidades", value: String(units), hint: "base ativa monitorável", tone: "blue" as const },
    { label: "Vinculadas", value: String(matched), hint: `${coverage}% com host`, tone: matched ? "green" as const : "slate" as const },
    { label: "Online", value: String(online), hint: "sensores saudáveis", tone: online ? "green" as const : "slate" as const },
    { label: "Atenção", value: String(critical), hint: "degradadas ou offline", tone: critical ? "orange" as const : "green" as const },
    { label: "Sem vínculo", value: String(unmapped), hint: "ambíguas ou sem host", tone: unmapped ? "orange" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/sensores">
      <div className="nova-lit-page-heading nova-sensors-heading">
        <div>
          <h1>Sensores</h1>
          <p className="nova-lit-page-subtitle">Telemetria, host Zabbix, latência, perda e vínculos por unidade.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/integracoes" className="nova-lit-button nova-lit-button-secondary">Integrações</Link>
          <Link href="/relatorios/monitoramento" className="nova-lit-button nova-lit-button-primary">Relatório</Link>
        </div>
      </div>

      <section className="nova-sensors-kpi-grid" aria-label="Indicadores de sensores">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/sensores" className="nova-lit-card nova-sensors-filters">
        <label className="nova-sensors-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Unidade, host, parceiro, cidade ou ativo" />
        </label>

        <label className="nova-sensors-field">
          <span>Saúde</span>
          <select name="health" defaultValue={state.health}>
            {Object.entries(healthLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="nova-sensors-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/sensores">Limpar</Link>
      </form>

      <section className="nova-sensors-main-grid">
        <div className="nova-lit-card nova-sensors-table-card">
          <div className="nova-sensors-table-title">
            <div>
              <span>Telemetria Zabbix</span>
              <h2>Sensores por unidade</h2>
            </div>
            <div>
              <small>{pageItems.length} linhas</small>
              <Link href="/integracoes">Conector</Link>
            </div>
          </div>

          <div className="nova-sensors-table">
            <div className="nova-sensors-table-head">
              <span>Unidade</span>
              <span>Host</span>
              <span>Saúde</span>
              <span>Ping</span>
              <span>Perda</span>
              <span>Latência</span>
              <span>Temp.</span>
              <span>Ações</span>
            </div>

            {pageItems.length ? pageItems.map((item) => (
              <div className={`nova-sensors-row is-${item.health}`} key={item.unit?.id || `${hostLabel(item)}-${unitLabel(item)}`}>
                <div>
                  <strong>{unitLabel(item)}</strong>
                  <small>{locationLabel(item)} · {item.partner?.name || "Sem parceiro"}</small>
                </div>

                <div>
                  <b>{hostLabel(item)}</b>
                  <small>{matchLabel(item)} · {item.equipments?.length || 0} ativo(s)</small>
                </div>

                <div>
                  <span className={`nova-sensors-badge is-${toneForHealth(item.health)}`}>
                    {labelForHealth(item.health)}
                  </span>
                  {item.problems?.length ? <small>{item.problems[0]?.name || item.problems[0]?.severity || "Problema ativo"}</small> : <small>Sem problema ativo</small>}
                </div>

                <div><b>{pingLabel(item)}</b></div>
                <div><b>{metricPercent(item.metrics.lossPct)}</b></div>
                <div><b>{metricMs(item.metrics.latencyMs)}</b></div>
                <div><b>{metricTemp(item.metrics.temperatureC)}</b></div>

                <div>
                  {item.unit?.id ? (
                    <Link href={`/unidades/${item.unit.id}?monitoring=1`}>Abrir</Link>
                  ) : (
                    <Link href="/integracoes">Revisar</Link>
                  )}
                </div>
              </div>
            )) : (
              <EmptyState error={error || ""} />
            )}
          </div>
        </div>

        <aside className="nova-sensors-right-col">
          <section className="nova-lit-card nova-sensors-coverage">
            <div className="nova-lit-title-row">
              <h2>Cobertura</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{coverage}%</span>
            </div>
            <div className="nova-sensors-ring">
              <strong>{coverage}%</strong>
              <span>vinculado</span>
            </div>
            <p>{matched} de {units} unidade(s) com host correlacionado.</p>
          </section>

          <section className="nova-lit-card nova-sensors-sources">
            <div className="nova-lit-title-row">
              <h2>Fontes</h2>
              <span className="nova-lit-pill nova-lit-pill-green">{telemetry?.sources?.length || 0}</span>
            </div>

            <div className="nova-sensors-source-list">
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
                    <span>Configure a integração Zabbix para popular os sensores.</span>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-sensors-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/sensores", currentParams, { health: "down", page: 1 })}>Offline <b>{counts?.down || 0}</b></Link>
            <Link href={withParams("/sensores", currentParams, { health: "degraded", page: 1 })}>Atenção <b>{counts?.degraded || 0}</b></Link>
            <Link href={withParams("/sensores", currentParams, { health: "unmapped", page: 1 })}>Sem vínculo <b>{counts?.unmapped || 0}</b></Link>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-sensors-pagination">
        <span>
          Página {safePage} de {totalPages} · {filteredItems.length} sensores filtrados
        </span>
        <div>
          <Link
            href={withParams("/sensores", currentParams, { page: Math.max(1, safePage - 1) })}
            className={safePage <= 1 ? "is-disabled" : ""}
            aria-disabled={safePage <= 1}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/sensores", currentParams, { page: Math.min(totalPages, safePage + 1) })}
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
