import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  FieldLabel,
  PageHeader,
  Surface,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage } from "@/lib/action-state";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDate, formatDateTime } from "@/lib/formatters";
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
      className="nds-button"
      data-variant="secondary"
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
      className="nova-source-mode-card"
      data-active={active ? "true" : "false"}
    >
      <span className="nova-source-mode-label">{tab.label}</span>
      <span className="nova-source-mode-copy">{tab.description}</span>
    </Link>
  );
}

function ReportNotice({ tone, children }: { tone: "success" | "info" | "error"; children: ReactNode }) {
  const toneClass = {
    success: "nds-notice-success",
    info: "nds-notice-info",
    error: "nds-notice-error",
  }[tone];

  return <div className={`rounded-[var(--nova-radius-card)] border px-3 py-2 text-[11px] ${toneClass}`}>{children}</div>;
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
      <div className="nova-monitoring-report-page grid gap-2">
        <PageHeader
          eyebrow="Relatórios / Monitoramento"
          title="Gerar relatório de consumo"
          subtitle="Selecione o período, as unidades e revise os dados antes de exportar."
          actions={(
            <>
              <Link href={returnTo} className="nds-button" data-variant="secondary">
                Atualizar dados
              </Link>
              <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">
                Novo relatório
              </Link>
            </>
          )}
        />

        {highlightedRun?.status === "success" && highlightedAttachment ? (
          <ReportNotice tone="success">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>Relatório pronto.</span>
              <Link href={webAttachmentUrl(highlightedAttachment.url)} className="font-black text-white hover:text-[var(--nova-primary)]">
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

        <div className="nova-report-stepper nds-card grid gap-2 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--nova-primary)] text-[12px] font-black text-white">1</span>
            <div>
              <div className="text-[12px] font-black text-slate-50">Filtros</div>
              <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">Seleção do período e unidades</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[11px] font-black text-slate-100">2</span>
            <div>
              <div className="text-[12px] font-black text-slate-50">Revisão</div>
              <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">Confira os dados e resumo</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[11px] font-black text-slate-100">3</span>
            <div>
              <div className="text-[12px] font-black text-slate-50">Exportação</div>
              <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">Gere o relatório</div>
            </div>
          </div>
        </div>

        <div className="nova-report-workbench">
          <div className="grid gap-2">
            <Surface>
              <form action="/relatorios/monitoramento" method="GET" className="grid gap-2">
                <input type="hidden" name="source" value={activeSource} />

                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-black text-slate-50">Período do relatório</h2>
                    <p className="mt-1 text-[11px] text-[var(--nova-text-muted)]">
                      {sourceLabel(activeSource)} · {formatDate(from)} até {formatDate(to)} · {resultUnits.length} unidade(s)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href="/relatorios/monitoramento"
                      className="nds-button"
                      data-variant="secondary"
                    >
                      Limpar
                    </Link>
                    <button
                      type="submit"
                      className="nds-button"
                      data-variant="primary"
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  {sourceTabs.map((tab) => (
                    <SourceModeLink key={tab.mode} tab={tab} active={activeSource === tab.mode} href={sourceHref(tab.mode)} />
                  ))}
                </div>

                <div className="nova-report-date-grid">
                  <label className="grid gap-1.5">
                    <FieldLabel>Mês / início</FieldLabel>
                    <input name="from" type="date" defaultValue={from} className="px-3" />
                  </label>

                  <label className="grid gap-1.5">
                    <FieldLabel>Fim</FieldLabel>
                    <input name="to" type="date" defaultValue={to} className="px-3" />
                  </label>

                  <div className="grid gap-1.5">
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
                  <div className="nova-report-choice-grid nova-report-choice-grid--unit">
                    <label className="grid gap-1.5">
                      <FieldLabel>Buscar unidade</FieldLabel>
                      <input
                        name="unitQ"
                        defaultValue={requestedUnitQ}
                        placeholder="Buscar unidade..."
                        className="px-3"
                      />
                    </label>

                    <label className="grid gap-1.5">
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
                  <div className="nova-report-choice-grid nova-report-choice-grid--template">
                    <label className="grid gap-1.5">
                      <FieldLabel>Template</FieldLabel>
                      <select name="templateId" defaultValue={selectedTemplate?.id || ""} className="px-3">
                        <option value="">Selecione um template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>{template.code} - {template.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="nds-card">
                      <FieldLabel>Resumo do template</FieldLabel>
                      {selectedTemplate ? (
                        <div className="mt-2 grid gap-1 text-[11px] text-slate-300">
                          <div>{selectedTemplate.sourceType === "zabbix_group" ? "Origem por grupo Zabbix" : "Origem por unidades salvas"}</div>
                          <div>{selectedTemplate.outputFormat.toUpperCase()} · {selectedTemplate.includeCharts ? "com gráficos" : "sem gráficos"}</div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-[var(--nova-text-muted)]">Nenhum template selecionado.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeSource === "group" ? (
                  <div className="grid gap-2">
                    <label className="grid max-w-xl gap-1.5">
                      <FieldLabel>Fonte dos dados</FieldLabel>
                      <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""} className="px-3">
                        <option value="">Selecione uma integração</option>
                        {reportSources.map((source) => (
                          <option key={source.id} value={source.id}>{source.code} - {source.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="nds-card">
                      <div className="flex items-center justify-between gap-2">
                        <FieldLabel>Host groups</FieldLabel>
                        {effectiveGroupIds.length ? <Link href={clearGroupsHref} className="nds-button" data-variant="ghost">Limpar grupos</Link> : null}
                      </div>

                      {selectedGroupSource && groupCatalog?.items.length ? (
                        <div className="mt-2 grid max-h-[300px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                          {groupCatalog.items.map((group) => (
                            <label key={group.id} className="nds-card flex cursor-pointer items-start gap-2 text-[11px] text-slate-200 transition hover:border-[color-mix(in_srgb,var(--nova-primary)_24%,transparent)] hover:bg-white/[0.06]">
                              <input type="checkbox" name="groupIds" value={group.id} defaultChecked={effectiveGroupIds.includes(group.id)} className="mt-0.5 h-4 w-4" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-100">{group.name}</span>
                                <span className="text-[10px] text-[var(--nova-text-muted)]">{group.hostCount} host(s)</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="nds-empty mt-2 px-3 py-2 text-[11px] text-[var(--nova-text-muted)]">
                          {selectedGroupSource ? "Sem grupos retornados." : "Selecione uma integração e aplique os filtros."}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </form>
            </Surface>

            <div className="nova-report-split-grid">
              <Surface>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-black text-slate-50">Seleção de unidades</h2>
                    <p className="mt-1 text-[11px] text-[var(--nova-text-muted)]">Unidades que entrarão no lote do relatório.</p>
                  </div>
                  <TonePill tone={resultUnits.length ? "success" : "attention"}>{resultUnits.length}</TonePill>
                </div>

                {resultUnits.length ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {resultUnits.slice(0, 8).map((unit) => (
                      <div key={`selected-card-${unit.id}`} className="nds-card relative">
                        <div className="pr-7 text-[12px] font-black leading-5 text-slate-100">{unit.code} - {unit.name}</div>
                        <div className="mt-2 text-[10px] text-[var(--nova-text-muted)]">Contrato: {configuredMetadataForUnit(unit).contractLabel || unit.reportContractLabel || defaultContractLabel || "preencher"}</div>
                        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-[var(--nova-radius-control)] bg-[var(--nova-primary)] text-[10px] font-black text-white">✓</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nds-empty mt-2 text-[11px] text-[var(--nova-text-muted)]">
                    Aplique os filtros para carregar unidades.
                  </div>
                )}
              </Surface>

              <Surface>
                <h2 className="text-[13px] font-black text-slate-50">Prévia do relatório (DOCX)</h2>
                <div className="nds-report-preview mt-2 p-2">
                  <div className="relative mx-auto aspect-[0.72] max-h-[430px] overflow-hidden rounded-[3px] border border-white/[0.08] bg-[var(--nova-surface-3)]">
                    <div className="absolute left-0 top-0 h-20 w-full bg-white/[0.08]" />
                    <div className="absolute left-0 top-12 h-8 w-full bg-[color-mix(in_srgb,var(--nova-primary)_42%,transparent)]" />
                    <div className="absolute left-[17%] top-[38%] text-center">
                      <div className="text-[30px] font-black text-slate-300">
                        NOV<span className="text-[var(--nova-primary)]">A</span>
                      </div>
                      <div className="mt-1 text-[10px] font-black text-slate-500">TELECOM</div>
                    </div>
                    <div className="absolute left-[53%] top-[31%] h-[45%] w-px bg-[var(--nova-primary)]" />
                    <div className="absolute left-[58%] top-[45%] text-left text-slate-200">
                      <div className="text-[12px] text-slate-500">{defaultCompetenceLabel}</div>
                      <div className="mt-2 text-[12px] font-medium uppercase text-[var(--nova-primary)]">INTERESSADO</div>
                      <div className="text-[13px] font-black">{defaultInterestedParty || "NOVA TELECOM"}</div>
                      <div className="mt-2 text-[12px]">{defaultIssueDateLabel}</div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-16 w-full bg-white/[0.08]" />
                    <div className="absolute bottom-10 left-0 h-6 w-full bg-[color-mix(in_srgb,var(--nova-primary)_42%,transparent)]" />
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-[var(--nova-radius-control)] bg-[var(--nova-surface-3)] px-3 py-2 text-[11px] text-slate-300">
                    <span>‹</span>
                    <span>1 / {Math.max(1, resultUnits.length * 9 + 1)}</span>
                    <span>100%</span>
                    <span>⛶</span>
                  </div>
                </div>
              </Surface>
            </div>

            <Surface>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[13px] font-black text-slate-50">Dados das unidades selecionadas</h2>
                  <p className="mt-1 text-[11px] text-[var(--nova-text-muted)]">Contrato, endereço e banda que aparecerão antes dos sensores.</p>
                </div>
                <span className="text-slate-400">⌃</span>
              </div>

              {resultUnits.length ? (
                <TableShell className="mt-2">
                  <DenseTable>
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Contrato</th>
                        <th>Endereço</th>
                        <th>Banda contratada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultUnits.map((unit) => {
                        const meta = configuredMetadataForUnit(unit);

                        return (
                          <tr key={`review-row-${unit.id}`}>
                            <td className="font-semibold text-slate-100">{unit.code} - {unit.name}</td>
                            <td>{meta.contractLabel || unit.reportContractLabel || defaultContractLabel || "preencher"}</td>
                            <td>{meta.addressLine || unit.reportAddressLine || formatUnitAddressFallback(unit) || defaultAddressLine || "preencher"}</td>
                            <td>{meta.contractedBandwidth || unit.reportContractedBandwidth || defaultBandwidth || "preencher"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DenseTable>
                </TableShell>
              ) : (
                <div className="nds-empty mt-2 text-[11px] text-[var(--nova-text-muted)]">
                  Nenhuma unidade selecionada.
                </div>
              )}
            </Surface>
          </div>

          <aside className="grid gap-2 xl:sticky xl:top-3">
            <Surface>
              <h2 className="text-[13px] font-black text-slate-50">Resumo do relatório</h2>

              <div className="nds-card mt-2 divide-y divide-white/[0.08] p-0 text-[11px]">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[var(--nova-text-muted)]">Período</span>
                  <span className="font-bold text-slate-100">{defaultCompetenceLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[var(--nova-text-muted)]">Unidades selecionadas</span>
                  <span className="font-bold text-slate-100">{resultUnits.length}</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[var(--nova-text-muted)]">Sensores por unidade</span>
                  <span className="font-bold text-slate-100">3</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[var(--nova-text-muted)]">Páginas estimadas</span>
                  <span className="font-bold text-slate-100">{Math.max(1, resultUnits.length * 9 + 1)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[var(--nova-text-muted)]">Status dos dados</span>
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

              <Surface>
                <h2 className="text-[13px] font-black text-slate-50">Ações de exportação</h2>

                {groupPreviewError ? (
                  <div className="nds-notice-error mt-2 rounded-[var(--nova-radius-card)] border px-3 py-2 text-[11px]">
                    {groupPreviewError}
                  </div>
                ) : null}

                {groupPreview?.unresolvedHosts.length ? (
                  <details className="nds-notice-warning mt-2 rounded-[var(--nova-radius-card)] border p-2 text-[11px]">
                    <summary className="cursor-pointer font-semibold">Hosts sem unidade ({groupPreview.unresolvedHosts.length})</summary>
                    <div className="mt-2 grid gap-1 text-[10px]">
                      {groupPreview.unresolvedHosts.slice(0, 12).map((item) => (
                        <div key={item.host.hostId} className="truncate">{compactHostName(item)}</div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <label className="nds-card mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-100">
                  <input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                  Gráficos
                </label>

                <div className="mt-2 grid gap-2">
                  <button
                    type="submit"
                    name="format"
                    value="docx"
                    formAction="/relatorios/monitoramento/export"
                    formTarget="_blank"
                    disabled={!resultUnits.length}
                    className="nds-button w-full"
                    data-variant="primary"
                  >
                    Exportar DOCX
                  </button>

                  <button
                    type="submit"
                    name="format"
                    value="pdf"
                    formAction="/relatorios/monitoramento/export"
                    formTarget="_blank"
                    disabled={!resultUnits.length}
                    className="nds-button w-full"
                    data-variant="secondary"
                  >
                    Exportar PDF
                  </button>

                  <button
                    type="submit"
                    name="format"
                    value={defaultFormat}
                    disabled={!resultUnits.length}
                    className="nds-button w-full"
                    data-variant="secondary"
                  >
                    Gerar em segundo plano
                  </button>
                </div>
              </Surface>
            </form>

            <Surface>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-black text-slate-50">Últimas exportações</h2>
                <span className="text-[10px] font-black text-[var(--nova-primary)]">Ver todas</span>
              </div>

              {recentRuns.length ? (
                <div className="mt-2 grid gap-2">
                  {recentRuns.slice(0, 5).map((run) => {
                    const attachment = run.attachments[0] || null;
                    const origin = run.rule.reportTemplate ? `${run.rule.reportTemplate.code} - ${run.rule.reportTemplate.name}` : "Exportação manual";

                    return (
                      <div key={run.id} className="nds-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-bold text-slate-100">{origin}</div>
                            <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{formatDateTime(run.startedAt)}</div>
                          </div>
                          <TonePill tone={runStatusTone(run.status)}>{runStatusLabel(run.status)}</TonePill>
                        </div>

                        {attachment ? (
                          <Link href={webAttachmentUrl(attachment.url)} className="nds-button mt-2" data-variant="secondary">
                            Baixar arquivo
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="nds-empty mt-2 text-[11px] text-[var(--nova-text-muted)]">
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
