import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import { EntityEditModal } from "@/components/entity-edit-modal";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
import { RegistryDetailHero } from "@/components/registry-shell";
import {
  DenseTable,
  EmptyState,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionHeader,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { getLegacyUnitProfileForUnit } from "@/lib/legacy-catalog";
import {
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";


function IconArrowUpRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><path d="M7 13L13 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M8 7H13V12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function IconFocus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><path d="M7 3.75H5.75A2 2 0 0 0 3.75 5.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M13 3.75H14.25A2 2 0 0 1 16.25 5.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M7 16.25H5.75A2 2 0 0 1 3.75 14.25V13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M13 16.25H14.25A2 2 0 0 0 16.25 14.25V13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
  );
}

function IconRefresh({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><path d="M16 10A6 6 0 1 1 14.24 5.76" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M16 4.5V8.25H12.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function IconPulse({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><path d="M2.75 10H5.1L7.15 6.5L9.35 13.4L11.7 8.8L12.8 10H17.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function IconServer({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><rect x="3.25" y="4" width="13.5" height="4.25" rx="1.25" stroke="currentColor" strokeWidth="1.7" /><rect x="3.25" y="11.75" width="13.5" height="4.25" rx="1.25" stroke="currentColor" strokeWidth="1.7" /><path d="M6.25 6.1H6.26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M6.25 13.85H6.26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  );
}

function IconAlertList({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true"><path d="M6.25 5.25H14.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M6.25 10H14.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M6.25 14.75H11.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M4.1 5.25H4.11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M4.1 10H4.11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M4.1 14.75H4.11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  );
}

function IconMoreVertical({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true"><circle cx="10" cy="5" r="1.3" /><circle cx="10" cy="10" r="1.3" /><circle cx="10" cy="15" r="1.3" /></svg>
  );
}

type UnitDetail = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  zabbixHost: string | null;
  zabbixVisibleName: string | null;
  reportContractLabel?: string | null;
  reportAddressLine?: string | null;
  reportContractedBandwidth?: string | null;
  reportNotes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
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
  occurrences: Array<{
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  maintenances: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string | null;
    createdAt: string;
  }>;
  _count: {
    equipments: number;
    occurrences: number;
    maintenances: number;
  };
};

type PartnerOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type UnitZabbixSnapshot = {
  unit: { id: string; code: string; name: string };
  match: {
    status: "matched" | "ambiguous" | "unmatched";
    confidence: number;
    integrationCode?: string;
    hostId?: string;
    host?: string;
    hostName?: string;
    matchedBy: string[];
    syncReady: boolean;
  };
  health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
  metrics: {
    ping: { ok: boolean | null; name: string; key: string; lastClock: string | null } | null;
    lossPct: number | null;
    latencyMs: number | null;
    temperatureC: number | null;
    sources?: {
      ping: { name: string; key: string; lastClock: string | null; units?: string } | null;
      loss: { name: string; key: string; lastClock: string | null; units?: string } | null;
      latency: { name: string; key: string; lastClock: string | null; units?: string } | null;
      temperature: { name: string; key: string; lastClock: string | null; units?: string } | null;
    };
  };
  problems: Array<{
    eventid: string;
    name: string;
    severity: string;
    acknowledged: string;
    clock: string;
  }>;
};

type UnitZabbixSyncResult = {
  ok: boolean;
  status: "synced" | "skipped" | "failed";
  message: string;
  integrationCode?: string;
  hostId?: string;
  hostName?: string;
  updatedTags?: number;
  updatedInventoryFields?: string[];
};

type MonitoringReportPoint = {
  timestamp: string;
  value: number | null;
};

type MonitoringReportSeries = {
  id: string;
  name: string;
  key: string;
  label: string;
  kind: string;
  color: string;
  unit: "bps" | "ms" | "%" | "d";
  zabbixUnits: string;
  points: MonitoringReportPoint[];
  stats: {
    last: number | null;
    min: number | null;
    avg: number | null;
    max: number | null;
    points: number;
  };
};

type MonitoringTrafficConsumption = {
  receivedBytes: number | null;
  sentBytes: number | null;
  totalBytes: number | null;
  avgReceiveBps: number | null;
  avgSendBps: number | null;
  peakReceiveBps: number | null;
  peakSendBps: number | null;
  coveredSeconds: number;
};

type MonitoringReportBlock = {
  id: "traffic" | "ping" | "uptime" | string;
  title: string;
  description: string;
  sensorType: string;
  probePath: string;
  unit: string;
  series: MonitoringReportSeries[];
  consumption?: MonitoringTrafficConsumption | null;
};

type UnitMonitoringReport = {
  generatedAt: string;
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  integration: {
    id: string;
    code: string;
    name: string;
  } | null;
  host: {
    hostId?: string;
    host?: string;
    hostName?: string;
    confidence?: number;
  } | null;
  blocks: MonitoringReportBlock[];
  warnings: string[];
};

type MonitoringWindowPreset = "1h" | "6h" | "1d" | "7d" | "30d";

type LegacyLink = {
  legacyId: string;
  partnerCode: string;
  serviceType: string;
  connectionType: string;
  routerPort: string;
  technology: string;
  latency: string;
  macOnu: string;
  phone: string;
  notes: string;
  contractIxc: string;
};

type LegacyPartnerContact = {
  legacyId: string;
  city: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
};

type LegacyStarlink = {
  legacyId: string;
  antennaId: string;
  email: string;
  plan: string;
  card: string;
  localName: string;
  kitSerial: string;
  antennaSerial: string;
  ipvpn: string;
  installer: string;
  installedAt: string;
  notes: string;
};

type LegacyStarlinkHistory = {
  legacyId: string;
  starlinkLegacyId: string;
  action: string;
  details: string;
  user: string;
  datetime: string;
};

type LegacyUnitProfile = {
  sourceAvailable: boolean;
  message?: string;
  generatedAt?: string;
  redactedSecrets?: boolean;
  unit: {
    code: string;
    name: string;
    group: string;
    city: string;
    state: string;
    phones: string[];
    contracts: string[];
    notes: string[];
  } | null;
  links: LegacyLink[];
  backupLinks: LegacyLink[];
  partnerContacts: LegacyPartnerContact[];
  starlinks: LegacyStarlink[];
  starlinkHistory: LegacyStarlinkHistory[];
  equipments: Array<{
    tag: string;
    name: string;
    type: string;
    serialNumber: string;
    source: string;
  }>;
};

async function syncZabbixAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const unitId = String(formData.get("unitId") || "");

  if (!unitId) {
    return { status: "error", message: "Unidade inválida para sincronização." };
  }

  try {
    const result = await apiJson<UnitZabbixSyncResult>(`/units/${unitId}/sync-zabbix`, {
      method: "POST",
    });

    revalidatePath(`/unidades/${unitId}`);
    revalidatePath("/monitoramento");

    return {
      status: result.ok ? "success" : "error",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionErrorMessage(error),
    };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
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

function formatBits(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";

  const units = ["bit/s", "Kbit/s", "Mbit/s", "Gbit/s", "Tbit/s"];
  let size = Math.abs(value);
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex += 1;
  }

  const signed = value < 0 ? -size : size;
  return `${signed.toLocaleString("pt-BR", {
    maximumFractionDigits: unitIndex <= 1 ? 0 : 2,
  })} ${units[unitIndex]}`;
}

function formatBytes(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Math.abs(value);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const signed = value < 0 ? -size : size;
  return `${signed.toLocaleString("pt-BR", {
    maximumFractionDigits: unitIndex <= 1 ? 0 : 2,
  })} ${units[unitIndex]}`;
}

function formatReportValue(value: number | null, unit: MonitoringReportSeries["unit"]) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (unit === "bps") return formatBits(value);
  if (unit === "ms") return formatMs(value);
  if (unit === "%") return formatPercent(value);
  if (unit === "d") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function locationLabel(unit: Pick<UnitDetail, "city" | "state">) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function compactLabel(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isRedundantLabel(primary: string, secondary: string) {
  const a = compactLabel(primary);
  const b = compactLabel(secondary);

  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function hasZabbixMetrics(snapshot: UnitZabbixSnapshot | null) {
  return Boolean(
    snapshot &&
      (snapshot.metrics.ping ||
        snapshot.metrics.lossPct !== null ||
        snapshot.metrics.latencyMs !== null ||
        snapshot.metrics.temperatureC !== null),
  );
}

function zabbixSensorCount(snapshot: UnitZabbixSnapshot | null) {
  if (!snapshot?.metrics.sources) return hasZabbixMetrics(snapshot) ? 1 : 0;

  return [
    snapshot.metrics.sources.ping,
    snapshot.metrics.sources.loss,
    snapshot.metrics.sources.latency,
    snapshot.metrics.sources.temperature,
  ].filter(Boolean).length;
}

function toneForStatus(value: string) {
  const normalized = value.toLowerCase();
  if (["resolved", "closed", "active", "done", "completed"].includes(normalized)) {
    return "success";
  }
  if (["critical", "high", "overdue", "repair"].includes(normalized)) {
    return "attention";
  }
  return "neutral";
}

function toneForHealth(value: UnitZabbixSnapshot["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  return "neutral";
}

function labelForHealth(value: UnitZabbixSnapshot["health"]) {
  const labels: Record<UnitZabbixSnapshot["health"], string> = {
    online: "online",
    degraded: "atenção",
    down: "offline",
    unmapped: "sem vínculo",
    unknown: "sem item",
    ambiguous: "ambíguo",
  };
  return labels[value];
}

function normalizeMonitoringWindow(value: string | null | undefined): MonitoringWindowPreset {
  if (value === "1h" || value === "6h" || value === "1d" || value === "30d") return value;
  return "7d";
}

function monitoringWindowLabel(value: MonitoringWindowPreset) {
  if (value === "1h") return "1H";
  if (value === "6h") return "6H";
  if (value === "1d") return "24H";
  if (value === "30d") return "30D";
  return "7D";
}

function monitoringWindowMs(value: MonitoringWindowPreset) {
  if (value === "1h") return 60 * 60 * 1000;
  if (value === "6h") return 6 * 60 * 60 * 1000;
  if (value === "1d") return 24 * 60 * 60 * 1000;
  if (value === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function selectedMonitoringPeriod(windowPreset: MonitoringWindowPreset, generatedAt?: string | null) {
  const to = generatedAt ? new Date(generatedAt) : new Date();
  if (Number.isNaN(to.getTime())) {
    const fallbackTo = new Date();
    return {
      from: new Date(fallbackTo.getTime() - monitoringWindowMs(windowPreset)).toISOString(),
      to: fallbackTo.toISOString(),
    };
  }

  return {
    from: new Date(to.getTime() - monitoringWindowMs(windowPreset)).toISOString(),
    to: to.toISOString(),
  };
}

function monitoringWindowDescription(windowPreset: MonitoringWindowPreset) {
  if (windowPreset === "1h") return "Última hora";
  if (windowPreset === "6h") return "Últimas 6 horas";
  if (windowPreset === "1d") return "Últimas 24 horas";
  if (windowPreset === "30d") return "Últimos 30 dias";
  return "Últimos 7 dias";
}

function unitMonitoringHref(unitId: string, windowPreset: MonitoringWindowPreset, extra?: Record<string, string>) {
  const query = new URLSearchParams({ mw: windowPreset, ...(extra || {}) });
  return `/unidades/${unitId}?${query.toString()}`;
}

function monitoringReportHref(unitId: string, windowPreset: MonitoringWindowPreset) {
  const query = new URLSearchParams({ unitId, mw: windowPreset });
  return `/relatorios/monitoramento?${query.toString()}`;
}

async function readUnitZabbixSnapshot(unitId: string) {
  try {
    const telemetry = await apiJson<{ items: UnitZabbixSnapshot[] }>("/monitoring/unit-hosts");
    return telemetry.items.find((item) => item.unit.id === unitId) || null;
  } catch {
    return null;
  }
}

async function readUnitMonitoringReport(unitId: string, windowPreset: MonitoringWindowPreset = "7d") {
  const to = new Date();
  to.setSeconds(0, 0);
  to.setMinutes(Math.floor(to.getMinutes() / 5) * 5);

  const from = new Date(to.getTime() - monitoringWindowMs(windowPreset));

  const query = new URLSearchParams({
    unitId,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  try {
    return await apiJson<UnitMonitoringReport>(`/monitoring/reports/prtg-style?${query.toString()}`);
  } catch {
    return null;
  }
}

function cleanSeriesPoints(series: MonitoringReportSeries) {
  return series.points
    .map((point) => ({
      timestamp: point.timestamp,
      clock: new Date(point.timestamp).getTime(),
      value: point.value,
    }))
    .filter(
      (point): point is { timestamp: string; clock: number; value: number } =>
        Number.isFinite(point.clock) &&
        typeof point.value === "number" &&
        Number.isFinite(point.value),
    )
    .sort((a, b) => a.clock - b.clock);
}


function seriesHasPoints(series: MonitoringReportSeries | null | undefined) {
  return Boolean(series && cleanSeriesPoints(series).length);
}

function statsFromSeriesPoints(points: Array<{ timestamp: string; clock: number; value: number }>) {
  if (!points.length) {
    return {
      last: null,
      min: null,
      avg: null,
      max: null,
      points: 0,
    };
  }

  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    last: points[points.length - 1]?.value ?? null,
    min: Math.min(...values),
    avg: total / values.length,
    max: Math.max(...values),
    points: values.length,
  };
}

function clampSeriesToPeriod(series: MonitoringReportSeries, fromClock: number, toClock: number): MonitoringReportSeries | null {
  const filteredPoints = cleanSeriesPoints(series).filter((point) => point.clock >= fromClock && point.clock <= toClock);
  if (!filteredPoints.length) return null;

  return {
    ...series,
    points: filteredPoints.map((point) => ({ timestamp: point.timestamp, value: point.value })),
    stats: statsFromSeriesPoints(filteredPoints),
  };
}

function consumptionFromTrafficSeries(receiveSeries: MonitoringReportSeries | null, sendSeries: MonitoringReportSeries | null): MonitoringTrafficConsumption | null {
  const receivePoints = receiveSeries ? cleanSeriesPoints(receiveSeries) : [];
  const sendPoints = sendSeries ? cleanSeriesPoints(sendSeries) : [];
  const allClocks = [...receivePoints.map((point) => point.clock), ...sendPoints.map((point) => point.clock)].sort((a, b) => a - b);
  if (!allClocks.length) return null;

  const coveredSeconds = Math.max(0, Math.round((allClocks[allClocks.length - 1] - allClocks[0]) / 1000));
  const avgReceiveBps = receiveSeries?.stats.avg ?? null;
  const avgSendBps = sendSeries?.stats.avg ?? null;
  const receivedBytes = avgReceiveBps !== null ? (avgReceiveBps * coveredSeconds) / 8 : null;
  const sentBytes = avgSendBps !== null ? (avgSendBps * coveredSeconds) / 8 : null;

  return {
    receivedBytes,
    sentBytes,
    totalBytes: (receivedBytes ?? 0) + (sentBytes ?? 0) || null,
    avgReceiveBps,
    avgSendBps,
    peakReceiveBps: receiveSeries?.stats.max ?? null,
    peakSendBps: sendSeries?.stats.max ?? null,
    coveredSeconds,
  };
}

function narrowMonitoringReport(report: UnitMonitoringReport | null, windowPreset: MonitoringWindowPreset) {
  if (!report) return null;

  const selectedPeriod = selectedMonitoringPeriod(windowPreset, report.period.to || report.generatedAt || null);
  const fromClock = new Date(selectedPeriod.from).getTime();
  const toClock = new Date(selectedPeriod.to).getTime();

  const blocks = report.blocks
    .map((block) => {
      const filteredSeries = block.series
        .map((series) => clampSeriesToPeriod(series, fromClock, toClock))
        .filter((series): series is MonitoringReportSeries => Boolean(series));

      const receiveSeries = filteredSeries.find((series) => series.kind === "trafficIn") || null;
      const sendSeries = filteredSeries.find((series) => series.kind === "trafficOut") || null;

      return {
        ...block,
        series: filteredSeries,
        consumption: block.id === "traffic" ? consumptionFromTrafficSeries(receiveSeries, sendSeries) : block.consumption ?? null,
      };
    })
    .filter((block) => block.series.length > 0 || block.id === "traffic");

  return {
    ...report,
    period: {
      ...report.period,
      from: selectedPeriod.from,
      to: selectedPeriod.to,
    },
    blocks,
  };
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function compareSeriesHalves(series: MonitoringReportSeries) {
  const points = cleanSeriesPoints(series);
  if (points.length < 4) return null;

  const start = points[0].clock;
  const end = points[points.length - 1].clock;
  const middle = start + (end - start) / 2;
  const previous = average(points.filter((point) => point.clock < middle).map((point) => point.value));
  const current = average(points.filter((point) => point.clock >= middle).map((point) => point.value));

  if (previous === null || current === null) return null;

  return {
    previous,
    current,
    delta: current - previous,
  };
}

function deltaTone(series: MonitoringReportSeries, delta: number) {
  const lowerIsBetter = series.unit === "ms" || series.unit === "%";
  if (Math.abs(delta) < 0.001) return "neutral";
  if (lowerIsBetter) return delta <= 0 ? "success" : "attention";
  return delta >= 0 ? "info" : "neutral";
}

function pathFromPoints(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function ChartRangeBar({ percent = 80, tone = "neutral" }: { percent?: number; tone?: "success" | "attention" | "critical" | "neutral" }) {
  const activeClass =
    tone === "critical"
      ? "bg-rose-400"
      : tone === "attention"
        ? "bg-amber-400"
        : tone === "success"
          ? "bg-emerald-400"
          : "bg-slate-500";

  const activeSegments = Math.max(0, Math.min(10, Math.round(percent / 10)));

  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className={`h-2 flex-1 rounded-full ${index < activeSegments ? activeClass : "bg-white/[0.12]"}`}
        />
      ))}
    </div>
  );
}

function formatChartTimestamp(value: number, withTime = false) {
  if (!Number.isFinite(value)) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  if (withTime) {
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function chartAxisValue(value: number, unit: MonitoringReportSeries["unit"]) {
  if (unit === "bps") return formatBits(value);
  if (unit === "%") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (unit === "ms") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function niceLatencyMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 5;
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  if (value <= 25) return 25;
  if (value <= 50) return 50;
  if (value <= 100) return 100;
  return Math.ceil(value / 50) * 50;
}

function nicePercentMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value <= 1) return 1;
  if (value <= 3) return 3;
  if (value <= 6) return 6;
  return Math.ceil(value / 2) * 2;
}

function latencyTicks(maxValue: number) {
  if (maxValue <= 5) return [0, 1, 2, 3, 4, 5];
  if (maxValue <= 10) return [0, 2, 4, 6, 8, 10];
  if (maxValue <= 25) return [0, 5, 10, 15, 20, 25];
  if (maxValue <= 50) return [0, 10, 20, 30, 40, 50];
  if (maxValue <= 100) return [0, 25, 50, 75, 100];
  return [0, 50, 100, maxValue].filter((value, index, values) => values.indexOf(value) === index);
}

function percentTicks(maxValue: number) {
  if (maxValue <= 1) return [0, 0.25, 0.5, 0.75, 1];
  if (maxValue <= 3) return [0, 1, 2, 3];
  if (maxValue <= 6) return [0, 2, 4, 6];
  return [0, maxValue / 2, maxValue];
}

function trendStatusForLatency(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= 100) return "critical";
  if (value >= 50) return "attention";
  return "success";
}

function trendLabelForLatency(value: number | null) {
  const status = trendStatusForLatency(value);
  if (status === "critical") return "Crítico";
  if (status === "attention") return "Atenção";
  if (status === "success") return "Excelente";
  return "Sem leitura";
}

function trendStatusForLoss(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= 3) return "critical";
  if (value >= 1) return "attention";
  return "success";
}

function trendLabelForLoss(value: number | null) {
  const status = trendStatusForLoss(value);
  if (status === "critical") return "Crítica";
  if (status === "attention") return "Atenção";
  if (status === "success") return "Excelente";
  return "Sem leitura";
}

function trendStatusForTemperature(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= 50) return "critical";
  if (value >= 35) return "attention";
  return "success";
}

function semanticColorForStatus(status: "success" | "attention" | "critical" | "neutral") {
  if (status === "critical") return "#fb7185";
  if (status === "attention") return "#facc15";
  if (status === "success") return "#34d399";
  return "#94a3b8";
}

function semanticTextClassForStatus(status: "success" | "attention" | "critical" | "neutral") {
  if (status === "critical") return "text-rose-400";
  if (status === "attention") return "text-amber-400";
  if (status === "success") return "text-emerald-400";
  return "text-slate-400";
}

function semanticBadgeClassForStatus(status: "success" | "attention" | "critical" | "neutral") {
  if (status === "critical") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  if (status === "attention") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (status === "success") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function semanticStatusForSeries(entry: MonitoringReportSeries) {
  if (entry.unit === "ms" || entry.kind === "ping") {
    return trendStatusForLatency(entry.stats.avg ?? entry.stats.last ?? entry.stats.max ?? null);
  }

  if (entry.unit === "%" || entry.kind === "loss") {
    return trendStatusForLoss(entry.stats.avg ?? entry.stats.last ?? entry.stats.max ?? null);
  }

  return "neutral";
}

function chartStrokeColor(entry: MonitoringReportSeries) {
  if (entry.kind === "ping") return entry.color || "#38bdf8";
  if (entry.kind === "loss") return entry.color || "#fb7185";
  if (entry.kind === "trafficIn") return entry.color || "#22c55e";
  if (entry.kind === "trafficOut") return entry.color || "#f59e0b";
  if (entry.color) return entry.color;

  if (entry.unit === "ms") return "#38bdf8";
  if (entry.unit === "%") return "#fb7185";
  if (entry.unit === "bps") return "#22c55e";

  return "#94a3b8";
}

function TrendChart({
  id,
  series,
  height = 230,
  period,
}: {
  id: string;
  series: MonitoringReportSeries[];
  height?: number;
  period?: { from: string; to: string } | null;
}) {
  const isMini = id.includes("mini");
  const isPingLoss = id.includes("ping-loss");
  const isTraffic = id.includes("traffic");
  const width = isMini ? 900 : 920;
  const pad = isMini
    ? { top: 8, right: 12, bottom: 8, left: 12 }
    : { top: 30, right: isPingLoss ? 56 : 28, bottom: 44, left: isTraffic ? 88 : 62 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const usableSeries = series
    .map((entry) => ({ entry, points: cleanSeriesPoints(entry) }))
    .filter((entry) => entry.points.length > 1);
  const clocks = usableSeries.flatMap((entry) => entry.points.map((point) => point.clock));
  const periodFromClock = period?.from ? new Date(period.from).getTime() : Number.NaN;
  const periodToClock = period?.to ? new Date(period.to).getTime() : Number.NaN;
  const hasValidPeriod = Number.isFinite(periodFromClock) && Number.isFinite(periodToClock) && periodToClock > periodFromClock;
  const minClock = hasValidPeriod ? periodFromClock : clocks.length ? Math.min(...clocks) : 0;
  const maxClock = hasValidPeriod ? periodToClock : clocks.length ? Math.max(...clocks) : 1;
  const pingEntry = usableSeries.find(({ entry }) => entry.unit === "ms" || entry.kind === "ping");
  const lossEntry = usableSeries.find(({ entry }) => entry.unit === "%" || entry.kind === "loss");
  const pingValues = pingEntry?.points.map((point) => point.value) || [];
  const lossValues = lossEntry?.points.map((point) => point.value) || [];
  const globalValues = usableSeries.flatMap((entry) => entry.points.map((point) => point.value));
  const globalMax = Math.max(...globalValues, 1);
  const rawPingMax = Math.max(...pingValues, 1);
  const rawLossMax = Math.max(...lossValues, 0.01);
  const pingMax = isPingLoss ? niceLatencyMax(rawPingMax) : globalMax;
  const lossMax = isPingLoss ? nicePercentMax(rawLossMax) : globalMax;
  const showThresholdBands = isPingLoss && !isMini;
  const maxLatencyPoint = pingEntry
    ? pingEntry.points.reduce((best, point) => (point.value > best.value ? point : best), pingEntry.points[0])
    : null;
  const primaryEntry = usableSeries[0]?.entry || null;

  if (!usableSeries.length) {
    return (
      <div className="flex min-h-[230px] items-center justify-center rounded-[18px] border border-dashed border-white/[0.1] bg-black/20 text-sm text-slate-500">
        Sem dados suficientes para esta janela.
      </div>
    );
  }

  function xFor(clock: number) {
    return pad.left + ((clock - minClock) / Math.max(maxClock - minClock, 1)) * plotWidth;
  }

  function yFor(value: number, entry: MonitoringReportSeries) {
    const maxValue = isPingLoss && (entry.unit === "ms" || entry.kind === "ping")
      ? pingMax
      : isPingLoss && (entry.unit === "%" || entry.kind === "loss")
        ? lossMax
        : globalMax;

    return pad.top + (1 - value / Math.max(maxValue, 1)) * plotHeight;
  }

  const xTicks = Array.from({ length: isMini ? 0 : 6 }).map((_, index) => {
    const clock = minClock + ((maxClock - minClock) / 5) * index;
    return { clock, x: xFor(clock), label: formatChartTimestamp(clock) };
  });

  const pingTicks = isPingLoss ? latencyTicks(pingMax) : [0, globalMax / 2, globalMax];
  const lossTicks = isPingLoss ? percentTicks(lossMax) : [0, lossMax / 2, lossMax];

  const projectedSeries = usableSeries.map(({ entry, points }) => {
    const visiblePoints = points.filter((point) => point.clock >= minClock && point.clock <= maxClock);
    const projected = (visiblePoints.length > 1 ? visiblePoints : points).map((point) => ({
      x: xFor(point.clock),
      y: yFor(point.value, entry),
      value: point.value,
      clock: point.clock,
    }));
    const linePath = pathFromPoints(projected);
    const areaPath = `${linePath} L ${projected.at(-1)?.x.toFixed(2)} ${height - pad.bottom} L ${projected[0]?.x.toFixed(2)} ${height - pad.bottom} Z`;

    return { entry, projected, linePath, areaPath };
  });

  const maxMarker = maxLatencyPoint && pingEntry
    ? {
        x: xFor(maxLatencyPoint.clock),
        y: yFor(maxLatencyPoint.value, pingEntry.entry),
        value: maxLatencyPoint.value,
        clock: maxLatencyPoint.clock,
      }
    : null;

  const primaryAxisLabel = isPingLoss
    ? showThresholdBands
      ? "Latência (ms)"
      : "Latência (ms) · escala automática"
    : isTraffic
      ? "Bits/s"
      : primaryEntry?.kind === "ping"
        ? "Latência (ms)"
        : primaryEntry?.kind === "loss"
          ? "Perda (%)"
          : primaryEntry?.label || primaryEntry?.unit || "Valor";

  function tooltipValueForChart(entry: MonitoringReportSeries, value: number) {
    if (entry.kind === "ping" || entry.unit === "ms") return formatMs(value);
    if (entry.kind === "loss" || entry.unit === "%") return formatPercent(value);
    if (entry.kind === "trafficIn" || entry.kind === "trafficOut" || entry.unit === "bps") return formatBits(value);

    return value.toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    });
  }

  function tooltipLabelForChart(entry: MonitoringReportSeries) {
    if (entry.kind === "ping") return "Latência";
    if (entry.kind === "loss") return "Perda de pacote";
    if (entry.kind === "trafficIn") return "Download";
    if (entry.kind === "trafficOut") return "Upload";

    return entry.label || "Valor";
  }

  function tooltipBoxX(x: number) {
    return Math.min(Math.max(x + 14, pad.left + 8), width - pad.right - 186);
  }

  function tooltipBoxY(y: number) {
    return Math.min(Math.max(y - 78, pad.top + 8), height - pad.bottom - 82);
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#07101a,#060b12)] shadow-[0_10px_26px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.025)]"><svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfico histórico de monitoramento"
        className="h-auto w-full"
      ><defs>
          {usableSeries.map(({ entry }) => (
            <linearGradient key={`${id}-${entry.id}-fill`} id={`${id}-${entry.id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={chartStrokeColor(entry)} stopOpacity={isTraffic ? "0.25" : "0.16"} /><stop offset="100%" stopColor={chartStrokeColor(entry)} stopOpacity="0" /></linearGradient>
          ))}
          <linearGradient id={`${id}-good-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.13" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0.06" /></linearGradient><linearGradient id={`${id}-warn-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.14" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0.06" /></linearGradient><linearGradient id={`${id}-critical-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity="0.16" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0.08" /></linearGradient></defs>

        {showThresholdBands ? (
          <><rect x={pad.left} y={yFor(pingMax, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, yFor(100, pingEntry?.entry || usableSeries[0].entry) - yFor(pingMax, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-critical-band)`} /><rect x={pad.left} y={yFor(100, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, yFor(50, pingEntry?.entry || usableSeries[0].entry) - yFor(100, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-warn-band)`} /><rect x={pad.left} y={yFor(50, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, height - pad.bottom - yFor(50, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-good-band)`} /><text x={pad.left + 10} y={yFor(118, pingEntry?.entry || usableSeries[0].entry)} fill="#fb7185" fontSize="12" fontWeight="700">Crítico &gt; 100 ms</text><text x={pad.left + 10} y={yFor(74, pingEntry?.entry || usableSeries[0].entry)} fill="#fbbf24" fontSize="12" fontWeight="700">Atenção 50–100 ms</text><text x={pad.left + 10} y={yFor(28, pingEntry?.entry || usableSeries[0].entry)} fill="#4ade80" fontSize="12" fontWeight="700">Bom &lt; 50 ms</text></>
        ) : null}

        {!isMini ? (
          <>
            {[0, 1, 2, 3, 4].map((line) => {
              const y = pad.top + (plotHeight / 4) * line;
              return (
                <line
                  key={`${id}-grid-${line}`}
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="4 5"
                />
              );
            })}
            {xTicks.map((tick) => (
              <line
                key={`${id}-xgrid-${tick.clock}`}
                x1={tick.x}
                x2={tick.x}
                y1={pad.top}
                y2={height - pad.bottom}
                stroke="rgba(148,163,184,0.08)"
              />
            ))}
          </>
        ) : null}

        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="rgba(148,163,184,0.2)" />

        {projectedSeries.map(({ entry, projected, linePath, areaPath }) => {
          const color = chartStrokeColor(entry);
          const last = projected.at(-1);
          const shouldFill = isTraffic || (isPingLoss && (entry.unit === "ms" || entry.kind === "ping"));
          const dash = isPingLoss && entry.kind === "loss" && !isMini ? "8 6" : undefined;

          return (
            <g key={`${id}-${entry.id}`}>
              {shouldFill ? <path d={areaPath} fill={`url(#${id}-${entry.id}-fill)`} /> : null}
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={isMini ? "1.6" : "2.4"}
                strokeDasharray={dash}
                opacity={isMini ? "0.86" : "1"}
              />
              {!isMini && last ? <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="#070b12" strokeWidth="2" /> : null}
            </g>
          );
        })}

        {!isMini && projectedSeries.length
          ? (() => {
              const referenceSeries = projectedSeries.reduce(
                (best, current) => current.projected.length > best.projected.length ? current : best,
                projectedSeries[0]
              );
              const maxHoverItems = 520;
              const step = Math.max(1, Math.ceil(referenceSeries.projected.length / maxHoverItems));
              const sampled = referenceSeries.projected.filter((_, index) => index % step === 0 || index === referenceSeries.projected.length - 1);

              return sampled.map((point, index) => {
                const previous = sampled[index - 1];
                const next = sampled[index + 1];
                const leftEdge = previous ? (previous.x + point.x) / 2 : pad.left;
                const rightEdge = next ? (next.x + point.x) / 2 : width - pad.right;
                const hoverWidth = Math.max(rightEdge - leftEdge, 5);
                const related = projectedSeries
                  .map(({ entry, projected }) => {
                    const nearest = projected.reduce(
                      (best, candidate) => Math.abs(candidate.x - point.x) < Math.abs(best.x - point.x) ? candidate : best,
                      projected[0]
                    );

                    return {
                      entry,
                      point: nearest,
                      color: chartStrokeColor(entry),
                    };
                  })
                  .filter((item) => item.point);

                const tooltipWidth = related.length > 1 ? 230 : 188;
                const tooltipHeight = 50 + related.length * 22;
                const anchorY = related[0]?.point.y ?? point.y;
                const boxX = Math.min(Math.max(point.x + 14, pad.left + 8), width - pad.right - tooltipWidth - 8);
                const boxY = Math.min(Math.max(anchorY - 44, pad.top + 8), height - pad.bottom - tooltipHeight - 8);

                return (
                  <g key={`${id}-hover-zone-${index}`} className="group"><rect
                      x={leftEdge}
                      y={pad.top}
                      width={hoverWidth}
                      height={plotHeight}
                      fill="transparent"
                      pointerEvents="all"
                      className="cursor-crosshair"
                    /><g className="pointer-events-none opacity-0 transition-opacity duration-100 group-hover:opacity-100"><line
                        x1={point.x}
                        x2={point.x}
                        y1={pad.top}
                        y2={height - pad.bottom}
                        stroke="rgba(226,232,240,0.42)"
                        strokeDasharray="4 5"
                      />
                      {related.map(({ entry, point: relatedPoint, color }) => (
                        <circle
                          key={`${entry.id}-marker`}
                          cx={relatedPoint.x}
                          cy={relatedPoint.y}
                          r="5"
                          fill="#07101a"
                          stroke={color}
                          strokeWidth="2.5"
                        />
                      ))}
                      <g transform={`translate(${boxX}, ${boxY})`}><rect
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx="12"
                          fill="#080f18"
                          stroke="rgba(255,255,255,0.16)"
                        /><text x="14" y="22" fill="#e5e7eb" fontSize="12" fontWeight="700">
                          {formatChartTimestamp(point.clock, true)}
                        </text>
                        {related.map(({ entry, point: relatedPoint, color }, itemIndex) => (
                          <g key={`${entry.id}-tooltip`} transform={`translate(14, ${44 + itemIndex * 22})`}><circle cx="0" cy="-4" r="3" fill={color} /><text x="12" y="0" fill="#cbd5e1" fontSize="11" fontWeight="600">
                              {tooltipLabelForChart(entry)}
                            </text><text x={tooltipWidth - 28} y="0" textAnchor="end" fill={color} fontSize="12" fontWeight="800">
                              {tooltipValueForChart(entry, relatedPoint.value)}
                            </text></g>
                        ))}
                      </g></g></g>
                );
              });
            })()
          : null}

        {maxMarker && isPingLoss && !isMini ? (
          <g><line
              x1={maxMarker.x}
              x2={maxMarker.x}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke={semanticColorForStatus(trendStatusForLatency(maxMarker.value))}
              strokeOpacity="0.5"
              strokeDasharray="4 5"
            /><circle
              cx={maxMarker.x}
              cy={maxMarker.y}
              r="5"
              fill="#070b12"
              stroke={semanticColorForStatus(trendStatusForLatency(maxMarker.value))}
              strokeWidth="3"
            /><g transform={`translate(${Math.min(Math.max(maxMarker.x + 18, pad.left + 12), width - pad.right - 190)}, ${Math.max(maxMarker.y - 58, pad.top + 12)})`}><rect width="178" height="70" rx="12" fill="#0b111a" stroke="rgba(255,255,255,0.14)" /><text x="14" y="22" fill="#e5e7eb" fontSize="13" fontWeight="700">Pico de latência</text><text x="14" y="42" fill="#94a3b8" fontSize="12">{formatChartTimestamp(maxMarker.clock, true)}</text><text x="14" y="60" fill={semanticColorForStatus(trendStatusForLatency(maxMarker.value))} fontSize="12" fontWeight="700">{formatMs(maxMarker.value)}</text></g></g>
        ) : null}

        {!isMini ? (
          <><text x={pad.left} y={18} fill={primaryEntry ? chartStrokeColor(primaryEntry) : "#94a3b8"} fontSize="12" fontWeight="700">
              {primaryAxisLabel}
            </text>
            {pingTicks.map((tick) => {
              const y = isPingLoss ? yFor(tick, pingEntry?.entry || usableSeries[0].entry) : yFor(tick, usableSeries[0].entry);
              return (
                <text key={`${id}-left-${tick}`} x={pad.left - 10} y={y + 4} textAnchor="end" fill="rgba(226,232,240,0.78)" fontSize="12">
                  {isPingLoss ? tick.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : chartAxisValue(tick, usableSeries[0].entry.unit)}
                </text>
              );
            })}
            {isPingLoss && lossEntry ? (
              <><text x={width - pad.right} y={18} textAnchor="end" fill={chartStrokeColor(lossEntry.entry)} fontSize="12" fontWeight="700">Perda (%)</text>
                {lossTicks.map((tick) => (
                  <text key={`${id}-right-${tick}`} x={width - pad.right + 8} y={yFor(tick, lossEntry.entry) + 4} fill={chartStrokeColor(lossEntry.entry)} fontSize="12">
                    {tick.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </text>
                ))}
              </>
            ) : null}
            {xTicks.map((tick) => (
              <text key={`${id}-xlabel-${tick.clock}`} x={tick.x} y={height - 15} textAnchor="middle" fill="rgba(148,163,184,0.82)" fontSize="12">
                {tick.label}
              </text>
            ))}
          </>
        ) : (
          <><rect x={pad.left} y={pad.top} width={plotWidth} height={plotHeight} rx="8" fill="rgba(59,130,246,0.07)" stroke="rgba(96,165,250,0.24)" /><rect x={pad.left} y={pad.top + 4} width="8" height={plotHeight - 8} rx="4" fill="rgba(226,232,240,0.9)" /><rect x={width - pad.right - 8} y={pad.top + 4} width="8" height={plotHeight - 8} rx="4" fill="rgba(226,232,240,0.9)" /></>
        )}
      </svg></div>
  );
}

function TrendStatCard({ series }: { series: MonitoringReportSeries }) {
  const comparison = compareSeriesHalves(series);
  const delta = comparison?.delta ?? null;

  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {series.label}
          </div><div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {formatReportValue(series.stats.avg, series.unit)}
          </div></div>
        {delta !== null ? (
          <TonePill tone={deltaTone(series, delta)}>
            {delta > 0 ? "+" : ""}
            {formatReportValue(delta, series.unit)}
          </TonePill>
        ) : null}
      </div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><div>
          mínimo <span className="text-slate-300">{formatReportValue(series.stats.min, series.unit)}</span></div><div>
          pico <span className="text-slate-300">{formatReportValue(series.stats.max, series.unit)}</span></div></div></div>
  );
}

function MonitoringKpiCard({
  label,
  value,
  tone,
  series,
  helper,
}: {
  label: string;
  value: string;
  tone: "success" | "attention" | "critical" | "neutral";
  series?: MonitoringReportSeries | null;
  helper?: string;
}) {
  const points = series ? cleanSeriesPoints(series).slice(-70) : [];
  const width = 180;
  const height = 32;
  const pad = 2;
  const min = points.length ? Math.min(...points.map((point) => point.value), 0) : 0;
  const max = points.length ? Math.max(...points.map((point) => point.value), 1) : 1;
  const minClock = points.length ? points[0].clock : 0;
  const maxClock = points.length ? points[points.length - 1].clock : 1;
  const range = Math.max(max - min, 1);
  const path = points.length > 1
    ? pathFromPoints(
        points.map((point) => ({
          x: ((point.clock - minClock) / Math.max(maxClock - minClock, 1)) * (width - pad * 2) + pad,
          y: (1 - (point.value - min) / range) * (height - pad * 2) + pad,
        })),
      )
    : "";
  const color = semanticColorForStatus(tone);

  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(11,18,28,0.96),rgba(8,12,18,0.99))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div><div className="mt-2 whitespace-nowrap text-[1.65rem] font-semibold leading-none tracking-tight text-white tabular-nums">{value}</div>
          {helper ? (
            <div className="mt-2 text-[11px] font-medium text-slate-500">{helper}</div>
          ) : null}
        </div><span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /></span></div><div className="mt-4 h-8 rounded-[10px] border border-white/[0.06] bg-black/20 px-1.5 py-1">
        {path ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true"><path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
        ) : (
          <div className="flex h-full items-center text-[11px] text-slate-600">Sem histórico</div>
        )}
      </div></div>
  );
}

type MonitoringEventRow = {
  id: string;
  icon: string;
  event: string;
  details: string;
  severity: "Crítico" | "Atenção" | "Informativo";
  startedAt: string;
  status: "Resolvido" | "Concluído" | "Aberto";
};

function severityClasses(severity: MonitoringEventRow["severity"]) {
  if (severity === "Crítico") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  if (severity === "Atenção") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-sky-400/20 bg-sky-500/10 text-sky-200";
}

function statusClasses(status: MonitoringEventRow["status"]) {
  if (status === "Aberto") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
}

function MonitoringEventsCard({ events }: { events: MonitoringEventRow[] }) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,13,19,0.98),rgba(8,11,18,0.98))] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-sky-400/20 bg-sky-500/10 text-sky-200"><IconAlertList className="h-5 w-5" /></span><div className="min-w-0"><div className="text-[1.28rem] font-semibold tracking-tight text-white">Eventos e alertas recentes</div></div></div><TonePill tone={events.some((event) => event.severity === "Crítico" && event.status === "Aberto") ? "critical" : events.length ? "info" : "success"}>
          {events.length ? `${events.length} evento(s)` : "sem alertas"}
        </TonePill></div><div className="mt-5 overflow-hidden rounded-[18px] border border-white/[0.08] bg-black/20"><div className="grid grid-cols-[minmax(180px,1.1fr)_minmax(220px,1.4fr)_120px_150px_110px] gap-4 border-b border-white/[0.08] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 max-xl:hidden"><span>Evento</span><span>Detalhes</span><span>Severidade</span><span>Início</span><span>Status</span></div>

        {events.length ? (
          <div className="divide-y divide-white/[0.06]">
            {events.map((event) => (
              <div key={event.id} className="grid gap-3 px-5 py-4 text-sm text-slate-300 xl:grid-cols-[minmax(180px,1.1fr)_minmax(220px,1.4fr)_120px_150px_110px] xl:items-center xl:gap-4"><div className="flex min-w-0 items-center gap-3 font-medium text-slate-100"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xs">{event.icon}</span><span className="truncate">{event.event}</span></div><div className="text-slate-400">{event.details}</div><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses(event.severity)}`}>{event.severity}</span></div><div className="text-slate-400">{event.startedAt}</div><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(event.status)}`}>{event.status}</span></div></div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhum alerta operacional gerado para esta janela.</div>
        )}
      </div></div>
  );
}

function MonitoringMetricCard({
  title,
  value,
  subtitle,
  accentClass,
  series,
}: {
  title: string;
  value: string;
  subtitle: string;
  accentClass: string;
  series?: MonitoringReportSeries | null;
}) {
  const points = series ? cleanSeriesPoints(series) : [];
  const width = 220;
  const height = 34;
  const pad = 2;
  const min = points.length ? Math.min(...points.map((point) => point.value), 0) : 0;
  const max = points.length ? Math.max(...points.map((point) => point.value), 1) : 1;
  const minClock = points.length ? points[0].clock : 0;
  const maxClock = points.length ? points[points.length - 1].clock : 1;
  const range = Math.max(max - min, 1);
  const path = points.length > 1
    ? pathFromPoints(
        points.map((point) => ({
          x: ((point.clock - minClock) / Math.max(maxClock - minClock, 1)) * (width - pad * 2) + pad,
          y: (1 - (point.value - min) / range) * (height - pad * 2) + pad,
        })),
      )
    : '';

  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,15,21,0.96),rgba(9,12,18,0.99))] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.03)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div><div className="mt-3 whitespace-nowrap text-[1.75rem] font-semibold leading-none tracking-tight text-white tabular-nums sm:text-[1.95rem]">{value}</div></div><span className={`mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${accentClass}`}>
          ●
        </span></div><div className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</div><div className="mt-4 h-10 rounded-[12px] border border-white/[0.06] bg-black/20 px-2 py-1.5">
        {path ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="2.2" className={accentClass} /></svg>
        ) : (
          <div className="flex h-full items-center text-xs text-slate-600">Sem histórico</div>
        )}
      </div></div>
  );
}

