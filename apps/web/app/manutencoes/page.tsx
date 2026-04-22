import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  ConnectedRoutesPanel,
  WorkflowStatsPanel,
} from "@/components/ops-side-panels";
import {
  ActionTile,
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
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession } from "@/lib/web-session";
import {
  emptyCommandCenter,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";

type PartnerOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

type EquipmentOption = {
  id: string;
  tag: string;
  name: string;
};

type OccurrenceOption = {
  id: string;
  code: string;
  title: string;
};

type MaintenanceRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  occurrence: OccurrenceOption | null;
};

const typeOptions = [
  { value: "preventive", label: "Preventiva" },
  { value: "corrective", label: "Corretiva" },
  { value: "inspection", label: "Inspeção" },
];

const statusOptions = [
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em execução" },
  { value: "done", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

function FieldLabel({
  htmlFor,
  label,
}: {
  htmlFor: string;
  label: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
      {label}
    </label>
  );
}

function optionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function typeTone(value: string) {
  if (value === "corrective") return "attention";
  if (value === "inspection") return "info";
  return "success";
}

function statusTone(value: string) {
  if (value === "done") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "in_progress") return "info";
  return "attention";
}

function maintenanceEntity(maintenance: MaintenanceRow) {
  if (maintenance.equipment) {
    return `${maintenance.equipment.tag} - ${maintenance.equipment.name}`;
  }

  if (maintenance.unit) {
    return `${maintenance.unit.code} - ${maintenance.unit.name}`;
  }

  if (maintenance.partner) {
    return `${maintenance.partner.code} - ${maintenance.partner.name}`;
  }

  return "Sem vínculo";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(maintenance: MaintenanceRow) {
  if (!maintenance.scheduledAt) return false;
  if (["done", "cancelled"].includes(maintenance.status)) return false;
  return new Date(maintenance.scheduledAt).getTime() < Date.now();
}

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/manutencoes");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const type = readStringParam(params, "type", "all");
  const status = readStringParam(params, "status", "all");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const [response, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<MaintenanceRow>>(
      `/maintenances${buildApiQuery({
        q,
        type: type !== "all" ? type : undefined,
        status: status !== "all" ? status : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);
  const plannedOnPage = response.items.filter((item) => item.status === "planned").length;
  const runningOnPage = response.items.filter((item) => item.status === "in_progress").length;
  const overdueOnPage = response.items.filter(isOverdue).length;
  const scheduledOnPage = response.items.filter((item) => Boolean(item.scheduledAt)).length;
  const linkedToOccurrenceOnPage = response.items.filter((item) => Boolean(item.occurrence)).length;

  const connectedRoutes = [
    {
      href: "/operacao/fila?view=dueSoon",
      title: "Fila com prazo e vencimento",
      description: "Quando a manutenção já pesa no turno, a ordem de resposta continua na fila.",
      badge: <TonePill tone="attention">prazo</TonePill>,
    },
    {
      href: "/ocorrencias",
      title: "Ocorrências relacionadas",
      description: "Use a mesa de incidentes quando a manutenção ainda depende de causa, vínculo ou evento originador.",
      badge: <TonePill tone="info">incidente</TonePill>,
    },
    {
      href: "/monitoramento?view=events",
      title: "Eventos e hosts ativos",
      description: "Cruza a agenda técnica com problemas vivos do host que representa a unidade.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <AppShell
      title="Manutenções"
      subtitle="Agenda técnica com vínculo, status e janela de execução em uma leitura compacta."
    >
      <RegistryHero
        eyebrow="Maintenance Desk"
        title="Planejamento operacional sem poluir a mesa"
        description="A listagem fica como superfície principal. O cadastro entra como bloco administrativo da mesma tela, sem competir com a agenda e os filtros."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/operacao/fila?view=dueSoon"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
            >
              Abrir fila
            </Link>
            <Link
              href="/monitoramento?view=events"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Ver eventos NOC
            </Link>
          </div>
        }
      />

      <RegistrySummaryStrip
        items={[
          {
            label: "Manutenções",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Planejadas",
            value: plannedOnPage,
            meta: "nesta página",
            tone: plannedOnPage ? "attention" : "neutral",
          },
          {
            label: "Em execução",
            value: runningOnPage,
            meta: "ações abertas",
            tone: runningOnPage ? "info" : "neutral",
          },
          {
            label: "Vencidas",
            value: overdueOnPage,
            meta: `${scheduledOnPage} com data agendada`,
            tone: overdueOnPage ? "critical" : "success",
          },
          {
            label: "Com ocorrência",
            value: linkedToOccurrenceOnPage,
            meta: "ligadas a incidente na página",
            tone: linkedToOccurrenceOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Agenda primeiro"
        noteCopy="A tela prioriza a lista: o usuário entende o vínculo primeiro e só abre cadastro quando precisa registrar uma ação."
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Refine agenda, vínculo e status"
          description="Busca por código, título, ocorrência, equipamento, unidade e parceiro. Os filtros continuam persistidos na URL."
          actions={
            <Link
              href="/manutencoes"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="maintenance-q" label="Busca" />
            <input
              id="maintenance-q"
              name="q"
              defaultValue={q}
              placeholder="Código, título, ocorrência, unidade ou equipamento"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="maintenance-type" label="Tipo" />
            <select
              id="maintenance-type"
              name="type"
              defaultValue={type}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos os tipos</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="maintenance-status" label="Status" />
            <select
              id="maintenance-status"
              name="status"
              defaultValue={status}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos os status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="maintenance-sort-by" label="Ordenar por" />
            <select
              id="maintenance-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="code">Código</option>
              <option value="title">Título</option>
              <option value="type">Tipo</option>
              <option value="status">Status</option>
              <option value="scheduledAt">Agendada</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="maintenance-sort-dir" label="Direção" />
            <select
              id="maintenance-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2 xl:col-span-2">
            <FieldLabel htmlFor="maintenance-page-size" label="Página" />
            <select
              id="maintenance-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="10">10 por página</option>
              <option value="20">20 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>

          <button className="rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-95 md:col-span-2 xl:col-span-4">
            Aplicar filtros
          </button>
        </form>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Agenda"
            title="Manutenções cadastradas"
            description={`${response.meta.total} manutenção(ões) encontradas nesta visão.`}
            actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
            compact
          />

          <div className="mt-5">
            {response.items.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3">Manutenção</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Vínculo</th>
                      <th className="px-4 py-3">Ocorrência</th>
                      <th className="px-4 py-3">Agenda</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {response.items.map((maintenance) => (
                      <tr
                        key={maintenance.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <TableCell>
                          <Link
                            href={`/manutencoes/${maintenance.id}`}
                            className="font-medium text-white transition hover:text-sky-200"
                          >
                            {maintenance.code}
                          </Link>
                          <div className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                            {maintenance.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={typeTone(maintenance.type)}>
                            {optionLabel(typeOptions, maintenance.type)}
                          </TonePill>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={statusTone(maintenance.status)}>
                            {optionLabel(statusOptions, maintenance.status)}
                          </TonePill>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[320px] truncate text-slate-300">
                            {maintenanceEntity(maintenance)}
                          </div>
                          {maintenance.partner ? (
                            <div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                              {maintenance.partner.code} - {maintenance.partner.name}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {maintenance.occurrence
                            ? `${maintenance.occurrence.code} - ${maintenance.occurrence.title}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className={isOverdue(maintenance) ? "text-rose-200" : "text-slate-300"}>
                            {formatDateTime(maintenance.scheduledAt)}
                          </div>
                          {maintenance.completedAt ? (
                            <div className="mt-1 text-xs text-emerald-200">
                              concluída em {formatDateTime(maintenance.completedAt)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/manutencoes/${maintenance.id}`}
                            className="inline-flex rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/18 hover:bg-white/[0.08]"
                          >
                            Abrir
                          </Link>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Nenhuma manutenção encontrada"
                description="Ajuste os filtros ou limpe a busca para voltar à agenda completa."
                action={
                  <Link
                    href="/manutencoes"
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Limpar filtros
                  </Link>
                }
              />
            )}
          </div>
        </Surface>

        <div className="grid gap-5">
          <WorkflowStatsPanel
            eyebrow="Turno"
            title="Leitura rápida da agenda"
            description="Esses números ajudam a decidir se a próxima ação é executar, reagendar, concluir ou voltar ao incidente de origem."
            stats={[
              {
                label: "Planejadas na página",
                value: plannedOnPage,
                tone: plannedOnPage ? "attention" : "neutral",
              },
              {
                label: "Em execução",
                value: runningOnPage,
                tone: runningOnPage ? "info" : "neutral",
              },
              {
                label: "Vencidas na página",
                value: overdueOnPage,
                tone: overdueOnPage ? "critical" : "neutral",
              },
              {
                label: "Com ocorrência",
                value: linkedToOccurrenceOnPage,
                tone: linkedToOccurrenceOnPage ? "attention" : "neutral",
              },
              {
                label: "Vencidas no turno",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "critical" : "neutral",
              },
              {
                label: "Ocorrências abertas",
                value: commandCenter.metrics.openOccurrences,
                tone: commandCenter.metrics.openOccurrences ? "info" : "neutral",
              },
            ]}
          />

          <ConnectedRoutesPanel
            eyebrow="Trilha"
            title="Rotas que completam a agenda"
            description="A manutenção quase sempre conversa com fila, ocorrência e host da unidade. Essas rotas continuam o trabalho sem dispersão."
            routes={connectedRoutes}
          />

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Foco"
              title="Quando abrir a ficha"
              description="Abra o detalhe quando a manutenção já exigir histórico, evidência, relação com ocorrência ou conferência da janela técnica."
              compact
            />

            <div className="mt-4 grid gap-3">
              <ActionTile
                href="/operacao/fila?view=dueSoon"
                title="Priorizar vencimento e prazo"
                description="Se a manutenção já encostou em prazo, a ordem de execução precisa sair da fila."
                badge={<TonePill tone="attention">{commandCenter.metrics.dueTodayMaintenances} hoje</TonePill>}
              />
              <ActionTile
                href="/ocorrencias"
                title="Reabrir contexto do incidente"
                description="Quando a ação técnica ainda depende de causa, vínculo ou impacto, volte pela mesa de ocorrências."
                badge={<TonePill tone="info">incidente</TonePill>}
              />
            </div>
          </Surface>
        </div>
      </div>

      <ListPagination pathname="/manutencoes" searchParams={params} meta={response.meta} />
    </AppShell>
  );
}
