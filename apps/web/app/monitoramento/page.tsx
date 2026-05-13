import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { formatDateTime } from "@/lib/formatters";
import {
  readStringParam,
  resolveSearchParams,
  withParams,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  emptyCommandCenter,
  formatMs,
  formatPercent,
  formatTemperature,
  safeApiJson,
  unitAlertScore,
  type CommandCenter,
  type UnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type MonitorView = "overview" | "units" | "partners" | "sensors" | "events";

type MonitorState = {
  q: string;
  health: string;
  partner: string;
  sort: string;
  view: MonitorView;
};

type PartnerRow = {
  partner: UnitHostTelemetryItem["partner"];
  units: number;
  online: number;
  degraded: number;
  down: number;
  unmapped: number;
  problems: number;
  avgLatencyMs: number | null;
  avgLossPct: number | null;
  latencies: number[];
  losses: number[];
};

const emptyTelemetry = {
  generatedAt: new Date(0).toISOString(),
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
} as unknown as UnitHostTelemetry;

function normalizeView(value: string): MonitorView {
  if (value === "units" || value === "partners" || value === "sensors" || value === "events") return value;
  return "overview";
}

function stateParams(state: MonitorState): RawSearchParams {
  return {
    q: state.q || undefined,
    health: state.health !== "all" ? state.health : undefined,
    partner: state.partner !== "all" ? state.partner : undefined,
    sort: state.sort !== "risk" ? state.sort : undefined,
    view: state.view !== "overview" ? state.view : undefined,
  };
}

function cityLine(item: UnitHostTelemetryItem) {
  return [item.unit.city, item.unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function partnerLabel(partner: UnitHostTelemetryItem["partner"]) {
  return `${partner.code} · ${partner.name}`;
}

function healthLabel(value: string) {
  if (value === "online") return "Online";
  if (value === "degraded") return "Atenção";
  if (value === "down") return "Offline";
  return "Sem leitura";
}

function healthTone(value: string): Tone {
  if (value === "online") return "green";
  if (value === "degraded") return "orange";
  if (value === "down") return "red";
  return "slate";
}

function matchLabel(value: string) {
  if (value === "matched") return "Vinculado";
  if (value === "ambiguous") return "Ambíguo";
  if (value === "unmatched") return "Sem vínculo";
  return value || "Sem vínculo";
}

function matchTone(value: string): Tone {
  if (value === "matched") return "green";
  if (value === "ambiguous") return "orange";
  if (value === "unmatched") return "slate";
  return "slate";
}

function metricTone(value: number | null | undefined, warning: number, critical: number): Tone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "slate";
  if (value >= critical) return "red";
  if (value >= warning) return "orange";
  return "green";
}

function itemSearchText(item: UnitHostTelemetryItem) {
  return [
    item.unit.code,
    item.unit.name,
    item.unit.city,
    item.unit.state,
    item.partner.code,
    item.partner.name,
    item.match.host,
    item.match.hostName,
    ...item.equipments.flatMap((equipment) => [
      equipment.tag,
      equipment.name,
      equipment.type,
      equipment.serialNumber,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countsFromItems(items: UnitHostTelemetryItem[]) {
  const latencies = items
    .map((item) => item.metrics.latencyMs)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  const losses = items
    .map((item) => item.metrics.lossPct)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  const temperatures = items
    .map((item) => item.metrics.temperatureC)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  return {
    units: items.length,
    matched: items.filter((item) => item.match.status === "matched").length,
    ambiguous: items.filter((item) => item.match.status === "ambiguous").length,
    unmapped: items.filter((item) => item.match.status !== "matched").length,
    online: items.filter((item) => item.health === "online").length,
    degraded: items.filter((item) => item.health === "degraded").length,
    down: items.filter((item) => item.health === "down").length,
    withProblems: items.filter((item) => item.problems.length > 0).length,
    syncReady: items.filter((item) => item.match.syncReady).length,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, item) => sum + item, 0) / latencies.length) : null,
    avgLossPct: losses.length ? Number((losses.reduce((sum, item) => sum + item, 0) / losses.length).toFixed(2)) : null,
    maxTemperatureC: temperatures.length ? Math.max(...temperatures) : null,
  };
}

function sortItems(items: UnitHostTelemetryItem[], sort: string) {
  const sorted = items.slice();

  if (sort === "latency") return sorted.sort((a, b) => (b.metrics.latencyMs ?? -1) - (a.metrics.latencyMs ?? -1));
  if (sort === "loss") return sorted.sort((a, b) => (b.metrics.lossPct ?? -1) - (a.metrics.lossPct ?? -1));
  if (sort === "temperature") return sorted.sort((a, b) => (b.metrics.temperatureC ?? -1) - (a.metrics.temperatureC ?? -1));
  if (sort === "partner") return sorted.sort((a, b) => a.partner.code.localeCompare(b.partner.code) || a.unit.code.localeCompare(b.unit.code));
  if (sort === "code") return sorted.sort((a, b) => a.unit.code.localeCompare(b.unit.code));

  return sorted.sort((a, b) => unitAlertScore(b) - unitAlertScore(a) || a.unit.code.localeCompare(b.unit.code));
}

function filterTelemetry(telemetry: UnitHostTelemetry, state: MonitorState) {
  const query = state.q.toLowerCase();

  const items = telemetry.items.filter((item) => {
    const matchesQuery = query ? itemSearchText(item).includes(query) : true;
    const matchesPartner = state.partner !== "all" ? item.partner.id === state.partner : true;
    const matchesHealth =
      state.health === "all"
        ? true
        : state.health === "problem"
          ? item.problems.length > 0
          : state.health === "high-latency"
            ? (item.metrics.latencyMs ?? 0) >= 150
            : state.health === "high-loss"
              ? (item.metrics.lossPct ?? 0) >= 3
              : state.health === "temperature"
                ? (item.metrics.temperatureC ?? 0) >= 55
                : state.health === "unmapped"
                  ? item.match.status !== "matched"
                  : item.health === state.health;

    return matchesQuery && matchesPartner && matchesHealth;
  });

  const sorted = sortItems(items, state.sort);

  return {
    ...telemetry,
    counts: countsFromItems(sorted),
    items: sorted,
  };
}

function partnersFromTelemetry(telemetry: UnitHostTelemetry) {
  const partners = new Map<string, UnitHostTelemetryItem["partner"]>();
  for (const item of telemetry.items) partners.set(item.partner.id, item.partner);
  return Array.from(partners.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function partnerRowsFromTelemetry(telemetry: UnitHostTelemetry): PartnerRow[] {
  const rows = new Map<string, PartnerRow>();

  for (const item of telemetry.items) {
    const current = rows.get(item.partner.id) || {
      partner: item.partner,
      units: 0,
      online: 0,
      degraded: 0,
      down: 0,
      unmapped: 0,
      problems: 0,
      avgLatencyMs: null,
      avgLossPct: null,
      latencies: [],
      losses: [],
    };

    current.units += 1;
    current.online += item.health === "online" ? 1 : 0;
    current.degraded += item.health === "degraded" ? 1 : 0;
    current.down += item.health === "down" ? 1 : 0;
    current.unmapped += item.match.status !== "matched" ? 1 : 0;
    current.problems += item.problems.length;

    if (typeof item.metrics.latencyMs === "number") current.latencies.push(item.metrics.latencyMs);
    if (typeof item.metrics.lossPct === "number") current.losses.push(item.metrics.lossPct);

    rows.set(item.partner.id, current);
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      avgLatencyMs: row.latencies.length ? Math.round(row.latencies.reduce((sum, item) => sum + item, 0) / row.latencies.length) : null,
      avgLossPct: row.losses.length ? Number((row.losses.reduce((sum, item) => sum + item, 0) / row.losses.length).toFixed(2)) : null,
    }))
    .sort((a, b) => b.down - a.down || b.degraded - a.degraded || b.problems - a.problems || a.partner.code.localeCompare(b.partner.code));
}

function sourceFailures(telemetry: UnitHostTelemetry) {
  return telemetry.sources.filter((source) => !source.ok).length;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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
    <article className="nova-lit-card nova-monitor-kpi">
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
  return <span className={`nova-monitor-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-monitor-progress">
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="nova-monitor-empty">
      <div>N</div>
      <strong>{label}</strong>
      <span>Ajuste os filtros ou aguarde nova leitura das fontes de monitoramento.</span>
    </div>
  );
}

function UnitRows({ items }: { items: UnitHostTelemetryItem[] }) {
  return (
    <div className="nova-monitor-table is-units">
      <div className="nova-monitor-table-head">
        <span>Unidade</span>
        <span>Parceiro</span>
        <span>Saúde</span>
        <span>Ping</span>
        <span>Perda</span>
        <span>Latência</span>
        <span>Temp.</span>
        <span>Ações</span>
      </div>

      {items.length ? items.map((item) => (
        <div className={`nova-monitor-row is-${healthTone(item.health)}`} key={item.unit.id}>
          <div>
            <Link href={`/unidades/${item.unit.id}`} className="nova-monitor-target-link">{item.unit.code} · {item.unit.name}</Link>
            <small>{cityLine(item)} · {matchLabel(item.match.status)}</small>
          </div>

          <div>
            <b>{item.partner.code}</b>
            <small>{item.partner.name}</small>
          </div>

          <div>
            <Badge tone={healthTone(item.health)}>{healthLabel(item.health)}</Badge>
            <small>{item.problems.length ? `${item.problems.length} evento(s)` : "sem evento ativo"}</small>
          </div>

          <div>
            <b>{item.metrics.ping ? "OK" : "-"}</b>
            <small>{item.match.hostName || item.match.host || "sem host"}</small>
          </div>

          <div>
            <b className={`is-metric-${metricTone(item.metrics.lossPct, 3, 8)}`}>{formatPercent(item.metrics.lossPct)}</b>
            <small>perda média</small>
          </div>

          <div>
            <b className={`is-metric-${metricTone(item.metrics.latencyMs, 150, 300)}`}>{formatMs(item.metrics.latencyMs)}</b>
            <small>última coleta</small>
          </div>

          <div>
            <b className={`is-metric-${metricTone(item.metrics.temperatureC, 55, 70)}`}>{formatTemperature(item.metrics.temperatureC)}</b>
            <small>{item.equipments.length} ativo(s)</small>
          </div>

          <div>
            <Link href={`/unidades/${item.unit.id}`}>Abrir</Link>
          </div>
        </div>
      )) : (
        <EmptyState label="Nenhuma unidade no recorte" />
      )}
    </div>
  );
}

function PartnerRows({ rows }: { rows: PartnerRow[] }) {
  return (
    <div className="nova-monitor-table is-partners">
      <div className="nova-monitor-table-head">
        <span>Parceiro</span>
        <span>Unidades</span>
        <span>Online</span>
        <span>Atenção</span>
        <span>Offline</span>
        <span>Vínculo</span>
        <span>Latência</span>
        <span>Ações</span>
      </div>

      {rows.length ? rows.map((row) => (
        <div className={`nova-monitor-row is-${row.down ? "red" : row.degraded || row.problems ? "orange" : "green"}`} key={row.partner.id}>
          <div>
            <Link href={`/parceiros/${row.partner.id}`} className="nova-monitor-target-link">{partnerLabel(row.partner)}</Link>
            <small>{row.problems ? `${row.problems} evento(s)` : "sem evento recente"}</small>
          </div>
          <div><b>{row.units}</b><small>locais</small></div>
          <div><b>{row.online}</b><small>online</small></div>
          <div><b>{row.degraded}</b><small>atenção</small></div>
          <div><b>{row.down}</b><small>offline</small></div>
          <div><b>{row.units - row.unmapped}/{row.units}</b><small>com host</small></div>
          <div><b>{formatMs(row.avgLatencyMs)}</b><small>{formatPercent(row.avgLossPct)} perda</small></div>
          <div><Link href={`/unidades?partner=${row.partner.id}`}>Abrir</Link></div>
        </div>
      )) : (
        <EmptyState label="Nenhum parceiro no recorte" />
      )}
    </div>
  );
}

function EventRows({ items }: { items: UnitHostTelemetryItem[] }) {
  const events = items.flatMap((item) =>
    item.problems.map((problem, index) => ({
      item,
      problem,
      index,
    })),
  );

  return (
    <div className="nova-monitor-table is-events">
      <div className="nova-monitor-table-head">
        <span>Evento</span>
        <span>Unidade</span>
        <span>Parceiro</span>
        <span>Saúde</span>
        <span>Latência</span>
        <span>Perda</span>
        <span>Vínculo</span>
        <span>Ações</span>
      </div>

      {events.length ? events.map(({ item, problem, index }) => (
        <div className={`nova-monitor-row is-${healthTone(item.health)}`} key={`${item.unit.id}-${index}-${problem.name || problem.severity || "evento"}`}>
          <div>
            <strong>{problem.name || "Evento ativo"}</strong>
            <small>{problem.severity || "sem severidade informada"}</small>
          </div>
          <div>
            <Link href={`/unidades/${item.unit.id}`} className="nova-monitor-target-link">{item.unit.code} · {item.unit.name}</Link>
            <small>{cityLine(item)}</small>
          </div>
          <div><b>{item.partner.code}</b><small>{item.partner.name}</small></div>
          <div><Badge tone={healthTone(item.health)}>{healthLabel(item.health)}</Badge></div>
          <div><b>{formatMs(item.metrics.latencyMs)}</b><small>latência</small></div>
          <div><b>{formatPercent(item.metrics.lossPct)}</b><small>perda</small></div>
          <div><Badge tone={matchTone(item.match.status)}>{matchLabel(item.match.status)}</Badge></div>
          <div><Link href={`/monitoramento/sensores?q=${encodeURIComponent(item.unit.code)}`}>Abrir</Link></div>
        </div>
      )) : (
        <EmptyState label="Nenhum evento no recorte" />
      )}
    </div>
  );
}

function SensorRows({ items }: { items: UnitHostTelemetryItem[] }) {
  return (
    <div className="nova-monitor-table is-sensors">
      <div className="nova-monitor-table-head">
        <span>Host</span>
        <span>Unidade</span>
        <span>Vínculo</span>
        <span>Ping</span>
        <span>Perda</span>
        <span>Latência</span>
        <span>Temp.</span>
        <span>Ações</span>
      </div>

      {items.length ? items.map((item) => (
        <div className={`nova-monitor-row is-${matchTone(item.match.status)}`} key={item.unit.id}>
          <div>
            <strong>{item.match.hostName || item.match.host || "Sem host"}</strong>
            <small>{item.match.host || "host não informado"}</small>
          </div>
          <div>
            <Link href={`/unidades/${item.unit.id}`} className="nova-monitor-target-link">{item.unit.code} · {item.unit.name}</Link>
            <small>{cityLine(item)}</small>
          </div>
          <div>
            <Badge tone={matchTone(item.match.status)}>{matchLabel(item.match.status)}</Badge>
            <small>{item.match.syncReady ? "pronto para sync" : "sem sync automático"}</small>
          </div>
          <div><b>{item.metrics.ping ? "OK" : "-"}</b><small>ICMP</small></div>
          <div><b>{formatPercent(item.metrics.lossPct)}</b><small>última leitura</small></div>
          <div><b>{formatMs(item.metrics.latencyMs)}</b><small>resposta</small></div>
          <div><b>{formatTemperature(item.metrics.temperatureC)}</b><small>ambiente</small></div>
          <div><Link href={`/monitoramento/sensores?q=${encodeURIComponent(item.unit.code)}`}>Abrir</Link></div>
        </div>
      )) : (
        <EmptyState label="Nenhum sensor no recorte" />
      )}
    </div>
  );
}

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/monitoramento");

  const params = await resolveSearchParams(searchParams);
  const state: MonitorState = {
    q: readStringParam(params, "q", ""),
    health: readStringParam(params, "health", "all"),
    partner: readStringParam(params, "partner", "all"),
    sort: readStringParam(params, "sort", "risk"),
    view: normalizeView(readStringParam(params, "view", "overview")),
  };

  const [rawTelemetry, commandCenter] = await Promise.all([
    safeApiJson<UnitHostTelemetry>("/monitoring/unit-hosts?mode=fast", emptyTelemetry),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const telemetry = filterTelemetry(rawTelemetry, state);
  const partners = partnersFromTelemetry(rawTelemetry);
  const partnerRows = partnerRowsFromTelemetry(telemetry);
  const currentParams = stateParams(state);
  const eventCount = telemetry.items.reduce((sum, item) => sum + item.problems.length, 0);
  const sourceFailureCount = sourceFailures(rawTelemetry);
  const linkedPercent = percent(telemetry.counts.matched, telemetry.counts.units);
  const healthPercent = percent(telemetry.counts.online, telemetry.counts.units);
  const visibleTitle =
    state.view === "partners"
      ? "Parceiros monitorados"
      : state.view === "events"
        ? "Eventos recentes"
        : state.view === "sensors"
          ? "Sensores correlacionados"
          : "Unidades monitoradas";

  const kpis = [
    { label: "Unidades", value: String(telemetry.counts.units), hint: "recorte filtrado", tone: "blue" as const },
    { label: "Online", value: String(telemetry.counts.online), hint: "hosts saudáveis", tone: telemetry.counts.online ? "green" as const : "slate" as const },
    { label: "Atenção", value: String(telemetry.counts.degraded), hint: "degradadas", tone: telemetry.counts.degraded ? "orange" as const : "green" as const },
    { label: "Offline", value: String(telemetry.counts.down), hint: "sem resposta", tone: telemetry.counts.down ? "red" as const : "slate" as const },
    { label: "Eventos", value: String(eventCount + commandCenter.metrics.criticalOpenOccurrences), hint: `${commandCenter.metrics.openOccurrences} alertas NOC`, tone: eventCount ? "orange" as const : "blue" as const },
  ];

  return (
    <NovaLitShell activeHref="/monitoramento">
      <div className="nova-lit-page-heading nova-monitor-heading">
        <div>
          <h1>Monitoramento</h1>
          <p className="nova-lit-page-subtitle">Leitura do turno com cobertura, saúde dos hosts, latência, perda e eventos por unidade.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/monitoramento/sensores" className="nova-lit-button nova-lit-button-secondary">Ver sensores</Link>
          <Link href="/relatorios/monitoramento" className="nova-lit-button nova-lit-button-primary">Gerar relatório</Link>
        </div>
      </div>

      <section className="nova-monitor-kpi-grid" aria-label="Indicadores de monitoramento">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="nova-monitor-view-strip" aria-label="Visões de monitoramento">
        <Link href={withParams("/monitoramento", currentParams, { view: "overview" })} className={state.view === "overview" ? "is-active" : ""}>
          Visão geral <b>{telemetry.counts.units}</b>
        </Link>
        <Link href={withParams("/monitoramento", currentParams, { view: "units" })} className={state.view === "units" ? "is-active" : ""}>
          Unidades <b>{telemetry.items.length}</b>
        </Link>
        <Link href={withParams("/monitoramento", currentParams, { view: "partners" })} className={state.view === "partners" ? "is-active" : ""}>
          Parceiros <b>{partnerRows.length}</b>
        </Link>
        <Link href={withParams("/monitoramento", currentParams, { view: "sensors" })} className={state.view === "sensors" ? "is-active" : ""}>
          Sensores <b>{telemetry.counts.matched}</b>
        </Link>
        <Link href={withParams("/monitoramento", currentParams, { view: "events" })} className={state.view === "events" ? "is-active" : ""}>
          Eventos <b>{eventCount}</b>
        </Link>
      </section>

      <form action="/monitoramento" className="nova-lit-card nova-monitor-filters">
        <label className="nova-monitor-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Buscar unidade, parceiro, host, cidade, serial ou ativo" />
        </label>

        <label className="nova-monitor-field">
          <span>Parceiro</span>
          <select name="partner" defaultValue={state.partner}>
            <option value="all">Todos</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.code} · {partner.name}</option>
            ))}
          </select>
        </label>

        <label className="nova-monitor-field">
          <span>Saúde</span>
          <select name="health" defaultValue={state.health}>
            <option value="all">Todos</option>
            <option value="online">Online</option>
            <option value="degraded">Atenção</option>
            <option value="down">Offline</option>
            <option value="problem">Com evento</option>
            <option value="high-latency">Alta latência</option>
            <option value="high-loss">Perda alta</option>
            <option value="temperature">Temperatura alta</option>
            <option value="unmapped">Sem vínculo</option>
          </select>
        </label>

        <label className="nova-monitor-field">
          <span>Ordem</span>
          <select name="sort" defaultValue={state.sort}>
            <option value="risk">Risco</option>
            <option value="latency">Latência</option>
            <option value="loss">Perda</option>
            <option value="temperature">Temperatura</option>
            <option value="partner">Parceiro</option>
            <option value="code">Código</option>
          </select>
        </label>

        <input type="hidden" name="view" value={state.view} />
        <button type="submit">Filtrar</button>
        <Link href="/monitoramento">Limpar</Link>
      </form>

      <section className="nova-monitor-main-grid">
        <div className="nova-lit-card nova-monitor-table-card">
          <div className="nova-monitor-section-title">
            <div>
              <span>NOC</span>
              <h2>{visibleTitle}</h2>
            </div>
            <div>
              <small>{formatDateTime(rawTelemetry.generatedAt)}</small>
              <Link href="/monitoramento/sensores">Abrir sensores</Link>
            </div>
          </div>

          {state.view === "partners" ? (
            <PartnerRows rows={partnerRows} />
          ) : state.view === "events" ? (
            <EventRows items={telemetry.items} />
          ) : state.view === "sensors" ? (
            <SensorRows items={telemetry.items} />
          ) : (
            <UnitRows items={telemetry.items} />
          )}
        </div>

        <aside className="nova-monitor-right-col">
          <section className="nova-lit-card nova-monitor-coverage">
            <div className="nova-lit-title-row">
              <h2>Cobertura</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{linkedPercent}%</span>
            </div>
            <div className="nova-monitor-ring-wrap">
              <div className="nova-monitor-ring" style={{ "--value": `${linkedPercent}%` } as React.CSSProperties}>
                <strong>{linkedPercent}%</strong>
                <span>com host</span>
              </div>
            </div>
            <p>{telemetry.counts.matched} de {telemetry.counts.units} unidade(s) com host correlacionado.</p>
          </section>

          <section className="nova-lit-card nova-monitor-health">
            <div className="nova-lit-title-row">
              <h2>Saúde</h2>
              <span className="nova-lit-pill nova-lit-pill-green">{healthPercent}%</span>
            </div>
            <div className="nova-monitor-progress-list">
              <ProgressLine label="Online" value={percent(telemetry.counts.online, telemetry.counts.units)} tone="green" />
              <ProgressLine label="Atenção" value={percent(telemetry.counts.degraded, telemetry.counts.units)} tone="orange" />
              <ProgressLine label="Offline" value={percent(telemetry.counts.down, telemetry.counts.units)} tone="red" />
              <ProgressLine label="Sem vínculo" value={percent(telemetry.counts.unmapped, telemetry.counts.units)} tone="slate" />
            </div>
          </section>

          <section className="nova-lit-card nova-monitor-quick">
            <span>Atalhos do recorte</span>
            <Link href={withParams("/monitoramento", currentParams, { health: "down", page: undefined })}>Offline <b>{telemetry.counts.down}</b></Link>
            <Link href={withParams("/monitoramento", currentParams, { health: "problem", page: undefined })}>Com eventos <b>{eventCount}</b></Link>
            <Link href={withParams("/monitoramento", currentParams, { health: "unmapped", page: undefined })}>Sem vínculo <b>{telemetry.counts.unmapped}</b></Link>
          </section>

          <section className="nova-lit-card nova-monitor-metrics">
            <div className="nova-lit-title-row">
              <h2>Leituras</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{sourceFailureCount} falhas</span>
            </div>
            <div className="nova-monitor-status-list">
              <article>
                <Dot tone="blue" />
                <strong>Latência média</strong>
                <b>{formatMs(telemetry.counts.avgLatencyMs)}</b>
              </article>
              <article>
                <Dot tone="orange" />
                <strong>Perda média</strong>
                <b>{formatPercent(telemetry.counts.avgLossPct)}</b>
              </article>
              <article>
                <Dot tone="red" />
                <strong>Temperatura máx.</strong>
                <b>{formatTemperature(telemetry.counts.maxTemperatureC)}</b>
              </article>
              <article>
                <Dot tone="green" />
                <strong>Pronto para sync</strong>
                <b>{telemetry.counts.syncReady}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-monitor-sources">
            <div className="nova-lit-title-row">
              <h2>Fontes de dados</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{rawTelemetry.sources.length}</span>
            </div>
            <div className="nova-monitor-source-list">
              {rawTelemetry.sources.length ? rawTelemetry.sources.map((source) => (
                <article key={source.code}>
                  <Dot tone={source.ok ? "green" : "orange"} />
                  <div>
                    <strong>{source.name || source.code}</strong>
                    <span>{source.ok ? "fonte saudável" : source.message || "atenção na coleta"}</span>
                  </div>
                </article>
              )) : (
                <div className="nova-monitor-list-empty">Nenhuma fonte de monitoramento carregada.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-monitor-pagination">
        <span>
          {telemetry.items.length} unidade(s) no recorte · {telemetry.counts.withProblems} com evento · {commandCenter.metrics.overdueMaintenances} chamado(s) vencido(s)
        </span>
        <div>
          <Link href="/relatorios/monitoramento">Relatório</Link>
          <Link href="/monitoramento/sensores">Ver sensores</Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
