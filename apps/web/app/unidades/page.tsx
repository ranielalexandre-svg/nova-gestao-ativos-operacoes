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
  hint,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatMs(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

function locationLabel(unit: Pick<UnitRow, "city" | "state">) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function unitEquipmentCount(unit: UnitRow) {
  return unit._count?.equipments ?? unit.equipments?.length ?? 0;
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

async function readMonitorSnapshots() {
  try {
    return await apiJson<UnitMonitorResponse>("/monitoring/unit-hosts");
  } catch {
    return { items: [] } satisfies UnitMonitorResponse;
  }
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
  const active = readStringParam(params, "active", "all");
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

  return (
    <AppShell
      title="Unidades"
      subtitle="Cadastro operacional de unidades com lista forte, contato visível e criação no mesmo fluxo da consulta."
    >
      <RegistryHero
        eyebrow="Unit Registry"
        title="Base operacional com contato e monitoramento na mesma leitura"
        description="A unidade continua sendo a âncora do produto. A mesa principal cruza cadastro, parceiro, contato legado e saúde do host em um só lugar."
        actions={
          <Link
            href="/unidades/nova"
            className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
          >
            Nova unidade
          </Link>
        }
      />

      <RegistrySummaryStrip
        items={[
          {
            label: "Locais",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Monitorados",
            value: monitoredOnPage,
            meta: "host confiável nesta página",
            tone: monitoredOnPage ? "success" : "neutral",
          },
          {
            label: "Com contato",
            value: withContactOnPage,
            meta: "telefone legado disponível",
            tone: withContactOnPage ? "success" : "attention",
          },
          {
            label: "Contingência",
            value: withBackupOnPage,
            meta: `${attentionOnPage} exigem atenção`,
            tone: attentionOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Tabela primeiro"
        noteCopy="O foco fica na grade operacional. A criação completa segue pelo fluxo guiado, sem atalhos concorrendo com a consulta."
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Busque base, parceiro, cidade ou contato"
          description="Use a URL para guardar o recorte. A mesa abaixo continua centrada em vínculo, contato e leitura do host."
          actions={
            <Link
              href="/unidades"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="units-q" label="Busca" />
            <input
              id="units-q"
              name="q"
              defaultValue={q}
              placeholder="Código, nome, cidade, parceiro, telefone ou serial"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="units-partner" label="Parceiro" />
            <select
              id="units-partner"
              name="partnerId"
              defaultValue={partnerId}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="">Todos os parceiros</option>
              {partnerOptions.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.code} - {partner.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="units-active" label="Status" />
            <select
              id="units-active"
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
            <FieldLabel htmlFor="units-sort-by" label="Ordenar por" />
            <select
              id="units-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="code">Código</option>
              <option value="name">Nome</option>
              <option value="city">Cidade</option>
              <option value="state">UF</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="units-page-size" label="Página" />
            <select
              id="units-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="10">10 por página</option>
              <option value="20">20 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>

          <input type="hidden" name="sortDir" value={sortDir} />

          <button className="rounded-[14px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-95 md:col-span-2 xl:col-span-6">
            Aplicar filtros
          </button>
        </form>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Base operacional"
          title="Unidades por vínculo, contato e cobertura"
          description={`${response.meta.total} unidade(s) encontradas nesta visão.`}
          actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
          compact
        />

        <div className="mt-4">
          {response.items.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Localização</th>
                    <th className="px-4 py-3">Parceiro</th>
                    <th className="px-4 py-3">Monitoramento</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </TableHead>
                <tbody>
                  {response.items.map((unit) => {
                    const monitor = monitorByUnitId.get(unit.id);
                    const legacy = legacyByUnitId[unit.id];

                    return (
                      <tr
                        key={unit.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <TableCell>
                          <Link
                            href={`/unidades/${unit.id}`}
                            className="font-medium text-white hover:text-sky-100"
                          >
                            {unit.name}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">{unit.code}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-slate-200">{locationLabel(unit)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {unitEquipmentCount(unit)} ativo(s) vinculados
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-slate-200">{unit.partner.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{unit.partner.code}</div>
                        </TableCell>
                        <TableCell>
                          {monitor ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <TonePill tone={healthTone(monitor.health)}>
                                  {healthLabel(monitor.health)}
                                </TonePill>
                                {monitor.match.syncReady ? (
                                  <TonePill tone="success">sync</TonePill>
                                ) : null}
                              </div>
                              <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                                {monitor.match.hostName || monitor.match.host || "Sem host confiável"}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatMs(monitor.metrics.latencyMs)} · loss{" "}
                                {formatPercent(monitor.metrics.lossPct)}
                              </div>
                            </>
                          ) : (
                            <TonePill tone="neutral">sem leitura</TonePill>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] text-sm text-slate-200">
                            {contactPhones(legacy)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {contextBadges(legacy).map((badge) => (
                              <TonePill key={`${unit.id}-${badge.label}`} tone={badge.tone}>
                                {badge.label}
                              </TonePill>
                            ))}
                            {!legacy?.phones.length && !contextBadges(legacy).length ? (
                              <span className="text-xs text-slate-600">sem contexto legado</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/unidades/${unit.id}`}
                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            Abrir
                          </Link>
                        </TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </DenseTable>
            </TableShell>
          ) : (
            <EmptyState
              title="Nenhuma unidade encontrada"
              description="Ajuste os filtros ou volte para a base completa para retomar a leitura principal."
              action={
                <Link
                  href="/unidades"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div>
      </Surface>

      <ListPagination pathname="/unidades" searchParams={params} meta={response.meta} />
    </AppShell>
  );
}
