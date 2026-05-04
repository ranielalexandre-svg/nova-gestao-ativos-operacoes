import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  BarList,
  ChartCard,
  DenseTable,
  EmptyState,
  FieldLabel,
  RightPanel,
  StackedMeter,
  StatCard,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  buildApiQuery,
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime } from "@/lib/formatters";
import {
  emptyCommandCenter,
  formatMs,
  formatPercent,
  formatTemperature,
  healthLabel,
  healthTone,
  metricTone,
  readUnitHostTelemetry,
  safeApiJson,
  targetLabel,
  unitAlertScore,
  type CommandCenter,
  type RecentMaintenance,
  type RecentOccurrence,
  type UnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

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

function formatEpoch(value: string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Date(timestamp * 1000).toLocaleString("pt-BR");
}

function cityLine(item: UnitHostTelemetryItem) {
  return [item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "-";
}

function healthSegments(telemetry: UnitHostTelemetry) {
  return [
    { label: "online", value: telemetry.counts.online, tone: "success" },
    { label: "atenção", value: telemetry.counts.degraded + telemetry.counts.ambiguous, tone: "attention" },
    { label: "offline", value: telemetry.counts.down, tone: "critical" },
    { label: "sem vínculo", value: telemetry.counts.unmapped, tone: "subtle" },
  ];
}

function metricBars(
  telemetry: UnitHostTelemetry,
  valueFor: (item: UnitHostTelemetryItem) => number | null,
  warning: number,
  critical: number,
) {
  return telemetry.items
    .map((item) => ({ item, value: valueFor(item) }))
    .filter((entry): entry is { item: UnitHostTelemetryItem; value: number } => typeof entry.value === "number" && Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map(({ item, value }) => ({
      label: item.unit.code,
      value,
      tone: metricTone(value, warning, critical),
      meta: item.unit.name,
      href: `/unidades/${item.unit.id}`,
    }));
}

function sensorCoverageBars(telemetry: UnitHostTelemetry) {
  return [
    { label: "Ping", value: telemetry.items.filter((item) => item.metrics.ping).length, tone: "success" },
    { label: "Latência", value: telemetry.items.filter((item) => typeof item.metrics.latencyMs === "number").length, tone: "info" },
    { label: "Perda", value: telemetry.items.filter((item) => typeof item.metrics.lossPct === "number").length, tone: "attention" },
    { label: "Temperatura", value: telemetry.items.filter((item) => typeof item.metrics.temperatureC === "number").length, tone: "critical" },
  ];
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
  return `/sensores${buildApiQuery({
    view: next.view !== "overview" ? next.view : undefined,
    q: next.q || undefined,
    health: next.health !== "all" ? next.health : undefined,
    partner: next.partner !== "all" ? next.partner : undefined,
    sort: next.sort !== "risk" ? next.sort : undefined,
  })}`;
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
  return sorted.sort((a, b) => unitAlertScore(b) - unitAlertScore(a) || a.unit.code.localeCompare(b.unit.code));
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

function metricMarkerClass(tone: string) {
  if (tone === "success") return "success";
  if (tone === "attention") return "attention";
  if (tone === "critical") return "critical";
  if (tone === "info") return "info";
  return "neutral";
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="nova-stat-card nds-stat-card"><div className="nds-label">{label}</div><div className="mt-2 flex items-end justify-between gap-2"><div className="text-[20px] font-black leading-none text-slate-50">{value}</div><span className="nds-dot" data-tone={metricMarkerClass(tone)} aria-hidden="true" /></div></div>
  );
}

function Summary({ telemetry, commandCenter }: { telemetry: UnitHostTelemetry; commandCenter: CommandCenter }) {
  const sourceFailures = telemetry.sources.filter((source) => !source.ok).length;
  return (
    <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
      <StatCard label="Unidades" value={telemetry.counts.units} detail={formatDateTime(telemetry.generatedAt)} tone="info" />
      <StatCard label="Online" value={telemetry.counts.online} detail="hosts respondendo" tone="success" />
      <StatCard label="Atenção" value={telemetry.counts.degraded} detail="degradação detectada" tone={telemetry.counts.degraded ? "attention" : "neutral"} />
      <StatCard label="Offline" value={telemetry.counts.down} detail="sem resposta" tone={telemetry.counts.down ? "critical" : "neutral"} />
      <StatCard label="Eventos" value={telemetry.counts.withProblems + commandCenter.metrics.criticalOpenOccurrences} detail={`${commandCenter.metrics.openOccurrences} alertas`} tone={telemetry.counts.withProblems ? "attention" : "neutral"} />
      <StatCard label="Vínculo" value={`${telemetry.counts.matched}/${telemetry.counts.units}`} detail={sourceFailures ? `${sourceFailures} fonte(s) alerta` : "fontes ok"} tone={telemetry.counts.unmapped || telemetry.counts.ambiguous || sourceFailures ? "attention" : "success"} />
    </section>
  );
}

function Filters({ filters, partners, count }: { filters: MonitorFilters; partners: Array<UnitHostTelemetryItem["partner"]>; count: number }) {
  return (
    <Surface><form method="GET" className="nova-filter-grid nova-filter-grid--monitoring"><input type="hidden" name="view" value={filters.view} /><label className="grid gap-1.5"><FieldLabel>Busca</FieldLabel><input name="q" defaultValue={filters.q} placeholder="Unidade, parceiro, host, serial" /></label><label className="grid gap-1.5"><FieldLabel>Parceiro</FieldLabel><select name="partner" defaultValue={filters.partner}><option value="all">Todos</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.code} · {partner.name}</option>
            ))}
          </select></label><label className="grid gap-1.5"><FieldLabel>Estado</FieldLabel><select name="health" defaultValue={filters.health}><option value="all">Todos</option><option value="down">Offline</option><option value="degraded">Atenção</option><option value="online">Online</option><option value="problem">Com evento</option><option value="high-latency">Alta latência</option><option value="high-loss">Perda alta</option><option value="temperature">Temperatura alta</option><option value="unmapped">Sem vínculo</option></select></label><label className="grid gap-1.5"><FieldLabel>Ordenação</FieldLabel><select name="sort" defaultValue={filters.sort}><option value="risk">Risco</option><option value="latency">Latência</option><option value="loss">Perda</option><option value="partner">Parceiro</option><option value="code">Código</option></select></label><button className="nds-button xl:self-end" data-variant="primary">Aplicar</button><Link href="/sensores" className="nds-button xl:self-end" data-variant="secondary">
          Limpar
        </Link></form><div className="mt-2 text-[10px] font-semibold text-slate-500">{count} unidade(s)</div></Surface>
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
              data-active={active ? "true" : "false"}
              className={cx(
                "nova-view-tab flex min-h-[30px] items-center justify-between gap-2 rounded-[4px] border px-2 py-1 text-[11px] font-black transition",
              )}
            ><span>{tab.label}</span><TonePill tone={active ? "primary" : "neutral"}>{tab.count}</TonePill></Link>
          );
        })}
      </nav></Surface>
  );
}

