import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import {
  buildApiQuery,
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Bucket = {
  key: string;
  count: number;
};

type RecentOccurrence = {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  createdAt: string;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  _count: { maintenances: number };
};

type RecentMaintenance = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
};

type CommandCenter = {
  generatedAt: string;
  metrics: {
    openOccurrences: number;
    criticalOpenOccurrences: number;
    overdueMaintenances: number;
    dueTodayMaintenances: number;
  };
  buckets: {
    occurrenceBySeverity: Bucket[];
    occurrenceByStatus: Bucket[];
    maintenanceByStatus: Bucket[];
    maintenanceByType: Bucket[];
  };
  recentOccurrences: RecentOccurrence[];
  recentMaintenances: RecentMaintenance[];
};

type UnitHostTelemetry = {
  generatedAt: string;
  sources: Array<{
    id: string;
    code: string;
    name: string;
    ok: boolean;
    message: string;
    targetUrl: string;
    version?: string;
    totalHosts: number;
    matchedUnits: number;
  }>;
  counts: {
    units: number;
    matched: number;
    ambiguous: number;
    unmapped: number;
    online: number;
    degraded: number;
    down: number;
    withProblems: number;
    syncReady: number;
    avgLatencyMs: number | null;
    avgLossPct: number | null;
    maxTemperatureC: number | null;
  };
  items: UnitHostTelemetryItem[];
};

type UnitHostTelemetryItem = {
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    isActive: boolean;
  };
  partner: {
    id: string;
    code: string;
    name: string;
  };
  equipments: Array<{
    id: string;
    tag: string;
    name: string;
    type: string;
    serialNumber: string | null;
    status: string;
    isActive: boolean;
  }>;
  match: {
    status: "matched" | "ambiguous" | "unmatched";
    score: number;
    confidence: number;
    integrationId?: string;
    integrationCode?: string;
    integrationName?: string;
    targetUrl?: string;
    hostId?: string;
    host?: string;
    hostName?: string;
    hostStatus?: string;
    matchedBy: string[];
    candidates: number;
    syncReady: boolean;
  };
  health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
  metrics: {
    ping: {
      ok: boolean | null;
      value: number | null;
      itemid: string;
      name: string;
      key: string;
      lastClock: string | null;
      units: string;
    } | null;
    lossPct: number | null;
    latencyMs: number | null;
    temperatureC: number | null;
    sources: Record<string, { itemid: string; name: string; key: string; lastClock: string | null; units: string } | null>;
  };
  problems: Array<{
    eventid: string;
    name: string;
    severity: string;
    acknowledged: string;
    clock: string;
    objectid?: string;
  }>;
};

type MonitorView = "overview" | "units" | "partners" | "sensors" | "events";

type MonitorFilters = {
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
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function emptyTelemetry(message = "Falha ao carregar telemetria.") {
  return {
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "telemetry",
        code: "ZBX",
        name: "Zabbix",
        ok: false,
        message,
        targetUrl: "",
        totalHosts: 0,
        matchedUnits: 0,
      },
    ],
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
  } satisfies UnitHostTelemetry;
}

function emptyCommandCenter() {
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      openOccurrences: 0,
      criticalOpenOccurrences: 0,
      overdueMaintenances: 0,
      dueTodayMaintenances: 0,
    },
    buckets: {
      occurrenceBySeverity: [],
      occurrenceByStatus: [],
      maintenanceByStatus: [],
      maintenanceByType: [],
    },
    recentOccurrences: [],
    recentMaintenances: [],
  } satisfies CommandCenter;
}

async function safeApiJson<T>(path: string, fallback: T) {
  try {
    return await apiJson<T>(path);
  } catch {
    return fallback;
  }
}

async function readTelemetry() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    return await apiJson<UnitHostTelemetry>("/monitoring/unit-hosts?mode=fast", {
      signal: controller.signal,
    });
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));
    return emptyTelemetry(
      aborted
        ? "Telemetria Zabbix ainda carregando. Recarregue em alguns segundos."
        : error instanceof Error
          ? error.message
          : "Falha ao carregar telemetria.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatEpoch(value: string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Date(timestamp * 1000).toLocaleString("pt-BR");
}

