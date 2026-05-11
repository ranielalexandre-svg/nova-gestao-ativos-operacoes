import { NextResponse } from "next/server";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";

type RuleRow = {
  code: string;
  name: string;
  detector: string;
  severity: string;
  cadence: string;
  enabled: boolean;
  createExceptions: boolean;
  createActivities: boolean;
  resolveOnRecovery: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  _count: {
    runs: number;
    exceptionCases: number;
  };
};

type RunRow = {
  status: string;
  startedAt: string;
  finishedAt: string | null;
  hitsCount: number;
  createdCount: number;
  updatedCount: number;
  summary: string | null;
  errorMessage: string | null;
  rule: {
    code: string;
    name: string;
  };
};

function readOptional(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
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

function detectorLabel(value: string) {
  if (value === "maintenance_overdue") return "Chamado vencido";
  if (value === "critical_open_occurrence") return "Alerta crítico";
  if (value === "aged_open_occurrence") return "Alerta antigo";
  if (value === "integration_failure") return "Falha integração";
  if (value === "monitoring_report_export") return "Relatório automático";
  return value || "-";
}

function statusLabel(value: string) {
  if (value === "success") return "Sucesso";
  if (value === "error") return "Erro";
  if (value === "running") return "Executando";
  return value || "-";
}

function cadenceLabel(value: string) {
  if (value === "every_5_minutes") return "a cada 5 min";
  if (value === "every_15_minutes") return "a cada 15 min";
  if (value === "hourly") return "hora em hora";
  if (value === "daily") return "diária";
  if (value === "weekly") return "semanal";
  return value.replaceAll("_", " ");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = readOptional(url.searchParams, "q");
    const detector = readOptional(url.searchParams, "detector");
    const enabled = readOptional(url.searchParams, "enabled");

    const rules: RuleRow[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 50) {
      const response = await apiJson<PaginatedResponse<RuleRow>>(
        `/automations${buildApiQuery({
          q,
          detector: detector && detector !== "all" ? detector : undefined,
          enabled: enabled && enabled !== "all" ? enabled : undefined,
          sortBy: "code",
          sortDir: "asc",
          page,
          pageSize: 100,
        })}`,
      );
      rules.push(...response.items);
      hasNext = response.meta.hasNext;
      page += 1;
    }

    const runsResponse = await apiJson<PaginatedResponse<RunRow>>(
      "/automations/runs?page=1&pageSize=100&sortDir=desc",
    );

    const header = [
      "Seção",
      "Código",
      "Nome",
      "Detector",
      "Status",
      "Cadência/Duração",
      "Próxima/Início",
      "Última/Fim",
      "Registros",
      "Criadas",
      "Atualizadas",
      "Runs",
      "Exceções",
      "Efeitos",
      "Resumo",
    ];

    const ruleRows = rules.map((item) => [
      "Regra",
      item.code,
      item.name,
      detectorLabel(item.detector),
      item.enabled ? "Ativa" : "Pausada",
      cadenceLabel(item.cadence),
      formatExportDate(item.nextRunAt),
      formatExportDate(item.lastRunAt),
      "",
      "",
      "",
      item._count.runs,
      item._count.exceptionCases,
      [
        item.createExceptions ? "cria exceções" : "",
        item.createActivities ? "cria atividades" : "",
        item.resolveOnRecovery ? "resolve na recuperação" : "",
      ].filter(Boolean).join("; "),
      item.severity,
    ]);

    const runRows = runsResponse.items.map((item) => [
      "Execução",
      item.rule.code,
      item.rule.name,
      "",
      statusLabel(item.status),
      item.finishedAt ? `${Math.max(0, Math.round((new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 1000))}s` : "em andamento",
      formatExportDate(item.startedAt),
      formatExportDate(item.finishedAt),
      item.hitsCount,
      item.createdCount,
      item.updatedCount,
      "",
      item.status === "error" ? 1 : 0,
      "",
      item.errorMessage || item.summary || "",
    ]);

    const csv = [header, ...ruleRows, ...runRows].map((row) => row.map(csvCell).join(",")).join("\n");
    const filenameDate = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nova-automacao-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar automações." },
      { status: 500 },
    );
  }
}
