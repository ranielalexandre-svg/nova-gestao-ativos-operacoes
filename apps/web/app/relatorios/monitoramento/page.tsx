import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportPrintButton } from "@/components/report-print-button";
import {
  ReportFocusUnitField,
  ReportUnitBatchSelector,
} from "@/components/report-unit-selector";
import {
  EmptyState,
  Surface,
} from "@/components/ops-ui";
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
  const activeOriginLabel = selectedTemplate
    ? `Template ${selectedTemplate.code}`
    : effectiveGroupIds.length
      ? "Host groups do Zabbix"
      : "Unidade manual";
  const activeOriginMeta = selectedTemplate
    ? selectedTemplate.name
    : effectiveGroupIds.length
      ? `${effectiveGroupIds.length} grupo(s) em ${selectedGroupSource?.code || "integração"}`
      : selectedUnit
        ? `${selectedUnit.code} - ${selectedUnit.name}`
        : "Sem origem definida";
  const { report, error } =
    selectedUnitId && selectedUnit ? await readReport(selectedUnitId, from, to) : { report: null, error: "" };

  return (
    <AppShell
      title="Relatórios"
      subtitle="Filtre, revise o lote e baixe o arquivo final em PDF ou DOCX."
    >
      <div className="report-workbench space-y-5">

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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Filtros do relatório</h2>
              <p className="mt-1 text-sm text-slate-400">
                Unidade, período, template e grupos do Zabbix ficam no mesmo lugar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={resetHref}
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Resetar filtros
              </Link>
              <Link
                href="/monitoramento"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Abrir monitoramento
              </Link>
            </div>
          </div>

          <form action="/relatorios/monitoramento" method="GET" className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px_180px]">
              <ReportFocusUnitField name="unitId" units={catalog.items} initialSelectedId={selectedUnitId} />

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Data de início
                <input name="from" type="date" defaultValue={from} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Data de encerramento
                <input name="to" type="date" defaultValue={to} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-3">
                Template
                <select name="templateId" defaultValue={selectedTemplateId}>
                  <option value="">Sem template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.code} - {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-3">
                Integração Zabbix
                <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""}>
                  <option value="">Sem grupos</option>
                  {reportSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} - {source.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200 xl:col-span-3">
                Host groups
                <select name="groupIds" multiple size={6} defaultValue={effectiveGroupIds} disabled={!groupCatalog?.items.length}>
                  {(groupCatalog?.items || []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} · {group.hostCount} host(s)
                    </option>
                  ))}
                </select>
              </label>

              <div className="xl:col-span-3 flex flex-wrap items-center gap-2">
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
                <div className="ml-auto flex flex-wrap gap-2">
                  {effectiveGroupIds.length ? (
                    <Link
                      href={clearGroupsHref}
                      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Limpar grupos
                    </Link>
                  ) : null}
                  <button type="submit">Aplicar filtros</button>
                </div>
              </div>
            </form>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Origem atual</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold text-slate-100">
                {activeOriginLabel}
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-50">
                {exportSelectedUnitIds.length} unidade(s) no lote
              </span>
              {unresolvedCount ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-50">
                  {unresolvedCount} pendência(s)
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-slate-400">{activeOriginMeta}</div>
          </div>

          {groupPreviewError ? (
            <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Não foi possível revisar os grupos agora: {groupPreviewError}
            </div>
          ) : null}

          {groupPreview ? (
            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Unidades vindas dos grupos do Zabbix</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {groupPreview.groups.map((group) => group.name).join(" · ")}
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  {groupPreview.counts.matchedUnits} reconhecida(s) de {groupPreview.counts.hosts} host(s)
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="max-h-72 overflow-y-auto rounded-[16px] border border-white/10 bg-black/10">
                  {groupPreview.matchedUnits.length ? (
                    groupPreview.matchedUnits.map((item) => (
                      <div key={item.unit.id} className="grid gap-2 border-b border-white/5 px-4 py-3 text-sm text-slate-200 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                        <div>
                          <div className="font-semibold text-slate-100">{item.unit.code} - {item.unit.name}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.unit.partner.code} · {[item.unit.city, item.unit.state].filter(Boolean).join("/") || "sem cidade/UF"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-300">
                          <div>{item.primaryHost.hostName || item.primaryHost.host || item.primaryHost.hostId}</div>
                          <div className="mt-1">
                            Confiança {item.confidence}% · {item.matchedBy.join(" · ") || "heurística"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-slate-400">
                      Nenhuma unidade foi reconhecida com segurança para os grupos selecionados.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-300">
                    As unidades reconhecidas já entram no lote final. Se precisar, você ainda ajusta manualmente na área de exportação.
                  </div>
                  {groupPreview.unresolvedHosts.length ? (
                    <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                      <div className="text-sm font-semibold text-amber-50">Hosts pendentes</div>
                      <div className="mt-2 space-y-2 text-xs text-amber-50/90">
                        {groupPreview.unresolvedHosts.slice(0, 6).map((item) => (
                          <div key={item.host.hostId}>
                            {item.host.hostName || item.host.host || item.host.hostId}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                      Nenhuma pendência encontrada nesse lote.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Surface>

        <Surface id="builder-output" className="report-toolbar p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Arquivo para download</h2>
              <p className="mt-1 text-sm text-slate-400">
                Ajuste o lote final, escolha PDF ou DOCX e baixe.
              </p>
            </div>
          </div>

          <form id="builder-export-form" action="/relatorios/monitoramento/export" method="POST" target="_blank" className="mt-5 grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />

            <div className="xl:col-span-2">
              <ReportUnitBatchSelector
                name="unitIds"
                units={catalog.items}
                initialSelectedIds={exportSelectedUnitIds}
              />
              <div className="mt-3 text-xs text-slate-400">
                {groupPreview
                  ? `${groupPreview.counts.matchedUnits} unidade(s) vieram da resolução por grupos.`
                  : templateManualUnitIds.length
                    ? `${templateManualUnitIds.length} unidade(s) vieram do template carregado.`
                    : "O lote está baseado na unidade em foco ou na sua seleção manual."}
              </div>
            </div>

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
                O arquivo sai pronto para download com cabeçalho, rodapé e estrutura comercial. Se desmarcar os gráficos, ele foca só nas informações gerais e métricas resumidas.
              </p>
              <button type="submit">Baixar arquivo</button>
            </div>
          </form>

          <details className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] p-4" open={templateStatus === "error" || automationStatus === "error"}>
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
              Reutilizar esta configuração
            </summary>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <form action="/relatorios/monitoramento/templates" method="POST" className="rounded-[16px] border border-white/10 bg-black/10 p-4">
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="sourceType" value={templateSourceType} />
                <input type="hidden" name="integrationId" value={templateIntegrationId} />
                {templateUnitIds.map((unitId) => (
                  <input key={`template-unit-${unitId}`} type="hidden" name="unitIds" value={unitId} />
                ))}
                {effectiveGroupIds.map((groupId) => (
                  <input key={`template-group-${groupId}`} type="hidden" name="groupIds" value={groupId} />
                ))}
                <input type="hidden" name="title" value={defaultTitle} />
                <input type="hidden" name="interestedParty" value={defaultInterestedParty} />
                <input type="hidden" name="contractLabel" value={defaultContractLabel} />
                <input type="hidden" name="contractedBandwidth" value={defaultBandwidth} />
                <input type="hidden" name="addressLine" value={defaultAddressLine} />

                <div className="text-sm font-semibold text-slate-100">Salvar como template</div>
                <div className="mt-1 text-xs text-slate-400">
                  Depois ele aparece no filtro de template ali em cima.
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Código
                    <input name="code" placeholder="Ex.: REL-UNITINS-GRUPO" />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Nome
                    <input name="name" placeholder="Ex.: Relatório mensal UNITINS" />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                    Incluir gráficos por padrão
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">
                      {templateSourceType === "zabbix_group"
                        ? "O template continua ligado aos grupos do Zabbix."
                        : `O template vai salvar ${templateUnitIds.length} unidade(s).`}
                    </div>
                    <button type="submit">Salvar template</button>
                  </div>
                </div>
              </form>

              <form action="/relatorios/monitoramento/automacoes" method="POST" className="rounded-[16px] border border-white/10 bg-black/10 p-4">
                <input type="hidden" name="returnTo" value={returnTo} />

                <div className="text-sm font-semibold text-slate-100">Agendar exportação</div>
                <div className="mt-1 text-xs text-slate-400">
                  A automação sempre roda a partir de um template salvo.
                </div>

                <div className="mt-4 grid gap-4">
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      Código da automação
                      <input name="code" placeholder="Ex.: AUTO-REL-UNITINS" />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      Nome da automação
                      <input name="name" placeholder="Ex.: Relatório recorrente UNITINS" />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    Cadência
                    <select name="cadence" defaultValue="hourly">
                      <option value="every_5_minutes">A cada 5 minutos</option>
                      <option value="hourly">Por hora</option>
                      <option value="every_minute">A cada minuto</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
                    <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
                    Ativar automação imediatamente
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href="/operacao/automacoes"
                      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Abrir automações
                    </Link>
                    <button type="submit" disabled={!templates.length}>Criar automação</button>
                  </div>
                </div>
              </form>
            </div>
          </details>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Prévia da unidade em foco</h2>
              <p className="mt-1 text-sm text-slate-400">
                Use a prévia só para conferir o visual antes de baixar o lote.
              </p>
            </div>
            {report ? <ReportPrintButton /> : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Não foi possível gerar o preview agora: {error}
            </div>
          ) : null}

          <div className="mt-5">
            {report ? (
              <ReportSheet report={report} />
            ) : (
              <EmptyState
                title="Escolha uma unidade monitorada"
                description="Assim que houver uma unidade em foco com host Zabbix confiável, o NOVA consegue montar o preview no formato de entrega."
              />
            )}
          </div>
        </Surface>
      </div>
    </AppShell>
  );
}
