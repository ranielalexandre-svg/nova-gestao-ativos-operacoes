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
    <AppShell title="Relatórios" subtitle="Monte o lote, revise as unidades e exporte o arquivo final."><div className="nova-reports-page grid gap-5"><div className="space-y-5">
        {highlightedRun?.status === "success" && highlightedAttachment ? (
          <ReportNotice tone="success"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>Relatório pronto.</span><Link href={webAttachmentUrl(highlightedAttachment.url)} className="font-semibold text-emerald-100 hover:text-white">
                Baixar arquivo
              </Link></div></ReportNotice>
        ) : exportStatus === "queued" || highlightedRun?.status === "queued" || highlightedRun?.status === "running" ? (
          <ReportNotice tone="info">Relatório em processamento. O arquivo aparecerá em Arquivos recentes.</ReportNotice>
        ) : null}
        {exportStatus === "error" || highlightedRun?.status === "error" ? (
          <ReportNotice tone="error">
            {exportMessage || highlightedRun?.errorMessage || "Não foi possível iniciar a exportação."}
          </ReportNotice>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-start"><Surface className="p-5 sm:p-6"><form action="/relatorios/monitoramento" method="GET" className="space-y-6"><input type="hidden" name="source" value={activeSource} /><div className="flex flex-col gap-3 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Montar relatório</div><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">Escolha a origem e o período</h2><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{sourceLabel(activeSource)}</span><span>{formatDate(from)} até {formatDate(to)}</span><span>{resultUnits.length} unidade(s) no lote</span></div></div><div className="flex flex-wrap gap-2"><Link
                    href="/relatorios/monitoramento"
                    className="inline-flex h-10 items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    Limpar
                  </Link><button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-[12px] border border-sky-400/30 bg-sky-500/16 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/22"
                  >
                    Aplicar filtros
                  </button></div></div><div className="grid gap-3 md:grid-cols-3">
                {sourceTabs.map((tab) => (
                  <SourceModeLink key={tab.mode} tab={tab} active={activeSource === tab.mode} href={sourceHref(tab.mode)} />
                ))}
              </div><div className="grid gap-3 md:grid-cols-[160px_160px_minmax(0,1fr)] md:items-end"><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Início</FieldLabel><input name="from" type="date" defaultValue={from} className="px-3" /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Fim</FieldLabel><input name="to" type="date" defaultValue={to} className="px-3" /></label><div className="flex flex-wrap gap-2"><QuickLink href={quickTodayHref}>Hoje</QuickLink><QuickLink href={quickWeekHref}>7 dias</QuickLink><QuickLink href={quickMonthHref}>Este mês</QuickLink><QuickLink href={quickPrevMonthHref}>Mês passado</QuickLink></div></div>

              {activeSource === "unit" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.2fr)]"><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Buscar unidade</FieldLabel><input
                      name="unitQ"
                      defaultValue={requestedUnitQ}
                      placeholder="Código, nome, parceiro ou cidade"
                      className="px-3"
                    /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Unidade</FieldLabel><select name="unitId" defaultValue={requestedUnitId} className="px-3"><option value="">Selecione uma unidade</option>
                      {unitOptions.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
                      ))}
                    </select><span className="text-xs font-medium text-slate-500">
                      {requestedUnitQ ? `${unitOptions.length} encontrada(s)` : `Mostrando ${unitOptions.length} de ${catalog.total}. Use a busca para filtrar.`}
                    </span></label></div>
              ) : null}

              {activeSource === "template" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(240px,0.7fr)]"><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Template</FieldLabel><select name="templateId" defaultValue={selectedTemplate?.id || ""} className="px-3"><option value="">Selecione um template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.code} - {template.name}</option>
                      ))}
                    </select></label><div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4"><FieldLabel>Resumo do template</FieldLabel>
                    {selectedTemplate ? (
                      <div className="mt-3 grid gap-2 text-sm text-slate-300"><div>{selectedTemplate.sourceType === "zabbix_group" ? "Origem por grupo Zabbix" : "Origem por unidades salvas"}</div><div>{selectedTemplate.outputFormat.toUpperCase()} · {selectedTemplate.includeCharts ? "com gráficos" : "sem gráficos"}</div></div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500">Nenhum template selecionado.</div>
                    )}
                  </div></div>
              ) : null}

              {activeSource === "group" ? (
                <div className="space-y-4"><label className="grid max-w-xl gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Integração Zabbix</FieldLabel><select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""} className="px-3"><option value="">Selecione uma integração</option>
                      {reportSources.map((source) => (
                        <option key={source.id} value={source.id}>{source.code} - {source.name}</option>
                      ))}
                    </select></label><div className="rounded-[16px] border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><FieldLabel>Host groups</FieldLabel>
                      {effectiveGroupIds.length ? <Link href={clearGroupsHref} className="text-sm font-semibold text-sky-200 hover:text-white">Limpar grupos</Link> : null}
                    </div>
                    {selectedGroupSource && groupCatalog?.items.length ? (
                      <div className="mt-3 grid max-h-[360px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                        {groupCatalog.items.map((group) => (
                          <label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]"><input type="checkbox" name="groupIds" value={group.id} defaultChecked={effectiveGroupIds.includes(group.id)} className="mt-0.5 h-4 w-4" /><span className="min-w-0"><span className="block truncate font-medium text-slate-100">{group.name}</span><span className="text-xs text-slate-500">{group.hostCount} host(s)</span></span></label>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-500">
                        {selectedGroupSource ? "Sem grupos retornados." : "Selecione uma integração e aplique os filtros."}
                      </div>
                    )}
                  </div></div>
              ) : null}
            </form></Surface><form action="/relatorios/monitoramento/export-jobs" method="POST" className="xl:sticky xl:top-5"><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /><input type="hidden" name="returnTo" value={returnTo} /><Surface className="p-5 sm:p-6"><div className="border-b border-white/[0.08] pb-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Lote e saída</div><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">Revisar e exportar</h2><div className="mt-3 flex flex-wrap gap-2"><TonePill tone={resultUnits.length ? "success" : "attention"}>{resultUnits.length} unidade(s)</TonePill>
                  {groupPreview ? <TonePill tone="info">{groupPreview.counts.hosts} host(s)</TonePill> : null}
                  {unresolvedCount ? <TonePill tone="attention">{unresolvedCount} pendência(s)</TonePill> : null}
                </div></div>

              {groupPreviewError ? (
                <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {groupPreviewError}
                </div>
              ) : null}

              <div className="mt-4"><FieldLabel>Unidades que sairão no arquivo</FieldLabel>
                {resultUnits.length ? (
                  <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                    {resultUnits.map((unit) => {
                      const matched = groupPreview?.matchedUnits.find((item) => item.unit.id === unit.id) || null;
                      const origin = matched
                        ? matched.primaryHost.hostName || matched.primaryHost.host || matched.primaryHost.hostId
                        : activeSource === "unit"
                          ? "Seleção manual"
                          : selectedTemplate?.code || sourceLabel(activeSource);

                      return (
                        <label key={unit.id} className="flex cursor-pointer gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]"><input type="checkbox" name="unitIds" value={unit.id} defaultChecked className="mt-1 h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{unit.code}</span><span className="mt-1 block truncate text-xs text-slate-400">{unit.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{formatUnitMeta(unit) || origin}</span></span></label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[14px] border border-dashed border-white/12 bg-black/10 p-5 text-sm text-slate-500">
                    Aplique os filtros para carregar o lote antes de exportar.
                  </div>
                )}
              </div>

              {groupPreview?.unresolvedHosts.length ? (
                <details className="mt-4 rounded-[14px] border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-50"><summary className="cursor-pointer font-semibold">Hosts sem unidade ({groupPreview.unresolvedHosts.length})</summary><div className="mt-3 grid gap-1 text-xs text-amber-100/90">
                    {groupPreview.unresolvedHosts.slice(0, 12).map((item) => (
                      <div key={item.host.hostId} className="truncate">{compactHostName(item)}</div>
                    ))}
                  </div></details>
              ) : null}

              <div className="mt-5 grid gap-3"><div className="grid grid-cols-2 gap-3 xl:grid-cols-3"><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Formato</FieldLabel><select name="format" defaultValue={defaultFormat} className="px-3"><option value="pdf">PDF completo</option><option value="docx">DOCX completo editável</option></select></label><input type="hidden" name="reportStyle" value="complete" /><div className="rounded-[14px] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-slate-100"><FieldLabel>Saída</FieldLabel><div>PDF completo / DOCX completo editável</div><p className="mt-1 text-xs font-medium text-slate-400">PDF e DOCX geram o relatório completo. No DOCX, textos e tabelas são editáveis; os gráficos entram como imagem.</p></div><label className="flex items-center gap-3 self-end rounded-[14px] border border-white/10 bg-black/10 px-4 py-3 text-sm font-semibold text-slate-100"><input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                    Gráficos
                  </label></div><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Título</FieldLabel><input name="title" defaultValue={defaultTitle} className="px-3" /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Competência do relatório</FieldLabel><input name="competenceLabel" defaultValue={defaultCompetenceLabel} placeholder="Ex.: Abril/2026" className="px-3" /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Data de emissão</FieldLabel><input name="issueDateLabel" defaultValue={defaultIssueDateLabel} placeholder="Ex.: Palmas, 28 de abril de 2026" className="px-3" /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Interessado</FieldLabel><input name="interestedParty" defaultValue={defaultInterestedParty} className="px-3" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Contrato</FieldLabel><input name="contractLabel" defaultValue={defaultContractLabel} className="px-3" /></label><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Banda</FieldLabel><input name="contractedBandwidth" defaultValue={defaultBandwidth} className="px-3" /></label></div><label className="grid gap-2 text-sm font-semibold text-slate-200"><FieldLabel>Endereço / observação</FieldLabel><input name="addressLine" defaultValue={defaultAddressLine} className="px-3" /></label><div className="grid gap-3"><FieldLabel>Dados por unidade</FieldLabel>{resultUnits.length ? (<div className="grid gap-3">{resultUnits.map((unit) => (<div key={`metadata-${unit.id}`} className="rounded-[14px] border border-white/10 bg-black/15 p-3"><div className="mb-3 min-w-0"><div className="truncate text-sm font-semibold text-slate-100">{unit.code} - {unit.name}</div><div className="mt-1 truncate text-xs text-slate-500">{formatUnitMeta(unit) || origin}</div></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-xs font-semibold text-slate-300"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Contrato específico</span><input name={`unitMetadata.${unit.id}.contractLabel`} defaultValue={configuredMetadataForUnit(unit).contractLabel || unit.reportContractLabel || defaultContractLabel} placeholder={defaultContractLabel || "Usar contrato geral"} className="px-3" /></label><label className="grid gap-2 text-xs font-semibold text-slate-300"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Banda específica</span><input name={`unitMetadata.${unit.id}.contractedBandwidth`} defaultValue={configuredMetadataForUnit(unit).contractedBandwidth || unit.reportContractedBandwidth || defaultBandwidth} placeholder={defaultBandwidth || "Usar banda geral"} className="px-3" /></label></div><label className="mt-3 grid gap-2 text-xs font-semibold text-slate-300"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Endereço específico / observação</span><input name={`unitMetadata.${unit.id}.addressLine`} defaultValue={configuredMetadataForUnit(unit).addressLine || unit.reportAddressLine || formatUnitAddressFallback(unit) || defaultAddressLine} placeholder={defaultAddressLine || "Usar endereço geral"} className="px-3" /></label><label className="mt-3 grid gap-2 text-xs font-semibold text-slate-300"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Nota da unidade</span><input name={`unitMetadata.${unit.id}.notes`} defaultValue={configuredMetadataForUnit(unit).notes || unit.reportNotes || ""} placeholder="Ex.: unidade em reforma, sem consumo no período..." className="px-3" /></label></div>))}</div>) : (<div className="rounded-[14px] border border-white/10 bg-black/15 p-3 text-sm text-slate-500">Aplique os filtros para editar dados por unidade.</div>)}</div></div><div className="mt-5 grid gap-2"><button
                  type="submit"
                  formAction="/relatorios/monitoramento/export"
                  formTarget="_blank"
                  disabled={!resultUnits.length}
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-400/35 bg-sky-500/18 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/24 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Baixar agora
                </button><button
                  type="submit"
                  disabled={!resultUnits.length}
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Gerar em segundo plano
                </button></div></Surface></form></div><Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Histórico</div><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">Arquivos recentes</h2></div><TonePill tone="neutral">{recentRuns.length}</TonePill></div>

          {recentRuns.length ? (
            <TableShell className="mt-4"><DenseTable><TableHead><tr><th className="px-4 py-3">Início</th><th className="px-4 py-3">Origem</th><th className="w-32 px-4 py-3">Status</th><th className="w-28 px-4 py-3">Unidades</th><th className="w-44 px-4 py-3">Arquivo</th></tr></TableHead><tbody className="divide-y divide-white/[0.06] text-sm text-slate-200">
                  {recentRuns.slice(0, 10).map((run) => {
                    const attachment = run.attachments[0] || null;
                    const origin = run.rule.reportTemplate ? `${run.rule.reportTemplate.code} - ${run.rule.reportTemplate.name}` : "Exportação manual";
                    return (
                      <tr key={run.id} className="hover:bg-white/[0.03]"><TableCell>{formatDateTime(run.startedAt)}</TableCell><TableCell><div className="font-medium text-slate-100">{origin}</div>
                          {run.errorMessage ? <div className="mt-1 text-xs text-rose-200">{run.errorMessage}</div> : null}
                        </TableCell><TableCell><TonePill tone={runStatusTone(run.status)}>{runStatusLabel(run.status)}</TonePill></TableCell><TableCell className="text-slate-400">{run.hitsCount}</TableCell><TableCell>
                          {attachment ? (
                            <Link href={webAttachmentUrl(attachment.url)} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">Baixar</Link>
                          ) : (
                            <span className="text-xs text-slate-500">{run.status === "queued" || run.status === "running" ? "Gerando" : "-"}</span>
                          )}
                        </TableCell></tr>
                    );
                  })}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Sem arquivos" description="Nenhuma exportação gerada ainda." />
          )}
        </Surface></div></div></AppShell>
  );
}
