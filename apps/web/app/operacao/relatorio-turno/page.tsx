import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
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

type ActivityRow = {
  id: string;
  kind: string;
  source: string;
  title: string;
  description: string | null;
  severity: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
  exceptionCase: { id: string; code: string; title: string; status: string } | null;
  automation: { id: string; code: string; name: string; detector?: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  unit: { id: string; code: string; name: string } | null;
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

type ReportBlock = {
  key: string;
  title: string;
  value: number | string;
  tone: Tone;
  detail: string;
  href: string;
};

type ExecutiveItem = {
  label: string;
  text: string;
  tone: Tone;
  href: string;
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

function riskTone(value: number, critical = false): Tone {
  if (!value) return "success";
  return critical ? "critical" : "attention";
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

function activityLink(item: ActivityRow) {
  if (item.exceptionCase) return `/operacao/excecoes/${item.exceptionCase.id}`;
  if (item.automation) return "/operacao/automacoes";
  if (item.integration) return "/monitoramento/fontes";
  if (item.occurrence) return `/alertas/${item.occurrence.id}`;
  if (item.maintenance) return `/chamados/${item.maintenance.id}`;
  if (item.unit) return `/unidades/${item.unit.id}`;
  return "/operacao/atividade";
}

function activityRefs(item: ActivityRow) {
  const refs: string[] = [];
  if (item.exceptionCase) refs.push(`exceção ${item.exceptionCase.code}`);
  if (item.automation) refs.push(`regra ${item.automation.code}`);
  if (item.integration) refs.push(`integração ${item.integration.code}`);
  if (item.occurrence) refs.push(`alerta ${item.occurrence.code}`);
  if (item.maintenance) refs.push(`chamado ${item.maintenance.code}`);
  if (item.unit) refs.push(`unidade ${item.unit.code}`);
  return refs.length ? refs.join(" · ") : "sem vínculo";
}

function reportHealthLabel(score: number) {
  if (score >= 85) return "Turno controlado";
  if (score >= 65) return "Turno com atenção";
  return "Turno crítico";
}

function reportHealthTone(score: number): Tone {
  if (score >= 85) return "success";
  if (score >= 65) return "attention";
  return "critical";
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-turno-pill ${toneClass(tone)}`}>{children}</span>;
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
    <article className={`nova-turno-kpi ${toneClass(tone)}`}>
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

async function readActivities() {
  return safeApiJson<PaginatedResponse<ActivityRow>>(
    `/activities${buildApiQuery({ pageSize: 12, sortBy: "createdAt", sortDir: "desc" })}`,
    emptyActivityPage,
  );
}

function buildShiftReportPayload(formData: FormData) {
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

export default async function RelatorioTurnoPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/relatorio-turno");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createShiftClosure(
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
        return { status: "error", message: "Informe um resumo para o fechamento do turno." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify(buildShiftReportPayload(formData)),
      });

      revalidatePath("/operacao/relatorio-turno");
      revalidatePath("/operacao/atividade");
      revalidatePath("/operacao/handoff");
      revalidatePath("/operacao/war-room");
      revalidatePath("/operacao/playbooks");
      revalidatePath("/operacao/pendencias");

      return { status: "success", message: "Fechamento do turno registrado no rastro operacional." };
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
    activities,
  ] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptyExceptionSummary),
    safeApiJson<AutomationSummary>("/automations/summary", emptyAutomationSummary),
    readUnitHostTelemetry({ timeoutMs: 1_800, fast: true }),
    safeApiJson<OperationalReconciliation>("/operational-data/reconciliation", emptyReconciliation),
    readExceptionQueue({ onlyBreached: "true", pageSize: 10, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyDueSoon: "true", pageSize: 10, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 10, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyUnassigned: "true", pageSize: 10, sortBy: "priorityScore", sortDir: "desc" }),
    readActivities(),
  ]);

  const sourceFailures = telemetry.sources.filter((source) => !source.ok);
  const reconciliationPending =
    reconciliation.counts.weakUnitMatches +
    reconciliation.counts.unmatchedImportedUnits +
    reconciliation.counts.unmatchedCurrentUnits;
  const nocRisk =
    telemetry.counts.down +
    telemetry.counts.degraded +
    telemetry.counts.withProblems +
    telemetry.counts.unmapped +
    telemetry.counts.ambiguous +
    sourceFailures.length;
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

  const reportScore = Math.max(0, Math.min(100, 100 - operationalRisk));
  const reportTone = reportHealthTone(reportScore);

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
    .slice(0, 12);

  const topCase = priorityCases[0];
  const executedActivities = activities.items.filter((item) =>
    ["event", "automation", "system"].includes(item.kind) || item.source === "manual",
  );
  const pendingActions = [
    exceptionSummary.counts.breachedCount ? `${formatNumber(exceptionSummary.counts.breachedCount)} SLA estourado(s)` : "",
    exceptionSummary.counts.dueSoonCount ? `${formatNumber(exceptionSummary.counts.dueSoonCount)} caso(s) vencendo` : "",
    exceptionSummary.counts.unassignedCount ? `${formatNumber(exceptionSummary.counts.unassignedCount)} sem responsável` : "",
    exceptionSummary.counts.pendingTriageCount ? `${formatNumber(exceptionSummary.counts.pendingTriageCount)} em triagem` : "",
    automationSummary.counts.failedRuns24h ? `${formatNumber(automationSummary.counts.failedRuns24h)} automação(ões) com falha` : "",
    nocRisk ? `${formatNumber(nocRisk)} sinal(is) NOC em atenção` : "",
    reconciliationPending ? `${formatNumber(reconciliationPending)} divergência(s) de reconciliação` : "",
  ].filter(Boolean);

  const reportBlocks: ReportBlock[] = [
    {
      key: "pendencias",
      title: "Pendências",
      value: exceptionSummary.counts.openCount,
      tone: exceptionSummary.counts.criticalCount ? "critical" : exceptionSummary.counts.openCount ? "attention" : "success",
      detail: `${formatNumber(exceptionSummary.counts.criticalCount)} crítica(s), ${formatNumber(exceptionSummary.counts.breachedCount)} SLA estourado(s)`,
      href: "/operacao/pendencias",
    },
    {
      key: "handoff",
      title: "Handoff",
      value: priorityCases.length,
      tone: priorityCases.length ? "attention" : "success",
      detail: "casos priorizados para passagem de turno",
      href: "/operacao/handoff",
    },
    {
      key: "war-room",
      title: "War Room",
      value: operationalRisk,
      tone: operationalRisk > 35 ? "critical" : operationalRisk > 0 ? "attention" : "success",
      detail: "pontuação ponderada de risco operacional",
      href: "/operacao/war-room",
    },
    {
      key: "playbooks",
      title: "Playbooks",
      value: pendingActions.length,
      tone: pendingActions.length ? "attention" : "success",
      detail: "roteiros recomendados para o próximo responsável",
      href: "/operacao/playbooks",
    },
    {
      key: "noc",
      title: "NOC",
      value: nocRisk,
      tone: telemetry.counts.down || sourceFailures.length ? "critical" : nocRisk ? "attention" : "success",
      detail: `${formatNumber(telemetry.counts.down)} offline, ${formatNumber(sourceFailures.length)} fonte(s) falhando`,
      href: "/monitoramento/sensores",
    },
    {
      key: "automacoes",
      title: "Automações",
      value: automationSummary.counts.failedRuns24h,
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
      detail: `${formatNumber(automationSummary.counts.dueRules)} regra(s) vencida(s) para execução`,
      href: "/operacao/automacoes",
    },
    {
      key: "reconciliacao",
      title: "Reconciliação",
      value: reconciliationPending,
      tone: riskTone(reconciliationPending),
      detail: `${formatNumber(reconciliation.counts.weakUnitMatches)} match fraco, ${formatNumber(reconciliation.counts.unmatchedImportedUnits)} importado(s) sem par`,
      href: "/operacao/reconciliacao",
    },
    {
      key: "rastro",
      title: "Rastro",
      value: activities.meta.total,
      tone: activities.items.length ? "info" : "neutral",
      detail: activities.items[0] ? `último: ${formatDateTime(activities.items[0].createdAt)}` : "sem evento recente",
      href: "/operacao/atividade",
    },
  ];

  const executiveItems: ExecutiveItem[] = [
    {
      label: "Resumo para gestor",
      text: `${reportHealthLabel(reportScore)} com score ${formatNumber(reportScore)} e risco operacional ${formatNumber(operationalRisk)}.`,
      tone: reportTone,
      href: "/operacao/war-room",
    },
    {
      label: "Risco residual",
      text: pendingActions.length
        ? `Permanecem ${pendingActions.join(", ")}.`
        : "Sem risco residual crítico no recorte atual.",
      tone: pendingActions.length ? "attention" : "success",
      href: "/operacao/pendencias",
    },
    {
      label: "Ações executadas",
      text: `${formatNumber(executedActivities.length)} evento(s) ou decisão(ões) recentes no rastro operacional.`,
      tone: executedActivities.length ? "info" : "neutral",
      href: "/operacao/atividade",
    },
    {
      label: "Pós-incidente",
      text: topCase
        ? `Usar ${topCase.code} como caso principal para revisão, evidências e causa provável.`
        : "Sem caso principal crítico para pós-incidente.",
      tone: topCase ? severityTone(topCase.severity) : "success",
      href: topCase ? `/operacao/excecoes/${topCase.id}` : "/operacao/relatorio-turno",
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao/relatorio-turno">
      <main className="nova-turno-page">
        <header className="nova-turno-hero">
          <div>
            <span>Operação / Relatório do turno</span>
            <h1>Relatório executivo do turno e pós-incidente</h1>
            <p>
              Feche o turno com resumo executivo, risco residual, ações executadas, pendências e
              contexto pronto para gestão, handoff e revisão pós-incidente.
            </p>
          </div>
          <div className="nova-turno-hero-actions">
            <Link href="/operacao/relatorio-turno/export" className="nova-lit-button nova-lit-button-primary">
              Exportar relatório
            </Link>
            <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
              Handoff
            </Link>
            <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-secondary">
              War Room
            </Link>
            <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
              Playbooks
            </Link>
          </div>
        </header>

        <section className="nova-turno-kpi-grid" aria-label="Resumo executivo do turno">
          <Kpi
            label="Score do turno"
            value={reportScore}
            detail={reportHealthLabel(reportScore)}
            tone={reportTone}
          />
          <Kpi
            label="Risco residual"
            value={operationalRisk}
            detail={`${pendingActions.length} frente(s) com ação pendente`}
            tone={operationalRisk > 35 ? "critical" : operationalRisk > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Casos prioritários"
            value={priorityCases.length}
            detail={`${formatNumber(exceptionSummary.counts.breachedCount)} SLA estourado(s)`}
            tone={exceptionSummary.counts.breachedCount ? "critical" : priorityCases.length ? "attention" : "success"}
          />
          <Kpi
            label="Último registro"
            value={activities.items[0] ? formatDateTime(activities.items[0].createdAt) : "-"}
            detail={`${formatNumber(activities.meta.total)} evento(s) no rastro`}
            tone={activities.items.length ? "info" : "neutral"}
          />
        </section>

        <section className="nova-turno-layout">
          <div className="nova-turno-main">
            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head">
                <div>
                  <span>Relatório executivo</span>
                  <h2>Resumo para gestor</h2>
                  <p>Blocos prontos para fechamento do turno, reunião rápida e acompanhamento pós-incidente.</p>
                </div>
                <Link href="/operacao/relatorio-turno/export" className="nova-lit-button nova-lit-button-secondary">
                  Baixar CSV
                </Link>
              </div>

              <div className="nova-turno-executive-grid">
                {executiveItems.map((item) => (
                  <Link key={item.label} href={item.href} className={`nova-turno-executive ${toneClass(item.tone)}`}>
                    <span>{item.label}</span>
                    <strong>{item.text}</strong>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head">
                <div>
                  <span>Consolidação</span>
                  <h2>Frentes do turno</h2>
                  <p>Pendências, handoff, War Room, Playbooks, SLA, NOC, automações, reconciliação e rastro.</p>
                </div>
                <Link href="/operacao/pendencias" className="nova-lit-button nova-lit-button-secondary">
                  Abrir pendências
                </Link>
              </div>

              <div className="nova-turno-block-grid">
                {reportBlocks.map((item) => (
                  <Link key={item.key} href={item.href} className={`nova-turno-block ${toneClass(item.tone)}`}>
                    <div>
                      <span>{item.title}</span>
                      <strong>{typeof item.value === "number" ? formatNumber(item.value) : item.value}</strong>
                    </div>
                    <p>{item.detail}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head">
                <div>
                  <span>Pendências</span>
                  <h2>Ações pendentes para o próximo responsável</h2>
                  <p>Recorte combinado de SLA, triagem, dono, automação, NOC e reconciliação.</p>
                </div>
                <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
                  Ver playbooks
                </Link>
              </div>

              {pendingActions.length ? (
                <div className="nova-turno-pending-list">
                  {pendingActions.map((item) => (
                    <article key={item}>
                      <Pill tone="attention">pendente</Pill>
                      <strong>{item}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-turno-empty">
                  <strong>Nenhuma ação pendente crítica.</strong>
                  <p>Registre o fechamento do turno e mantenha o rastro operacional atualizado.</p>
                </div>
              )}
            </section>

            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head">
                <div>
                  <span>Casos e pós-incidente</span>
                  <h2>Casos que justificam revisão</h2>
                  <p>Casos críticos para análise de causa, evidência, decisão e ação corretiva.</p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Abrir fila
                </Link>
              </div>

              {priorityCases.length ? (
                <div className="nova-turno-case-list">
                  {priorityCases.map((item) => (
                    <article key={item.id} className="nova-turno-case">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>{sourceLabel(item)} · prioridade {item.priorityScore} · {queueLabel(item.queueKey)}</small>
                      </div>
                      <div className="nova-turno-case-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>{dueLabel(item)}</Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>{item.assignee?.name || "sem dono"}</Pill>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-turno-empty">
                  <strong>Nenhum caso crítico para pós-incidente.</strong>
                  <p>Sem itens priorizados por SLA, vencimento, triagem ou responsável.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="nova-turno-side">
            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head is-compact">
                <div>
                  <span>Fechamento</span>
                  <h2>Registrar relatório</h2>
                  <p>Cria evento manual de fechamento do turno no rastro operacional.</p>
                </div>
              </div>

              {isAdmin ? (
                <ActionForm
                  action={createShiftClosure}
                  className="nova-turno-form"
                  submitLabel="Registrar fechamento"
                  pendingLabel="Registrando..."
                >
                  <label>
                    <span>Resumo</span>
                    <input
                      name="title"
                      defaultValue={`Relatório executivo do turno - ${new Date().toLocaleDateString("pt-BR")}`}
                      placeholder="Resumo do fechamento"
                    />
                  </label>
                  <label>
                    <span>Severidade</span>
                    <select name="severity" defaultValue={reportTone === "critical" ? "high" : reportTone === "attention" ? "medium" : "info"}>
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
                      rows={11}
                      defaultValue={[
                        `Score do turno: ${reportScore} - ${reportHealthLabel(reportScore)}`,
                        `Risco residual: ${operationalRisk}`,
                        `Resumo: ${executiveItems[0]?.text || ""}`,
                        `Pendências: ${pendingActions.join("; ") || "sem pendências críticas"}`,
                        `Ações executadas: ${executedActivities.length} evento(s) recentes`,
                        `NOC: ${nocRisk} sinal(is) em atenção`,
                        `Automação: ${automationSummary.counts.failedRuns24h} falha(s) 24h`,
                        `Reconciliação: ${reconciliationPending} divergência(s)`,
                        topCase ? `Pós-incidente: ${topCase.code} - ${topCase.title}` : "Pós-incidente: sem caso principal crítico",
                      ].join("\n")}
                    />
                  </label>
                  <input type="hidden" name="userId" value={session.user?.id || ""} />
                  <input type="hidden" name="exceptionId" value={topCase?.id || ""} />
                </ActionForm>
              ) : (
                <div className="nova-turno-empty">
                  <strong>Registro restrito a administradores.</strong>
                  <p>Usuários não administradores podem consultar e exportar o relatório.</p>
                </div>
              )}
            </section>

            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head is-compact">
                <div>
                  <span>Ações executadas</span>
                  <h2>Rastro recente</h2>
                </div>
              </div>

              {activities.items.length ? (
                <div className="nova-turno-timeline">
                  {activities.items.slice(0, 7).map((item) => (
                    <Link key={item.id} href={activityLink(item)}>
                      <Pill tone={severityTone(item.severity)}>{item.severity || item.kind}</Pill>
                      <strong>{item.title}</strong>
                      <span>{item.description || activityRefs(item)}</span>
                      <small>{formatDateTime(item.createdAt)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="nova-turno-empty">
                  <strong>Sem rastro recente.</strong>
                  <p>Registre decisões antes do fechamento final do turno.</p>
                </div>
              )}
            </section>

            <section className="nova-turno-panel">
              <div className="nova-turno-panel-head is-compact">
                <div>
                  <span>Dados usados</span>
                  <h2>Atualizações</h2>
                </div>
              </div>
              <div className="nova-turno-context">
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
