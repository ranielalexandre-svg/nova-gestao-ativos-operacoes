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

type PlaybookStep = {
  label: string;
  description: string;
  href: string;
};

type Playbook = {
  key: string;
  title: string;
  trigger: string;
  value: number;
  tone: Tone;
  owner: string;
  deadline: string;
  evidence: string;
  href: string;
  steps: PlaybookStep[];
};

type EscalationRow = {
  level: string;
  condition: string;
  owner: string;
  deadline: string;
  evidence: string;
  href: string;
  tone: Tone;
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

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-playbooks-pill ${toneClass(tone)}`}>{children}</span>;
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
    <article className={`nova-playbooks-kpi ${toneClass(tone)}`}>
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
    `/activities${buildApiQuery({ pageSize: 10, sortBy: "createdAt", sortDir: "desc" })}`,
    emptyActivityPage,
  );
}

function buildPlaybookActivityPayload(formData: FormData) {
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

function playbookSummary(playbooks: Playbook[]) {
  const active = playbooks.filter((item) => item.value > 0);
  return {
    active,
    critical: active.filter((item) => item.tone === "critical").length,
    attention: active.filter((item) => item.tone === "attention").length,
  };
}

export default async function PlaybooksOperacionaisPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/playbooks");

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createPlaybookActivity(
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
        return { status: "error", message: "Informe o playbook executado." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify(buildPlaybookActivityPayload(formData)),
      });

      revalidatePath("/operacao/playbooks");
      revalidatePath("/operacao/atividade");
      revalidatePath("/operacao/war-room");
      revalidatePath("/operacao/handoff");
      revalidatePath("/operacao/pendencias");
      revalidatePath("/operacao/fila");

      return { status: "success", message: "Execução de playbook registrada no rastro operacional." };
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
    readExceptionQueue({ onlyBreached: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyDueSoon: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyUnassigned: "true", pageSize: 8, sortBy: "priorityScore", sortDir: "desc" }),
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

  const playbooks: Playbook[] = [
    {
      key: "sla-breach",
      title: "SLA estourado",
      trigger: "Caso com SLA vencido ou fora da janela de resolução.",
      value: exceptionSummary.counts.breachedCount,
      tone: riskTone(exceptionSummary.counts.breachedCount, true),
      owner: topCase?.assignee?.name || "Líder de operação",
      deadline: "0-15 min",
      evidence: `${formatNumber(exceptionSummary.counts.breachedCount)} caso(s) estourado(s)`,
      href: "/operacao/fila?view=breached",
      steps: [
        { label: "Confirmar impacto", description: "Abrir o caso mais crítico e validar cliente, unidade, fonte e prazo.", href: "/operacao/fila?view=breached" },
        { label: "Atribuir responsável", description: "Definir dono explícito antes de qualquer comunicação externa.", href: "/operacao/fila?view=unassigned" },
        { label: "Registrar decisão", description: "Criar evento no rastro com causa, ação e próxima atualização.", href: "/operacao/atividade" },
      ],
    },
    {
      key: "noc-offline",
      title: "NOC offline ou degradado",
      trigger: "Host offline, degradado, com problema aberto ou fonte sem leitura.",
      value: nocRisk,
      tone: riskTone(nocRisk, Boolean(telemetry.counts.down || sourceFailures.length)),
      owner: "NOC",
      deadline: "15-30 min",
      evidence: `${formatNumber(telemetry.counts.down)} offline, ${formatNumber(sourceFailures.length)} fonte(s) falhando`,
      href: "/monitoramento/sensores",
      steps: [
        { label: "Validar fonte", description: "Checar se a falha é do host, do vínculo ou da integração.", href: "/monitoramento/fontes" },
        { label: "Conferir unidade", description: "Revisar unidade, host e tag de correlação NOC.", href: "/monitoramento/sensores" },
        { label: "Gerar pendência", description: "Registrar exceção ou atividade se impactar SLA ou operação.", href: "/operacao/pendencias" },
      ],
    },
    {
      key: "automation-failure",
      title: "Automação falhando",
      trigger: "Regra com falha nas últimas 24h ou vencida para execução.",
      value: automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules,
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
      owner: "Operação / Automação",
      deadline: "até o fim do turno",
      evidence: `${formatNumber(automationSummary.counts.failedRuns24h)} falha(s), ${formatNumber(automationSummary.counts.dueRules)} regra(s) vencida(s)`,
      href: "/operacao/automacoes",
      steps: [
        { label: "Identificar regra", description: "Abrir automações e separar erro recorrente de erro pontual.", href: "/operacao/automacoes" },
        { label: "Reprocessar ou pausar", description: "Reprocessar quando seguro ou registrar justificativa operacional.", href: "/operacao/automacoes" },
        { label: "Documentar efeito", description: "Criar atividade vinculada ao caso ou à regra.", href: "/operacao/atividade" },
      ],
    },
    {
      key: "reconciliation",
      title: "Reconciliação divergente",
      trigger: "Unidade importada sem par, match fraco ou base atual sem correspondência.",
      value: reconciliationPending,
      tone: riskTone(reconciliationPending),
      owner: "Backoffice operacional",
      deadline: "planejar correção",
      evidence: `${formatNumber(reconciliationPending)} divergência(s)`,
      href: "/operacao/reconciliacao",
      steps: [
        { label: "Classificar divergência", description: "Separar impacto operacional de pendência administrativa.", href: "/operacao/reconciliacao" },
        { label: "Conferir vínculo técnico", description: "Cruzar unidade, sensor e fonte NOC quando houver reflexo em atendimento.", href: "/monitoramento/sensores" },
        { label: "Escalar backlog", description: "Enviar divergência não crítica para fila de saneamento.", href: "/operacao/handoff" },
      ],
    },
    {
      key: "ownership",
      title: "Fila sem dono",
      trigger: "Pendência aberta sem responsável ou sem triagem concluída.",
      value: exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount,
      tone: riskTone(exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount),
      owner: "Coordenador de turno",
      deadline: "antes do handoff",
      evidence: `${formatNumber(exceptionSummary.counts.unassignedCount)} sem dono, ${formatNumber(exceptionSummary.counts.pendingTriageCount)} em triagem`,
      href: "/operacao/fila?view=unassigned",
      steps: [
        { label: "Distribuir fila", description: "Atribuir responsável nos casos sem dono.", href: "/operacao/fila?view=unassigned" },
        { label: "Fechar triagem", description: "Definir severidade, fila e próximo passo.", href: "/operacao/fila?view=pending" },
        { label: "Preservar contexto", description: "Registrar decisão no rastro ou no handoff.", href: "/operacao/handoff" },
      ],
    },
    {
      key: "handoff-critical",
      title: "Handoff crítico",
      trigger: "Há risco ativo que precisa passar de turno com dono e próxima atualização.",
      value: operationalRisk,
      tone: operationalRisk > 35 ? "critical" : operationalRisk > 0 ? "attention" : "success",
      owner: "Coordenador de turno",
      deadline: "fechamento do turno",
      evidence: `risco operacional ${formatNumber(operationalRisk)}`,
      href: "/operacao/handoff",
      steps: [
        { label: "Consolidar prioridades", description: "Usar War Room para montar plano de ação.", href: "/operacao/war-room" },
        { label: "Registrar handoff", description: "Salvar resumo, dono, prazo e caso principal.", href: "/operacao/handoff" },
        { label: "Exportar evidência", description: "Baixar CSV para envio ao próximo responsável.", href: "/operacao/handoff/export" },
      ],
    },
  ];

  const summary = playbookSummary(playbooks);
  const escalationRows: EscalationRow[] = [
    {
      level: "Nível 1",
      condition: "SLA vencendo, fila sem dono ou triagem pendente",
      owner: "Operador do turno",
      deadline: "até 30 min",
      evidence: `${formatNumber(exceptionSummary.counts.dueSoonCount + exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount)} item(ns)`,
      href: "/operacao/fila",
      tone: riskTone(exceptionSummary.counts.dueSoonCount + exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount),
    },
    {
      level: "Nível 2",
      condition: "SLA estourado, NOC offline ou automação crítica falhando",
      owner: "Líder de operação / NOC",
      deadline: "agora",
      evidence: `${formatNumber(exceptionSummary.counts.breachedCount + telemetry.counts.down + automationSummary.counts.failedRuns24h)} item(ns) críticos`,
      href: "/operacao/war-room",
      tone: riskTone(exceptionSummary.counts.breachedCount + telemetry.counts.down + automationSummary.counts.failedRuns24h, true),
    },
    {
      level: "Nível 3",
      condition: "Risco persiste após War Room ou depende de backoffice",
      owner: "Coordenação operacional",
      deadline: "antes do próximo handoff",
      evidence: `${formatNumber(reconciliationPending + sourceFailures.length)} item(ns) estruturais`,
      href: "/operacao/handoff",
      tone: riskTone(reconciliationPending + sourceFailures.length),
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao/playbooks">
      <main className="nova-playbooks-page">
        <header className="nova-playbooks-hero">
          <div>
            <span>Operação / Playbooks</span>
            <h1>Playbooks operacionais e escalonamento</h1>
            <p>
              Roteiros práticos para transformar SLA, NOC, automações, reconciliação, fila e handoff
              em ações repetíveis com dono, prazo e evidência.
            </p>
          </div>
          <div className="nova-playbooks-hero-actions">
            <Link href="/operacao/playbooks/export" className="nova-lit-button nova-lit-button-primary">
              Exportar playbooks
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório do turno
            </Link>
            <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-secondary">
              War Room
            </Link>
            <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
              Handoff
            </Link>
            <Link href="/operacao/evidencias" className="nova-lit-button nova-lit-button-secondary">
              Evidências
            </Link>
          </div>
        </header>

        <section className="nova-playbooks-kpi-grid" aria-label="Resumo de playbooks">
          <Kpi
            label="Playbooks ativos"
            value={summary.active.length}
            detail={`${summary.critical} crítico(s), ${summary.attention} em atenção`}
            tone={summary.critical ? "critical" : summary.attention ? "attention" : "success"}
          />
          <Kpi
            label="Risco operacional"
            value={operationalRisk}
            detail="pontuação ponderada usada no handoff e War Room"
            tone={operationalRisk > 35 ? "critical" : operationalRisk > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Escalonamentos"
            value={escalationRows.filter((item) => item.tone !== "success").length}
            detail={`${escalationRows.length} níveis de resposta`}
            tone={escalationRows.some((item) => item.tone === "critical") ? "critical" : escalationRows.some((item) => item.tone === "attention") ? "attention" : "success"}
          />
          <Kpi
            label="Último rastro"
            value={activities.items[0] ? formatDateTime(activities.items[0].createdAt) : "-"}
            detail={`${formatNumber(activities.meta.total)} registro(s) recentes`}
            tone={activities.items.length ? "info" : "neutral"}
          />
        </section>

        <section className="nova-playbooks-layout">
          <div className="nova-playbooks-main">
            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head">
                <div>
                  <span>Catálogo</span>
                  <h2>Playbooks do turno</h2>
                  <p>Roteiros ordenados por risco operacional atual e gatilhos de execução.</p>
                </div>
                <Link href="/operacao/pendencias" className="nova-lit-button nova-lit-button-secondary">
                  Ver pendências
                </Link>
              </div>

              <div className="nova-playbooks-grid">
                {playbooks.map((item) => (
                  <article key={item.key} className={`nova-playbook-card ${toneClass(item.tone)}`}>
                    <div className="nova-playbook-card-head">
                      <div>
                        <span>{item.trigger}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                    <div className="nova-playbook-card-meta">
                      <Pill tone={item.tone}>{item.value ? "executar" : "monitorar"}</Pill>
                      <span>{item.owner}</span>
                      <small>{item.deadline}</small>
                    </div>
                    <p>{item.evidence}</p>
                    <ol>
                      {item.steps.map((step) => (
                        <li key={`${item.key}-${step.label}`}>
                          <Link href={step.href}>{step.label}</Link>
                          <small>{step.description}</small>
                        </li>
                      ))}
                    </ol>
                    <Link href={item.href} className="nova-playbook-card-action">
                      Abrir origem
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head">
                <div>
                  <span>Escalonamento</span>
                  <h2>Matriz de resposta</h2>
                  <p>Critérios objetivos para decidir quem assume e quando escalar o atendimento.</p>
                </div>
                <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-secondary">
                  Abrir War Room
                </Link>
              </div>

              <div className="nova-playbooks-escalation-list">
                {escalationRows.map((item) => (
                  <article key={item.level} className={`nova-playbooks-escalation ${toneClass(item.tone)}`}>
                    <div>
                      <span>{item.level}</span>
                      <strong>{item.condition}</strong>
                      <p>{item.evidence}</p>
                    </div>
                    <div>
                      <Pill tone={item.tone}>{item.deadline}</Pill>
                      <b>{item.owner}</b>
                      <Link href={item.href}>Abrir</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head">
                <div>
                  <span>Fila prioritária</span>
                  <h2>Casos usados pelos playbooks</h2>
                  <p>Recorte combinado de SLA estourado, vencendo, triagem pendente e sem dono.</p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Abrir fila
                </Link>
              </div>

              {priorityCases.length ? (
                <div className="nova-playbooks-case-list">
                  {priorityCases.map((item) => (
                    <article key={item.id} className="nova-playbooks-case">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>{sourceLabel(item)} · prioridade {item.priorityScore} · {queueLabel(item.queueKey)}</small>
                      </div>
                      <div className="nova-playbooks-case-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>{dueLabel(item)}</Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>{item.assignee?.name || "sem dono"}</Pill>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-playbooks-empty">
                  <strong>Nenhum caso crítico para execução de playbook.</strong>
                  <p>Mantenha os roteiros em monitoramento e registre atividade se houver contexto externo.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="nova-playbooks-side">
            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head is-compact">
                <div>
                  <span>Execução</span>
                  <h2>Registrar playbook</h2>
                  <p>Cria evento manual no rastro operacional.</p>
                </div>
              </div>

              {isAdmin ? (
                <ActionForm
                  action={createPlaybookActivity}
                  className="nova-playbooks-form"
                  submitLabel="Registrar execução"
                  pendingLabel="Registrando..."
                >
                  <label>
                    <span>Playbook</span>
                    <select name="title" defaultValue={`Playbook executado: ${playbooks.find((item) => item.value > 0)?.title || playbooks[0]?.title || "Operação"}`}>
                      {playbooks.map((item) => (
                        <option key={`select-${item.key}`} value={`Playbook executado: ${item.title}`}>
                          {item.title} · {formatNumber(item.value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Severidade</span>
                    <select name="severity" defaultValue={summary.critical ? "critical" : summary.attention ? "medium" : "info"}>
                      <option value="info">Info</option>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </label>
                  <label>
                    <span>Resumo da execução</span>
                    <textarea
                      name="description"
                      rows={10}
                      defaultValue={[
                        `Risco operacional: ${operationalRisk}`,
                        `Playbooks ativos: ${summary.active.map((item) => item.title).join(", ") || "nenhum"}`,
                        `Escalonamento recomendado: ${escalationRows.find((item) => item.tone === "critical")?.level || escalationRows.find((item) => item.tone === "attention")?.level || "monitoramento"}`,
                        `Caso principal: ${topCase ? `${topCase.code} - ${topCase.title}` : "sem caso principal"}`,
                        `Próximo passo: ${summary.active[0]?.steps[0]?.description || "monitorar painel"}`,
                      ].join("\n")}
                    />
                  </label>
                  <input type="hidden" name="userId" value={session.user?.id || ""} />
                  <input type="hidden" name="exceptionId" value={topCase?.id || ""} />
                </ActionForm>
              ) : (
                <div className="nova-playbooks-empty">
                  <strong>Registro restrito a administradores.</strong>
                  <p>Usuários não administradores podem consultar playbooks e exportar o catálogo.</p>
                </div>
              )}
            </section>

            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head is-compact">
                <div>
                  <span>Rastro</span>
                  <h2>Últimas decisões</h2>
                </div>
              </div>

              {activities.items.length ? (
                <div className="nova-playbooks-timeline">
                  {activities.items.slice(0, 6).map((item) => (
                    <Link key={item.id} href={activityLink(item)}>
                      <Pill tone={severityTone(item.severity)}>{item.severity || item.kind}</Pill>
                      <strong>{item.title}</strong>
                      <span>{item.description || activityRefs(item)}</span>
                      <small>{formatDateTime(item.createdAt)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="nova-playbooks-empty">
                  <strong>Sem rastro recente.</strong>
                  <p>Registre a execução de playbook quando houver decisão operacional.</p>
                </div>
              )}
            </section>

            <section className="nova-playbooks-panel">
              <div className="nova-playbooks-panel-head is-compact">
                <div>
                  <span>Dados usados</span>
                  <h2>Atualizações</h2>
                </div>
              </div>
              <div className="nova-playbooks-context">
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
