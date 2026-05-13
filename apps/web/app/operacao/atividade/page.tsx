import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UserOption = { id: string; name: string; email: string; role: string; isActive: boolean };
type PartnerOption = { id: string; code: string; name: string };
type UnitOption = { id: string; code: string; name: string };
type EquipmentOption = { id: string; tag: string; name: string };
type IntegrationOption = { id: string; code: string; name: string };
type OccurrenceOption = { id: string; code: string; title: string };
type MaintenanceOption = { id: string; code: string; title: string };
type ExceptionOption = { id: string; code: string; title: string; status: string };
type AutomationOption = { id: string; code: string; name: string };

type ActivityRow = {
  id: string;
  kind: string;
  source: string;
  title: string;
  description: string | null;
  severity: string | null;
  createdAt: string;
  updatedAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
  exceptionCase: { id: string; code: string; title: string; status: string } | null;
  automation: { id: string; code: string; name: string; detector: string } | null;
  automationRun: { id: string; status: string; startedAt: string; finishedAt: string | null } | null;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  integration: IntegrationOption | null;
  occurrence: OccurrenceOption | null;
  maintenance: MaintenanceOption | null;
};

const inputClass = "mt-2";
const selectClass = inputClass;

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function refs(item: ActivityRow) {
  const parts: string[] = [];
  if (item.exceptionCase) parts.push(`exceção ${item.exceptionCase.code}`);
  if (item.automation) parts.push(`regra ${item.automation.code}`);
  if (item.integration) parts.push(`integração ${item.integration.code}`);
  if (item.occurrence) parts.push(`alerta ${item.occurrence.code}`);
  if (item.maintenance) parts.push(`chamado ${item.maintenance.code}`);
  if (item.equipment) parts.push(`ativo ${item.equipment.tag}`);
  if (item.unit) parts.push(`unidade ${item.unit.code}`);
  if (item.partner) parts.push(`parceiro ${item.partner.code}`);
  return parts.length ? parts.join(" - ") : "sem vínculo";
}

function activityHref(item: ActivityRow) {
  if (item.exceptionCase) return `/excecoes/${item.exceptionCase.id}`;
  if (item.automation) return "/automacao";
  if (item.occurrence) return `/alertas/${item.occurrence.id}`;
  if (item.maintenance) return `/chamados/${item.maintenance.id}`;
  if (item.equipment) return `/equipamentos/${item.equipment.id}`;
  if (item.unit) return `/unidades/${item.unit.id}`;
  if (item.partner) return `/parceiros/${item.partner.id}`;
  return "";
}

function tone(value?: string | null) {
  if (!value) return "neutral";
  if (["critical", "error"].includes(value)) return "critical";
  if (["high", "warning"].includes(value)) return "attention";
  if (["medium", "info", "automation"].includes(value)) return "info";
  if (["success", "resolved"].includes(value)) return "success";
  return "neutral";
}

