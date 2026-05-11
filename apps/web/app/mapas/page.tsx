import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import {
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession } from "@/lib/web-session";

type Telemetry = Awaited<ReturnType<typeof readUnitHostTelemetry>>;
type HealthFilter = "all" | "online" | "degraded" | "down" | "unmapped" | "ambiguous" | "unknown";
type Tone = "green" | "orange" | "blue" | "red" | "slate";

type MapState = {
  q: string;
  health: HealthFilter;
  pageSize: number;
};

type CityAggregate = {
  id: string;
  label: string;
  city: string;
  state: string;
  total: number;
  matched: number;
  online: number;
  attention: number;
  down: number;
  unmapped: number;
  alerts: number;
  criticalAlerts: number;
  items: UnitHostTelemetryItem[];
};

const healthOptions = ["all", "online", "degraded", "down", "unmapped", "ambiguous", "unknown"] as const;
const pageSizeOptions = [12, 18, 24] as const;

function isHealthOption(value: string): value is HealthFilter {
  return healthOptions.includes(value as HealthFilter);
}

function isPageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]);
}

function emptyTelemetry(): Telemetry {
  return {
    generatedAt: new Date().toISOString(),
    mode: "empty",
    sources: [],
    counts: {
      units: 0,
      matched: 0,
      ambiguous: 0,
      unmapped: 0,
      online: 0,
      degraded: 0,
      down: 0,
      withProblems: 0,
      syncReady: 0,
      avgLatencyMs: null,
      avgLossPct: null,
      maxTemperatureC: null,
    },
    items: [],
  } as Telemetry;
}

