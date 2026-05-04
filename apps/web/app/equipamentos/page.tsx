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
  TableActionHeader,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import {
  getLegacyEquipmentDeskForEquipments,
  type LegacyEquipmentDeskItem,
} from "@/lib/legacy-catalog";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDate } from "@/lib/formatters";
import {
  equipmentStatusLabel as statusLabel,
  equipmentStatusTone as statusTone,
} from "@/lib/status-ui";
import {
  formatMs,
  formatPercent,
  healthLabel,
  healthTone,
  readUnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UnitOption = {
  id: string;
  code: string;
  name: string;
  partner: { id: string; code: string; name: string };
  _count: { equipments: number };
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
};

type EquipmentRow = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  unit: {
    id: string;
    code: string;
    name: string;
    partner: { id: string; code: string; name: string };
  };
};

function qualityMeta(
  equipment: EquipmentRow,
  legacy?: LegacyEquipmentDeskItem,
  monitor?: UnitHostTelemetryItem,
) {
  const checks = [
    Boolean(equipment.serialNumber || legacy?.serialOrMac),
    Boolean(legacy?.matched),
    Boolean(monitor?.match.status === "matched"),
  ];
  const score = checks.filter(Boolean).length;

  if (score >= 3) {
    return {
      label: "Completo",
      detail: "serial, legado e monitoramento amarrados",
      tone: "success",
    };
  }
  if (score === 2) {
    return {
      label: "Parcial",
      detail: "há contexto suficiente, mas ainda falta amarração",
      tone: "attention",
    };
  }
  return {
    label: "Base",
    detail: "inventário válido, mas com pouca pista operacional",
    tone: "neutral",
  };
}

