import { apiJson } from "@/lib/server-api";

export type Bucket = {
  key: string;
  count: number;
};

export type RecentOccurrence = {
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

export type RecentMaintenance = {
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

export type CommandCenter = {
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

export type UnitHostTelemetryItem = {
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

export type UnitHostTelemetry = {
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

export function emptyTelemetry(message = "Endpoint de telemetria ainda não disponível."): UnitHostTelemetry {
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
  };
}

export function emptyCommandCenter(): CommandCenter {
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
  };
}

export async function safeApiJson<T>(path: string, fallback: T) {
  try {
    return await apiJson<T>(path);
  } catch {
    return fallback;
  }
}

async function withTimeout<T>(request: Promise<T>, ms: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("telemetry_timeout")), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function readUnitHostTelemetry(options: { timeoutMs?: number; fast?: boolean } = {}) {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => {
        controller.abort();
      }, options.timeoutMs)
    : null;
  const query = options.fast ? "?mode=fast" : "";

  try {
    const request = apiJson<UnitHostTelemetry>(
      `/monitoring/unit-hosts${query}`,
      controller ? { signal: controller.signal } : {},
    );

    return await (options.timeoutMs ? withTimeout(request, options.timeoutMs) : request);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message === "telemetry_timeout");
    return emptyTelemetry(
      aborted
        ? options.fast
          ? "Telemetria Zabbix ainda carregando. Recarregue em alguns segundos."
          : "Telemetria ainda carregando. Abra Monitoramento para a leitura completa."
        : error instanceof Error
          ? error.message
          : "Falha ao carregar telemetria.",
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function formatMs(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

export function formatTemperature(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
}

export function metricTone(value: number | null, warning: number, critical: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= critical) return "critical";
  if (value >= warning) return "attention";
  return "success";
}

export function telemetryCoveragePct(telemetry: UnitHostTelemetry) {
  if (!telemetry.counts.units) return 0;
  return Math.round((telemetry.counts.matched / telemetry.counts.units) * 100);
}

export function healthTone(value: UnitHostTelemetryItem["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  if (value === "unmapped") return "subtle";
  return "neutral";
}

export function healthLabel(value: UnitHostTelemetryItem["health"]) {
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

export function unitAlertScore(item: UnitHostTelemetryItem) {
  return (
    (item.health === "down" ? 120 : 0) +
    (item.health === "degraded" ? 70 : 0) +
    (item.health === "ambiguous" ? 40 : 0) +
    (item.health === "unmapped" ? 32 : 0) +
    item.problems.length * 18 +
    (item.metrics.lossPct ?? 0) * 2 +
    Math.min(40, (item.metrics.latencyMs ?? 0) / 25) +
    Math.max(0, (item.metrics.temperatureC ?? 0) - 55)
  );
}

export function buildWatchlist(telemetry: UnitHostTelemetry, limit = 6) {
  const risky = telemetry.items.filter(
    (item) =>
      item.health !== "online" ||
      item.problems.length > 0 ||
      (item.metrics.lossPct ?? 0) >= 1.5 ||
      (item.metrics.latencyMs ?? 0) >= 140 ||
      (item.metrics.temperatureC ?? 0) >= 55,
  );

  const source = risky.length ? risky : telemetry.items;

  return source
    .slice()
    .sort((a, b) => unitAlertScore(b) - unitAlertScore(a) || a.unit.code.localeCompare(b.unit.code))
    .slice(0, limit);
}

export function atRiskPartnerCount(telemetry: UnitHostTelemetry) {
  const partners = new Set(
    telemetry.items
      .filter((item) => unitAlertScore(item) >= 70 || item.health !== "online" || item.problems.length > 0)
      .map((item) => item.partner.id),
  );

  return partners.size;
}

export function operationPressure(commandCenter: CommandCenter, telemetry: UnitHostTelemetry) {
  return (
    telemetry.counts.down * 4 +
    telemetry.counts.degraded * 2 +
    telemetry.counts.withProblems * 2 +
    commandCenter.metrics.criticalOpenOccurrences * 3 +
    commandCenter.metrics.overdueMaintenances * 2
  );
}

export function targetLabel(item: RecentOccurrence | RecentMaintenance) {
  if (item.equipment) return `${item.equipment.tag} · ${item.equipment.name}`;
  if (item.unit) return `${item.unit.code} · ${item.unit.name}`;
  if (item.partner) return `${item.partner.code} · ${item.partner.name}`;
  return "Sem vínculo";
}
