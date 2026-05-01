import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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
  reportContractLabel?: string | null;
  reportAddressLine?: string | null;
  reportContractedBandwidth?: string | null;
  reportNotes?: string | null;
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
    unit: ReportUnitCatalog["items"][number];
    primaryHost: {
      hostId: string;
      host?: string;
      hostName?: string;
      hostStatus?: string;
      groups: string[];
    };
    confidence: number;
    matchedBy: string[];
  }>;
  unresolvedHosts: Array<{
    status: "ambiguous" | "unmatched";
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
  groupIds: string[];
  unitIds: string[];
  integration: ReportSource | null;
};

type ReportRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  hitsCount: number;
  summary: string | null;
  errorMessage: string | null;
  rule: {
    code: string;
    name: string;
    reportTemplate: {
      code: string;
      name: string;
    } | null;
  };
  attachments: Array<{
    id: string;
    name: string;
    size: number;
    url: string;
    createdAt: string;
  }>;
};

type SourceMode = "unit" | "template" | "group";

type FilterQuery = {
  source?: SourceMode;
  templateId?: string;
  unitId?: string;
  unitQ?: string;
  from?: string;
  to?: string;
  groupIntegrationId?: string;
  groupIds?: string[];
};

type SourceTab = {
  mode: SourceMode;
  label: string;
  description: string;
};

const sourceTabs: SourceTab[] = [
  {
    mode: "unit",
    label: "Unidade",
    description: "Um relatório para uma unidade específica.",
  },
  {
    mode: "group",
    label: "Grupo Zabbix",
    description: "Seleciona um host group e monta o lote automaticamente.",
  },
  {
    mode: "template",
    label: "Template",
    description: "Usa uma configuração salva de relatório.",
  },
];

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

function buildFilterHref(query: FilterQuery) {
  const params = new URLSearchParams();
  if (query.source) params.set("source", query.source);
  if (query.templateId) params.set("templateId", query.templateId);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.unitQ) params.set("unitQ", query.unitQ);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.groupIntegrationId) params.set("groupIntegrationId", query.groupIntegrationId);
  if (query.groupIds?.length) params.set("groupIds", query.groupIds.join(","));
  const serialized = params.toString();
  return serialized ? `/relatorios/monitoramento?${serialized}` : "/relatorios/monitoramento";
}

