import { NextResponse } from "next/server";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import {
  emptyCommandCenter,
  emptyTelemetry,
  safeApiJson,
  type CommandCenter,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";

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
  actor: { name: string; email: string } | null;
  exceptionCase: { code: string; title: string } | null;
  automation: { code: string; name: string } | null;
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
  assignee: { name: string; email: string } | null;
  integration: { code: string; name: string } | null;
  occurrence: { code: string; title: string } | null;
  maintenance: { code: string; title: string } | null;
  unit: { code: string; name: string } | null;
};

type OperationalReconciliation = {
  generatedAt?: string | null;
  counts: {
    weakUnitMatches: number;
    unmatchedImportedUnits: number;
    unmatchedCurrentUnits: number;
  };
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
  generatedAt: null,
  counts: {
    weakUnitMatches: 0,
    unmatchedImportedUnits: 0,
    unmatchedCurrentUnits: 0,
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

async function readExceptionQueue(params: Record<string, string | number | undefined>) {
  return safeApiJson<PaginatedResponse<ExceptionRow>>(
    `/exceptions${buildApiQuery(params)}`,
    emptyExceptionPage,
  );
}

async function readActivities() {
  return safeApiJson<PaginatedResponse<ActivityRow>>(
    `/activities${buildApiQuery({ pageSize: 20, sortBy: "createdAt", sortDir: "desc" })}`,
    emptyActivityPage,
  );
}

function buildActionPlanRows({
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
}) {
  return [
    {
      sala: "SLA",
      acao: "Fechar risco de SLA antes da próxima janela",
      prioridade: breached * 5 + dueSoon * 3,
      dono: topCase?.assignee?.name || "Líder de operação",
      prazo: breached ? "Agora" : dueSoon ? "Ainda neste turno" : "Monitorar",
      evidencia: `${breached} estourado(s), ${dueSoon} vencendo`,
      proximo: topCase ? `Começar por ${topCase.code}` : "Manter fila monitorada",
    },
    {
      sala: "Fila",
      acao: "Remover itens sem dono ou sem triagem",
      prioridade: unassigned * 2 + pending * 2,
      dono: "Coordenador de turno",
      prazo: unassigned + pending ? "Antes do handoff" : "Sem bloqueio",
      evidencia: `${unassigned} sem dono, ${pending} em triagem`,
      proximo: "Atribuir responsável e fila de atendimento",
    },
    {
      sala: "NOC",
      acao: "Estabilizar sinais NOC e fontes",
      prioridade: nocRisk * 2 + sourceFailures * 3,
      dono: "NOC",
      prazo: nocRisk ? "Durante o turno" : "Sem bloqueio",
      evidencia: `${nocRisk} sinal(is) em atenção, ${sourceFailures} fonte(s) falhando`,
      proximo: "Validar sensores, fontes e vínculos de host",
    },
    {
      sala: "Automações",
      acao: "Reprocessar ou justificar falhas de automação",
      prioridade: automationFailures * 4,
      dono: "Operação / Automação",
      prazo: automationFailures ? "Antes de encerrar plantão" : "Sem bloqueio",
      evidencia: `${automationFailures} falha(s) nas últimas 24h`,
      proximo: "Reprocessar regra ou registrar exceção operacional",
    },
    {
      sala: "Reconciliação",
      acao: "Conter divergências de reconciliação",
      prioridade: reconciliationPending * 2,
      dono: "Backoffice operacional",
      prazo: reconciliationPending ? "Planejar correção" : "Sem bloqueio",
      evidencia: `${reconciliationPending} divergência(s)`,
      proximo: "Separar divergência crítica de backlog administrativo",
    },
  ].sort((a, b) => b.prioridade - a.prioridade || a.acao.localeCompare(b.acao));
}

export async function GET() {
  try {
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
      safeApiJson<UnitHostTelemetry>("/monitoring/unit-hosts?mode=fast", emptyTelemetry()),
      safeApiJson<OperationalReconciliation>("/operational-data/reconciliation", emptyReconciliation),
      readExceptionQueue({ onlyBreached: "true", pageSize: 20, sortBy: "priorityScore", sortDir: "desc" }),
      readExceptionQueue({ onlyDueSoon: "true", pageSize: 20, sortBy: "priorityScore", sortDir: "desc" }),
      readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 20, sortBy: "priorityScore", sortDir: "desc" }),
      readExceptionQueue({ onlyUnassigned: "true", pageSize: 20, sortBy: "priorityScore", sortDir: "desc" }),
      readActivities(),
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

    const cases = Array.from(
      new Map(
        [
          ...breachedCases.items,
          ...dueSoonCases.items,
          ...pendingCases.items,
          ...unassignedCases.items,
        ].map((item) => [item.id, item]),
      ).values(),
    ).sort((a, b) => b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt));

    const topCase = cases[0];

    const rooms = [
      ["SLA", exceptionSummary.counts.breachedCount + exceptionSummary.counts.dueSoonCount + exceptionSummary.counts.unassignedCount, topCase?.assignee?.name || "Líder de operação", topCase ? `Começar por ${topCase.code}` : "Acompanhar fila priorizada"],
      ["NOC", nocRisk, "NOC", "Validar sensores, fontes e vínculos"],
      ["Automações", automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules, "Operação / Automação", "Reprocessar ou justificar falhas"],
      ["Reconciliação", reconciliationPending, "Backoffice operacional", "Classificar divergência crítica"],
      ["Handoff", activities.items.length, "Coordenador de turno", "Registrar decisões e próximos passos"],
    ];

    const actionPlan = buildActionPlanRows({
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

    const csvRows = [
      ["Seção", "Indicador", "Valor", "Responsável", "Próximo passo"],
      ["Resumo", "Risco operacional", operationalRisk, "", formatExportDate(new Date().toISOString())],
      ["Resumo", "Casos abertos", exceptionSummary.counts.openCount, "", ""],
      ["Resumo", "SLA estourado", exceptionSummary.counts.breachedCount, "", ""],
      ["Resumo", "Vencendo", exceptionSummary.counts.dueSoonCount, "", ""],
      ["Resumo", "Sem responsável", exceptionSummary.counts.unassignedCount, "", ""],
      ["Resumo", "Triagem pendente", exceptionSummary.counts.pendingTriageCount, "", ""],
      ["Resumo", "Falhas automação 24h", automationSummary.counts.failedRuns24h, "", ""],
      ["Resumo", "NOC em atenção", nocRisk, "", formatExportDate(telemetry.generatedAt)],
      ["Resumo", "Reconciliação pendente", reconciliationPending, "", formatExportDate(reconciliation.generatedAt || "")],
      [],
      ["Salas", "Sala", "Valor", "Dono sugerido", "Próximo passo"],
      ...rooms.map((room) => ["Sala", room[0], room[1], room[2], room[3]]),
      [],
      ["Plano", "Ação", "Prioridade", "Dono sugerido", "Prazo", "Evidência", "Próximo passo"],
      ...actionPlan.map((item) => ["Ação", item.acao, item.prioridade, item.dono, item.prazo, item.evidencia, item.proximo]),
      [],
      ["Casos", "Código", "Título", "Severidade", "Status", "Fila", "Prioridade", "Prazo", "Responsável"],
      ...cases.map((item) => [
        "Caso",
        item.code,
        item.title,
        item.severity,
        item.status,
        item.queueKey,
        item.priorityScore,
        formatExportDate(item.resolveDueAt),
        item.assignee?.name || "",
      ]),
      [],
      ["Atividades", "Criado em", "Tipo", "Origem", "Severidade", "Título", "Ator", "Vínculo"],
      ...activities.items.map((item) => [
        "Atividade",
        formatExportDate(item.createdAt),
        item.kind,
        item.source,
        item.severity || "",
        item.title,
        item.actor?.name || "",
        item.exceptionCase?.code || item.automation?.code || "",
      ]),
    ];

    const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\n");
    const filenameDate = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nova-war-room-operacional-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar o War Room operacional." },
      { status: 500 },
    );
  }
}