function UnitName({ item }: { item: UnitHostTelemetryItem }) {
  return (
    <div><Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-white">
        {item.unit.code}
      </Link><div className="mt-1 max-w-[280px] text-[11px] text-slate-300">{item.unit.name}</div><div className="mt-1 text-[10px] text-slate-500">{cityLine(item)}</div></div>
  );
}

function UnitsTable({ telemetry, limit }: { telemetry: UnitHostTelemetry; limit?: number }) {
  const rows = typeof limit === "number" ? telemetry.items.slice(0, limit) : telemetry.items;
  return (
    <Surface><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-black text-slate-50">Unidades</h2><TonePill tone="neutral">{rows.length}</TonePill></div><div className="mt-2">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Host</th><th className="px-3 py-2">Ping</th><th className="px-3 py-2">Perda</th><th className="px-3 py-2">Latência</th><th className="px-3 py-2">Temp.</th><th className="px-3 py-2">Eventos</th><th className="px-3 py-2">Ativos</th></tr></TableHead><tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0"><TableCell><UnitName item={item} /></TableCell><TableCell><div className="font-medium text-slate-100">{item.partner.code}</div><div className="mt-1 max-w-[220px] text-[10px] text-slate-500">{item.partner.name}</div></TableCell><TableCell><div className="flex flex-wrap gap-2"><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                        {item.match.syncReady ? <TonePill tone="success">tag ok</TonePill> : null}
                      </div><div className="mt-2 max-w-[280px] truncate text-[11px] font-medium text-slate-100">
                        {item.match.hostName || item.match.host || "-"}
                      </div><div className="mt-1 text-[10px] text-slate-500">{item.match.integrationCode || "-"} · {item.match.confidence}%</div></TableCell><TableCell><TonePill tone={item.metrics.ping?.ok === false ? "critical" : item.metrics.ping?.ok ? "success" : "neutral"}>
                        {item.metrics.ping?.ok === false ? "down" : item.metrics.ping?.ok ? "up" : "-"}
                      </TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.lossPct, 3, 10)}>{formatPercent(item.metrics.lossPct)}</TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.latencyMs, 150, 700)}>{formatMs(item.metrics.latencyMs)}</TonePill></TableCell><TableCell><TonePill tone={metricTone(item.metrics.temperatureC, 55, 70)}>{formatTemperature(item.metrics.temperatureC)}</TonePill></TableCell><TableCell><TonePill tone={item.problems.length ? "attention" : "success"}>{item.problems.length}</TonePill>
                      {item.problems[0] ? <div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">{item.problems[0].name}</div> : null}
                    </TableCell><TableCell><div className="max-w-[220px] text-[10px] leading-4 text-slate-400">
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
    <section className="nova-side-grid nova-side-grid--300">
      <div className="grid gap-2">
        <div className="grid gap-2 lg:grid-cols-3">
          <ChartCard title="Ping / disponibilidade" subtitle={`${telemetry.counts.online}/${telemetry.counts.units} online`} tone={telemetry.counts.down ? "critical" : "success"}>
            <StackedMeter segments={healthSegments(telemetry)} total={telemetry.counts.units} emptyLabel="Sem telemetria carregada." />
          </ChartCard>
          <ChartCard title="Latência média" subtitle={formatMs(telemetry.counts.avgLatencyMs)} tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)}>
            <BarList data={metricBars(telemetry, (item) => item.metrics.latencyMs, 150, 700)} emptyLabel="Nenhuma leitura de latência disponível." valueFormatter={(value) => formatMs(value)} />
          </ChartCard>
          <ChartCard title="Perda de pacote" subtitle={formatPercent(telemetry.counts.avgLossPct)} tone={metricTone(telemetry.counts.avgLossPct, 3, 10)}>
            <BarList data={metricBars(telemetry, (item) => item.metrics.lossPct, 3, 10)} emptyLabel="Nenhuma leitura de perda disponível." valueFormatter={(value) => formatPercent(value)} />
          </ChartCard>
        </div>
        <UnitsTable telemetry={{ ...telemetry, items: priority, counts: countsFromItems(priority) }} />
      </div>
      <RightPanel title="Telemetria" description="Resumo do filtro atual">
        <MetricCard label="Disponibilidade" value={`${telemetry.counts.online}/${telemetry.counts.units}`} tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"} />
        <MetricCard label="Perda média" value={formatPercent(telemetry.counts.avgLossPct)} tone={metricTone(telemetry.counts.avgLossPct, 3, 10)} />
        <MetricCard label="Latência média" value={formatMs(telemetry.counts.avgLatencyMs)} tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)} />
        <MetricCard label="Temperatura máx." value={formatTemperature(telemetry.counts.maxTemperatureC)} tone={metricTone(telemetry.counts.maxTemperatureC, 55, 70)} />
        <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">
          Gerar relatório
        </Link>
      </RightPanel>
    </section>
  );
}

