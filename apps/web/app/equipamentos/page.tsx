import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  RegistryHero,
  RegistrySummaryStrip,
} from "@/components/registry-shell";
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
  const active = readStringParam(params, "active", "all");
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

  return (
    <AppShell
      title="Equipamentos"
      subtitle="Inventário operacional com vínculo, rede e telemetria lidos na mesma mesa."
    >
      <RegistryHero
        eyebrow="Asset Registry"
        title="Base técnica com vínculo e telemetria"
        description="Inventário em leitura densa: unidade, parceiro, rastreabilidade e indício de monitoramento visíveis na mesma linha."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/equipamentos/starlinks"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
            >
              Ver Starlinks
            </Link>
            <Link
              href="/export/equipments"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
            >
              Exportar CSV
            </Link>
            {isAdmin ? (
            <Link
              href="/equipamentos/nova"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
            >
              Novo equipamento
            </Link>
            ) : null}
          </div>
        }
      />

      <RegistrySummaryStrip
        items={[
          {
            label: "Equipamentos",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Ativos",
            value: activeOnPage,
            meta: "nesta página",
            tone: activeOnPage ? "success" : "neutral",
          },
          {
            label: "Com rastreio",
            value: withTraceOnPage,
            meta: "serial ou pista legada disponível",
            tone: withTraceOnPage ? "success" : "attention",
          },
          {
            label: "Monitoramento",
            value: monitoredOnPage,
            meta: attentionOnPage
              ? `${attentionOnPage} em atenção no host da unidade`
              : `${starlinkOnPage} com origem Starlink`,
            tone: attentionOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Tabela primeiro"
        noteCopy="O ativo não precisa abrir outra tela para fazer sentido. Unidade, parceiro, serial, origem e pulso do host ficam juntos para reduzir clique de triagem."
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Refine vínculo, rede e recorte"
          description="Busca por tag, nome, tipo, serial, unidade e parceiro. O objetivo aqui é chegar rápido ao ativo certo sem perder o contexto da unidade."
          actions={
            <Link
              href="/equipamentos"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="equipments-q" label="Busca" />
            <input
              id="equipments-q"
              name="q"
              defaultValue={q}
              placeholder="Tag, serial, MAC salvo, unidade ou parceiro"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="equipments-unit" label="Unidade" />
            <select
              id="equipments-unit"
              name="unitId"
              defaultValue={unitId}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="">Todas as unidades</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="equipments-status" label="Status" />
            <select
              id="equipments-status"
              name="status"
              defaultValue={status}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="stock">Estoque</option>
              <option value="repair">Reparo</option>
              <option value="retired">Retirado</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="equipments-active" label="Cadastro" />
            <select
              id="equipments-active"
              name="active"
              defaultValue={active}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="equipments-sort" label="Ordenar por" />
            <select
              id="equipments-sort"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="tag">Tag</option>
              <option value="name">Nome</option>
              <option value="type">Tipo</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="equipments-dir" label="Direção" />
            <select
              id="equipments-dir"
              name="sortDir"
              defaultValue={sortDir}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="grid gap-2 md:col-span-1 xl:col-span-2">
            <FieldLabel htmlFor="equipments-page-size" label="Página" />
            <select
              id="equipments-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="10">10 por página</option>
              <option value="20">20 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>

          <button className="rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-95 md:col-span-1 xl:col-span-4 xl:self-end">
            Aplicar filtros
          </button>
        </form>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Asset Registry"
          title="Base técnica"
          description={`${response.meta.total} equipamento(s) encontrados nesta visão.`}
          actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
          compact
        />

        <div className="mt-5">
          {response.items.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Equipamento</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Parceiro</th>
                    <th className="px-4 py-3">Rede / origem</th>
                    <th className="px-4 py-3">Monitoramento</th>
                    <th className="px-4 py-3">Qualidade</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </TableHead>
                <tbody>
                  {response.items.map((equipment) => (
                    (() => {
                      const legacy = legacyByEquipmentId[equipment.id];
                      const monitor = monitorByUnitId.get(equipment.unit.id);
                      const quality = qualityMeta(equipment, legacy, monitor);

                      return (
                        <tr
                          key={equipment.id}
                          className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                        >
                          <TableCell>
                            <Link
                              href={`/equipamentos/${equipment.id}`}
                              className="font-medium text-white transition hover:text-sky-100"
                            >
                              {equipment.tag}
                            </Link>
                            <div className="mt-1 max-w-[300px] truncate text-xs text-slate-500">
                              {equipment.name} · {equipment.type}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/unidades/${equipment.unit.id}`}
                              className="font-medium text-slate-100 transition hover:text-sky-100"
                            >
                              {equipment.unit.code}
                            </Link>
                            <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                              {equipment.unit.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-slate-200">{equipment.unit.partner.code}</div>
                            <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                              {equipment.unit.partner.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-slate-200">
                              {equipment.serialNumber || legacy?.serialOrMac || "-"}
                            </div>
                            <div className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
                              {[legacy?.source, legacy?.starlinkCount ? `${legacy.starlinkCount} starlink` : null]
                                .filter(Boolean)
                                .join(" · ") || "sem origem legada"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <TonePill
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
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {monitor
                                ? `${formatMs(monitor.metrics.latencyMs)} · ${formatPercent(
                                    monitor.metrics.lossPct,
                                  )}`
                                : "use a unidade para ler telemetria"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <TonePill tone={quality.tone}>{quality.label}</TonePill>
                              <TonePill tone={statusTone(equipment.status, equipment.isActive)}>
                                {statusLabel(equipment.status)}
                              </TonePill>
                            </div>
                            <div className="mt-1 max-w-[280px] text-xs text-slate-500">
                              {quality.detail}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/equipamentos/${equipment.id}`}
                              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              Abrir ativo
                            </Link>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {formatDate(equipment.createdAt)}
                            </div>
                          </TableCell>
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </DenseTable>
            </TableShell>
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

      <ListPagination pathname="/equipamentos" searchParams={params} meta={response.meta} />
    </AppShell>
  );
}
