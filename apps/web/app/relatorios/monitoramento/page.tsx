import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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

type FilterQuery = {
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

function buildFilterHref(query: FilterQuery) {
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatUnitMeta(unit: ReportUnitCatalog["items"][number]) {
  return [unit.partner.code, [unit.city, unit.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
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

  const requestedTemplateId = readStringParam(params, "templateId", "");
  const requestedUnitId = readStringParam(params, "unitId", "");
  const requestedGroupIntegrationId = readStringParam(params, "groupIntegrationId", "");
  const requestedGroupIds = readCsvParam(params, "groupIds");

  const selectedTemplate = templates.find((item) => item.id === requestedTemplateId) || null;
  const presetRange = rangeFromPreset(selectedTemplate?.periodPreset);
  const from = readStringParam(params, "from", presetRange.from);
  const to = readStringParam(params, "to", presetRange.to);

  const templateManualUnitIds = selectedTemplate?.sourceType === "manual" ? selectedTemplate.unitIds : [];
  const templateGroupIds = selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.groupIds : [];
  const selectedGroupIntegrationId =
    requestedGroupIntegrationId ||
    (selectedTemplate?.sourceType === "zabbix_group" ? selectedTemplate.integration?.id || "" : "");
  const selectedGroupSource = reportSources.find((item) => item.id === selectedGroupIntegrationId) || null;
  const effectiveGroupIds = requestedGroupIds.length ? requestedGroupIds : templateGroupIds;
  const groupCatalog = selectedGroupSource ? await readZabbixGroups(selectedGroupSource.id) : null;
  const { preview: groupPreview, error: groupPreviewError } =
    selectedGroupSource && effectiveGroupIds.length
      ? await readZabbixGroupPreview(selectedGroupSource.id, effectiveGroupIds)
      : { preview: null, error: "" };

  const resultUnitIds = uniqueIds([
    ...templateManualUnitIds,
    requestedUnitId,
    ...(groupPreview?.matchedUnits.map((item) => item.unit.id) || []),
  ]);

  const resultUnits = resultUnitIds
    .map((unitId) => catalog.items.find((item) => item.id === unitId))
    .filter((item): item is ReportUnitCatalog["items"][number] => Boolean(item));

  const selectedUnit = catalog.items.find((item) => item.id === requestedUnitId) || null;
  const primaryUnit = resultUnits[0] || selectedUnit || catalog.items[0] || null;
  const unresolvedCount = groupPreview
    ? groupPreview.counts.ambiguousHosts + groupPreview.counts.unmatchedHosts
    : 0;

  const currentFilters: FilterQuery = {
    templateId: selectedTemplate?.id || undefined,
    unitId: requestedUnitId || undefined,
    from,
    to,
    groupIntegrationId: selectedGroupSource?.id || undefined,
    groupIds: effectiveGroupIds,
  };

  const resetHref = "/relatorios/monitoramento";
  const clearGroupsHref = buildFilterHref({
    templateId: selectedTemplate?.id || undefined,
    unitId: requestedUnitId || undefined,
    from,
    to,
  });
  const quickTodayHref = buildFilterHref({
    ...currentFilters,
    from: quickRange(1).from,
    to: quickRange(1).to,
  });
  const quickWeekHref = buildFilterHref({
    ...currentFilters,
    from: quickRange(7).from,
    to: quickRange(7).to,
  });
  const quickMonthHref = buildFilterHref({
    ...currentFilters,
    from: monthRange(0).from,
    to: monthRange(0).to,
  });
  const quickPrevMonthHref = buildFilterHref({
    ...currentFilters,
    from: monthRange(-1).from,
    to: monthRange(-1).to,
  });

  const defaultFormat = selectedTemplate?.outputFormat?.toLowerCase() === "docx" ? "docx" : "pdf";
  const defaultIncludeCharts = selectedTemplate?.includeCharts ?? true;
  const defaultTitle = selectedTemplate?.title || "Relatório de Consumo";
  const defaultInterestedParty = selectedTemplate?.interestedParty || primaryUnit?.partner.name || "";
  const defaultContractLabel = selectedTemplate?.contractLabel || "";
  const defaultBandwidth = selectedTemplate?.contractedBandwidth || "";
  const defaultAddressLine = selectedTemplate?.addressLine || "";

  return (
    <AppShell
      title="Relatórios"
      subtitle="Aplique os filtros, confira o lote e exporte o arquivo final."
    >
      <div className="space-y-5">
        <Surface className="p-5 sm:p-6">
          <form action="/relatorios/monitoramento" method="GET" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,260px)_minmax(0,220px)_180px_180px_auto] xl:items-end">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Template
                <select name="templateId" defaultValue={selectedTemplate?.id || ""}>
                  <option value="">Sem template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.code} - {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Unidade
                <select name="unitId" defaultValue={requestedUnitId}>
                  <option value="">Sem unidade fixa</option>
                  {catalog.items.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code} - {unit.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Integração Zabbix
                <select name="groupIntegrationId" defaultValue={selectedGroupSource?.id || ""}>
                  <option value="">Sem grupo Zabbix</option>
                  {reportSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} - {source.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Início
                <input name="from" type="date" defaultValue={from} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Fim
                <input name="to" type="date" defaultValue={to} />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2 xl:pb-[1px]">
                <Link
                  href={resetHref}
                  className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Resetar
                </Link>
                <button type="submit">Aplicar filtros</button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Host groups
                <select
                  name="groupIds"
                  multiple
                  size={Math.min(Math.max(groupCatalog?.items.length || 4, 4), 8)}
                  defaultValue={effectiveGroupIds}
                  disabled={!groupCatalog?.items.length}
                >
                  {(groupCatalog?.items || []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} · {group.hostCount} host(s)
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Link
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]"
                  href={quickTodayHref}
                >
                  Hoje
                </Link>
                <Link
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]"
                  href={quickWeekHref}
                >
                  7 dias
                </Link>
                <Link
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]"
                  href={quickMonthHref}
                >
                  Este mês
                </Link>
                <Link
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-white/[0.08]"
                  href={quickPrevMonthHref}
                >
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
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              {selectedTemplate ? (
                <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 font-semibold text-slate-100">
                  Template: {selectedTemplate.code}
                </span>
              ) : null}
              {requestedUnitId && selectedUnit ? (
                <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 font-semibold text-slate-100">
                  Unidade fixa: {selectedUnit.code}
                </span>
              ) : null}
              {selectedGroupSource ? (
                <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 font-semibold text-slate-100">
                  Integração: {selectedGroupSource.code}
                </span>
              ) : null}
              {effectiveGroupIds.length ? (
                <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 font-semibold text-slate-100">
                  {effectiveGroupIds.length} grupo(s)
                </span>
              ) : null}
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-50">
                {resultUnits.length} unidade(s) no lote
              </span>
              {unresolvedCount ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-semibold text-amber-50">
                  {unresolvedCount} pendência(s)
                </span>
              ) : null}
              <span className="text-slate-400">{formatDate(from)} até {formatDate(to)}</span>
            </div>
          </form>
        </Surface>

        <form action="/relatorios/monitoramento/export" method="POST" target="_blank" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />

          <Surface className="p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Lote do relatório</h2>
              <p className="mt-1 text-sm text-slate-400">
                O lote é montado a partir dos filtros acima. Desmarque as unidades que não devem sair no arquivo.
              </p>
            </div>

            {groupPreviewError ? (
              <div className="mt-4 rounded-[16px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                Não foi possível consultar os grupos do Zabbix agora: {groupPreviewError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{resultUnits.length} unidade(s) resolvida(s)</span>
              {groupPreview ? <span>{groupPreview.counts.hosts} host(s) analisado(s)</span> : null}
              {groupPreview ? <span>{groupPreview.counts.matchedUnits} vínculo(s) encontrados</span> : null}
            </div>

            {!resultUnits.length ? (
              <div className="mt-4 rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                Nenhuma unidade entrou no lote com os filtros atuais.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[16px] border border-white/10 bg-black/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        <th className="w-16 px-4 py-3 font-semibold">Sair</th>
                        <th className="px-4 py-3 font-semibold">Unidade</th>
                        <th className="w-56 px-4 py-3 font-semibold">Parceiro / local</th>
                        <th className="w-64 px-4 py-3 font-semibold">Origem / host</th>
                        <th className="w-28 px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-slate-200">
                      {resultUnits.map((unit) => {
                        const matched = groupPreview?.matchedUnits.find((item) => item.unit.id === unit.id) || null;
                        const fromTemplate = templateManualUnitIds.includes(unit.id);
                        const fromManual = requestedUnitId === unit.id;
                        const sourceText = matched
                          ? matched.primaryHost.hostName || matched.primaryHost.host || matched.primaryHost.hostId
                          : fromManual
                            ? "Unidade selecionada"
                            : fromTemplate
                              ? `Template ${selectedTemplate?.code || ""}`
                              : "Filtro aplicado";
                        const statusText = matched ? `${matched.confidence}%` : "pronto";

                        return (
                          <tr key={unit.id} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-3 align-top">
                              <input type="checkbox" name="unitIds" value={unit.id} defaultChecked className="mt-0.5 h-4 w-4" />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium text-slate-100">{unit.code} - {unit.name}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-xs text-slate-400">{formatUnitMeta(unit) || "-"}</td>
                            <td className="px-4 py-3 align-top text-xs text-slate-400">{sourceText}</td>
                            <td className="px-4 py-3 align-top text-xs text-slate-400">{statusText}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {groupPreview?.unresolvedHosts.length ? (
              <div className="mt-4 rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <div className="text-sm font-semibold text-amber-50">Hosts pendentes de vínculo</div>
                <div className="mt-2 overflow-hidden rounded-[12px] border border-amber-400/10 bg-black/10">
                  <table className="min-w-full table-fixed text-xs text-amber-50/90">
                    <thead>
                      <tr className="border-b border-amber-300/10 text-left uppercase tracking-[0.16em] text-amber-100/70">
                        <th className="px-3 py-2 font-semibold">Host</th>
                        <th className="w-28 px-3 py-2 font-semibold">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-300/10">
                      {groupPreview.unresolvedHosts.slice(0, 12).map((item) => (
                        <tr key={item.host.hostId}>
                          <td className="px-3 py-2">{item.host.hostName || item.host.host || item.host.hostId}</td>
                          <td className="px-3 py-2 capitalize">{item.status === "ambiguous" ? "Ambíguo" : "Sem vínculo"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Surface>

          <div className="self-start xl:sticky xl:top-24">
            <Surface className="p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Exportar</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Ajuste o arquivo final e baixe o lote atual.
                </p>
              </div>

              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Resumo</div>
                <dl className="mt-3 grid gap-2 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Período</dt>
                    <dd className="text-right font-medium text-slate-100">{formatDate(from)} até {formatDate(to)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Unidades</dt>
                    <dd className="text-right font-medium text-slate-100">{resultUnits.length}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Host groups</dt>
                    <dd className="text-right font-medium text-slate-100">{effectiveGroupIds.length || 0}</dd>
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

                <button type="submit" disabled={!resultUnits.length}>Baixar arquivo</button>
              </div>
            </Surface>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
