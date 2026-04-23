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

type BuilderQuery = {
  templateId?: string;
  unitId?: string;
  from?: string;
  to?: string;
  groupIntegrationId?: string;
  groupIds?: string[];
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

function rangeFromPreset(value?: string | null) {
  if (value === "current_month") return monthRange(0);
  if (value === "previous_month") return monthRange(-1);
  return defaultRange();
}

function buildBuilderHref(query: BuilderQuery) {
  const params = new URLSearchParams();
  if (query.templateId) params.set("templateId", query.templateId);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.groupIntegrationId) params.set("groupIntegrationId", query.groupIntegrationId);
  if (query.groupIds?.length) params.set("groupIds", query.groupIds.join(","));
  const serialized = params.toString();
  return serialized ? `/relatorios/monitoramento?${serialized}` : "/relatorios/monitoramento";
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
              down {formatValue(block.consumption.peakReceiveBps, "bps")} · up {" "}
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

function MetricCard({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  meta: string;
  tone?: "neutral" | "info" | "success" | "attention";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : tone === "attention"
        ? "border-amber-500/20 bg-amber-500/10"
        : tone === "info"
          ? "border-sky-500/20 bg-sky-500/10"
          : "border-white/10 bg-white/[0.04]";
  const labelClass =
    tone === "success"
      ? "text-emerald-100/85"
      : tone === "attention"
        ? "text-amber-100/85"
        : tone === "info"
          ? "text-sky-100/85"
          : "text-slate-500";
  const valueClass =
    tone === "success"
      ? "text-emerald-50"
      : tone === "attention"
        ? "text-amber-50"
        : tone === "info"
          ? "text-sky-50"
          : "text-slate-50";
  const metaClass =
    tone === "success"
      ? "text-emerald-100/75"
      : tone === "attention"
        ? "text-amber-100/75"
        : tone === "info"
          ? "text-sky-100/75"
          : "text-slate-400";

  return (
    <div className={`rounded-[18px] border p-4 ${toneClass}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</div>
      <div className={`mt-2 text-xl font-semibold ${valueClass}`}>{value}</div>
      <div className={`mt-1 text-xs ${metaClass}`}>{meta}</div>
    </div>
  );
}

function BuilderSummaryPanel({
  selectedTemplate,
  selectedGroupSource,
  groupIds,
  from,
  to,
  exportSelectedUnitIds,
  unresolvedCount,
  selectedUnit,
  report,
}: {
  selectedTemplate: ReportTemplate | null;
  selectedGroupSource: ReportSource | null;
  groupIds: string[];
  from: string;
  to: string;
  exportSelectedUnitIds: string[];
  unresolvedCount: number;
  selectedUnit:
    | {
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
      }
    | undefined;
  report: MonitoringReport | null;
}) {
  const originLabel = selectedTemplate
    ? `Template ${selectedTemplate.code}`
    : groupIds.length
      ? "Host groups do Zabbix"
      : "Unidade manual";
  const originMeta = selectedTemplate
    ? `${selectedTemplate.name} · ${formatPeriodPreset(selectedTemplate.periodPreset)}`
    : groupIds.length
      ? `${groupIds.length} grupo(s) usando ${selectedGroupSource?.code || "integração"}`
      : selectedUnit
        ? `${selectedUnit.code} - ${selectedUnit.name}`
        : "Defina a origem do lote";

  return (
    <Surface className="p-5 sm:p-6 xl:sticky xl:top-24">
      <SectionIntro
        eyebrow="Resumo"
        title="Builder do relatório"
        description="Tudo o que vai para o arquivo final fica consolidado aqui antes de baixar, salvar ou agendar."
        compact
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MetricCard label="Origem ativa" value={originLabel} meta={originMeta} tone={selectedTemplate ? "info" : groupIds.length ? "success" : "neutral"} />
        <MetricCard label="Período" value={`${formatDate(from)} - ${formatDate(to)}`} meta="Intervalo usado para leitura histórica e exportação" tone="neutral" />
        <MetricCard label="Lote pronto" value={exportSelectedUnitIds.length} meta="Unidade(s) que já entram pré-selecionadas na exportação" tone={exportSelectedUnitIds.length ? "success" : "attention"} />
        <MetricCard label="Pendências" value={unresolvedCount} meta={unresolvedCount ? "Há hosts do grupo ainda sem vínculo ou ambíguos" : "Nenhum host pendente de revisão"} tone={unresolvedCount ? "attention" : "success"} />
        <MetricCard label="Preview em foco" value={selectedUnit?.code || "Sem foco"} meta={report?.host?.hostName || report?.host?.host || selectedUnit?.name || "Escolha uma unidade para visualizar antes do download"} tone={report ? "success" : "neutral"} />
      </div>

      <div className="mt-5 space-y-2 text-sm text-slate-300">
        <a href="#builder-output" className="flex items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]">
          <span>Ir para saída e download</span>
          <span className="text-slate-500">↓</span>
        </a>
        <a href="#builder-actions" className="flex items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]">
          <span>Salvar template ou agendar</span>
          <span className="text-slate-500">↓</span>
        </a>
        <a href="#builder-library" className="flex items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]">
          <span>Abrir biblioteca operacional</span>
          <span className="text-slate-500">↓</span>
        </a>
      </div>
    </Surface>
  );
}

export default async function MonitoringReportsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/relatorios/monitoramento");
  }

  const params = await resolveSearchParams(searchParams);
  const catalog = await readReportUnits();
  const reportSources = await readReportSources();
  const templates = await readReportTemplates();
  const recentTemplateRuns = await readReportTemplateRuns();

  const requestedTemplateId = readStringParam(params, "templateId", "");
  const selectedTemplate = templates.find((item) => item.id === requestedTemplateId) || null;
  const presetRange = rangeFromPreset(selectedTemplate?.periodPreset);
  const from = readStringParam(params, "from", presetRange.from);
  const to = readStringParam(params, "to", presetRange.to);
  const requestedUnitId = readStringParam(params, "unitId", "");
  const requestedGroupIntegrationId = readStringParam(params, "groupIntegrationId", "");
  const requestedGroupIds = readCsvParam(params, "groupIds");
  const templateStatus = readStringParam(params, "templateStatus", "");
  const templateMessage = readStringParam(params, "templateMessage", "");
  const automationStatus = readStringParam(params, "automationStatus", "");
  const automationMessage = readStringParam(params, "automationMessage", "");

  const templateManualUnitIds = selectedTemplate?.sourceType === "manual" ? selectedTemplate.unitIds : [];
  const templateGroupIds = selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.groupIds : [];
  const selectedUnitId = requestedUnitId || templateManualUnitIds[0] || catalog.items[0]?.id || "";
  const selectedUnit = catalog.items.find((item) => item.id === selectedUnitId) || catalog.items[0];
  const effectiveGroupIntegrationId =
    requestedGroupIntegrationId ||
    (selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.integration?.id || "" : "");
  const effectiveGroupIds = requestedGroupIds.length ? requestedGroupIds : templateGroupIds;
  const selectedGroupSource = reportSources.find((item) => item.id === effectiveGroupIntegrationId) || null;
  const groupCatalog = selectedGroupSource ? await readZabbixGroups(selectedGroupSource.id) : null;
  const {
    preview: groupPreview,
    error: groupPreviewError,
  } =
    selectedGroupSource && effectiveGroupIds.length
      ? await readZabbixGroupPreview(selectedGroupSource.id, effectiveGroupIds)
      : { preview: null, error: "" };
  const previewUnitIds = groupPreview?.matchedUnits.map((item) => item.unit.id) || [];
  const exportSelectedUnitIds = previewUnitIds.length
    ? previewUnitIds
    : templateManualUnitIds.length
      ? templateManualUnitIds
      : selectedUnitId
        ? [selectedUnitId]
        : [];
  const unresolvedCount = groupPreview
    ? groupPreview.counts.ambiguousHosts + groupPreview.counts.unmatchedHosts
    : 0;
  const templateSourceType =
    groupPreview && selectedGroupSource && effectiveGroupIds.length ? "zabbix_group" : "manual";
  const templateIntegrationId =
    templateSourceType === "zabbix_group"
      ? selectedGroupSource?.id || selectedTemplate?.integration?.id || ""
      : "";
  const templateUnitIds = templateSourceType === "zabbix_group" ? previewUnitIds : exportSelectedUnitIds;
  const defaultFormat = selectedTemplate?.outputFormat?.toLowerCase() === "docx" ? "docx" : "pdf";
  const defaultIncludeCharts = selectedTemplate?.includeCharts ?? true;
  const defaultTitle = selectedTemplate?.title || "Relatório de Consumo";
  const defaultInterestedParty = selectedTemplate?.interestedParty || selectedUnit?.partner.name || "";
  const defaultContractLabel = selectedTemplate?.contractLabel || "";
  const defaultBandwidth = selectedTemplate?.contractedBandwidth || "";
  const defaultAddressLine = selectedTemplate?.addressLine || "";
  const selectedTemplateId = selectedTemplate?.id || "";
  const currentBuilderQuery: BuilderQuery = {
    templateId: selectedTemplateId || undefined,
    unitId: selectedUnitId || undefined,
    from,
    to,
    groupIntegrationId: selectedGroupSource?.id || undefined,
    groupIds: effectiveGroupIds,
  };
  const returnTo = buildBuilderHref(currentBuilderQuery);
  const resetHref = "/relatorios/monitoramento";
  const templateApplyHref = (templateId: string) => buildBuilderHref({ templateId });
  const clearGroupsHref = buildBuilderHref({
    templateId: selectedTemplateId || undefined,
    unitId: selectedUnitId || undefined,
    from,
    to,
  });
  const quickTodayHref = buildBuilderHref({
    ...currentBuilderQuery,
    from: quickRange(1).from,
    to: quickRange(1).to,
  });
  const quickWeekHref = buildBuilderHref({
    ...currentBuilderQuery,
    from: quickRange(7).from,
    to: quickRange(7).to,
  });
  const quickMonthHref = buildBuilderHref({
    ...currentBuilderQuery,
    from: monthRange(0).from,
    to: monthRange(0).to,
  });
  const quickPrevMonthHref = buildBuilderHref({
    ...currentBuilderQuery,
    from: monthRange(-1).from,
    to: monthRange(-1).to,
  });
  const { report, error } =
    selectedUnitId && selectedUnit ? await readReport(selectedUnitId, from, to) : { report: null, error: "" };

  return (
    <AppShell
      title="Relatórios"
      subtitle="Monte o relatório final em um builder único: escopo, período, conteúdo, saída e reutilização da configuração."
    >
      <div className="report-workbench space-y-5">
        <RegistryHero
          eyebrow="Zabbix Data · PRTG Delivery"
          title="Builder de relatório de monitoramento"
          description="A coleta continua no Zabbix, mas a montagem final agora gira em torno de um único fluxo: escolher o escopo, revisar as unidades, decidir o conteúdo, baixar o arquivo ou transformar essa configuração em template e automação."
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
            { label: "Entrega", value: "PDF / DOCX", meta: "download server-side", tone: "info" },
            { label: "Templates", value: templates.length, meta: `${recentTemplateRuns.length} execução(ões) recentes`, tone: templates.length ? "success" : "attention" },
            { label: "Lote atual", value: exportSelectedUnitIds.length, meta: groupPreview ? "resolvido por grupo ou template" : "manual ou em foco", tone: exportSelectedUnitIds.length ? "neutral" : "attention" },
          ]}
          noteTitle="Como o builder pensa"
          noteCopy="Primeiro você define o escopo do relatório, depois revisa o lote, escolhe o conteúdo e só então decide se vai baixar, salvar como template ou agendar. Templates e automações continuam existindo, mas agora como continuidade da mesma configuração, não como uma tela paralela."
        />

        {selectedTemplate ? (
          <Surface className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Template carregado</div>
                <div className="mt-1 text-sm font-semibold text-slate-50">
                  {selectedTemplate.code} · {selectedTemplate.name}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {selectedTemplate.sourceType === "zabbix_group" ? "A origem veio de grupos do Zabbix." : "A origem veio de uma seleção manual de unidades."} Você ainda pode ajustar período, foco, grupos e saída antes do download.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <TonePill tone="info">{formatPeriodPreset(selectedTemplate.periodPreset)}</TonePill>
                <TonePill tone={selectedTemplate.includeCharts ? "success" : "neutral"}>
                  {selectedTemplate.includeCharts ? "com gráficos" : "sem gráficos"}
                </TonePill>
                <TonePill tone="neutral">{selectedTemplate.outputFormat.toUpperCase()}</TonePill>
                <Link
                  href={resetHref}
                  className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Voltar ao builder em branco
                </Link>
              </div>
            </div>
          </Surface>
        ) : null}

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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Surface className="report-toolbar p-5 sm:p-6">
              <SectionIntro
                eyebrow="1. Escopo e período"
                title="Defina a base do relatório"
                description="Você pode começar de um template salvo, de uma unidade em foco ou de host groups do Zabbix. Tudo converge para a mesma seleção final de unidades."
                compact
              />

              <form action="/relatorios/monitoramento" method="GET" className="mt-5 grid gap-4 xl:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Partir de um template salvo
                  <select name="templateId" defaultValue={selectedTemplateId}>
                    <option value="">Builder em branco</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.code} - {template.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-slate-400">
                    O template injeta origem, período padrão, formato e conteúdo, mas você ainda pode ajustar tudo abaixo.
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Unidade em foco para preview
                  <select name="unitId" defaultValue={selectedUnitId}>
                    {catalog.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-slate-400">
                    Essa unidade serve para validar host, gráficos e período antes da exportação final do lote.
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Integração Zabbix
                  <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""}>
                    <option value="">Não usar grupos nesta rodada</option>
                    {reportSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.code} - {source.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-slate-400">
                    Se você escolher grupos, o lote passa a ser resolvido automaticamente pelo Zabbix e depois refinado manualmente.
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Host groups
                  <select name="groupIds" multiple size={9} defaultValue={effectiveGroupIds} disabled={!groupCatalog?.items.length}>
                    {(groupCatalog?.items || []).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} · {group.hostCount} host(s)
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-slate-400">
                    Se ficar vazio, o builder usa só a unidade em foco ou a seleção trazida pelo template manual.
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Data de início
                  <input name="from" type="date" defaultValue={from} />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Data de encerramento
                  <input name="to" type="date" defaultValue={to} />
                </label>

                <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="max-w-3xl text-sm text-slate-300">
                    A ordem mental do builder é esta: origem, período e resolução do lote. Depois disso, a saída, o template e a automação apenas reaproveitam essa mesma configuração.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={resetHref}
                      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Limpar tudo
                    </Link>
                    <button type="submit">Atualizar builder</button>
                  </div>
                </div>
              </form>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={quickTodayHref}>
                  Hoje
                </Link>
                <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={quickWeekHref}>
                  7 dias
                </Link>
                <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={quickMonthHref}>
                  Este mês
                </Link>
                <Link className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]" href={quickPrevMonthHref}>
                  Mês passado
                </Link>
              </div>
            </Surface>

            <Surface className="report-toolbar p-5 sm:p-6">
              <SectionIntro
                eyebrow="2. Revisão do lote"
                title="Veja o que virou unidade exportável"
                description="Quando você usa grupos do Zabbix, o NOVA resolve hosts para unidades e te mostra imediatamente o que entrou, o que ficou ambíguo e o que ainda não tem vínculo."
                compact
                actions={
                  selectedGroupSource ? (
                    <TonePill tone={groupPreview ? "success" : groupCatalog?.items.length ? "info" : "neutral"}>
                      {selectedGroupSource.code}
                    </TonePill>
                  ) : (
                    <TonePill tone="neutral">Sem grupos nesta rodada</TonePill>
                  )
                }
              />

              {groupPreview ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Grupos" value={groupPreview.counts.selectedGroups} meta={groupPreview.groups.map((group) => group.name).join(" · ") || "Sem grupos"} tone="info" />
                    <MetricCard label="Hosts" value={groupPreview.counts.hosts} meta="retornados pelo Zabbix" tone="neutral" />
                    <MetricCard label="Unidades reconhecidas" value={groupPreview.counts.matchedUnits} meta="já entraram no lote" tone="success" />
                    <MetricCard label="Pendências" value={unresolvedCount} meta={`${groupPreview.counts.ambiguousHosts} ambíguo(s) · ${groupPreview.counts.unmatchedHosts} sem vínculo`} tone={unresolvedCount ? "attention" : "success"} />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-100">Unidades reconhecidas</div>
                        <TonePill tone="success">{groupPreview.counts.matchedUnits} pronta(s)</TonePill>
                      </div>
                      {groupPreview.matchedUnits.length ? (
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
                                  {item.groups.join(" · ") || "sem grupo retornado"}
                                  {item.hostCount > 1 ? ` · ${item.hostCount} host(s)` : ""}
                                </div>
                              </div>
                              <div className="text-xs text-slate-300">
                                <div>Confiança: {item.confidence}%</div>
                                <div className="mt-1">{item.matchedBy.join(" · ") || "heurística"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-5 text-sm text-slate-400">
                          Nenhuma unidade foi reconhecida com segurança para os grupos selecionados.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-slate-100">O que acontece daqui para frente</div>
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          <li>As unidades reconhecidas já ficam pré-selecionadas no download.</li>
                          <li>Você ainda pode incluir ou tirar unidades manualmente na etapa de saída.</li>
                          <li>Se salvar como template, os grupos continuam ligados à configuração.</li>
                        </ul>
                      </div>

                      {groupPreview.unresolvedHosts.length ? (
                        <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-4">
                          <div className="text-sm font-semibold text-amber-50">Hosts que ainda precisam de revisão</div>
                          <div className="mt-3 space-y-3 text-sm text-amber-50/90">
                            {groupPreview.unresolvedHosts.slice(0, 8).map((item) => (
                              <div key={item.host.hostId} className="rounded-[14px] border border-amber-200/10 bg-black/10 px-3 py-3">
                                <div className="font-semibold">{item.host.hostName || item.host.host || item.host.hostId}</div>
                                <div className="mt-1 text-xs text-amber-100/80">
                                  {item.status === "ambiguous" ? "Ambíguo" : "Sem unidade reconhecida"} · {item.host.groups.join(" · ") || "sem grupo retornado"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                          Nenhum host ficou pendente nesta rodada. O lote está limpo para exportação.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                    {selectedTemplate?.sourceType === "manual"
                      ? `O template carregado já trouxe ${templateManualUnitIds.length} unidade(s) manual(is) para o lote. Se quiser usar grupos do Zabbix nesta rodada, escolha uma integração e revise os grupos acima.`
                      : "Nesta rodada o lote ainda não está vindo de grupos. Você pode seguir só com a unidade em foco ou selecionar uma integração e revisar host groups para expandir a exportação."}
                  </div>
                  <Link
                    href={clearGroupsHref}
                    className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    Limpar seleção por grupos
                  </Link>
                </div>
              )}

              {groupPreviewError ? (
                <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  Não foi possível revisar os grupos agora: {groupPreviewError}
                </div>
              ) : null}
            </Surface>

            <Surface id="builder-output" className="report-toolbar p-5 sm:p-6">
              <SectionIntro
                eyebrow="3. Conteúdo e saída"
                title="Monte o arquivo final"
                description="Aqui você fecha a lista final de unidades, escolhe PDF ou DOCX, decide se os gráficos entram e define os dados comerciais do documento."
                compact
                actions={<TonePill tone="info">Download server-side</TonePill>}
              />

              <form id="builder-export-form" action="/relatorios/monitoramento/export" method="POST" target="_blank" className="mt-5 grid gap-4 xl:grid-cols-2">
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
                    Use `Ctrl` ou `Cmd` para montar o lote final. {groupPreview
                      ? `${groupPreview.counts.matchedUnits} unidade(s) reconhecida(s) a partir dos grupos já ficaram pré-selecionadas aqui.`
                      : templateManualUnitIds.length
                        ? `${templateManualUnitIds.length} unidade(s) vieram do template manual carregado.`
                        : "Você também pode fazer tudo manualmente, mesmo sem grupos do Zabbix."}
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Formato do arquivo
                  <select name="format" defaultValue={defaultFormat}>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
                  <input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                  Incluir gráficos no arquivo
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Título do relatório
                  <input name="title" defaultValue={defaultTitle} />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Interessado
                  <input name="interestedParty" defaultValue={defaultInterestedParty} placeholder="Ex.: Secretaria Municipal de Administração" />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Contrato
                  <input name="contractLabel" defaultValue={defaultContractLabel} placeholder="Ex.: Contrato 123/2026" />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Banda contratada
                  <input name="contractedBandwidth" defaultValue={defaultBandwidth} placeholder="Ex.: 300 Mbit/s" />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-2">
                  Endereço ou observação comercial
                  <input name="addressLine" defaultValue={defaultAddressLine} placeholder="Ex.: Rua X, Centro, Gurupi - TO" />
                </label>

                <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="max-w-3xl text-sm text-slate-300">
                    O arquivo sai pronto para download com cabeçalho, rodapé e estrutura comercial no padrão que você está perseguindo. Se os gráficos forem desmarcados, a entrega sai só com informações gerais e métricas resumidas.
                  </p>
                  <button type="submit">Baixar arquivo</button>
                </div>
              </form>
            </Surface>

            {error ? (
              <Surface className="report-toolbar border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
                Não foi possível gerar o preview agora: {error}
              </Surface>
            ) : null}

            {report ? (
              <div className="space-y-4">
                <SectionIntro
                  eyebrow="4. Preview"
                  title="Validação visual da unidade em foco"
                  description="Antes do lote final, você consegue enxergar como o relatório está se comportando em uma unidade representativa da seleção atual."
                  compact
                />
                <ReportSheet report={report} />
              </div>
            ) : (
              <EmptyState
                title="Escolha uma unidade monitorada"
                description="Assim que houver uma unidade em foco com host Zabbix confiável, o NOVA consegue montar o preview no formato de entrega."
              />
            )}

            <Surface id="builder-actions" className="report-toolbar p-5 sm:p-6">
              <SectionIntro
                eyebrow="4. Reutilização"
                title="Transforme essa configuração em ativo operacional"
                description="Depois que o builder estiver do jeito certo, você decide se quer congelar a configuração como template, automatizar a execução ou apenas seguir baixando manualmente."
                compact
              />

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <details className="group rounded-[18px] border border-white/10 bg-white/[0.03] p-4" open={templateStatus === "error"}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Salvar a configuração atual como template</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Use quando o lote, o período padrão e a saída estiverem estáveis o suficiente para virar base de reuso.
                      </div>
                    </div>
                    <TonePill tone={templateSourceType === "zabbix_group" ? "success" : "info"}>
                      {templateSourceType === "zabbix_group" ? "Template por grupo" : "Template manual"}
                    </TonePill>
                  </summary>

                  <form action="/relatorios/monitoramento/templates" method="POST" className="mt-5 grid gap-4">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="sourceType" value={templateSourceType} />
                    <input type="hidden" name="integrationId" value={templateIntegrationId} />
                    {templateUnitIds.map((unitId) => (
                      <input key={`template-unit-${unitId}`} type="hidden" name="unitIds" value={unitId} />
                    ))}
                    {effectiveGroupIds.map((groupId) => (
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

                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Período padrão
                        <select name="periodPreset" defaultValue={selectedTemplate?.periodPreset || "last_7_days"}>
                          <option value="last_7_days">Últimos 7 dias</option>
                          <option value="current_month">Mês atual</option>
                          <option value="previous_month">Mês anterior</option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Formato padrão
                        <select name="outputFormat" defaultValue={defaultFormat}>
                          <option value="pdf">PDF</option>
                          <option value="docx">DOCX</option>
                        </select>
                      </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
                      <input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                      Incluir gráficos por padrão neste template
                    </label>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Título
                        <input name="title" defaultValue={defaultTitle} />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Interessado
                        <input name="interestedParty" defaultValue={defaultInterestedParty} />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Contrato
                        <input name="contractLabel" defaultValue={defaultContractLabel} />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Banda contratada
                        <input name="contractedBandwidth" defaultValue={defaultBandwidth} />
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      Endereço
                      <input name="addressLine" defaultValue={defaultAddressLine} />
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
                      <p className="max-w-3xl text-sm text-slate-300">
                        {templateSourceType === "zabbix_group"
                          ? "Este template continuará ligado aos grupos selecionados e resolverá as unidades novamente a cada execução futura."
                          : `Este template ficará com ${templateUnitIds.length} unidade(s) na seleção atual.`}
                      </p>
                      <button type="submit">Salvar template</button>
                    </div>
                  </form>
                </details>

                <details className="group rounded-[18px] border border-white/10 bg-white/[0.03] p-4" open={automationStatus === "error"}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Agendar uma execução recorrente</div>
                      <div className="mt-1 text-sm text-slate-400">
                        A automação sempre parte de um template salvo. Primeiro a configuração vira template; depois ela entra no scheduler interno do NOVA.
                      </div>
                    </div>
                    <TonePill tone="violet">Scheduler do NOVA</TonePill>
                  </summary>

                  <form action="/relatorios/monitoramento/automacoes" method="POST" className="mt-5 grid gap-4">
                    <input type="hidden" name="returnTo" value={returnTo} />

                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      Template
                      <select name="templateId" defaultValue={selectedTemplate?.id || templates[0]?.id || ""}>
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

                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Código da automação
                        <input name="code" placeholder="Ex.: AUTO-REL-UNITINS" />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200">
                        Nome da automação
                        <input name="name" placeholder="Ex.: Relatório recorrente UNITINS" />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-2">
                        Cadência
                        <select name="cadence" defaultValue="hourly">
                          <option value="every_5_minutes">A cada 5 minutos</option>
                          <option value="hourly">Por hora</option>
                          <option value="every_minute">A cada minuto</option>
                        </select>
                      </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
                      <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
                      Ativar automação imediatamente
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
                      <p className="max-w-3xl text-sm text-slate-300">
                        Quando o template usar grupos do Zabbix, cada rodada resolve o lote novamente antes de gerar o arquivo e anexar o resultado à execução.
                      </p>
                      <button type="submit" disabled={!templates.length}>Criar automação</button>
                    </div>
                  </form>
                </details>
              </div>
            </Surface>
          </div>

          <BuilderSummaryPanel
            selectedTemplate={selectedTemplate}
            selectedGroupSource={selectedGroupSource}
            groupIds={effectiveGroupIds}
            from={from}
            to={to}
            exportSelectedUnitIds={exportSelectedUnitIds}
            unresolvedCount={unresolvedCount}
            selectedUnit={selectedUnit}
            report={report}
          />
        </section>

        <section id="builder-library" className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <Surface className="report-toolbar p-5 sm:p-6">
            <SectionIntro
              eyebrow="Biblioteca operacional"
              title="Templates salvos"
              description="Aqui ficam as bases reutilizáveis do builder. O importante é que cada template agora pode ser carregado de volta para a própria tela, sem sair do fluxo."
              compact
            />

            <div className="mt-5 space-y-4">
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
                      <div className="flex flex-wrap gap-2">
                        <TonePill tone={template.automations.length ? "success" : "neutral"}>
                          {template.automations.length ? `${template.automations.length} automação(ões)` : "sem automação"}
                        </TonePill>
                        <Link
                          href={templateApplyHref(template.id)}
                          className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                        >
                          Carregar no builder
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                      <span>
                        {template.sourceType === "zabbix_group"
                          ? `${template.groupIds.length} grupo(s) · ${template.integration?.code || "sem integração"}`
                          : `${template.unitIds.length} unidade(s) manual(is)`}
                      </span>
                      <span>Atualizado em {formatDateTime(template.updatedAt)}</span>
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
                  description="Quando a configuração do builder estiver estável, você pode congelá-la como template e reaproveitar depois."
                />
              )}
            </div>
          </Surface>

          <Surface className="report-toolbar p-5 sm:p-6">
            <SectionIntro
              eyebrow="Histórico"
              title="Execuções recentes"
              description="As execuções automáticas continuam acessíveis, mas agora aparecem como consequência da configuração do builder e dos templates que você consolidou."
              compact
            />

            <div className="mt-5 space-y-4">
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
                  description="Depois de criar uma automação a partir de um template salvo, os arquivos gerados aparecerão aqui com link direto de download."
                />
              )}
            </div>
          </Surface>
        </section>
      </div>
    </AppShell>
  );
}
