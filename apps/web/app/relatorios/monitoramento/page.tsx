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

type UnitHostTelemetry = {
  items: Array<{
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
    match: {
      status: "matched" | "ambiguous" | "unmatched";
      confidence: number;
      hostName?: string;
      host?: string;
      integrationCode?: string;
    };
    health: string;
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

function formatDateTime(value: string) {
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
      </div>
      <p className="mt-3 text-[11px] text-slate-600">{block.description}</p>
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

function ReportSheet({ report }: { report: MonitoringReport }) {
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

async function readTelemetry() {
  try {
    return await apiJson<UnitHostTelemetry>("/monitoring/unit-hosts");
  } catch {
    return { items: [] };
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
  const telemetry = await readTelemetry();
  const matchedUnits = telemetry.items.filter((item) => item.match.status === "matched");
  const selectedUnitId = readStringParam(params, "unitId", matchedUnits[0]?.unit.id || telemetry.items[0]?.unit.id || "");
  const from = readStringParam(params, "from", defaults.from);
  const to = readStringParam(params, "to", defaults.to);
  const selectedUnit = telemetry.items.find((item) => item.unit.id === selectedUnitId) || matchedUnits[0] || telemetry.items[0];
  const { report, error } = selectedUnitId ? await readReport(selectedUnitId, from, to) : { report: null, error: "" };

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
            { label: "Unidades", value: telemetry.items.length, meta: `${matchedUnits.length} com host confiável`, tone: matchedUnits.length ? "success" : "attention" },
            { label: "Exportação", value: "PDF", meta: "via impressão do navegador", tone: "neutral" },
          ]}
          noteTitle="Decisão de arquitetura"
          noteCopy="Não há coleta PRTG. A tela apenas reproduz o formato de apresentação usando os dados históricos vindos do Zabbix."
        />

        <Surface className="report-toolbar p-5 sm:p-6">
          <SectionIntro
            eyebrow="Período do relatório"
            title="Executar relatório"
            description="Escolha a unidade e o intervalo. Os atalhos recriam o fluxo operacional da tela de relatórios do PRTG, mas o dataset vem do Zabbix."
            compact
            actions={selectedUnit ? <TonePill tone={selectedUnit.match.status === "matched" ? "success" : "attention"}>{selectedUnit.health}</TonePill> : null}
          />

          <form action="/relatorios/monitoramento" method="GET" className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Unidade monitorada
              <select name="unitId" defaultValue={selectedUnitId}>
                {telemetry.items.map((item) => (
                  <option key={item.unit.id} value={item.unit.id}>
                    {item.unit.code} - {item.unit.name} ({item.match.status})
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