function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatMs(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

function formatTemperature(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
}

function cityLine(item: UnitHostTelemetryItem) {
  return [item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "-";
}

function healthTone(value: UnitHostTelemetryItem["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  if (value === "unmapped") return "subtle";
  return "neutral";
}

function healthLabel(value: UnitHostTelemetryItem["health"]) {
  const labels: Record<UnitHostTelemetryItem["health"], string> = {
    online: "online",
    degraded: "atenção",
    down: "offline",
    unmapped: "sem vínculo",
    unknown: "sem item",
    ambiguous: "ambíguo",
  };
  return labels[value];
}

function metricTone(value: number | null, warning: number, critical: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= critical) return "critical";
  if (value >= warning) return "attention";
  return "success";
}

function severityTone(value: string) {
  const severity = Number(value);
  if (severity >= 5) return "critical";
  if (severity >= 3) return "attention";
  if (severity >= 2) return "info";
  return "neutral";
}

function normalizeMonitorView(value: string): MonitorView {
  if (value === "units" || value === "partners" || value === "sensors" || value === "events") return value;
  return "overview";
}

function monitorHref(filters: MonitorFilters, patch: Partial<MonitorFilters>) {
  const next = { ...filters, ...patch };
  return `/monitoramento${buildApiQuery({
    view: next.view !== "overview" ? next.view : undefined,
    q: next.q || undefined,
    health: next.health !== "all" ? next.health : undefined,
    partner: next.partner !== "all" ? next.partner : undefined,
    sort: next.sort !== "risk" ? next.sort : undefined,
  })}`;
}

function pressureForItem(item: UnitHostTelemetryItem) {
  return (
    (item.health === "down" ? 120 : 0) +
    (item.health === "degraded" ? 70 : 0) +
    (item.health === "ambiguous" ? 38 : 0) +
    (item.health === "unmapped" ? 32 : 0) +
    item.problems.length * 18 +
    (item.metrics.lossPct ?? 0) * 2 +
    Math.min(40, (item.metrics.latencyMs ?? 0) / 25) +
    Math.max(0, (item.metrics.temperatureC ?? 0) - 55)
  );
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
    unmapped: items.filter((item) => item.match.status === "unmatched").length,
    online: items.filter((item) => item.health === "online").length,
    degraded: items.filter((item) => item.health === "degraded").length,
    down: items.filter((item) => item.health === "down").length,
    withProblems: items.filter((item) => item.problems.length > 0).length,
    syncReady: items.filter((item) => item.match.syncReady).length,
    avgLatencyMs: latencies.length
      ? Math.round(latencies.reduce((sum, item) => sum + item, 0) / latencies.length)
      : null,
    avgLossPct: losses.length
      ? Number((losses.reduce((sum, item) => sum + item, 0) / losses.length).toFixed(2))
      : null,
    maxTemperatureC: temperatures.length ? Math.max(...temperatures) : null,
  };
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

function sortItems(items: UnitHostTelemetryItem[], sort: string) {
  const sorted = items.slice();
  if (sort === "latency") return sorted.sort((a, b) => (b.metrics.latencyMs ?? -1) - (a.metrics.latencyMs ?? -1));
  if (sort === "loss") return sorted.sort((a, b) => (b.metrics.lossPct ?? -1) - (a.metrics.lossPct ?? -1));
  if (sort === "partner") return sorted.sort((a, b) => a.partner.code.localeCompare(b.partner.code) || a.unit.code.localeCompare(b.unit.code));
  if (sort === "code") return sorted.sort((a, b) => a.unit.code.localeCompare(b.unit.code));
  return sorted.sort((a, b) => pressureForItem(b) - pressureForItem(a) || a.unit.code.localeCompare(b.unit.code));
}

function filterTelemetry(telemetry: UnitHostTelemetry, filters: MonitorFilters) {
  const query = filters.q.toLowerCase();
  const items = telemetry.items.filter((item) => {
    const matchesQuery = query ? itemSearchText(item).includes(query) : true;
    const matchesPartner = filters.partner !== "all" ? item.partner.id === filters.partner : true;
    const matchesHealth =
      filters.health === "all"
        ? true
        : filters.health === "problem"
          ? item.problems.length > 0
          : filters.health === "high-latency"
            ? (item.metrics.latencyMs ?? 0) >= 150
            : filters.health === "high-loss"
              ? (item.metrics.lossPct ?? 0) >= 3
              : filters.health === "temperature"
                ? (item.metrics.temperatureC ?? 0) >= 55
                : filters.health === "unmapped"
                  ? item.match.status !== "matched"
                  : item.health === filters.health;

    return matchesQuery && matchesPartner && matchesHealth;
  });

  const sorted = sortItems(items, filters.sort);
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
  const rows = new Map<string, PartnerRow & { latencies: number[]; losses: number[] }>();

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

function targetLabel(item: RecentOccurrence | RecentMaintenance) {
  if (item.equipment) return `${item.equipment.tag} · ${item.equipment.name}`;
  if (item.unit) return `${item.unit.code} · ${item.unit.name}`;
  if (item.partner) return `${item.partner.code} · ${item.partner.name}`;
  return "-";
}

function metricMarkerClass(tone: string) {
  if (tone === "success") return "bg-emerald-400";
  if (tone === "attention") return "bg-amber-400";
  if (tone === "critical") return "bg-rose-400";
  if (tone === "info") return "bg-sky-400";
  return "bg-slate-600";
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-3 flex items-end justify-between gap-3"><div className="text-2xl font-semibold tracking-tight text-slate-50">{value}</div><span className={cx("h-2.5 w-2.5 rounded-full", metricMarkerClass(tone))} aria-hidden="true" /></div></div>
  );
}

function Summary({ telemetry, commandCenter }: { telemetry: UnitHostTelemetry; commandCenter: CommandCenter }) {
  const sourceFailures = telemetry.sources.filter((source) => !source.ok).length;
  return (
    <Surface className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2"><TonePill tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"}>
              {telemetry.counts.down ? "incidente" : telemetry.counts.degraded ? "atenção" : "operacional"}
            </TonePill><TonePill tone={sourceFailures ? "attention" : "success"}>{sourceFailures ? `${sourceFailures} fonte(s) alerta` : "fontes ok"}</TonePill><TonePill tone="neutral">{formatDateTime(telemetry.generatedAt)}</TonePill></div><h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">Status operacional</h2></div><div className="flex flex-wrap gap-2"><Link className="inline-flex h-10 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]" href="/operacao/fila">
            Fila
          </Link><Link className="inline-flex h-10 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]" href="/relatorios/monitoramento">
            Relatórios
          </Link></div></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6"><MetricCard label="Unidades" value={telemetry.counts.units} /><MetricCard label="Online" value={telemetry.counts.online} tone="success" /><MetricCard label="Atenção" value={telemetry.counts.degraded} tone={telemetry.counts.degraded ? "attention" : "neutral"} /><MetricCard label="Offline" value={telemetry.counts.down} tone={telemetry.counts.down ? "critical" : "neutral"} /><MetricCard label="Eventos" value={telemetry.counts.withProblems + commandCenter.metrics.criticalOpenOccurrences} tone={telemetry.counts.withProblems ? "attention" : "neutral"} /><MetricCard label="Vínculo" value={`${telemetry.counts.matched}/${telemetry.counts.units}`} tone={telemetry.counts.unmapped || telemetry.counts.ambiguous ? "attention" : "success"} /></div></Surface>
  );
}

