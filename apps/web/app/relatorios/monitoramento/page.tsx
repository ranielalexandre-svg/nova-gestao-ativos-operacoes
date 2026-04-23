import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportPrintButton } from "@/components/report-print-button";
import {
  EmptyState,
  SectionIntro,
  Surface,
  TonePill,
} from "@/components/ops-ui";
import { RegistryHero, RegistrySummaryStrip } from "@/components/registry-shell";
import { getActionErrorMessage } from "@/lib/action-state";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";

type ReportUnitCatalog = {
  total: number;
  items: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partner: {
      id: string;
      code: string;
      name: string;
    };
  }>;
};

type ReportSource = {
  id: string;
  code: string;
  name: string;
};

type ZabbixGroupCatalog = {
  integration: ReportSource;
  items: Array<{
    id: string;
    name: string;
    hostCount: number;
  }>;
};

type ZabbixGroupPreview = {
  integration: ReportSource;
  groups: Array<{
    id: string;
    name: string;
  }>;
  counts: {
    selectedGroups: number;
    hosts: number;
    matchedUnits: number;
    unmatchedHosts: number;
    ambiguousHosts: number;
  };
  matchedUnits: Array<{
    unit: {
      id: string;
      code: string;
      name: string;
      city: string | null;
      state: string | null;
      partner: {
        id: string;
        code: string;
        name: string;
      };
    };
    primaryHost: {
      hostId: string;
      host?: string;
      hostName?: string;
      hostStatus?: string;
      groups: string[];
    };
    allHosts: string[];
    groups: string[];
    confidence: number;
    score: number;
    matchedBy: string[];
    syncReady: boolean;
    hostCount: number;
  }>;
  unresolvedHosts: Array<{
    status: "ambiguous" | "unmatched";
    score: number;
    confidence: number;
    matchedBy: string[];
    candidates: number;
    host: {
      hostId: string;
      host?: string;
      hostName?: string;
      hostStatus?: string;
      groups: string[];
    };
  }>;
};

type ReportTemplate = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  periodPreset: string;
  outputFormat: string;
  includeCharts: boolean;
  title: string | null;
  interestedParty: string | null;
  contractLabel: string | null;
  addressLine: string | null;
  contractedBandwidth: string | null;
  enabled: boolean;
  groupIds: string[];
  unitIds: string[];
  integration: ReportSource | null;
  automations: Array<{
    id: string;
    code: string;
    name: string;
    cadence: string;
    enabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

type ReportTemplateRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  hitsCount: number;
  createdCount: number;
  updatedCount: number;
  summary: string | null;
  errorMessage: string | null;
  rule: {
    id: string;
    code: string;
    name: string;
    cadence: string;
    reportTemplate: {
      id: string;
      code: string;
      name: string;
    } | null;
  };
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string | null;
    size: number;
    source: string;
    createdAt: string;
    url: string;
  }>;
};

type ReportPoint = {
  timestamp: string;
  value: number | null;
};

type ReportSeries = {
  id: string;
  name: string;
  key: string;
  label: string;
  kind: string;
  color: string;
  unit: "bps" | "ms" | "%" | "d";
  zabbixUnits: string;
  points: ReportPoint[];
  stats: {
    last: number | null;
    min: number | null;
    avg: number | null;
    max: number | null;
    points: number;
  };
};

type ReportBlock = {
  id: string;
  title: string;
  description: string;
  sensorType: string;
  probePath: string;
  unit: string;
  series: ReportSeries[];
  consumption?: {
    receivedBytes: number | null;
    sentBytes: number | null;
    totalBytes: number | null;
    avgReceiveBps: number | null;
    avgSendBps: number | null;
    peakReceiveBps: number | null;
    peakSendBps: number | null;
    coveredSeconds: number;
  } | null;
};

type MonitoringReport = {
  generatedAt: string;
  source: "zabbix";
  deliveryStyle: "prtg-like";
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
  };
  partner: {
    id: string;
    code: string;
    name: string;
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
  blocks: ReportBlock[];
  warnings: string[];
};

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return { from: dateInput(from), to: dateInput(to) };
}

function quickRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: dateInput(from), to: dateInput(to) };
}

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from: dateInput(start), to: dateInput(end) };
}

function reportHref(unitId: string, range: { from: string; to: string }) {
  const params = new URLSearchParams({ unitId, from: range.from, to: range.to });
  return `/relatorios/monitoramento?${params.toString()}`;
}

