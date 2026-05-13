import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import { EntityEditModal } from "@/components/entity-edit-modal";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
import { OperationalSecretActions } from "@/components/unidades/operational-secret-actions";
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
import {
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime } from "@/lib/formatters";
import {
  formatMs,
  formatPercent,
  formatTemperature,
  readUnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
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

const editLabelClass = "nds-label";
const editInputClass = "nds-input";
const editTextareaClass = "nds-textarea";
const iconTileClass = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--nova-radius-control)] border border-[color-mix(in_srgb,var(--nova-primary)_26%,transparent)] bg-[var(--nova-primary-soft)] text-[var(--nova-primary)]";

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

type UnitZabbixSnapshot = UnitHostTelemetryItem;

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


type UnitOperationalSecret = {
  id: string;
  kind: string;
  label: string;
  hasValue: boolean;
  username: string | null;
  value: string | null;
  note: string | null;
  revealed: boolean;
  createdAt: string;
  updatedAt: string;
};

type UnitOperationalItem = {
  id: string;
  source: string;
  sourceLegacyId: string | null;
  sourceUnitKey: string | null;
  linkRole: string;
  sortOrder: number;
  group: string | null;
  legacyCode: string | null;
  legacyName: string | null;
  city: string | null;
  state: string | null;
  partnerCode: string | null;
  serviceType: string | null;
  connectionType: string | null;
  routerPort: string | null;
  technology: string | null;
  latency: string | null;
  macOnu: string | null;
  phone: string | null;
  contractIxc: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  secrets: UnitOperationalSecret[];
};

type UnitOperationalDataResponse = {
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partner: { id: string; code: string; name: string };
  };
  revealSecrets: boolean;
  total: number;
  items: UnitOperationalItem[];
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
    revalidatePath("/sensores");

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
  const query = new URLSearchParams({ mw: windowPreset, monitoring: "1", ...(extra || {}) });
  return `/unidades/${unitId}?${query.toString()}`;
}

function unitOperationalHref(unitId: string, windowPreset: MonitoringWindowPreset) {
  const query = new URLSearchParams({ mw: windowPreset, operational: "1" });
  return `/unidades/${unitId}?${query.toString()}`;
}

function monitoringReportHref(unitId: string, windowPreset: MonitoringWindowPreset) {
  const query = new URLSearchParams({ unitId, mw: windowPreset });
  return `/relatorios/monitoramento?${query.toString()}`;
}