function formatRatio(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

async function readMonitorSnapshots() {
  return readUnitHostTelemetry({ timeoutMs: 1_200, fast: true });
}

export default async function AtivosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ativos");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const unitId = readStringParam(params, "unitId");
  const status = readStringParam(params, "status", "all");
  const active = readStringParam(params, "active", "true");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  const [unitsResponse, response, monitorResponse] = await Promise.all([
    apiJson<PaginatedResponse<UnitOption>>(
      "/units?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
    apiJson<PaginatedResponse<EquipmentRow>>(
      `/equipments${buildApiQuery({
        q,
        unitId: unitId || undefined,
        status: status !== "all" ? status : undefined,
        active: active !== "all" ? active : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
    readMonitorSnapshots(),
  ]);

  const legacyDesk = await getLegacyEquipmentDeskForEquipments(
    response.items.map((equipment) => ({
      id: equipment.id,
      tag: equipment.tag,
      name: equipment.name,
      serialNumber: equipment.serialNumber,
      unit: {
        id: equipment.unit.id,
        code: equipment.unit.code,
        name: equipment.unit.name,
      },
    })),
  );

  const unitOptions = unitsResponse.items;
  const legacyByEquipmentId = legacyDesk.items;
  const monitorByUnitId = new Map(
    monitorResponse.items.map((item) => [item.unit.id, item]),
  );
  const activeOnPage = response.items.filter((item) => item.isActive).length;
  const monitoredOnPage = response.items.filter(
    (item) => monitorByUnitId.get(item.unit.id)?.match.status === "matched",
  ).length;
  const withTraceOnPage = response.items.filter(
    (item) => item.serialNumber || legacyByEquipmentId[item.id]?.serialOrMac,
  ).length;
  const starlinkOnPage = response.items.filter(
    (item) => legacyByEquipmentId[item.id]?.starlinkCount,
  ).length;
  const attentionOnPage = response.items.filter((item) => {
    const monitor = monitorByUnitId.get(item.unit.id);
    return Boolean(
      monitor &&
        (monitor.health === "down" ||
          monitor.health === "degraded" ||
          monitor.health === "ambiguous" ||
          monitor.problems.length),
    );
  }).length;
  const pageTotal = response.items.length;

  return (
    <AppShell
      title="Ativos"
      subtitle="Inventário técnico, Starlinks e telemetria por unidade."
    ><div className="nova-assets-page grid gap-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Ativos" value={response.meta.total} detail="resultado filtrado" tone="info" />
          <StatCard label="Operando" value={activeOnPage} detail={formatRatio(activeOnPage, pageTotal)} tone={activeOnPage ? "success" : "neutral"} />
          <StatCard label="Com rastreio" value={withTraceOnPage} detail="serial, MAC ou legado" tone={withTraceOnPage ? "success" : "attention"} />
          <StatCard label="Starlinks" value={starlinkOnPage} detail="subgrupo do inventário" tone={starlinkOnPage ? "attention" : "neutral"} />
          <StatCard label="Monitorados" value={monitoredOnPage} detail={attentionOnPage ? `${attentionOnPage} em atenção` : "host da unidade"} tone={attentionOnPage ? "attention" : "success"} />
        </div>

        <Surface className="p-2">
          <form method="GET" className="nova-filter-grid nova-filter-grid--equipment">
            <div className="grid gap-1.5 md:col-span-2 xl:col-span-1">
              <FieldLabel htmlFor="equipments-q" label="Busca" />
              <input
                id="equipments-q"
                name="q"
                defaultValue={q}
                placeholder="Ativo, serial, MAC, unidade ou parceiro"
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-unit" label="Unidade" />
              <select
                id="equipments-unit"
                name="unitId"
                defaultValue={unitId}
              >
                <option value="">Todas</option>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-status" label="Status" />
              <select id="equipments-status" name="status" defaultValue={status}>
                <option value="all">Todos</option>
                <option value="active">Ativo</option>
                <option value="stock">Estoque</option>
                <option value="repair">Reparo</option>
                <option value="retired">Retirado</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-active" label="Cadastro" />
              <select id="equipments-active" name="active" defaultValue={active}>
                <option value="true">Ativos</option>
                <option value="all">Todos</option>
                <option value="false">Excluídos</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-page-size" label="Linhas" />
              <select id="equipments-page-size" name="pageSize" defaultValue={String(pageSize)}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <button className="nds-button" data-variant="primary">
              Filtrar
            </button>
            <Link href="/ativos/starlinks" className="nds-button" data-variant="secondary">
              Starlinks
            </Link>
            {isAdmin ? (
              <Link href="/ativos/nova" className="nds-button" data-variant="primary">
                Novo ativo
              </Link>
            ) : null}
          </form>
        </Surface>

        <div className="nova-inventory-grid">
          <Surface className="p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Inventário</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Base técnica</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <TonePill tone="neutral">{response.items.length} linhas</TonePill>
                <Link href="/export/equipments" className="nds-button" data-variant="secondary">
                  CSV
                </Link>
                <Link href="/ativos" className="nds-button" data-variant="secondary">
                  Limpar
                </Link>
              </div>
            </div>
            <div>
          {response.items.length ? (
            <TableShell><DenseTable className="nova-assets-table"><TableHead><tr><th className="px-3 py-2">Ativo</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Rede / origem</th><th className="px-3 py-2">Monitoramento</th><th className="px-3 py-2">Qualidade</th><TableActionHeader /></tr></TableHead><tbody>
                  {response.items.map((equipment) => (
                    (() => {
                      const legacy = legacyByEquipmentId[equipment.id];
                      const monitor = monitorByUnitId.get(equipment.unit.id);
                      const quality = qualityMeta(equipment, legacy, monitor);

                      return (
                        <tr
                          key={equipment.id}
                          className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                        ><TableCell><Link
                              href={`/ativos/${equipment.id}`}
                              className="font-medium text-white transition hover:text-white"
                            >
                              {equipment.tag}
                            </Link><div className="mt-1 max-w-[300px] truncate text-[10px] text-slate-500">
                              {equipment.name} · {equipment.type}
                            </div></TableCell><TableCell><Link
                              href={`/unidades/${equipment.unit.id}`}
                              className="font-medium text-slate-100 transition hover:text-white"
                            >
                              {equipment.unit.code}
                            </Link><div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">
                              {equipment.unit.name}
                            </div></TableCell><TableCell><div className="text-slate-200">{equipment.unit.partner.code}</div><div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">
                              {equipment.unit.partner.name}
                            </div></TableCell><TableCell><div className="text-slate-200">
                              {equipment.serialNumber || legacy?.serialOrMac || "-"}
                            </div><div className="mt-1 max-w-[280px] truncate text-[10px] text-slate-500">
                              {[legacy?.source, legacy?.starlinkCount ? `${legacy.starlinkCount} starlink` : null]
                                .filter(Boolean)
                                .join(" · ") || "sem origem legada"}
                            </div></TableCell><TableCell><div className="flex flex-wrap items-center gap-2"><TonePill
                                tone={
                                  monitor
                                    ? healthTone(monitor.health)
                                    : "subtle"
                                }
                              >
                                {monitor ? healthLabel(monitor.health) : "na unidade"}
                              </TonePill>
                              {monitor?.problems.length ? (
                                <TonePill tone="attention">
                                  {monitor.problems.length} alerta(s)
                                </TonePill>
                              ) : null}
                            </div><div className="mt-1 text-[10px] text-slate-500">
                              {monitor
                                ? `${formatMs(monitor.metrics.latencyMs)} · ${formatPercent(
                                    monitor.metrics.lossPct,
                                  )}`
                                : "use a unidade para ler telemetria"}
                            </div></TableCell><TableCell><div className="flex flex-wrap items-center gap-2"><TonePill tone={quality.tone}>{quality.label}</TonePill><TonePill tone={statusTone(equipment.status, equipment.isActive)}>
                                {statusLabel(equipment.status)}
                              </TonePill></div><div className="mt-1 max-w-[220px] truncate text-[10px] text-slate-500">
                              {quality.detail}
                            </div></TableCell><TableActionCell><TableActionLink href={`/ativos/${equipment.id}`}>
                              Abrir
                            </TableActionLink><div className="mt-2 text-[11px] text-slate-500">
                              {formatDate(equipment.createdAt)}
                            </div></TableActionCell></tr>
                      );
                    })()
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum ativo encontrado"
              description="Ajuste a busca ou limpe os filtros para voltar ao inventário completo."
              action={
                <Link
                  href="/ativos"
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

          <RightPanel title="Ciclo de vida" description="Qualidade do recorte atual">
            <ProgressLine label="Ativos operando" value={pageTotal ? Math.round((activeOnPage / pageTotal) * 100) : 0} tone="success" />
            <ProgressLine label="Rastreabilidade" value={pageTotal ? Math.round((withTraceOnPage / pageTotal) * 100) : 0} tone="info" />
            <ProgressLine label="Monitoramento" value={pageTotal ? Math.round((monitoredOnPage / pageTotal) * 100) : 0} tone="primary" />
            <ProgressLine label="Starlinks" value={pageTotal ? Math.round((starlinkOnPage / pageTotal) * 100) : 0} tone="attention" />
            <div className="nds-card">
              <div className="nds-label">Atalhos</div>
              <div className="mt-2 grid gap-2">
                <Link href="/ativos/starlinks" className="nds-button justify-between" data-variant="secondary">
                  Starlinks <span>{starlinkOnPage}</span>
                </Link>
                <Link href="/sensores?view=units" className="nds-button justify-between" data-variant="secondary">
                  Sensores <span>{monitoredOnPage}</span>
                </Link>
                <Link href="/importacao?resource=equipments" className="nds-button justify-between" data-variant="primary">
                  Importar <span>CSV</span>
                </Link>
              </div>
            </div>
          </RightPanel>
        </div>

        <ListPagination pathname="/ativos" searchParams={params} meta={response.meta} />
      </div></AppShell>
  );
}
