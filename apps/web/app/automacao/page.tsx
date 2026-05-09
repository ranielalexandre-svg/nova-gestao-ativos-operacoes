import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  emptyCommandCenter,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type DetectorFilter =
  | "all"
  | "maintenance_overdue"
  | "critical_open_occurrence"
  | "aged_open_occurrence"
  | "integration_failure"
  | "monitoring_report_export";
type EnabledFilter = "all" | "true" | "false";
type SortBy = "createdAt" | "code" | "detector" | "cadence";
type SortDir = "asc" | "desc";
type RunStatus = "success" | "error" | "running" | string;

type RuleRow = {
  id: string;
  code: string;
  name: string;
  detector: string;
  severity: string;
  cadence: string;
  thresholdMinutes: number | null;
  enabled: boolean;
  createExceptions: boolean;
  createActivities: boolean;
  resolveOnRecovery: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportTemplate: { id: string; code: string; name: string } | null;
  _count: {
    runs: number;
    exceptionCases: number;
    activities?: number;
  };
};

type RunRow = {
  id: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  hitsCount: number;
  createdCount: number;
  updatedCount: number;
  summary: string | null;
  errorMessage: string | null;
  rule: {
    id: string;
    code: string;
    name: string;
    detector?: string;
  };
};

type AutomationSummary = {
  counts: {
    enabledRules: number;
    failedRuns24h: number;
    dueRules: number;
  };
};