function readCsvParam(params: RawSearchParams, key: string) {
  const raw = readStringParam(params, key, "");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCadence(value: string) {
  if (value === "every_minute") return "A cada minuto";
  if (value === "every_5_minutes") return "A cada 5 minutos";
  if (value === "hourly") return "Por hora";
  return value || "-";
}

function formatPeriodPreset(value: string) {
  if (value === "current_month") return "Mês atual";
  if (value === "previous_month") return "Mês anterior";
  return "Últimos 7 dias";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatValue(value: number | null, unit: ReportSeries["unit"]) {
  if (value === null || !Number.isFinite(value)) return "-";

  if (unit === "bps") {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Gbps`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Mbps`;
    if (abs >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Kbps`;
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} bps`;
  }

  if (unit === "ms") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ms`;
  }

  if (unit === "%") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} %`;
  }

  const days = Math.floor(value);
  const hours = Math.round((value - days) * 24);
  return `${days}d ${hours}h`;
}

function formatBytes(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  const abs = Math.abs(value);
  if (abs >= 1024 ** 4) {
    return `${(value / 1024 ** 4).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} TB`;
  }
  if (abs >= 1024 ** 3) {
    return `${(value / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
  }
  if (abs >= 1024 ** 2) {
    return `${(value / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
  }
  if (abs >= 1024) {
    return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} KB`;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} B`;
}

function allValues(block: ReportBlock) {
  return block.series
    .flatMap((series) => series.points.map((point) => point.value))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function downsample(points: ReportPoint[], maxPoints = 420) {
  const valid = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
  if (valid.length <= maxPoints) return valid;

  const step = Math.ceil(valid.length / maxPoints);
  return valid.filter((_, index) => index % step === 0);
}

function ChartGrid({
  block,
}: {
  block: ReportBlock;
}) {
  const values = allValues(block);
  const unit = block.series[0]?.unit || "bps";
  const min = unit === "d" && values.length ? Math.max(0, Math.min(...values) * 0.96) : 0;
  const max = values.length ? Math.max(...values, min + 1) : 1;
  const width = 940;
  const height = 250;
  const left = 58;
  const right = 24;
  const top = 22;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  function x(index: number, total: number) {
    return left + (index / Math.max(total - 1, 1)) * plotWidth;
  }

  function y(value: number) {
    return top + (1 - (value - min) / Math.max(max - min, 1)) * plotHeight;
  }

  const labelPoints = block.series[0]?.points || [];
  const first = labelPoints[0]?.timestamp;
  const last = labelPoints[labelPoints.length - 1]?.timestamp;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[840px] max-w-full border-t border-slate-300 bg-white text-slate-700">
        <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="#f8f8f8" />
        {Array.from({ length: 8 }).map((_, index) => {
          const gx = left + (index / 7) * plotWidth;
          return <line key={`gx-${index}`} x1={gx} x2={gx} y1={top} y2={top + plotHeight} stroke="#d5d9de" strokeWidth="1" />;
        })}
        {Array.from({ length: 6 }).map((_, index) => {
          const gy = top + (index / 5) * plotHeight;
          const value = max - (index / 5) * (max - min);
          return (
            <g key={`gy-${index}`}>
              <line x1={left} x2={left + plotWidth} y1={gy} y2={gy} stroke="#d5d9de" strokeWidth="1" />
              <text x={left - 8} y={gy + 4} textAnchor="end" fontSize="10" fill="#263238">
                {formatValue(value, unit)}
              </text>
            </g>
          );
        })}
        {block.series.map((series) => {
          const points = downsample(series.points);
          const path = points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index, points.length).toFixed(2)} ${y(point.value || 0).toFixed(2)}`)
            .join(" ");

          return (
            <path
              key={series.id}
              d={path}
              fill="none"
              stroke={series.color}
              strokeWidth={series.unit === "d" ? 3 : 1.4}
              opacity={series.unit === "bps" ? 0.86 : 0.95}
            />
          );
        })}
        <line x1={left} x2={left + plotWidth} y1={top + plotHeight} y2={top + plotHeight} stroke="#6b7280" strokeWidth="1" />
        <line x1={left} x2={left} y1={top} y2={top + plotHeight} stroke="#6b7280" strokeWidth="1" />
        <text x={left + plotWidth / 2} y={16} textAnchor="middle" fontSize="13" fill="#263238">
          {block.title}
        </text>
        {first ? (
          <text x={left} y={height - 22} fontSize="10" fill="#d32f2f" transform={`rotate(-90 ${left} ${height - 22})`}>
            {formatDate(first)}
          </text>
        ) : null}
        {last ? (
          <text x={left + plotWidth} y={height - 22} fontSize="10" fill="#d32f2f" transform={`rotate(-90 ${left + plotWidth} ${height - 22})`}>
            {formatDate(last)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  const dominant = block.series[0];

  return (
    <section className="prtg-report-block">
      <h3 className="prtg-sensor-title">{block.title}</h3>
      <div className="prtg-summary-grid">
        <div>Período do relatório:</div>
        <div className="font-medium">informado no cabeçalho</div>
        <div>Horas de relatório:</div>
        <div className="font-medium">24 / 7</div>
        <div>Tipo de sensor:</div>
        <div className="font-medium">{block.sensorType}</div>
        <div>Sonda, grupo, dispositivo:</div>
        <div className="font-medium">{block.probePath}</div>
        <div>Média ({dominant?.label || "sensor"}):</div>
        <div className="font-medium">{dominant ? formatValue(dominant.stats.avg, dominant.unit) : "-"}</div>
        {block.consumption ? (
          <>
            <div>Consumo recebido:</div>
            <div className="font-medium">{formatBytes(block.consumption.receivedBytes)}</div>
            <div>Consumo enviado:</div>
            <div className="font-medium">{formatBytes(block.consumption.sentBytes)}</div>
            <div>Total movimentado:</div>
            <div className="font-medium">{formatBytes(block.consumption.totalBytes)}</div>
            <div>Pico observado:</div>
            <div className="font-medium">
              down {formatValue(block.consumption.peakReceiveBps, "bps")} · up{" "}
              {formatValue(block.consumption.peakSendBps, "bps")}
            </div>
          </>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-slate-600">{block.description}</p>
      {block.consumption ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Consumo estimado pela integral das séries de tráfego do Zabbix ao longo do período
          selecionado.
        </p>
      ) : null}
      <ChartGrid block={block} />
      <div className="prtg-legend">
        {block.series.map((series) => (
          <div key={series.id} className="grid grid-cols-[14px_minmax(190px,1fr)_repeat(4,minmax(70px,auto))] items-center gap-2">
            <span className="h-3 w-3" style={{ backgroundColor: series.color }} />
            <span className="truncate">{series.label}</span>
            <span>último {formatValue(series.stats.last, series.unit)}</span>
            <span>mín {formatValue(series.stats.min, series.unit)}</span>
            <span>méd {formatValue(series.stats.avg, series.unit)}</span>
            <span>máx {formatValue(series.stats.max, series.unit)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrafficConsumptionStrip({ block }: { block: ReportBlock }) {
  if (!block.consumption) return null;

  return (
    <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Recebido no período
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-800">
          {formatBytes(block.consumption.receivedBytes)}
        </div>
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Enviado no período
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-800">
          {formatBytes(block.consumption.sentBytes)}
        </div>
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Total movimentado
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-800">
          {formatBytes(block.consumption.totalBytes)}
        </div>
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Pico de download
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-800">
          {formatValue(block.consumption.peakReceiveBps, "bps")}
        </div>
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Pico de upload
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-800">
          {formatValue(block.consumption.peakSendBps, "bps")}
        </div>
      </div>
    </section>
  );
}

function ReportSheet({ report }: { report: MonitoringReport }) {
  const trafficBlock = report.blocks.find((block) => block.id === "traffic" && block.consumption);

  return (
    <article className="prtg-report-sheet">
      <header className="prtg-letterhead">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">NOVA TELECOM</div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">PRTG NETWORK MONITOR STYLE</div>
      </header>

      <section className="px-7 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] italic text-sky-600">Relatório</div>
            <h2 className="mt-1 text-[18px] font-semibold text-sky-600">
              {report.partner.name}: Monitoramento Zabbix
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {report.unit.code} - {report.unit.name}
              {report.unit.city ? ` · ${report.unit.city}/${report.unit.state || "-"}` : ""}
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <div>Gerado em {formatDateTime(report.generatedAt)}</div>
            <div>Fonte: Zabbix · Entrega visual: PRTG-like</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 border-y border-slate-200 py-3 text-[12px] text-slate-700 md:grid-cols-2">
          <div>
            <span className="font-semibold">Período:</span> {formatDateTime(report.period.from)} - {formatDateTime(report.period.to)}
          </div>
          <div>
            <span className="font-semibold">Host:</span> {report.host?.hostName || report.host?.host || "sem host confiável"}
          </div>
          <div>
            <span className="font-semibold">Integração:</span> {report.integration?.name || "não vinculada"}
          </div>
          <div>
            <span className="font-semibold">Confiança do vínculo:</span> {report.host?.confidence ?? "-"}%
          </div>
        </div>

        {trafficBlock ? <TrafficConsumptionStrip block={trafficBlock} /> : null}
      </section>

      <section className="grid gap-8 px-7 py-6">
        {report.warnings.length ? (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
            {report.warnings.join(" ")}
          </div>
        ) : null}

        {report.blocks.length ? (
          report.blocks.map((block) => <ReportBlockView key={block.id} block={block} />)
        ) : (
          <EmptyState
            title="Sem séries históricas para renderizar"
            description="A unidade tem vínculo de monitoramento, mas o host ainda não retornou itens de tráfego, ping ou uptime com histórico numérico."
          />
        )}
      </section>

      <footer className="prtg-report-footer">
        <div>Q. 106 Norte, Alameda 2, Lote 04, Sala 1001, 10º Andar, Edifício Palmas Business</div>
        <div>CEP 77.006-054 - Palmas - Tocantins · sac@novatelecom.com.br · 0800 494 0103 · www.novatelecom.com.br</div>
      </footer>
    </article>
  );
}

async function readReportUnits() {
  try {
    return await apiJson<ReportUnitCatalog>("/monitoring/reports/units");
  } catch {
    return { total: 0, items: [] };
  }
}

async function readReport(unitId: string, from: string, to: string) {
  try {
    const query = new URLSearchParams({ unitId, from, to });
    return {
      report: await apiJson<MonitoringReport>(`/monitoring/reports/prtg-style?${query.toString()}`),
      error: "",
    };
  } catch (error) {
    return {
      report: null,
      error: getActionErrorMessage(error),
    };
  }
}

async function readReportSources() {
  try {
    return await apiJson<ReportSource[]>("/monitoring/reports/sources");
  } catch {
    return [];
  }
}

async function readZabbixGroups(integrationId: string) {
  try {
    const query = new URLSearchParams({ integrationId });
    return await apiJson<ZabbixGroupCatalog>(`/monitoring/reports/groups/zabbix?${query.toString()}`);
  } catch {
    return null;
  }
}

async function readZabbixGroupPreview(integrationId: string, groupIds: string[]) {
  try {
    const query = new URLSearchParams({ integrationId, groupIds: groupIds.join(",") });
    return {
      preview: await apiJson<ZabbixGroupPreview>(`/monitoring/reports/groups/zabbix/preview?${query.toString()}`),
      error: "",
    };
  } catch (error) {
    return {
      preview: null,
      error: getActionErrorMessage(error),
    };
  }
}

async function readReportTemplates() {
  try {
    return await apiJson<ReportTemplate[]>("/monitoring/report-templates");
  } catch {
    return [];
  }
}

async function readReportTemplateRuns() {
  try {
    return await apiJson<ReportTemplateRun[]>("/monitoring/report-template-runs");
  } catch {
    return [];
  }
}

export default async function MonitoringReportsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/relatorios/monitoramento");
  }

  const params = await resolveSearchParams(searchParams);
  const defaults = defaultRange();
  const catalog = await readReportUnits();
  const reportSources = await readReportSources();
  const templates = await readReportTemplates();
  const recentTemplateRuns = await readReportTemplateRuns();
  const requestedUnitId = readStringParam(params, "unitId", "");
  const requestedGroupIntegrationId = readStringParam(params, "groupIntegrationId", "");
  const requestedGroupIds = readCsvParam(params, "groupIds");
  const templateStatus = readStringParam(params, "templateStatus", "");
  const templateMessage = readStringParam(params, "templateMessage", "");
  const automationStatus = readStringParam(params, "automationStatus", "");
  const automationMessage = readStringParam(params, "automationMessage", "");
  const selectedUnitId = requestedUnitId || catalog.items[0]?.id || "";
  const from = readStringParam(params, "from", defaults.from);
  const to = readStringParam(params, "to", defaults.to);
  const selectedUnit = catalog.items.find((item) => item.id === selectedUnitId) || catalog.items[0];
  const selectedGroupSource =
    reportSources.find((item) => item.id === requestedGroupIntegrationId) || null;
  const groupIntegrationDefaultId = selectedGroupSource?.id || reportSources[0]?.id || "";
  const groupCatalog = selectedGroupSource ? await readZabbixGroups(selectedGroupSource.id) : null;
  const {
    preview: groupPreview,
    error: groupPreviewError,
  } =
    selectedGroupSource && requestedGroupIds.length
      ? await readZabbixGroupPreview(selectedGroupSource.id, requestedGroupIds)
      : { preview: null, error: "" };
  const previewUnitIds = groupPreview?.matchedUnits.map((item) => item.unit.id) || [];
  const exportSelectedUnitIds = previewUnitIds.length
    ? previewUnitIds
    : selectedUnitId
      ? [selectedUnitId]
      : [];
  const templateSourceType = groupPreview && selectedGroupSource && requestedGroupIds.length ? "zabbix_group" : "manual";
  const templateIntegrationId = templateSourceType === "zabbix_group" ? selectedGroupSource?.id || "" : "";
  const templateUnitIds = templateSourceType === "zabbix_group" ? previewUnitIds : exportSelectedUnitIds;
  const returnTo = (() => {
    const query = new URLSearchParams();
    if (selectedUnitId) query.set("unitId", selectedUnitId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (selectedGroupSource?.id) query.set("groupIntegrationId", selectedGroupSource.id);
    if (requestedGroupIds.length) query.set("groupIds", requestedGroupIds.join(","));
    const qs = query.toString();
    return qs ? `/relatorios/monitoramento?${qs}` : "/relatorios/monitoramento";
  })();
  const { report, error } =
    requestedUnitId && selectedUnitId ? await readReport(selectedUnitId, from, to) : { report: null, error: "" };

  return (
    <AppShell
      title="Relatórios"
      subtitle="Relatório de monitoramento com dados Zabbix e entrega visual inspirada no PRTG."
    >
      <div className="report-workbench space-y-5">
        <RegistryHero
          eyebrow="Zabbix Data · PRTG Delivery"
          title="Relatório de monitoramento pronto para cliente"
          description="A coleta continua no Zabbix. O NOVA transforma os itens históricos em uma página de relatório com período, sensores, estatísticas e gráficos no padrão visual que você quer entregar."
          actions={
            report ? (
              <div className="report-toolbar flex flex-wrap gap-2">
                <ReportPrintButton />
                <Link
                  href="/monitoramento"
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                >
                  Abrir monitoramento
                </Link>
              </div>
            ) : null
          }
        />

        <RegistrySummaryStrip
          items={[
            { label: "Fonte", value: "Zabbix", meta: "histórico e itens", tone: "success" },
            { label: "Entrega", value: "PRTG-like", meta: "layout e estatísticas", tone: "info" },
            { label: "Unidades", value: catalog.total, meta: `${catalog.items.length} carregadas no seletor`, tone: catalog.items.length ? "success" : "attention" },
            { label: "Exportação", value: "PDF / DOCX", meta: "download server-side", tone: "neutral" },
          ]}
          noteTitle="Decisão de arquitetura"
          noteCopy="Não há coleta PRTG. A tela apenas reproduz o formato de apresentação usando os dados históricos vindos do Zabbix. Agora você também pode montar a exportação a partir de grupos do Zabbix e revisar manualmente as unidades antes do download."
        />

        {templateStatus ? (
          <Surface className={`p-4 text-sm ${templateStatus === "saved" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-50" : "border-rose-500/20 bg-rose-500/10 text-rose-100"}`}>
            {templateStatus === "saved" ? "Template salvo com sucesso." : `Falha ao salvar template: ${templateMessage || "erro desconhecido"}`}
          </Surface>
        ) : null}

        {automationStatus ? (
          <Surface className={`p-4 text-sm ${automationStatus === "saved" ? "border-sky-500/20 bg-sky-500/10 text-sky-50" : "border-rose-500/20 bg-rose-500/10 text-rose-100"}`}>
            {automationStatus === "saved" ? "Automação criada com sucesso." : `Falha ao criar automação: ${automationMessage || "erro desconhecido"}`}
          </Surface>
        ) : null}

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Período do relatório"
            title="Executar relatório"
            description="Escolha a unidade e o intervalo. Os atalhos recriam o fluxo operacional da tela de relatórios do PRTG, mas o dataset vem do Zabbix."
            compact
            actions={
              selectedUnit ? (
                <TonePill tone={report?.host?.hostId ? "success" : error ? "attention" : "neutral"}>
                  {report?.host?.hostName || report?.host?.host || (error ? "Falha ao validar host" : "Host validado ao executar")}
                </TonePill>
              ) : null
            }
          />

          <form action="/relatorios/monitoramento" method="GET" className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Unidade monitorada
              <select name="unitId" defaultValue={selectedUnitId}>
                {catalog.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Data de início
              <input name="from" type="date" defaultValue={from} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Data de encerramento
              <input name="to" type="date" defaultValue={to} />
            </label>
            <button type="submit">Executar relatório</button>
          </form>

          {selectedUnitId ? (
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={reportHref(selectedUnitId, quickRange(1))}>
                Hoje
              </Link>
              <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={reportHref(selectedUnitId, quickRange(7))}>
                7 dias
              </Link>
              <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={reportHref(selectedUnitId, monthRange(0))}>
                Este mês
              </Link>
              <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={reportHref(selectedUnitId, monthRange(-1))}>
                Mês passado
              </Link>
            </div>
          ) : null}
        </Surface>

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Origem por grupos"
            title="Selecionar unidades a partir do Zabbix"
            description="Escolha a integração, carregue um ou mais host groups do Zabbix e revise as unidades reconhecidas antes de exportar. O matching usa o vínculo manual do host e as heurísticas já existentes."
            compact
            actions={
              selectedGroupSource ? (
                <TonePill tone={groupPreview ? "success" : groupCatalog?.items.length ? "info" : "neutral"}>
                  {selectedGroupSource.code} · {selectedGroupSource.name}
                </TonePill>
              ) : null
            }
          />

          <form action="/relatorios/monitoramento" method="GET" className="mt-5 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_auto]">
            <input type="hidden" name="unitId" value={selectedUnitId} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Integração Zabbix
              <select name="groupIntegrationId" defaultValue={groupIntegrationDefaultId}>
                {reportSources.length ? (
                  reportSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} - {source.name}
                    </option>
                  ))
                ) : (
                  <option value="">Sem integrações Zabbix ativas</option>
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Host groups
              <select
                name="groupIds"
                multiple
                size={10}
                defaultValue={requestedGroupIds}
                disabled={!groupCatalog?.items.length}
              >
                {(groupCatalog?.items || []).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {group.hostCount} host(s)
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-slate-400">
                Selecione um ou mais grupos. Depois a tela monta um preview das unidades encontradas para você revisar antes da exportação.
              </span>
            </label>

            <div className="flex flex-col justify-end gap-2">
              <button type="submit">Revisar grupos</button>
              <Link
                href={`/relatorios/monitoramento?unitId=${encodeURIComponent(selectedUnitId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Limpar seleção
              </Link>
            </div>
          </form>

          {groupPreviewError ? (
            <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Não foi possível revisar os grupos agora: {groupPreviewError}
            </div>
          ) : null}

          {groupPreview ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Grupos</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-100">{groupPreview.counts.selectedGroups}</div>
                  <div className="mt-1 text-xs text-slate-400">{groupPreview.groups.map((group) => group.name).join(" · ")}</div>
                </div>
                <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Hosts</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-100">{groupPreview.counts.hosts}</div>
                  <div className="mt-1 text-xs text-slate-400">retornados pelo Zabbix</div>
                </div>
                <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-emerald-200/80">Unidades reconhecidas</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-50">{groupPreview.counts.matchedUnits}</div>
                  <div className="mt-1 text-xs text-emerald-100/80">já entram pré-selecionadas na exportação</div>
                </div>
                <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-amber-200/80">Pendências</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-50">{groupPreview.counts.ambiguousHosts + groupPreview.counts.unmatchedHosts}</div>
                  <div className="mt-1 text-xs text-amber-100/80">{groupPreview.counts.ambiguousHosts} ambíguo(s) · {groupPreview.counts.unmatchedHosts} sem vínculo</div>
                </div>
              </div>

              {groupPreview.matchedUnits.length ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
                    Unidades encontradas
                  </div>
                  <div className="grid gap-0">
                    {groupPreview.matchedUnits.map((item) => (
                      <div key={item.unit.id} className="grid gap-3 border-b border-white/5 px-4 py-4 text-sm text-slate-200 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_160px]">
                        <div>
                          <div className="font-semibold text-slate-100">{item.unit.code} - {item.unit.name}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.unit.partner.code} · {[item.unit.city, item.unit.state].filter(Boolean).join("/") || "sem cidade/UF"}
                          </div>
                        </div>
                        <div>
                          <div>{item.primaryHost.hostName || item.primaryHost.host || item.primaryHost.hostId}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.groups.join(" · ") || "sem grupo retornado"}{item.hostCount > 1 ? ` · ${item.hostCount} host(s)` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-slate-300">
                          <div>Confiança: {item.confidence}%</div>
                          <div className="mt-1">{item.matchedBy.join(" · ") || "heurística"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {groupPreview.unresolvedHosts.length ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
                    Hosts que ainda precisam de revisão
                  </div>
                  <div className="grid gap-0">
                    {groupPreview.unresolvedHosts.slice(0, 12).map((item) => (
                      <div key={item.host.hostId} className="grid gap-2 border-b border-white/5 px-4 py-4 text-sm text-slate-200 md:grid-cols-[minmax(0,1fr)_180px]">
                        <div>
                          <div className="font-semibold text-slate-100">{item.host.hostName || item.host.host || item.host.hostId}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.host.groups.join(" · ") || "sem grupo retornado"}</div>
                        </div>
                        <div className="text-xs text-slate-300">
                          <div>Status: {item.status === "ambiguous" ? "Ambíguo" : "Sem unidade"}</div>
                          <div className="mt-1">Sinais: {item.matchedBy.join(" · ") || "sem sinais suficientes"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Surface>

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Exportação corporativa"
            title="Gerar arquivo para download"
            description="Monte o arquivo final com uma ou mais unidades, escolha PDF ou DOCX, decida se os gráficos entram e preencha os dados comerciais que ainda não existem no cadastro."
            compact
            actions={<TonePill tone="info">Download server-side</TonePill>}
          />

          <form action="/relatorios/monitoramento/export" method="POST" target="_blank" className="mt-5 grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />

            <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-2">
              Unidades da exportação
              <select name="unitIds" multiple size={12} defaultValue={exportSelectedUnitIds}>
                {catalog.items.map((item) => (
                  <option key={`export-${item.id}`} value={item.id}>
                    {item.partner.code} · {item.code} - {item.name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-slate-400">
                Use `Ctrl` ou `Cmd` para selecionar várias unidades.
                {groupPreview
                  ? ` ${groupPreview.counts.matchedUnits} unidade(s) reconhecida(s) a partir dos grupos já ficaram pré-selecionadas aqui.`
                  : " Você também pode preencher essa lista manualmente mesmo sem usar os grupos do Zabbix."}
              </span>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Formato do arquivo
              <select name="format" defaultValue="pdf">
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
              <input type="checkbox" name="includeCharts" defaultChecked className="h-4 w-4" />
              Incluir gráficos no arquivo
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Título do relatório
              <input name="title" defaultValue="Relatório de Consumo" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Interessado
              <input name="interestedParty" defaultValue={selectedUnit?.partner.name || ""} placeholder="Ex.: Secretaria Municipal de Administração" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Contrato
              <input name="contractLabel" placeholder="Ex.: Contrato 123/2026" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Banda contratada
              <input name="contractedBandwidth" placeholder="Ex.: 300 Mbit/s" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-2">
              Endereço ou observação comercial
              <input name="addressLine" placeholder="Ex.: Rua X, Centro, Gurupi - TO" />
            </label>

            <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="max-w-3xl text-sm text-slate-300">
                O arquivo é montado no servidor e sai com cabeçalho, rodapé e estrutura comercial no estilo do modelo enviado. Se desmarcar os gráficos, a exportação sai só com as informações gerais e métricas resumidas.
              </p>
              <button type="submit">Baixar arquivo</button>
            </div>
          </form>
        </Surface>

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Template salvo"
            title="Salvar configuração para reutilizar"
            description="Congele a seleção atual como um template do NOVA. Se você estiver vendo um preview por grupos do Zabbix, o template já nasce vinculado aos grupos escolhidos; caso contrário, ele salva a seleção manual."
            compact
            actions={<TonePill tone={templateSourceType === "zabbix_group" ? "success" : "info"}>{templateSourceType === "zabbix_group" ? "Template por grupo" : "Template manual"}</TonePill>}
          />

          <form action="/relatorios/monitoramento/templates" method="POST" className="mt-5 grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="sourceType" value={templateSourceType} />
            <input type="hidden" name="integrationId" value={templateIntegrationId} />
            {templateUnitIds.map((unitId) => (
              <input key={`template-unit-${unitId}`} type="hidden" name="unitIds" value={unitId} />
            ))}
            {requestedGroupIds.map((groupId) => (
              <input key={`template-group-${groupId}`} type="hidden" name="groupIds" value={groupId} />
            ))}

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Código do template
              <input name="code" placeholder="Ex.: REL-UNITINS-GRUPO" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Nome do template
              <input name="name" placeholder="Ex.: Relatório mensal UNITINS" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Período padrão
              <select name="periodPreset" defaultValue="last_7_days">
                <option value="last_7_days">Últimos 7 dias</option>
                <option value="current_month">Mês atual</option>
                <option value="previous_month">Mês anterior</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Formato padrão
              <select name="outputFormat" defaultValue="pdf">
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 xl:col-span-2">
              <input type="checkbox" name="includeCharts" defaultChecked className="h-4 w-4" />
              Incluir gráficos por padrão neste template
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Título
              <input name="title" defaultValue="Relatório de Consumo" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Interessado
              <input name="interestedParty" defaultValue={selectedUnit?.partner.name || ""} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Contrato
              <input name="contractLabel" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Banda contratada
              <input name="contractedBandwidth" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-2">
              Endereço
              <input name="addressLine" />
            </label>

            <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="max-w-3xl text-sm text-slate-300">
                {templateSourceType === "zabbix_group"
                  ? `Este template ficará ligado aos grupos selecionados e poderá resolver automaticamente as unidades a cada execução.`
                  : `Este template ficará com ${templateUnitIds.length} unidade(s) na seleção manual atual.`}
              </p>
              <button type="submit">Salvar template</button>
            </div>
          </form>
        </Surface>

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Automação recorrente"
            title="Agendar geração automática"
            description="Crie uma regra recorrente para executar um template salvo. O arquivo gerado fica registrado na execução da automação e pode ser baixado depois."
            compact
            actions={<TonePill tone="violet">Scheduler do NOVA</TonePill>}
          />

          <form action="/relatorios/monitoramento/automacoes" method="POST" className="mt-5 grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="returnTo" value={returnTo} />

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Template
              <select name="templateId" defaultValue={templates[0]?.id || ""}>
                {templates.length ? (
                  templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.code} - {template.name}
                    </option>
                  ))
                ) : (
                  <option value="">Salve um template antes</option>
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Código da automação
              <input name="code" placeholder="Ex.: AUTO-REL-UNITINS" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Nome da automação
              <input name="name" placeholder="Ex.: Relatório recorrente UNITINS" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Cadência
              <select name="cadence" defaultValue="hourly">
                <option value="every_5_minutes">A cada 5 minutos</option>
                <option value="hourly">Por hora</option>
                <option value="every_minute">A cada minuto</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 xl:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
              Ativar automação imediatamente
            </label>

            <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="max-w-3xl text-sm text-slate-300">
                A automação usa o scheduler interno do NOVA. Quando o template for baseado em grupos do Zabbix, a execução resolve as unidades daquele grupo novamente a cada rodada.
              </p>
              <button type="submit" disabled={!templates.length}>Criar automação</button>
            </div>
          </form>
        </Surface>

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Biblioteca"
            title="Templates e execuções recentes"
            description="Acompanhe os templates já salvos, veja as automações ligadas a eles e baixe os últimos arquivos gerados automaticamente."
            compact
          />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              {templates.length ? (
                templates.map((template) => (
                  <div key={template.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{template.code} · {template.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {template.sourceType === "zabbix_group" ? "Origem: grupos do Zabbix" : "Origem: seleção manual"} · {formatPeriodPreset(template.periodPreset)} · {template.outputFormat.toUpperCase()} · {template.includeCharts ? "com gráficos" : "sem gráficos"}
                        </div>
                      </div>
                      <TonePill tone={template.automations.length ? "success" : "neutral"}>
                        {template.automations.length ? `${template.automations.length} automação(ões)` : "sem automação"}
                      </TonePill>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      {template.sourceType === "zabbix_group"
                        ? `${template.groupIds.length} grupo(s) · ${template.integration?.code || "sem integração"}`
                        : `${template.unitIds.length} unidade(s) manual(is)`}
                    </div>

                    {template.automations.length ? (
                      <div className="mt-3 grid gap-2">
                        {template.automations.map((automation) => (
                          <div key={automation.id} className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-3 text-xs text-slate-300">
                            <div className="font-semibold text-slate-100">{automation.code} · {automation.name}</div>
                            <div className="mt-1">{formatCadence(automation.cadence)} · {automation.enabled ? "ativa" : "pausada"}</div>
                            <div className="mt-1">Última: {formatDateTime(automation.lastRunAt)} · Próxima: {formatDateTime(automation.nextRunAt)}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Nenhum template salvo ainda"
                  description="Use o bloco acima para congelar uma seleção manual ou por grupos do Zabbix e reaproveitar depois."
                />
              )}
            </div>

            <div className="space-y-4">
              {recentTemplateRuns.length ? (
                recentTemplateRuns.map((run) => (
                  <div key={run.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          {run.rule.reportTemplate?.code || "Sem template"} · {run.rule.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatCadence(run.rule.cadence)} · Início {formatDateTime(run.startedAt)}
                        </div>
                      </div>
                      <TonePill tone={run.status === "success" ? "success" : run.status === "error" ? "critical" : "attention"}>
                        {run.status}
                      </TonePill>
                    </div>

                    <div className="mt-3 text-xs text-slate-300">
                      {run.summary || run.errorMessage || `${run.hitsCount} unidade(s) processada(s)`}
                    </div>

                    {run.attachments.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {run.attachments.map((attachment) => (
                          <Link
                            key={attachment.id}
                            href={attachment.url}
                            className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                          >
                            Baixar {attachment.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Nenhuma execução automática ainda"
                  description="Depois de criar uma automação de relatório, os arquivos gerados aparecerão aqui com link de download."
                />
              )}
            </div>
          </div>
        </Surface>

        {error ? (
          <Surface className="report-toolbar border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
            Não foi possível gerar o relatório agora: {error}
          </Surface>
        ) : null}

        {report ? (
          <ReportSheet report={report} />
        ) : (
          <EmptyState
            title="Selecione uma unidade monitorada"
            description="Assim que houver um host Zabbix confiável para a unidade, o NOVA consegue montar o relatório no formato de entrega."
          />
        )}
      </div>
    </AppShell>
  );
}