function Filters({ filters, partners, count }: { filters: MonitorFilters; partners: Array<UnitHostTelemetryItem["partner"]>; count: number }) {
  return (
    <Surface className="p-4 sm:p-5"><form method="GET" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_190px_190px_auto_auto]"><input type="hidden" name="view" value={filters.view} /><label className="grid gap-2"><FieldLabel>Busca</FieldLabel><input name="q" defaultValue={filters.q} placeholder="Unidade, parceiro, host, serial" /></label><label className="grid gap-2"><FieldLabel>Parceiro</FieldLabel><select name="partner" defaultValue={filters.partner}><option value="all">Todos</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.code} · {partner.name}</option>
            ))}
          </select></label><label className="grid gap-2"><FieldLabel>Estado</FieldLabel><select name="health" defaultValue={filters.health}><option value="all">Todos</option><option value="down">Offline</option><option value="degraded">Atenção</option><option value="online">Online</option><option value="problem">Com evento</option><option value="high-latency">Alta latência</option><option value="high-loss">Perda alta</option><option value="temperature">Temperatura alta</option><option value="unmapped">Sem vínculo</option></select></label><label className="grid gap-2"><FieldLabel>Ordenação</FieldLabel><select name="sort" defaultValue={filters.sort}><option value="risk">Risco</option><option value="latency">Latência</option><option value="loss">Perda</option><option value="partner">Parceiro</option><option value="code">Código</option></select></label><button className="xl:self-end">Aplicar</button><Link href="/monitoramento" className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] xl:self-end">
          Limpar
        </Link></form><div className="mt-3 text-xs font-medium text-slate-500">{count} unidade(s)</div></Surface>
  );
}

