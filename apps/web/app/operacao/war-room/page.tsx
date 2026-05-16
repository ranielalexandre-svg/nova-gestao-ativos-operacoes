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

type WarRoom = {
  key: string;
  title: string;
  description: string;
  value: number;
  tone: Tone;
  href: string;
  owner: string;
  nextStep: string;
};

type ActionPlanItem = {
  key: string;
  title: string;
  priority: number;
  tone: Tone;
  owner: string;
  due: string;
  href: string;
  evidence: string;
  nextStep: string;
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

function sourceLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
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

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-war-pill ${toneClass(tone)}`}>{children}</span>;
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
    <article className={`nova-war-kpi ${toneClass(tone)}`}>
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

function buildWarRoomPayload(formData: FormData) {
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

function buildActionPlan({
  breached,
  dueSoon,
  unassigned,
  pending,
  automationFailures,
  nocRisk,
  sourceFailures,
  reconciliationPending,
  topCase,
}: {
  breached: number;
  dueSoon: number;
  unassigned: number;
  pending: number;
  automationFailures: number;
  nocRisk: number;
  sourceFailures: number;
  reconciliationPending: number;
  topCase?: ExceptionRow;
}): ActionPlanItem[] {
  const plan: ActionPlanItem[] = [];

  plan.push({
    key: "sla",
    title: "Fechar risco de SLA antes da próxima janela",
    priority: breached * 5 + dueSoon * 3,
    tone: riskTone(breached + dueSoon, Boolean(breached)),
    owner: topCase?.assignee?.name || "Líder de operação",
    due: breached ? "Agora" : dueSoon ? "Ainda neste turno" : "Monitorar",
    href: breached ? "/operacao/fila?view=breached" : "/operacao/fila?view=dueSoon",
    evidence: `${formatNumber(breached)} estourado(s), ${formatNumber(dueSoon)} vencendo`,
    nextStep: topCase ? `Começar por ${topCase.code}` : "Manter fila monitorada",
  });

  plan.push({
    key: "ownership",
    title: "Remover itens sem dono ou sem triagem",
    priority: unassigned * 2 + pending * 2,
    tone: riskTone(unassigned + pending),
    owner: "Coordenador de turno",
    due: unassigned + pending ? "Antes do handoff" : "Sem bloqueio",
    href: "/operacao/fila?view=unassigned",
    evidence: `${formatNumber(unassigned)} sem dono, ${formatNumber(pending)} em triagem`,
    nextStep: "Atribuir responsável e fila de atendimento",
  });

  plan.push({
    key: "noc",
    title: "Estabilizar sinais NOC e fontes",
    priority: nocRisk * 2 + sourceFailures * 3,
    tone: riskTone(nocRisk + sourceFailures, Boolean(sourceFailures)),
    owner: "NOC",
    due: nocRisk ? "Durante o turno" : "Sem bloqueio",
    href: "/monitoramento/sensores",
    evidence: `${formatNumber(nocRisk)} sinal(is) em atenção, ${formatNumber(sourceFailures)} fonte(s) falhando`,
    nextStep: "Validar sensores, fontes e vínculos de host",
  });

  plan.push({
    key: "automation",
    title: "Reprocessar ou justificar falhas de automação",
    priority: automationFailures * 4,
    tone: riskTone(automationFailures, true),
    owner: "Operação / Automação",
    due: automationFailures ? "Antes de encerrar plantão" : "Sem bloqueio",
    href: "/operacao/automacoes",
    evidence: `${formatNumber(automationFailures)} falha(s) nas últimas 24h`,
    nextStep: "Reprocessar regra ou registrar exceção operacional",
  });

  plan.push({
    key: "reconciliation",
    title: "Conter divergências de reconciliação",
    priority: reconciliationPending * 2,
    tone: riskTone(reconciliationPending),
    owner: "Backoffice operacional",
    due: reconciliationPending ? "Planejar correção" : "Sem bloqueio",
    href: "/operacao/reconciliacao",
    evidence: `${formatNumber(reconciliationPending)} divergência(s)`,
    nextStep: "Separar divergência crítica de backlog administrativo",
  });

  return plan.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export default async function WarRoomOperacionalPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/war-room");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createWarRoomActivity(
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
        return { status: "error", message: "Informe uma decisão ou plano do War Room." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify(buildWarRoomPayload(formData)),
      });

      revalidatePath("/operacao/war-room");
      revalidatePath("/operacao/atividade");
      revalidatePath("/operacao/handoff");
      revalidatePath("/operacao/pendencias");
      revalidatePath("/operacao/fila");
      return { status: "success", message: "Decisão do War Room registrada no rastro operacional." };
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

  const topCase = priorityCases[0];

  const rooms: WarRoom[] = [
    {
      key: "sla",
      title: "Sala SLA",
      description: "Casos vencidos, vencendo e sem dono que precisam de decisão imediata.",
      value: exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount + exceptionSummary.counts.unassignedCount,
      tone: riskTone(exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount, Boolean(exceptionSummary.counts.breachedCount)),
      href: "/operacao/fila",
      owner: topCase?.assignee?.name || "Líder de operação",
      nextStep: topCase ? `Começar por ${topCase.code}` : "Acompanhar fila priorizada",
    },
    {
      key: "noc",
      title: "Sala NOC",
      description: "Hosts offline, degradados, com problema ou fontes indisponíveis.",
      value: nocRisk,
      tone: riskTone(nocRisk, Boolean(telemetry.counts.down || sourceFailures.length)),
      href: "/monitoramento/sensores",
      owner: "NOC",
      nextStep: "Validar sensores, fontes e vínculos",
    },
    {
      key: "automations",
      title: "Sala Automações",
      description: "Falhas de execução, regras vencidas e automações que exigem intervenção.",
      value: automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules,
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
      href: "/operacao/automacoes",
      owner: "Operação / Automação",
      nextStep: "Reprocessar ou justificar falhas",
    },
    {
      key: "reconciliation",
      title: "Sala Reconciliação",
      description: "Divergências importadas, matches fracos e unidades sem par confiável.",
      value: reconciliationPending,
      tone: riskTone(reconciliationPending),
      href: "/operacao/reconciliacao",
      owner: "Backoffice operacional",
      nextStep: "Classificar divergência crítica",
    },
    {
      key: "handoff",
      title: "Sala Handoff",
      description: "Contexto que precisa chegar ao próximo responsável sem perda de informação.",
      value: recentActivities.items.length,
      tone: recentActivities.items.length ? "info" : "neutral",
      href: "/operacao/handoff",
      owner: "Coordenador de turno",
      nextStep: "Registrar decisões e próximos passos",
    },
    {
      key: "activity",
      title: "Sala Rastro",
      description: "Eventos recentes, decisões manuais e histórico de execução do turno.",
      value: recentActivities.meta.total,
      tone: recentActivities.items.length ? "success" : "neutral",
      href: "/operacao/atividade",
      owner: "Todos os operadores",
      nextStep: "Revisar últimas decisões",
    },
  ];

  const actionPlan = buildActionPlan({
    breached: exceptionSummary.counts.breachedCount,
    dueSoon: exceptionSummary.counts.dueSoonCount,
    unassigned: exceptionSummary.counts.unassignedCount,
    pending: exceptionSummary.counts.pendingTriageCount,
    automationFailures: automationSummary.counts.failedRuns24h,
    nocRisk,
    sourceFailures: sourceFailures.length,
    reconciliationPending,
    topCase,
  });

  return (
    <NovaLitShell activeHref="/operacao/war-room">
      <main className="nova-war-page">
        <header className="nova-war-hero">
          <div>
            <span>Operação / War Room</span>
            <h1>War Room operacional e plano de ação</h1>
            <p>
              Transforme pendências, handoff, NOC, SLA, automações e reconciliação em uma reunião executiva
              de decisão com próximos responsáveis e ações objetivas.
            </p>
          </div>
          <div className="nova-war-hero-actions">
            <Link href="/operacao/war-room/export" className="nova-lit-button nova-lit-button-primary">
              Exportar plano
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório do turno
            </Link>
            <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
              Playbooks
            </Link>
            <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
              Handoff
            </Link>
            <Link href="/operacao/pendencias" className="nova-lit-button nova-lit-button-secondary">
              Pendências
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório do turno
            </Link>
            <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
              Comunicação
            </Link>
          </div>
        </header>

        <section className="nova-war-kpi-grid" aria-label="Resumo executivo do War Room">
          <Kpi
            label="Risco total"
            value={operationalRisk}
            detail="pontuação ponderada de SLA, NOC, automações e reconciliação"
            tone={operationalRisk > 35 ? "critical" : operationalRisk > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Salas em atenção"
            value={rooms.filter((item) => item.tone === "critical" || item.tone === "attention").length}
            detail={`${rooms.length} sala(s) monitoradas no painel`}
            tone={rooms.some((item) => item.tone === "critical") ? "critical" : rooms.some((item) => item.tone === "attention") ? "attention" : "success"}
          />
          <Kpi
            label="Plano de ação"
            value={actionPlan.filter((item) => item.priority > 0).length}
            detail={`${actionPlan.length} ação(ões) geradas automaticamente`}
            tone={actionPlan.some((item) => item.tone === "critical") ? "critical" : actionPlan.some((item) => item.priority > 0) ? "attention" : "success"}
          />
          <Kpi
            label="Último evento"
            value={recentActivities.items[0] ? formatDateTime(recentActivities.items[0].createdAt) : "-"}
            detail={`${formatNumber(recentActivities.meta.total)} evento(s) no rastro`}
            tone={recentActivities.items.length ? "info" : "neutral"}
          />
        </section>

        <section className="nova-war-layout">
          <div className="nova-war-main">
            <section className="nova-war-panel">
              <div className="nova-war-panel-head">
                <div>
                  <span>Salas executivas</span>
                  <h2>Mapa do War Room</h2>
                  <p>Cada sala concentra risco, dono sugerido e a próxima ação de contenção.</p>
                </div>
                <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
                  Preparar handoff
                </Link>
              </div>

              <div className="nova-war-room-grid">
                {rooms.map((room) => (
                  <Link key={room.key} href={room.href} className={`nova-war-room-card ${toneClass(room.tone)}`}>
                    <div>
                      <span>{room.title}</span>
                      <strong>{formatNumber(room.value)}</strong>
                    </div>
                    <p>{room.description}</p>
                    <dl>
                      <div>
                        <dt>Dono sugerido</dt>
                        <dd>{room.owner}</dd>
                      </div>
                      <div>
                        <dt>Próximo passo</dt>
                        <dd>{room.nextStep}</dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-war-panel">
              <div className="nova-war-panel-head">
                <div>
                  <span>Plano de ação</span>
                  <h2>Prioridades e responsáveis</h2>
                  <p>Ações ordenadas por impacto operacional para conduzir a reunião do War Room.</p>
                </div>
                <Link href="/operacao/war-room/export" className="nova-lit-button nova-lit-button-secondary">
                  Baixar CSV
                </Link>
              </div>

              <div className="nova-war-action-list">
                {actionPlan.map((item, index) => (
                  <article key={item.key} className={`nova-war-action ${toneClass(item.tone)}`}>
                    <div className="nova-war-action-rank">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.evidence}</p>
                      <small>{item.nextStep}</small>
                    </div>
                    <div className="nova-war-action-meta">
                      <Pill tone={item.tone}>{item.priority ? `prioridade ${item.priority}` : "monitorar"}</Pill>
                      <span>{item.owner}</span>
                      <small>{item.due}</small>
                      <Link href={item.href}>Abrir</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="nova-war-panel">
              <div className="nova-war-panel-head">
                <div>
                  <span>Fila crítica</span>
                  <h2>Casos que justificam sala aberta</h2>
                  <p>Recorte combinado de SLA estourado, vencendo, sem dono e triagem pendente.</p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Abrir fila
                </Link>
              </div>

              {priorityCases.length ? (
                <div className="nova-war-case-list">
                  {priorityCases.map((item) => (
                    <article key={item.id} className="nova-war-case">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>{sourceLabel(item)} · prioridade {item.priorityScore} · {queueLabel(item.queueKey)}</small>
                      </div>
                      <div className="nova-war-case-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>{dueLabel(item)}</Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>{item.assignee?.name || "sem dono"}</Pill>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-war-empty">
                  <strong>Nenhum caso crítico para sala aberta.</strong>
                  <p>Mantenha o War Room em monitoramento e registre contexto caso haja risco externo.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="nova-war-side">
            <section className="nova-war-panel">
              <div className="nova-war-panel-head is-compact">
                <div>
                  <span>Decisão</span>
                  <h2>Registrar plano</h2>
                  <p>Cria um evento manual no rastro operacional.</p>
                </div>
              </div>

              {isAdmin ? (
                <ActionForm
                  action={createWarRoomActivity}
                  className="nova-war-form"
                  submitLabel="Registrar decisão"
                  pendingLabel="Registrando..."
                >
                  <label>
                    <span>Resumo</span>
                    <input
                      name="title"
                      defaultValue={`War Room operacional - ${new Date().toLocaleDateString("pt-BR")}`}
                      placeholder="Resumo da decisão"
                    />
                  </label>
                  <label>
                    <span>Severidade</span>
                    <select name="severity" defaultValue={operationalRisk > 35 ? "high" : operationalRisk > 0 ? "medium" : "info"}>
                      <option value="info">Info</option>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </label>
                  <label>
                    <span>Plano</span>
                    <textarea
                      name="description"
                      rows={10}
                      defaultValue={[
                        `Risco total: ${operationalRisk}`,
                        `Salas em atenção: ${rooms.filter((item) => item.tone === "critical" || item.tone === "attention").map((item) => item.title).join(", ") || "nenhuma"}`,
                        `Ação 1: ${actionPlan[0]?.title || "monitorar"}`,
                        `Responsável sugerido: ${actionPlan[0]?.owner || "sem responsável"}`,
                        `Prazo: ${actionPlan[0]?.due || "monitorar"}`,
                        topCase ? `Caso principal: ${topCase.code} - ${topCase.title}` : "Sem caso principal.",
                      ].join("\n")}
                    />
                  </label>
                  <input type="hidden" name="userId" value={session.user?.id || ""} />
                  <input type="hidden" name="exceptionId" value={topCase?.id || ""} />
                </ActionForm>
              ) : (
                <div className="nova-war-empty">
                  <strong>Registro restrito a administradores.</strong>
                  <p>Usuários não administradores podem consultar a sala e exportar o plano.</p>
                </div>
              )}
            </section>

            <section className="nova-war-panel">
              <div className="nova-war-panel-head is-compact">
                <div>
                  <span>Rastro recente</span>
                  <h2>Últimos sinais</h2>
                </div>
              </div>

              {recentActivities.items.length ? (
                <div className="nova-war-timeline">
                  {recentActivities.items.slice(0, 6).map((item) => (
                    <article key={item.id}>
                      <Pill tone={severityTone(item.severity)}>{item.severity || item.kind}</Pill>
                      <strong>{item.title}</strong>
                      <p>{item.description || activityRefs(item)}</p>
                      <small>{formatDateTime(item.createdAt)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-war-empty">
                  <strong>Sem rastro recente.</strong>
                  <p>Registre uma decisão para documentar a reunião operacional.</p>
                </div>
              )}
            </section>

            <section className="nova-war-panel">
              <div className="nova-war-panel-head is-compact">
                <div>
                  <span>Atualização</span>
                  <h2>Dados usados</h2>
                </div>
              </div>
              <div className="nova-war-context">
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
