import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
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
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "calendar"
  | "check"
  | "clock"
  | "database"
  | "download"
  | "file"
  | "gear"
  | "home"
  | "import"
  | "integration"
  | "list"
  | "map"
  | "menu"
  | "moon"
  | "play"
  | "refresh"
  | "search"
  | "shield"
  | "trash"
  | "user"
  | "users";
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

type IntegrationRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  updatedAt: string;
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

const emptyIntegrationsResponse: PaginatedResponse<IntegrationRow> = {
  items: [],
  meta: {
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  switch (name) {
    case "home":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 22 20H2L12 3z" /><path {...common} d="M12 9v5M12 17h.01" /></svg>;
    case "bell":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path {...common} d="M10 21h4" /></svg>;
    case "calendar":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" /></svg>;
    case "check":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m8 12 3 3 5-6" /></svg>;
    case "clock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M12 7v5l3 2" /></svg>;
    case "database":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse {...common} cx="12" cy="5" rx="7" ry="3" /><path {...common} d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>;
    case "download":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v12" /><path {...common} d="m8 11 4 4 4-4" /><path {...common} d="M4 21h16" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
    case "gear":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "import":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 21V9" /><path {...common} d="m8 13 4-4 4 4" /><path {...common} d="M4 3h16" /></svg>;
    case "integration":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v18M3 12h18" /><circle {...common} cx="12" cy="12" r="3" /><circle {...common} cx="12" cy="3" r="1.5" /><circle {...common} cx="12" cy="21" r="1.5" /><circle {...common} cx="3" cy="12" r="1.5" /><circle {...common} cx="21" cy="12" r="1.5" /></svg>;
    case "list":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 6h11M9 12h11M9 18h11" /><path {...common} d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case "map":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" /></svg>;
    case "menu":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "moon":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12.8A8 8 0 1 1 11.2 3a6.2 6.2 0 0 0 9.8 9.8z" /></svg>;
    case "play":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m8 5 11 7-11 7V5z" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path {...common} d="M3 12A9 9 0 0 1 18.5 5.7L21 8" /></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="11" cy="11" r="7" /><path {...common} d="m16 16 4 4" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "trash":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>;
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M19 8v6M22 11h-6" /></svg>;
    case "user":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

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
  return <span className={`nova-automation-workflow-dot is-${tone}`} />;
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-automation-workflow-kpi is-${tone}`}>
      <div>
        <Icon name={icon} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function WorkflowStep({
  index,
  icon,
  title,
  state,
  detail,
  metric,
  tone,
  active,
  progress,
}: {
  index: number;
  icon: IconName;
  title: string;
  state: string;
  detail: string;
  metric: string;
  tone: Tone;
  active?: boolean;
  progress?: number;
}) {
  const safeProgress = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <article className={`nova-automation-workflow-step is-${tone}${active ? " is-active" : ""}`}>
      <div className="nova-automation-workflow-step-top">
        <span>{index}</span>
        <Icon name={icon} />
      </div>
      <strong>{title}</strong>
      <small><Dot tone={tone} />{state}</small>
      <p>{detail}</p>
      {progress !== undefined ? (
        <div className="nova-automation-workflow-step-progress">
          <i><em style={{ width: `${safeProgress}%` }} /></i>
          <b>{safeProgress}%</b>
        </div>
      ) : null}
      <span className="nova-automation-workflow-step-metric">{metric}</span>
    </article>
  );
}

function AutomationWorkflow({
  rule,
  latestRun,
  runs,
}: {
  rule: RuleRow | null;
  latestRun: RunRow | null;
  runs: RunRow[];
}) {
  const latestStatus = latestRun?.status || "";
  const isRunning = latestStatus === "running";
  const hasError = latestStatus === "error";
  const processed = runs.reduce((sum, item) => sum + item.hitsCount, 0);
  const created = runs.reduce((sum, item) => sum + item.createdCount, 0);
  const updated = runs.reduce((sum, item) => sum + item.updatedCount, 0);
  const reconciled = created + updated;
  const reconciliationProgress = processed ? percent(Math.min(reconciled || processed, processed), processed) : latestRun ? 100 : 0;

  const steps = [
    {
      title: "Coletar dados",
      icon: "database" as const,
      state: latestRun ? "Concluído" : "Aguardando",
      detail: rule ? detectorLabel(rule.detector) : "Nenhuma regra no recorte",
      metric: `${processed} evento(s) lidos`,
      tone: latestRun ? "green" as const : "slate" as const,
    },
    {
      title: "Validar dados",
      icon: "shield" as const,
      state: hasError ? "Com erro" : latestRun ? "Concluído" : "Pendente",
      detail: latestRun?.errorMessage || "consistência e vínculo operacional",
      metric: latestRun ? `${latestRun.hitsCount} hit(s)` : "sem execução",
      tone: hasError ? "red" as const : latestRun ? "green" as const : "slate" as const,
    },
    {
      title: "Reconciliar dados",
      icon: "refresh" as const,
      state: isRunning ? "Em execução" : hasError ? "Requer análise" : latestRun ? "Concluído" : "Pendente",
      detail: "concilia divergências, regras e efeitos",
      metric: `${reconciled} alteração(ões)`,
      tone: isRunning ? "orange" as const : hasError ? "red" as const : latestRun ? "green" as const : "slate" as const,
      active: isRunning || hasError,
      progress: reconciliationProgress,
    },
    {
      title: "Atualizar base",
      icon: "database" as const,
      state: isRunning ? "Em execução" : latestRun ? statusLabel(latestStatus) : "Pendente",
      detail: latestRun?.summary || "persistência de run, SLA e atividades",
      metric: `${updated} atualizada(s)`,
      tone: isRunning ? "blue" as const : hasError ? "red" as const : latestRun ? "green" as const : "slate" as const,
      active: isRunning,
    },
    {
      title: "Notificar resultados",
      icon: "bell" as const,
      state: rule?.createActivities ? "Habilitado" : "Pendente",
      detail: "registra atividade e contexto de turno",
      metric: `${runs.length} run(s) recentes`,
      tone: rule?.createActivities ? "blue" as const : "slate" as const,
      active: rule?.createActivities,
    },
  ];

  return (
    <section className="nova-automation-workflow-flow-card">
      <div className="nova-automation-workflow-card-title">
        <span>Fluxo de execução</span>
        <strong>{rule ? `${rule.code} · ${rule.name}` : "Sem regra selecionada"}</strong>
      </div>
      <div className="nova-automation-workflow-steps">
        {steps.map((step, index) => (
          <WorkflowStep key={step.title} index={index + 1} {...step} />
        ))}
      </div>
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

function formatClock(value: string | null | undefined) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function LiveLog({ runs, commandCenter }: { runs: RunRow[]; commandCenter: CommandCenter }) {
  const runEntries = runs.slice(0, 7).map((item) => ({
    key: item.id,
    time: formatClock(item.startedAt),
    level: item.status === "error" ? "ERROR" : item.status === "running" ? "WARN" : "INFO",
    message: `${statusLabel(item.status)} em ${item.rule.code} - ${item.summary || `${item.hitsCount} registro(s) processado(s)`}`,
  }));
  const alertEntries = commandCenter.recentOccurrences.slice(0, Math.max(0, 8 - runEntries.length)).map((item) => ({
    key: item.id,
    time: formatClock(item.createdAt),
    level: item.severity === "critical" ? "ERROR" : "WARN",
    message: `Alerta ${item.code} vinculado ao fluxo - ${item.title}`,
  }));
  const entries = [...runEntries, ...alertEntries];

  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-log" id="automation-live-log">
      <div className="nova-automation-workflow-card-title">
        <span>Log ao vivo</span>
        <strong><Dot tone={runs.some((item) => item.status === "running") ? "green" : "slate"} />{runs.some((item) => item.status === "running") ? "Atualizando" : "Últimos eventos"}</strong>
      </div>
      <div className="nova-automation-workflow-log-list">
        {entries.length ? entries.map((entry) => (
          <article key={entry.key} className={`is-${entry.level.toLowerCase()}`}>
            <time>{entry.time}</time>
            <b>{entry.level}</b>
            <span>{entry.message}</span>
          </article>
        )) : (
          <div className="nova-automation-workflow-empty-line">Nenhum evento recente para este fluxo.</div>
        )}
      </div>
    </section>
  );
}

function ErrorSummary({
  runs,
  rows,
  operationalPressure,
}: {
  runs: RunRow[];
  rows: RuleRow[];
  operationalPressure: number;
}) {
  const integrationErrors = runs.filter((item) => item.status === "error" && item.rule.detector === "integration_failure").length;
  const failedRuns = runs.filter((item) => item.status === "error").length;
  const validationErrors = Math.max(0, failedRuns - integrationErrors);
  const timeouts = rows.filter(isDue).length;
  const others = Math.max(0, operationalPressure - integrationErrors - validationErrors);
  const total = Math.max(integrationErrors + validationErrors + timeouts + others, failedRuns, 0);
  const segments = [
    { label: "Erros de integração", value: integrationErrors, color: "#ff4747" },
    { label: "Erros de validação", value: validationErrors, color: "#ff7a00" },
    { label: "Timeout", value: timeouts, color: "#ffb020" },
    { label: "Outros", value: others, color: "#7b8794" },
  ];
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = total ? cursor + (segment.value / total) * 100 : cursor;
    cursor = end;
    return `${segment.color} ${start}% ${end}%`;
  });
  const style = {
    "--automation-donut-bg": total
      ? `conic-gradient(${stops.join(", ")}, rgba(148, 163, 184, .16) ${cursor}% 100%)`
      : "conic-gradient(rgba(148, 163, 184, .18) 0 100%)",
  } as CSSProperties;

  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-errors">
      <div className="nova-automation-workflow-card-title">
        <span>Resumo de erros</span>
        <Link href="#automation-history">Ver todos os erros</Link>
      </div>
      <div className="nova-automation-workflow-error-grid">
        <div className="nova-automation-workflow-donut" style={style}>
          <strong>{formatNumber(total)}</strong>
          <span>erros</span>
        </div>
        <div className="nova-automation-workflow-error-legend">
          {segments.map((segment) => (
            <div key={segment.label}>
              <span><i style={{ background: segment.color }} />{segment.label}</span>
              <b>{segment.value} ({percent(segment.value, total)}%)</b>
            </div>
          ))}
        </div>
      </div>
      <div className="nova-automation-workflow-error-table">
        {segments.map((segment) => (
          <div key={`${segment.label}-table`}>
            <span>{segment.label}</span>
            <b>{segment.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutionHistory({ runs, exportHref }: { runs: RunRow[]; exportHref: string }) {
  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-history" id="automation-history">
      <div className="nova-automation-workflow-card-title">
        <span>Histórico de execuções</span>
        <Link href={exportHref}><Icon name="download" />Exportar</Link>
      </div>
      <div className="nova-automation-workflow-history-wrap">
        <table>
          <thead>
            <tr>
              <th>Data / hora</th>
              <th>Disparo</th>
              <th>Status</th>
              <th>Duração</th>
              <th>Registros</th>
              <th>Erros</th>
              <th>Executado por</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {runs.length ? runs.slice(0, 8).map((item) => (
              <tr key={item.id}>
                <td>{formatDateTime(item.startedAt)}</td>
                <td>{item.rule.code}</td>
                <td><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></td>
                <td>{runDuration(item)}</td>
                <td>{formatNumber(item.hitsCount)}</td>
                <td>{item.status === "error" ? "1" : "0"}</td>
                <td>Sistema</td>
                <td>
                  <Link href={exportHref} aria-label="Exportar execução"><Icon name="file" /></Link>
                  <Link href="#automation-rules" aria-label="Editar regra"><Icon name="gear" /></Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8}>Nenhuma execução recente.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TriggerSettings({ rule, latestRun }: { rule: RuleRow | null; latestRun: RunRow | null }) {
  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-settings">
      <div className="nova-automation-workflow-side-title">
        <span>Configurações do disparo</span>
      </div>
      <dl>
        <div><dt>Tipo de disparo</dt><dd>{rule ? cadenceLabel(rule.cadence) : "-"}</dd></div>
        <div><dt>Agendado para</dt><dd>{formatDateTime(rule?.nextRunAt)}</dd></div>
        <div><dt>Fuso horário</dt><dd>(UTC-03:00) Brasília</dd></div>
        <div><dt>Última execução</dt><dd>{formatDateTime(latestRun?.startedAt)}</dd></div>
        <div><dt>Janela de execução</dt><dd>{rule?.thresholdMinutes ? `${rule.thresholdMinutes} min` : "01:20 - 02:30"}</dd></div>
        <div><dt>Execução paralela</dt><dd>Não</dd></div>
      </dl>
    </section>
  );
}

function LastSuccessCard({ run }: { run: RunRow | null }) {
  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-success">
      <div className="nova-automation-workflow-side-title">
        <span>Última execução bem-sucedida</span>
      </div>
      {run ? (
        <>
          <strong><Dot tone="green" />{formatDateTime(run.startedAt)}</strong>
          <dl>
            <div><dt>Duração</dt><dd>{runDuration(run)}</dd></div>
            <div><dt>Registros processados</dt><dd>{formatNumber(run.hitsCount)}</dd></div>
            <div><dt>Erros</dt><dd>0</dd></div>
          </dl>
          <Link href="#automation-history">Ver detalhes da execução</Link>
        </>
      ) : (
        <p>Nenhuma execução bem-sucedida no histórico recente.</p>
      )}
    </section>
  );
}

function IntegrationsCard({ integrations }: { integrations: IntegrationRow[] }) {
  const rows = integrations.length ? integrations : [
    { id: "fallback-prtg", code: "PRTG", name: "PRTG Network Monitor", type: "generic_http", isActive: false, updatedAt: "" },
    { id: "fallback-zabbix", code: "ZBX", name: "Zabbix", type: "zabbix", isActive: false, updatedAt: "" },
  ];

  return (
    <section className="nova-automation-workflow-card nova-automation-workflow-integrations">
      <div className="nova-automation-workflow-side-title">
        <span>Integrações envolvidas ({integrations.length})</span>
      </div>
      <div>
        {rows.slice(0, 6).map((item) => (
          <Link href="/integracoes" key={item.id}>
            <Icon name="integration" />
            <span>{item.name || item.code}</span>
            <b><Dot tone={item.isActive ? "green" : "slate"} />{item.isActive ? "Conectado" : "Inativo"}</b>
          </Link>
        ))}
      </div>
    </section>
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

  const [rulesResponse, runsResponse, summary, commandCenter, integrationsResponse] = await Promise.all([
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
    safeApiJson<PaginatedResponse<IntegrationRow>>(
      "/integrations?page=1&pageSize=6&sortBy=name&sortDir=asc",
      emptyIntegrationsResponse,
    ),
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
  const currentParams = stateParams(state);
  const primaryRule = rows.find(isDue) || rows.find((item) => item.enabled) || rows[0] || null;
  const latestRun = runs[0] || null;
  const latestSuccessRun = runs.find((item) => item.status === "success") || null;
  const processedRuns = runs.reduce((sum, item) => sum + item.hitsCount, 0);
  const totalExceptionCases = rows.reduce((sum, item) => sum + item._count.exceptionCases, 0);
  const operationalPressure = commandCenter.metrics.openOccurrences + commandCenter.metrics.overdueMaintenances;
  const statusValue = runningRuns ? "Em execução" : failedRuns ? "Com falhas" : successRuns ? "Concluída" : "Aguardando";
  const statusToneValue: Tone = runningRuns ? "blue" : failedRuns ? "red" : successRuns ? "green" : "slate";
  const activeIntegrations = integrationsResponse.items.filter((item) => item.isActive).length;
  const exportHref = withParams("/automacao/export", currentParams, { page: undefined, pageSize: undefined });
  const canRun = isAdmin && Boolean(primaryRule);

  const kpis = [
    { icon: "refresh" as const, label: "Execução atual", value: statusValue, hint: latestRun ? `última ${formatDateTime(latestRun.startedAt)}` : "sem execução", tone: statusToneValue },
    { icon: "calendar" as const, label: "Próximo disparo", value: primaryRule?.enabled ? "Agendado" : "Manual", hint: primaryRule ? cadenceLabel(primaryRule.cadence) : "sem regra", tone: primaryRule?.enabled ? "blue" as const : "slate" as const },
    { icon: "clock" as const, label: "Duração", value: latestRun ? runDuration(latestRun) : "-", hint: latestRun ? statusLabel(latestRun.status) : "aguardando run", tone: latestRun ? statusTone(latestRun.status) : "slate" as const },
    { icon: "list" as const, label: "Processados", value: formatNumber(processedRuns), hint: `${runs.length} run(s) recentes`, tone: "blue" as const },
    { icon: "alert" as const, label: "Erros", value: formatNumber(failedRuns), hint: `${percent(failedRuns, Math.max(runs.length, 1))}% das execuções`, tone: failedRuns ? "red" as const : "green" as const },
    { icon: "integration" as const, label: "Integrações ativas", value: formatNumber(activeIntegrations), hint: `de ${formatNumber(integrationsResponse.meta.total || integrationsResponse.items.length)}`, tone: activeIntegrations ? "blue" as const : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/administracao/automacoes" hidePageHeader>
      <main className="nova-automation-workflow-page">
          <header className="nova-automation-workflow-heading">
            <div>
              <nav aria-label="Breadcrumb">
                <Link href="/operacao">Operação</Link>
                <span>/</span>
                <Link href="/administracao/automacoes">Automação</Link>
                <span>/</span>
                <strong>Execução</strong>
              </nav>
              <h1>Automações operacionais</h1>
              <p>Acompanhe regras, execuções, efeitos e falhas que impactam exceções e atividades.</p>
            </div>
          </header>

          <section className="nova-automation-workflow-kpis" aria-label="Indicadores de automação">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>

          <section className="nova-automation-workflow-grid">
            <div className="nova-automation-workflow-left">
              <AutomationWorkflow rule={primaryRule} latestRun={latestRun} runs={runs} />

              <section className="nova-automation-workflow-observability">
                <LiveLog runs={runs} commandCenter={commandCenter} />
                <ErrorSummary rows={rows} runs={runs} operationalPressure={operationalPressure} />
              </section>

              <ExecutionHistory runs={runs} exportHref={exportHref} />
            </div>

            <aside className="nova-automation-workflow-right">
              <section className="nova-automation-workflow-card nova-automation-workflow-actions">
                {canRun && primaryRule ? (
                  <form action={runAutomationNow}>
                    <input type="hidden" name="id" value={primaryRule.id} />
                    <button type="submit"><Icon name="play" />Executar agora</button>
                  </form>
                ) : (
                  <button type="button" disabled><Icon name="play" />Executar agora</button>
                )}
                <a href="#automation-rules"><Icon name="gear" />Editar regras</a>
                <a href="#automation-history"><Icon name="file" />Ver histórico</a>
              </section>

              <TriggerSettings rule={primaryRule} latestRun={latestRun} />
              <LastSuccessCard run={latestSuccessRun} />
              <IntegrationsCard integrations={integrationsResponse.items} />
            </aside>
          </section>

          <section id="automation-rules" className="nova-automation-workflow-card nova-automation-workflow-rules-panel">
            <div className="nova-automation-workflow-card-title">
              <span>Regras configuradas</span>
              <strong>{rulesResponse.meta.total} regra(s)</strong>
            </div>

            <div className="nova-automation-workflow-rule-progress">
              <ProgressLine label="Ativas" value={percent(enabledOnPage, rows.length)} tone="green" />
              <ProgressLine label="Pausadas" value={percent(pausedOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Prontas" value={percent(dueOnPage, rows.length)} tone="orange" />
              <ProgressLine label="Criam exceção" value={percent(creatingExceptions, rows.length)} tone="orange" />
              <ProgressLine label="Criam atividade" value={percent(creatingActivities, rows.length)} tone="blue" />
              <ProgressLine label="Recuperação" value={percent(recoveryRules, rows.length)} tone="green" />
            </div>

            <form id="automation-filters" action="/automacao" className="nova-auto-filters">
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
                <span>Situação</span>
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
                <span>Ordenação</span>
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
              <Link href="/administracao/automacoes">Limpar</Link>
            </form>

            <div className="nova-auto-table-card">
              <div className="nova-auto-section-title">
                <div>
                  <span>Mesa de automação</span>
                  <h2>Regras de automação</h2>
                </div>
                <div>
                  <small>{rows.length} linhas · {totalExceptionCases} exceção(ões)</small>
                  <Link href="/operacao/atividade?kind=automation">Atividade</Link>
                </div>
              </div>

          <div className="nova-auto-table">
            <div className="nova-auto-table-head">
              <span>Regra</span>
              <span>Detector</span>
              <span>Severidade</span>
              <span>Cadência</span>
              <span>Próxima</span>
              <span>Efeitos</span>
              <span>Runs</span>
              <span>Ação</span>
            </div>

            {rows.length ? rows.map((item) => (
              <div className={`nova-auto-row ${item.enabled ? "is-green" : "is-slate"}`} key={item.id}>
                <div>
                  <strong>{item.code} · {item.name}</strong>
                  <small>{item.reportTemplate ? `${item.reportTemplate.code} · ${item.reportTemplate.name}` : "sem modelo vinculado"}</small>
                </div>

                <div>
                  <b>{detectorLabel(item.detector)}</b>
                  <small>{item.thresholdMinutes ? `limite ${item.thresholdMinutes} min` : "sem limite adicional"}</small>
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
                      <button type="submit">Salvar</button>
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
          </section>

          <section className="nova-auto-pagination nova-automation-workflow-pagination">
            <span>
              Página {rulesResponse.meta.page} de {rulesResponse.meta.totalPages} · {rulesResponse.meta.total} regra(s) · {summary.counts.dueRules} prontas
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
      </main>
    </NovaLitShell>
  );
}