function cityKey(city: string | null | undefined, state: string | null | undefined) {
  const cleanCity = city?.trim() || "Sem cidade";
  const cleanState = state?.trim() || "";
  return [cleanCity, cleanState].filter(Boolean).join("/");
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hostLabel(item: UnitHostTelemetryItem) {
  return item.match?.hostName || item.match?.host || "Sem host";
}

function cityTone(city: CityAggregate): Tone {
  if (city.down || city.criticalAlerts) return "red";
  if (city.attention || city.alerts) return "orange";
  if (city.online) return "green";
  return "slate";
}

function itemMatchesQuery(item: UnitHostTelemetryItem, q: string) {
  if (!q) return true;

  const haystack = [
    item.unit.code,
    item.unit.name,
    item.unit.city,
    item.unit.state,
    item.partner?.code,
    item.partner?.name,
    hostLabel(item),
    item.equipments?.map((equipment) => `${equipment.tag} ${equipment.name} ${equipment.serialNumber || ""}`).join(" "),
  ].join(" ");

  return normalized(haystack).includes(normalized(q));
}

function itemMatchesHealth(item: UnitHostTelemetryItem, health: HealthFilter) {
  return health === "all" || item.health === health;
}

function buildCityAggregates(items: UnitHostTelemetryItem[], commandCenter: CommandCenter) {
  const byCity = new Map<string, CityAggregate>();

  for (const item of items) {
    const label = cityKey(item.unit.city, item.unit.state);
    const key = normalized(label).replace(/[^a-z0-9]+/g, "-") || "sem-cidade";
    const current = byCity.get(key) || {
      id: key,
      label,
      city: item.unit.city || "Sem cidade",
      state: item.unit.state || "",
      total: 0,
      matched: 0,
      online: 0,
      attention: 0,
      down: 0,
      unmapped: 0,
      alerts: 0,
      criticalAlerts: 0,
      items: [],
    };

    current.total += 1;
    current.items.push(item);

    if (item.match?.status === "matched") current.matched += 1;
    if (item.health === "online") current.online += 1;
    if (item.health === "degraded" || item.health === "ambiguous") current.attention += 1;
    if (item.health === "down") current.down += 1;
    if (item.health === "unmapped" || item.health === "unknown") current.unmapped += 1;

    byCity.set(key, current);
  }

  const telemetryByUnitId = new Map(items.map((item) => [item.unit.id, item]));
  for (const occurrence of commandCenter.recentOccurrences || []) {
    const unitTelemetry = occurrence.unit ? telemetryByUnitId.get(occurrence.unit.id) : null;
    if (!unitTelemetry) continue;

    const key = cityKey(unitTelemetry.unit.city, unitTelemetry.unit.state);
    const current = byCity.get(key);
    if (!current) continue;

    current.alerts += 1;
    if (occurrence.severity === "critical") current.criticalAlerts += 1;
  }

  return Array.from(byCity.values()).sort(
    (a, b) =>
      b.criticalAlerts - a.criticalAlerts ||
      b.down - a.down ||
      b.attention - a.attention ||
      b.total - a.total ||
      a.label.localeCompare(b.label),
  );
}

function markerPosition(index: number, total: number) {
  const columns = total <= 6 ? total : 6;
  const row = Math.floor(index / 6);
  const col = index % 6;
  const leftStep = columns <= 1 ? 0 : 76 / Math.max(1, columns - 1);
  const topBands = [20, 42, 64, 78];
  const jitter = row % 2 ? 5 : 0;

  return {
    left: Math.min(88, 12 + col * leftStep + jitter),
    top: topBands[row] ?? 78,
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
    <article className="nova-lit-card nova-map-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <i className="nova-map-mini-bar">
      <em className={`is-${tone}`} style={{ width: `${width}%` }} />
    </i>
  );
}

export default async function MapasPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/mapas");

  const params = await resolveSearchParams(searchParams);
  const rawHealth = readStringParam(params, "health", "all");
  const rawPageSize = readPositiveIntParam(params, "pageSize", 18);

  const state: MapState = {
    q: readStringParam(params, "q", ""),
    health: isHealthOption(rawHealth) ? rawHealth : "all",
    pageSize: isPageSizeOption(rawPageSize) ? rawPageSize : 18,
  };

  let telemetry = emptyTelemetry();
  let telemetryError = "";

  try {
    telemetry = await readUnitHostTelemetry({ timeoutMs: 1500, fast: true });
  } catch (cause) {
    telemetryError = cause instanceof Error ? cause.message : "Não foi possível carregar a telemetria.";
  }

  const commandCenter = await safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter());

  const filteredItems = telemetry.items.filter(
    (item) => itemMatchesHealth(item, state.health) && itemMatchesQuery(item, state.q),
  );

  const cities = buildCityAggregates(filteredItems, commandCenter);
  const visibleCities = cities.slice(0, state.pageSize);
  const coverage = telemetry.counts.units ? Math.round((telemetry.counts.matched / telemetry.counts.units) * 100) : 0;
  const attention = telemetry.counts.degraded + telemetry.counts.ambiguous;
  const riskCities = cities.filter((city) => city.down || city.attention || city.alerts).slice(0, 6);
  const currentParams: RawSearchParams = {
    q: state.q || undefined,
    health: state.health,
    pageSize: String(state.pageSize),
  };

  const kpis = [
    { label: "Unidades", value: String(telemetry.counts.units), hint: "base monitorável", tone: "blue" as const },
    { label: "Cidades", value: String(cities.length), hint: "recorte filtrado", tone: "blue" as const },
    { label: "Vinculadas", value: String(telemetry.counts.matched), hint: `${coverage}% com host`, tone: telemetry.counts.matched ? "green" as const : "slate" as const },
    { label: "Atenção", value: String(attention + telemetry.counts.down), hint: "degradadas ou offline", tone: attention || telemetry.counts.down ? "orange" as const : "green" as const },
    { label: "Sem vínculo", value: String(telemetry.counts.unmapped + telemetry.counts.ambiguous), hint: "sem host confiável", tone: telemetry.counts.unmapped ? "orange" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/monitoramento/mapas">
      <div className="nova-lit-page-heading nova-map-heading">
        <div>
          <h1>Mapas</h1>
          <p className="nova-lit-page-subtitle">
            Mapa operacional esquemático por cidade, unidade e saúde de monitoramento.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/monitoramento/sensores" className="nova-lit-button nova-lit-button-secondary">Sensores</Link>
          <Link href="/alertas" className="nova-lit-button nova-lit-button-primary">Alertas</Link>
        </div>
      </div>

      <section className="nova-map-kpi-grid" aria-label="Indicadores do mapa">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/monitoramento/mapas" className="nova-lit-card nova-map-filters">
        <label className="nova-map-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Cidade, unidade, parceiro, host ou ativo" />
        </label>

        <label className="nova-map-field">
          <span>Saúde</span>
          <select name="health" defaultValue={state.health}>
            <option value="all">Todos</option>
            <option value="online">Online</option>
            <option value="degraded">Atenção</option>
            <option value="down">Offline</option>
            <option value="unmapped">Sem vínculo</option>
            <option value="ambiguous">Ambíguo</option>
            <option value="unknown">Sem item</option>
          </select>
        </label>

        <label className="nova-map-field">
          <span>Cidades</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="12">12</option>
            <option value="18">18</option>
            <option value="24">24</option>
          </select>
        </label>

        <button type="submit">Filtrar</button>
        <Link href="/monitoramento/mapas">Limpar</Link>
      </form>

      <section className="nova-map-main-grid">
        <div className="nova-map-left-col">
          <section className="nova-lit-card nova-map-board">
            <div className="nova-map-section-title">
              <div>
                <span>Mapa técnico</span>
                <h2>Cobertura por cidade</h2>
              </div>
              <div className="nova-map-legend">
                <b><Dot tone="green" />Online</b>
                <b><Dot tone="orange" />Atenção</b>
                <b><Dot tone="red" />Offline</b>
                <b><Dot tone="slate" />Sem vínculo</b>
              </div>
            </div>

            <div className="nova-map-canvas" aria-label="Mapa operacional esquemático">
              <div className="nova-map-grid-bg" />
              <div className="nova-map-watermark">NOVA · TOCANTINS</div>

              {visibleCities.length ? visibleCities.map((city, index) => {
                const pos = markerPosition(index, visibleCities.length);
                const tone = cityTone(city);

                return (
                  <Link
                    key={`${city.id}-marker-${index}`}
                    href={`/unidades?q=${encodeURIComponent(city.city)}`}
                    className={`nova-map-marker is-${tone}`}
                    style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                    title={`${city.label} · ${city.total} unidade(s)`}
                  >
                    <strong>{city.total}</strong>
                    <span>{city.city}</span>
                  </Link>
                );
              }) : (
                <div className="nova-map-empty">
                  <strong>{telemetryError ? "Telemetria indisponível" : "Nenhuma cidade no recorte"}</strong>
                  <span>{telemetryError || "Ajuste os filtros para exibir cidades no mapa operacional."}</span>
                </div>
              )}

              <div className="nova-map-note">
                <strong>Mapa esquemático</strong>
                <span>O banco atual não possui latitude/longitude; a tela agrupa por cidade/UF sem simular precisão geográfica.</span>
              </div>
            </div>
          </section>

          <section className="nova-lit-card nova-map-city-table-card">
            <div className="nova-map-section-title">
              <div>
                <span>Localidades</span>
                <h2>Cidades monitoradas</h2>
              </div>
              <small>{visibleCities.length} de {cities.length}</small>
            </div>

            <div className="nova-map-city-table">
              <div className="nova-map-city-head">
                <span>Cidade</span>
                <span>Unidades</span>
                <span>Online</span>
                <span>Atenção</span>
                <span>Offline</span>
                <span>Vínculo</span>
                <span>Ações</span>
              </div>

              {visibleCities.length ? visibleCities.map((city, index) => (
                <div className={`nova-map-city-row is-${cityTone(city)}`} key={`${city.id}-row-${index}`}>
                  <div>
                    <strong>{city.label}</strong>
                    <small>{city.alerts ? `${city.alerts} alerta(s) recente(s)` : "sem alerta recente"}</small>
                  </div>
                  <div><b>{city.total}</b></div>
                  <div><b>{city.online}</b></div>
                  <div><b>{city.attention}</b></div>
                  <div><b>{city.down}</b></div>
                  <div>
                    <MiniBar value={city.matched} max={city.total} tone={city.matched === city.total ? "green" : "orange"} />
                    <small>{city.matched}/{city.total}</small>
                  </div>
                  <div>
                    <Link href={`/unidades?q=${encodeURIComponent(city.city)}`}>Abrir</Link>
                  </div>
                </div>
              )) : (
                <div className="nova-map-table-empty">
                  Nenhuma cidade encontrada.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="nova-map-right-col">
          <section className="nova-lit-card nova-map-coverage">
            <div className="nova-lit-title-row">
              <h2>Cobertura</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{coverage}%</span>
            </div>
            <div className="nova-map-ring">
              <strong>{coverage}%</strong>
              <span>com host</span>
            </div>
            <p>{telemetry.counts.matched} de {telemetry.counts.units} unidade(s) com vínculo Zabbix.</p>
          </section>

          <section className="nova-lit-card nova-map-layers">
            <span>Camadas rápidas</span>
            <Link href={withParams("/monitoramento/mapas", currentParams, { health: "down" })}>
              Offline <b>{telemetry.counts.down}</b>
            </Link>
            <Link href={withParams("/monitoramento/mapas", currentParams, { health: "degraded" })}>
              Atenção <b>{telemetry.counts.degraded}</b>
            </Link>
            <Link href={withParams("/monitoramento/mapas", currentParams, { health: "unmapped" })}>
              Sem vínculo <b>{telemetry.counts.unmapped}</b>
            </Link>
          </section>

          <section className="nova-lit-card nova-map-risk">
            <div className="nova-lit-title-row">
              <h2>Risco por cidade</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{riskCities.length}</span>
            </div>

            <div className="nova-map-risk-list">
              {riskCities.length ? riskCities.map((city, index) => (
                <Link href={`/unidades?q=${encodeURIComponent(city.city)}`} key={`${city.id}-risk-${index}`}>
                  <Dot tone={cityTone(city)} />
                  <div>
                    <strong>{city.label}</strong>
                    <span>{city.down} offline · {city.attention} atenção · {city.alerts} alerta(s)</span>
                  </div>
                </Link>
              )) : (
                <div className="nova-map-risk-empty">Nenhuma cidade crítica no recorte atual.</div>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-map-sources">
            <div className="nova-lit-title-row">
              <h2>Fonte</h2>
              <span className="nova-lit-pill nova-lit-pill-green">{telemetry.sources.length}</span>
            </div>
            <div className="nova-map-source-list">
              {telemetry.sources.length ? telemetry.sources.map((source) => (
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
                    <span>Configure a integração Zabbix para popular o mapa.</span>
                  </div>
                </article>
              )}
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