type AutomacaoState = {
  q: string;
  detector: DetectorFilter;
  enabled: EnabledFilter;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const detectorOptions = [
  "all",
  "maintenance_overdue",
  "critical_open_occurrence",
  "aged_open_occurrence",
  "integration_failure",
  "monitoring_report_export",
] as const;

const enabledOptions = ["all", "true", "false"] as const;
const sortByOptions = ["createdAt", "code", "detector", "cadence"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const pageSizeOptions = [10, 20, 50] as const;

const emptyAutomationSummary: AutomationSummary = {
  counts: {
    enabledRules: 0,
    failedRuns24h: 0,
    dueRules: 0,
  },
};

function option<T extends readonly string[]>(options: T, value: string, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function detectorLabel(value: string) {
  if (value === "maintenance_overdue") return "Chamado vencido";
  if (value === "critical_open_occurrence") return "Alerta crítico";
  if (value === "aged_open_occurrence") return "Alerta antigo";
  if (value === "integration_failure") return "Falha integração";
  if (value === "monitoring_report_export") return "Relatório automático";
  return value || "Detector";
}

function cadenceLabel(value: string) {
  if (value === "every_5_minutes") return "a cada 5 min";
  if (value === "every_15_minutes") return "a cada 15 min";
  if (value === "hourly") return "hora em hora";
  if (value === "daily") return "diária";
  if (value === "weekly") return "semanal";
  return value.replaceAll("_", " ");
}

function severityLabel(value: string) {
  if (value === "critical") return "Crítica";
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  if (value === "low") return "Baixa";
  if (value === "info") return "Info";
  return value || "Sem severidade";
}

function severityTone(value: string): Tone {
  if (value === "critical") return "red";
  if (value === "high") return "orange";
  if (value === "medium") return "blue";
  if (value === "low" || value === "info") return "green";
  return "slate";
}

function statusTone(value: string): Tone {
  if (value === "success") return "green";
  if (value === "error") return "red";
  if (value === "running") return "blue";
  return "slate";
}

function statusLabel(value: string) {
  if (value === "success") return "Sucesso";
  if (value === "error") return "Erro";
  if (value === "running") return "Executando";
  return value || "Sem status";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isDue(item: RuleRow) {
  if (!item.enabled) return false;
  if (!item.nextRunAt) return true;
  return new Date(item.nextRunAt).getTime() <= Date.now();
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: AutomacaoState): RawSearchParams {
  return {
    q: state.q || undefined,
    detector: state.detector,
    enabled: state.enabled,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className="nova-lit-card nova-auto-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function WorkflowStep({
  index,
  title,
  state,
  detail,
  metric,
  tone,
  active,
}: {
  index: number;
  title: string;
  state: string;
  detail: string;
  metric: string;
  tone: Tone;
  active?: boolean;
}) {
  return (
    <article className={`nova-auto-flow-step is-${tone}${active ? " is-active" : ""}`}>
      <div className="nova-auto-step-head">
        <span>{index}</span>
        <b>{state}</b>
      </div>
      <strong>{title}</strong>
      <small>{detail}</small>
      <p>{metric}</p>
    </article>
  );
}

function AutomationWorkflow({
  rule,
  latestRun,
  runs,
  admin,
  runAction,
}: {
  rule: RuleRow | null;
  latestRun: RunRow | null;
  runs: RunRow[];
  admin: boolean;
  runAction: (formData: FormData) => Promise<void>;
}) {
  const latestStatus = latestRun?.status || "";
  const isRunning = latestStatus === "running";
  const hasError = latestStatus === "error";
  const canRun = admin && Boolean(rule);
  const processed = runs.reduce((sum, item) => sum + item.hitsCount, 0);
  const created = runs.reduce((sum, item) => sum + item.createdCount, 0);
  const updated = runs.reduce((sum, item) => sum + item.updatedCount, 0);

  const steps = [
    {
      title: "Coletar dados",
      state: latestRun ? "Concluído" : "Aguardando",
      detail: rule ? detectorLabel(rule.detector) : "nenhuma regra no recorte",
      metric: `${processed} evento(s) lidos`,
      tone: latestRun ? "green" as const : "slate" as const,
    },
    {
      title: "Validar dados",
      state: hasError ? "Com erro" : latestRun ? "Concluído" : "Pendente",
      detail: latestRun?.errorMessage || "consistência e vínculo operacional",
      metric: latestRun ? `${latestRun.hitsCount} hit(s)` : "sem execução",
      tone: hasError ? "red" as const : latestRun ? "green" as const : "slate" as const,
    },
    {
      title: "Gerar exceções",
      state: rule?.createExceptions ? "Habilitado" : "Desligado",
      detail: "abre ou atualiza casos na fila",
      metric: `${created} criada(s)`,
      tone: rule?.createExceptions ? "orange" as const : "slate" as const,
      active: rule?.createExceptions,
    },
    {
      title: "Atualizar base",
      state: isRunning ? "Em execução" : latestRun ? statusLabel(latestStatus) : "Pendente",
      detail: latestRun?.summary || "persistência de run, SLA e atividades",
      metric: `${updated} atualizada(s)`,
      tone: isRunning ? "blue" as const : hasError ? "red" as const : latestRun ? "green" as const : "slate" as const,
      active: isRunning,
    },
    {
      title: "Notificar operação",
      state: rule?.createActivities ? "Habilitado" : "Pendente",
      detail: "registra atividade e contexto de turno",
      metric: `${runs.length} run(s) recentes`,
      tone: rule?.createActivities ? "blue" as const : "slate" as const,
      active: rule?.createActivities,
    },
  ];

  return (
    <section className="nova-auto-workflow">
      <div className="nova-auto-flow-board">
        <div className="nova-auto-flow-title">
          <span>Fluxo de execução</span>
          <strong>{rule ? `${rule.code} · ${rule.name}` : "Sem regra selecionada"}</strong>
        </div>

        <div className="nova-auto-flow-steps">
          {steps.map((step, index) => (
            <WorkflowStep key={step.title} index={index + 1} {...step} />
          ))}
        </div>
      </div>

      <aside className="nova-auto-run-controls">
        <div className="nova-auto-run-card is-primary">
          <span>Status da rotina</span>
          <strong>{isRunning ? "Em execução" : hasError ? "Atenção" : latestRun ? "Concluída" : "Aguardando"}</strong>
          <p>{latestRun ? `${statusLabel(latestRun.status)} · ${runDuration(latestRun)}` : "Nenhuma execução no recorte atual."}</p>
        </div>

        <div className="nova-auto-action-stack">
          {canRun && rule ? (
            <form action={runAction}>
              <input type="hidden" name="id" value={rule.id} />
              <button type="submit">Executar agora</button>
            </form>
          ) : (
            <button type="button" disabled>Executar agora</button>
          )}
          <a href="#automation-rules">Editar fluxo</a>
          <a href="#automation-runs">Ver logs completos</a>
        </div>
      </aside>
    </section>
  );
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-auto-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-auto-progress">
      <div>
        <span>{label}</span>
        <b>{safe}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safe}%` }} />
      </i>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="nova-auto-empty">
      <div>N</div>
      <strong>Nenhuma automação encontrada</strong>
      <span>Ajuste os filtros ou cadastre regras para orquestrar o NOC.</span>
    </div>
  );
}

function runDuration(item: RunRow) {
  if (!item.finishedAt) return item.status === "running" ? "em andamento" : "-";
  const started = new Date(item.startedAt).getTime();
  const finished = new Date(item.finishedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(finished)) return "-";
  const seconds = Math.max(0, Math.round((finished - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}min`;
}

export default async function AutomacaoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/automacao");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function toggleAutomation(formData: FormData) {
    "use server";

    const currentSession = await getServerWebSession();
    if (normalizeRole(currentSession.user?.role || "") !== "admin") return;

    const id = String(formData.get("id") || "").trim();
    const enabled = String(formData.get("enabled") || "") === "true";
    if (!id) return;

    await apiJson(`/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });

    revalidatePath("/automacao");
    revalidatePath("/excecoes");
    revalidatePath("/operacao");
  }

  async function updateAutomationEffects(formData: FormData) {
    "use server";

    const currentSession = await getServerWebSession();
    if (normalizeRole(currentSession.user?.role || "") !== "admin") return;

    const id = String(formData.get("id") || "").trim();
    const detector = String(formData.get("detector") || "").trim();
    if (!id) return;

    const canCreateExceptions = detector !== "monitoring_report_export";
    const createExceptions = canCreateExceptions && formData.get("createExceptions") === "on";

    await apiJson(`/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        createExceptions,
        createActivities: formData.get("createActivities") === "on",
        resolveOnRecovery: createExceptions && formData.get("resolveOnRecovery") === "on",
      }),
    });

    revalidatePath("/automacao");
    revalidatePath("/excecoes");
    revalidatePath("/operacao");
    revalidatePath("/operacao/fila");
  }

  async function runAutomationNow(formData: FormData) {
    "use server";

    const currentSession = await getServerWebSession();
    if (normalizeRole(currentSession.user?.role || "") !== "admin") return;

    const id = String(formData.get("id") || "").trim();
    if (!id) return;

    await apiJson(`/automations/${id}/run`, {
      method: "POST",
    });

    revalidatePath("/automacao");
    revalidatePath("/excecoes");
    revalidatePath("/operacao");
    revalidatePath("/operacao/fila");
    revalidatePath("/operacao/atividade");
  }

  const params = await resolveSearchParams(searchParams);
  const state: AutomacaoState = {
    q: readStringParam(params, "q", ""),
    detector: option(detectorOptions, readStringParam(params, "detector", "all"), "all"),
    enabled: option(enabledOptions, readStringParam(params, "enabled", "all"), "all"),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "createdAt"), "createdAt"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const [rulesResponse, runsResponse, summary, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<RuleRow>>(
      `/automations${buildApiQuery({
        q: state.q,
        detector: state.detector !== "all" ? state.detector : undefined,
        enabled: state.enabled !== "all" ? state.enabled : undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      })}`,
    ),
    apiJson<PaginatedResponse<RunRow>>("/automations/runs?page=1&pageSize=12&sortDir=desc"),
    safeApiJson<AutomationSummary>("/automations/summary", emptyAutomationSummary),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const rows = rulesResponse.items;
  const runs = runsResponse.items;
  const enabledOnPage = rows.filter((item) => item.enabled).length;
  const pausedOnPage = rows.filter((item) => !item.enabled).length;
  const dueOnPage = rows.filter(isDue).length;
  const creatingExceptions = rows.filter((item) => item.createExceptions).length;
  const creatingActivities = rows.filter((item) => item.createActivities).length;
  const recoveryRules = rows.filter((item) => item.resolveOnRecovery).length;
  const successRuns = runs.filter((item) => item.status === "success").length;
  const failedRuns = runs.filter((item) => item.status === "error").length;
  const runningRuns = runs.filter((item) => item.status === "running").length;
  const detectors = Array.from(new Set(rows.map((item) => item.detector))).slice(0, 7);
  const currentParams = stateParams(state);
  const primaryRule = rows.find(isDue) || rows.find((item) => item.enabled) || rows[0] || null;
  const latestRun = runs[0] || null;
  const processedRuns = runs.reduce((sum, item) => sum + item.hitsCount, 0);
  const totalExceptionCases = rows.reduce((sum, item) => sum + item._count.exceptionCases, 0);
  const operationalPressure = commandCenter.metrics.openOccurrences + commandCenter.metrics.overdueMaintenances;
  const statusValue = runningRuns ? "Em execução" : failedRuns ? "Com falhas" : successRuns ? "Concluída" : "Aguardando";
  const statusToneValue: Tone = runningRuns ? "blue" : failedRuns ? "red" : successRuns ? "green" : "slate";

  const kpis = [
    { label: "Status da execução", value: statusValue, hint: latestRun ? `última ${formatDateTime(latestRun.startedAt)}` : "sem execução", tone: statusToneValue },
    { label: "Disparo", value: primaryRule ? cadenceLabel(primaryRule.cadence) : "-", hint: primaryRule?.enabled ? "agenda ativa" : "agenda pausada", tone: primaryRule?.enabled ? "blue" as const : "slate" as const },
    { label: "Duração", value: latestRun ? runDuration(latestRun) : "-", hint: latestRun ? statusLabel(latestRun.status) : "aguardando run", tone: latestRun ? statusTone(latestRun.status) : "slate" as const },
    { label: "Eventos processados", value: String(processedRuns), hint: `${runs.length} run(s) recentes`, tone: "blue" as const },
    { label: "Exceções", value: String(totalExceptionCases), hint: `${operationalPressure} alerta(s)/chamado(s) em pressão`, tone: totalExceptionCases ? "orange" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/automacao">
      <div className="nova-lit-page-heading nova-auto-heading">
        <div>
          <div className="nova-auto-breadcrumb">Gestão / Automação / Execução</div>
          <h1>Fluxo de automação operacional - Execução</h1>
          <p className="nova-lit-page-subtitle">Acompanhe status, etapas, runs e geração automática de exceções.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/integracoes" className="nova-lit-button nova-lit-button-secondary">Integrações</Link>
          <Link href="/excecoes?kind=automation" className="nova-lit-button nova-lit-button-primary">Exceções</Link>
        </div>
      </div>

      <section className="nova-auto-kpi-grid" aria-label="Indicadores de automação">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <AutomationWorkflow
        rule={primaryRule}
        latestRun={latestRun}
        runs={runs}
        admin={isAdmin}
        runAction={runAutomationNow}
      />

      <form id="automation-filters" action="/automacao" className="nova-lit-card nova-auto-filters">
        <label className="nova-auto-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Código, nome, detector ou template" />
        </label>

        <label className="nova-auto-field">
          <span>Detector</span>
          <select name="detector" defaultValue={state.detector}>
            <option value="all">Todos</option>
            <option value="maintenance_overdue">Chamado vencido</option>
            <option value="critical_open_occurrence">Alerta crítico</option>
            <option value="aged_open_occurrence">Alerta antigo</option>
            <option value="integration_failure">Falha integração</option>
            <option value="monitoring_report_export">Relatório automático</option>
          </select>
        </label>

        <label className="nova-auto-field">
          <span>Estado</span>
          <select name="enabled" defaultValue={state.enabled}>
            <option value="all">Todos</option>
            <option value="true">Ativas</option>
            <option value="false">Pausadas</option>
          </select>
        </label>

        <label className="nova-auto-field">
          <span>Ordem</span>
          <select name="sortBy" defaultValue={state.sortBy}>
            <option value="createdAt">Cadastro</option>
            <option value="code">Código</option>
            <option value="detector">Detector</option>
            <option value="cadence">Cadência</option>
          </select>
        </label>

        <label className="nova-auto-field">
          <span>Direção</span>
          <select name="sortDir" defaultValue={state.sortDir}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>

        <label className="nova-auto-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/automacao">Limpar</Link>
      </form>

      <section className="nova-auto-main-grid">
        <div id="automation-rules" className="nova-lit-card nova-auto-table-card">
          <div className="nova-auto-section-title">
            <div>
              <span>Automation Desk</span>
              <h2>Regras operacionais</h2>
            </div>
            <div>
              <small>{rows.length} linhas</small>
              <Link href="/operacao/atividade?kind=automation">Atividade</Link>
            </div>
          </div>

          <div className="nova-auto-table">
            <div className="nova-auto-table-head">
              <span>Regra</span>
              <span>Detector</span>
              <span>Sev.</span>
              <span>Cadência</span>
              <span>Próxima</span>
              <span>Efeitos</span>
              <span>Runs</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((item) => (
              <div className={`nova-auto-row ${item.enabled ? "is-green" : "is-slate"}`} key={item.id}>
                <div>
                  <strong>{item.code} · {item.name}</strong>
                  <small>{item.reportTemplate ? `${item.reportTemplate.code} · ${item.reportTemplate.name}` : "sem template vinculado"}</small>
                </div>

                <div>
                  <b>{detectorLabel(item.detector)}</b>
                  <small>{item.thresholdMinutes ? `limite ${item.thresholdMinutes} min` : "sem limite extra"}</small>
                </div>

                <div>
                  <Badge tone={severityTone(item.severity)}>{severityLabel(item.severity)}</Badge>
                </div>

                <div>
                  <b>{cadenceLabel(item.cadence)}</b>
                  <small>{item.enabled ? "ativa" : "pausada"}</small>
                </div>

                <div>
                  <b className={isDue(item) ? "is-auto-warning-text" : ""}>{formatDateTime(item.nextRunAt)}</b>
                  <small>última {formatDateTime(item.lastRunAt)}</small>
                </div>

                <div className="nova-auto-effects">
                  {item.createExceptions ? <Badge tone="orange">exceções</Badge> : null}
                  {item.createActivities ? <Badge tone="blue">atividades</Badge> : null}
                  {item.resolveOnRecovery ? <Badge tone="green">recuperação</Badge> : null}
                  {!item.createExceptions && !item.createActivities && !item.resolveOnRecovery ? <Badge tone="slate">somente leitura</Badge> : null}
                  {isAdmin ? (
                    <form action={updateAutomationEffects} className="mt-2 grid gap-1 text-[10px] text-slate-300">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="detector" value={item.detector} />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="createExceptions"
                          defaultChecked={item.createExceptions}
                          disabled={item.detector === "monitoring_report_export"}
                        />
                        Exceções
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="createActivities" defaultChecked={item.createActivities} />
                        Atividades
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="resolveOnRecovery"
                          defaultChecked={item.resolveOnRecovery}
                          disabled={item.detector === "monitoring_report_export"}
                        />
                        Recuperação
                      </label>
                      <button type="submit">Salvar efeitos</button>
                    </form>
                  ) : null}
                </div>

                <div>
                  <b>{item._count.runs}</b>
                  <small>{item._count.exceptionCases} exceção(ões)</small>
                </div>

                <div>
                  {isAdmin ? (
                    <form action={toggleAutomation}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="enabled" value={item.enabled ? "false" : "true"} />
                      <button type="submit">{item.enabled ? "Pausar" : "Ativar"}</button>
                    </form>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            )) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-auto-right-col">
          <section className="nova-lit-card nova-auto-health">
            <div className="nova-lit-title-row">
              <h2>Rotina</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{summary.counts.dueRules} prontas</span>
            </div>
            <div className="nova-auto-progress-list">
              <ProgressLine label="Ativas" value={percent(enabledOnPage, rows.length)} tone="green" />
              <ProgressLine label="Pausadas" value={percent(pausedOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Prontas na página" value={percent(dueOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Criam exceção" value={percent(creatingExceptions, rows.length)} tone="orange" />
              <ProgressLine label="Recuperação" value={percent(recoveryRules, rows.length)} tone="blue" />
            </div>
          </section>

          <section className="nova-lit-card nova-auto-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/automacao", currentParams, { enabled: "true", page: 1 })}>Ativas <b>{enabledOnPage}</b></Link>
            <Link href={withParams("/automacao", currentParams, { enabled: "false", page: 1 })}>Pausadas <b>{pausedOnPage}</b></Link>
            <Link href={withParams("/automacao", currentParams, { detector: "integration_failure", page: 1 })}>Integração <b>{rows.filter((item) => item.detector === "integration_failure").length}</b></Link>
          </section>

          <section className="nova-lit-card nova-auto-status">
            <div className="nova-lit-title-row">
              <h2>Runs recentes</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{runs.length}</span>
            </div>
            <div className="nova-auto-status-list">
              <article>
                <Dot tone="green" />
                <strong>Sucesso</strong>
                <b>{successRuns}</b>
              </article>
              <article>
                <Dot tone="red" />
                <strong>Erro</strong>
                <b>{failedRuns}</b>
              </article>
              <article>
                <Dot tone="blue" />
                <strong>Rodando</strong>
                <b>{runningRuns}</b>
              </article>
              <article>
                <Dot tone="orange" />
                <strong>Atividades</strong>
                <b>{creatingActivities}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-auto-detectors">
            <div className="nova-lit-title-row">
              <h2>Detectores</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{detectors.length}</span>
            </div>
            <div className="nova-auto-detector-list">
              {detectors.length ? detectors.map((detector) => (
                <Link key={detector} href={withParams("/automacao", currentParams, { detector, page: 1 })}>
                  <Dot tone="blue" />
                  <strong>{detectorLabel(detector)}</strong>
                  <b>{rows.filter((item) => item.detector === detector).length}</b>
                </Link>
              )) : (
                <div className="nova-auto-list-empty">Nenhum detector no recorte.</div>
              )}
            </div>
          </section>

          <section id="automation-runs" className="nova-lit-card nova-auto-runs">
            <div className="nova-lit-title-row">
              <h2>Últimas execuções</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{summary.counts.failedRuns24h} falhas</span>
            </div>
            <div className="nova-auto-run-list">
              {runs.length ? runs.slice(0, 7).map((item) => (
                <article key={item.id}>
                  <Dot tone={statusTone(item.status)} />
                  <div>
                    <strong>{item.rule.code} · {item.rule.name}</strong>
                    <span>{statusLabel(item.status)} · {runDuration(item)} · {item.hitsCount} hit(s)</span>
                  </div>
                </article>
              )) : (
                <div className="nova-auto-list-empty">Nenhuma execução recente.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-auto-pagination">
        <span>
          Página {rulesResponse.meta.page} de {rulesResponse.meta.totalPages} · {rulesResponse.meta.total} regra(s)
        </span>
        <div>
          <Link
            href={withParams("/automacao", currentParams, { page: Math.max(1, rulesResponse.meta.page - 1) })}
            className={!rulesResponse.meta.hasPrev ? "is-disabled" : ""}
            aria-disabled={!rulesResponse.meta.hasPrev}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/automacao", currentParams, { page: Math.min(rulesResponse.meta.totalPages, rulesResponse.meta.page + 1) })}
            className={!rulesResponse.meta.hasNext ? "is-disabled" : ""}
            aria-disabled={!rulesResponse.meta.hasNext}
          >
            Próxima
          </Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