function Tabs({ filters, telemetry }: { filters: MonitorFilters; telemetry: UnitHostTelemetry }) {
  const partnerCount = new Set(telemetry.items.map((item) => item.partner.id)).size;
  const eventCount = telemetry.items.reduce((sum, item) => sum + item.problems.length, 0);
  const tabs: Array<{ view: MonitorView; label: string; count: number }> = [
    { view: "overview", label: "Visão geral", count: telemetry.counts.units },
    { view: "units", label: "Unidades", count: telemetry.items.length },
    { view: "partners", label: "Parceiros", count: partnerCount },
    { view: "sensors", label: "Sensores", count: telemetry.items.filter((item) => item.metrics.ping || item.metrics.latencyMs !== null || item.metrics.lossPct !== null).length },
    { view: "events", label: "Eventos", count: eventCount },
  ];

  return (
    <Surface className="p-2"><nav className="grid gap-2 md:grid-cols-5" aria-label="Visões de monitoramento">
        {tabs.map((tab) => {
          const active = filters.view === tab.view;
          return (
            <Link
              key={tab.view}
              href={monitorHref(filters, { view: tab.view })}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-sm font-semibold transition",
                active
                  ? "border-sky-500/30 bg-sky-500/[0.12] text-sky-50"
                  : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
              )}
            ><span>{tab.label}</span><TonePill tone={active ? "info" : "neutral"}>{tab.count}</TonePill></Link>
          );
        })}
      </nav></Surface>
  );
}

function UnitName({ item }: { item: UnitHostTelemetryItem }) {
  return (
    <div><Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
        {item.unit.code}
      </Link><div className="mt-1 max-w-[280px] text-sm text-slate-300">{item.unit.name}</div><div className="mt-1 text-xs text-slate-500">{cityLine(item)}</div></div>
  );
}

function UnitsTable({ telemetry, limit }: { telemetry: UnitHostTelemetry; limit?: number }) {
  const rows = typeof limit === "number" ? telemetry.items.slice(0, limit) : telemetry.items;
  return (
    <Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight text-slate-50">Unidades</h2><TonePill tone="neutral">{rows.length}</TonePill></div><div className="mt-4">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Host</th><th className="px-4 py-3">Ping</th><th className="px-4 py-3">Perda</th><th className="px-4 py-3">Latência</th><th className="px-4 py-3">Temp.</th><th className="px-4 py-3">Eventos</th><th className="px-4 py-3">Ativos</th></tr></TableHead><tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0"><TableCell><UnitName item={item} /></TableCell><TableCell><div className="font-medium text-slate-100">{item.partner.code}</div><div className="mt-1 max-w-[220px] text-xs text-slate-500">{item.partner.name}</div></TableCell><TableCell><div className="flex flex-wrap gap-2"><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                        {item.match.syncReady ? <TonePill tone="success">tag ok</TonePill> : null}
                      </div><div className="mt-2 max-w-[280px] truncate text-sm font-medium text-slate-100">
                        {item.match.hostName || item.match.host || "-"}
                      </div><div className="mt-1 text-xs text-slate-500">{item.match.integrationCode || "-"} · {item.match.confidence}%</div></TableCell><TableCell><TonePill tone={item.metrics.ping?.ok === false ? "critical" : item.metrics.ping?.ok ? "success" : "neutral"}>
                        {item.metrics.ping?.ok === false ? "down" : item.metrics.ping?.ok ? "up" : "-"}
                      </TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.lossPct, 3, 10)}>{formatPercent(item.metrics.lossPct)}</TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.latencyMs, 150, 700)}>{formatMs(item.metrics.latencyMs)}</TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.temperatureC, 55, 70)}>{formatTemperature(item.metrics.temperatureC)}</TonePill></TableCell><TableCell><TonePill tone={item.problems.length ? "attention" : "success"}>{item.problems.length}</TonePill>
                      {item.problems[0] ? <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{item.problems[0].name}</div> : null}
                    </TableCell><TableCell><div className="max-w-[220px] text-xs leading-5 text-slate-400">
                        {item.equipments.length ? item.equipments.slice(0, 3).map((equipment) => equipment.tag).join(", ") : "-"}
                      </div></TableCell></tr>
                ))}
              </tbody></DenseTable></TableShell>
        ) : (
          <EmptyState title="Sem unidades" description="Nenhuma unidade encontrada para o filtro atual." />
        )}
      </div></Surface>
  );
}

