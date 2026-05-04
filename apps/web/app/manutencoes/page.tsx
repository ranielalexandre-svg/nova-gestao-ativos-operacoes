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
  FieldLabel,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionHeader,
  TableActionLink,
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
import { formatDateTime, optionLabel } from "@/lib/formatters";
import {
  maintenanceStatusOptions as statusOptions,
  maintenanceStatusTone as statusTone,
  maintenanceTypeOptions as typeOptions,
  maintenanceTypeTone as typeTone,
} from "@/lib/status-ui";

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
    redirect("/login?next=/chamados");
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
      description: "Quando o chamado já pesa no turno, a ordem de resposta continua na fila.",
      badge: <TonePill tone="attention">prazo</TonePill>,
    },
    {
      href: "/alertas",
      title: "Alertas relacionados",
      description: "Causa, vínculo e evento originador.",
      badge: <TonePill tone="info">incidente</TonePill>,
    },
    {
      href: "/sensores?view=events",
      title: "Eventos e hosts ativos",
      description: "Cruza a agenda técnica com problemas vivos do host que representa a unidade.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <AppShell
      title="Chamados"
      subtitle="Agenda técnica, SLA, vínculo e status."
    ><RegistryHero
        eyebrow="Service Desk"
        title="Chamados operacionais"
        description="Backlog, filtros e despacho técnico."
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/operacao/fila?view=dueSoon"
              className="nds-button"
              data-variant="primary"
            >
              Abrir fila
            </Link><Link
              href="/sensores?view=events"
              className="nds-button"
              data-variant="secondary"
            >
              Ver eventos NOC
            </Link></div>
        }
      /><RegistrySummaryStrip
        items={[
          {
            label: "Chamados",
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
            label: "Com alerta",
            value: linkedToOccurrenceOnPage,
            meta: "ligadas a incidente na página",
            tone: linkedToOccurrenceOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Agenda primeiro"
        noteCopy="A tela prioriza a lista: o usuário entende o vínculo primeiro e só abre cadastro quando precisa registrar uma ação."
      /><Surface><SectionIntro
          eyebrow="Filtros"
          title="Refine agenda, vínculo e status"
          description="Busca por código, título, alerta, ativo, unidade e parceiro. Os filtros continuam persistidos na URL."
          actions={
            <Link
              href="/chamados"
              className="nds-button"
              data-variant="secondary"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="nova-filter-grid nova-filter-grid--six mt-2"><div className="grid gap-2 xl:col-span-2"><FieldLabel htmlFor="maintenance-q" label="Busca" /><input
              id="maintenance-q"
              name="q"
              defaultValue={q}
              placeholder="Código, título, alerta, unidade ou ativo"
            /></div><div className="grid gap-2"><FieldLabel htmlFor="maintenance-type" label="Tipo" /><select
              id="maintenance-type"
              name="type"
              defaultValue={type}
            ><option value="all">Todos os tipos</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select></div><div className="grid gap-2"><FieldLabel htmlFor="maintenance-status" label="Status" /><select
              id="maintenance-status"
              name="status"
              defaultValue={status}
            ><option value="all">Todos os status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select></div><div className="grid gap-2"><FieldLabel htmlFor="maintenance-sort-by" label="Ordenar por" /><select
              id="maintenance-sort-by"
              name="sortBy"
              defaultValue={sortBy}
            ><option value="createdAt">Cadastro</option><option value="code">Código</option><option value="title">Título</option><option value="type">Tipo</option><option value="status">Status</option><option value="scheduledAt">Agendada</option></select></div><div className="grid gap-2"><FieldLabel htmlFor="maintenance-sort-dir" label="Direção" /><select
              id="maintenance-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
            ><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div><div className="grid gap-2 md:col-span-2 xl:col-span-1"><FieldLabel htmlFor="maintenance-page-size" label="Página" /><select
              id="maintenance-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
            ><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select></div><button className="nds-button md:col-span-2 xl:col-span-1 xl:self-end" data-variant="primary">
            Aplicar filtros
          </button></form></Surface><div className="nova-side-grid nova-side-grid--380"><Surface><SectionIntro
            eyebrow="Agenda"
            title="Chamados cadastrados"
            description={`${response.meta.total} chamado(s) encontrados nesta visão.`}
            actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
            compact
          /><div className="mt-2">
            {response.items.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Chamado</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Vínculo</th><th className="px-3 py-2">Alerta</th><th className="px-3 py-2">Agenda</th><TableActionHeader /></tr></TableHead><tbody>
                    {response.items.map((maintenance) => (
                      <tr
                        key={maintenance.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/chamados/${maintenance.id}`}
                            className="font-medium text-white transition hover:text-white"
                          >
                            {maintenance.code}
                          </Link><div className="mt-1 max-w-[360px] truncate text-[10px] text-slate-500">
                            {maintenance.title}
                          </div></TableCell><TableCell><TonePill tone={typeTone(maintenance.type)}>
                            {optionLabel(typeOptions, maintenance.type)}
                          </TonePill></TableCell><TableCell><TonePill tone={statusTone(maintenance.status)}>
                            {optionLabel(statusOptions, maintenance.status)}
                          </TonePill></TableCell><TableCell><div className="max-w-[320px] truncate text-slate-300">
                            {maintenanceEntity(maintenance)}
                          </div>
                          {maintenance.partner ? (
                            <div className="mt-1 max-w-[320px] truncate text-[10px] text-slate-500">
                              {maintenance.partner.code} - {maintenance.partner.name}
                            </div>
                          ) : null}
                        </TableCell><TableCell className="text-slate-400">
                          {maintenance.occurrence
                            ? `${maintenance.occurrence.code} - ${maintenance.occurrence.title}`
                            : "-"}
                        </TableCell><TableCell><div className={isOverdue(maintenance) ? "text-[color:var(--nova-danger)]" : "text-slate-300"}>
                            {formatDateTime(maintenance.scheduledAt)}
                          </div>
                          {maintenance.completedAt ? (
                            <div className="mt-1 text-[10px] text-[color:var(--nova-success)]">
                              concluída em {formatDateTime(maintenance.completedAt)}
                            </div>
                          ) : null}
                        </TableCell><TableActionCell><TableActionLink href={`/chamados/${maintenance.id}`}>
                            Abrir
                          </TableActionLink></TableActionCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum chamado encontrado"
                description="Ajuste os filtros ou limpe a busca para voltar à agenda completa."
                action={
                  <Link
                    href="/chamados"
                    className="nds-button"
                    data-variant="primary"
                  >
                    Limpar filtros
                  </Link>
                }
              />
            )}
          </div></Surface><div className="nova-page-stack nova-page-list nova-page-maintenance grid gap-2"><WorkflowStatsPanel
            eyebrow="Turno"
            title="Agenda"
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
                label: "Com alerta",
                value: linkedToOccurrenceOnPage,
                tone: linkedToOccurrenceOnPage ? "attention" : "neutral",
              },
              {
                label: "Vencidas no turno",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "critical" : "neutral",
              },
              {
                label: "Alertas abertos",
                value: commandCenter.metrics.openOccurrences,
                tone: commandCenter.metrics.openOccurrences ? "info" : "neutral",
              },
            ]}
          /><ConnectedRoutesPanel
            eyebrow="Histórico"
            title="Rotas que completam a agenda"
            description="O chamado quase sempre conversa com fila, alerta e host da unidade. Essas rotas continuam o trabalho sem dispersão."
            routes={connectedRoutes}
          /><Surface><SectionIntro
              eyebrow="Foco"
              title="Critérios"
              description="Abra o detalhe quando o chamado já exigir histórico, evidência, relação com alerta ou conferência da janela técnica."
              compact
            /><div className="mt-2 grid gap-2"><ActionTile
                href="/operacao/fila?view=dueSoon"
                title="Priorizar vencimento e prazo"
                description="Se o chamado já encostou em prazo, a ordem de execução precisa sair da fila."
                badge={<TonePill tone="attention">{commandCenter.metrics.dueTodayMaintenances} hoje</TonePill>}
              /><ActionTile
                href="/alertas"
                title="Reabrir contexto do incidente"
                description="Causa, vínculo e impacto."
                badge={<TonePill tone="info">incidente</TonePill>}
              /></div></Surface></div></div><ListPagination pathname="/chamados" searchParams={params} meta={response.meta} /></AppShell>
  );
}
