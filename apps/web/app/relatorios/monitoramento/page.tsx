import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ReportFocusUnitField,
  ReportUnitBatchSelector,
} from "@/components/report-unit-selector";
import { Surface } from "@/components/ops-ui";
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

type ReportSourceMode = "unit" | "template" | "zabbix_group";

type BuilderQuery = {
  source?: ReportSourceMode;
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
  if (query.source) params.set("source", query.source);
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
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

  const requestedSource = readStringParam(params, "source", "");
  const requestedTemplateId = readStringParam(params, "templateId", "");
  const requestedUnitId = readStringParam(params, "unitId", "");
  const requestedGroupIntegrationId = readStringParam(params, "groupIntegrationId", "");
  const requestedGroupIds = readCsvParam(params, "groupIds");

  const selectedTemplate = templates.find((item) => item.id === requestedTemplateId) || null;
  const sourceMode: ReportSourceMode =
    requestedSource === "template" || requestedSource === "zabbix_group" || requestedSource === "unit"
      ? requestedSource
      : selectedTemplate
        ? "template"
        : "unit";

  const presetRange = rangeFromPreset(selectedTemplate?.periodPreset);
  const from = readStringParam(params, "from", presetRange.from);
  const to = readStringParam(params, "to", presetRange.to);

  const templateManualUnitIds = selectedTemplate?.sourceType === "manual" ? selectedTemplate.unitIds : [];
  const templateGroupIds = selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.groupIds : [];

  const usesGroupResolution =
    sourceMode === "zabbix_group" ||
    (sourceMode === "template" && selectedTemplate?.sourceType === "zabbix_group");

  const effectiveGroupIntegrationId = usesGroupResolution
    ? requestedGroupIntegrationId ||
      (selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.integration?.id || "" : "")
    : "";
  const effectiveGroupIds = usesGroupResolution
    ? requestedGroupIds.length
      ? requestedGroupIds
      : templateGroupIds
    : [];

  const selectedGroupSource = reportSources.find((item) => item.id === effectiveGroupIntegrationId) || null;
  const groupCatalog = usesGroupResolution && selectedGroupSource ? await readZabbixGroups(selectedGroupSource.id) : null;
  const { preview: groupPreview, error: groupPreviewError } =
    usesGroupResolution && selectedGroupSource && effectiveGroupIds.length
      ? await readZabbixGroupPreview(selectedGroupSource.id, effectiveGroupIds)
      : { preview: null, error: "" };

  const previewUnitIds = groupPreview?.matchedUnits.map((item) => item.unit.id) || [];
  const selectedUnitId =
    requestedUnitId ||
    previewUnitIds[0] ||
    templateManualUnitIds[0] ||
    catalog.items[0]?.id ||
    "";
  const selectedUnit = catalog.items.find((item) => item.id === selectedUnitId) || catalog.items[0] || null;

  const exportSelectedUnitIds = sourceMode === "zabbix_group"
    ? previewUnitIds
    : sourceMode === "template"
      ? selectedTemplate?.sourceType === "zabbix_group"
        ? previewUnitIds
        : templateManualUnitIds
      : selectedUnitId
        ? [selectedUnitId]
        : [];

  const exportUnits = exportSelectedUnitIds
    .map((unitId) => catalog.items.find((item) => item.id === unitId))
    .filter((item, index, array): item is ReportUnitCatalog["items"][number] => Boolean(item) && array.findIndex((candidate) => candidate?.id === item.id) === index);

  const unresolvedCount = groupPreview
    ? groupPreview.counts.ambiguousHosts + groupPreview.counts.unmatchedHosts
    : 0;

  const defaultFormat = selectedTemplate?.outputFormat?.toLowerCase() === "docx" ? "docx" : "pdf";
  const defaultIncludeCharts = selectedTemplate?.includeCharts ?? true;
  const defaultTitle = selectedTemplate?.title || "Relatório de Consumo";
  const defaultInterestedParty = selectedTemplate?.interestedParty || selectedUnit?.partner.name || "";
  const defaultContractLabel = selectedTemplate?.contractLabel || "";
  const defaultBandwidth = selectedTemplate?.contractedBandwidth || "";
  const defaultAddressLine = selectedTemplate?.addressLine || "";

  const currentBuilderQuery: BuilderQuery = {
    source: sourceMode,
    templateId: selectedTemplate?.id || undefined,
    unitId: selectedUnitId || undefined,
    from,
    to,
    groupIntegrationId: selectedGroupSource?.id || undefined,
    groupIds: effectiveGroupIds,
  };

  const resetHref = "/relatorios/monitoramento";
  const clearGroupsHref = buildBuilderHref({
    source: sourceMode,
    templateId: selectedTemplate?.id || undefined,
    unitId: selectedUnitId || undefined,
    from,
    to,
    groupIntegrationId: selectedGroupSource?.id || undefined,
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

  const activeOriginLabel = sourceMode === "template"
    ? selectedTemplate
      ? `Template ${selectedTemplate.code}`
      : "Template"
    : sourceMode === "zabbix_group"
      ? "Grupos do Zabbix"
      : "Unidade";
  const activeOriginMeta = sourceMode === "template"
    ? selectedTemplate?.name || "Selecione um template para carregar o lote."
    : sourceMode === "zabbix_group"
      ? effectiveGroupIds.length
        ? `${effectiveGroupIds.length} grupo(s) em ${selectedGroupSource?.code || "integração"}`
        : "Selecione integração e grupos para montar o lote."
      : selectedUnit
        ? `${selectedUnit.code} - ${selectedUnit.name}`
        : "Sem unidade selecionada";

  return (
    <AppShell
      title="Relatórios"
      subtitle="Filtro, lote e exportação no mesmo fluxo operacional."
    >
      <div className="report-workbench space-y-5">
        <Surface className="p-5 sm:p-6">
          <form action="/relatorios/monitoramento" method="GET" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Origem</span>
              {([
                ["unit", "Unidade"],
                ["template", "Template"],
                ["zabbix_group", "Grupo Zabbix"],
              ] as const).map(([value, label]) => {
                const active = sourceMode === value;

                return (
                  <label
                    key={value}
                    className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-sky-500/30 bg-sky-500/12 text-sky-50"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    <input type="radio" name="source" value={value} defaultChecked={active} className="sr-only" />
                    {label}
                  </label>
                );
              })}

              <div className="ml-auto flex flex-wrap gap-2">
                <Link
                  href={resetHref}
                  className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Resetar
                </Link>
                <Link
                  href="/monitoramento"
                  className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Monitoramento
                </Link>
              </div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px_180px_auto]">
              <ReportFocusUnitField
                name="unitId"
                units={catalog.items}
                initialSelectedId={selectedUnitId}
                label={sourceMode === "unit" ? "Unidade" : "Unidade para conferência"}
                helpText={
                  sourceMode === "unit"
                    ? "Quando a origem for manual, essa unidade já entra no lote do relatório."
                    : "Quando a origem vier de template ou grupos, esse campo fica como referência rápida para conferência."
                }
              />

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Início
                <input name="from" type="date" defaultValue={from} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Fim
                <input name="to" type="date" defaultValue={to} />
              </label>

              <div className="flex items-end gap-2 self-start">
                <button type="submit">Aplicar</button>
              </div>
            </div>

            {sourceMode === "template" ? (
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Template
                <select name="templateId" defaultValue={selectedTemplate?.id || ""}>
                  <option value="">Selecione um template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.code} - {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {sourceMode === "zabbix_group" ? (
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Integração Zabbix
                  <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""}>
                    <option value="">Selecione uma integração</option>
                    {reportSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.code} - {source.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Host groups
                  <select name="groupIds" multiple size={6} defaultValue={effectiveGroupIds} disabled={!groupCatalog?.items.length}>
                    {(groupCatalog?.items || []).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} · {group.hostCount} host(s)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
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
              {effectiveGroupIds.length ? (
                <Link
                  href={clearGroupsHref}
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Limpar grupos
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ativo</span>
              <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold text-slate-100">
                {activeOriginLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold text-slate-100">
                {formatDate(from)} até {formatDate(to)}
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-50">
                {exportUnits.length} unidade(s)
              </span>
              {unresolvedCount ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-50">
                  {unresolvedCount} pendência(s)
                </span>
              ) : null}
              <span className="text-xs text-slate-400">{activeOriginMeta}</span>
            </div>
          </form>
        </Surface>

        <form
          id="builder-export-form"
          action="/relatorios/monitoramento/export"
          method="POST"
          target="_blank"
          className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"
        >
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />

          <Surface className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Lote do relatório</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Revise as unidades que realmente vão sair no arquivo final.
                </p>
              </div>
            </div>

            {groupPreviewError ? (
              <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                Não foi possível revisar os grupos agora: {groupPreviewError}
              </div>
            ) : null}

            {sourceMode === "zabbix_group" && !effectiveGroupIds.length ? (
              <div className="mt-4 rounded-[16px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-300">
                Escolha a integração e os host groups acima para o NOVA montar o lote automaticamente.
              </div>
            ) : null}

            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              {exportUnits.length
                ? `${exportUnits.length} unidade(s) carregada(s) no lote. Ajuste abaixo apenas se precisar incluir ou remover itens.`
                : "Nenhuma unidade pronta no lote. Ajuste os filtros acima para continuar."}
            </div>

            {groupPreview?.unresolvedHosts.length ? (
              <div className="mt-4 rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="text-sm font-semibold text-amber-50">Hosts pendentes de vínculo</div>
                <div className="mt-2 space-y-2 text-xs text-amber-50/90">
                  {groupPreview.unresolvedHosts.slice(0, 10).map((item) => (
                    <div key={item.host.hostId}>{item.host.hostName || item.host.host || item.host.hostId}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <ReportUnitBatchSelector
                name="unitIds"
                units={catalog.items}
                initialSelectedIds={exportSelectedUnitIds}
                title="Editar lote"
                description="Adicione ou remova unidades manualmente antes do download."
              />
            </div>
          </Surface>

          <div className="xl:sticky xl:top-24 self-start">
            <Surface className="p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Exportar</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Escolha o formato do arquivo e ajuste os dados comerciais.
                </p>
              </div>

              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Resumo</div>
                <dl className="mt-3 grid gap-2 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Origem</dt>
                    <dd className="text-right font-medium text-slate-100">{activeOriginLabel}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Período</dt>
                    <dd className="text-right font-medium text-slate-100">{formatDate(from)} até {formatDate(to)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Unidades</dt>
                    <dd className="text-right font-medium text-slate-100">{exportUnits.length}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Formato do arquivo
                  <select name="format" defaultValue={defaultFormat}>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">
                  <input type="checkbox" name="includeCharts" defaultChecked={defaultIncludeCharts} className="h-4 w-4" />
                  Incluir gráficos
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

                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Endereço ou observação comercial
                  <input name="addressLine" defaultValue={defaultAddressLine} placeholder="Ex.: Rua X, Centro, Gurupi - TO" />
                </label>

                <button type="submit">Baixar arquivo</button>
              </div>
            </Surface>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