function PartnersTable({ rows }: { rows: PartnerRow[] }) {
  return (
    <Surface><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-black text-slate-50">Parceiros</h2><TonePill tone="neutral">{rows.length}</TonePill></div><div className="mt-2">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Unidades</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Eventos</th><th className="px-3 py-2">Telemetria</th><th className="px-3 py-2">Ações</th></tr></TableHead><tbody>
                {rows.map((row) => (
                  <tr key={row.partner.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/parceiros/${row.partner.id}`} className="font-semibold text-slate-50 hover:text-white">{row.partner.code}</Link><div className="mt-1 max-w-[280px] text-[11px] text-slate-300">{row.partner.name}</div></TableCell><TableCell>{row.units}</TableCell><TableCell><div className="flex flex-wrap gap-1"><TonePill tone="success">{row.online} on</TonePill><TonePill tone={row.degraded ? "attention" : "neutral"}>{row.degraded} atenção</TonePill><TonePill tone={row.down ? "critical" : "neutral"}>{row.down} off</TonePill><TonePill tone={row.unmapped ? "subtle" : "neutral"}>{row.unmapped} sem vínculo</TonePill></div></TableCell><TableCell><TonePill tone={row.problems ? "attention" : "success"}>{row.problems}</TonePill></TableCell><TableCell><div className="text-[11px] text-slate-300">{formatMs(row.avgLatencyMs)}</div><div className="mt-1 text-[10px] text-slate-500">perda {formatPercent(row.avgLossPct)}</div></TableCell><TableCell><div className="flex flex-wrap gap-2"><Link href={`/parceiros/${row.partner.id}`} className="nds-button" data-variant="secondary">Abrir</Link><Link href={`/sensores?view=units&partner=${row.partner.id}`} className="nds-button" data-variant="secondary">Unidades</Link></div></TableCell></tr>
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
    <div className="grid gap-2">
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Ping" subtitle={`${telemetry.counts.online}/${telemetry.counts.units} online`} tone={telemetry.counts.down ? "critical" : "success"}>
          <StackedMeter segments={healthSegments(telemetry)} total={telemetry.counts.units} emptyLabel="Sem telemetria carregada." />
        </ChartCard>
        <ChartCard title="Loss" subtitle={formatPercent(telemetry.counts.avgLossPct)} tone={metricTone(telemetry.counts.avgLossPct, 3, 10)}>
          <BarList data={metricBars(telemetry, (item) => item.metrics.lossPct, 3, 10)} emptyLabel="Nenhuma leitura de perda disponível." valueFormatter={(value) => formatPercent(value)} />
        </ChartCard>
        <ChartCard title="Latência" subtitle={formatMs(telemetry.counts.avgLatencyMs)} tone={metricTone(telemetry.counts.avgLatencyMs, 150, 700)}>
          <BarList data={metricBars(telemetry, (item) => item.metrics.latencyMs, 150, 700)} emptyLabel="Nenhuma leitura de latência disponível." valueFormatter={(value) => formatMs(value)} />
        </ChartCard>
        <ChartCard title="Temperatura" subtitle={formatTemperature(telemetry.counts.maxTemperatureC)} tone={metricTone(telemetry.counts.maxTemperatureC, 55, 70)}>
          <BarList data={metricBars(telemetry, (item) => item.metrics.temperatureC, 55, 70)} emptyLabel="Nenhuma leitura de temperatura disponível." valueFormatter={(value) => formatTemperature(value)} />
        </ChartCard>
      </section>
      <Surface>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="nds-label">Sensores</div>
            <h2 className="mt-2 text-[13px] font-black text-slate-50">Cobertura por tipo de item</h2>
          </div>
          <TonePill tone="neutral">{telemetry.counts.units}</TonePill>
        </div>
        <div className="mt-2">
          <BarList data={sensorCoverageBars(telemetry)} max={Math.max(1, telemetry.counts.units)} emptyLabel="Nenhum item técnico mapeado." />
        </div>
      </Surface>
      <UnitsTable telemetry={telemetry} />
    </div>
  );
}

function EventsView({ telemetry, commandCenter }: { telemetry: UnitHostTelemetry; commandCenter: CommandCenter }) {
  const problems = telemetry.items.flatMap((item) => item.problems.map((problem) => ({ ...problem, unit: item.unit, partner: item.partner })));
  return (
    <div className="grid gap-2"><Surface><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-black text-slate-50">Eventos Zabbix</h2><TonePill tone={problems.length ? "attention" : "success"}>{problems.length}</TonePill></div><div className="mt-2">
          {problems.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Evento</th><th className="px-3 py-2">Severidade</th><th className="px-3 py-2">Ack</th><th className="px-3 py-2">Horário</th></tr></TableHead><tbody>
                  {problems.slice(0, 30).map((problem) => (
                    <tr key={`${problem.unit.id}-${problem.eventid}`} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/unidades/${problem.unit.id}`} className="font-semibold text-slate-50 hover:text-white">{problem.unit.code}</Link><div className="mt-1 text-[10px] text-slate-500">{problem.partner.name}</div></TableCell><TableCell><div className="max-w-[620px] font-medium leading-5 text-slate-50">{problem.name}</div><div className="mt-1 text-[10px] text-slate-500">{problem.eventid}</div></TableCell><TableCell><TonePill tone={severityTone(problem.severity)}>{problem.severity}</TonePill></TableCell><TableCell><TonePill tone={problem.acknowledged === "1" ? "success" : "attention"}>{problem.acknowledged === "1" ? "sim" : "não"}</TonePill></TableCell><TableCell className="text-slate-400">{formatEpoch(problem.clock)}</TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Sem eventos ativos" description="Nenhum problema ativo retornado pelo Zabbix." />
          )}
        </div></Surface><section className="grid gap-2 xl:grid-cols-2"><RecentList title="Alertas" href="/alertas" items={commandCenter.recentOccurrences} kind="occurrence" /><RecentList title="Chamados" href="/chamados" items={commandCenter.recentMaintenances} kind="maintenance" /></section></div>
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
    <Surface><div className="flex items-center justify-between gap-2"><h2 className="text-[13px] font-black text-slate-50">{title}</h2><Link href={href} className="nds-button" data-variant="secondary">Ver todas</Link></div><div className="mt-2 grid gap-2">
        {items.length ? items.slice(0, 6).map((item) => (
          <Link key={item.id} href={`/${kind === "occurrence" ? "alertas" : "chamados"}/${item.id}`} className="nds-card block transition"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[12px] font-bold text-slate-50">{item.code} · {item.title}</div><div className="mt-1 truncate text-[10px] text-slate-500">{targetLabel(item)}</div></div><TonePill tone={"severity" in item && item.severity === "critical" ? "critical" : "attention"}>{"severity" in item ? item.severity : item.status}</TonePill></div></Link>
        )) : <EmptyState title="Sem registros" description="Nenhum registro recente." />}
      </div></Surface>
  );
}

function Sources({ telemetry, isAdmin }: { telemetry: UnitHostTelemetry; isAdmin: boolean }) {
  const failures = telemetry.sources.filter((source) => !source.ok);
  if (!failures.length && !isAdmin) return null;

  return (
    <Surface><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2">
          {telemetry.sources.map((source) => (
            <TonePill key={source.id} tone={source.ok ? "success" : "attention"}>{source.code}: {source.ok ? "ok" : "alerta"}</TonePill>
          ))}
        </div>
        {isAdmin ? <Link href="/integracoes" className="nds-button" data-variant="secondary">Integrações</Link> : null}
      </div></Surface>
  );
}

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/sensores");

  const [telemetry, commandCenter] = await Promise.all([
    readUnitHostTelemetry({ timeoutMs: 2_500, fast: true }),
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
    <AppShell title="Sensores" subtitle="Telemetria Zabbix por unidade, parceiro e ativo."><div className="nova-monitoring-page grid gap-2"><Summary telemetry={filteredTelemetry} commandCenter={commandCenter} /><Sources telemetry={telemetry} isAdmin={isAdmin} /><Tabs filters={filters} telemetry={filteredTelemetry} /><Filters filters={filters} partners={partners} count={filteredTelemetry.counts.units} />

      {filters.view === "overview" ? <Overview telemetry={filteredTelemetry} /> : null}
      {filters.view === "units" ? <UnitsTable telemetry={filteredTelemetry} /> : null}
      {filters.view === "partners" ? <PartnersTable rows={partnerRows} /> : null}
      {filters.view === "sensors" ? <SensorsView telemetry={filteredTelemetry} /> : null}
      {filters.view === "events" ? <EventsView telemetry={filteredTelemetry} commandCenter={commandCenter} /> : null}
          </div></AppShell>
  );
}