function label(value?: string | null) {
  const map: Record<string, string> = {
    note: "Nota",
    event: "Evento",
    exception: "Exceção",
    automation: "Automação",
    system: "Sistema",
    manual: "Manual",
    info: "Info",
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return value ? map[value] || value : "-";
}

function activityPayload(formData: FormData) {
  return {
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    kind: String(formData.get("kind") || "note"),
    source: "manual",
    severity: String(formData.get("severity") || "info"),
    userId: String(formData.get("userId") || ""),
    exceptionId: String(formData.get("exceptionId") || ""),
    automationId: String(formData.get("automationId") || ""),
    automationRunId: String(formData.get("automationRunId") || ""),
    partnerId: String(formData.get("partnerId") || ""),
    unitId: String(formData.get("unitId") || ""),
    equipmentId: String(formData.get("equipmentId") || ""),
    integrationId: String(formData.get("integrationId") || ""),
    occurrenceId: String(formData.get("occurrenceId") || ""),
    maintenanceId: String(formData.get("maintenanceId") || ""),
  };
}

export default async function AtividadePage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/atividade");

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const kind = readStringParam(params, "kind", "all");
  const source = readStringParam(params, "source", "all");
  const severity = readStringParam(params, "severity", "all");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createActivity(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const title = String(formData.get("title") || "").trim();
      if (title.length < 2) {
        return { status: "error", message: "Informe um título para a atividade." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify(activityPayload(formData)),
      });

      revalidatePath("/operacao/atividade");
      revalidatePath("/operacao/fila");
      revalidatePath("/operacao");
      revalidatePath("/excecoes");
      return { status: "success", message: "Atividade criada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [
    usersResponse,
    exceptionsResponse,
    automationsResponse,
    unitsResponse,
    equipmentsResponse,
    integrationsResponse,
    occurrencesResponse,
    maintenancesResponse,
    response,
  ] = await Promise.all([
    apiJson<PaginatedResponse<UserOption>>("/users?page=1&pageSize=100"),
    apiJson<PaginatedResponse<ExceptionOption>>("/exceptions?page=1&pageSize=100&sortBy=priorityScore&sortDir=desc"),
    apiJson<PaginatedResponse<AutomationOption>>("/automations?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100&sortBy=tag&sortDir=asc"),
    apiJson<PaginatedResponse<IntegrationOption>>("/integrations?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<MaintenanceOption>>("/maintenances?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<ActivityRow>>(
      `/activities${buildApiQuery({
        q,
        kind: kind !== "all" ? kind : undefined,
        source: source !== "all" ? source : undefined,
        severity: severity !== "all" ? severity : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
  ]);

  const manualCount = response.items.filter((item) => item.source === "manual").length;
  const automationCount = response.items.filter((item) => item.source === "automation").length;
  const exceptionCount = response.items.filter((item) => item.exceptionCase).length;
  const criticalCount = response.items.filter((item) => ["high", "critical"].includes(item.severity || "")).length;
  const priorityException = exceptionsResponse.items[0];
  const latest = response.items[0];

  const kpis = [
    {
      label: "Eventos",
      value: response.meta.total,
      detail: "resultado filtrado",
      tone: "info",
    },
    {
      label: "Manuais",
      value: manualCount,
      detail: "nesta página",
      tone: manualCount ? "attention" : "success",
    },
    {
      label: "Exceções",
      value: exceptionCount,
      detail: "com vínculo",
      tone: exceptionCount ? "critical" : "neutral",
    },
    {
      label: "Automações",
      value: automationCount,
      detail: "nesta página",
      tone: automationCount ? "info" : "neutral",
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao/atividade">
      <div className="nova-operation-activity-lit-page">
        <Surface className="nova-activity-command-hero">
          <div className="nova-activity-command-bar">
            <div className="min-w-0">
              <div className="nds-label">Operação / Atividade</div>
              <h1>Linha do tempo</h1>
              <p>
                Decisões, automações, evidências e registros manuais ligados ao trabalho do turno.
              </p>
            </div>
            <div className="nova-activity-hero-actions">
              <Link href="/operacao/fila" className="nds-button" data-variant="secondary">
                Abrir fila
              </Link>
              <Link href="/operacao/excecoes" className="nds-button" data-variant="primary">
                Exceções
              </Link>
            </div>
          </div>
          <div className="nova-activity-focus-strip">
            <div>
              <span>Último evento</span>
              <strong>{latest ? formatDateTime(latest.createdAt) : "-"}</strong>
            </div>
            <div>
              <span>Filtro</span>
              <strong>{kind === "all" ? "Todos os tipos" : label(kind)}</strong>
            </div>
            <div>
              <span>Alta atenção</span>
              <strong>{formatNumber(criticalCount)}</strong>
            </div>
          </div>
        </Surface>

        <section className="nova-activity-kpi-grid">
          {kpis.map((item) => (
            <article key={item.label} className="nova-activity-kpi-card">
              <div className="nova-activity-kpi-top">
                <span>{item.label}</span>
                <i className="nova-activity-kpi-dot" data-tone={item.tone} aria-label={item.tone} />
              </div>
              <strong>{formatNumber(item.value)}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </section>

        <div className="nova-activity-layout">
          <main className="nova-activity-main-stack">
            <Surface className="nova-activity-filter-panel">
              <SectionIntro
                eyebrow="Consulta"
                title="Buscar atividade"
                description="Filtro compartilhável por texto, tipo, origem e severidade."
                actions={<Link href="/operacao/atividade" className="nds-button" data-variant="secondary">Limpar</Link>}
                compact
              />
              <form method="GET" className="nova-activity-filter-form">
                <input name="q" defaultValue={q} placeholder="Título, descrição, unidade, parceiro ou vínculo" />
                <select name="kind" defaultValue={kind}>
                  <option value="all">Todos tipos</option>
                  <option value="note">Nota</option>
                  <option value="event">Evento</option>
                  <option value="exception">Exceção</option>
                  <option value="automation">Automação</option>
                  <option value="system">Sistema</option>
                </select>
                <select name="source" defaultValue={source}>
                  <option value="all">Todas origens</option>
                  <option value="manual">Manual</option>
                  <option value="automation">Automação</option>
                  <option value="exception">Exceção</option>
                </select>
                <select name="severity" defaultValue={severity}>
                  <option value="all">Todas severidades</option>
                  <option value="info">Info</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
                <select name="sortBy" defaultValue={sortBy}>
                  <option value="createdAt">Cadastro</option>
                  <option value="updatedAt">Atualização</option>
                  <option value="severity">Severidade</option>
                  <option value="kind">Tipo</option>
                  <option value="source">Origem</option>
                </select>
                <select name="sortDir" defaultValue={sortDir}>
                  <option value="desc">Desc.</option>
                  <option value="asc">Asc.</option>
                </select>
                <select name="pageSize" defaultValue={String(pageSize)}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <button className="nds-button" data-variant="primary">Aplicar</button>
              </form>
            </Surface>

            <Surface className="nova-activity-timeline-panel">
              <SectionIntro
                eyebrow="Linha do tempo"
                title="Atividades registradas"
                description={`${formatNumber(response.meta.total)} evento(s) no recorte atual.`}
                actions={<TonePill tone={criticalCount ? "critical" : "info"}>{formatNumber(criticalCount)} alta atenção</TonePill>}
                compact
              />
              {response.items.length ? (
                <TableShell className="nova-activity-table-shell">
                  <DenseTable>
                    <TableHead>
                      <tr>
                        <th className="px-3 py-2">Atividade</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Origem</th>
                        <th className="px-3 py-2">Sev.</th>
                        <th className="px-3 py-2">Ator</th>
                        <th className="px-3 py-2">Vínculos</th>
                        <th className="px-3 py-2">Criada</th>
                        <th className="px-3 py-2">Ação</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {response.items.map((item) => {
                        const href = activityHref(item);
                        return (
                          <tr key={item.id}>
                            <TableCell>
                              <div className="font-semibold text-slate-50">{item.title}</div>
                              <div className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">{item.description || "-"}</div>
                            </TableCell>
                            <TableCell><TonePill tone={tone(item.kind)}>{label(item.kind)}</TonePill></TableCell>
                            <TableCell><TonePill tone={tone(item.source)}>{label(item.source)}</TonePill></TableCell>
                            <TableCell><TonePill tone={tone(item.severity)}>{label(item.severity)}</TonePill></TableCell>
                            <TableCell>
                              <div className="text-slate-200">{item.actor?.name || "-"}</div>
                              <div className="mt-1 text-[10px] text-slate-500">{item.actor?.email || ""}</div>
                            </TableCell>
                            <TableCell className="max-w-md text-[10px] leading-5 text-slate-400">{refs(item)}</TableCell>
                            <TableCell className="whitespace-nowrap text-slate-300">{formatDateTime(item.createdAt)}</TableCell>
                            <TableCell>
                              {href ? (
                                <Link href={href} className="nova-activity-row-action">Abrir</Link>
                              ) : (
                                <span className="text-[10px] text-slate-500">-</span>
                              )}
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DenseTable>
                </TableShell>
              ) : (
                <EmptyState
                  title="Nenhuma atividade encontrada"
                  description="Ajuste filtros ou registre uma nota manual quando houver contexto operacional que não veio de automação."
                />
              )}
            </Surface>

            <ListPagination pathname="/operacao/atividade" searchParams={params} meta={response.meta} />
          </main>

          <aside className="nova-activity-side-stack">
            <Surface className="nova-activity-side-panel">
              <SectionIntro
                eyebrow="Registro rápido"
                title="Handoff do turno"
                description={priorityException ? `${priorityException.code} · ${priorityException.title}` : "Nenhuma exceção para registrar."}
                compact
              />
              {isAdmin && priorityException ? (
                <div className="nova-activity-quick-list">
                  <ActionForm
                    action={createActivity}
                    className="nova-activity-quick-form"
                    submitLabel="Registrar handoff"
                    pendingLabel="Registrando..."
                    variant="secondary"
                  >
                    <input type="hidden" name="title" value={`Handoff registrado: ${priorityException.code}`} />
                    <input type="hidden" name="description" value={`Próximo passo registrado no turno para ${priorityException.title}.`} />
                    <input type="hidden" name="kind" value="event" />
                    <input type="hidden" name="severity" value="info" />
                    <input type="hidden" name="exceptionId" value={priorityException.id} />
                    <input type="hidden" name="userId" value={session.user?.id || ""} />
                  </ActionForm>
                  <ActionForm
                    action={createActivity}
                    className="nova-activity-quick-form"
                    submitLabel="Registrar evidência"
                    pendingLabel="Registrando..."
                    variant="secondary"
                  >
                    <input type="hidden" name="title" value={`Evidência anexada ao caso: ${priorityException.code}`} />
                    <input type="hidden" name="description" value="Evidência operacional registrada para sustentar a próxima tratativa." />
                    <input type="hidden" name="kind" value="note" />
                    <input type="hidden" name="severity" value="medium" />
                    <input type="hidden" name="exceptionId" value={priorityException.id} />
                    <input type="hidden" name="userId" value={session.user?.id || ""} />
                  </ActionForm>
                  <Link href={`/operacao/excecoes/${priorityException.id}`} className="nds-button" data-variant="primary">
                    Abrir caso
                  </Link>
                </div>
              ) : null}
            </Surface>

            {isAdmin ? (
              <Surface className="nova-activity-side-panel">
                <SectionIntro
                  eyebrow="Registro manual"
                  title="Nova atividade"
                  description="Decisão, contato, evidência ou próximo passo."
                  compact
                />
                <ActionForm
                  action={createActivity}
                  className="nova-activity-create-form"
                  submitLabel="Criar atividade"
                  pendingLabel="Criando..."
                >
                  <div>
                    <FieldLabel>Título</FieldLabel>
                    <input name="title" placeholder="Resumo curto da atividade" className={inputClass} />
                  </div>
                  <div className="nova-activity-create-row">
                    <div>
                      <FieldLabel>Tipo</FieldLabel>
                      <select name="kind" defaultValue="note" className={selectClass}>
                        <option value="note">Nota</option>
                        <option value="event">Evento</option>
                        <option value="exception">Exceção</option>
                        <option value="automation">Automação</option>
                        <option value="system">Sistema</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Severidade</FieldLabel>
                      <select name="severity" defaultValue="info" className={selectClass}>
                        <option value="info">Info</option>
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="critical">Crítica</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Ator</FieldLabel>
                    <select name="userId" defaultValue={session.user?.id || ""} className={selectClass}>
                      <option value="">Sem ator</option>
                      {usersResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} - {item.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Exceção</FieldLabel>
                    <select name="exceptionId" className={selectClass}>
                      <option value="">Sem exceção</option>
                      {exceptionsResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Regra</FieldLabel>
                    <select name="automationId" className={selectClass}>
                      <option value="">Sem regra</option>
                      {automationsResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Unidade</FieldLabel>
                    <select name="unitId" className={selectClass}>
                      <option value="">Sem unidade</option>
                      {unitsResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Ativo</FieldLabel>
                    <select name="equipmentId" className={selectClass}>
                      <option value="">Sem ativo</option>
                      {equipmentsResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.tag} - {item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Integração</FieldLabel>
                    <select name="integrationId" className={selectClass}>
                      <option value="">Sem integração</option>
                      {integrationsResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Alerta</FieldLabel>
                    <select name="occurrenceId" className={selectClass}>
                      <option value="">Sem alerta</option>
                      {occurrencesResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Chamado</FieldLabel>
                    <select name="maintenanceId" className={selectClass}>
                      <option value="">Sem chamado</option>
                      {maintenancesResponse.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Descrição</FieldLabel>
                    <textarea name="description" placeholder="Contexto, decisão, evidência ou próximo passo" className={inputClass} />
                  </div>
                </ActionForm>
              </Surface>
            ) : null}
          </aside>
        </div>
      </div>
    </NovaLitShell>
  );
}
