import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
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

type UnitMonitorSnapshot = {
  unit: { id: string };
  match: {
    status: "matched" | "ambiguous" | "unmatched";
    confidence: number;
    host?: string;
    hostName?: string;
    syncReady: boolean;
  };
  health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
  metrics: {
    ping: { ok: boolean | null } | null;
    lossPct: number | null;
    latencyMs: number | null;
    temperatureC: number | null;
  };
  problems: Array<{ eventid: string; name: string; severity: string }>;
};

type UnitMonitorResponse = {
  items: UnitMonitorSnapshot[];
};

function FieldLabel({
  htmlFor,
  label,
}: {
  htmlFor: string;
  label: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
    >
      {label}
    </label>
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "ativo",
    stock: "estoque",
    repair: "reparo",
    retired: "retirado",
  };

  return labels[value] || value || "sem status";
}

function statusTone(value: string, isActive: boolean) {
  if (!isActive || value === "retired") return "subtle";
  if (value === "repair") return "attention";
  if (value === "active") return "success";
  return "neutral";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatMs(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function healthLabel(value: UnitMonitorSnapshot["health"]) {
  const labels: Record<UnitMonitorSnapshot["health"], string> = {
    online: "online",
    degraded: "atenção",
    down: "offline",
    unmapped: "sem host",
    unknown: "sem item",
    ambiguous: "ambíguo",
  };
  return labels[value];
}

function healthTone(value: UnitMonitorSnapshot["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  return "neutral";
}

function qualityMeta(
  equipment: EquipmentRow,
  legacy?: LegacyEquipmentDeskItem,
  monitor?: UnitMonitorSnapshot,
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

function ProgressLine({
  label,
  value,
  tone = "bg-orange-500",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-black text-white">{safeValue}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

async function readMonitorSnapshots() {
  try {
    return await apiJson<UnitMonitorResponse>("/monitoring/unit-hosts");
  } catch {
    return { items: [] } satisfies UnitMonitorResponse;
  }
}

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/equipamentos");
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
    ><div className="nova-assets-page grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Ativos" value={response.meta.total} detail="resultado filtrado" tone="info" />
          <StatCard label="Operando" value={activeOnPage} detail={formatRatio(activeOnPage, pageTotal)} tone={activeOnPage ? "success" : "neutral"} />
          <StatCard label="Com rastreio" value={withTraceOnPage} detail="serial, MAC ou legado" tone={withTraceOnPage ? "success" : "attention"} />
          <StatCard label="Starlinks" value={starlinkOnPage} detail="subgrupo do inventário" tone={starlinkOnPage ? "attention" : "neutral"} />
          <StatCard label="Monitorados" value={monitoredOnPage} detail={attentionOnPage ? `${attentionOnPage} em atenção` : "host da unidade"} tone={attentionOnPage ? "attention" : "success"} />
        </div>

        <Surface className="p-3">
          <form method="GET" className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_210px_120px_120px_120px_auto_auto_auto] xl:items-end">
            <div className="grid gap-1.5 md:col-span-2 xl:col-span-1">
              <FieldLabel htmlFor="equipments-q" label="Busca" />
              <input
                id="equipments-q"
                name="q"
                defaultValue={q}
                placeholder="Ativo, serial, MAC, unidade ou parceiro"
                className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-unit" label="Unidade" />
              <select
                id="equipments-unit"
                name="unitId"
                defaultValue={unitId}
                className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
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
              <select id="equipments-status" name="status" defaultValue={status} className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40">
                <option value="all">Todos</option>
                <option value="active">Ativo</option>
                <option value="stock">Estoque</option>
                <option value="repair">Reparo</option>
                <option value="retired">Retirado</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-active" label="Cadastro" />
              <select id="equipments-active" name="active" defaultValue={active} className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40">
                <option value="true">Ativos</option>
                <option value="all">Todos</option>
                <option value="false">Excluídos</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="equipments-page-size" label="Linhas" />
              <select id="equipments-page-size" name="pageSize" defaultValue={String(pageSize)} className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <button className="nova-primary-action inline-flex items-center justify-center px-4 py-3 text-sm font-black">
              Filtrar
            </button>
            <Link href="/equipamentos/starlinks" className="inline-flex items-center justify-center border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/[0.07]">
              Starlinks
            </Link>
            {isAdmin ? (
              <Link href="/equipamentos/nova" className="nova-primary-action inline-flex items-center justify-center px-4 py-3 text-sm font-black">
                Novo ativo
              </Link>
            ) : (
              <Link href="/export/equipments" className="inline-flex items-center justify-center border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/[0.07]">
                Exportar
              </Link>
            )}
          </form>
        </Surface>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_292px]">
          <Surface className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Inventário</div>
                <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-white">Base técnica</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <TonePill tone="neutral">{response.items.length} linhas</TonePill>
                <Link href="/export/equipments" className="inline-flex items-center justify-center border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.07]">
                  CSV
                </Link>
                <Link href="/equipamentos" className="inline-flex items-center justify-center border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.07]">
                  Limpar
                </Link>
              </div>
            </div>
            <div>
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Equipamento</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Rede / origem</th><th className="px-4 py-3">Monitoramento</th><th className="px-4 py-3">Qualidade</th><TableActionHeader /></tr></TableHead><tbody>
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
                              href={`/equipamentos/${equipment.id}`}
                              className="font-medium text-white transition hover:text-sky-100"
                            >
                              {equipment.tag}
                            </Link><div className="mt-1 max-w-[300px] truncate text-xs text-slate-500">
                              {equipment.name} · {equipment.type}
                            </div></TableCell><TableCell><Link
                              href={`/unidades/${equipment.unit.id}`}
                              className="font-medium text-slate-100 transition hover:text-sky-100"
                            >
                              {equipment.unit.code}
                            </Link><div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                              {equipment.unit.name}
                            </div></TableCell><TableCell><div className="text-slate-200">{equipment.unit.partner.code}</div><div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                              {equipment.unit.partner.name}
                            </div></TableCell><TableCell><div className="text-slate-200">
                              {equipment.serialNumber || legacy?.serialOrMac || "-"}
                            </div><div className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
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
                            </div><div className="mt-1 text-xs text-slate-500">
                              {monitor
                                ? `${formatMs(monitor.metrics.latencyMs)} · ${formatPercent(
                                    monitor.metrics.lossPct,
                                  )}`
                                : "use a unidade para ler telemetria"}
                            </div></TableCell><TableCell><div className="flex flex-wrap items-center gap-2"><TonePill tone={quality.tone}>{quality.label}</TonePill><TonePill tone={statusTone(equipment.status, equipment.isActive)}>
                                {statusLabel(equipment.status)}
                              </TonePill></div><div className="mt-1 max-w-[280px] text-xs text-slate-500">
                              {quality.detail}
                            </div></TableCell><TableActionCell><TableActionLink href={`/equipamentos/${equipment.id}`}>
                              Abrir ativo
                            </TableActionLink><div className="mt-2 text-[11px] text-slate-500">
                              {formatDate(equipment.createdAt)}
                            </div></TableActionCell></tr>
                      );
                    })()
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum equipamento encontrado"
              description="Ajuste a busca ou limpe os filtros para voltar ao inventário completo."
              action={
                <Link
                  href="/equipamentos"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
            </div>
          </Surface>

          <RightPanel title="Ciclo de vida" description="Qualidade do recorte atual">
            <ProgressLine label="Ativos operando" value={pageTotal ? Math.round((activeOnPage / pageTotal) * 100) : 0} tone="bg-emerald-400" />
            <ProgressLine label="Rastreabilidade" value={pageTotal ? Math.round((withTraceOnPage / pageTotal) * 100) : 0} tone="bg-sky-400" />
            <ProgressLine label="Monitoramento" value={pageTotal ? Math.round((monitoredOnPage / pageTotal) * 100) : 0} tone="bg-orange-500" />
            <ProgressLine label="Starlinks" value={pageTotal ? Math.round((starlinkOnPage / pageTotal) * 100) : 0} tone="bg-amber-400" />
            <div className="rounded-md border border-white/[0.08] bg-[#070b10] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Atalhos</div>
              <div className="mt-3 grid gap-2">
                <Link href="/equipamentos/starlinks" className="inline-flex items-center justify-between rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.07]">
                  Starlinks <span>{starlinkOnPage}</span>
                </Link>
                <Link href="/monitoramento?view=units" className="inline-flex items-center justify-between rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.07]">
                  Sensores <span>{monitoredOnPage}</span>
                </Link>
                <Link href="/operacao/importacao?resource=equipments" className="inline-flex items-center justify-between rounded-md border border-orange-400/35 bg-orange-500/[0.12] px-3 py-2 text-xs font-bold text-orange-100 hover:bg-orange-500/[0.18]">
                  Importar <span>abrir</span>
                </Link>
              </div>
            </div>
          </RightPanel>
        </div>

        <ListPagination pathname="/equipamentos" searchParams={params} meta={response.meta} />
      </div></AppShell>
  );
}
