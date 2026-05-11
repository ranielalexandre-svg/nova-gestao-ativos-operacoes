import { NextResponse } from "next/server";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";

type ExceptionRow = {
  code: string;
  title: string;
  kind: string;
  severity: string;
  status: string;
  queueKey: string;
  priorityScore: number;
  createdAt: string;
  updatedAt: string;
  assignee: { name: string; email: string } | null;
};

function readOptional(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
}

function csvCell(value: string | number | undefined | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function label(map: Record<string, string>, value: string) {
  return map[value] || value || "-";
}

function formatExportDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Araguaina",
  }).format(date);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = readOptional(url.searchParams, "q");
    const kind = readOptional(url.searchParams, "kind");
    const severity = readOptional(url.searchParams, "severity");
    const status = readOptional(url.searchParams, "status");
    const triageStatus = readOptional(url.searchParams, "triageStatus");
    const queueKey = readOptional(url.searchParams, "queueKey");

    const items: ExceptionRow[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 50) {
      const response = await apiJson<PaginatedResponse<ExceptionRow>>(
        `/exceptions${buildApiQuery({
          q,
          kind: kind && kind !== "all" ? kind : undefined,
          severity: severity && severity !== "all" ? severity : undefined,
          status: status && status !== "all" ? status : undefined,
          triageStatus: triageStatus && triageStatus !== "all" ? triageStatus : undefined,
          queueKey,
          sortBy: "priorityScore",
          sortDir: "desc",
          page,
          pageSize: 100,
        })}`,
      );
      items.push(...response.items);
      hasNext = response.meta.hasNext;
      page += 1;
    }

    const header = [
      "Código",
      "Título",
      "Categoria",
      "Severidade",
      "Status",
      "Fila",
      "Prioridade",
      "Responsável",
      "Criado em",
      "Atualizado em",
    ];
    const rows = items.map((item) => [
      item.code,
      item.title,
      label({ generic: "Geral", sla: "SLA", integration: "Integração", occurrence: "Alerta", maintenance: "Chamado", automation: "Automação" }, item.kind),
      label({ low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" }, item.severity),
      label({ open: "Aberta", acknowledged: "Reconhecida", resolved: "Resolvida", silenced: "Silenciada" }, item.status),
      label({ "ops-general": "Geral", "ops-integracoes": "Integrações", "ops-ocorrencias": "Alertas", "ops-manutencao": "Chamados", "ops-sla": "SLA", "ops-automacoes": "Automações" }, item.queueKey),
      item.priorityScore,
      item.assignee ? `${item.assignee.name} <${item.assignee.email}>` : "Sem responsável",
      formatExportDate(item.createdAt),
      formatExportDate(item.updatedAt),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const filenameDate = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nova-excecoes-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar as exceções." },
      { status: 500 },
    );
  }
}