function Overview({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const priority = telemetry.items.slice(0, 6);
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]"><UnitsTable telemetry={{ ...telemetry, items: priority, counts: countsFromItems(priority) }} /><Surface className="p-5 sm:p-6"><h2 className="text-lg font-semibold tracking-tight text-slate-50">Sensores</h2><div className="mt-4 grid gap-3"><MetricCard label="Disponibilidade" value={`${telemetry.counts.online}/${telemetry.counts.units}`} tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"} /><MetricCard label="Perda média" value={formatPercent(telemetry.counts.avgLossPct)} tone={metricTone(telemetry.counts.avgLossPct, 3, 10)} /><MetricCard label="Latência média" value={formatMs(telemetry.counts.avgLatencyMs)} tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)} /><MetricCard label="Temperatura máx." value={formatTemperature(telemetry.counts.maxTemperatureC)} tone={metricTone(telemetry.counts.maxTemperatureC, 55, 70)} /></div></Surface></section>
  );
}

function PartnersTable({ rows }: { rows: PartnerRow[] }) {
  return (
    <Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight text-slate-50">Parceiros</h2><TonePill tone="neutral">{rows.length}</TonePill></div><div className="mt-4">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Unidades</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Eventos</th><th className="px-4 py-3">Telemetria</th><th className="px-4 py-3">Ações</th></tr></TableHead><tbody>
                {rows.map((row) => (
                  <tr key={row.partner.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/parceiros/${row.partner.id}`} className="font-semibold text-slate-50 hover:text-sky-100">{row.partner.code}</Link><div className="mt-1 max-w-[280px] text-sm text-slate-300">{row.partner.name}</div></TableCell><TableCell>{row.units}</TableCell><TableCell><div className="flex flex-wrap gap-1"><TonePill tone="success">{row.online} on</TonePill><TonePill tone={row.degraded ? "attention" : "neutral"}>{row.degraded} atenção</TonePill><TonePill tone={row.down ? "critical" : "neutral"}>{row.down} off</TonePill><TonePill tone={row.unmapped ? "subtle" : "neutral"}>{row.unmapped} sem vínculo</TonePill></div></TableCell><TableCell><TonePill tone={row.problems ? "attention" : "success"}>{row.problems}</TonePill></TableCell><TableCell><div className="text-sm text-slate-300">{formatMs(row.avgLatencyMs)}</div><div className="mt-1 text-xs text-slate-500">perda {formatPercent(row.avgLossPct)}</div></TableCell><TableCell><div className="flex flex-wrap gap-2"><Link href={`/parceiros/${row.partner.id}`} className="inline-flex h-9 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]">Abrir</Link><Link href={`/monitoramento?view=units&partner=${row.partner.id}`} className="inline-flex h-9 items-center rounded-[12px] border border-white/10 bg-transparent px-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.04]">Unidades</Link></div></TableCell></tr>
                ))}
              </tbody></DenseTable></TableShell>
        ) : (
          <EmptyState title="Sem parceiros" description="Nenhum parceiro encontrado para o filtro atual." />
        )}
      </div></Surface>
  );
}

function SensorsView({ telemetry }: { telemetry: UnitHostTelemetry }) {
  return (
    <div className="space-y-5"><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Ping online" value={`${telemetry.counts.online}/${telemetry.counts.units}`} tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"} /><MetricCard label="Perda média" value={formatPercent(telemetry.counts.avgLossPct)} tone={metricTone(telemetry.counts.avgLossPct, 3, 10)} /><MetricCard label="Latência média" value={formatMs(telemetry.counts.avgLatencyMs)} tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)} /><MetricCard label="Temperatura máx." value={formatTemperature(telemetry.counts.maxTemperatureC)} tone={metricTone(telemetry.counts.maxTemperatureC, 55, 70)} /></section><UnitsTable telemetry={telemetry} /></div>
  );
}

function EventsView({ telemetry, commandCenter }: { telemetry: UnitHostTelemetry; commandCenter: CommandCenter }) {
  const problems = telemetry.items.flatMap((item) => item.problems.map((problem) => ({ ...problem, unit: item.unit, partner: item.partner })));
  return (
    <div className="space-y-5"><Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight text-slate-50">Eventos Zabbix</h2><TonePill tone={problems.length ? "attention" : "success"}>{problems.length}</TonePill></div><div className="mt-4">
          {problems.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Ack</th><th className="px-4 py-3">Horário</th></tr></TableHead><tbody>
                  {problems.slice(0, 30).map((problem) => (
                    <tr key={`${problem.unit.id}-${problem.eventid}`} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/unidades/${problem.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">{problem.unit.code}</Link><div className="mt-1 text-xs text-slate-500">{problem.partner.name}</div></TableCell><TableCell><div className="max-w-[620px] font-medium leading-5 text-slate-50">{problem.name}</div><div className="mt-1 text-xs text-slate-500">{problem.eventid}</div></TableCell><TableCell><TonePill tone={severityTone(problem.severity)}>{problem.severity}</TonePill></TableCell><TableCell><TonePill tone={problem.acknowledged === "1" ? "success" : "attention"}>{problem.acknowledged === "1" ? "sim" : "não"}</TonePill></TableCell><TableCell className="text-slate-400">{formatEpoch(problem.clock)}</TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Sem eventos ativos" description="Nenhum problema ativo retornado pelo Zabbix." />
          )}
        </div></Surface><section className="grid gap-5 xl:grid-cols-2"><RecentList title="Ocorrências" href="/ocorrencias" items={commandCenter.recentOccurrences} kind="occurrence" /><RecentList title="Manutenções" href="/manutencoes" items={commandCenter.recentMaintenances} kind="maintenance" /></section></div>
  );
}

function RecentList({
  title,
  href,
  items,
  kind,
}: {
  title: string;
  href: string;
  items: Array<RecentOccurrence | RecentMaintenance>;
  kind: "occurrence" | "maintenance";
}) {
  return (
    <Surface className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h2><Link href={href} className="text-sm font-semibold text-sky-200 hover:text-white">Ver todas</Link></div><div className="mt-4 grid gap-2">
        {items.length ? items.slice(0, 6).map((item) => (
          <Link key={item.id} href={`/${kind === "occurrence" ? "ocorrencias" : "manutencoes"}/${item.id}`} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-3 transition hover:border-white/14 hover:bg-[#111820]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-50">{item.code} · {item.title}</div><div className="mt-1 truncate text-xs text-slate-500">{targetLabel(item)}</div></div><TonePill tone={"severity" in item && item.severity === "critical" ? "critical" : "attention"}>{"severity" in item ? item.severity : item.status}</TonePill></div></Link>
        )) : <EmptyState title="Sem registros" description="Nenhum registro recente." />}
      </div></Surface>
  );
}

function Sources({ telemetry, isAdmin }: { telemetry: UnitHostTelemetry; isAdmin: boolean }) {
  const failures = telemetry.sources.filter((source) => !source.ok);
  if (!failures.length && !isAdmin) return null;

  return (
    <Surface className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">
          {telemetry.sources.map((source) => (
            <TonePill key={source.id} tone={source.ok ? "success" : "attention"}>{source.code}: {source.ok ? "ok" : "alerta"}</TonePill>
          ))}
        </div>
        {isAdmin ? <Link href="/integracoes" className="text-sm font-semibold text-sky-200 hover:text-white">Integrações</Link> : null}
      </div></Surface>
  );
}

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/monitoramento");

  const [telemetry, commandCenter] = await Promise.all([
    readTelemetry(),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const params = await resolveSearchParams(searchParams);
  const filters: MonitorFilters = {
    q: readStringParam(params, "q"),
    health: readStringParam(params, "health", "all"),
    partner: readStringParam(params, "partner", "all"),
    sort: readStringParam(params, "sort", "risk"),
    view: normalizeMonitorView(readStringParam(params, "view", "overview")),
  };
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";
  const partners = partnersFromTelemetry(telemetry);
  const filteredTelemetry = filterTelemetry(telemetry, filters);
  const partnerRows = partnerRowsFromTelemetry(filteredTelemetry);

  return (
    <AppShell title="Monitoramento" subtitle="Hosts Zabbix, unidades e eventos ativos."><div className="nova-monitoring-page grid gap-5"><Summary telemetry={filteredTelemetry} commandCenter={commandCenter} /><Sources telemetry={telemetry} isAdmin={isAdmin} /><Tabs filters={filters} telemetry={filteredTelemetry} /><Filters filters={filters} partners={partners} count={filteredTelemetry.counts.units} />

      {filters.view === "overview" ? <Overview telemetry={filteredTelemetry} /> : null}
      {filters.view === "units" ? <UnitsTable telemetry={filteredTelemetry} /> : null}
      {filters.view === "partners" ? <PartnersTable rows={partnerRows} /> : null}
      {filters.view === "sensors" ? <SensorsView telemetry={filteredTelemetry} /> : null}
      {filters.view === "events" ? <EventsView telemetry={filteredTelemetry} commandCenter={commandCenter} /> : null}
          </div></AppShell>
  );
}
