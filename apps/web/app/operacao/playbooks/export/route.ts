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

function sourceLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  return "";
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

    const playbooks = [
      ["SLA estourado", exceptionSummary.counts.breachedCount, "Líder de operação", "0-15 min", `${exceptionSummary.counts.breachedCount} caso(s) estourado(s)`, "/operacao/fila?view=breached", topCase ? `Começar por ${topCase.code}` : "Validar fila crítica"],
      ["NOC offline ou degradado", nocRisk, "NOC", "15-30 min", `${telemetry.counts.down} offline, ${sourceFailures.length} fonte(s) falhando`, "/monitoramento/sensores", "Validar fonte, host e vínculo"],
      ["Automação falhando", automationSummary.counts.failedRuns24h + automationSummary.counts.dueRules, "Operação / Automação", "até o fim do turno", `${automationSummary.counts.failedRuns24h} falha(s), ${automationSummary.counts.dueRules} vencida(s)`, "/operacao/automacoes", "Reprocessar ou justificar regra"],
      ["Reconciliação divergente", reconciliationPending, "Backoffice operacional", "planejar correção", `${reconciliationPending} divergência(s)`, "/operacao/reconciliacao", "Separar impacto operacional de backlog"],
      ["Fila sem dono", exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount, "Coordenador de turno", "antes do handoff", `${exceptionSummary.counts.unassignedCount} sem dono, ${exceptionSummary.counts.pendingTriageCount} em triagem`, "/operacao/fila?view=unassigned", "Atribuir responsável e fechar triagem"],
      ["Handoff crítico", operationalRisk, "Coordenador de turno", "fechamento do turno", `risco operacional ${operationalRisk}`, "/operacao/handoff", "Registrar decisão e exportar evidência"],
    ];

    const escalation = [
      ["Nível 1", "SLA vencendo, fila sem dono ou triagem pendente", "Operador do turno", "até 30 min", exceptionSummary.counts.dueSoonCount + exceptionSummary.counts.unassignedCount + exceptionSummary.counts.pendingTriageCount, "/operacao/fila"],
      ["Nível 2", "SLA estourado, NOC offline ou automação crítica falhando", "Líder de operação / NOC", "agora", exceptionSummary.counts.breachedCount + telemetry.counts.down + automationSummary.counts.failedRuns24h, "/operacao/war-room"],
      ["Nível 3", "Risco persiste após War Room ou depende de backoffice", "Coordenação operacional", "antes do próximo handoff", reconciliationPending + sourceFailures.length, "/operacao/handoff"],
    ];

    const csvRows = [
      ["Seção", "Indicador", "Valor", "Responsável", "Prazo", "Evidência", "Link", "Próximo passo"],
      ["Resumo", "Risco operacional", operationalRisk, "", formatExportDate(new Date().toISOString()), "", "", ""],
      ["Resumo", "Casos abertos", exceptionSummary.counts.openCount, "", "", "", "", ""],
      ["Resumo", "SLA estourado", exceptionSummary.counts.breachedCount, "", "", "", "", ""],
      ["Resumo", "Vencendo", exceptionSummary.counts.dueSoonCount, "", "", "", "", ""],
      ["Resumo", "Sem responsável", exceptionSummary.counts.unassignedCount, "", "", "", "", ""],
      ["Resumo", "Triagem pendente", exceptionSummary.counts.pendingTriageCount, "", "", "", "", ""],
      ["Resumo", "Falhas automação 24h", automationSummary.counts.failedRuns24h, "", "", "", "", ""],
      ["Resumo", "NOC em atenção", nocRisk, "", formatExportDate(telemetry.generatedAt), "", "", ""],
      ["Resumo", "Reconciliação pendente", reconciliationPending, "", formatExportDate(reconciliation.generatedAt || ""), "", "", ""],
      [],
      ["Playbooks", "Playbook", "Valor", "Responsável", "Prazo", "Evidência", "Link", "Próximo passo"],
      ...playbooks.map((item) => ["Playbook", ...item]),
      [],
      ["Escalonamento", "Nível", "Condição", "Responsável", "Prazo", "Valor", "Link"],
      ...escalation.map((item) => ["Escalonamento", ...item]),
      [],
      ["Casos", "Código", "Título", "Severidade", "Status", "Fila", "Prioridade", "Prazo", "Responsável", "Origem"],
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
        sourceLabel(item),
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
        "Content-Disposition": `attachment; filename="nova-playbooks-operacionais-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar os playbooks operacionais." },
      { status: 500 },
    );
  }
}
