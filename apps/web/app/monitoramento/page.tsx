import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  InlineStat,
  KpiTile,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  OperationsCommandDeck,
} from "@/components/operations-workspace";
import {
  getLegacyMonitorContextForUnits,
  type LegacyMonitorContextItem,
  type LegacyMonitorContextResult,
} from "@/lib/legacy-catalog";
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

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function emptyTelemetry(message = "Endpoint de telemetria ainda não disponível.") {
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

async function safeApiJson<T>(path: string, fallback: T) {
  try {
    return await apiJson<T>(path);
  } catch {
    return fallback;
  }
}

async function readTelemetry() {
  try {
    return await apiJson<UnitHostTelemetry>("/monitoring/unit-hosts");
  } catch (error) {
    return emptyTelemetry(error instanceof Error ? error.message : "Falha ao carregar telemetria.");
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatProblemClock(value: string) {
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
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} C`;
}

function cityLine(item: UnitHostTelemetryItem) {
  return [item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "Local não informado";
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

function targetLabel(item: RecentOccurrence | RecentMaintenance) {
  if (item.equipment) return `${item.equipment.tag} · ${item.equipment.name}`;
  if (item.unit) return `${item.unit.code} · ${item.unit.name}`;
  if (item.partner) return `${item.partner.code} · ${item.partner.name}`;
  return "Sem vínculo";
}

function legacyContextFor(
  contexts: LegacyMonitorContextResult,
  item: UnitHostTelemetryItem,
) {
  return contexts.items[item.unit.id];
}

function operationalPressure(item: UnitHostTelemetryItem, context?: LegacyMonitorContextItem) {
  return pressureForItem(item) + (context?.hasBackup ? 8 : 0) + (context?.starlinks ? 10 : 0);
}

function firstPhones(context?: LegacyMonitorContextItem) {
  if (!context?.phones?.length) return "Sem telefone legado";
  return context.phones.slice(0, 2).join(" · ");
}

function contextBadges(context?: LegacyMonitorContextItem) {
  if (!context) return [];

  return [
    context.hasBackup ? { label: `${context.backupCount} backup`, tone: "attention" } : null,
    context.starlinks ? { label: `${context.starlinks} starlink`, tone: "info" } : null,
    context.hasMacOnu ? { label: `${context.macOnuCount} mac/onu`, tone: "violet" } : null,
    context.technologies[0] ? { label: context.technologies[0], tone: "subtle" } : null,
    context.contracts[0] ? { label: `IXC ${context.contracts[0]}`, tone: "neutral" } : null,
  ].filter((item): item is { label: string; tone: string } => Boolean(item));
}

type MonitorFilters = {
  q: string;
  health: string;
  partner: string;
  sort: string;
  view: MonitorView;
};

type MonitorView = "overview" | "units" | "partners" | "sensors" | "events";

type PartnerMonitorRow = {
  partner: UnitHostTelemetryItem["partner"];
  units: number;
  matchedHosts: number;
  legacyMatchedUnits: number;
  down: number;
  degraded: number;
  problems: number;
  pressure: number;
  avgLatencyMs: number | null;
  avgLossPct: number | null;
  maxTemperatureC: number | null;
  phones: string[];
  technologies: string[];
  contracts: string[];
  backupUnits: number;
  starlinkUnits: number;
  macOnuUnits: number;
  noActioningUnits: number;
  hotspots: Array<{
    id: string;
    code: string;
    name: string;
    health: UnitHostTelemetryItem["health"];
    pressure: number;
  }>;
};

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

function compactList(values: string[], fallback: string, limit = 3) {
  if (!values.length) return fallback;
  return values.slice(0, limit).join(" · ");
}

function sortItems(items: UnitHostTelemetryItem[], sort: string) {
  const sorted = items.slice();

  if (sort === "latency") {
    return sorted.sort((a, b) => (b.metrics.latencyMs ?? -1) - (a.metrics.latencyMs ?? -1));
  }

  if (sort === "loss") {
    return sorted.sort((a, b) => (b.metrics.lossPct ?? -1) - (a.metrics.lossPct ?? -1));
  }

  if (sort === "partner") {
    return sorted.sort((a, b) => a.partner.code.localeCompare(b.partner.code) || a.unit.code.localeCompare(b.unit.code));
  }

  if (sort === "code") {
    return sorted.sort((a, b) => a.unit.code.localeCompare(b.unit.code));
  }

  return sorted.sort((a, b) => pressureForItem(b) - pressureForItem(a) || a.unit.code.localeCompare(b.unit.code));
}

function filterTelemetry(telemetry: UnitHostTelemetry, filters: MonitorFilters) {
  const query = filters.q.toLowerCase();
  let items = telemetry.items.filter((item) => {
    const matchesQuery = query ? itemSearchText(item).includes(query) : true;
    const matchesPartner = filters.partner && filters.partner !== "all" ? item.partner.id === filters.partner : true;
    const matchesHealth =
      !filters.health || filters.health === "all"
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

  items = sortItems(items, filters.sort);

  return {
    ...telemetry,
    counts: countsFromItems(items),
    items,
  };
}

function partnersFromTelemetry(telemetry: UnitHostTelemetry) {
  const partners = new Map<string, UnitHostTelemetryItem["partner"]>();
  for (const item of telemetry.items) {
    partners.set(item.partner.id, item.partner);
  }
  return Array.from(partners.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function buildPartnerRows(
  telemetry: UnitHostTelemetry,
  contexts: LegacyMonitorContextResult,
): PartnerMonitorRow[] {
  const rows = new Map<
    string,
    PartnerMonitorRow & {
      latencyValues: number[];
      lossValues: number[];
      temperatureValues: number[];
    }
  >();

  for (const item of telemetry.items) {
    const current = rows.get(item.partner.id) || {
      partner: item.partner,
      units: 0,
      matchedHosts: 0,
      legacyMatchedUnits: 0,
      down: 0,
      degraded: 0,
      problems: 0,
      pressure: 0,
      avgLatencyMs: null,
      avgLossPct: null,
      maxTemperatureC: null,
      phones: [],
      technologies: [],
      contracts: [],
      backupUnits: 0,
      starlinkUnits: 0,
      macOnuUnits: 0,
      noActioningUnits: 0,
      hotspots: [],
      latencyValues: [],
      lossValues: [],
      temperatureValues: [],
    };

    const context = legacyContextFor(contexts, item);
    const pressure = operationalPressure(item, context);

    current.units += 1;
    current.matchedHosts += item.match.status === "matched" ? 1 : 0;
    current.legacyMatchedUnits += context?.matched ? 1 : 0;
    current.down += item.health === "down" ? 1 : 0;
    current.degraded += item.health === "degraded" ? 1 : 0;
    current.problems += item.problems.length;
    current.pressure += pressure;

    if (typeof item.metrics.latencyMs === "number") {
      current.latencyValues.push(item.metrics.latencyMs);
    }
    if (typeof item.metrics.lossPct === "number") {
      current.lossValues.push(item.metrics.lossPct);
    }
    if (typeof item.metrics.temperatureC === "number") {
      current.temperatureValues.push(item.metrics.temperatureC);
    }

    if (context) {
      current.phones = Array.from(new Set([...current.phones, ...context.phones]));
      current.technologies = Array.from(new Set([...current.technologies, ...context.technologies]));
      current.contracts = Array.from(new Set([...current.contracts, ...context.contracts]));
      current.backupUnits += context.hasBackup ? 1 : 0;
      current.starlinkUnits += context.starlinks ? 1 : 0;
      current.macOnuUnits += context.hasMacOnu ? 1 : 0;
    }

    if (
      item.health !== "online" &&
      item.health !== "unknown" &&
      (!context || !context.phones.length)
    ) {
      current.noActioningUnits += 1;
    }

    current.hotspots.push({
      id: item.unit.id,
      code: item.unit.code,
      name: item.unit.name,
      health: item.health,
      pressure,
    });

    rows.set(item.partner.id, current);
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      avgLatencyMs: row.latencyValues.length
        ? Math.round(
            row.latencyValues.reduce((sum, item) => sum + item, 0) /
              row.latencyValues.length,
          )
        : null,
      avgLossPct: row.lossValues.length
        ? Number(
            (
              row.lossValues.reduce((sum, item) => sum + item, 0) /
              row.lossValues.length
            ).toFixed(2),
          )
        : null,
      maxTemperatureC: row.temperatureValues.length
        ? Math.max(...row.temperatureValues)
        : null,
      hotspots: row.hotspots
        .sort((a, b) => b.pressure - a.pressure || a.code.localeCompare(b.code))
        .slice(0, 3),
    }))
    .sort((a, b) => b.pressure - a.pressure || a.partner.code.localeCompare(b.partner.code));
}

function operationPressure(commandCenter: CommandCenter, telemetry: UnitHostTelemetry) {
  return (
    telemetry.counts.down * 4 +
    telemetry.counts.degraded * 2 +
    telemetry.counts.withProblems * 2 +
    commandCenter.metrics.criticalOpenOccurrences * 3 +
    commandCenter.metrics.overdueMaintenances * 2
  );
}

function NocFilters({
  filters,
  partners,
  resultCount,
}: {
  filters: MonitorFilters;
  partners: Array<UnitHostTelemetryItem["partner"]>;
  resultCount: number;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Mesa NOC"
        title="Recorte operacional"
        description="Filtre por parceiro, unidade, host, ativo ou estado. A URL preserva a mesma visão para retorno rápido durante o turno."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TonePill tone="neutral">{resultCount} unidade(s)</TonePill>
            <Link
              href="/monitoramento"
              className="inline-flex h-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Limpar
            </Link>
          </div>
        }
        compact
      />

      <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_190px_190px_auto]">
        <input type="hidden" name="view" value={filters.view} />
        <label className="grid gap-2">
          <FieldLabel>Busca</FieldLabel>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Unidade, parceiro, host, serial ou cidade"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Parceiro</FieldLabel>
          <select name="partner" defaultValue={filters.partner || "all"}>
            <option value="all">Todos os parceiros</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.code} · {partner.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <FieldLabel>Estado</FieldLabel>
          <select name="health" defaultValue={filters.health || "all"}>
            <option value="all">Todos</option>
            <option value="down">Offline</option>
            <option value="degraded">Atenção</option>
            <option value="online">Online</option>
            <option value="unknown">Sem item</option>
            <option value="problem">Com problema</option>
            <option value="high-latency">Alta latência</option>
            <option value="high-loss">Perda alta</option>
            <option value="temperature">Temperatura alta</option>
            <option value="unmapped">Sem vínculo</option>
          </select>
        </label>

        <label className="grid gap-2">
          <FieldLabel>Ordenação</FieldLabel>
          <select name="sort" defaultValue={filters.sort || "risk"}>
            <option value="risk">Maior risco</option>
            <option value="latency">Maior latência</option>
            <option value="loss">Maior perda</option>
            <option value="partner">Parceiro</option>
            <option value="code">Código</option>
          </select>
        </label>

        <button className="xl:self-end">Aplicar</button>
      </form>
    </Surface>
  );
}

function MonitorTabs({
  filters,
  telemetry,
}: {
  filters: MonitorFilters;
  telemetry: UnitHostTelemetry;
}) {
  const partnerCount = new Set(telemetry.items.map((item) => item.partner.id)).size;
  const sensorItems =
    telemetry.items.filter((item) => item.metrics.ping || item.metrics.lossPct !== null || item.metrics.latencyMs !== null || item.metrics.temperatureC !== null).length;
  const events = telemetry.items.reduce((sum, item) => sum + item.problems.length, 0);
  const tabs: Array<{ view: MonitorView; label: string; count: number | string; hint: string }> = [
    { view: "overview", label: "Visão geral", count: telemetry.counts.units, hint: "saúde, cobertura e pressão" },
    { view: "units", label: "Unidades", count: telemetry.items.length, hint: "host, parceiro e ativos" },
    { view: "partners", label: "Parceiros", count: partnerCount, hint: "acionamento e contingência" },
    { view: "sensors", label: "Sensores", count: sensorItems, hint: "ping, perda, latência e temperatura" },
    { view: "events", label: "Eventos", count: events, hint: "problemas Zabbix e rotina interna" },
  ];

  return (
    <Surface className="p-2">
      <nav className="grid gap-2 md:grid-cols-5" aria-label="Visões de monitoramento">
        {tabs.map((tab) => {
          const active = filters.view === tab.view;
          return (
            <Link
              key={tab.view}
              href={monitorHref(filters, { view: tab.view })}
              aria-current={active ? "page" : undefined}
              className={cx(
                "rounded-[16px] border px-4 py-3 transition",
                active
                  ? "border-sky-500/30 bg-sky-500/[0.12] text-sky-50"
                  : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{tab.label}</span>
                <TonePill tone={active ? "info" : "neutral"}>{tab.count}</TonePill>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{tab.hint}</div>
            </Link>
          );
        })}
      </nav>
    </Surface>
  );
}

function HostHero({
  telemetry,
  commandCenter,
  isAdmin,
}: {
  telemetry: UnitHostTelemetry;
  commandCenter: CommandCenter;
  isAdmin: boolean;
}) {
  const pressure = operationPressure(commandCenter, telemetry);
  const sourceFailures = telemetry.sources.filter((item) => !item.ok).length;
  const tone = telemetry.counts.down ? "critical" : telemetry.counts.degraded || telemetry.counts.ambiguous ? "attention" : "success";

  return (
    <Surface className="p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TonePill tone={tone}>{telemetry.counts.down ? "incidente" : telemetry.counts.degraded ? "atenção" : "operacional"}</TonePill>
            <TonePill tone="neutral">leitura {formatDateTime(telemetry.generatedAt)}</TonePill>
            <TonePill tone={sourceFailures ? "attention" : "success"}>{telemetry.sources.length} fonte(s) Zabbix</TonePill>
          </div>
          <h2 className="mt-4 max-w-5xl text-[30px] font-semibold leading-tight tracking-tight text-slate-50 sm:text-[40px]">
            Estado dos hosts vinculados às unidades atendidas.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
            Esta tela observa o comportamento dos hosts que representam as unidades cadastradas. Ping,
            perda, latência, temperatura e problemas vêm do host correspondente; integração e
            reconciliação ficam como apoio, sem tomar o foco da leitura.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/operacao/fila"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
            >
              Abrir fila
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Abrir painel
            </Link>
            {isAdmin ? (
              <Link
                href="/integracoes"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Ajustar integrações
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/reconciliacao-central"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Abrir reconciliação
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 rounded-[18px] border border-white/[0.08] bg-[#0a0f15] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cobertura Zabbix</div>
              <div className="mt-2 text-4xl font-semibold tracking-tight text-slate-50">
                {telemetry.counts.units ? Math.round((telemetry.counts.matched / telemetry.counts.units) * 100) : 0}%
              </div>
            </div>
            <TonePill tone={pressure ? "attention" : "success"}>{pressure} pressão</TonePill>
          </div>

          <div className="grid gap-2">
            <InlineStat label="Unidades com host" value={telemetry.counts.matched} tone="success" />
            <InlineStat label="Sem host" value={telemetry.counts.unmapped} tone={telemetry.counts.unmapped ? "attention" : "neutral"} />
            <InlineStat label="Offline" value={telemetry.counts.down} tone={telemetry.counts.down ? "critical" : "neutral"} />
            <InlineStat label="Em atenção" value={telemetry.counts.degraded} tone={telemetry.counts.degraded ? "attention" : "neutral"} />
            <InlineStat label="Perda média" value={formatPercent(telemetry.counts.avgLossPct)} tone={(telemetry.counts.avgLossPct ?? 0) >= 3 ? "attention" : "neutral"} />
            <InlineStat label="Latência média" value={formatMs(telemetry.counts.avgLatencyMs)} tone={(telemetry.counts.avgLatencyMs ?? 0) >= 150 ? "attention" : "neutral"} />
          </div>

          <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Leitura conectada</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              {commandCenter.metrics.openOccurrences} ocorrência(s) aberta(s) · {commandCenter.metrics.overdueMaintenances} manutenção(ões) vencida(s) · {telemetry.counts.syncReady} host(s) prontos para sync seguro · {sourceFailures} fonte(s) com falha.
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function NocPulseBoard({
  telemetry,
  commandCenter,
  contexts,
}: {
  telemetry: UnitHostTelemetry;
  commandCenter: CommandCenter;
  contexts: LegacyMonitorContextResult;
}) {
  const ranked = telemetry.items
    .map((item) => ({
      item,
      context: legacyContextFor(contexts, item),
    }))
    .sort(
      (a, b) =>
        operationalPressure(b.item, b.context) -
          operationalPressure(a.item, a.context) ||
        a.item.unit.code.localeCompare(b.item.unit.code),
    );
  const hotspots = ranked.slice(0, 5);
  const sourceFailures = telemetry.sources.filter((source) => !source.ok);
  const missingActioning = ranked.filter(
    ({ item, context }) =>
      item.health !== "online" &&
      item.health !== "unknown" &&
      (!context || !context.phones.length),
  ).length;
  const pressure = operationPressure(commandCenter, telemetry);
  const pressureTone =
    pressure >= 10 ? "critical" : pressure >= 4 ? "attention" : "success";

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Mesa NOC"
          title="Prioridade agora"
          description="Primeira leitura do turno: unidade, parceiro, host, contato e sensor crítico no mesmo bloco."
          actions={<TonePill tone={pressureTone}>{pressure} pressão</TonePill>}
          compact
        />

        <div className="mt-5 grid gap-3">
          {hotspots.length ? (
            hotspots.map(({ item, context }, index) => {
              const score = Math.round(operationalPressure(item, context));
              const leadMetric =
                item.health === "down"
                  ? "host offline"
                  : item.problems.length
                    ? `${item.problems.length} problema(s)`
                    : (item.metrics.lossPct ?? 0) >= 3
                      ? `loss ${formatPercent(item.metrics.lossPct)}`
                      : (item.metrics.latencyMs ?? 0) >= 150
                        ? `latência ${formatMs(item.metrics.latencyMs)}`
                        : item.health === "ambiguous"
                          ? "vínculo ambíguo"
                          : "observação";

              return (
                <Link
                  key={`noc-pulse-${item.unit.id}`}
                  href={`/unidades/${item.unit.id}`}
                  className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 transition hover:border-sky-400/22 hover:bg-[#111922] lg:grid-cols-[34px_minmax(0,1fr)_minmax(180px,0.45fr)] lg:items-center"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-50">
                        {item.unit.code} · {item.unit.name}
                      </span>
                      <TonePill tone={healthTone(item.health)}>
                        {healthLabel(item.health)}
                      </TonePill>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item.partner.name} · {cityLine(item)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {contextBadges(context).slice(0, 4).map((badge) => (
                        <TonePill
                          key={`pulse-${item.unit.id}-${badge.label}`}
                          tone={badge.tone}
                        >
                          {badge.label}
                        </TonePill>
                      ))}
                      {!context?.phones.length ? (
                        <TonePill tone="subtle">sem telefone legado</TonePill>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 lg:justify-items-end">
                    <TonePill
                      tone={
                        score >= 100
                          ? "critical"
                          : score >= 45
                            ? "attention"
                            : "success"
                      }
                    >
                      {score} pts
                    </TonePill>
                    <div className="max-w-[260px] truncate text-sm font-medium text-slate-200">
                      {leadMetric}
                    </div>
                    <div className="max-w-[260px] truncate text-xs text-slate-500">
                      {item.match.hostName || item.match.host || "sem host"}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <EmptyState
              title="Sem unidade na mesa"
              description="Quando houver host vinculado ou contexto legado, as prioridades aparecem aqui."
            />
          )}
        </div>
      </Surface>

      <div className="grid gap-5">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Sensores"
            title="Sinais do parque"
            description="Resumo curto para decidir se o problema é disponibilidade, perda, latência ou temperatura."
            compact
          />
          <div className="mt-4 grid gap-3">
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Disponibilidade
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-50">
                    {telemetry.counts.online}/{telemetry.counts.units}
                  </div>
                </div>
                <TonePill
                  tone={
                    telemetry.counts.down
                      ? "critical"
                      : telemetry.counts.degraded
                        ? "attention"
                        : "success"
                  }
                >
                  {telemetry.counts.down
                    ? `${telemetry.counts.down} off`
                    : telemetry.counts.degraded
                      ? `${telemetry.counts.degraded} atenção`
                      : "estável"}
                </TonePill>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Latência média
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-50">
                  {formatMs(telemetry.counts.avgLatencyMs)}
                </div>
              </div>
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Perda média
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-50">
                  {formatPercent(telemetry.counts.avgLossPct)}
                </div>
              </div>
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Temperatura máx.
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-50">
                  {formatTemperature(telemetry.counts.maxTemperatureC)}
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Cobertura"
            title="Vínculo e acionamento"
            description="O painel separa problema técnico de falta de contato ou vínculo inseguro."
            compact
          />
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
              <span className="text-sm text-slate-400">Hosts vinculados</span>
              <TonePill tone={telemetry.counts.unmapped ? "attention" : "success"}>
                {telemetry.counts.matched}/{telemetry.counts.units}
              </TonePill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
              <span className="text-sm text-slate-400">Sem acionamento claro</span>
              <TonePill tone={missingActioning ? "critical" : "success"}>
                {missingActioning}
              </TonePill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
              <span className="text-sm text-slate-400">Fontes Zabbix</span>
              <TonePill tone={sourceFailures.length ? "attention" : "success"}>
                {sourceFailures.length
                  ? `${sourceFailures.length} alerta(s)`
                  : "ok"}
              </TonePill>
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}

function HostTelemetryTable({
  telemetry,
  contexts,
}: {
  telemetry: UnitHostTelemetry;
  contexts: LegacyMonitorContextResult;
}) {
  const rows = telemetry.items
    .slice()
    .sort((a, b) => {
      const weight = { down: 0, degraded: 1, ambiguous: 2, unmapped: 3, unknown: 4, online: 5 };
      return weight[a.health] - weight[b.health] || pressureForItem(b) - pressureForItem(a) || a.unit.code.localeCompare(b.unit.code);
    });

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Inventário monitorado"
        title="Unidades, hosts e sensores"
        description="Leitura densa para abrir a unidade certa: estado, host, perda, latência, temperatura, problema ativo e ativos vinculados."
        actions={<TonePill tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"}>{rows.length} unidades</TonePill>}
        compact
      />

      <div className="mt-4">
        {rows.length ? (
          <TableShell>
            <DenseTable>
              <TableHead>
                <tr>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3">Host Zabbix</th>
                  <th className="px-4 py-3">Acionamento</th>
                  <th className="px-4 py-3">Ping</th>
                  <th className="px-4 py-3">Loss</th>
                  <th className="px-4 py-3">Latência</th>
                  <th className="px-4 py-3">Temp.</th>
                  <th className="px-4 py-3">Problemas</th>
                  <th className="px-4 py-3">Ativos</th>
                </tr>
              </TableHead>
              <tbody>
                {rows.map((item) => {
                  const context = legacyContextFor(contexts, item);

                  return (
                  <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0">
                    <TableCell>
                      <Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                        {item.unit.code}
                      </Link>
                      <div className="mt-1 max-w-[260px] text-sm text-slate-300">{item.unit.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{cityLine(item)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-100">{item.partner.code}</div>
                      <div className="mt-1 max-w-[220px] text-xs text-slate-500">{item.partner.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                        {item.match.syncReady ? <TonePill tone="success">tag ok</TonePill> : null}
                      </div>
                      <div className="mt-2 max-w-[280px] truncate text-sm font-medium text-slate-100">
                        {item.match.hostName || item.match.host || "Sem host identificado"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.match.integrationCode ? `${item.match.integrationCode} · ${item.match.confidence}%` : `${item.match.candidates} candidato(s)`}
                      </div>
                      {item.match.matchedBy.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.match.matchedBy.slice(0, 3).map((reason) => (
                            <span key={reason} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[280px] text-sm text-slate-300">
                        {firstPhones(context)}
                      </div>
                      {context ? (
                        <div className="mt-2 flex max-w-[280px] flex-wrap gap-1">
                          {contextBadges(context).slice(0, 4).map((badge) => (
                            <TonePill key={`${item.unit.id}-${badge.label}`} tone={badge.tone}>
                              {badge.label}
                            </TonePill>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">sem match legado</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <TonePill tone={item.metrics.ping?.ok === false ? "critical" : item.metrics.ping?.ok ? "success" : "neutral"}>
                        {item.metrics.ping?.ok === null || !item.metrics.ping ? "-" : item.metrics.ping.ok ? "up" : "down"}
                      </TonePill>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={metricTone(item.metrics.lossPct, 3, 10)}>{formatPercent(item.metrics.lossPct)}</TonePill>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={metricTone(item.metrics.latencyMs, 150, 700)}>{formatMs(item.metrics.latencyMs)}</TonePill>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={metricTone(item.metrics.temperatureC, 55, 70)}>{formatTemperature(item.metrics.temperatureC)}</TonePill>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={item.problems.length ? "attention" : "success"}>{item.problems.length}</TonePill>
                      {item.problems[0] ? (
                        <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{item.problems[0].name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[240px] text-xs leading-5 text-slate-400">
                        {item.equipments.length
                          ? item.equipments.slice(0, 3).map((equipment) => equipment.tag).join(", ")
                          : "Sem equipamento"}
                      </div>
                    </TableCell>
                  </tr>
                  );
                })}
              </tbody>
            </DenseTable>
          </TableShell>
        ) : (
          <EmptyState
            title="Nenhuma unidade monitorada"
            description="Cadastre unidades ativas e configure uma integração Zabbix autenticada para iniciar a leitura."
          />
        )}
      </div>
    </Surface>
  );
}

function MetricLanes({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const latencyRows = telemetry.items
    .filter((item) => typeof item.metrics.latencyMs === "number")
    .sort((a, b) => (b.metrics.latencyMs || 0) - (a.metrics.latencyMs || 0))
    .slice(0, 6);
  const lossRows = telemetry.items
    .filter((item) => typeof item.metrics.lossPct === "number")
    .sort((a, b) => (b.metrics.lossPct || 0) - (a.metrics.lossPct || 0))
    .slice(0, 6);
  const maxLatency = Math.max(100, ...latencyRows.map((item) => item.metrics.latencyMs || 0));
  const maxLoss = Math.max(1, ...lossRows.map((item) => item.metrics.lossPct || 0));

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <MetricLane
        eyebrow="Latência"
        title="Maiores tempos de resposta"
        rows={latencyRows}
        max={maxLatency}
        getValue={(item) => item.metrics.latencyMs || 0}
        formatValue={(value) => formatMs(value)}
        tone={(value) => metricTone(value, 150, 700)}
      />
      <MetricLane
        eyebrow="Perda"
        title="Maior perda ICMP"
        rows={lossRows}
        max={maxLoss}
        getValue={(item) => item.metrics.lossPct || 0}
        formatValue={(value) => formatPercent(value)}
        tone={(value) => metricTone(value, 3, 10)}
      />
    </section>
  );
}

function MetricLane({
  eyebrow,
  title,
  rows,
  max,
  getValue,
  formatValue,
  tone,
}: {
  eyebrow: string;
  title: string;
  rows: UnitHostTelemetryItem[];
  max: number;
  getValue: (item: UnitHostTelemetryItem) => number;
  formatValue: (value: number) => string;
  tone: (value: number) => string;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro eyebrow={eyebrow} title={title} compact />
      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.map((item) => {
            const value = getValue(item);
            const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));
            const bar =
              tone(value) === "critical"
                ? "bg-rose-400"
                : tone(value) === "attention"
                  ? "bg-amber-300"
                  : "bg-emerald-300";

            return (
              <div key={`${eyebrow}-${item.unit.id}`} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-50">{item.unit.code} · {item.unit.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{item.partner.name}</div>
                  </div>
                  <TonePill tone={tone(value)}>{formatValue(value)}</TonePill>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={cx("h-full rounded-full", bar)} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState title="Sem item compatível" description="Nenhum item Zabbix reconhecido para esta métrica nas unidades vinculadas." />
        )}
      </div>
    </Surface>
  );
}

function formatItemClock(value: string | null | undefined) {
  if (!value) return "-";
  return formatProblemClock(value);
}

function sourceCell(source: UnitHostTelemetryItem["metrics"]["sources"][string], value: string, tone: string) {
  if (!source) {
    return <span className="text-sm text-slate-500">-</span>;
  }

  return (
    <div className="min-w-[150px]">
      <TonePill tone={tone}>{value}</TonePill>
      <div className="mt-1 max-w-[220px] truncate text-xs text-slate-500" title={source.key}>
        {source.key}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-600">{formatItemClock(source.lastClock)}</div>
    </div>
  );
}

function SensorChannelTable({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const rows = telemetry.items
    .filter((item) => item.metrics.ping || item.metrics.lossPct !== null || item.metrics.latencyMs !== null || item.metrics.temperatureC !== null)
    .sort((a, b) => pressureForItem(b) - pressureForItem(a) || a.unit.code.localeCompare(b.unit.code));

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Itens Zabbix"
        title="Canais lidos por unidade"
        description="A unidade é a âncora. Cada coluna mostra o item do host que está alimentando ping, perda, latência e temperatura."
        actions={<TonePill tone="neutral">{rows.length} unidade(s)</TonePill>}
        compact
      />

      <div className="mt-4">
        {rows.length ? (
          <TableShell>
            <DenseTable>
              <TableHead>
                <tr>
                  <th className="px-4 py-3">Unidade / host</th>
                  <th className="px-4 py-3">Ping</th>
                  <th className="px-4 py-3">Perda</th>
                  <th className="px-4 py-3">Latência</th>
                  <th className="px-4 py-3">Temperatura</th>
                </tr>
              </TableHead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`sensor-${item.unit.id}`} className="border-b border-white/6 last:border-b-0">
                    <TableCell>
                      <Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                        {item.unit.code} · {item.unit.name}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">{item.partner.name}</div>
                      <div className="mt-2 max-w-[260px] truncate text-sm text-slate-300">
                        {item.match.hostName || item.match.host || "Sem host confiável"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sourceCell(
                        item.metrics.sources.ping,
                        item.metrics.ping?.ok === null || !item.metrics.ping ? "-" : item.metrics.ping.ok ? "up" : "down",
                        item.metrics.ping?.ok === false ? "critical" : item.metrics.ping?.ok ? "success" : "neutral",
                      )}
                    </TableCell>
                    <TableCell>
                      {sourceCell(item.metrics.sources.loss, formatPercent(item.metrics.lossPct), metricTone(item.metrics.lossPct, 3, 10))}
                    </TableCell>
                    <TableCell>
                      {sourceCell(item.metrics.sources.latency, formatMs(item.metrics.latencyMs), metricTone(item.metrics.latencyMs, 150, 700))}
                    </TableCell>
                    <TableCell>
                      {sourceCell(
                        item.metrics.sources.temperature,
                        formatTemperature(item.metrics.temperatureC),
                        metricTone(item.metrics.temperatureC, 55, 70),
                      )}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </DenseTable>
          </TableShell>
        ) : (
          <EmptyState
            title="Nenhum item de sensor reconhecido"
            description="Quando os hosts vinculados tiverem itens ICMP, latência ou temperatura reconhecíveis, eles aparecem aqui."
          />
        )}
      </div>
    </Surface>
  );
}

function MiniBars({
  values,
  warning,
  critical,
  formatter,
}: {
  values: number[];
  warning: number;
  critical: number;
  formatter: (value: number | null) => string;
}) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)
    .slice(0, 18);
  const max = Math.max(critical, ...sorted, 1);

  if (!sorted.length) {
    return <div className="mt-4 rounded-[14px] border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">sem amostra</div>;
  }

  return (
    <div className="mt-4 flex h-20 items-end gap-1.5">
      {sorted.map((value, index) => {
        const height = Math.max(10, Math.round((value / max) * 100));
        const tone = value >= critical ? "bg-rose-400" : value >= warning ? "bg-amber-300" : "bg-emerald-300";

        return (
          <div
            key={`${value}-${index}`}
            title={formatter(value)}
            className="flex flex-1 items-end rounded-full bg-white/[0.045]"
          >
            <div className={cx("w-full rounded-full", tone)} style={{ height: `${height}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function SensorCard({
  label,
  value,
  detail,
  tone,
  values,
  warning,
  critical,
  formatter,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  values: number[];
  warning: number;
  critical: number;
  formatter: (value: number | null) => string;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <TonePill tone={tone}>{tone === "neutral" ? "base" : tone}</TonePill>
      </div>
      <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-50">{value}</div>
      <div className="mt-1 text-sm leading-5 text-slate-400">{detail}</div>
      <MiniBars values={values} warning={warning} critical={critical} formatter={formatter} />
    </div>
  );
}

function SensorBoard({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const pingItems = telemetry.items.filter((item) => item.metrics.ping);
  const pingUp = pingItems.filter((item) => item.metrics.ping?.ok).length;
  const availability = pingItems.length ? Math.round((pingUp / pingItems.length) * 100) : null;
  const lossValues = telemetry.items
    .map((item) => item.metrics.lossPct)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  const latencyValues = telemetry.items
    .map((item) => item.metrics.latencyMs)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  const temperatureValues = telemetry.items
    .map((item) => item.metrics.temperatureC)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SensorCard
        label="Disponibilidade ICMP"
        value={availability === null ? "-" : `${availability}%`}
        detail={`${pingUp}/${pingItems.length} host(s) respondendo ping`}
        tone={availability === null ? "neutral" : availability < 90 ? "critical" : availability < 98 ? "attention" : "success"}
        values={pingItems.map((item) => (item.metrics.ping?.ok ? 0 : 100))}
        warning={1}
        critical={100}
        formatter={(value) => (value ? "offline" : "online")}
      />
      <SensorCard
        label="Perda ICMP"
        value={formatPercent(telemetry.counts.avgLossPct)}
        detail={`${lossValues.length} item(ns) icmppingloss reconhecidos`}
        tone={metricTone(telemetry.counts.avgLossPct, 3, 10)}
        values={lossValues}
        warning={3}
        critical={10}
        formatter={formatPercent}
      />
      <SensorCard
        label="Latência"
        value={formatMs(telemetry.counts.avgLatencyMs)}
        detail={`${latencyValues.length} item(ns) de tempo de resposta`}
        tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)}
        values={latencyValues}
        warning={150}
        critical={700}
        formatter={formatMs}
      />
      <SensorCard
        label="Temperatura"
        value={formatTemperature(telemetry.counts.maxTemperatureC)}
        detail={`${temperatureValues.length} sensor(es) térmicos encontrados`}
        tone={metricTone(telemetry.counts.maxTemperatureC, 55, 70)}
        values={temperatureValues}
        warning={55}
        critical={70}
        formatter={formatTemperature}
      />
    </section>
  );
}

function HealthBoard({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const buckets = [
    { label: "Online", value: telemetry.counts.online, tone: "success" },
    { label: "Atenção", value: telemetry.counts.degraded, tone: "attention" },
    { label: "Offline", value: telemetry.counts.down, tone: "critical" },
    { label: "Sem item", value: telemetry.items.filter((item) => item.health === "unknown").length, tone: "neutral" },
    { label: "Sem vínculo", value: telemetry.counts.unmapped + telemetry.counts.ambiguous, tone: "subtle" },
  ];
  const total = Math.max(1, telemetry.counts.units);
  const sourceFailures = telemetry.sources.filter((source) => !source.ok);

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Estado geral"
        title="Distribuição do parque monitorado"
        description="A leitura combina host Zabbix, problemas ativos e thresholds simples de perda, latência e temperatura."
        actions={<TonePill tone={sourceFailures.length ? "attention" : "success"}>{sourceFailures.length ? "fonte com alerta" : "fontes ok"}</TonePill>}
        compact
      />

      <div className="mt-5 grid gap-3">
        {buckets.map((bucket) => {
          const width = Math.round((bucket.value / total) * 100);
          return (
            <div key={bucket.label} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_72px] sm:items-center">
              <div className="text-sm font-semibold text-slate-200">{bucket.label}</div>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.055]">
                <div
                  className={cx(
                    "h-full rounded-full",
                    bucket.tone === "critical"
                      ? "bg-rose-400"
                      : bucket.tone === "attention"
                        ? "bg-amber-300"
                        : bucket.tone === "success"
                          ? "bg-emerald-300"
                          : "bg-slate-500",
                  )}
                  style={{ width: `${Math.max(2, width)}%` }}
                />
              </div>
              <div className="text-right text-sm text-slate-400">{bucket.value}</div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function PartnerPulse({ rows }: { rows: PartnerMonitorRow[] }) {
  const partners = rows.slice(0, 8);

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Parceiros"
        title="Pressão por responsável"
        description="Agrupa unidades por parceiro com contexto de acionamento para decidir quem chamar primeiro."
        compact
      />

      <div className="mt-4 grid gap-2">
        {partners.length ? (
          partners.map((item) => (
            <div key={item.partner.id} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-50">{item.partner.code} · {item.partner.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.units} unidade(s) · {compactList(item.phones, "sem telefone legado", 2)}
                  </div>
                </div>
                <TonePill tone={item.down ? "critical" : item.degraded ? "attention" : "success"}>
                  {item.down ? `${item.down} off` : item.degraded ? `${item.degraded} atenção` : "ok"}
                </TonePill>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <TonePill tone="neutral">{item.problems} problema(s)</TonePill>
                {item.backupUnits ? <TonePill tone="attention">{item.backupUnits} backup</TonePill> : null}
                {item.starlinkUnits ? <TonePill tone="info">{item.starlinkUnits} starlink</TonePill> : null}
                {item.noActioningUnits ? <TonePill tone="critical">{item.noActioningUnits} sem contato</TonePill> : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyState title="Sem parceiros no recorte" description="Ajuste filtros para ver a pressão por parceiro." />
        )}
      </div>
    </Surface>
  );
}

function PartnerCoverageBoard({ rows }: { rows: PartnerMonitorRow[] }) {
  const partnersWithPhones = rows.filter((row) => row.phones.length).length;
  const partnersWithBackup = rows.filter((row) => row.backupUnits > 0).length;
  const partnersWithStarlink = rows.filter((row) => row.starlinkUnits > 0).length;
  const unitsWithoutActioning = rows.reduce((sum, row) => sum + row.noActioningUnits, 0);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Parceiros no recorte"
        value={rows.length}
        meta="responsáveis mapeados nesta visão"
        tone={rows.length ? "info" : "neutral"}
      />
      <KpiTile
        label="Com acionamento"
        value={partnersWithPhones}
        meta="telefone ou contato legado disponível"
        tone={partnersWithPhones ? "success" : "neutral"}
      />
      <KpiTile
        label="Com contingência"
        value={partnersWithBackup}
        meta={`${partnersWithStarlink} com Starlink associada`}
        tone={partnersWithBackup ? "attention" : "neutral"}
      />
      <KpiTile
        label="Lacunas de contato"
        value={unitsWithoutActioning}
        meta="unidade(s) com incidente sem telefone legado"
        tone={unitsWithoutActioning ? "critical" : "success"}
      />
    </section>
  );
}

function PartnerOperationsTable({ rows }: { rows: PartnerMonitorRow[] }) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Mesa de parceiros"
        title="Acionamento consolidado por responsável"
        description="Cada linha resume cobertura, contato, contingência e pressão atual para o parceiro que atende as unidades."
        actions={<TonePill tone="neutral">{rows.length} parceiro(s)</TonePill>}
        compact
      />

      <div className="mt-4">
        {rows.length ? (
          <TableShell>
            <DenseTable>
              <TableHead>
                <tr>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3">Acionamento</th>
                  <th className="px-4 py-3">Cobertura</th>
                  <th className="px-4 py-3">Telemetria</th>
                  <th className="px-4 py-3">Hotspots</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </TableHead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`partner-monitor-${row.partner.id}`} className="border-b border-white/6 last:border-b-0">
                    <TableCell>
                      <Link href={`/parceiros/${row.partner.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                        {row.partner.code}
                      </Link>
                      <div className="mt-1 max-w-[260px] text-sm text-slate-300">{row.partner.name}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <TonePill tone={row.down ? "critical" : row.degraded ? "attention" : "success"}>
                          {row.down ? `${row.down} off` : row.degraded ? `${row.degraded} atenção` : "estável"}
                        </TonePill>
                        <TonePill tone="neutral">{row.units} unidade(s)</TonePill>
                        <TonePill tone="info">{row.matchedHosts}/{row.units} host(s)</TonePill>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[260px] text-sm text-slate-300">
                        {compactList(row.phones, "Sem telefone legado")}
                      </div>
                      <div className="mt-2 flex max-w-[260px] flex-wrap gap-1">
                        {row.backupUnits ? <TonePill tone="attention">{row.backupUnits} backup</TonePill> : null}
                        {row.starlinkUnits ? <TonePill tone="info">{row.starlinkUnits} starlink</TonePill> : null}
                        {row.macOnuUnits ? <TonePill tone="violet">{row.macOnuUnits} mac/onu</TonePill> : null}
                        {row.noActioningUnits ? <TonePill tone="critical">{row.noActioningUnits} sem contato</TonePill> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-300">
                        {compactList(row.technologies, "sem tecnologia legado", 2)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {compactList(row.contracts.map((item) => `IXC ${item}`), "sem contrato IXC", 2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-300">latência {formatMs(row.avgLatencyMs)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        perda {formatPercent(row.avgLossPct)} · temp. {formatTemperature(row.maxTemperatureC)}
                      </div>
                      <div className="mt-2">
                        <TonePill tone={row.problems ? "attention" : "success"}>{row.problems} problema(s)</TonePill>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-2">
                        {row.hotspots.length ? (
                          row.hotspots.map((unit) => (
                            <div key={`${row.partner.id}-${unit.id}`} className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <Link href={`/unidades/${unit.id}`} className="truncate text-sm font-semibold text-slate-100 hover:text-sky-100">
                                  {unit.code}
                                </Link>
                                <TonePill tone={healthTone(unit.health)}>{healthLabel(unit.health)}</TonePill>
                              </div>
                              <div className="mt-1 truncate text-xs text-slate-500">{unit.name}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">sem hotspot</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-2">
                        <Link
                          href={`/parceiros/${row.partner.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                        >
                          Abrir parceiro
                        </Link>
                        <Link
                          href={`/monitoramento?view=units&partner=${row.partner.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-[12px] border border-white/10 bg-transparent px-3 text-sm font-semibold text-slate-300 transition hover:border-white/14 hover:bg-white/[0.04] hover:text-white"
                        >
                          Ver unidades
                        </Link>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </DenseTable>
          </TableShell>
        ) : (
          <EmptyState
            title="Nenhum parceiro no recorte"
            description="Ajuste filtros ou confirme se as unidades estão ligadas a parceiros ativos."
          />
        )}
      </div>
    </Surface>
  );
}

function LegacyOperationsBoard({
  contexts,
  telemetry,
}: {
  contexts: LegacyMonitorContextResult;
  telemetry: UnitHostTelemetry;
}) {
  const items = telemetry.items.map((item) => ({
    item,
    context: legacyContextFor(contexts, item),
  }));
  const summary = {
    matchedUnits: items.filter((item) => item.context?.matched).length,
    withPhones: items.filter((item) => item.context?.phones.length).length,
    withBackup: items.filter((item) => item.context?.hasBackup).length,
    withStarlink: items.filter((item) => (item.context?.starlinks || 0) > 0).length,
    withMacOnu: items.filter((item) => item.context?.hasMacOnu).length,
    withoutContext: items.filter(
      (item) =>
        !item.context ||
        (!item.context.phones.length &&
          !item.context.hasBackup &&
          !item.context.starlinks &&
          !item.context.equipments),
    ).length,
  };
  const topActioning = items
    .slice()
    .sort((a, b) => operationalPressure(b.item, b.context) - operationalPressure(a.item, a.context))
    .slice(0, 6);

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Contexto operacional"
        title="Acionamento, contingência e transporte"
        description="Cruza host, parceiro e legado para a mesa NOC enxergar como a unidade é atendida, não só se o host respondeu."
        actions={
          <TonePill tone={contexts.sourceAvailable ? "success" : "attention"}>
            {contexts.sourceAvailable ? "legado ativo" : "sem legado"}
          </TonePill>
        }
        compact
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Com acionamento"
          value={summary.withPhones}
          meta={`${summary.matchedUnits} unidade(s) com match legado`}
          tone={summary.withPhones ? "success" : "neutral"}
        />
        <KpiTile
          label="Com backup"
          value={summary.withBackup}
          meta="rota ou parceiro de contingência"
          tone={summary.withBackup ? "attention" : "neutral"}
        />
        <KpiTile
          label="Starlink"
          value={summary.withStarlink}
          meta="unidade(s) com contexto Starlink"
          tone={summary.withStarlink ? "info" : "neutral"}
        />
        <KpiTile
          label="MAC/ONU"
          value={summary.withMacOnu}
          meta={`${summary.withoutContext} sem contexto legado`}
          tone={summary.withMacOnu ? "violet" : "neutral"}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {topActioning.length ? (
          topActioning.map(({ item, context }) => (
            <div key={`legacy-ops-${item.unit.id}`} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                    {item.unit.code} · {item.unit.name}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">
                    {item.partner.name} · {firstPhones(context)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                  {contextBadges(context).slice(0, 3).map((badge) => (
                    <TonePill key={`${item.unit.id}-${badge.label}`} tone={badge.tone}>
                      {badge.label}
                    </TonePill>
                  ))}
                </div>
              </div>
              {context?.notes?.[0] ? (
                <div className="mt-3 rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400">
                  {context.notes[0]}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState
            title="Sem contexto legado no recorte"
            description="Quando a unidade tiver match com o pacote legado, telefone, backup e transporte aparecem aqui."
          />
        )}
      </div>
    </Surface>
  );
}

function ActioningGapPanel({
  telemetry,
  contexts,
}: {
  telemetry: UnitHostTelemetry;
  contexts: LegacyMonitorContextResult;
}) {
  const rows = telemetry.items
    .map((item) => ({ item, context: legacyContextFor(contexts, item) }))
    .filter(
      ({ item, context }) =>
        item.health !== "online" &&
        item.health !== "unknown" &&
        (!context || !context.phones.length),
    )
    .sort((a, b) => operationalPressure(b.item, b.context) - operationalPressure(a.item, a.context))
    .slice(0, 8);

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Lacunas"
        title="Incidentes sem acionamento claro"
        description="Unidades com incidente, degradação ou ambiguidade de vínculo e sem telefone legado disponível para escalar."
        actions={<TonePill tone={rows.length ? "critical" : "success"}>{rows.length} lacuna(s)</TonePill>}
        compact
      />

      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.map(({ item, context }) => (
            <div key={`gap-${item.unit.id}`} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                    {item.unit.code} · {item.unit.name}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">{item.partner.name} · {cityLine(item)}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                  {context?.hasBackup ? <TonePill tone="attention">{context.backupCount} backup</TonePill> : null}
                  {context?.starlinks ? <TonePill tone="info">{context.starlinks} starlink</TonePill> : null}
                </div>
              </div>
              <div className="mt-3 rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400">
                Sem telefone legado. Priorize atualizar contato do parceiro ou registrar rota de contingência na unidade.
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="Sem lacunas de acionamento"
            description="As unidades com problema neste recorte já têm algum telefone legado visível para a operação."
          />
        )}
      </div>
    </Surface>
  );
}

function UnmappedPanel({
  telemetry,
  contexts,
}: {
  telemetry: UnitHostTelemetry;
  contexts: LegacyMonitorContextResult;
}) {
  const rows = telemetry.items.filter((item) => item.match.status !== "matched");

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Vínculo"
        title="Unidades sem host confiável"
        description="Para habilitar sincronização automática depois, o vínculo precisa ser inequívoco. O caminho mais seguro é manter uma tag do Zabbix com o código da unidade."
        actions={<TonePill tone={rows.length ? "attention" : "success"}>{rows.length} pendente(s)</TonePill>}
        compact
      />

      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.slice(0, 8).map((item) => {
            const context = legacyContextFor(contexts, item);
            return (
            <div key={item.unit.id} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-50">{item.unit.code} · {item.unit.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.partner.name} · {cityLine(item)}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{firstPhones(context)}</div>
                </div>
                <TonePill tone={item.match.status === "ambiguous" ? "attention" : "subtle"}>
                  {item.match.status === "ambiguous" ? "ambíguo" : "sem host"}
                </TonePill>
              </div>
              {context ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {contextBadges(context).slice(0, 4).map((badge) => (
                    <TonePill key={`${item.unit.id}-backlog-${badge.label}`} tone={badge.tone}>
                      {badge.label}
                    </TonePill>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400">
                Use tag <span className="font-semibold text-slate-200">nova.unit_code={item.unit.code}</span> no host
                correspondente ou registre serial/MAC do equipamento no inventário do host.
              </div>
            </div>
          )})
        ) : (
          <EmptyState title="Todos os vínculos estão confiáveis" description="As unidades ativas têm host Zabbix identificado por esta leitura." />
        )}
      </div>
    </Surface>
  );
}

function SourcePanel({ telemetry }: { telemetry: UnitHostTelemetry }) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Fontes"
        title="Zabbix disponível para leitura"
        description="Este bloco só mostra se a fonte permite buscar hosts. Os indicadores principais continuam sendo por unidade."
        compact
      />

      <div className="mt-4 grid gap-3">
        {telemetry.sources.map((source) => (
          <div key={source.id} className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-50">{source.code} · {source.name}</div>
                <div className="mt-1 max-w-[520px] truncate text-xs text-slate-500">{source.targetUrl || "sem URL exposta"}</div>
              </div>
              <TonePill tone={source.ok ? "success" : "attention"}>{source.ok ? "lendo hosts" : "atenção"}</TonePill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Versão</div>
                <div className="mt-1 font-semibold text-slate-50">{source.version || "-"}</div>
              </div>
              <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Hosts</div>
                <div className="mt-1 font-semibold text-slate-50">{source.totalHosts}</div>
              </div>
              <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Vínculos</div>
                <div className="mt-1 font-semibold text-slate-50">{source.matchedUnits}</div>
              </div>
            </div>
            <div className="mt-3 text-sm leading-5 text-slate-400">{source.message}</div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function ProblemPanel({ telemetry }: { telemetry: UnitHostTelemetry }) {
  const problems = telemetry.items.flatMap((item) =>
    item.problems.map((problem) => ({
      ...problem,
      unit: item.unit,
      partner: item.partner,
    })),
  );

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Problemas"
        title="Eventos ativos por unidade"
        description="Problemas retornados pelo Zabbix já ligados à unidade correspondente."
        actions={<TonePill tone={problems.length ? "attention" : "success"}>{problems.length} evento(s)</TonePill>}
        compact
      />

      <div className="mt-4">
        {problems.length ? (
          <TableShell>
            <DenseTable>
              <TableHead>
                <tr>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Sev.</th>
                  <th className="px-4 py-3">Ack</th>
                  <th className="px-4 py-3">Horário</th>
                </tr>
              </TableHead>
              <tbody>
                {problems.slice(0, 10).map((problem) => (
                  <tr key={`${problem.unit.id}-${problem.eventid}`} className="border-b border-white/6 last:border-b-0">
                    <TableCell>
                      <div className="font-semibold text-slate-50">{problem.unit.code}</div>
                      <div className="mt-1 text-xs text-slate-500">{problem.partner.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[620px] font-medium leading-5 text-slate-50">{problem.name}</div>
                      <div className="mt-1 text-xs text-slate-500">Evento {problem.eventid}</div>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={severityTone(problem.severity)}>{problem.severity}</TonePill>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={problem.acknowledged === "1" ? "success" : "attention"}>
                        {problem.acknowledged === "1" ? "sim" : "não"}
                      </TonePill>
                    </TableCell>
                    <TableCell className="text-slate-400">{formatProblemClock(problem.clock)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </DenseTable>
          </TableShell>
        ) : (
          <EmptyState title="Sem problemas ativos" description="Nenhum problema Zabbix foi retornado para unidades vinculadas." />
        )}
      </div>
    </Surface>
  );
}

function RecentWork({ commandCenter }: { commandCenter: CommandCenter }) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Operação"
        title="Ocorrências e manutenções recentes"
        description="Contexto interno para cruzar com o comportamento observado no Zabbix."
        compact
      />

      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-50">Ocorrências</div>
            <Link href="/ocorrencias" className="text-xs font-semibold text-sky-200 hover:text-white">Ver todas</Link>
          </div>
          <div className="grid gap-2">
            {commandCenter.recentOccurrences.length ? (
              commandCenter.recentOccurrences.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={`/ocorrencias/${item.id}`}
                  className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-3 transition hover:border-white/14 hover:bg-[#111820]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-50">{item.code} · {item.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{targetLabel(item)}</div>
                    </div>
                    <TonePill tone={item.severity === "critical" ? "critical" : "attention"}>{item.severity}</TonePill>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState title="Sem ocorrências recentes" description="Nenhuma ocorrência retornada para esta leitura." />
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-50">Manutenções</div>
            <Link href="/manutencoes" className="text-xs font-semibold text-sky-200 hover:text-white">Ver todas</Link>
          </div>
          <div className="grid gap-2">
            {commandCenter.recentMaintenances.length ? (
              commandCenter.recentMaintenances.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={`/manutencoes/${item.id}`}
                  className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-3 transition hover:border-white/14 hover:bg-[#111820]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-50">{item.code} · {item.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{targetLabel(item)}</div>
                    </div>
                    <TonePill tone={item.status === "completed" ? "success" : "attention"}>{item.status}</TonePill>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState title="Sem manutenções recentes" description="Nenhuma manutenção retornada para esta leitura." />
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/monitoramento");
  }

  const emptyCommandCenter: CommandCenter = {
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
  };

  const [telemetry, commandCenter] = await Promise.all([
    readTelemetry(),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter),
  ]);
  const legacyContexts = await getLegacyMonitorContextForUnits(
    telemetry.items.map((item) => ({
      id: item.unit.id,
      code: item.unit.code,
      name: item.unit.name,
      city: item.unit.city,
      state: item.unit.state,
      partner: {
        code: item.partner.code,
        name: item.partner.name,
      },
    })),
  );
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";
  const params = await resolveSearchParams(searchParams);
  const filters: MonitorFilters = {
    q: readStringParam(params, "q"),
    health: readStringParam(params, "health", "all"),
    partner: readStringParam(params, "partner", "all"),
    sort: readStringParam(params, "sort", "risk"),
    view: normalizeMonitorView(readStringParam(params, "view", "overview")),
  };
  const partners = partnersFromTelemetry(telemetry);
  const filteredTelemetry = filterTelemetry(telemetry, filters);
  const partnerRows = buildPartnerRows(filteredTelemetry, legacyContexts);

  return (
    <AppShell
      title="Monitoramento"
      subtitle="Dashboard NOC das unidades atendidas, seus hosts Zabbix e sinais operacionais."
    >
      <HostHero telemetry={telemetry} commandCenter={commandCenter} isAdmin={isAdmin} />

      <OperationsCommandDeck
        eyebrow="Fluxo do turno"
        title="Monitoramento encaixado no produto"
        description="A leitura do host precisa conversar com fila, integrações e cadastro, mas sem esconder a operação atrás de blocos demais."
        links={[
          {
            href: "/dashboard",
            title: "Painel operacional",
            description: "Resumo mais executivo de pressão, watchlist e caminhos de continuidade.",
            badge: <TonePill tone="info">{filteredTelemetry.counts.units} unidade(s)</TonePill>,
          },
          {
            href: "/operacao/fila",
            title: "Fila operacional",
            description: "Quando o host sai do normal, o próximo passo do turno continua na fila.",
            badge: <TonePill tone={filteredTelemetry.counts.down ? "critical" : "attention"}>{filteredTelemetry.counts.down} off</TonePill>,
          },
          {
            href: "/integracoes",
            title: "Integrações",
            description: "Conector, autenticação e testes quando a origem do dado pede ajuste.",
            badge: <TonePill tone={telemetry.sources.some((item) => !item.ok) ? "attention" : "success"}>{telemetry.sources.filter((item) => !item.ok).length} alerta(s)</TonePill>,
          },
          {
            href: "/unidades",
            title: "Unidades",
            description: "Ficha cadastral, parceiro, ativo e vínculos que sustentam o match com host.",
            badge: <TonePill tone={filteredTelemetry.counts.syncReady ? "success" : "neutral"}>{filteredTelemetry.counts.syncReady} sync ok</TonePill>,
          },
        ]}
        items={[
          {
            label: "Ver",
            title: "Comece por host, não por conector",
            description: "A pergunta principal é se a unidade atendida está saudável. A origem Zabbix existe para sustentar essa resposta, não para roubar o foco da tela.",
            tone: "info",
          },
          {
            label: "Cruzar",
            title: "Leia junto host, contato e legado",
            description: "Quando um host está em atenção, a decisão melhora muito se o telefone, backup, Starlink ou tecnologia já estão no mesmo bloco visual.",
            tone: "attention",
          },
          {
            label: "Agir",
            title: "Saia daqui já sabendo o próximo clique",
            description: "Se o problema virou despacho, vá para a fila. Se virou ajuste técnico, vá para integrações. Se virou revisão estrutural, vá para a ficha da unidade.",
            tone: "success",
          },
        ]}
      />

      <MonitorTabs filters={filters} telemetry={filteredTelemetry} />

      <NocFilters filters={filters} partners={partners} resultCount={filteredTelemetry.counts.units} />

      <SourcePanel telemetry={telemetry} />

      {filters.view === "overview" ? (
        <>
          <NocPulseBoard
            telemetry={filteredTelemetry}
            commandCenter={commandCenter}
            contexts={legacyContexts}
          />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <HealthBoard telemetry={filteredTelemetry} />
            <PartnerPulse rows={partnerRows} />
          </section>

          <LegacyOperationsBoard contexts={legacyContexts} telemetry={filteredTelemetry} />

          <SensorBoard telemetry={filteredTelemetry} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Unidades com host"
              value={`${filteredTelemetry.counts.matched}/${filteredTelemetry.counts.units}`}
              meta={`${filteredTelemetry.counts.unmapped} sem vínculo · ${filteredTelemetry.counts.ambiguous} ambígua(s)`}
              tone={filteredTelemetry.counts.unmapped || filteredTelemetry.counts.ambiguous ? "attention" : "success"}
            />
            <KpiTile
              label="Offline / atenção"
              value={`${filteredTelemetry.counts.down}/${filteredTelemetry.counts.degraded}`}
              meta={`${filteredTelemetry.counts.withProblems} com problema Zabbix`}
              tone={filteredTelemetry.counts.down ? "critical" : filteredTelemetry.counts.degraded ? "attention" : "success"}
            />
            <KpiTile
              label="Latência média"
              value={formatMs(filteredTelemetry.counts.avgLatencyMs)}
              meta={`perda média ${formatPercent(filteredTelemetry.counts.avgLossPct)}`}
              tone={metricTone(filteredTelemetry.counts.avgLatencyMs, 150, 700)}
            />
            <KpiTile
              label="Temperatura máx."
              value={formatTemperature(filteredTelemetry.counts.maxTemperatureC)}
              meta={`${filteredTelemetry.counts.syncReady} host(s) prontos para sync seguro`}
              tone={metricTone(filteredTelemetry.counts.maxTemperatureC, 55, 70)}
            />
          </section>

          <MetricLanes telemetry={filteredTelemetry} />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ProblemPanel telemetry={filteredTelemetry} />
            <ActioningGapPanel telemetry={filteredTelemetry} contexts={legacyContexts} />
          </section>

          <UnmappedPanel telemetry={filteredTelemetry} contexts={legacyContexts} />
        </>
      ) : null}

      {filters.view === "units" ? (
        <>
          <LegacyOperationsBoard contexts={legacyContexts} telemetry={filteredTelemetry} />
          <SensorBoard telemetry={filteredTelemetry} />
          <HostTelemetryTable telemetry={filteredTelemetry} contexts={legacyContexts} />
          <UnmappedPanel telemetry={filteredTelemetry} contexts={legacyContexts} />
        </>
      ) : null}

      {filters.view === "partners" ? (
        <>
          <PartnerCoverageBoard rows={partnerRows} />
          <PartnerOperationsTable rows={partnerRows} />
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ActioningGapPanel telemetry={filteredTelemetry} contexts={legacyContexts} />
            <UnmappedPanel telemetry={filteredTelemetry} contexts={legacyContexts} />
          </section>
        </>
      ) : null}

      {filters.view === "sensors" ? (
        <>
          <SensorBoard telemetry={filteredTelemetry} />
          <MetricLanes telemetry={filteredTelemetry} />
          <SensorChannelTable telemetry={filteredTelemetry} />
        </>
      ) : null}

      {filters.view === "events" ? (
        <>
          <ProblemPanel telemetry={filteredTelemetry} />
          <RecentWork commandCenter={commandCenter} />
        </>
      ) : null}
    </AppShell>
  );
}