async function readUnitZabbixSnapshot(unitId: string) {
  const telemetry = await readUnitHostTelemetry({ timeoutMs: 1_500, fast: true });
  return telemetry.items.find((item) => item.unit.id === unitId) || null;
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

function pathFromPoints(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function ChartRangeBar({ percent = 80, tone = "neutral" }: { percent?: number; tone?: "success" | "attention" | "critical" | "neutral" }) {
  const activeClass =
    tone === "critical"
      ? "bg-[var(--nova-danger)]"
      : tone === "attention"
        ? "bg-[var(--nova-warning)]"
        : tone === "success"
          ? "bg-[var(--nova-success)]"
          : "bg-[var(--nova-text-dim)]";

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

function trendStatusForLoss(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= 3) return "critical";
  if (value >= 1) return "attention";
  return "success";
}

function trendStatusForTemperature(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= 50) return "critical";
  if (value >= 35) return "attention";
  return "success";
}

function semanticColorForStatus(status: "success" | "attention" | "critical" | "neutral") {
  if (status === "critical") return "var(--nova-danger)";
  if (status === "attention") return "var(--nova-warning)";
  if (status === "success") return "var(--nova-success)";
  return "var(--nova-text-dim)";
}

function chartStrokeColor(entry: MonitoringReportSeries) {
  if (entry.kind === "ping") return entry.color || "var(--nova-info)";
  if (entry.kind === "loss") return entry.color || "var(--nova-danger)";
  if (entry.kind === "trafficIn") return entry.color || "var(--nova-success)";
  if (entry.kind === "trafficOut") return entry.color || "var(--nova-warning)";
  if (entry.color) return entry.color;

  if (entry.unit === "ms") return "var(--nova-info)";
  if (entry.unit === "%") return "var(--nova-danger)";
  if (entry.unit === "bps") return "var(--nova-success)";

  return "var(--nova-text-dim)";
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
      <div className="nds-empty flex min-h-[118px] items-center justify-center text-[11px] text-[var(--nova-text-muted)]">
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

  return (
    <div className="nds-card overflow-hidden p-0"><svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfico histórico de monitoramento"
        className="h-auto w-full"
      ><defs>
          {usableSeries.map(({ entry }) => (
            <linearGradient key={`${id}-${entry.id}-fill`} id={`${id}-${entry.id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={chartStrokeColor(entry)} stopOpacity={isTraffic ? "0.25" : "0.16"} /><stop offset="100%" stopColor={chartStrokeColor(entry)} stopOpacity="0" /></linearGradient>
          ))}
          <linearGradient id={`${id}-good-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--nova-success)" stopOpacity="0.13" /><stop offset="100%" stopColor="var(--nova-success)" stopOpacity="0.06" /></linearGradient><linearGradient id={`${id}-warn-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--nova-warning)" stopOpacity="0.14" /><stop offset="100%" stopColor="var(--nova-warning)" stopOpacity="0.06" /></linearGradient><linearGradient id={`${id}-critical-band`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--nova-danger)" stopOpacity="0.16" /><stop offset="100%" stopColor="var(--nova-danger)" stopOpacity="0.08" /></linearGradient></defs>

        {showThresholdBands ? (
          <><rect x={pad.left} y={yFor(pingMax, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, yFor(100, pingEntry?.entry || usableSeries[0].entry) - yFor(pingMax, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-critical-band)`} /><rect x={pad.left} y={yFor(100, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, yFor(50, pingEntry?.entry || usableSeries[0].entry) - yFor(100, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-warn-band)`} /><rect x={pad.left} y={yFor(50, pingEntry?.entry || usableSeries[0].entry)} width={plotWidth} height={Math.max(0, height - pad.bottom - yFor(50, pingEntry?.entry || usableSeries[0].entry))} fill={`url(#${id}-good-band)`} /><text x={pad.left + 10} y={yFor(118, pingEntry?.entry || usableSeries[0].entry)} fill="var(--nova-danger)" fontSize="12" fontWeight="700">Crítico &gt; 100 ms</text><text x={pad.left + 10} y={yFor(74, pingEntry?.entry || usableSeries[0].entry)} fill="var(--nova-warning)" fontSize="12" fontWeight="700">Atenção 50-100 ms</text><text x={pad.left + 10} y={yFor(28, pingEntry?.entry || usableSeries[0].entry)} fill="var(--nova-success)" fontSize="12" fontWeight="700">Bom &lt; 50 ms</text></>
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

type MonitoringEventRow = {
  id: string;
  icon: string;
  event: string;
  details: string;
  severity: "Crítico" | "Atenção" | "Informativo";
  startedAt: string;
  status: "Resolvido" | "Concluído" | "Aberto";
};

function severityTone(severity: MonitoringEventRow["severity"]) {
  if (severity === "Crítico") return "critical";
  if (severity === "Atenção") return "attention";
  return "info";
}

function eventStatusTone(status: MonitoringEventRow["status"]) {
  if (status === "Aberto") return "attention";
  return "success";
}

function MonitoringEventsCard({ events }: { events: MonitoringEventRow[] }) {
  return (
    <div className="nds-card"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={iconTileClass}><IconAlertList className="h-4 w-4" /></span><div className="min-w-0"><div className="text-[13px] font-black text-white">Eventos e alertas recentes</div></div></div><TonePill tone={events.some((event) => event.severity === "Crítico" && event.status === "Aberto") ? "critical" : events.length ? "info" : "success"}>
          {events.length ? `${events.length} evento(s)` : "sem alertas"}
        </TonePill></div><div className="nds-table-shell mt-2"><div className="nova-events-grid border-b border-white/[0.08] px-3 py-2 text-[8px] font-black uppercase text-[var(--nova-text-dim)] max-xl:hidden"><span>Evento</span><span>Detalhes</span><span>Severidade</span><span>Início</span><span>Status</span></div>

        {events.length ? (
          <div className="divide-y divide-white/[0.06]">
            {events.map((event) => (
              <div key={event.id} className="nova-events-grid px-3 py-2 text-[11px] text-slate-300"><div className="flex min-w-0 items-center gap-2 font-medium text-slate-100"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-[10px]">{event.icon}</span><span className="truncate">{event.event}</span></div><div className="text-[var(--nova-text-muted)]">{event.details}</div><div><TonePill tone={severityTone(event.severity)}>{event.severity}</TonePill></div><div className="text-[var(--nova-text-muted)]">{event.startedAt}</div><div><TonePill tone={eventStatusTone(event.status)}>{event.status}</TonePill></div></div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-center text-[11px] text-[var(--nova-text-muted)]">Nenhum alerta operacional gerado para esta janela.</div>
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
    <div className="nds-card"><div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-slate-200">{label}</span><span className="font-black text-slate-50 tabular-nums">{value}</span></div><div className="mt-2 flex items-center gap-2"><div className="flex-1"><ChartRangeBar percent={percent} tone={resolvedTone} /></div>
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
            className={`nds-button ${
              isActive
                ? "border-[color-mix(in_srgb,var(--nova-primary)_42%,transparent)] bg-[var(--nova-primary-soft)] text-white"
                : ""
            }`}
            data-variant="secondary"
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
  refreshToken,
  focusMode = false,
}: {
  unit: UnitDetail;
  report: UnitMonitoringReport | null;
  snapshot: UnitZabbixSnapshot | null;
  editControl?: ReactNode;
  syncControl?: ReactNode;
  windowPreset: MonitoringWindowPreset;
  refreshToken: string;
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
  const latencyMax = pingSeries?.stats.max ?? null;
  const trafficInSeries = trafficSeries.find((series) => series.kind === "trafficIn") || null;
  const trafficOutSeries = trafficSeries.find((series) => series.kind === "trafficOut") || null;
  const selectedPeriod = selectedMonitoringPeriod(windowPreset, report?.period.to || report?.generatedAt || null);
  const periodLabel = `${formatShortDate(selectedPeriod.from)} até ${formatShortDate(selectedPeriod.to)}`;
  const lastSyncLabel = formatDateTime(report?.generatedAt || snapshot?.metrics.ping?.lastClock || null);
  const lossTone = trendStatusForLoss(lossPercent);
  const temperatureTone = trendStatusForTemperature(snapshot?.metrics.temperatureC ?? null);
  const latencyChartSeries = pingSeries ? [{ ...pingSeries, color: "var(--nova-info)", label: "Latência" }] : [];
  const lossChartSeries = lossSeries ? [{ ...lossSeries, color: "var(--nova-danger)", label: "Perda de pacote" }] : [];
  const trafficChartSeries = [
    trafficInSeries ? { ...trafficInSeries, color: "var(--nova-success)", label: "Download (entrada)" } : null,
    trafficOutSeries ? { ...trafficOutSeries, color: "var(--nova-warning)", label: "Upload (saída)" } : null,
  ].filter((series): series is MonitoringReportSeries => Boolean(series));
  const monitoringEvents: MonitoringEventRow[] = [
    ...(latencyMax !== null && latencyMax >= 100
      ? [{
          id: "latency-critical",
          icon: "▲",
          event: "Pico de latência detectado",
          details: "Latência acima de 100 ms no período analisado",
          severity: "Crítico" as const,
          startedAt: report?.generatedAt ? formatDateTime(report.generatedAt) : lastSyncLabel,
          status: "Resolvido" as const,
        }]
      : latencyMax !== null && latencyMax >= 50
        ? [{
            id: "latency-warning",
            icon: "△",
            event: "Latência em atenção",
            details: "Latência passou da faixa ideal no período",
            severity: "Atenção" as const,
            startedAt: report?.generatedAt ? formatDateTime(report.generatedAt) : lastSyncLabel,
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
          startedAt: report?.generatedAt ? formatDateTime(report.generatedAt) : lastSyncLabel,
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
          startedAt: report?.generatedAt ? formatDateTime(report.generatedAt) : lastSyncLabel,
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
  const actionButtonClass = "nds-button";

  return (
    <Surface><SectionIntro
        eyebrow="Monitoramento"
        title="Telemetria e sincronização"
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
      /><div className="nova-monitoring-workbench mt-2"><div className="grid gap-2"><div className="nds-card"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={iconTileClass}><IconPulse className="h-4 w-4" /></span><div className="min-w-0"><div className="text-[15px] font-black text-white">Latência e perda</div><div className="mt-1 text-[11px] text-[var(--nova-text-muted)]">{periodLabel}</div></div></div><div className="flex flex-wrap items-center justify-end gap-2"><MonitoringWindowControl unitId={unit.id} active={windowPreset} focusMode={focusMode} /><Link
                href={monitoringReportHref(unit.id, windowPreset)}
                  className={actionButtonClass}
                  data-variant="secondary"
                  title="Abrir relatório de monitoramento"
                ><span>Relatório</span><IconArrowUpRight /></Link><Link
                  href={focusMode ? unitMonitoringHref(unit.id, windowPreset) : unitMonitoringHref(unit.id, windowPreset, { focus: "monitoring" })}
                  scroll={false}
                  className={actionButtonClass}
                  data-variant="secondary"
                ><IconFocus /><span>{focusMode ? "Sair foco" : "Modo foco"}</span></Link><Link
                  href={unitMonitoringHref(unit.id, windowPreset, focusMode ? { refresh: refreshToken, focus: "monitoring" } : { refresh: refreshToken })}
                  scroll={false}
                  className={actionButtonClass}
                  data-variant="secondary"
                ><IconRefresh /><span>Atualizar</span></Link></div></div><div className="mt-2 flex flex-wrap items-center gap-2">
              {focusMode ? <TonePill tone="success">Modo foco ativo</TonePill> : null}
            </div><div className="mt-2 grid gap-2"><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="text-[13px] font-black text-white">Latência</div></div><div className="nds-badge" data-tone="info">
                    Atual: {formatMs(latencyCurrent)}
                  </div></div><div className="mt-2 flex flex-wrap gap-2"><TonePill tone="success">Ideal &lt; 50 ms</TonePill><TonePill tone="attention">Atenção 50-100 ms</TonePill><TonePill tone="critical">Crítico &gt; 100 ms</TonePill></div><div className="nds-card mt-2 p-2">
                  {latencyChartSeries.length ? (
                    <TrendChart id="unit-latency-main" series={latencyChartSeries} height={180} period={selectedPeriod} />
                  ) : (
                    <div className="nds-empty flex min-h-[118px] items-center justify-center px-3 text-center text-[11px] leading-5 text-[var(--nova-text-muted)]">
                      Sem série de latência nesta janela. Use 7D ou 30D para conferir histórico consolidado.
                    </div>
                  )}
                </div><div className="mt-2 grid gap-2 sm:grid-cols-3"><div className="nds-card"><div className="nds-label">Atual</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatMs(latencyCurrent)}</div></div><div className="nds-card"><div className="nds-label">Média</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatMs(latencyAverage)}</div></div><div className="nds-card"><div className="nds-label">Pico</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatMs(latencyMax)}</div></div></div></div><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="text-[13px] font-black text-white">Perda de pacote</div></div><div className="nds-badge" data-tone="critical">
                    Média: {formatPercent(lossPercent)}
                  </div></div><div className="mt-2 flex flex-wrap gap-2"><TonePill tone="success">Ideal &lt; 1%</TonePill><TonePill tone="attention">Atenção 1-3%</TonePill><TonePill tone="critical">Crítico &gt; 3%</TonePill></div><div className="nds-card mt-2 p-2">
                  {lossChartSeries.length ? (
                    <TrendChart id="unit-loss-main" series={lossChartSeries} height={160} period={selectedPeriod} />
                  ) : (
                    <div className="nds-empty flex min-h-[118px] items-center justify-center px-3 text-center text-[11px] leading-5 text-[var(--nova-text-muted)]">
                      Sem série de perda nesta janela. Use 7D ou 30D para conferir histórico consolidado.
                    </div>
                  )}
                </div><div className="mt-2 grid gap-2 sm:grid-cols-3"><div className="nds-card"><div className="nds-label">Atual</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatPercent(lossSeries?.stats.last ?? lossPercent)}</div></div><div className="nds-card"><div className="nds-label">Média</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatPercent(lossPercent)}</div></div><div className="nds-card"><div className="nds-label">Pico</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatPercent(lossSeries?.stats.max ?? null)}</div></div></div></div></div></div><div className="nds-card"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2"><span className={iconTileClass}><IconServer className="h-4 w-4" /></span><div><div className="text-[15px] font-black text-white">Consumo do link</div></div></div><div className="flex flex-wrap items-center gap-2"><TonePill tone="success">
                  Download (entrada)
                </TonePill><TonePill tone="attention">
                  Upload (saída)
                </TonePill><TonePill tone="neutral">Bits/s</TonePill></div></div><div className="nds-card mt-2 p-2">
              {trafficChartSeries.length ? (
                <TrendChart id="unit-traffic-main" series={trafficChartSeries} height={170} period={selectedPeriod} />
              ) : (
                <div className="nds-empty flex min-h-[118px] items-center justify-center px-3 text-center text-[11px] leading-5 text-[var(--nova-text-muted)]">
                  Sem tráfego nesta janela. Use 7D ou 30D para conferir consumo consolidado.
                </div>
              )}
            </div><div className="mt-2 grid gap-2 border-t border-white/[0.08] pt-2 sm:grid-cols-2 xl:grid-cols-5"><div className="nds-card min-w-0"><div className="nds-label">Total do período</div><div className="mt-2 whitespace-nowrap text-[18px] font-black leading-none text-white tabular-nums">{formatBytes(trafficBlock?.consumption?.totalBytes ?? null)}</div></div><div className="nds-card min-w-0"><div className="nds-label">Média download</div><div className="mt-2 whitespace-nowrap text-[16px] font-black leading-tight text-[var(--nova-success)] tabular-nums">{formatBits(trafficBlock?.consumption?.avgReceiveBps ?? null)}</div></div><div className="nds-card min-w-0"><div className="nds-label">Média upload</div><div className="mt-2 whitespace-nowrap text-[16px] font-black leading-tight text-[var(--nova-warning)] tabular-nums">{formatBits(trafficBlock?.consumption?.avgSendBps ?? null)}</div></div><div className="nds-card min-w-0"><div className="nds-label">Pico download</div><div className="mt-2 whitespace-nowrap text-[16px] font-black leading-tight text-[var(--nova-success)] tabular-nums">{formatBits(trafficBlock?.consumption?.peakReceiveBps ?? null)}</div></div><div className="nds-card min-w-0"><div className="nds-label">Pico upload</div><div className="mt-2 whitespace-nowrap text-[16px] font-black leading-tight text-[var(--nova-warning)] tabular-nums">{formatBits(trafficBlock?.consumption?.peakSendBps ?? null)}</div></div></div></div></div><div className="grid content-start gap-2"><div className="nds-card"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className={iconTileClass}><IconPulse className="h-4 w-4" /></span><div><div className="text-[15px] font-black text-white">Saúde da unidade</div><div className="mt-1 nds-label">
                    {monitoringWindowLabel(windowPreset)}
                  </div></div></div><TonePill tone={snapshot ? toneForHealth(snapshot.health) : "neutral"}>
                {snapshot ? health : "sem leitura"}
              </TonePill></div><div className="mt-2 grid gap-2"><MonitoringSummaryRow
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
                  <TonePill tone={pingOk ? "success" : "critical"}>
                    {pingOk ? "UP" : "DOWN"}
                  </TonePill>
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
              /></div><div className="nds-card mt-2 text-[11px]"><div className="grid gap-2"><div><div className="nds-label">Host Zabbix</div><div className="mt-1 break-all font-black text-white">{unit.zabbixHost || hostName}</div></div><div><div className="nds-label">Nome visível</div><div className="mt-1 break-all font-black text-white">{unit.zabbixVisibleName || report?.host?.hostName || "-"}</div></div><div className="grid gap-2 border-t border-white/[0.08] pt-2 text-[var(--nova-text-muted)]"><div className="flex items-center justify-between gap-2"><span>Última sincronização</span><span className="text-right text-slate-200">{lastSyncLabel}</span></div><div className="flex items-center justify-between gap-2"><span>Integração</span><span className="text-right text-slate-200">{report?.integration?.code || snapshot?.match.integrationCode || "sem fonte"}</span></div><div className="flex items-center justify-between gap-2"><span>Vínculo</span><span className="text-right text-slate-200">{hasManualZabbixLink ? "manual" : snapshot?.match.syncReady ? "automático" : "pendente"}</span></div></div></div></div>



            {(editControl || syncControl) ? (
              <div className="mt-2 grid gap-2">
                {syncControl ? (
                  <div className="w-full [&_form]:m-0 [&_form]:w-full [&_form]:border-0 [&_form]:bg-transparent [&_form]:p-0 [&_form]:shadow-none [&_form>div]:m-0 [&_form>div]:border-0 [&_form>div]:bg-transparent [&_form>div]:p-0 [&_form>div]:shadow-none [&_button]:w-full [&_button]:justify-center">
                    {syncControl}
                  </div>
                ) : null}
                {editControl ? (
                  <div className="[&_button]:w-full [&_button]:justify-center">
                    {editControl}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div></div></div><div className="mt-2"><MonitoringEventsCard events={monitoringEvents} /></div></Surface>
  );
}


function operationalRoleLabel(role: string) {
  if (role === "backup") return "Backup / contingência";
  if (role === "primary") return "Link principal";
  return role || "Link operacional";
}

function OperationalSecretRow({ secret }: { secret: UnitOperationalSecret }) {
  return (
    <div className="nds-card text-[11px] text-[var(--nova-text-muted)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-black text-slate-50">{secret.label || "Credencial"}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {secret.kind || "credential"}
          </div>
        </div>
        <TonePill tone={secret.revealed ? "attention" : "info"}>
          {secret.revealed ? "revelado" : "mascarado"}
        </TonePill>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          Usuário/login: <span className="break-all text-slate-200">{secret.username || "-"}</span>
        </div>
        <div>
          Senha/valor: <span className="break-all text-slate-200">{secret.value || "-"}</span>
        </div>
        {secret.note ? (
          <div className="md:col-span-2">
            Nota: <span className="break-all text-slate-200">{secret.note}</span>
          </div>
        ) : null}
      </div>

      <OperationalSecretActions
        username={secret.username}
        value={secret.value}
        revealed={secret.revealed}
      />
    </div>
  );
}

function OperationalDataCard({
  unitId,
  item,
  isAdmin,
  updateAction,
}: {
  unitId: string;
  item: UnitOperationalItem;
  isAdmin: boolean;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="nds-card"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[12px] font-black text-slate-50">{operationalRoleLabel(item.linkRole)}</div><div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {[item.source, item.partnerCode].filter(Boolean).join(" · ") || "manual"}
          </div></div><TonePill tone={item.secrets.length ? "attention" : "info"}>{item.secrets.length ? `${item.secrets.length} credencial(is)` : "sem credencial"}</TonePill></div><div className="mt-2 grid gap-2 text-[11px] text-[var(--nova-text-muted)] md:grid-cols-2"><div>Servico: <span className="text-slate-200">{item.serviceType || "-"}</span></div><div>Conexao: <span className="text-slate-200">{item.connectionType || "-"}</span></div><div>Porta RB: <span className="text-slate-200">{item.routerPort || "-"}</span></div><div>Tecnologia: <span className="text-slate-200">{item.technology || "-"}</span></div><div>Latencia: <span className="text-slate-200">{item.latency || "-"}</span></div><div>Acionamento: <span className="text-slate-200">{item.phone || "-"}</span></div><div>Contrato IXC: <span className="text-slate-200">{item.contractIxc || "-"}</span></div><div>Origem: <span className="text-slate-200">{item.legacyCode || item.legacyName || item.sourceLegacyId || "-"}</span></div><div className="md:col-span-2">MAC/ONU: <span className="break-all text-slate-200">{item.macOnu || "-"}</span></div>{item.notes ? <div className="md:col-span-2">Observacao: <span className="text-slate-200">{item.notes}</span></div> : null}</div>

      {item.secrets.length ? (
        <div className="mt-2 grid gap-2">
          {item.secrets.map((secret) => (
            <OperationalSecretRow key={secret.id} secret={secret} />
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <details className="mt-2 rounded-[var(--nova-radius-card)] border border-white/[0.08] bg-white/[0.02] p-2"><summary className="cursor-pointer text-[11px] font-black text-slate-100">Editar acionamento e credenciais</summary><form action={updateAction} className="mt-2 grid gap-2"><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="infoId" value={item.id} /><div className="grid gap-2 md:grid-cols-2"><label className="grid gap-1.5"><span className={editLabelClass}>Parceiro</span><input name="partnerCode" defaultValue={item.partnerCode || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Serviço</span><input name="serviceType" defaultValue={item.serviceType || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Conexão</span><input name="connectionType" defaultValue={item.connectionType || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Porta RB</span><input name="routerPort" defaultValue={item.routerPort || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Tecnologia</span><input name="technology" defaultValue={item.technology || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Latência</span><input name="latency" defaultValue={item.latency || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Telefone/acionamento</span><input name="phone" defaultValue={item.phone || ""} className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Contrato IXC</span><input name="contractIxc" defaultValue={item.contractIxc || ""} className={editInputClass} /></label><label className="grid gap-1.5 md:col-span-2"><span className={editLabelClass}>MAC/ONU</span><input name="macOnu" defaultValue={item.macOnu || ""} className={editInputClass} /></label><label className="grid gap-1.5 md:col-span-2"><span className={editLabelClass}>Observações</span><textarea name="notes" defaultValue={item.notes || ""} className={editTextareaClass} rows={3} /></label></div><div className="nds-card grid gap-2 md:grid-cols-3"><label className="grid gap-1.5"><span className={editLabelClass}>Rótulo da credencial</span><input name="secretLabel" placeholder="Credencial operacional" className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Usuário/login</span><input name="username" placeholder="preencha para substituir" className={editInputClass} /></label><label className="grid gap-1.5"><span className={editLabelClass}>Senha/valor</span><input name="secret" placeholder="preencha para substituir" className={editInputClass} /></label><label className="grid gap-1.5 md:col-span-3"><span className={editLabelClass}>Nota sensível</span><input name="secretNote" placeholder="observação opcional criptografada" className={editInputClass} /></label></div><div className="flex justify-end"><button type="submit" className="nds-button" data-variant="primary">Salvar dados operacionais</button></div></form></details>
      ) : null}
    </div>
  );
}

function OperationalDataBlock({
  unitId,
  data,
  isAdmin,
  revealSecrets,
  updateAction,
}: {
  unitId: string;
  data: UnitOperationalDataResponse | null;
  isAdmin: boolean;
  revealSecrets: boolean;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  if (!data || !data.items.length) return null;

  const primaryCount = data.items.filter((item) => item.linkRole === "primary").length;
  const backupCount = data.items.filter((item) => item.linkRole === "backup").length;
  const secretCount = data.items.reduce((sum, item) => sum + item.secrets.length, 0);
  const revealHref = `/unidades/${unitId}?operational=1&operationalReveal=1`;
  const hideHref = `/unidades/${unitId}?operational=1`;

  return (
    <Surface><SectionIntro
        eyebrow="Dados operacionais"
        title="Acionamento e credenciais"
        description="Dados operacionais e credenciais ficam mascarados por padrão."
        actions={
          <div className="flex flex-wrap gap-2">
            <TonePill tone="success">{data.total} registro(s)</TonePill>
            {secretCount ? <TonePill tone="attention">{secretCount} credencial(is)</TonePill> : null}
            {isAdmin ? (
              <Link
                href={revealSecrets ? hideHref : revealHref}
                className="nds-button"
                data-variant={revealSecrets ? "secondary" : "primary"}
              >
                {revealSecrets ? "Ocultar credenciais" : "Revelar credenciais"}
              </Link>
            ) : null}
          </div>
        }
        compact
      /><div className="mt-2 grid gap-2 md:grid-cols-3"><div className="nds-card"><div className="nds-label">Principais</div><div className="mt-1 text-[22px] font-semibold text-slate-50">{primaryCount}</div></div><div className="nds-card"><div className="nds-label">Backup</div><div className="mt-1 text-[22px] font-semibold text-slate-50">{backupCount}</div></div><div className="nds-card"><div className="nds-label">Credenciais</div><div className="mt-1 text-[22px] font-semibold text-slate-50">{secretCount}</div></div></div><div className="mt-2 grid gap-2">
        {data.items.map((item) => (
          <OperationalDataCard
            key={item.id}
            unitId={unitId}
            item={item}
            isAdmin={isAdmin}
            updateAction={updateAction}
          />
        ))}
      </div>{revealSecrets ? (
        <div className="mt-2 rounded-[var(--nova-radius-card)] border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] leading-5 text-amber-100">
          Credenciais reveladas apenas para administradores. A consulta gera auditoria no backend.
        </div>
      ) : null}</Surface>
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
      revalidatePath("/sensores");
      revalidatePath("/parceiros");
      if (previousPartnerId) revalidatePath(`/parceiros/${previousPartnerId}`);
      if (nextPartnerId) revalidatePath(`/parceiros/${nextPartnerId}`);
      revalidatePath("/integracoes");
      revalidatePath("/reconciliacao");
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
      revalidatePath("/sensores");
      revalidatePath("/relatorios/monitoramento");
      if (partnerId) revalidatePath(`/parceiros/${partnerId}`);
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect("/unidades?active=true");
  }


  async function updateOperationalData(formData: FormData) {
    "use server";

    const unitId = String(formData.get("unitId") || "");
    const infoId = String(formData.get("infoId") || "");

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return;
      }

      await apiJson(`/operational-data/units/${unitId}/${infoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          partnerCode: String(formData.get("partnerCode") || ""),
          serviceType: String(formData.get("serviceType") || ""),
          connectionType: String(formData.get("connectionType") || ""),
          routerPort: String(formData.get("routerPort") || ""),
          technology: String(formData.get("technology") || ""),
          latency: String(formData.get("latency") || ""),
          macOnu: String(formData.get("macOnu") || ""),
          phone: String(formData.get("phone") || ""),
          contractIxc: String(formData.get("contractIxc") || ""),
          notes: String(formData.get("notes") || ""),
          secretLabel: String(formData.get("secretLabel") || ""),
          username: String(formData.get("username") || ""),
          secret: String(formData.get("secret") || ""),
          secretNote: String(formData.get("secretNote") || ""),
        }),
      });

      revalidatePath(`/unidades/${unitId}`);
    } catch {}

    redirect(`/unidades/${unitId}?operational=1`);
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const created = readStringParam(resolvedSearchParams, "created") === "1";
  const from = readStringParam(resolvedSearchParams, "from");
  const monitoringWindow = normalizeMonitoringWindow(readStringParam(resolvedSearchParams, "mw"));
  const focusMode = readStringParam(resolvedSearchParams, "focus") === "monitoring";
  const currentRefresh = Number.parseInt(readStringParam(resolvedSearchParams, "refresh", "0"), 10);
  const nextRefreshToken = String(Number.isFinite(currentRefresh) && currentRefresh >= 0 ? currentRefresh + 1 : 1);

  const loadMonitoring = focusMode || readStringParam(resolvedSearchParams, "monitoring") === "1";
  const loadOperationalData =
    readStringParam(resolvedSearchParams, "operational") === "1" ||
    readStringParam(resolvedSearchParams, "legacy") === "1";
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = isAdminRole(role);
  const revealOperationalSecrets = isAdmin && readStringParam(resolvedSearchParams, "operationalReveal") === "1";

  const [unit, zabbixSnapshot, monitoringReportBase, partnersResponse, operationalDataResponse] = await Promise.all([
    apiJson<UnitDetail>(`/units/${resolvedParams.id}`),
    loadMonitoring ? readUnitZabbixSnapshot(resolvedParams.id) : Promise.resolve(null),
    loadMonitoring ? readUnitMonitoringReport(resolvedParams.id, monitoringWindow) : Promise.resolve(null),
    apiJson<PaginatedResponse<PartnerOption>>(
      "/partners?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
    apiJson<UnitOperationalDataResponse>(
      `/operational-data/units/${resolvedParams.id}${revealOperationalSecrets ? "/reveal" : ""}`,
    ).catch(() => null),
  ]);

  const monitoringReport = loadMonitoring ? narrowMonitoringReport(monitoringReportBase, monitoringWindow) : null;
  const operationalData = operationalDataResponse;
  const canEditAttachments = canEditAttachmentsForRole(role);
  const sensorCount = zabbixSensorCount(zabbixSnapshot);
  const showUnitCode = !isRedundantLabel(unit.code, unit.name);
  const showPartnerCode = !isRedundantLabel(unit.partner.code, unit.partner.name);
  const partnerOptions = partnersResponse.items;

  const unitEditSteps = [
    {
      title: "Base",
      description: "Código, nome e localização principal da unidade.",
      body: (
        <div className="grid gap-2 md:grid-cols-2"><input type="hidden" name="id" value={unit.id} /><input type="hidden" name="previousPartnerId" value={unit.partner.id} /><div className="grid gap-1.5"><label
              htmlFor="unit-code"
              className={editLabelClass}
            >
              Código
            </label><input
              id="unit-code"
              name="code"
              defaultValue={unit.code}
              className={editInputClass}
            /></div><div className="grid gap-1.5"><label
              htmlFor="unit-name"
              className={editLabelClass}
            >
              Nome
            </label><input
              id="unit-name"
              name="name"
              defaultValue={unit.name}
              className={editInputClass}
            /></div><div className="grid gap-1.5"><label
              htmlFor="unit-city"
              className={editLabelClass}
            >
              Cidade
            </label><input
              id="unit-city"
              name="city"
              defaultValue={unit.city || ""}
              className={editInputClass}
            /></div><div className="grid gap-1.5"><label
              htmlFor="unit-state"
              className={editLabelClass}
            >
              UF
            </label><input
              id="unit-state"
              name="state"
              maxLength={2}
              defaultValue={unit.state || ""}
              className={editInputClass}
            /></div></div>
      ),
    },
    {
      title: "Vínculos",
      description: "Parceiro responsável, host Zabbix e identificação da unidade.",
      body: (
        <div className="grid gap-2"><div className="grid gap-1.5"><label
              htmlFor="unit-partner"
              className={editLabelClass}
            >
              Parceiro responsável
            </label><select
              id="unit-partner"
              name="partnerId"
              defaultValue={unit.partner.id}
              className={editInputClass}
            >
              {partnerOptions.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.code} - {partner.name}
                </option>
              ))}
            </select></div><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><label
                htmlFor="unit-zabbix-host"
                className={editLabelClass}
              >
                Host Zabbix
              </label><input
                id="unit-zabbix-host"
                name="zabbixHost"
                defaultValue={unit.zabbixHost || ""}
                placeholder="Nome técnico do host"
                className={editInputClass}
              /></div><div className="grid gap-1.5"><label
                htmlFor="unit-zabbix-visible-name"
                className={editLabelClass}
              >
                Nome visível no Zabbix
              </label><input
                id="unit-zabbix-visible-name"
                name="zabbixVisibleName"
                defaultValue={unit.zabbixVisibleName || ""}
                placeholder="Nome exibido no host"
                className={editInputClass}
              /></div></div><div className="nds-card grid gap-2 text-[11px] text-[var(--nova-text-muted)] md:grid-cols-3"><div>
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
      title: "Ativos",
      description: "Inventário vinculado a esta unidade.",
      body: (
        <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] font-bold text-slate-100">
              {unit.equipments.length} ativo(s) vinculado(s)
            </div><Link
              href={`/ativos/cadastro?unitId=${unit.id}`}
              className="nds-button"
              data-variant="primary"
            >
              Cadastrar ativo nesta unidade
            </Link></div>

          {unit.equipments.length ? (
            <div className="grid gap-2">
              {unit.equipments.map((equipment) => (
                <div
                  key={equipment.id}
                  className="nds-card nova-equipment-row text-[11px]"
                ><div className="min-w-0"><div className="truncate font-semibold text-slate-50">{equipment.tag}</div><div className="mt-1 truncate text-slate-400">{equipment.name}</div><div className="mt-1 break-all text-[10px] text-[var(--nova-text-muted)]">
                      {equipment.serialNumber || "sem serial/MAC"}
                    </div></div><TonePill tone={toneForStatus(equipment.status)}>{equipment.status}</TonePill><Link
                    href={`/ativos/${equipment.id}`}
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Editar ativo
                  </Link></div>
              ))}
            </div>
          ) : (
            <div className="nds-empty text-[11px] text-[var(--nova-text-muted)]">
              Nenhum ativo vinculado a esta unidade.
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Dados do relatório",
      description: "Dados oficiais usados automaticamente no DOCX/PDF da unidade.",
      body: (
        <div className="grid gap-2"><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><label
              htmlFor="unit-report-contract"
              className={editLabelClass}
            >
              Contrato do relatório
            </label><input
              id="unit-report-contract"
              name="reportContractLabel"
              defaultValue={unit.reportContractLabel || ""}
              placeholder="Contrato nº ..."
              className={editInputClass}
            /></div><div className="grid gap-1.5"><label
              htmlFor="unit-report-bandwidth"
              className={editLabelClass}
            >
              Banda contratada
            </label><input
              id="unit-report-bandwidth"
              name="reportContractedBandwidth"
              defaultValue={unit.reportContractedBandwidth || ""}
              placeholder="Ex.: 100 Mbps"
              className={editInputClass}
            /></div></div><div className="grid gap-1.5"><label
              htmlFor="unit-report-address"
              className={editLabelClass}
            >
              Endereço do relatório
            </label><input
              id="unit-report-address"
              name="reportAddressLine"
              defaultValue={unit.reportAddressLine || ""}
              placeholder="Vazio usa Cidade - UF"
              className={editInputClass}
            /></div><div className="grid gap-1.5"><label
              htmlFor="unit-report-notes"
              className={editLabelClass}
            >
              Observações do relatório
            </label><textarea
              id="unit-report-notes"
              name="reportNotes"
              defaultValue={unit.reportNotes || ""}
              rows={3}
              placeholder="Observações internas para emissão do relatório"
              className={editTextareaClass}
            /></div><div className="nds-notice-info rounded-[var(--nova-radius-card)] border px-3 py-2 text-[11px] leading-5">
              Estes campos alimentam automaticamente o relatório oficial de consumo. Na tela do relatório, ainda é possível sobrescrever manualmente para uma emissão específica.
            </div></div>
      ),
    },
    {
      title: "Fechamento",
      description: "Revisão final antes de salvar.",
      body: (
        <div className="grid gap-2"><label className="nds-card flex items-start gap-2 text-[11px] text-slate-300"><input
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
      <NovaLitShell activeHref="/unidades">
      <div className="nova-unit-detail-lit-page"><Surface><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><div className="nds-label">Modo foco</div><div className="mt-1 text-[11px] text-slate-300">
                Monitoramento da unidade.
              </div></div><div className="flex flex-wrap gap-2"><Link
                href={unitMonitoringHref(unit.id, monitoringWindow)}
                className="nds-button"
                data-variant="secondary"
              >
                Sair do foco
              </Link><Link
                href="/unidades"
                className="nds-button"
                data-variant="secondary"
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
                triggerClassName="nds-button w-full"
              />
            ) : null
          }
          windowPreset={monitoringWindow}
          refreshToken={nextRefreshToken}
          focusMode={focusMode}
          syncControl={
            isAdmin ? (
              <ActionForm
                action={syncZabbixAction}
                className="m-0 border-0 bg-transparent p-0 shadow-none"
                submitLabel="Sincronizar Zabbix"
                pendingLabel="Sincronizando..."
                variant="primary"
                submitClassName="mt-0 w-full [&_button]:w-full [&_button]:justify-center"
              ><input type="hidden" name="unitId" value={unit.id} /></ActionForm>
            ) : null
          }
        />      </div>
    </NovaLitShell>
    );
  }

  return (
    <NovaLitShell activeHref="/unidades">
      <div className="nova-unit-detail-lit-page">
      {created ? (
        <Surface className="nds-notice-success"><div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"><SectionIntro
              eyebrow="Cadastro concluído"
              title="Unidade criada com sucesso"
              description={
                from === "legacy" || from === "imported"
                  ? "A unidade nasceu a partir de dados importados. Revise vínculos, ativos e host Zabbix antes de sincronizar."
                  : from === "wizard"
                  ? "Cadastro concluído."
                  : "A unidade criada pelo cadastro direto já está disponível para consulta e próximos vínculos."
              }
              compact
            /><div className="flex flex-wrap gap-2"><Link
                href="/unidades/cadastro"
                className="nds-button"
                data-variant="primary"
              >
                Cadastrar outra
              </Link><Link
                href="/unidades"
                className="nds-button"
                data-variant="secondary"
              >
                Voltar para lista
              </Link></div></div></Surface>
      ) : null}

      <RegistryDetailHero
        eyebrow={showUnitCode ? unit.code : "Unidade"}
        title={unit.name}
        description={zabbixSnapshot?.match.status === "matched" ? "Host Zabbix vinculado." : "Cadastro, vínculos e operação da unidade."}
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
              className="nds-button"
              data-variant="secondary"
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
      />{!loadMonitoring ? (
        <Surface className="nds-card">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <SectionIntro
              eyebrow="Monitoramento sob demanda"
              title="Telemetria sob demanda"
              description="Carregue gráficos e snapshot Zabbix apenas quando precisar analisar telemetria."
              compact
            />
            <div className="flex flex-wrap gap-2">
              <Link
                href={unitMonitoringHref(unit.id, monitoringWindow)}
                className="nds-button"
                data-variant="primary"
              >
                Carregar monitoramento
              </Link>
              <Link
                href={unitMonitoringHref(unit.id, monitoringWindow, { focus: "monitoring" })}
                className="nds-button"
                data-variant="secondary"
              >
                Modo foco
              </Link>
            </div>
          </div>
        </Surface>
      ) : null}<UnitMonitoringVisualPanel
        unit={unit}
        report={monitoringReport}
        snapshot={zabbixSnapshot}
        windowPreset={monitoringWindow}
        refreshToken={nextRefreshToken}
        focusMode={focusMode}
        syncControl={
          isAdmin ? (
            <ActionForm
              action={syncZabbixAction}
              className="m-0 border-0 bg-transparent p-0 shadow-none"
              submitLabel="Sincronizar Zabbix"
              pendingLabel="Sincronizando..."
              variant="primary"
              submitClassName="mt-0 w-full [&_button]:w-full [&_button]:justify-center"
            ><input type="hidden" name="unitId" value={unit.id} /></ActionForm>
          ) : null
        }
        />{loadOperationalData ? (
          operationalData?.items.length ? (
            <OperationalDataBlock
              unitId={unit.id}
              data={operationalData}
              isAdmin={isAdmin}
              revealSecrets={revealOperationalSecrets}
              updateAction={updateOperationalData}
            />
          ) : (
            <Surface>
              <SectionIntro
                eyebrow="Dados operacionais"
                title="Sem acionamento cadastrado"
                description="Nenhum link operacional foi encontrado. Importe ou edite dados operacionais da unidade."
                compact
              />
            </Surface>
          )
        ) : (
          <Surface className="nds-card">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <SectionIntro
                eyebrow="Dados operacionais"
                title="Acionamento sob demanda"
                description="Links, acionamento e credenciais ficam fora da abertura inicial para manter a página rápida."
                compact
              />
              <Link
                href={unitOperationalHref(unit.id, monitoringWindow)}
                className="nds-button"
                data-variant="secondary"
              >
                Carregar dados
              </Link>
            </div>
          </Surface>
        )}<AttachmentPanel
        entityPath="units"
        entityId={unit.id}
        entityLabel="unidade"
        returnPath={`/unidades/${unit.id}`}
        canEdit={canEditAttachments}
      /><Surface><SectionIntro
          eyebrow="Inventário"
          title="Ativos"
          description="Inventário já vinculado a esta unidade."
          actions={
            isAdmin ? (
              <Link
                href={`/ativos/cadastro?unitId=${unit.id}`}
                className="nds-button"
                data-variant="primary"
              >
                Cadastrar ativo
              </Link>
            ) : null
          }
          compact
        /><div className="mt-2">
          {unit.equipments.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Tag</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Serial/MAC</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><TableActionHeader /></tr></TableHead><tbody>
                  {unit.equipments.map((equipment) => (
                    <tr
                      key={equipment.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    ><TableCell><Link
                          href={`/ativos/${equipment.id}`}
                          className="font-medium text-white hover:text-[var(--nova-primary)]"
                        >
                          {equipment.tag}
                        </Link></TableCell><TableCell className="text-slate-300">{equipment.name}</TableCell><TableCell className="text-slate-400">{equipment.serialNumber || "-"}</TableCell><TableCell className="text-slate-400">{equipment.type}</TableCell><TableCell><TonePill tone={toneForStatus(equipment.status)}>
                          {equipment.status}
                        </TonePill></TableCell><TableActionCell><TableActionLink href={`/ativos/${equipment.id}`}>
                          Abrir
                        </TableActionLink></TableActionCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum ativo vinculado"
              description="Quando o inventário for associado, ele aparece aqui com tag, tipo e status."
              action={
                <Link
                  href={`/ativos/cadastro?unitId=${unit.id}`}
                  className="nds-button"
                  data-variant="primary"
                >
                  Cadastrar ativo
                </Link>
              }
            />
          )}
        </div></Surface><section className="grid gap-2 xl:grid-cols-2"><Surface><SectionIntro
            eyebrow="Histórico"
            title="Alertas recentes"
            description="Últimos alertas ligados à unidade."
            compact
          /><div className="mt-2">
            {unit.occurrences.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Alerta</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Criada</th></tr></TableHead><tbody>
                    {unit.occurrences.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/alertas/${item.id}`}
                            className="font-medium text-white hover:text-[var(--nova-primary)]"
                          >
                            {item.code}
                          </Link><div className="mt-1 max-w-[320px] truncate text-[10px] text-[var(--nova-text-muted)]">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone={toneForStatus(item.severity)}>
                            {item.severity}
                          </TonePill></TableCell><TableCell><TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill></TableCell><TableCell className="text-slate-400">
                          {formatDateTime(item.createdAt)}
                        </TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum alerta recente"
                description="Alertas vinculados à unidade serão listados aqui."
              />
            )}
          </div></Surface><Surface><SectionIntro
            eyebrow="Histórico"
            title="Chamados recentes"
            description="Chamados associados à unidade."
            compact
          /><div className="mt-2">
            {unit.maintenances.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Chamado</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Agenda</th></tr></TableHead><tbody>
                    {unit.maintenances.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/chamados/${item.id}`}
                            className="font-medium text-white hover:text-[var(--nova-primary)]"
                          >
                            {item.code}
                          </Link><div className="mt-1 max-w-[320px] truncate text-[10px] text-[var(--nova-text-muted)]">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone="neutral">{item.type}</TonePill></TableCell><TableCell><TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill></TableCell><TableCell className="text-slate-400">
                          {formatDateTime(item.scheduledAt)}
                        </TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum chamado recente"
                description="Chamados ligados à unidade serão listados aqui."
              />
            )}
          </div></Surface></section>      </div>
    </NovaLitShell>
  );
}
