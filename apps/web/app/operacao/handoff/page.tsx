import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

type Tone = "neutral" | "info" | "success" | "attention" | "critical";

type ExceptionSummary = {
  counts: {
    openCount: number;
    criticalCount: number;
    silencedCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};

type AutomationSummary = {
  counts: {
    enabledRules: number;
    failedRuns24h: number;
    dueRules: number;
  };
};

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
  automation: { id: string; code: string; name: string; detector?: string } | null;
  automationRun: { id: string; status: string; startedAt: string; finishedAt: string | null } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
};

type ExceptionRow = {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  queueKey: string;
  triageStatus: string;
  priorityScore: number;
  resolveDueAt: string | null;
  breachedAt: string | null;
  updatedAt: string;
  assignee: { id: string; name: string; email: string; role: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count: { comments: number; activities: number };
};

type OperationalReconciliation = {
  sourceAvailable: boolean;
  message?: string | null;
  generatedAt?: string | null;
  counts: {
    importedUnits: number;
    currentUnits: number;
    matchedUnits: number;
    weakUnitMatches: number;
    unmatchedImportedUnits: number;
    unmatchedCurrentUnits: number;
    importedPartners: number;
    currentPartners: number;
    matchedPartners: number;
    importedEquipments: number;
    currentEquipments: number;
    matchedEquipments: number;
    starlinks: number;
  };
};

type HandoffCheckpoint = {
  label: string;
  value: number;
  tone: Tone;
  href: string;
  detail: string;
};

const emptyExceptionSummary: ExceptionSummary = {
  counts: {
    openCount: 0,
    criticalCount: 0,
    silencedCount: 0,
    breachedCount: 0,
    dueSoonCount: 0,
    unassignedCount: 0,
    pendingTriageCount: 0,
  },
};

const emptyAutomationSummary: AutomationSummary = {
  counts: {
    enabledRules: 0,
    failedRuns24h: 0,
    dueRules: 0,
  },
};

const emptyReconciliation: OperationalReconciliation = {
  sourceAvailable: false,
  generatedAt: null,
  counts: {
    importedUnits: 0,
    currentUnits: 0,
    matchedUnits: 0,
    weakUnitMatches: 0,
    unmatchedImportedUnits: 0,
    unmatchedCurrentUnits: 0,
    importedPartners: 0,
    currentPartners: 0,
    matchedPartners: 0,
    importedEquipments: 0,
    currentEquipments: 0,
    matchedEquipments: 0,
    starlinks: 0,
  },
};

const emptyExceptionPage: PaginatedResponse<ExceptionRow> = {
  items: [],
  meta: { page: 1, pageSize: 0, total: 0, totalPages: 1, hasPrev: false, hasNext: false },
};

const emptyActivityPage: PaginatedResponse<ActivityRow> = {
  items: [],
  meta: { page: 1, pageSize: 0, total: 0, totalPages: 1, hasPrev: false, hasNext: false },
};

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR");
}

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function activityLabel(value?: string | null) {
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

function severityTone(value?: string | null): Tone {
  if (!value) return "neutral";
  if (["critical", "high", "error"].includes(value)) return "critical";
  if (["medium", "warning"].includes(value)) return "attention";
  if (["low", "info", "automation"].includes(value)) return "info";
  if (["success", "resolved"].includes(value)) return "success";
  return "neutral";
}

function queueLabel(value: string) {
  if (value === "noc") return "NOC";
  if (value === "field") return "Campo";
  if (value === "billing") return "Financeiro";
  if (value === "support") return "Suporte";
  if (value === "ops") return "Operação";
  return value || "Fila";
}

function sourceLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

function dueLabel(item: ExceptionRow) {
  if (item.breachedAt) return "SLA estourado";
  if (!item.resolveDueAt) return "Sem prazo";

  const due = new Date(item.resolveDueAt);
  if (Number.isNaN(due.getTime())) return "Prazo inválido";

  const minutes = Math.round((due.getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "Vencido";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

function activityRefs(item: ActivityRow) {
  const parts: string[] = [];
  if (item.exceptionCase) parts.push(`exceção ${item.exceptionCase.code}`);
  if (item.automation) parts.push(`regra ${item.automation.code}`);
  if (item.integration) parts.push(`integração ${item.integration.code}`);
  if (item.occurrence) parts.push(`alerta ${item.occurrence.code}`);
  if (item.maintenance) parts.push(`chamado ${item.maintenance.code}`);
  if (item.equipment) parts.push(`ativo ${item.equipment.tag}`);
  if (item.unit) parts.push(`unidade ${item.unit.code}`);
  if (item.partner) parts.push(`parceiro ${item.partner.code}`);
  return parts.length ? parts.join(" · ") : "sem vínculo";
}

function riskTone(value: number, critical = false): Tone {
  if (!value) return "success";
  return critical ? "critical" : "attention";
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-handoff-pill ${toneClass(tone)}`}>{children}</span>;
}

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-handoff-kpi ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
      <p>{detail}</p>
    </article>
  );
}

async function readExceptionQueue(params: Record<string, string | number | undefined>) {
  return safeApiJson<PaginatedResponse<ExceptionRow>>(
    `/exceptions${buildApiQuery(params)}`,
    emptyExceptionPage,
  );
}

async function readActivities(params: Record<string, string | number | undefined>) {
  return safeApiJson<PaginatedResponse<ActivityRow>>(
    `/activities${buildApiQuery(params)}`,
    emptyActivityPage,
  );
}

function buildHandoffPayload(formData: FormData) {
  return {
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    kind: "event",
    source: "manual",
    severity: String(formData.get("severity") || "info"),
    userId: String(formData.get("userId") || ""),
    exceptionId: String(formData.get("exceptionId") || ""),
    automationId: "",
    automationRunId: "",
    partnerId: "",
    unitId: "",
    equipmentId: "",
    integrationId: "",
    occurrenceId: "",
    maintenanceId: "",
  };
}

export default async function HandoffOperacionalPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/handoff");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createHandoffActivity(
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
        return { status: "error", message: "Informe um resumo para registrar no handoff." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify(buildHandoffPayload(formData)),
      });

      revalidatePath("/operacao/handoff");
      revalidatePath("/operacao/atividade");
      revalidatePath("/operacao/pendencias");
      revalidatePath("/operacao/fila");
      return { status: "success", message: "Handoff registrado no rastro operacional." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [
    commandCenter,
    exceptionSummary,
    automationSummary,
    telemetry,
    reconciliation,
    breachedCases,
    dueSoonCases,
    pendingCases,
    unassignedCases,
    recentActivities,
  ] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptyExceptionSummary),
    safeApiJson<AutomationSummary>("/automations/summary", emptyAutomationSummary),
    readUnitHostTelemetry({ timeoutMs: 1_800, fast: true }),
    safeApiJson<OperationalReconciliation>("/operational-data/reconciliation", emptyReconciliation),
    readExceptionQueue({ onlyBreached: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyDueSoon: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyUnassigned: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readActivities({ pageSize: 8, sortBy: "createdAt", sortDir: "desc" }),
  ]);

  const sourceFailures = telemetry.sources.filter((source) => !source.ok);
  const reconciliationPending =
    reconciliation.counts.weakUnitMatches +
    reconciliation.counts.unmatchedImportedUnits +
    reconciliation.counts.unmatchedCurrentUnits;
  const nocRisk = telemetry.counts.down + telemetry.counts.degraded + telemetry.counts.withProblems + sourceFailures.length;
  const operationalRisk =
    exceptionSummary.counts.breachedCount * 5 +
    exceptionSummary.counts.dueSoonCount * 3 +
    exceptionSummary.counts.pendingTriageCount * 2 +
    exceptionSummary.counts.unassignedCount * 2 +
    automationSummary.counts.failedRuns24h * 4 +
    reconciliationPending * 2 +
    nocRisk * 2 +
    commandCenter.metrics.criticalOpenOccurrences * 3 +
    commandCenter.metrics.overdueMaintenances * 2;

  const priorityCases = Array.from(
    new Map(
      [
        ...breachedCases.items,
        ...dueSoonCases.items,
        ...pendingCases.items,
        ...unassignedCases.items,
      ].map((item) => [item.id, item]),
    ).values(),
  )
    .sort((a, b) => {
      const breached = Number(Boolean(b.breachedAt)) - Number(Boolean(a.breachedAt));
      if (breached) return breached;
      return b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 10);

  const checkpoints: HandoffCheckpoint[] = [
    {
      label: "SLA estourado",
      value: exceptionSummary.counts.breachedCount,
      tone: riskTone(exceptionSummary.counts.breachedCount, true),
      href: "/operacao/fila?view=breached",
      detail: "deve sair com dono, prazo e próximo contato",
    },
    {
      label: "Vencendo no turno",
      value: exceptionSummary.counts.dueSoonCount,
      tone: riskTone(exceptionSummary.counts.dueSoonCount),
      href: "/operacao/fila?view=dueSoon",
      detail: "priorizar antes da troca de operador",
    },
    {
      label: "Sem responsável",
      value: exceptionSummary.counts.unassignedCount,
      tone: riskTone(exceptionSummary.counts.unassignedCount),
      href: "/operacao/fila?view=unassigned",
      detail: "atribuir antes de encerrar o turno",
    },
    {
      label: "Triagem pendente",
      value: exceptionSummary.counts.pendingTriageCount,
      tone: riskTone(exceptionSummary.counts.pendingTriageCount),
      href: "/operacao/fila?view=pending",
      detail: "classificar fila, severidade e próximo passo",
    },
    {
      label: "Automações falhando",
      value: automationSummary.counts.failedRuns24h,
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
      href: "/operacao/automacoes",
      detail: "registrar reprocessamento ou exceção de regra",
    },
    {
      label: "Reconciliação pendente",
      value: reconciliationPending,
      tone: riskTone(reconciliationPending),
      href: "/operacao/reconciliacao",
      detail: "sinalizar divergências que impactam atendimento",
    },
  ];

  const primaryCase = priorityCases[0];

  return (
    <NovaLitShell activeHref="/operacao/handoff">
      <main className="nova-handoff-page">
        <header className="nova-handoff-hero">
          <div>
            <span>Operação / Handoff</span>
            <h1>Handoff operacional completo</h1>
            <p>
              Consolide riscos do turno, pendências críticas, NOC, automações, reconciliação e rastro recente
              em uma visão única para passagem de responsabilidade.
            </p>
          </div>
          <div className="nova-handoff-hero-actions">
            <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-primary">
              Abrir War Room
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório do turno
            </Link>
            <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
              Playbooks
            </Link>
            <Link href="/operacao/pendencias" className="nova-lit-button nova-lit-button-secondary">
              Central de pendências
            </Link>
            <Link href="/operacao/atividade" className="nova-lit-button nova-lit-button-secondary">
              Rastro do turno
            </Link>
            <Link href="/operacao/handoff/export" className="nova-lit-button nova-lit-button-secondary">
              Exportar CSV
            </Link>
          </div>
        </header>

        <section className="nova-handoff-kpi-grid" aria-label="Resumo executivo do handoff">
          <Kpi
            label="Risco operacional"
            value={operationalRisk}
            detail="pontuação ponderada de SLA, NOC, automações e reconciliação"
            tone={operationalRisk > 30 ? "critical" : operationalRisk > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Pendências abertas"
            value={exceptionSummary.counts.openCount}
            detail={`${formatNumber(exceptionSummary.counts.criticalCount)} crítica(s), ${formatNumber(exceptionSummary.counts.silencedCount)} silenciada(s)`}
            tone={exceptionSummary.counts.criticalCount ? "critical" : exceptionSummary.counts.openCount ? "attention" : "success"}
          />
          <Kpi
            label="NOC em atenção"
            value={nocRisk}
            detail={`${formatNumber(telemetry.counts.down)} offline, ${formatNumber(sourceFailures.length)} fonte(s) falhando`}
            tone={telemetry.counts.down || sourceFailures.length ? "critical" : nocRisk ? "attention" : "success"}
          />
          <Kpi
            label="Último registro"
            value={recentActivities.items[0] ? formatDateTime(recentActivities.items[0].createdAt) : "-"}
            detail={`${formatNumber(recentActivities.meta.total)} evento(s) no rastro`}
            tone={recentActivities.items.length ? "info" : "neutral"}
          />
        </section>

        <section className="nova-handoff-layout">
          <div className="nova-handoff-main">
            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head">
                <div>
                  <span>Checklist do turno</span>
                  <h2>Itens que precisam sair com dono</h2>
                  <p>Use esta lista para garantir que o próximo operador receba status, risco e ação esperada.</p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Abrir fila
                </Link>
              </div>

              <div className="nova-handoff-check-grid">
                {checkpoints.map((item) => (
                  <Link key={item.label} href={item.href} className={`nova-handoff-check-card ${toneClass(item.tone)}`}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                    <p>{item.detail}</p>
                    <b>{item.value ? "Revisar agora" : "Sem bloqueio"}</b>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head">
                <div>
                  <span>Prioridades</span>
                  <h2>Casos para passar no handoff</h2>
                  <p>Recorte consolidado de SLA estourado, vencendo, sem dono e triagem pendente.</p>
                </div>
                <Link href="/operacao/pendencias" className="nova-lit-button nova-lit-button-secondary">
                  Ver central
                </Link>
              </div>

              {priorityCases.length ? (
                <div className="nova-handoff-case-list">
                  {priorityCases.map((item) => (
                    <article key={item.id} className="nova-handoff-case">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>{sourceLabel(item)} · prioridade {item.priorityScore} · {queueLabel(item.queueKey)}</small>
                      </div>
                      <div className="nova-handoff-case-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>{dueLabel(item)}</Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>{item.assignee?.name || "sem dono"}</Pill>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-handoff-empty">
                  <strong>Nenhum caso crítico para handoff.</strong>
                  <p>Registre uma nota operacional caso haja contexto externo que precise ser preservado.</p>
                </div>
              )}
            </section>

            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head">
                <div>
                  <span>Rastro</span>
                  <h2>Últimas decisões e eventos</h2>
                  <p>Eventos recentes ajudam o próximo operador a recuperar contexto rapidamente.</p>
                </div>
                <Link href="/operacao/atividade" className="nova-lit-button nova-lit-button-secondary">
                  Ver atividade
                </Link>
              </div>

              {recentActivities.items.length ? (
                <div className="nova-handoff-activity-list">
                  {recentActivities.items.map((item) => (
                    <article key={item.id} className="nova-handoff-activity">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description || activityRefs(item)}</p>
                      </div>
                      <div>
                        <Pill tone={severityTone(item.severity)}>{activityLabel(item.severity)}</Pill>
                        <small>{formatDateTime(item.createdAt)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-handoff-empty">
                  <strong>Sem atividade recente.</strong>
                  <p>Crie um registro de handoff para documentar o encerramento do turno.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="nova-handoff-side">
            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head is-compact">
                <div>
                  <span>Registro</span>
                  <h2>Fechar handoff</h2>
                  <p>Gere uma entrada manual no rastro do turno.</p>
                </div>
              </div>

              {isAdmin ? (
                <ActionForm
                  action={createHandoffActivity}
                  className="nova-handoff-form"
                  submitLabel="Registrar handoff"
                  pendingLabel="Registrando..."
                >
                  <label>
                    <span>Resumo</span>
                    <input
                      name="title"
                      defaultValue={`Handoff do turno - ${new Date().toLocaleDateString("pt-BR")}`}
                      placeholder="Resumo da passagem de turno"
                    />
                  </label>
                  <label>
                    <span>Severidade</span>
                    <select name="severity" defaultValue={operationalRisk > 30 ? "high" : operationalRisk > 0 ? "medium" : "info"}>
                      <option value="info">Info</option>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </label>
                  <label>
                    <span>Descrição</span>
                    <textarea
                      name="description"
                      rows={8}
                      defaultValue={[
                        `Risco operacional: ${operationalRisk}`,
                        `SLA estourado: ${exceptionSummary.counts.breachedCount}`,
                        `Vencendo: ${exceptionSummary.counts.dueSoonCount}`,
                        `Sem dono: ${exceptionSummary.counts.unassignedCount}`,
                        `Falhas automação 24h: ${automationSummary.counts.failedRuns24h}`,
                        `NOC em atenção: ${nocRisk}`,
                        `Reconciliação pendente: ${reconciliationPending}`,
                        primaryCase ? `Prioridade principal: ${primaryCase.code} - ${primaryCase.title}` : "Sem prioridade crítica.",
                      ].join("\n")}
                    />
                  </label>
                  <input type="hidden" name="userId" value={session.user?.id || ""} />
                  <input type="hidden" name="exceptionId" value={primaryCase?.id || ""} />
                </ActionForm>
              ) : (
                <div className="nova-handoff-empty">
                  <strong>Registro restrito a administradores.</strong>
                  <p>Usuários não administradores podem consultar a passagem de turno e exportar o CSV.</p>
                </div>
              )}
            </section>

            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head is-compact">
                <div>
                  <span>NOC e reconciliação</span>
                  <h2>Riscos técnicos</h2>
                </div>
              </div>
              <div className="nova-handoff-signal-list">
                <Link href="/monitoramento/sensores">
                  <Pill tone={riskTone(telemetry.counts.down, true)}>{formatNumber(telemetry.counts.down)}</Pill>
                  <span>hosts offline</span>
                </Link>
                <Link href="/monitoramento/sensores">
                  <Pill tone={riskTone(telemetry.counts.unmapped + telemetry.counts.ambiguous)}>{formatNumber(telemetry.counts.unmapped + telemetry.counts.ambiguous)}</Pill>
                  <span>vínculos NOC pendentes</span>
                </Link>
                <Link href="/monitoramento/fontes">
                  <Pill tone={riskTone(sourceFailures.length)}>{formatNumber(sourceFailures.length)}</Pill>
                  <span>fontes com falha</span>
                </Link>
                <Link href="/operacao/reconciliacao">
                  <Pill tone={riskTone(reconciliationPending)}>{formatNumber(reconciliationPending)}</Pill>
                  <span>divergências de reconciliação</span>
                </Link>
              </div>
            </section>

            <section className="nova-handoff-panel">
              <div className="nova-handoff-panel-head is-compact">
                <div>
                  <span>Atualização</span>
                  <h2>Dados usados</h2>
                </div>
              </div>
              <div className="nova-handoff-context">
                <div><span>Comando NOC</span><strong>{formatDateTime(commandCenter.generatedAt)}</strong></div>
                <div><span>Telemetria</span><strong>{formatDateTime(telemetry.generatedAt)}</strong></div>
                <div><span>Reconciliação</span><strong>{formatDateTime(reconciliation.generatedAt || null)}</strong></div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
