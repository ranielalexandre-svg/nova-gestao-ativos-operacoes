import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  RightPanel,
  StatCard,
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
import { formatDate, optionLabel } from "@/lib/formatters";
import {
  occurrenceSeverityOptions as severityOptions,
  occurrenceSeverityTone as severityTone,
  occurrenceStatusOptions as statusOptions,
  occurrenceStatusTone as statusTone,
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

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/alertas");
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
  const kanban = [
    {
      title: "Novo",
      items: response.items.filter((item) => item.status === "open"),
    },
    {
      title: "Triagem",
      items: response.items.filter((item) => item.status === "investigating"),
    },
    {
      title: "Em atendimento",
      items: response.items.filter(
        (item) => item._count.maintenances > 0 && item.status !== "resolved",
      ),
    },
    {
      title: "Resolvido",
      items: response.items.filter((item) => item.status === "resolved"),
    },
  ];

  return (
    <AppShell
      title="Alertas"
      subtitle="Kanban de incidentes, filtros e tabela operacional."
    >
      <section className="grid gap-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Alertas"
            value={response.meta.total}
            detail="resultado filtrado"
            tone="attention"
          />
          <StatCard
            label="Novos"
            value={openOnPage}
            detail="aguardando triagem"
            tone={openOnPage ? "attention" : "neutral"}
          />
          <StatCard
            label="Críticos"
            value={criticalOnPage}
            detail="maior impacto"
            tone={criticalOnPage ? "critical" : "success"}
          />
          <StatCard
            label="Em análise"
            value={investigatingOnPage}
            detail="triagem em curso"
            tone={investigatingOnPage ? "info" : "neutral"}
          />
          <StatCard
            label="Com chamado"
            value={withMaintenanceOnPage}
            detail={`${linkedOnPage} vinculados`}
            tone={withMaintenanceOnPage ? "success" : "neutral"}
          />
        </div>

        <Surface>
          <form
            method="GET"
            className="nova-filter-grid nova-filter-grid--occurrences"
          >
            <label
              className="grid gap-1.5 md:col-span-2 xl:col-span-1"
              htmlFor="occurrence-q"
            >
              <FieldLabel htmlFor="occurrence-q" label="Busca" />
              <input
                id="occurrence-q"
                name="q"
                defaultValue={q}
                placeholder="Código, título, origem ou ativo"
              />
            </label>
            <label className="grid gap-1.5" htmlFor="occurrence-severity">
              <FieldLabel htmlFor="occurrence-severity" label="Severidade" />
              <select
                id="occurrence-severity"
                name="severity"
                defaultValue={severity}
              >
                <option value="all">Todas</option>
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5" htmlFor="occurrence-status">
              <FieldLabel htmlFor="occurrence-status" label="Status" />
              <select id="occurrence-status" name="status" defaultValue={status}>
                <option value="all">Todos</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5" htmlFor="occurrence-sort-by">
              <FieldLabel htmlFor="occurrence-sort-by" label="Ordem" />
              <select id="occurrence-sort-by" name="sortBy" defaultValue={sortBy}>
                <option value="createdAt">Cadastro</option>
                <option value="code">Código</option>
                <option value="title">Título</option>
                <option value="severity">Severidade</option>
                <option value="status">Status</option>
              </select>
            </label>
            <label className="grid gap-1.5" htmlFor="occurrence-page-size">
              <FieldLabel htmlFor="occurrence-page-size" label="Linhas" />
              <select
                id="occurrence-page-size"
                name="pageSize"
                defaultValue={String(pageSize)}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
            <input type="hidden" name="sortDir" value={sortDir} />
            <button className="nds-button" data-variant="primary">
              Filtrar
            </button>
            <Link href="/alertas" className="nds-button" data-variant="secondary">
              Limpar
            </Link>
          </form>
        </Surface>

        <div className="nova-side-grid nova-side-grid--300">
          <div className="grid gap-2">
            <div className="nova-kanban-board">
              {kanban.map((column) => (
                <Surface key={column.title} className="nova-kanban-column p-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[13px] font-black text-white">
                      {column.title}
                    </h2>
                    <TonePill tone={column.items.length ? "attention" : "neutral"}>
                      {column.items.length}
                    </TonePill>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {column.items.slice(0, 4).map((item) => (
                      <Link
                        key={item.id}
                        href={`/alertas/${item.id}`}
                        className="nova-kanban-ticket"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-black text-white">
                            {item.code}
                          </span>
                          <TonePill tone={severityTone(item.severity)}>
                            {optionLabel(severityOptions, item.severity)}
                          </TonePill>
                        </div>
                        <div className="mt-2 truncate text-[10px] text-slate-400">
                          {item.title}
                        </div>
                        <div className="mt-2 grid gap-1 border-t border-white/[0.07] pt-2 text-[10px] text-[var(--nova-text-muted)]">
                          <div className="flex items-center justify-between gap-2">
                            <span>Alvo</span>
                            <span className="min-w-0 max-w-[150px] truncate text-right text-slate-300">
                              {occurrenceEntity(item)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>Chamados</span>
                            <TonePill tone={item._count.maintenances ? "success" : "neutral"}>
                              {item._count.maintenances}
                            </TonePill>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>Atualização</span>
                            <span className="text-slate-400">{formatDate(item.updatedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {!column.items.length ? (
                      <div className="text-[10px] text-slate-500">Sem itens.</div>
                    ) : null}
                  </div>
                </Surface>
              ))}
            </div>

            <Surface>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="nds-label">Incidentes</div>
                  <h2 className="mt-1 text-[14px] font-black text-white">
                    Alertas cadastrados
                  </h2>
                </div>
                <TonePill tone="neutral">{response.items.length} linhas</TonePill>
              </div>
              {response.items.length ? (
                <TableShell>
                  <DenseTable>
                    <TableHead>
                      <tr>
                        <th>Alerta</th>
                        <th>Severidade</th>
                        <th>Status</th>
                        <th>Vínculo</th>
                        <th>Chamados</th>
                        <th>Atualização</th>
                        <TableActionHeader />
                      </tr>
                    </TableHead>
                    <tbody>
                      {response.items.map((occurrence) => (
                        <tr key={occurrence.id}>
                          <TableCell>
                            <Link
                              href={`/alertas/${occurrence.id}`}
                              className="font-bold text-white hover:text-white"
                            >
                              {occurrence.code}
                            </Link>
                            <div className="mt-1 max-w-[420px] truncate text-[10px] text-slate-500">
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
                              <div className="mt-1 max-w-[320px] truncate text-[10px] text-slate-600">
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
                          <TableActionCell>
                            <TableActionLink href={`/alertas/${occurrence.id}`}>
                              Abrir
                            </TableActionLink>
                          </TableActionCell>
                        </tr>
                      ))}
                    </tbody>
                  </DenseTable>
                </TableShell>
              ) : (
                <EmptyState
                  title="Nenhum alerta encontrado"
                  description="Ajuste a busca ou limpe os filtros para voltar à base completa."
                  action={
                    <Link
                      href="/alertas"
                      className="nds-button"
                      data-variant="secondary"
                    >
                      Limpar filtros
                    </Link>
                  }
                />
              )}
            </Surface>
          </div>

          <RightPanel title="Resumo" description="Indicadores do turno e atalhos.">
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Com origem</span>
                <TonePill tone={sourceOnPage ? "info" : "neutral"}>
                  {sourceOnPage}
                </TonePill>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Críticas no turno</span>
                <TonePill
                  tone={
                    commandCenter.metrics.criticalOpenOccurrences
                      ? "critical"
                      : "neutral"
                  }
                >
                  {commandCenter.metrics.criticalOpenOccurrences}
                </TonePill>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Chamados vencidos</span>
                <TonePill
                  tone={
                    commandCenter.metrics.overdueMaintenances
                      ? "attention"
                      : "neutral"
                  }
                >
                  {commandCenter.metrics.overdueMaintenances}
                </TonePill>
              </div>
            </div>
            <Link href="/operacao/fila?view=pending" className="nds-button" data-variant="primary">
              Abrir fila
            </Link>
            <Link href="/sensores?view=events" className="nds-button" data-variant="secondary">
              Ver eventos NOC
            </Link>
          </RightPanel>
        </div>

        <ListPagination pathname="/alertas" searchParams={params} meta={response.meta} />
      </section>
    </AppShell>
  );
}
