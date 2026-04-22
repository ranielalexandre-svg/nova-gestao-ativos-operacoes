import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  ConnectedRoutesPanel,
  WorkflowStatsPanel,
} from "@/components/ops-side-panels";
import {
  RegistryHero,
  RegistrySummaryStrip,
} from "@/components/registry-shell";
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

type OccurrenceRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  _count: { maintenances: number };
};

const severityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const statusOptions = [
  { value: "open", label: "Aberta" },
  { value: "investigating", label: "Em análise" },
  { value: "resolved", label: "Resolvida" },
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
  return options.find((option) => option.value === value)?.label || value;
}

function severityTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "subtle";
}

function statusTone(value: string) {
  if (value === "resolved") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "investigating") return "info";
  return "attention";
}

function occurrenceEntity(occurrence: OccurrenceRow) {
  if (occurrence.equipment) {
    return `${occurrence.equipment.tag} - ${occurrence.equipment.name}`;
  }

  if (occurrence.unit) {
    return `${occurrence.unit.code} - ${occurrence.unit.name}`;
  }

  if (occurrence.partner) {
    return `${occurrence.partner.code} - ${occurrence.partner.name}`;
  }

  return "Sem vínculo";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ocorrencias");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const severity = readStringParam(params, "severity", "all");
  const status = readStringParam(params, "status", "all");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const [response, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<OccurrenceRow>>(
      `/occurrences${buildApiQuery({
        q,
        severity: severity !== "all" ? severity : undefined,
        status: status !== "all" ? status : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);
  const openOnPage = response.items.filter((item) => item.status === "open").length;
  const investigatingOnPage = response.items.filter(
    (item) => item.status === "investigating",
  ).length;
  const criticalOnPage = response.items.filter(
    (item) => item.severity === "critical",
  ).length;
  const linkedOnPage = response.items.filter(
    (item) => item.partner || item.unit || item.equipment,
  ).length;
  const withMaintenanceOnPage = response.items.filter(
    (item) => item._count.maintenances > 0,
  ).length;
  const sourceOnPage = response.items.filter((item) => item.source).length;

  const connectedRoutes = [
    {
      href: "/operacao/fila",
      title: "Fila operacional",
      description: "Triagem e despacho continuam acontecendo na mesa do turno.",
      badge: <TonePill tone="info">core</TonePill>,
    },
    {
      href: "/monitoramento?view=events",
      title: "Monitoramento por eventos",
      description: "Cruza ocorrências internas com problemas ativos dos hosts das unidades.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
    {
      href: "/manutencoes",
      title: "Manutenções vinculadas",
      description: "Abra a agenda técnica quando a ocorrência já exigir ação planejada ou corretiva.",
      badge: <TonePill tone="success">agenda</TonePill>,
    },
  ];

  return (
    <AppShell
      title="Ocorrências"
      subtitle="Consulta operacional de incidentes e eventos de campo."
    >
      <RegistryHero
        eyebrow="Incident Desk"
        title="Incidentes em leitura direta, sem ruído paralelo"
        description="A tela fica centrada na consulta e no vínculo operacional. Você encontra, abre e entende o impacto sem competir com blocos secundários."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/operacao/fila?view=pending"
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
            label: "Ocorrências",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "attention",
          },
          {
            label: "Abertas",
            value: openOnPage,
            meta: "nesta página",
            tone: openOnPage ? "attention" : "neutral",
          },
          {
            label: "Críticas",
            value: criticalOnPage,
            meta: "maior impacto no turno",
            tone: criticalOnPage ? "critical" : "neutral",
          },
          {
            label: "Em análise",
            value: investigatingOnPage,
            meta: "triagem em andamento",
            tone: investigatingOnPage ? "info" : "neutral",
          },
          {
            label: "Com manutenção",
            value: withMaintenanceOnPage,
            meta: `${linkedOnPage} com vínculo operacional`,
            tone: withMaintenanceOnPage ? "success" : "neutral",
          },
        ]}
        noteTitle="Consulta primeiro"
        noteCopy="A superfície principal continua sendo a grade. O trabalho aqui é localizar rápido, abrir a ficha certa e seguir para a unidade, ativo ou manutenção relacionada."
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Refine severidade, status e vínculo"
          description="Busca por código, título, origem e entidade relacionada. Os filtros continuam persistidos na URL."
          actions={
            <Link
              href="/ocorrencias"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="occurrence-q" label="Busca" />
            <input
              id="occurrence-q"
              name="q"
              defaultValue={q}
              placeholder="Código, título, origem ou equipamento"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="occurrence-severity" label="Severidade" />
            <select
              id="occurrence-severity"
              name="severity"
              defaultValue={severity}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todas</option>
              {severityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="occurrence-status" label="Status" />
            <select
              id="occurrence-status"
              name="status"
              defaultValue={status}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="occurrence-sort-by" label="Ordenar por" />
            <select
              id="occurrence-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="code">Código</option>
              <option value="title">Título</option>
              <option value="severity">Severidade</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="occurrence-sort-dir" label="Direção" />
            <select
              id="occurrence-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2 xl:col-span-2">
            <FieldLabel htmlFor="occurrence-page-size" label="Página" />
            <select
              id="occurrence-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="10">10 por página</option>
              <option value="20">20 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>

          <button className="rounded-[14px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-95 md:col-span-2 xl:col-span-4">
            Aplicar filtros
          </button>
        </form>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Incidentes"
            title="Ocorrências cadastradas"
            description={`${response.meta.total} ocorrência(s) encontradas nesta visão.`}
            actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
            compact
          />

          <div className="mt-4">
            {response.items.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3">Ocorrência</th>
                      <th className="px-4 py-3">Severidade</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Vínculo</th>
                      <th className="px-4 py-3">Manut.</th>
                      <th className="px-4 py-3">Atualização</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {response.items.map((occurrence) => (
                      <tr
                        key={occurrence.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <TableCell>
                          <Link
                            href={`/ocorrencias/${occurrence.id}`}
                            className="font-medium text-white transition hover:text-sky-200"
                          >
                            {occurrence.code}
                          </Link>
                          <div className="mt-1 max-w-[420px] truncate text-xs text-slate-500">
                            {occurrence.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={severityTone(occurrence.severity)}>
                            {optionLabel(severityOptions, occurrence.severity)}
                          </TonePill>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={statusTone(occurrence.status)}>
                            {optionLabel(statusOptions, occurrence.status)}
                          </TonePill>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          <div className="max-w-[320px] truncate">
                            {occurrenceEntity(occurrence)}
                          </div>
                          {occurrence.source ? (
                            <div className="mt-1 max-w-[320px] truncate text-xs text-slate-600">
                              {occurrence.source}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {occurrence._count.maintenances}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDate(occurrence.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/ocorrencias/${occurrence.id}`}
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
                title="Nenhuma ocorrência encontrada"
                description="Ajuste a busca ou limpe os filtros para voltar à base completa."
                action={
                  <Link
                    href="/ocorrencias"
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
            title="Leitura rápida da mesa"
            description="Sinais suficientes para decidir se a próxima ação está na própria ocorrência, na manutenção ou no monitoramento."
            stats={[
              {
                label: "Abertas na página",
                value: openOnPage,
                tone: openOnPage ? "attention" : "neutral",
              },
              {
                label: "Críticas na página",
                value: criticalOnPage,
                tone: criticalOnPage ? "critical" : "neutral",
              },
              {
                label: "Com manutenção",
                value: withMaintenanceOnPage,
                tone: withMaintenanceOnPage ? "success" : "neutral",
              },
              {
                label: "Com origem definida",
                value: sourceOnPage,
                tone: sourceOnPage ? "info" : "neutral",
              },
              {
                label: "Críticas no turno",
                value: commandCenter.metrics.criticalOpenOccurrences,
                tone: commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral",
              },
              {
                label: "Manutenções vencidas",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "attention" : "neutral",
              },
            ]}
          />

          <ConnectedRoutesPanel
            eyebrow="Trilha"
            title="Rotas que continuam o trabalho"
            description="Essas rotas realmente completam a investigação e o despacho. Não são navegação decorativa."
            routes={connectedRoutes}
          />

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Foco"
              title="Quando abrir a ficha"
              description="Abra o detalhe quando a ocorrência já pedir contexto de unidade, equipamento, manutenção ou origem técnica."
              compact
            />

            <div className="mt-4 grid gap-3">
              <ActionTile
                href="/operacao/fila?view=breached"
                title="Priorizar casos vencidos"
                description="Quando a ocorrência já virou SLA ou ameaça de vencimento, a fila operacional dita a ordem."
                badge={<TonePill tone="critical">{commandCenter.metrics.criticalOpenOccurrences} críticas</TonePill>}
              />
              <ActionTile
                href="/monitoramento?health=problem"
                title="Cruzar com host e problema ativo"
                description="Se a ocorrência depende de estado real da unidade, a leitura dos hosts reduz dúvida antes do acionamento."
                badge={<TonePill tone="attention">host</TonePill>}
              />
            </div>
          </Surface>
        </div>
      </div>

      <ListPagination pathname="/ocorrencias" searchParams={params} meta={response.meta} />
    </AppShell>
  );
}