function readCsvParam(params: RawSearchParams, key: string) {
  const raw = params[key];
  const values = Array.isArray(raw) ? raw : [raw ?? ""];
  return values
    .flatMap((value) => value.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueIds(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function readSourceMode(params: RawSearchParams, selectedTemplate: ReportTemplate | null): SourceMode {
  const requested = readStringParam(params, "source", "");
  if (requested === "unit" || requested === "template" || requested === "group") return requested;
  if (selectedTemplate) return "template";
  if (readStringParam(params, "groupIntegrationId", "") || readCsvParam(params, "groupIds").length) return "group";
  return "unit";
}

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatUnitMeta(unit: ReportUnitCatalog["items"][number]) {
  return [unit.partner.code, [unit.city, unit.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
}

function unitSearchText(unit: ReportUnitCatalog["items"][number]) {
  return [unit.code, unit.name, unit.city, unit.state, unit.partner.code, unit.partner.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function webAttachmentUrl(url: string) {
  return url.startsWith("/api/") ? url.slice(4) : url;
}

function runStatusLabel(status: string) {
  if (status === "success") return "Pronto";
  if (status === "queued") return "Na fila";
  if (status === "running") return "Processando";
  if (status === "error") return "Erro";
  return status;
}

function runStatusTone(status: string) {
  if (status === "success") return "success";
  if (status === "error") return "critical";
  if (status === "queued" || status === "running") return "attention";
  return "neutral";
}

function sourceLabel(mode: SourceMode) {
  if (mode === "unit") return "Unidade";
  if (mode === "group") return "Grupo Zabbix";
  return "Template";
}

function compactHostName(item: ZabbixGroupPreview["unresolvedHosts"][number]) {
  return item.host.hostName || item.host.host || item.host.hostId;
}

async function readReportUnits() {
  try {
    return await apiJson<ReportUnitCatalog>("/monitoring/reports/units");
  } catch {
    return { total: 0, items: [] };
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

async function readReportRuns() {
  try {
    return await apiJson<ReportRun[]>("/monitoring/report-template-runs");
  } catch {
    return [];
  }
}

function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex h-9 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
      href={href}
    >
      {children}
    </Link>
  );
}

function SourceModeLink({ tab, active, href }: { tab: SourceTab; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-[16px] border px-4 py-3 transition",
        active
          ? "border-sky-400/35 bg-sky-500/14 text-sky-50"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:text-white",
      ].join(" ")}
    ><span className="block text-sm font-semibold">{tab.label}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{tab.description}</span></Link>
  );
}

function ReportNotice({ tone, children }: { tone: "success" | "info" | "error"; children: ReactNode }) {
  const toneClass = {
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-50",
    info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-50",
    error: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  }[tone];

  return <div className={`rounded-[16px] border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

export default async function MonitoringReportsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios/monitoramento");

  const params = await resolveSearchParams(searchParams);
  const [catalog, reportSources, templates, recentRuns] = await Promise.all([
    readReportUnits(),
    readReportSources(),
    readReportTemplates(),
    readReportRuns(),
  ]);

  const requestedTemplateId = readStringParam(params, "templateId", "");
  const requestedUnitId = readStringParam(params, "unitId", "");
  const requestedUnitQ = readStringParam(params, "unitQ", "");
  const requestedGroupIntegrationId = readStringParam(params, "groupIntegrationId", "");
  const requestedGroupIds = readCsvParam(params, "groupIds");
  const exportStatus = readStringParam(params, "exportStatus", "");
  const exportRunId = readStringParam(params, "exportRunId", "");
  const exportMessage = readStringParam(params, "exportMessage", "");
  const highlightedRun = exportRunId ? recentRuns.find((run) => run.id === exportRunId) || null : null;
  const highlightedAttachment = highlightedRun?.attachments[0] || null;

  const selectedTemplate = templates.find((item) => item.id === requestedTemplateId) || null;
  const activeSource = readSourceMode(params, selectedTemplate);
  const presetRange = rangeFromPreset(activeSource === "template" ? selectedTemplate?.periodPreset : null);
  const from = readStringParam(params, "from", presetRange.from);
  const to = readStringParam(params, "to", presetRange.to);

  const selectedUnit = catalog.items.find((item) => item.id === requestedUnitId) || null;
  const filteredUnits = requestedUnitQ
    ? catalog.items.filter((unit) => unitSearchText(unit).includes(requestedUnitQ.toLowerCase()))
    : catalog.items.slice(0, 80);
  const unitOptions = selectedUnit && !filteredUnits.some((unit) => unit.id === selectedUnit.id)
    ? [selectedUnit, ...filteredUnits]
    : filteredUnits;

  const templateManualUnitIds = activeSource === "template" && selectedTemplate?.sourceType === "manual" ? selectedTemplate.unitIds : [];
  const templateGroupIds = activeSource === "template" && selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.groupIds : [];
  const selectedGroupIntegrationId =
    activeSource === "group"
      ? requestedGroupIntegrationId
      : activeSource === "template" && selectedTemplate?.sourceType === "zabbix_group"
        ? selectedTemplate.integration?.id || ""
        : "";
  const selectedGroupSource = reportSources.find((item) => item.id === selectedGroupIntegrationId) || null;
  const effectiveGroupIds = activeSource === "group" ? requestedGroupIds : templateGroupIds;
  const groupCatalog = activeSource === "group" && selectedGroupSource ? await readZabbixGroups(selectedGroupSource.id) : null;
  const { preview: groupPreview, error: groupPreviewError } =
    selectedGroupSource && effectiveGroupIds.length
      ? await readZabbixGroupPreview(selectedGroupSource.id, effectiveGroupIds)
      : { preview: null, error: "" };

  const resultUnitIds = uniqueIds([
    ...(activeSource === "unit" ? [requestedUnitId] : []),
    ...templateManualUnitIds,
    ...(groupPreview?.matchedUnits.map((item) => item.unit.id) || []),
  ]);
  const resultUnits = resultUnitIds
    .map((unitId) => catalog.items.find((item) => item.id === unitId))
    .filter((item): item is ReportUnitCatalog["items"][number] => Boolean(item));
  const primaryUnit = resultUnits[0] || null;
  const unresolvedCount = groupPreview ? groupPreview.counts.ambiguousHosts + groupPreview.counts.unmatchedHosts : 0;

  const currentFilters: FilterQuery = {
    source: activeSource,
    templateId: activeSource === "template" ? selectedTemplate?.id || undefined : undefined,
    unitId: activeSource === "unit" ? requestedUnitId || undefined : undefined,
    unitQ: activeSource === "unit" ? requestedUnitQ || undefined : undefined,
    from,
    to,
    groupIntegrationId: activeSource === "group" ? selectedGroupSource?.id || undefined : undefined,
    groupIds: activeSource === "group" ? effectiveGroupIds : [],
  };
  const returnTo = buildFilterHref(currentFilters);
  const sourceHref = (source: SourceMode) => buildFilterHref({ source, from, to });
  const clearGroupsHref = buildFilterHref({ source: "group", from, to, groupIntegrationId: selectedGroupSource?.id || undefined });
  const quickTodayHref = buildFilterHref({ ...currentFilters, from: quickRange(1).from, to: quickRange(1).to });
  const quickWeekHref = buildFilterHref({ ...currentFilters, from: quickRange(7).from, to: quickRange(7).to });
  const quickMonthHref = buildFilterHref({ ...currentFilters, from: monthRange(0).from, to: monthRange(0).to });
  const quickPrevMonthHref = buildFilterHref({ ...currentFilters, from: monthRange(-1).from, to: monthRange(-1).to });

  type UnitReportMetadataValues = {
    contractLabel: string;
    addressLine: string;
    contractedBandwidth: string;
    notes: string;
  };

  const emptyUnitReportMetadata = (): UnitReportMetadataValues => ({
    contractLabel: "",
    addressLine: "",
    contractedBandwidth: "",
    notes: "",
  });

  const formatUnitAddressFallback = (unit?: (typeof resultUnits)[number] | null) =>
    unit ? [unit.city, unit.state].filter(Boolean).join(" - ") : "";

  const configuredMetadataForUnit = (unit: (typeof resultUnits)[number]): UnitReportMetadataValues => ({
    contractLabel: unit.reportContractLabel || "",
    addressLine: unit.reportAddressLine || "",
    contractedBandwidth: unit.reportContractedBandwidth || "",
    notes: unit.reportNotes || "",
  });

  const primaryConfiguredMetadata: UnitReportMetadataValues = primaryUnit
    ? configuredMetadataForUnit(primaryUnit)
    : emptyUnitReportMetadata();


  const defaultFormat = selectedTemplate?.outputFormat?.toLowerCase() === "docx" ? "docx" : "pdf";
  const defaultIncludeCharts = selectedTemplate?.includeCharts ?? true;
  const competenceDate = new Date();
  const defaultCompetenceLabel = `${new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(competenceDate).replace(/^./, (letter) => letter.toUpperCase())}/${competenceDate.getFullYear()}`;

  const defaultIssueDateLabel = `Palmas, ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}`;
  const defaultTitle = selectedTemplate?.title || "Relatório de Consumo";
  const defaultInterestedParty = selectedTemplate?.interestedParty || primaryUnit?.partner.name || "";
  const defaultContractLabel = selectedTemplate?.contractLabel || primaryConfiguredMetadata.contractLabel || "";
  const defaultBandwidth = selectedTemplate?.contractedBandwidth || primaryConfiguredMetadata.contractedBandwidth || "";
  const defaultAddressLine = selectedTemplate?.addressLine || primaryConfiguredMetadata.addressLine || formatUnitAddressFallback(primaryUnit);
  const defaultUnitMetadataJson = JSON.stringify(
    resultUnits.reduce<Record<string, { contractLabel: string; addressLine: string; contractedBandwidth: string; notes: string }>>(
      (acc, unit) => {
        const unitMetadata = configuredMetadataForUnit(unit);

        acc[`${unit.code} - ${unit.name}`] = {
          contractLabel: unitMetadata.contractLabel || unit.reportContractLabel || defaultContractLabel,
          addressLine: unitMetadata.addressLine || unit.reportAddressLine || formatUnitAddressFallback(unit) || defaultAddressLine,
          contractedBandwidth: unitMetadata.contractedBandwidth || unit.reportContractedBandwidth || defaultBandwidth,
          notes: unitMetadata.notes || unit.reportNotes || "",
        };
        return acc;
      },
      {},
    ),
    null,
    2,
  );

  return (
    <AppShell
      title="Gerar relatório de consumo"
      subtitle="Selecione o período, as unidades e revise os dados antes de exportar."
      hidePageHeader
    >
      <div className="nova-monitoring-report-page grid gap-5">
        <header className="nova-report-hero flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-slate-500">
              Relatórios <span className="mx-1 text-slate-700">/</span>
              <span className="text-slate-300">Monitoramento</span>
            </div>
            <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-white">
              Gerar relatório de consumo
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Selecione o período, as unidades e revise os dados antes de exportar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={returnTo}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[0.09]"
            >
              ↻ Atualizar dados
            </Link>
            <Link
              href="/relatorios/monitoramento"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-orange-500 px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(249,115,22,0.24)] transition hover:bg-orange-400"
            >
              ⧉ Novo relatório
            </Link>
          </div>
        </header>

        {highlightedRun?.status === "success" && highlightedAttachment ? (
          <ReportNotice tone="success">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Relatório pronto.</span>
              <Link href={webAttachmentUrl(highlightedAttachment.url)} className="font-semibold text-emerald-100 hover:text-white">
                Baixar arquivo
              </Link>
            </div>
          </ReportNotice>
        ) : exportStatus === "queued" || highlightedRun?.status === "queued" || highlightedRun?.status === "running" ? (
          <ReportNotice tone="info">Relatório em processamento. O arquivo aparecerá em Últimas exportações.</ReportNotice>
        ) : null}

        {exportStatus === "error" || highlightedRun?.status === "error" ? (
          <ReportNotice tone="error">
            {exportMessage || highlightedRun?.errorMessage || "Não foi possível iniciar a exportação."}
          </ReportNotice>
        ) : null}

        <div className="nova-report-stepper grid gap-4 rounded-[8px] border border-white/[0.08] bg-white/[0.035] px-4 py-4 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500 text-base font-black text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]">1</span>
            <div>
              <div className="text-sm font-black text-slate-50">Filtros</div>
              <div className="mt-1 text-xs text-slate-400">Seleção do período e unidades</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-sm font-black text-slate-100">2</span>
            <div>
              <div className="text-sm font-black text-slate-50">Revisão</div>
              <div className="mt-1 text-xs text-slate-400">Confira os dados e resumo</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-sm font-black text-slate-100">3</span>
            <div>
              <div className="text-sm font-black text-slate-50">Exportação</div>
              <div className="mt-1 text-xs text-slate-400">Gere o relatório</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,990px)_320px] xl:items-start">
          <div className="grid gap-5">
            <Surface className="p-4 sm:p-5">
              <form action="/relatorios/monitoramento" method="GET" className="grid gap-4">
                <input type="hidden" name="source" value={activeSource} />

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-50">Período do relatório</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {sourceLabel(activeSource)} · {formatDate(from)} até {formatDate(to)} · {resultUnits.length} unidade(s)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href="/relatorios/monitoramento"
                      className="inline-flex h-10 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Limpar
                    </Link>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-[12px] border border-orange-400/35 bg-orange-500/18 px-4 text-sm font-bold text-orange-50 transition hover:bg-orange-500/25"
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {sourceTabs.map((tab) => (
                    <SourceModeLink key={tab.mode} tab={tab} active={activeSource === tab.mode} href={sourceHref(tab.mode)} />
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    <FieldLabel>Mês / início</FieldLabel>
                    <input name="from" type="date" defaultValue={from} className="px-3" />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-slate-200">
                    <FieldLabel>Fim</FieldLabel>
                    <input name="to" type="date" defaultValue={to} className="px-3" />
                  </label>

                  <div className="grid gap-2">
                    <FieldLabel>Atalhos</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      <QuickLink href={quickTodayHref}>Hoje</QuickLink>
                      <QuickLink href={quickWeekHref}>7 dias</QuickLink>
                      <QuickLink href={quickMonthHref}>Este mês</QuickLink>
                      <QuickLink href={quickPrevMonthHref}>Mês passado</QuickLink>
                    </div>
                  </div>
                </div>

                {activeSource === "unit" ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.75fr)_minmax(280px,1.25fr)]">
                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      <FieldLabel>Buscar unidade</FieldLabel>
                      <input
                        name="unitQ"
                        defaultValue={requestedUnitQ}
                        placeholder="Buscar unidade..."
                        className="px-3"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      <FieldLabel>Unidade</FieldLabel>
                      <select name="unitId" defaultValue={requestedUnitId} className="px-3">
                        <option value="">Selecione uma unidade</option>
                        {unitOptions.map((unit) => (
                          <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {activeSource === "template" ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(240px,0.7fr)]">
                    <label className="grid gap-2 text-sm font-semibold text-slate-200">
                      <FieldLabel>Template</FieldLabel>
                      <select name="templateId" defaultValue={selectedTemplate?.id || ""} className="px-3">
                        <option value="">Selecione um template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>{template.code} - {template.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
                      <FieldLabel>Resumo do template</FieldLabel>
                      {selectedTemplate ? (
                        <div className="mt-3 grid gap-2 text-sm text-slate-300">
                          <div>{selectedTemplate.sourceType === "zabbix_group" ? "Origem por grupo Zabbix" : "Origem por unidades salvas"}</div>
                          <div>{selectedTemplate.outputFormat.toUpperCase()} · {selectedTemplate.includeCharts ? "com gráficos" : "sem gráficos"}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">Nenhum template selecionado.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeSource === "group" ? (
                  <div className="grid gap-3">
                    <label className="grid max-w-xl gap-2 text-sm font-semibold text-slate-200">
                      <FieldLabel>Fonte dos dados</FieldLabel>
                      <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""} className="px-3">
                        <option value="">Selecione uma integração</option>
                        {reportSources.map((source) => (
                          <option key={source.id} value={source.id}>{source.code} - {source.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-[12px] border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel>Host groups</FieldLabel>
                        {effectiveGroupIds.length ? <Link href={clearGroupsHref} className="text-sm font-semibold text-orange-200 hover:text-white">Limpar grupos</Link> : null}
                      </div>

                      {selectedGroupSource && groupCatalog?.items.length ? (
                        <div className="mt-3 grid max-h-[300px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                          {groupCatalog.items.map((group) => (
                            <label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]">
                              <input type="checkbox" name="groupIds" value={group.id} defaultChecked={effectiveGroupIds.includes(group.id)} className="mt-0.5 h-4 w-4" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-100">{group.name}</span>
                                <span className="text-xs text-slate-500">{group.hostCount} host(s)</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-500">
                          {selectedGroupSource ? "Sem grupos retornados." : "Selecione uma integração e aplique os filtros."}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </form>
            </Surface>

            <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
              <Surface className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-50">Seleção de unidades</h2>
                    <p className="mt-1 text-xs text-slate-500">Unidades que entrarão no lote do relatório.</p>
                  </div>
                  <TonePill tone={resultUnits.length ? "success" : "attention"}>{resultUnits.length}</TonePill>
                </div>

                {resultUnits.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {resultUnits.slice(0, 8).map((unit) => (
                      <div key={`selected-card-${unit.id}`} className="relative rounded-[12px] border border-white/10 bg-white/[0.035] p-3">
                        <div className="pr-7 text-sm font-black leading-5 text-slate-100">{unit.code} - {unit.name}</div>
                        <div className="mt-2 text-xs text-slate-500">Contrato: {configuredMetadataForUnit(unit).contractLabel || unit.reportContractLabel || defaultContractLabel || "preencher"}</div>
                        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded bg-orange-500 text-xs font-black text-white">✓</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[12px] border border-dashed border-white/12 bg-black/10 p-5 text-sm text-slate-500">
                    Aplique os filtros para carregar unidades.
                  </div>
                )}
              </Surface>

              <Surface className="p-4 sm:p-5">
                <h2 className="text-base font-black text-slate-50">Prévia do relatório (DOCX)</h2>
                <div className="mt-4 rounded-[8px] border border-white/10 bg-[#f4efe9] p-2.5">
                  <div className="relative mx-auto aspect-[0.72] max-h-[430px] overflow-hidden rounded-[3px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                    <div className="absolute left-0 top-0 h-20 w-full bg-slate-300" />
                    <div className="absolute left-0 top-12 h-8 w-full bg-orange-300" />
                    <div className="absolute left-[17%] top-[38%] text-center">
                      <div className="text-4xl font-black tracking-[-0.12em] text-slate-400">
                        NOV<span className="text-orange-500">A</span>
                      </div>
                      <div className="mt-1 text-xs tracking-[0.55em] text-slate-400">TELECOM</div>
                    </div>
                    <div className="absolute left-[53%] top-[31%] h-[45%] w-px bg-orange-500" />
                    <div className="absolute left-[58%] top-[45%] text-left text-slate-950">
                      <div className="text-xs text-slate-700">{defaultCompetenceLabel}</div>
                      <div className="mt-5 text-xs font-medium uppercase text-orange-500">INTERESSADO</div>
                      <div className="text-sm font-black">{defaultInterestedParty || "NOVA TELECOM"}</div>
                      <div className="mt-5 text-xs">{defaultIssueDateLabel}</div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-16 w-full bg-slate-300" />
                    <div className="absolute bottom-10 left-0 h-6 w-full bg-orange-300" />
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-[7px] bg-slate-950 px-3 py-2 text-sm text-slate-300">
                    <span>‹</span>
                    <span>1 / {Math.max(1, resultUnits.length * 9 + 1)}</span>
                    <span>100%</span>
                    <span>⛶</span>
                  </div>
                </div>
              </Surface>
            </div>

            <Surface className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-50">Dados das unidades selecionadas</h2>
                  <p className="mt-1 text-xs text-slate-500">Contrato, endereço e banda que aparecerão antes dos sensores.</p>
                </div>
                <span className="text-slate-400">⌃</span>
              </div>

              {resultUnits.length ? (
                <div className="mt-4 overflow-hidden rounded-[12px] border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Unidade</th>
                        <th className="px-3 py-3">Contrato</th>
                        <th className="px-3 py-3">Endereço</th>
                        <th className="px-3 py-3">Banda contratada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-slate-200">
                      {resultUnits.map((unit) => {
                        const meta = configuredMetadataForUnit(unit);

                        return (
                          <tr key={`review-row-${unit.id}`}>
                            <td className="px-3 py-3 font-semibold">{unit.code} - {unit.name}</td>
                            <td className="px-3 py-3">{meta.contractLabel || unit.reportContractLabel || defaultContractLabel || "preencher"}</td>
                            <td className="px-3 py-3">{meta.addressLine || unit.reportAddressLine || formatUnitAddressFallback(unit) || defaultAddressLine || "preencher"}</td>
                            <td className="px-3 py-3">{meta.contractedBandwidth || unit.reportContractedBandwidth || defaultBandwidth || "preencher"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 rounded-[12px] border border-dashed border-white/12 bg-black/10 p-5 text-sm text-slate-500">
                  Nenhuma unidade selecionada.
                </div>
              )}
            </Surface>
          </div>

          <aside className="grid gap-4 xl:sticky xl:top-5">
            <Surface className="p-4 sm:p-5">
              <h2 className="text-base font-black text-slate-50">Resumo do relatório</h2>

              <div className="mt-4 divide-y divide-white/[0.08] rounded-[12px] border border-white/10 bg-black/10 text-sm">
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="text-slate-400">Período</span>
                  <span className="font-bold text-slate-100">{defaultCompetenceLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="text-slate-400">Unidades selecionadas</span>
                  <span className="font-bold text-slate-100">{resultUnits.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="text-slate-400">Sensores por unidade</span>
                  <span className="font-bold text-slate-100">3</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="text-slate-400">Páginas estimadas</span>
                  <span className="font-bold text-slate-100">{Math.max(1, resultUnits.length * 9 + 1)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="text-slate-400">Status dos dados</span>
                  <TonePill tone={resultUnits.length ? "success" : "attention"}>{resultUnits.length ? "Pronto para exportar" : "Aguardando filtros"}</TonePill>
                </div>
              </div>
            </Surface>

            <form id="monitoring-export-form" action="/relatorios/monitoramento/export-jobs" method="POST">
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="reportStyle" value="complete" />
              <input type="hidden" name="title" value={defaultTitle} />
              <input type="hidden" name="competenceLabel" value={defaultCompetenceLabel} />
              <input type="hidden" name="issueDateLabel" value={defaultIssueDateLabel} />
              <input type="hidden" name="interestedParty" value={defaultInterestedParty} />
              <input type="hidden" name="contractLabel" value={defaultContractLabel} />
              <input type="hidden" name="contractedBandwidth" value={defaultBandwidth} />
              <input type="hidden" name="addressLine" value={defaultAddressLine} />
              <input type="hidden" name="unitMetadataJson" value={defaultUnitMetadataJson} />

              {resultUnits.map((unit) => {
                const meta = configuredMetadataForUnit(unit);

                return (
                  <div key={`export-hidden-${unit.id}`}>
                    <input type="hidden" name="unitIds" value={unit.id} />
                    <input type="hidden" name={`unitMetadata.${unit.id}.contractLabel`} value={meta.contractLabel || unit.reportContractLabel || defaultContractLabel} />
                    <input type="hidden" name={`unitMetadata.${unit.id}.contractedBandwidth`} value={meta.contractedBandwidth || unit.reportContractedBandwidth || defaultBandwidth} />
                    <input type="hidden" name={`unitMetadata.${unit.id}.addressLine`} value={meta.addressLine || unit.reportAddressLine || formatUnitAddressFallback(unit) || defaultAddressLine} />
                    <input type="hidden" name={`unitMetadata.${unit.id}.notes`} value={meta.notes || unit.reportNotes || ""} />
                  </div>
                );
              })}

              <Surface className="p-4 sm:p-5">
                <h2 className="text-base font-black text-slate-50">Ações de exportação</h2>

                {groupPreviewError ? (
                  <div className="mt-4 rounded-[12px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {groupPreviewError}
                  </div>
                ) : null}

                {groupPreview?.unresolvedHosts.length ? (
                  <details className="mt-4 rounded-[12px] border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-50">
                    <summary className="cursor-pointer font-semibold">Hosts sem unidade ({groupPreview.unresolvedHosts.length})</summary>
                    <div className="mt-3 grid gap-1 text-xs text-amber-100/90">
                      {groupPreview.unresolvedHosts.slice(0, 12).map((item) => (
                        <div key={item.host.hostId} className="truncate">{compactHostName(item)}</div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <label className="mt-4 flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-100">
                  <input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                  Gráficos
                </label>

                <div className="mt-4 grid gap-2">
                  <button
                    type="submit"
                    name="format"
                    value="docx"
                    formAction="/relatorios/monitoramento/export"
                    formTarget="_blank"
                    disabled={!resultUnits.length}
                    className="inline-flex h-11 items-center justify-center rounded-[12px] bg-orange-500 px-4 text-sm font-black text-white shadow-[0_18px_42px_rgba(249,115,22,0.22)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    ⧉ Exportar DOCX
                  </button>

                  <button
                    type="submit"
                    name="format"
                    value="pdf"
                    formAction="/relatorios/monitoramento/export"
                    formTarget="_blank"
                    disabled={!resultUnits.length}
                    className="inline-flex h-11 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    ⇩ Exportar PDF
                  </button>

                  <button
                    type="submit"
                    name="format"
                    value={defaultFormat}
                    disabled={!resultUnits.length}
                    className="inline-flex h-11 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    ✉ Gerar em segundo plano
                  </button>
                </div>
              </Surface>
            </form>

            <Surface className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-50">Últimas exportações</h2>
                <span className="text-xs font-bold text-orange-300">Ver todas</span>
              </div>

              {recentRuns.length ? (
                <div className="mt-4 grid gap-3">
                  {recentRuns.slice(0, 5).map((run) => {
                    const attachment = run.attachments[0] || null;
                    const origin = run.rule.reportTemplate ? `${run.rule.reportTemplate.code} - ${run.rule.reportTemplate.name}` : "Exportação manual";

                    return (
                      <div key={run.id} className="rounded-[12px] border border-white/10 bg-white/[0.035] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-100">{origin}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(run.startedAt)}</div>
                          </div>
                          <TonePill tone={runStatusTone(run.status)}>{runStatusLabel(run.status)}</TonePill>
                        </div>

                        {attachment ? (
                          <Link href={webAttachmentUrl(attachment.url)} className="mt-2 inline-flex text-xs font-bold text-orange-200 hover:text-white">
                            Baixar arquivo
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-[12px] border border-dashed border-white/12 bg-black/10 p-5 text-sm text-slate-500">
                  Nenhuma exportação gerada ainda.
                </div>
              )}
            </Surface>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
