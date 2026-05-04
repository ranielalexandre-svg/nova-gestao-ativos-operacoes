import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  ProgressLine,
  RightPanel,
  Surface,
  StatCard,
  TableActionCell,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import {
  getLegacyMonitorContextForUnits,
  type LegacyMonitorContextItem,
} from "@/lib/legacy-catalog";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  formatMs,
  formatPercent,
  healthLabel,
  healthTone,
  readUnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type PartnerOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count: { units: number };
  createdAt: string;
};

type UnitEquipmentRow = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
};

type UnitRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
  partner: {
    id: string;
    code: string;
    name: string;
  };
  equipments?: UnitEquipmentRow[];
  _count?: { equipments: number };
};

function locationLabel(unit: Pick<UnitRow, "city" | "state">) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function unitEquipmentCount(unit: UnitRow) {
  return unit._count?.equipments ?? unit.equipments?.length ?? 0;
}

function compactLabel(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isRedundantLabel(primary: string, secondary: string) {
  const a = compactLabel(primary);
  const b = compactLabel(secondary);

  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function hasMonitorMetrics(monitor?: UnitHostTelemetryItem) {
  return Boolean(
    monitor &&
      (monitor.metrics.ping ||
        monitor.metrics.lossPct !== null ||
        monitor.metrics.latencyMs !== null ||
        monitor.metrics.temperatureC !== null),
  );
}

function contactPhones(item?: LegacyMonitorContextItem) {
  if (!item?.phones.length) return "Sem telefone legado";
  return item.phones.slice(0, 2).join(" · ");
}

function contextBadges(item?: LegacyMonitorContextItem) {
  if (!item) return [];

  return [
    item.hasBackup ? { label: `${item.backupCount} backup`, tone: "attention" } : null,
    item.starlinks ? { label: `${item.starlinks} starlink`, tone: "info" } : null,
    item.hasMacOnu ? { label: `${item.macOnuCount} mac/onu`, tone: "violet" } : null,
  ].filter((entry): entry is { label: string; tone: string } => Boolean(entry));
}

function formatRatio(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function completionScore(unit: UnitRow, monitor?: UnitHostTelemetryItem, legacy?: LegacyMonitorContextItem) {
  const checks = [
    Boolean(unit.code && unit.name && unit.city && unit.state),
    Boolean(unit.partner?.id),
    Boolean(unitEquipmentCount(unit)),
    monitor?.match.status === "matched",
    Boolean(legacy?.phones.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

async function readMonitorSnapshots() {
  return readUnitHostTelemetry({ timeoutMs: 1_200, fast: true });
}

export default async function UnidadesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/unidades");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const partnerId = readStringParam(params, "partnerId");
  const active = readStringParam(params, "active", "true");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);

  const [partnersResponse, response, monitorResponse] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>(
      "/partners?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
    apiJson<PaginatedResponse<UnitRow>>(
      `/units${buildApiQuery({
        q,
        partnerId: partnerId || undefined,
        active: active !== "all" ? active : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
    readMonitorSnapshots(),
  ]);

  const legacyContext = await getLegacyMonitorContextForUnits(
    response.items.map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      city: unit.city,
      state: unit.state,
      partner: {
        code: unit.partner.code,
        name: unit.partner.name,
      },
    })),
  );

  const partnerOptions = partnersResponse.items;
  const monitorByUnitId = new Map(monitorResponse.items.map((item) => [item.unit.id, item]));
  const legacyByUnitId = legacyContext.items;
  const monitoredOnPage = response.items.filter(
    (unit) => monitorByUnitId.get(unit.id)?.match.status === "matched",
  ).length;
  const withContactOnPage = response.items.filter(
    (unit) => legacyByUnitId[unit.id]?.phones.length,
  ).length;
  const withBackupOnPage = response.items.filter(
    (unit) => legacyByUnitId[unit.id]?.hasBackup,
  ).length;
  const attentionOnPage = response.items.filter((unit) => {
    const monitor = monitorByUnitId.get(unit.id);
    return Boolean(
      monitor &&
        (monitor.health === "down" ||
          monitor.health === "degraded" ||
          monitor.health === "ambiguous" ||
        monitor.problems.length),
    );
  }).length;
  const pageTotal = response.items.length;
  const equipmentOnPage = response.items.reduce((sum, unit) => sum + unitEquipmentCount(unit), 0);
  const completionValues = response.items.map((unit) =>
    completionScore(unit, monitorByUnitId.get(unit.id), legacyByUnitId[unit.id]),
  );
  const averageCompletion = completionValues.length
    ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length)
    : 0;

  return (
    <AppShell
      title="Unidades"
      subtitle="Cadastro, vínculo e cobertura por unidade."
    ><div className="nova-units-page grid gap-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Unidades" value={response.meta.total} detail="resultado filtrado" tone="info" />
          <StatCard label="Monitoradas" value={monitoredOnPage} detail={formatRatio(monitoredOnPage, pageTotal)} tone={monitoredOnPage ? "success" : "neutral"} />
          <StatCard label="Com contato" value={withContactOnPage} detail={formatRatio(withContactOnPage, pageTotal)} tone={withContactOnPage ? "success" : "attention"} />
          <StatCard label="Ativos" value={equipmentOnPage} detail={`${pageTotal} linha(s)`} tone={equipmentOnPage ? "info" : "neutral"} />
          <StatCard label="Atenção" value={attentionOnPage} detail="evento, queda ou ambiguidade" tone={attentionOnPage ? "attention" : "success"} />
        </div>

        <Surface className="p-2">
          <form method="GET" className="nova-filter-grid nova-filter-grid--units">
            <div className="grid gap-1.5 md:col-span-2 xl:col-span-1">
              <FieldLabel htmlFor="units-q" label="Busca" />
              <input
                id="units-q"
                name="q"
                defaultValue={q}
                placeholder="Unidade, cidade, parceiro, telefone ou serial"
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="units-partner" label="Parceiro" />
              <select
                id="units-partner"
                name="partnerId"
                defaultValue={partnerId}
              >
                <option value="">Todos</option>
                {partnerOptions.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="units-active" label="Status" />
              <select
                id="units-active"
                name="active"
                defaultValue={active}
              >
                <option value="true">Ativos</option>
                <option value="all">Todos</option>
                <option value="false">Excluídas</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="units-sort-by" label="Ordem" />
              <select
                id="units-sort-by"
                name="sortBy"
                defaultValue={sortBy}
              >
                <option value="createdAt">Cadastro</option>
                <option value="code">Código</option>
                <option value="name">Nome</option>
                <option value="city">Cidade</option>
                <option value="state">UF</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="units-page-size" label="Linhas" />
              <select
                id="units-page-size"
                name="pageSize"
                defaultValue={String(pageSize)}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <input type="hidden" name="sortDir" value={sortDir} />
            <button className="nds-button" data-variant="primary">
              Filtrar
            </button>
            <Link
              href="/unidades/nova"
              className="nds-button"
              data-variant="primary"
            >
              Nova unidade
            </Link>
          </form>
        </Surface>

        <div className="nova-inventory-grid">
          <Surface className="p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Base técnica</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Unidades cadastradas</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TonePill tone="neutral">{response.items.length} linhas</TonePill>
                <Link href="/unidades" className="nds-button" data-variant="secondary">
                  Limpar
                </Link>
              </div>
            </div>
            <div>
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Localização</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Monitoramento</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2 text-right">Ações</th></tr></TableHead><tbody>
                  {response.items.map((unit) => {
                    const monitor = monitorByUnitId.get(unit.id);
                    const legacy = legacyByUnitId[unit.id];
                    const equipmentCount = unitEquipmentCount(unit);
                    const showUnitCode = !isRedundantLabel(unit.code, unit.name);
                    const showPartnerCode = !isRedundantLabel(unit.partner.code, unit.partner.name);
                    const showMetrics = hasMonitorMetrics(monitor);

                    return (
                      <tr
                        key={unit.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/unidades/${unit.id}`}
                            className="font-medium text-white hover:text-white"
                          >
                            {unit.name}
                          </Link>
                          {showUnitCode ? (
                            <div className="mt-1 text-[10px] text-slate-500">{unit.code}</div>
                          ) : null}
                        </TableCell><TableCell><div className="text-slate-200">{locationLabel(unit)}</div>
                          {equipmentCount > 0 ? (
                            <div className="mt-1 text-[10px] text-slate-500">
                              {equipmentCount} ativo(s) vinculados
                            </div>
                          ) : null}
                        </TableCell><TableCell><div className="text-slate-200">{unit.partner.name}</div>
                          {showPartnerCode ? (
                            <div className="mt-1 text-[10px] text-slate-500">{unit.partner.code}</div>
                          ) : null}
                        </TableCell><TableCell>
                          {monitor ? (
                            <><div className="flex flex-wrap items-center gap-2"><TonePill tone={healthTone(monitor.health)}>
                                  {healthLabel(monitor.health)}
                                </TonePill>
                                {monitor.match.syncReady ? (
                                  <TonePill tone="success">sync</TonePill>
                                ) : null}
                              </div><div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">
                                {monitor.match.hostName || monitor.match.host || "Sem host confiável"}
                              </div>
                              {showMetrics ? (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  {formatMs(monitor.metrics.latencyMs)} · loss{" "}
                                  {formatPercent(monitor.metrics.lossPct)}
                                </div>
                              ) : (
                                <div className="mt-1 text-[10px] text-slate-500">sem sensores lidos</div>
                              )}
                            </>
                          ) : (
                            <TonePill tone="neutral">sem leitura</TonePill>
                          )}
                        </TableCell><TableCell><div className="max-w-[260px] text-[11px] text-slate-200">
                            {contactPhones(legacy)}
                          </div><div className="mt-2 flex flex-wrap gap-1">
                            {contextBadges(legacy).map((badge) => (
                              <TonePill key={`${unit.id}-${badge.label}`} tone={badge.tone}>
                                {badge.label}
                              </TonePill>
                            ))}
                            {!legacy?.phones.length && !contextBadges(legacy).length ? (
                              <span className="text-[10px] text-[var(--nova-text-dim)]">sem contexto legado</span>
                            ) : null}
                          </div></TableCell><TableActionCell><TableActionLink href={`/unidades/${unit.id}`}>
                            Abrir
                          </TableActionLink></TableActionCell></tr>
                    );
                  })}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhuma unidade encontrada"
              description="Ajuste os filtros ou volte para a base completa para retomar a leitura principal."
              action={
                <Link
                  href="/unidades"
                  className="nds-button"
                  data-variant="secondary"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
            </div>
          </Surface>

          <RightPanel title="Completude" description={`${averageCompletion}% médio nesta página`}>
            <ProgressLine label="Host Zabbix" value={pageTotal ? Math.round((monitoredOnPage / pageTotal) * 100) : 0} tone="success" />
            <ProgressLine label="Contato" value={pageTotal ? Math.round((withContactOnPage / pageTotal) * 100) : 0} tone="info" />
            <ProgressLine label="Ativos vinculados" value={pageTotal ? Math.round((response.items.filter((unit) => unitEquipmentCount(unit) > 0).length / pageTotal) * 100) : 0} tone="primary" />
            <ProgressLine label="Contingência" value={pageTotal ? Math.round((withBackupOnPage / pageTotal) * 100) : 0} tone="attention" />
            <ProgressLine label="Cadastro completo" value={averageCompletion} tone="success" />
            <div className="nds-card">
              <div className="nds-label">Ação rápida</div>
              <div className="mt-2 grid gap-2">
                <Link href="/sensores?view=units&health=unmapped" className="nds-button justify-between" data-variant="secondary">
                  Sem vínculo <span>{pageTotal - monitoredOnPage}</span>
                </Link>
                <Link href="/ativos" className="nds-button justify-between" data-variant="secondary">
                  Ativos <span>{equipmentOnPage}</span>
                </Link>
                <Link href="/relatorios/monitoramento" className="nds-button justify-center" data-variant="primary">
                  Gerar relatório
                </Link>
              </div>
            </div>
          </RightPanel>
        </div>

        <ListPagination pathname="/unidades" searchParams={params} meta={response.meta} />
      </div></AppShell>
  );
}