function MonitoringSummaryRow({
  label,
  value,
  percent,
  badge,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  badge?: ReactNode;
  tone?: "success" | "attention" | "critical" | "neutral";
}) {
  const resolvedTone = tone ?? (percent >= 85 ? "success" : percent >= 55 ? "attention" : percent > 0 ? "critical" : "neutral");

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-200">{label}</span><span className="font-semibold text-slate-50 tabular-nums">{value}</span></div><div className="mt-3 flex items-center gap-3"><div className="flex-1"><ChartRangeBar percent={percent} tone={resolvedTone} /></div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div></div>
  );
}

function MonitoringWindowControl({
  unitId,
  active,
  focusMode = false,
}: {
  unitId: string;
  active: MonitoringWindowPreset;
  focusMode?: boolean;
}) {
  const options: Array<{ value: MonitoringWindowPreset; label: string }> = [
    { value: "1h", label: "1H" },
    { value: "6h", label: "6H" },
    { value: "1d", label: "24H" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <Link
            key={option.value}
            href={unitMonitoringHref(unitId, option.value, focusMode ? { focus: "monitoring" } : undefined)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex h-10 items-center justify-center rounded-[14px] border px-3.5 text-xs font-semibold tracking-[0.02em] transition ${
              isActive
                ? "border-sky-400/30 bg-sky-500/12 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]"
                : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function UnitMonitoringVisualPanel({
  unit,
  report,
  snapshot,
  editControl,
  syncControl,
  windowPreset,
  focusMode = false,
}: {
  unit: UnitDetail;
  report: UnitMonitoringReport | null;
  snapshot: UnitZabbixSnapshot | null;
  editControl?: ReactNode;
  syncControl?: ReactNode;
  windowPreset: MonitoringWindowPreset;
  focusMode?: boolean;
}) {
  const pingBlock = report?.blocks.find((block) => block.id === "ping") || null;
  const trafficBlock = report?.blocks.find((block) => block.id === "traffic") || null;
  const pingSeries = pingBlock?.series.find((series) => series.kind === "ping" && seriesHasPoints(series)) || null;
  const lossSeries = pingBlock?.series.find((series) => series.kind === "loss" && seriesHasPoints(series)) || null;
  const trafficSeries = (trafficBlock?.series.filter((series) => ["trafficIn", "trafficOut"].includes(series.kind) && seriesHasPoints(series)) || []);
  const hasHistoricalData = Boolean(report && ([pingSeries, lossSeries].some(Boolean) || trafficSeries.length));
  const hasManualZabbixLink = Boolean(unit.zabbixHost || unit.zabbixVisibleName);
  const hostName =
    report?.host?.hostName ||
    report?.host?.host ||
    snapshot?.match.hostName ||
    snapshot?.match.host ||
    "Sem host confiável";
  const health = snapshot ? labelForHealth(snapshot.health) : "sem leitura";
  const confidence = report?.host?.confidence ?? snapshot?.match.confidence ?? 0;
  const pingOk = snapshot?.metrics.ping?.ok ?? null;
  const lossPercent = lossSeries?.stats.avg ?? snapshot?.metrics.lossPct ?? null;
  const latencyCurrent = pingSeries?.stats.last ?? snapshot?.metrics.latencyMs ?? null;
  const latencyAverage = pingSeries?.stats.avg ?? snapshot?.metrics.latencyMs ?? null;
  const latencyMin = pingSeries?.stats.min ?? null;
  const latencyMax = pingSeries?.stats.max ?? null;
  const trafficInSeries = trafficSeries.find((series) => series.kind === "trafficIn") || null;
  const trafficOutSeries = trafficSeries.find((series) => series.kind === "trafficOut") || null;
  const syncStatusLabel = hasManualZabbixLink ? "Sincronizado" : snapshot?.match.syncReady ? "Conectado" : "Pendente";
  const selectedPeriod = selectedMonitoringPeriod(windowPreset, report?.period.to || report?.generatedAt || null);
  const periodLabel = `${formatShortDate(selectedPeriod.from)} até ${formatShortDate(selectedPeriod.to)}`;
  const lastSyncLabel = formatDate(report?.generatedAt || snapshot?.metrics.ping?.lastClock || null);
  const refreshToken = String(Date.now());
  const latencyCurrentTone = trendStatusForLatency(latencyCurrent);
  const latencyAverageTone = trendStatusForLatency(latencyAverage);
  const latencyMinTone = trendStatusForLatency(latencyMin);
  const latencyMaxTone = trendStatusForLatency(latencyMax);
  const lossTone = trendStatusForLoss(lossPercent);
  const temperatureTone = trendStatusForTemperature(snapshot?.metrics.temperatureC ?? null);
  const availabilityValue = pingOk === false ? "0,00%" : hasHistoricalData ? "100,00%" : "-";
  const syncAgeValue = report?.generatedAt ? "agora" : snapshot?.metrics.ping?.lastClock ? formatDate(snapshot.metrics.ping.lastClock) : "-";
  const latencyChartSeries = pingSeries ? [{ ...pingSeries, color: "#38bdf8", label: "Latência" }] : [];
  const lossChartSeries = lossSeries ? [{ ...lossSeries, color: "#fb7185", label: "Perda de pacote" }] : [];
  const trafficChartSeries = [
    trafficInSeries ? { ...trafficInSeries, color: "#22c55e", label: "Download (entrada)" } : null,
    trafficOutSeries ? { ...trafficOutSeries, color: "#f59e0b", label: "Upload (saída)" } : null,
  ].filter((series): series is MonitoringReportSeries => Boolean(series));
  const monitoringEvents: MonitoringEventRow[] = [
    ...(latencyMax !== null && latencyMax >= 100
      ? [{
          id: "latency-critical",
          icon: "▲",
          event: "Pico de latência detectado",
          details: "Latência acima de 100 ms no período analisado",
          severity: "Crítico" as const,
          startedAt: report?.generatedAt ? formatDate(report.generatedAt) : lastSyncLabel,
          status: "Resolvido" as const,
        }]
      : latencyMax !== null && latencyMax >= 50
        ? [{
            id: "latency-warning",
            icon: "△",
            event: "Latência em atenção",
            details: "Latência passou da faixa ideal no período",
            severity: "Atenção" as const,
            startedAt: report?.generatedAt ? formatDate(report.generatedAt) : lastSyncLabel,
            status: "Resolvido" as const,
          }]
        : []),
    ...(lossPercent !== null && lossPercent >= 1
      ? [{
          id: "packet-loss",
          icon: "△",
          event: "Perda de pacote elevada",
          details: "Perda média acima do limite de atenção",
          severity: lossPercent >= 3 ? "Crítico" as const : "Atenção" as const,
          startedAt: report?.generatedAt ? formatDate(report.generatedAt) : lastSyncLabel,
          status: "Resolvido" as const,
        }]
      : []),
    ...(trafficBlock?.consumption?.peakReceiveBps
      ? [{
          id: "traffic-peak",
          icon: "◆",
          event: "Pico de uso do link",
          details: `Download (entrada) atingiu ${formatBits(trafficBlock.consumption.peakReceiveBps)} no período`,
          severity: "Informativo" as const,
          startedAt: report?.generatedAt ? formatDate(report.generatedAt) : lastSyncLabel,
          status: "Concluído" as const,
        }]
      : []),
    ...(hasHistoricalData
      ? [{
          id: "sync-ok",
          icon: "●",
          event: "Sincronização concluída",
          details: "Dados reais consolidados do Zabbix para esta unidade",
          severity: "Informativo" as const,
          startedAt: lastSyncLabel,
          status: "Concluído" as const,
        }]
      : []),
  ].slice(0, 5);
  const actionButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-[15px] border border-white/10 bg-[rgba(6,10,16,0.86)] px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/20 hover:bg-white/[0.05]";

  return (
    <Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
        eyebrow="Monitoramento"
        title="Operação, histórico e sincronização"
        description={
          hasHistoricalData
            ? `Histórico Zabbix · ${monitoringWindowDescription(windowPreset).toLowerCase()}`
            : `Histórico Zabbix · ${monitoringWindowDescription(windowPreset).toLowerCase()}`
        }
        actions={
          snapshot ? (
            <TonePill tone={toneForHealth(snapshot.health)}>{health}</TonePill>
          ) : (
            <TonePill tone="neutral">sem leitura</TonePill>
          )
        }
        compact
      /><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.8fr)]"><div className="grid gap-4"><div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,13,19,0.98),rgba(8,11,18,0.98))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-sky-400/20 bg-sky-500/10 text-sky-200"><IconPulse className="h-5 w-5" /></span><div className="min-w-0"><div className="text-[1.75rem] font-semibold tracking-tight text-white">Latência e perda</div><div className="mt-1 text-base text-slate-500">{periodLabel}</div></div></div><div className="flex flex-wrap items-center justify-end gap-2"><MonitoringWindowControl unitId={unit.id} active={windowPreset} focusMode={focusMode} /><Link
                  href={monitoringReportHref(unit.id, windowPreset)}
                  className={`${actionButtonClass} hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-sky-100`}
                  title="Abrir relatório de monitoramento"
                ><span>Relatório</span><IconArrowUpRight /></Link><Link
                  href={focusMode ? unitMonitoringHref(unit.id, windowPreset) : unitMonitoringHref(unit.id, windowPreset, { focus: "monitoring" })}
                  scroll={false}
                  className={`${actionButtonClass} hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-100`}
                ><IconFocus /><span>{focusMode ? "Sair foco" : "Modo foco"}</span></Link><Link
                  href={unitMonitoringHref(unit.id, windowPreset, focusMode ? { refresh: refreshToken, focus: "monitoring" } : { refresh: refreshToken })}
                  scroll={false}
                  className={actionButtonClass}
                ><IconRefresh /><span>Atualizar</span></Link></div></div><div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              {focusMode ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">Modo foco ativo</span> : null}
            </div><div className="mt-6 grid gap-4"><div className="rounded-[22px] border border-white/[0.08] bg-[rgba(8,12,18,0.82)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold tracking-[0.02em] text-white">Latência</div></div><div className="rounded-[14px] border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-right text-xs font-semibold text-sky-100">
                    Atual: {formatMs(latencyCurrent)}
                  </div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">Ideal &lt; 50 ms</span><span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">Atenção 50–100 ms</span><span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-rose-200">Crítico &gt; 100 ms</span></div><div className="mt-4 rounded-[18px] border border-white/[0.08] bg-black/20 p-3.5">
                  {latencyChartSeries.length ? (
                    <TrendChart id="unit-latency-main" series={latencyChartSeries} height={280} period={selectedPeriod} />
                  ) : (
                    <div className="flex min-h-[190px] items-center justify-center rounded-[16px] border border-dashed border-white/[0.1] bg-black/20 px-4 text-center text-sm leading-6 text-slate-500">
                      Sem série de latência nesta janela. Use 7D ou 30D para conferir histórico consolidado.
                    </div>
                  )}
                </div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atual</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatMs(latencyCurrent)}</div></div><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Média</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatMs(latencyAverage)}</div></div><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pico</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatMs(latencyMax)}</div></div></div></div><div className="rounded-[22px] border border-white/[0.08] bg-[rgba(8,12,18,0.82)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold tracking-[0.02em] text-white">Perda de pacote</div></div><div className="rounded-[14px] border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-right text-xs font-semibold text-rose-100">
                    Média: {formatPercent(lossPercent)}
                  </div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">Ideal &lt; 1%</span><span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">Atenção 1–3%</span><span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-rose-200">Crítico &gt; 3%</span></div><div className="mt-4 rounded-[18px] border border-white/[0.08] bg-black/20 p-3.5">
                  {lossChartSeries.length ? (
                    <TrendChart id="unit-loss-main" series={lossChartSeries} height={230} period={selectedPeriod} />
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center rounded-[16px] border border-dashed border-white/[0.1] bg-black/20 px-4 text-center text-sm leading-6 text-slate-500">
                      Sem série de perda nesta janela. Use 7D ou 30D para conferir histórico consolidado.
                    </div>
                  )}
                </div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atual</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatPercent(lossSeries?.stats.last ?? lossPercent)}</div></div><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Média</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatPercent(lossPercent)}</div></div><div className="rounded-[14px] border border-white/[0.06] bg-black/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pico</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatPercent(lossSeries?.stats.max ?? null)}</div></div></div></div></div></div><div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,13,19,0.98),rgba(8,11,18,0.98))] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-sky-400/20 bg-sky-500/10 text-sky-200"><IconServer className="h-5 w-5" /></span><div><div className="text-[1.55rem] font-semibold tracking-tight text-white">Consumo do link</div></div></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Download (entrada)
                </span><span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-300" />
                  Upload (saída)
                </span><span className="inline-flex h-10 items-center rounded-[14px] border border-white/10 bg-black/20 px-3.5 text-sm font-semibold text-white">Bits/s</span></div></div><div className="mt-5 rounded-[20px] border border-white/[0.08] bg-black/20 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {trafficChartSeries.length ? (
                <TrendChart id="unit-traffic-main" series={trafficChartSeries} height={240} period={selectedPeriod} />
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-[16px] border border-dashed border-white/[0.1] bg-black/20 px-4 text-center text-sm leading-6 text-slate-500">
                  Sem tráfego nesta janela. Use 7D ou 30D para conferir consumo consolidado.
                </div>
              )}
            </div><div className="mt-4 grid gap-3 border-t border-white/[0.08] pt-4 text-sm sm:grid-cols-2 xl:grid-cols-5"><div className="min-w-0 rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-slate-500">Total do período</div><div className="mt-2 whitespace-nowrap text-[1.35rem] font-semibold leading-none text-white tabular-nums">{formatBytes(trafficBlock?.consumption?.totalBytes ?? null)}</div></div><div className="min-w-0 rounded-[16px] border border-emerald-400/10 bg-emerald-500/[0.03] p-3"><div className="text-slate-500">Média download</div><div className="mt-2 whitespace-nowrap text-[1.2rem] font-semibold leading-tight text-emerald-300 tabular-nums">{formatBits(trafficBlock?.consumption?.avgReceiveBps ?? null)}</div></div><div className="min-w-0 rounded-[16px] border border-amber-400/10 bg-amber-500/[0.03] p-3"><div className="text-slate-500">Média upload</div><div className="mt-2 whitespace-nowrap text-[1.2rem] font-semibold leading-tight text-amber-300 tabular-nums">{formatBits(trafficBlock?.consumption?.avgSendBps ?? null)}</div></div><div className="min-w-0 rounded-[16px] border border-emerald-400/10 bg-emerald-500/[0.03] p-3"><div className="text-slate-500">Pico download</div><div className="mt-2 whitespace-nowrap text-[1.2rem] font-semibold leading-tight text-emerald-300 tabular-nums">{formatBits(trafficBlock?.consumption?.peakReceiveBps ?? null)}</div></div><div className="min-w-0 rounded-[16px] border border-amber-400/10 bg-amber-500/[0.03] p-3"><div className="text-slate-500">Pico upload</div><div className="mt-2 whitespace-nowrap text-[1.2rem] font-semibold leading-tight text-amber-300 tabular-nums">{formatBits(trafficBlock?.consumption?.peakSendBps ?? null)}</div></div></div></div></div><div className="grid content-start gap-4"><div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,13,19,0.98),rgba(8,11,18,0.98))] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-sky-400/20 bg-sky-500/10 text-sky-200"><IconPulse className="h-5 w-5" /></span><div><div className="text-[1.38rem] font-semibold tracking-tight text-white">Status da unidade</div><div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {monitoringWindowLabel(windowPreset)}
                  </div></div></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                snapshot
                  ? toneForHealth(snapshot.health) === "success"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : toneForHealth(snapshot.health) === "attention"
                      ? "bg-amber-500/15 text-amber-200"
                      : "bg-rose-500/15 text-rose-200"
                  : "bg-slate-500/15 text-slate-300"
              }`}><span className="h-1.5 w-1.5 rounded-full bg-current" />
                {snapshot ? health : "sem leitura"}
              </span></div><div className="mt-5 grid gap-3"><MonitoringSummaryRow
                label="Confiança"
                value={`${confidence}%`}
                percent={confidence}
                tone={confidence >= 85 ? "success" : confidence >= 55 ? "attention" : confidence > 0 ? "critical" : "neutral"}
              /><MonitoringSummaryRow
                label="Ping"
                value={pingOk === null ? "-" : pingOk ? "UP" : "DOWN"}
                percent={pingOk === null ? 0 : pingOk ? 100 : 15}
                tone={pingOk === null ? "neutral" : pingOk ? "success" : "critical"}
                badge={pingOk === null ? null : (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pingOk ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>
                    {pingOk ? "UP" : "DOWN"}
                  </span>
                )}
              /><MonitoringSummaryRow
                label="Perda"
                value={formatPercent(lossPercent)}
                percent={Math.max(5, 100 - Math.min((lossPercent ?? 0) * 100, 100))}
                tone={lossTone}
              /><MonitoringSummaryRow
                label="Temperatura"
                value={formatTemperature(snapshot?.metrics.temperatureC ?? null)}
                percent={snapshot?.metrics.temperatureC ? Math.min((snapshot.metrics.temperatureC / 60) * 100, 100) : 0}
                tone={temperatureTone}
              /><MonitoringSummaryRow
                label="Inventário"
                value={`${unit._count.equipments} ativo(s)`}
                percent={Math.min(unit._count.equipments * 10, 100)}
                tone={unit._count.equipments > 0 ? "success" : "neutral"}
              /></div><div className="mt-5 rounded-[18px] border border-white/[0.08] bg-black/20 p-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"><div className="grid gap-3"><div><div className="text-xs text-slate-500">Host Zabbix</div><div className="mt-1 break-all font-semibold text-white">{unit.zabbixHost || hostName}</div></div><div><div className="text-xs text-slate-500">Nome visível</div><div className="mt-1 break-all font-semibold text-white">{unit.zabbixVisibleName || report?.host?.hostName || "-"}</div></div><div className="grid gap-2 border-t border-white/[0.08] pt-3 text-slate-400"><div className="flex items-center justify-between gap-3"><span>Última sincronização</span><span className="text-right text-slate-200">{lastSyncLabel}</span></div><div className="flex items-center justify-between gap-3"><span>Integração</span><span className="text-right text-slate-200">{report?.integration?.code || snapshot?.match.integrationCode || "sem fonte"}</span></div><div className="flex items-center justify-between gap-3"><span>Vínculo</span><span className="text-right text-slate-200">{hasManualZabbixLink ? "manual" : snapshot?.match.syncReady ? "automático" : "pendente"}</span></div></div></div></div>



            {(editControl || syncControl) ? (
              <div className="mt-6 grid gap-3">
                {syncControl ? (
                  <div className="w-full [&_form]:m-0 [&_form]:w-full [&_form]:border-0 [&_form]:bg-transparent [&_form]:p-0 [&_form]:shadow-none [&_form>div]:m-0 [&_form>div]:border-0 [&_form>div]:bg-transparent [&_form>div]:p-0 [&_form>div]:shadow-none [&_button]:h-12 [&_button]:w-full [&_button]:justify-center [&_button]:rounded-[14px] [&_button]:border [&_button]:border-sky-300/35 [&_button]:bg-[linear-gradient(180deg,#1677ff,#0f63d6)] [&_button]:px-4 [&_button]:py-3 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-[0_12px_28px_rgba(37,99,235,0.24)] hover:[&_button]:brightness-110">
                    {syncControl}
                  </div>
                ) : null}
                {editControl ? (
                  <div className="[&_button]:w-full [&_button]:justify-center [&_button]:rounded-[14px] [&_button]:border [&_button]:border-white/10 [&_button]:bg-[rgba(6,10,16,0.86)] [&_button]:px-4 [&_button]:py-3 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-white hover:[&_button]:border-white/20 hover:[&_button]:bg-white/[0.05]">
                    {editControl}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div></div></div><div className="mt-4"><MonitoringEventsCard events={monitoringEvents} /></div></Surface>
  );
}

function LegacyLinkCard({
  title,
  link,
}: {
  title: string;
  link: LegacyLink;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-50">{title}</div><TonePill tone="info">{link.partnerCode}</TonePill></div><div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2"><div>Serviço: <span className="text-slate-200">{link.serviceType || "-"}</span></div><div>Conexão: <span className="text-slate-200">{link.connectionType || "-"}</span></div><div>Porta RB: <span className="text-slate-200">{link.routerPort || "-"}</span></div><div>Tecnologia: <span className="text-slate-200">{link.technology || "-"}</span></div><div>Latência: <span className="text-slate-200">{link.latency || "-"}</span></div><div>Acionamento: <span className="text-slate-200">{link.phone || "-"}</span></div><div>Contrato IXC: <span className="text-slate-200">{link.contractIxc || "-"}</span></div><div className="md:col-span-2">
          MAC/ONU: <span className="break-all text-slate-200">{link.macOnu || "-"}</span></div>
        {link.notes ? (
          <div className="md:col-span-2">
            Observação: <span className="text-slate-200">{link.notes}</span></div>
        ) : null}
      </div></div>
  );
}

function LegacyUnitBlock({ profile }: { profile: LegacyUnitProfile | null }) {
  if (!profile) return null;

  if (!profile.sourceAvailable) {
    return (
      <Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
          eyebrow="Legado"
          title="Base legada pronta para conectar"
          description={profile.message || "Gere o arquivo legado para exibir transporte, contatos e Starlinks nesta tela."}
          compact
        /></Surface>
    );
  }

  const hasLegacy =
    profile.links.length ||
    profile.backupLinks.length ||
    profile.partnerContacts.length ||
    profile.starlinks.length ||
    profile.equipments.length;

  if (!hasLegacy) return null;

  return (
    <Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
        eyebrow="Legado operacional"
        title="Acionamento, transporte e contingência"
        description="Dados importados dos SQLite de contatos, parceiros e Starlinks para apoiar reconciliação operacional."
        actions={
          profile.redactedSecrets ? (
            <TonePill tone="attention">segredos ocultos</TonePill>
          ) : (
            <TonePill tone="success">completo</TonePill>
          )
        }
        compact
      /><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-3">
          {profile.links.map((link, index) => (
            <LegacyLinkCard
              key={`legacy-link-${link.legacyId}-${index}`}
              title={index === 0 ? "Link principal" : `Link principal ${index + 1}`}
              link={link}
            />
          ))}

          {profile.backupLinks.map((link, index) => (
            <LegacyLinkCard
              key={`legacy-backup-${link.legacyId}-${index}`}
              title={index === 0 ? "Backup / contingência" : `Backup ${index + 1}`}
              link={link}
            />
          ))}

          {profile.starlinks.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-50">Starlink</div><TonePill tone="info">{profile.starlinks.length}</TonePill></div><div className="mt-3 grid gap-3">
                {profile.starlinks.map((item) => (
                  <div key={item.legacyId} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400"><div className="font-medium text-slate-100">
                      {item.antennaId || item.kitSerial || "Starlink"}
                    </div><div className="mt-1">Local: <span className="text-slate-200">{item.localName || "-"}</span></div><div>IP VPN: <span className="text-slate-200">{item.ipvpn || "-"}</span></div><div>Kit: <span className="break-all text-slate-200">{item.kitSerial || "-"}</span></div><div>Antena: <span className="break-all text-slate-200">{item.antennaSerial || "-"}</span></div><div>Instalação: <span className="text-slate-200">{item.installedAt || "-"}</span></div>
                    {item.notes ? <div className="mt-1 text-slate-300">{item.notes}</div> : null}
                  </div>
                ))}
              </div></div>
          ) : null}
        </div><div className="grid content-start gap-3">
          {profile.unit ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="text-sm font-semibold text-slate-50">Resumo legado</div><div className="mt-3 grid gap-2 text-sm text-slate-400"><div>Grupo: <span className="text-slate-200">{profile.unit.group || "-"}</span></div><div>Contratos: <span className="text-slate-200">{profile.unit.contracts.join(", ") || "-"}</span></div><div>Telefones: <span className="text-slate-200">{profile.unit.phones.join(", ") || "-"}</span></div></div></div>
          ) : null}

          <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="text-sm font-semibold text-slate-50">Contatos do parceiro</div><div className="mt-3 grid gap-2">
              {profile.partnerContacts.length ? (
                profile.partnerContacts.slice(0, 6).map((contact) => (
                  <div key={contact.legacyId} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3"><div className="text-sm font-medium text-slate-100">{contact.name || "Contato"}</div><div className="mt-1 text-xs text-slate-500">
                      {[contact.role, contact.city].filter(Boolean).join(" · ") || "Sem cargo/cidade"}
                    </div><div className="mt-1 text-sm text-slate-300">{contact.phone || "-"}</div>
                    {contact.notes ? <div className="mt-1 text-xs text-slate-500">{contact.notes}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">Nenhum contato legado vinculado.</div>
              )}
            </div></div>

          {profile.equipments.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-50">Ativos legados</div><TonePill tone="success">{profile.equipments.length}</TonePill></div><div className="mt-3 grid gap-2">
                {profile.equipments.slice(0, 8).map((equipment) => (
                  <div key={`${equipment.source}-${equipment.tag}-${equipment.serialNumber}`} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3"><div className="text-sm font-medium text-slate-100">{equipment.tag || equipment.name || "Ativo legado"}</div><div className="mt-1 text-xs text-slate-500">
                      {[equipment.type, equipment.source].filter(Boolean).join(" · ") || "Sem tipo"}
                    </div><div className="mt-1 break-all text-sm text-slate-300">{equipment.serialNumber || "Sem serial/MAC"}</div></div>
                ))}
              </div></div>
          ) : null}

          {profile.starlinkHistory.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="text-sm font-semibold text-slate-50">Histórico Starlink</div><div className="mt-3 grid gap-2">
                {profile.starlinkHistory.map((item) => (
                  <div key={item.legacyId} className="text-sm text-slate-400"><span className="text-slate-200">{item.action}</span> · {item.datetime}
                  </div>
                ))}
              </div></div>
          ) : null}
        </div></div></Surface>
  );
}

export default async function UnidadeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/unidades");
  }

  async function updateUnit(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");
      const previousPartnerId = String(formData.get("previousPartnerId") || "");
      const nextPartnerId = String(formData.get("partnerId") || "");

      await apiJson(`/units/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          city: String(formData.get("city") || ""),
          state: String(formData.get("state") || ""),
          partnerId: nextPartnerId,
          zabbixHost: String(formData.get("zabbixHost") || ""),
          zabbixVisibleName: String(formData.get("zabbixVisibleName") || ""),
          reportContractLabel: String(formData.get("reportContractLabel") || ""),
          reportAddressLine: String(formData.get("reportAddressLine") || ""),
          reportContractedBandwidth: String(formData.get("reportContractedBandwidth") || ""),
          reportNotes: String(formData.get("reportNotes") || ""),
          isActive: formData.get("isActive") === "on",
        }),
      });

      revalidatePath("/unidades");
      revalidatePath(`/unidades/${id}`);
      revalidatePath("/monitoramento");
      revalidatePath("/parceiros");
      if (previousPartnerId) revalidatePath(`/parceiros/${previousPartnerId}`);
      if (nextPartnerId) revalidatePath(`/parceiros/${nextPartnerId}`);
      revalidatePath("/integracoes");
      revalidatePath("/reconciliacao-central");
      revalidatePath("/relatorios/monitoramento");

      return { status: "success", message: "Unidade atualizada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function deleteUnit(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    const id = String(formData.get("id") || "");
    const partnerId = String(formData.get("partnerId") || "");

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }
      if (formData.get("confirmDelete") !== "yes") {
        return { status: "error", message: "Confirme a exclusão para continuar." };
      }

      await apiJson(`/units/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      revalidatePath("/unidades");
      revalidatePath(`/unidades/${id}`);
      revalidatePath("/monitoramento");
      revalidatePath("/relatorios/monitoramento");
      if (partnerId) revalidatePath(`/parceiros/${partnerId}`);
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect("/unidades?active=true");
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const created = readStringParam(resolvedSearchParams, "created") === "1";
  const from = readStringParam(resolvedSearchParams, "from");
  const monitoringWindow = normalizeMonitoringWindow(readStringParam(resolvedSearchParams, "mw"));
  const focusMode = readStringParam(resolvedSearchParams, "focus") === "monitoring";

  const [unit, zabbixSnapshot, monitoringReportBase, partnersResponse] = await Promise.all([
    apiJson<UnitDetail>(`/units/${resolvedParams.id}`),
    readUnitZabbixSnapshot(resolvedParams.id),
    readUnitMonitoringReport(resolvedParams.id, "30d"),
    apiJson<PaginatedResponse<PartnerOption>>(
      "/partners?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
  ]);
  const monitoringReport = narrowMonitoringReport(monitoringReportBase, monitoringWindow);
  const legacyProfile = (await getLegacyUnitProfileForUnit(unit)) satisfies LegacyUnitProfile | null;
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const canEditAttachments = ["admin", "editor"].includes(role);
  const sensorCount = zabbixSensorCount(zabbixSnapshot);
  const showUnitCode = !isRedundantLabel(unit.code, unit.name);
  const showPartnerCode = !isRedundantLabel(unit.partner.code, unit.partner.name);
  const partnerOptions = partnersResponse.items;

  const unitEditSteps = [
    {
      title: "Base",
      description: "Código, nome e localização principal da unidade.",
      body: (
        <div className="grid gap-4 md:grid-cols-2"><input type="hidden" name="id" value={unit.id} /><input type="hidden" name="previousPartnerId" value={unit.partner.id} /><div className="grid gap-2"><label
              htmlFor="unit-code"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Código
            </label><input
              id="unit-code"
              name="code"
              defaultValue={unit.code}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm uppercase text-white outline-none transition focus:border-sky-400/40"
            /></div><div className="grid gap-2"><label
              htmlFor="unit-name"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Nome
            </label><input
              id="unit-name"
              name="name"
              defaultValue={unit.name}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            /></div><div className="grid gap-2"><label
              htmlFor="unit-city"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Cidade
            </label><input
              id="unit-city"
              name="city"
              defaultValue={unit.city || ""}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            /></div><div className="grid gap-2"><label
              htmlFor="unit-state"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              UF
            </label><input
              id="unit-state"
              name="state"
              maxLength={2}
              defaultValue={unit.state || ""}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm uppercase text-white outline-none transition focus:border-sky-400/40"
            /></div></div>
      ),
    },
    {
      title: "Vínculos",
      description: "Parceiro responsável e host Zabbix da unidade.",
      body: (
        <div className="grid gap-4"><div className="grid gap-2"><label
              htmlFor="unit-partner"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Parceiro responsável
            </label><select
              id="unit-partner"
              name="partnerId"
              defaultValue={unit.partner.id}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              {partnerOptions.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.code} - {partner.name}
                </option>
              ))}
            </select></div><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><label
                htmlFor="unit-zabbix-host"
                className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
              >
                Host Zabbix
              </label><input
                id="unit-zabbix-host"
                name="zabbixHost"
                defaultValue={unit.zabbixHost || ""}
                placeholder="Nome técnico do host"
                className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
              /></div><div className="grid gap-2"><label
                htmlFor="unit-zabbix-visible-name"
                className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
              >
                Nome visível no Zabbix
              </label><input
                id="unit-zabbix-visible-name"
                name="zabbixVisibleName"
                defaultValue={unit.zabbixVisibleName || ""}
                placeholder="Nome exibido no host"
                className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
              /></div></div><div className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 text-sm text-slate-400 md:grid-cols-3"><div>
              Host lido:{" "}
              <span className="text-slate-200">
                {zabbixSnapshot?.match.hostName || zabbixSnapshot?.match.host || "sem vínculo"}
              </span></div><div>
              Confiança:{" "}
              <span className="text-slate-200">
                {zabbixSnapshot ? `${zabbixSnapshot.match.confidence}%` : "-"}
              </span></div><div>
              Sensores: <span className="text-slate-200">{sensorCount || "-"}</span></div></div></div>
      ),
    },
    {
      title: "Equipamentos",
      description: "Ativos ligados a esta unidade.",
      body: (
        <div className="grid gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-100">
              {unit.equipments.length} equipamento(s) vinculado(s)
            </div><Link
              href={`/equipamentos/nova?unitId=${unit.id}`}
              className="rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
            >
              Novo equipamento nesta unidade
            </Link></div>

          {unit.equipments.length ? (
            <div className="grid gap-2">
              {unit.equipments.map((equipment) => (
                <div
                  key={equipment.id}
                  className="grid gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4 text-sm md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-center"
                ><div className="min-w-0"><div className="truncate font-semibold text-slate-50">{equipment.tag}</div><div className="mt-1 truncate text-slate-400">{equipment.name}</div><div className="mt-1 break-all text-xs text-slate-500">
                      {equipment.serialNumber || "sem serial/MAC"}
                    </div></div><TonePill tone={toneForStatus(equipment.status)}>{equipment.status}</TonePill><Link
                    href={`/equipamentos/${equipment.id}`}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-center text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Editar ativo
                  </Link></div>
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-400">
              Nenhum equipamento vinculado a esta unidade.
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Relatório",
      description: "Dados oficiais usados automaticamente no DOCX/PDF da unidade.",
      body: (
        <div className="grid gap-4"><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><label
              htmlFor="unit-report-contract"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Contrato do relatório
            </label><input
              id="unit-report-contract"
              name="reportContractLabel"
              defaultValue={unit.reportContractLabel || ""}
              placeholder="Contrato nº ..."
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            /></div><div className="grid gap-2"><label
              htmlFor="unit-report-bandwidth"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Banda contratada
            </label><input
              id="unit-report-bandwidth"
              name="reportContractedBandwidth"
              defaultValue={unit.reportContractedBandwidth || ""}
              placeholder="Ex.: 100 Mbps"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            /></div></div><div className="grid gap-2"><label
              htmlFor="unit-report-address"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Endereço do relatório
            </label><input
              id="unit-report-address"
              name="reportAddressLine"
              defaultValue={unit.reportAddressLine || ""}
              placeholder="Vazio usa Cidade - UF"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            /></div><div className="grid gap-2"><label
              htmlFor="unit-report-notes"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Observações do relatório
            </label><textarea
              id="unit-report-notes"
              name="reportNotes"
              defaultValue={unit.reportNotes || ""}
              rows={3}
              placeholder="Observações internas para emissão do relatório"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            /></div><div className="rounded-[16px] border border-sky-500/15 bg-sky-500/[0.06] p-4 text-sm leading-6 text-slate-300">
              Estes campos alimentam automaticamente o relatório oficial de consumo. Na tela do relatório, ainda é possível sobrescrever manualmente para uma emissão específica.
            </div></div>
      ),
    },
    {
      title: "Fechamento",
      description: "Status final e revisão rápida antes de salvar.",
      body: (
        <div className="grid gap-4"><label className="flex items-start gap-3 rounded-[16px] border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-slate-300"><input
              type="checkbox"
              name="isActive"
              defaultChecked={unit.isActive}
              className="mt-1"
            /><span><span className="block font-medium text-slate-100">Unidade ativa</span><span className="mt-1 block text-slate-400">
                Mantém a unidade disponível para operação, monitoramento e novos vínculos.
              </span></span></label></div>
      ),
    },
  ];

  if (focusMode) {
    return (
      <AppShell
        title={`Monitoramento · ${unit.name}`}
        subtitle={`${locationLabel(unit)} · ${unit.partner.name}${showUnitCode ? ` · ${unit.code}` : ""}.`}
      ><Surface className="border-sky-500/15 bg-sky-500/[0.04] p-4 sm:p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Modo foco</div><div className="mt-1 text-sm text-slate-300">
                Monitoramento da unidade.
              </div></div><div className="flex flex-wrap gap-2"><Link
                href={unitMonitoringHref(unit.id, monitoringWindow)}
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Sair do foco
              </Link><Link
                href="/unidades"
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Voltar para unidades
              </Link></div></div></Surface><UnitMonitoringVisualPanel
          unit={unit}
          report={monitoringReport}
          snapshot={zabbixSnapshot}
          editControl={
            isAdmin ? (
              <EntityEditModal
                triggerLabel="Editar unidade"
                title="Editar unidade"
                kicker="Cadastro"
                description="Cadastro, vínculos e inventário."
                submitLabel="Salvar unidade"
                pendingLabel="Salvando..."
                steps={unitEditSteps}
                action={updateUnit}
                triggerClassName="w-full justify-center rounded-[16px] border border-white/10 bg-[rgba(6,10,16,0.86)] px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/20 hover:bg-white/[0.05]"
              />
            ) : null
          }
          windowPreset={monitoringWindow}
          focusMode={focusMode}
          syncControl={
            isAdmin ? (
              <ActionForm
                action={syncZabbixAction}
                className="m-0 border-0 bg-transparent p-0 shadow-none"
                submitLabel="Sincronizar Zabbix"
                pendingLabel="Sincronizando..."
                variant="primary"
                submitClassName="mt-0 w-full [&_button]:h-11 [&_button]:w-full [&_button]:justify-center [&_button]:rounded-[14px] [&_button]:border [&_button]:border-sky-300/35 [&_button]:bg-[linear-gradient(180deg,#1677ff,#0f63d6)] [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-[0_10px_22px_rgba(37,99,235,0.22)] hover:[&_button]:brightness-110"
              ><input type="hidden" name="unitId" value={unit.id} /></ActionForm>
            ) : null
          }
        /></AppShell>
    );
  }

  return (
    <AppShell
      title={unit.name}
      subtitle={`${locationLabel(unit)} · ${unit.partner.name}${showUnitCode ? ` · ${unit.code}` : ""}.`}
    >
      {created ? (
        <Surface className="border-emerald-500/20 bg-emerald-500/10 p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><SectionIntro
              eyebrow="Cadastro concluído"
              title="Unidade criada com sucesso"
              description={
                from === "legacy"
                  ? "A unidade nasceu a partir de uma pista do legado. Revise vínculos, equipamentos e host Zabbix antes de sincronizar."
                  : from === "wizard"
                  ? "Cadastro concluído."
                  : "A unidade criada pelo cadastro direto já está disponível para consulta e próximos vínculos."
              }
              compact
            /><div className="flex flex-wrap gap-2"><Link
                href="/unidades/nova"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-95"
              >
                Criar outra
              </Link><Link
                href="/unidades"
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white transition hover:bg-white/[0.06]"
              >
                Voltar para lista
              </Link></div></div></Surface>
      ) : null}

      <RegistryDetailHero
        eyebrow={showUnitCode ? unit.code : "Unidade"}
        title={unit.name}
        description={zabbixSnapshot?.match.status === "matched" ? "Host Zabbix vinculado." : "Cadastro operacional da unidade."}
        badges={
          <><TonePill tone={unit.isActive ? "success" : "subtle"}>
              {unit.isActive ? "ativo" : "inativo"}
            </TonePill>
            {!showUnitCode ? <TonePill tone="neutral">{unit.code}</TonePill> : null}
            <TonePill tone={unit.partner.isActive ? "success" : "attention"}>
              {showPartnerCode ? unit.partner.code : unit.partner.name}
            </TonePill></>
        }
        meta={<>{locationLabel(unit)}</>}
        actions={
          <><Link
              href="/unidades"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Voltar
            </Link>
            {isAdmin ? (
              <EntityEditModal
                triggerLabel="Editar unidade"
                title="Editar unidade"
                kicker="Cadastro"
                description="Cadastro, vínculos e inventário."
                submitLabel="Salvar unidade"
                pendingLabel="Salvando..."
                steps={unitEditSteps}
                action={updateUnit}
              />
            ) : null}
            {isAdmin ? (
              <OperationalDeletePanel
                action={deleteUnit}
                entityId={unit.id}
                entityLabel="unidade"
                entityName={`${unit.code} - ${unit.name}`}
                blockedReason={!unit.isActive ? "Esta unidade já está inativa." : undefined}
              ><input type="hidden" name="partnerId" value={unit.partner.id} /></OperationalDeletePanel>
            ) : null}
          </>
        }
      /><UnitMonitoringVisualPanel
        unit={unit}
        report={monitoringReport}
        snapshot={zabbixSnapshot}
        editControl={
          isAdmin ? (
            <EntityEditModal
              triggerLabel="Editar unidade"
              title="Editar unidade"
              kicker="Cadastro"
              description="Cadastro, vínculos e inventário."
              submitLabel="Salvar unidade"
              pendingLabel="Salvando..."
              steps={unitEditSteps}
              action={updateUnit}
            />
          ) : null
        }
        windowPreset={monitoringWindow}
        focusMode={focusMode}
        syncControl={
          isAdmin ? (
            <ActionForm
              action={syncZabbixAction}
              className="m-0 border-0 bg-transparent p-0 shadow-none"
              submitLabel="Sincronizar Zabbix"
              pendingLabel="Sincronizando..."
              variant="primary"
              submitClassName="mt-0 w-full [&_button]:h-11 [&_button]:w-full [&_button]:justify-center [&_button]:rounded-[14px] [&_button]:border [&_button]:border-sky-300/35 [&_button]:bg-[linear-gradient(180deg,#1677ff,#0f63d6)] [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-[0_10px_22px_rgba(37,99,235,0.22)] hover:[&_button]:brightness-110"
            ><input type="hidden" name="unitId" value={unit.id} /></ActionForm>
          ) : null
        }
      /><LegacyUnitBlock profile={legacyProfile} /><AttachmentPanel
        entityPath="units"
        entityId={unit.id}
        entityLabel="unidade"
        returnPath={`/unidades/${unit.id}`}
        canEdit={canEditAttachments}
      /><Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
          eyebrow="Inventário"
          title="Equipamentos"
          description="Equipamentos já vinculados a esta unidade."
          actions={
            isAdmin ? (
              <Link
                href={`/equipamentos/nova?unitId=${unit.id}`}
                className="rounded-full border border-sky-500/28 bg-sky-500/14 px-4 py-2 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
              >
                Novo equipamento
              </Link>
            ) : null
          }
          compact
        /><div className="mt-4">
          {unit.equipments.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Tag</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Serial/MAC</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead><tbody>
                  {unit.equipments.map((equipment) => (
                    <tr
                      key={equipment.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    ><TableCell><Link
                          href={`/equipamentos/${equipment.id}`}
                          className="font-medium text-white hover:text-sky-100"
                        >
                          {equipment.tag}
                        </Link></TableCell><TableCell className="text-slate-300">{equipment.name}</TableCell><TableCell className="text-slate-400">{equipment.serialNumber || "-"}</TableCell><TableCell className="text-slate-400">{equipment.type}</TableCell><TableCell><TonePill tone={toneForStatus(equipment.status)}>
                          {equipment.status}
                        </TonePill></TableCell><TableActionCell><TableActionLink href={`/equipamentos/${equipment.id}`}>
                          Abrir
                        </TableActionLink></TableActionCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum equipamento vinculado"
              description="Quando o inventário for associado, ele aparece aqui com tag, tipo e status."
              action={
                <Link
                  href={`/equipamentos/nova?unitId=${unit.id}`}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Novo equipamento
                </Link>
              }
            />
          )}
        </div></Surface><section className="grid gap-5 xl:grid-cols-2"><Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
            eyebrow="Histórico"
            title="Ocorrências recentes"
            description="Últimas ocorrências ligadas à unidade."
            compact
          /><div className="mt-4">
            {unit.occurrences.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Ocorrência</th><th className="px-4 py-3">Sev.</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Criada</th></tr></TableHead><tbody>
                    {unit.occurrences.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/ocorrencias/${item.id}`}
                            className="font-medium text-white hover:text-sky-100"
                          >
                            {item.code}
                          </Link><div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone={toneForStatus(item.severity)}>
                            {item.severity}
                          </TonePill></TableCell><TableCell><TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill></TableCell><TableCell className="text-slate-400">
                          {formatDate(item.createdAt)}
                        </TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhuma ocorrência recente"
                description="Ocorrências vinculadas à unidade serão listadas aqui."
              />
            )}
          </div></Surface><Surface className="overflow-hidden border-sky-400/10 bg-[radial-gradient(circle_at_top,rgba(14,48,79,0.32),transparent_38%),linear-gradient(180deg,rgba(9,16,25,0.98),rgba(6,10,16,0.99))] p-5 sm:p-6"><SectionIntro
            eyebrow="Histórico"
            title="Manutenções recentes"
            description="Ações de manutenção associadas à unidade."
            compact
          /><div className="mt-4">
            {unit.maintenances.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Manutenção</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Agenda</th></tr></TableHead><tbody>
                    {unit.maintenances.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/manutencoes/${item.id}`}
                            className="font-medium text-white hover:text-sky-100"
                          >
                            {item.code}
                          </Link><div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone="neutral">{item.type}</TonePill></TableCell><TableCell><TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill></TableCell><TableCell className="text-slate-400">
                          {formatDate(item.scheduledAt)}
                        </TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhuma manutenção recente"
                description="Manutenções ligadas à unidade serão listadas aqui."
              />
            )}
          </div></Surface></section></AppShell>
  );
}
