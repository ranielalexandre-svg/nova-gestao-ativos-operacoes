import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";

export type SuiteKind = "evidencias" | "pos-incidente" | "auditoria-operacional" | "comunicacao-turno";
export type Tone = "neutral" | "info" | "success" | "attention" | "critical";

export type ExceptionSummary = {
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

export type AutomationSummary = {
  counts: {
    enabledRules: number;
    failedRuns24h: number;
    dueRules: number;
  };
};

export type ExceptionRow = {
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
  assignee: { id?: string; name: string; email?: string; role?: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count?: { comments: number; activities: number };
};

export type ActivityRow = {
  id: string;
  kind: string;
  source: string;
  title: string;
  description: string | null;
  severity: string | null;
  createdAt: string;
  updatedAt?: string;
  actor: { id?: string; name: string; email?: string; role?: string } | null;
  exceptionCase: { id: string; code: string; title: string; status?: string } | null;
  automation: { id: string; code: string; name: string; detector?: string } | null;
  automationRun?: { id: string; status: string; startedAt: string; finishedAt: string | null } | null;
  partner?: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment?: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
};

export type OperationalReconciliation = {
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

export type EvidenceItem = {
  key: string;
  area: string;
  title: string;
  description: string;
  status: "suficiente" | "pendente" | "ausente";
  value: number;
  tone: Tone;
  owner: string;
  nextStep: string;
  href: string;
};

export type PostIncidentItem = {
  key: string;
  title: string;
  detail: string;
  owner: string;
  href: string;
  tone: Tone;
};

export type CommunicationItem = {
  audience: string;
  channel: string;
  tone: Tone;
  subject: string;
  body: string;
};

export type AuditItem = {
  key: string;
  label: string;
  value: number | string;
  detail: string;
  href: string;
  tone: Tone;
};

export type SuiteSnapshot = {
  commandCenter: CommandCenter;
  exceptionSummary: ExceptionSummary;
  automationSummary: AutomationSummary;
  telemetry: UnitHostTelemetry;
  reconciliation: OperationalReconciliation;
  breachedCases: PaginatedResponse<ExceptionRow>;
  dueSoonCases: PaginatedResponse<ExceptionRow>;
  pendingCases: PaginatedResponse<ExceptionRow>;
  unassignedCases: PaginatedResponse<ExceptionRow>;
  activities: PaginatedResponse<ActivityRow>;
  priorityCases: ExceptionRow[];
  topCase?: ExceptionRow;
  operationalRisk: number;
  reportScore: number;
  nocRisk: number;
  reconciliationPending: number;
  sourceFailures: UnitHostTelemetry["sources"];
  evidenceItems: EvidenceItem[];
  postIncidentItems: PostIncidentItem[];
  communicationItems: CommunicationItem[];
  auditItems: AuditItem[];
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

export const suiteMeta: Record<SuiteKind, {
  label: string;
  title: string;
  subtitle: string;
  activeHref: string;
  exportHref: string;
  nextHref: string;
  nextLabel: string;
}> = {
  evidencias: {
    label: "Operação / Evidências",
    title: "Evidências operacionais",
    subtitle: "Centralize provas, vínculos, decisões e lacunas de evidência por caso, turno, NOC, automação e reconciliação.",
    activeHref: "/operacao/relatorio-turno",
    exportHref: "/operacao/relatorio-turno/export",
    nextHref: "/operacao/war-room",
    nextLabel: "Pós-incidente",
  },
  "pos-incidente": {
    label: "Operação / Pós-incidente",
    title: "Pós-incidente operacional",
    subtitle: "Monte causa provável, impacto, detecção, resposta, contenção, correção e prevenção com base no rastro real do turno.",
    activeHref: "/operacao/war-room",
    exportHref: "/operacao/war-room/export",
    nextHref: "/operacao/atividade",
    nextLabel: "Auditoria",
  },
  "auditoria-operacional": {
    label: "Operação / Auditoria",
    title: "Auditoria operacional",
    subtitle: "Rastreie decisões, responsáveis, evidências, eventos manuais, automações e pontos ausentes antes do fechamento.",
    activeHref: "/operacao/atividade",
    exportHref: "/operacao/atividade",
    nextHref: "/operacao/handoff",
    nextLabel: "Comunicação",
  },
  "comunicacao-turno": {
    label: "Operação / Comunicação",
    title: "Comunicação do turno",
    subtitle: "Gere mensagens prontas para gestor, NOC, backoffice e próximo operador com risco residual e próximos passos.",
    activeHref: "/operacao/handoff",
    exportHref: "/operacao/handoff/export",
    nextHref: "/operacao/relatorio-turno",
    nextLabel: "Relatório",
  },
};

export function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR");
}

export function toneClass(tone: Tone) {
  return `is-${tone}`;
}

export function riskTone(value: number, critical = false): Tone {
  if (!value) return "success";
  return critical ? "critical" : "attention";
}

export function severityTone(value?: string | null): Tone {
  if (!value) return "neutral";
  if (["critical", "high", "error"].includes(value)) return "critical";
  if (["medium", "warning"].includes(value)) return "attention";
  if (["low", "info", "automation"].includes(value)) return "info";
  if (["success", "resolved"].includes(value)) return "success";
  return "neutral";
}

export function sourceLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

export function activityRefs(item: ActivityRow) {
  const refs: string[] = [];
  if (item.exceptionCase) refs.push(`exceção ${item.exceptionCase.code}`);
  if (item.automation) refs.push(`regra ${item.automation.code}`);
  if (item.integration) refs.push(`integração ${item.integration.code}`);
  if (item.occurrence) refs.push(`alerta ${item.occurrence.code}`);
  if (item.maintenance) refs.push(`chamado ${item.maintenance.code}`);
  if (item.unit) refs.push(`unidade ${item.unit.code}`);
  if (item.partner) refs.push(`parceiro ${item.partner.code}`);
  if (item.equipment) refs.push(`ativo ${item.equipment.tag}`);
  return refs.length ? refs.join(" · ") : "sem vínculo";
}

export function activityLink(item: ActivityRow) {
  if (item.exceptionCase) return `/operacao/excecoes/${item.exceptionCase.id}`;
  if (item.automation) return "/operacao/automacoes";
  if (item.integration) return "/monitoramento/fontes";
  if (item.occurrence) return `/alertas/${item.occurrence.id}`;
  if (item.maintenance) return `/chamados/${item.maintenance.id}`;
  if (item.unit) return `/unidades/${item.unit.id}`;
  return "/operacao/atividade";
}

export function dueLabel(item: ExceptionRow) {
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

function reportHealthLabel(score: number) {
  if (score >= 85) return "Turno controlado";
  if (score >= 65) return "Turno com atenção";
  return "Turno crítico";
}

function evidenceStatus(value: number, important = false): EvidenceItem["status"] {
  if (!value) return important ? "ausente" : "suficiente";
  return important ? "pendente" : "suficiente";
}

async function readExceptionQueue(params: Record<string, string | number | undefined>) {
  return safeApiJson<PaginatedResponse<ExceptionRow>>(
    `/exceptions${buildApiQuery(params)}`,
    emptyExceptionPage,
  );
}

async function readActivities(pageSize = 18) {
  return safeApiJson<PaginatedResponse<ActivityRow>>(
    `/activities${buildApiQuery({ pageSize, sortBy: "createdAt", sortDir: "desc" })}`,
    emptyActivityPage,
  );
}

export async function readSuiteSnapshot(): Promise<SuiteSnapshot> {
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
    readExceptionQueue({ onlyBreached: "true", pageSize: 14, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyDueSoon: "true", pageSize: 14, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 14, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyUnassigned: "true", pageSize: 14, sortBy: "priorityScore", sortDir: "desc" }),
    readActivities(18),
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
    .slice(0, 18);

  const topCase = priorityCases[0];
  const reportScore = Math.max(0, Math.min(100, 100 - operationalRisk));

  const evidenceItems: EvidenceItem[] = [
    {
      key: "case",
      area: "Casos",
      title: "Caso principal documentado",
      description: topCase ? `${topCase.code} · ${topCase.title}` : "Nenhum caso crítico encontrado no recorte.",
      status: topCase ? "suficiente" : "ausente",
      value: topCase ? 1 : 0,
      tone: topCase ? severityTone(topCase.severity) : "attention",
      owner: topCase?.assignee?.name || "Coordenador de turno",
      nextStep: topCase ? "Validar evidências e causa provável" : "Manter monitoramento",
      href: topCase ? `/operacao/excecoes/${topCase.id}` : "/operacao/fila",
    },
    {
      key: "sla",
      area: "SLA",
      title: "SLA e prazos registrados",
      description: `${formatNumber(exceptionSummary.counts.breachedCount)} estourado(s), ${formatNumber(exceptionSummary.counts.dueSoonCount)} vencendo`,
      status: evidenceStatus(exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount, true),
      value: exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount,
      tone: riskTone(exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount, Boolean(exceptionSummary.counts.breachedCount)),
      owner: "Líder de operação",
      nextStep: "Garantir dono, prazo e justificativa no rastro",
      href: "/operacao/fila",
    },
    {
      key: "noc",
      area: "NOC",
      title: "Telemetria e fontes NOC",
      description: `${formatNumber(nocRisk)} sinal(is) em atenção; ${formatNumber(sourceFailures.length)} fonte(s) falhando`,
      status: evidenceStatus(nocRisk, true),
      value: nocRisk,
      tone: riskTone(nocRisk, Boolean(telemetry.counts.down || sourceFailures.length)),
      owner: "NOC",
      nextStep: "Anexar leitura, fonte e vínculo técnico",
      href: "/monitoramento/sensores",
    },
    {
      key: "automation",
      area: "Automação",
      title: "Automação e reprocessamento",
      description: `${formatNumber(automationSummary.counts.failedRuns24h)} falha(s) em 24h; ${formatNumber(automationSummary.counts.dueRules)} regra(s) vencida(s)`,
      status: evidenceStatus(automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules, true),
      value: automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules,
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
      owner: "Operação / Automação",
      nextStep: "Registrar reprocessamento, pausa ou justificativa",
      href: "/operacao/automacoes",
    },
    {
      key: "reconciliation",
      area: "Reconciliação",
      title: "Divergências de base",
      description: `${formatNumber(reconciliationPending)} divergência(s), incluindo match fraco e unidades sem par`,
      status: evidenceStatus(reconciliationPending, false),
      value: reconciliationPending,
      tone: riskTone(reconciliationPending),
      owner: "Backoffice operacional",
      nextStep: "Separar risco operacional de backlog administrativo",
      href: "/operacao/reconciliacao",
    },
    {
      key: "activity",
      area: "Rastro",
      title: "Decisões no rastro",
      description: `${formatNumber(activities.items.filter((item) => item.source === "manual").length)} evento(s) manual(is) nesta página`,
      status: activities.items.length ? "suficiente" : "ausente",
      value: activities.items.length,
      tone: activities.items.length ? "success" : "attention",
      owner: "Operação",
      nextStep: "Registrar evidência manual se houver decisão fora do sistema",
      href: "/operacao/atividade",
    },
  ];

  const postIncidentItems: PostIncidentItem[] = [
    {
      key: "impact",
      title: "Impacto",
      detail: topCase ? `${topCase.code}: ${topCase.title}` : `${formatNumber(exceptionSummary.counts.openCount)} caso(s) aberto(s) no recorte.`,
      owner: topCase?.assignee?.name || "Operação",
      href: topCase ? `/operacao/excecoes/${topCase.id}` : "/operacao/pendencias",
      tone: topCase ? severityTone(topCase.severity) : "neutral",
    },
    {
      key: "detection",
      title: "Detecção",
      detail: nocRisk ? `NOC acusa ${formatNumber(nocRisk)} sinal(is) em atenção.` : "Sem sinal NOC crítico no momento.",
      owner: "NOC",
      href: "/monitoramento/sensores",
      tone: riskTone(nocRisk, Boolean(telemetry.counts.down)),
    },
    {
      key: "response",
      title: "Resposta",
      detail: `${formatNumber(activities.items.length)} evento(s) recentes sustentam a linha do tempo.`,
      owner: "Operação",
      href: "/operacao/atividade",
      tone: activities.items.length ? "success" : "attention",
    },
    {
      key: "containment",
      title: "Contenção",
      detail: exceptionSummary.counts.breachedCount
        ? "Priorizar SLA estourado antes de encerrar o turno."
        : "Sem contenção crítica de SLA no recorte.",
      owner: "Líder de operação",
      href: "/operacao/war-room",
      tone: riskTone(exceptionSummary.counts.breachedCount, true),
    },
    {
      key: "correction",
      title: "Correção",
      detail: reconciliationPending
        ? `${formatNumber(reconciliationPending)} divergência(s) precisam de correção de base.`
        : "Reconciliação sem divergência operacional crítica.",
      owner: "Backoffice operacional",
      href: "/operacao/reconciliacao",
      tone: riskTone(reconciliationPending),
    },
    {
      key: "prevention",
      title: "Prevenção",
      detail: automationSummary.counts.failedRuns24h
        ? "Revisar regra de automação para evitar reincidência."
        : "Sem falha de automação recorrente no recorte.",
      owner: "Operação / Automação",
      href: "/operacao/automacoes",
      tone: riskTone(automationSummary.counts.failedRuns24h, true),
    },
  ];

  const communicationItems: CommunicationItem[] = [
    {
      audience: "Gestor",
      channel: "Resumo executivo",
      tone: reportScore >= 85 ? "success" : reportScore >= 65 ? "attention" : "critical",
      subject: `${reportHealthLabel(reportScore)} · score ${formatNumber(reportScore)}`,
      body: `Risco operacional ${formatNumber(operationalRisk)}. ${topCase ? `Caso principal: ${topCase.code} - ${topCase.title}.` : "Sem caso principal crítico."} Próximos passos em War Room, evidências e handoff.`,
    },
    {
      audience: "NOC",
      channel: "Ação técnica",
      tone: riskTone(nocRisk, Boolean(telemetry.counts.down || sourceFailures.length)),
      subject: `${formatNumber(nocRisk)} sinal(is) NOC em atenção`,
      body: `Validar ${formatNumber(telemetry.counts.down)} host(s) offline, ${formatNumber(sourceFailures.length)} fonte(s) com falha e vínculos pendentes antes do fechamento.`,
    },
    {
      audience: "Backoffice",
      channel: "Reconciliação",
      tone: riskTone(reconciliationPending),
      subject: `${formatNumber(reconciliationPending)} divergência(s) de base`,
      body: `Separar correção operacional de saneamento administrativo. Priorizar impactos ligados a unidades, sensores e atendimentos ativos.`,
    },
    {
      audience: "Próximo operador",
      channel: "Handoff",
      tone: operationalRisk > 35 ? "critical" : operationalRisk ? "attention" : "success",
      subject: `Handoff com risco ${formatNumber(operationalRisk)}`,
      body: `Priorizar SLA, NOC, automações e evidências pendentes. ${topCase ? `Começar por ${topCase.code}.` : "Sem caso crítico principal."}`,
    },
  ];

  const auditItems: AuditItem[] = [
    {
      key: "manual",
      label: "Eventos manuais",
      value: activities.items.filter((item) => item.source === "manual").length,
      detail: "decisões registradas explicitamente por operador",
      href: "/operacao/atividade?source=manual",
      tone: activities.items.some((item) => item.source === "manual") ? "success" : "attention",
    },
    {
      key: "automation",
      label: "Eventos de automação",
      value: activities.items.filter((item) => item.automation || item.source === "automation").length,
      detail: "execuções e rastros automatizados",
      href: "/operacao/automacoes",
      tone: activities.items.some((item) => item.automation || item.source === "automation") ? "info" : "neutral",
    },
    {
      key: "cases",
      label: "Casos vinculados",
      value: activities.items.filter((item) => item.exceptionCase).length,
      detail: "eventos conectados a exceções operacionais",
      href: "/operacao/excecoes",
      tone: activities.items.some((item) => item.exceptionCase) ? "success" : "attention",
    },
    {
      key: "critical",
      label: "Alta atenção",
      value: activities.items.filter((item) => ["high", "critical"].includes(item.severity || "")).length,
      detail: "eventos com severidade alta ou crítica",
      href: "/operacao/atividade?severity=critical",
      tone: activities.items.some((item) => ["high", "critical"].includes(item.severity || "")) ? "critical" : "success",
    },
    {
      key: "evidence",
      label: "Evidência pendente",
      value: evidenceItems.filter((item) => item.status !== "suficiente").length,
      detail: "lacunas antes do fechamento pós-incidente",
      href: "/operacao/relatorio-turno",
      tone: evidenceItems.some((item) => item.status === "ausente") ? "critical" : evidenceItems.some((item) => item.status === "pendente") ? "attention" : "success",
    },
  ];

  return {
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
    priorityCases,
    topCase,
    operationalRisk,
    reportScore,
    nocRisk,
    reconciliationPending,
    sourceFailures,
    evidenceItems,
    postIncidentItems,
    communicationItems,
    auditItems,
  };
}

function csvCell(value: string | number | boolean | undefined | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function formatExportDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Araguaina",
  }).format(date);
}

export async function createSuiteActivity(
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
      return { status: "error", message: "Informe um resumo para registrar no rastro operacional." };
    }

    await apiJson("/activities", {
      method: "POST",
      body: JSON.stringify({
        title,
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
      }),
    });

    for (const path of [
      "/operacao/relatorio-turno",
      "/operacao/war-room",
      "/operacao/atividade",
      "/operacao/handoff",
      "/operacao/relatorio-turno",
      "/operacao/atividade",
      "/operacao/handoff",
      "/operacao/war-room",
      "/operacao/playbooks",
      "/operacao/pendencias",
    ]) {
      revalidatePath(path);
    }

    return { status: "success", message: "Registro criado no rastro operacional." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function exportSuiteCsv(kind: SuiteKind) {
  try {
    const snapshot = await readSuiteSnapshot();
    const meta = suiteMeta[kind];

    const rows = [
      ["Seção", "Indicador", "Valor", "Detalhe", "Link"],
      ["Resumo", "Tela", meta.title, meta.subtitle, meta.activeHref],
      ["Resumo", "Risco operacional", snapshot.operationalRisk, formatExportDate(new Date().toISOString()), "/operacao/war-room"],
      ["Resumo", "Score do turno", snapshot.reportScore, reportHealthLabel(snapshot.reportScore), "/operacao/relatorio-turno"],
      ["Resumo", "Casos abertos", snapshot.exceptionSummary.counts.openCount, "", "/operacao/pendencias"],
      ["Resumo", "SLA estourado", snapshot.exceptionSummary.counts.breachedCount, "", "/operacao/fila"],
      ["Resumo", "NOC em atenção", snapshot.nocRisk, formatExportDate(snapshot.telemetry.generatedAt), "/monitoramento/sensores"],
      ["Resumo", "Reconciliação pendente", snapshot.reconciliationPending, formatExportDate(snapshot.reconciliation.generatedAt || ""), "/operacao/reconciliacao"],
      [],
      ["Evidências", "Área", "Status", "Valor", "Responsável", "Próximo passo", "Link"],
      ...snapshot.evidenceItems.map((item) => [
        "Evidência",
        item.area,
        item.status,
        item.value,
        item.owner,
        item.nextStep,
        item.href,
      ]),
      [],
      ["Pós-incidente", "Etapa", "Detalhe", "Responsável", "Link"],
      ...snapshot.postIncidentItems.map((item) => [
        "Pós-incidente",
        item.title,
        item.detail,
        item.owner,
        item.href,
      ]),
      [],
      ["Auditoria", "Indicador", "Valor", "Detalhe", "Link"],
      ...snapshot.auditItems.map((item) => [
        "Auditoria",
        item.label,
        item.value,
        item.detail,
        item.href,
      ]),
      [],
      ["Comunicação", "Público", "Canal", "Assunto", "Mensagem"],
      ...snapshot.communicationItems.map((item) => [
        "Comunicação",
        item.audience,
        item.channel,
        item.subject,
        item.body,
      ]),
      [],
      ["Casos", "Código", "Título", "Severidade", "Status", "Prioridade", "Prazo", "Responsável", "Origem"],
      ...snapshot.priorityCases.map((item) => [
        "Caso",
        item.code,
        item.title,
        item.severity,
        item.status,
        item.priorityScore,
        formatExportDate(item.resolveDueAt),
        item.assignee?.name || "",
        sourceLabel(item),
      ]),
      [],
      ["Atividades", "Criado em", "Tipo", "Origem", "Severidade", "Título", "Ator", "Vínculo"],
      ...snapshot.activities.items.map((item) => [
        "Atividade",
        formatExportDate(item.createdAt),
        item.kind,
        item.source,
        item.severity || "",
        item.title,
        item.actor?.name || "",
        activityRefs(item),
      ]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const filenameDate = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nova-${kind}-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar a suíte pós-incidente." },
      { status: 500 },
    );
  }
}
