import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { safeApiJson } from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type KindFilter = "all" | "generic" | "sla" | "integration" | "occurrence" | "maintenance" | "automation";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";
type StatusFilter = "all" | "open" | "acknowledged" | "resolved" | "silenced";
type TriageFilter = "all" | "pending" | "triaged" | "closed";
type SortBy = "createdAt" | "severity" | "status" | "priorityScore" | "resolveDueAt";
type SortDir = "asc" | "desc";
type ViewFilter = "all" | "pending" | "breached" | "dueSoon" | "unassigned";
type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "building"
  | "chart"
  | "check"
  | "clock"
  | "download"
  | "file"
  | "gear"
  | "home"
  | "import"
  | "list"
  | "map"
  | "menu"
  | "moon"
  | "plus"
  | "refresh"
  | "search"
  | "shield"
  | "target"
  | "trash"
  | "user"
  | "users";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

type QueueSummary = {
  views: {
    all: number;
    pendingTriage: number;
    breached: number;
    dueSoon: number;
    unassigned: number;
  };
  queues: { queueKey: string; total: number }[];
};

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

type ExceptionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: string;
  severity: string;
  status: string;
  source: string;
  queueKey: string;
  classification: string;
  impact: string;
  urgency: string;
  priorityScore: number;
  triageStatus: string;
  silencedUntil: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  breachedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string; email: string; role: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count: { comments: number; activities: number };
};

type ExcecoesState = {
  q: string;
  view: ViewFilter;
  kind: KindFilter;
  severity: SeverityFilter;
  status: StatusFilter;
  triageStatus: TriageFilter;
  queueKey: string;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const kindOptions = ["all", "generic", "sla", "integration", "occurrence", "maintenance", "automation"] as const;
const severityOptions = ["all", "low", "medium", "high", "critical"] as const;
const statusOptions = ["all", "open", "acknowledged", "resolved", "silenced"] as const;
const triageOptions = ["all", "pending", "triaged", "closed"] as const;
const sortByOptions = ["createdAt", "severity", "status", "priorityScore", "resolveDueAt"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const viewOptions = ["all", "pending", "breached", "dueSoon", "unassigned"] as const;
const pageSizeOptions = [10, 20, 50] as const;

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Geral",
    items: [
      { label: "Visão geral", href: "/dashboard", icon: "home" },
    ],
  },
  {
    label: "Monitoramento",
    items: [
      { label: "Sensores", href: "/monitoramento/sensores", icon: "activity" },
      { label: "Mapas", href: "/monitoramento/mapas", icon: "map" },
      { label: "Alertas", href: "/alertas", icon: "bell" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Ativos", href: "/ativos", icon: "file" },
      { label: "Starlinks", href: "/ativos/starlinks", icon: "activity" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Parceiros", href: "/parceiros", icon: "users" },
      { label: "Contratos", href: "/contratos", icon: "file" },
      { label: "Chamados", href: "/chamados", icon: "list" },
      { label: "Exceções", href: "/excecoes", icon: "alert" },
      { label: "Automação", href: "/automacao", icon: "gear" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Monitoramento", href: "/relatorios/monitoramento", icon: "chart" },
      { label: "Consumo", href: "/relatorios/consumo", icon: "chart" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "activity" },
      { label: "Performance", href: "/relatorios/performance", icon: "chart" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Importação", href: "/operacao/importacao", icon: "import" },
      { label: "Reconciliação", href: "/reconciliacao-central", icon: "target" },
      { label: "Usuários", href: "/usuarios", icon: "users" },
      { label: "Perfis", href: "/perfis", icon: "user" },
      { label: "Integrações", href: "/integracoes", icon: "gear" },
      { label: "Sistemas", href: "/configuracoes", icon: "shield" },
    ],
  },
];

const emptySummary: ExceptionSummary = {
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

const emptyQueueSummary: QueueSummary = {
  views: {
    all: 0,
    pendingTriage: 0,
    breached: 0,
    dueSoon: 0,
    unassigned: 0,
  },
  queues: [],
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
    case "building":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 21V4h14v17" /><path {...common} d="M9 8h2M13 8h2M9 12h2M13 12h2M3 21h18" /></svg>;
    case "map":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" /></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 22 20H2L12 3z" /><path {...common} d="M12 9v5M12 17h.01" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "chart":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V4M4 20h16" /><path {...common} d="M8 16v-5M12 16V7M16 16v-8" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v18H6z" /><path {...common} d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
    case "list":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 6h11M9 12h11M9 18h11" /><path {...common} d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case "gear":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M19 8v6M22 11h-6" /></svg>;
    case "user":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "import":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v12" /><path {...common} d="m8 11 4 4 4-4" /><path {...common} d="M4 21h16" /></svg>;
    case "download":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 21V9" /><path {...common} d="m8 13 4-4 4 4" /><path {...common} d="M4 3h16" /></svg>;
    case "target":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
    case "bell":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path {...common} d="M10 21h4" /></svg>;
    case "clock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M12 7v5l3 2" /></svg>;
    case "check":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m8 12 3 3 5-6" /></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="11" cy="11" r="7" /><path {...common} d="m16 16 4 4" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path {...common} d="M3 12A9 9 0 0 1 18.5 5.7L21 8" /></svg>;
    case "plus":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 5v14M5 12h14" /></svg>;
    case "trash":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>;
    case "menu":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "moon":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12.8A8 8 0 1 1 11.2 3a6.2 6.2 0 0 0 9.8 9.8z" /></svg>;
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

function viewFilter(view: ViewFilter) {
  if (view === "pending") return { triageStatus: "pending", status: "open" };
  if (view === "breached") return { onlyBreached: "true" };
  if (view === "dueSoon") return { onlyDueSoon: "true" };
  if (view === "unassigned") return { onlyUnassigned: "true" };
  return {};
}

function kindLabel(value: string) {
  if (value === "generic") return "Geral";
  if (value === "sla") return "SLA";
  if (value === "integration") return "Integração";
  if (value === "occurrence") return "Alerta";
  if (value === "maintenance") return "Chamado";
  if (value === "automation") return "Automação";
  return value || "Sem tipo";
}

function queueLabel(value: string) {
  if (value === "ops-general") return "Geral";
  if (value === "ops-integracoes") return "Integrações";
  if (value === "ops-ocorrencias") return "Alertas";
  if (value === "ops-manutencao") return "Chamados";
  if (value === "ops-sla") return "SLA";
  if (value === "ops-automacoes") return "Automações";
  return value || "Sem fila";
}

function severityTone(value: string): Tone {
  if (value === "critical") return "red";
  if (value === "high") return "orange";
  if (value === "medium") return "blue";
  if (value === "low") return "green";
  return "slate";
}

function statusLabel(value: string) {
  if (value === "open") return "Aberta";
  if (value === "acknowledged") return "Reconhecida";
  if (value === "resolved") return "Resolvida";
  if (value === "silenced") return "Silenciada";
  return value || "Sem status";
}

function statusTone(value: string): Tone {
  if (value === "open") return "orange";
  if (value === "acknowledged") return "blue";
  if (value === "resolved") return "green";
  if (value === "silenced") return "slate";
  return "slate";
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

function linkSummary(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.equipment) return `Ativo ${item.equipment.tag}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: ExcecoesState): RawSearchParams {
  return {
    q: state.q || undefined,
    view: state.view,
    kind: state.kind,
    severity: state.severity,
    status: state.status,
    triageStatus: state.triageStatus,
    queueKey: state.queueKey || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-exceptions-board-dot is-${tone}`} />;
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
    <article className={`nova-exceptions-board-kpi is-${tone}`}>
      <div><Icon name={icon} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-exceptions-board-badge is-${tone}`}><Dot tone={tone} />{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-exceptions-board-progress">
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

function Nav() {
  return (
    <aside className="nova-exceptions-board-sidebar">
      <Link href="/dashboard" className="nova-exceptions-board-logo" aria-label="NOVA Telecom">
        <Image src="/brand/nova-telecom-logo.svg" alt="NOVA Telecom" width={150} height={62} priority />
      </Link>
      <nav aria-label="Navegação principal">
        {NAV_SECTIONS.map((section) => (
          <section key={section.label} className="nova-exceptions-board-nav-section">
            <h2>{section.label}</h2>
            {section.items.map((item) => (
              <Link
                key={`${section.label}-${item.href}-${item.label}`}
                href={item.href}
                className="nova-exceptions-board-nav-link"
                data-active={item.href === "/excecoes"}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ userName }: { userName?: string }) {
  return (
    <header className="nova-exceptions-board-topbar">
      <div>
        <button type="button" aria-label="Menu"><Icon name="menu" /></button>
        <span>Sistema de gestão operacional</span>
      </div>
      <div>
        <button type="button" aria-label="Notificações"><Icon name="bell" /><i>3</i></button>
        <button type="button" aria-label="Ajuda">?</button>
        <button type="button" aria-label="Tema"><Icon name="moon" /></button>
        <Link href="/usuarios" className="nova-exceptions-board-user">
          <b>{(userName || "Admin").slice(0, 2).toUpperCase()}</b>
          <span>{userName || "Admin User"}<small>Administrador</small></span>
        </Link>
      </div>
    </header>
  );
}

function BoardButton({ href, icon, children, primary = false }: { href: string; icon: IconName; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={`nova-exceptions-board-button ${primary ? "is-primary" : ""}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </Link>
  );
}

function SummaryDonut({ rows }: { rows: ExceptionRow[] }) {
  const total = Math.max(rows.length, 1);
  const kindOrder = ["integration", "generic", "maintenance", "occurrence", "sla"] as const;
  const colors: Record<string, string> = {
    integration: "#ff7a00",
    generic: "#8b5cf6",
    maintenance: "#22c55e",
    occurrence: "#3b82f6",
    sla: "#14b8a6",
    automation: "#f59e0b",
  };
  let cursor = 0;
  const stops = kindOrder.map((kind) => {
    const count = rows.filter((item) => item.kind === kind).length;
    const start = cursor;
    const end = cursor + (count / total) * 100;
    cursor = end;
    return `${colors[kind]} ${start}% ${end}%`;
  });
  const style = {
    "--donut-bg": `conic-gradient(${stops.join(", ")}, rgba(148, 163, 184, .18) ${cursor}% 100%)`,
  } as CSSProperties;

  return (
    <div className="nova-exceptions-board-donut-wrap">
      <div className="nova-exceptions-board-donut" style={style}>
        <strong>{rows.length}</strong>
        <span>total</span>
      </div>
      <div className="nova-exceptions-board-donut-legend">
        {kindOrder.map((kind) => {
          const count = rows.filter((item) => item.kind === kind).length;
          return (
            <div key={kind}>
              <span><i style={{ background: colors[kind] }} />{kindLabel(kind)}</span>
              <b>{count} ({percent(count, rows.length)}%)</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="nova-exceptions-board-empty">
      <div><Icon name="alert" /></div>
      <strong>Nenhuma exceção encontrada</strong>
      <span>Ajuste os filtros ou aguarde novos casos operacionais.</span>
    </div>
  );
}

export default async function ExcecoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/excecoes");

  const params = await resolveSearchParams(searchParams);
  const state: ExcecoesState = {
    q: readStringParam(params, "q", ""),
    view: option(viewOptions, readStringParam(params, "view", "all"), "all"),
    kind: option(kindOptions, readStringParam(params, "kind", "all"), "all"),
    severity: option(severityOptions, readStringParam(params, "severity", "all"), "all"),
    status: option(statusOptions, readStringParam(params, "status", "all"), "all"),
    triageStatus: option(triageOptions, readStringParam(params, "triageStatus", "all"), "all"),
    queueKey: readStringParam(params, "queueKey", ""),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "priorityScore"), "priorityScore"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const [response, summary, queueSummary] = await Promise.all([
    apiJson<PaginatedResponse<ExceptionRow>>(
      `/exceptions${buildApiQuery({
        q: state.q,
        kind: state.kind !== "all" ? state.kind : undefined,
        severity: state.severity !== "all" ? state.severity : undefined,
        status: state.status !== "all" ? state.status : undefined,
        triageStatus: state.triageStatus !== "all" ? state.triageStatus : undefined,
        queueKey: state.queueKey || undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
        ...viewFilter(state.view),
      })}`,
    ),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptySummary),
    safeApiJson<QueueSummary>("/exceptions/queue/summary", emptyQueueSummary),
  ]);

  const rows = response.items;
  const openOnPage = rows.filter((item) => item.status === "open").length;
  const resolvedOnPage = rows.filter((item) => item.status === "resolved").length;
  const breachedOnPage = rows.filter((item) => Boolean(item.breachedAt)).length;
  const criticalOnPage = rows.filter((item) => item.severity === "critical").length;
  const automatedOnPage = rows.filter((item) => item.source === "automation").length;
  const currentParams = stateParams(state);
  const exportHref = withParams("/excecoes/export", currentParams, { page: undefined, pageSize: undefined });
  const firstCaseHref = rows[0] ? `/excecoes/${rows[0].id}` : "/excecoes";

  const kpis = [
    { icon: "alert" as const, label: "Exceções abertas", value: String(summary.counts.openCount), hint: "em tratamento", tone: summary.counts.openCount ? "orange" as const : "green" as const },
    { icon: "search" as const, label: "Em validação", value: String(summary.counts.pendingTriageCount), hint: "aguardando análise", tone: summary.counts.pendingTriageCount ? "blue" as const : "slate" as const },
    { icon: "check" as const, label: "Resolvidas", value: String(resolvedOnPage), hint: "no recorte atual", tone: "green" as const },
    { icon: "clock" as const, label: "SLA estourado", value: String(summary.counts.breachedCount), hint: "prioridade máxima", tone: summary.counts.breachedCount ? "red" as const : "slate" as const },
  ];
  const pages = Array.from({ length: Math.min(response.meta.totalPages, 5) }, (_, index) => index + 1);

  return (
    <NovaLitShell activeHref="/excecoes" hidePageHeader>
      <main className="nova-exceptions-board-page">
          <header className="nova-exceptions-board-heading">
            <div>
              <nav aria-label="Breadcrumb">
                <Link href="/operacao">Operação</Link>
                <span>/</span>
                <strong>Exceções</strong>
              </nav>
              <h1>Exceções</h1>
              <p>Tratamento de inconsistências operacionais e desvios de regra.</p>
            </div>
            <div>
              <BoardButton href={withParams("/excecoes", currentParams, {})} icon="refresh">Atualizar dados</BoardButton>
              <BoardButton href="/excecoes/nova" icon="plus" primary>Nova exceção</BoardButton>
            </div>
          </header>

          <section className="nova-exceptions-board-flow" aria-label="Fluxo de tratamento">
            <article>
              <div><Icon name="alert" /></div>
              <span>Detecção</span>
              <p>Identificação automática de desvios e inconsistências.</p>
            </article>
            <article>
              <div><Icon name="search" /></div>
              <span>Análise</span>
              <p>Classificação, impacto e validação da exceção.</p>
            </article>
            <article>
              <div><Icon name="check" /></div>
              <span>Resolução</span>
              <p>Tratamento, aprovação e acompanhamento.</p>
            </article>
          </section>

          <section className="nova-exceptions-board-top-grid">
            <section className="nova-exceptions-board-kpis" aria-label="Indicadores de exceções">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </section>

            <form action="/excecoes" className="nova-exceptions-board-filters">
                <label>
                  <span>Código</span>
                  <input name="q" defaultValue={state.q} placeholder="Buscar código, título ou vínculo" />
                </label>
                <label>
                  <span>Categoria</span>
                  <select name="kind" defaultValue={state.kind}>
                    <option value="all">Todas</option>
                    <option value="generic">Geral</option>
                    <option value="sla">SLA</option>
                    <option value="integration">Integração</option>
                    <option value="occurrence">Alerta</option>
                    <option value="maintenance">Chamado</option>
                    <option value="automation">Automação</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select name="status" defaultValue={state.status}>
                    <option value="all">Todos</option>
                    <option value="open">Abertas</option>
                    <option value="acknowledged">Reconhecidas</option>
                    <option value="resolved">Resolvidas</option>
                    <option value="silenced">Silenciadas</option>
                  </select>
                </label>
                <label>
                  <span>Fila</span>
                  <select name="queueKey" defaultValue={state.queueKey}>
                    <option value="">Todas</option>
                    {queueSummary.queues.map((item) => (
                      <option key={item.queueKey} value={item.queueKey}>{queueLabel(item.queueKey)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Triagem</span>
                  <select name="triageStatus" defaultValue={state.triageStatus}>
                    <option value="all">Todas</option>
                    <option value="pending">Pendente</option>
                    <option value="triaged">Triada</option>
                    <option value="closed">Fechada</option>
                  </select>
                </label>
                <label>
                  <span>Ordenar por</span>
                  <select name="sortBy" defaultValue={state.sortBy}>
                    <option value="priorityScore">Prioridade</option>
                    <option value="resolveDueAt">SLA</option>
                    <option value="createdAt">Cadastro</option>
                    <option value="severity">Severidade</option>
                    <option value="status">Status</option>
                  </select>
                </label>
                <input type="hidden" name="view" value={state.view} />
                <input type="hidden" name="severity" value={state.severity} />
                <input type="hidden" name="sortDir" value={state.sortDir} />
                <input type="hidden" name="pageSize" value={state.pageSize} />
                <input type="hidden" name="page" value="1" />
                <Link href="/excecoes"><Icon name="trash" />Limpar</Link>
                <button type="submit"><Icon name="gear" />Aplicar filtros</button>
            </form>
          </section>

          <section className="nova-exceptions-board-content">
            <div className="nova-exceptions-board-left">
              <section className="nova-exceptions-board-card nova-exceptions-board-table-card">
                <div className="nova-exceptions-board-card-head">
                  <div>
                    <Icon name="list" />
                    <h2>Lista de exceções</h2>
                    <span>Total {response.meta.total} exceção(ões)</span>
                  </div>
                  <Link href={exportHref} aria-label="Exportar relatório"><Icon name="download" /></Link>
                </div>

                <div className="nova-exceptions-board-table-wrap">
                  <table className="nova-exceptions-board-table">
                    <thead>
                      <tr>
                        <th>Exceção</th>
                        <th>Descrição</th>
                        <th>Origem</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Responsável</th>
                        <th>Criado em</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? rows.map((item) => (
                        <tr key={item.id}>
                          <td><Link href={`/excecoes/${item.id}`}>{item.code}</Link></td>
                          <td><strong>{item.title}</strong><small>{linkSummary(item)}</small></td>
                          <td>{queueLabel(item.queueKey)}</td>
                          <td><Badge tone={severityTone(item.severity)}>{kindLabel(item.kind)}</Badge></td>
                          <td><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></td>
                          <td>{item.assignee?.name || "Sem responsável"}</td>
                          <td>{formatDateTime(item.createdAt)}</td>
                          <td><Link href={`/excecoes/${item.id}`} className="nova-exceptions-board-action">Abrir</Link></td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8}><EmptyState /></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="nova-exceptions-board-pagination">
                  <span>Mostrando {rows.length ? (response.meta.page - 1) * response.meta.pageSize + 1 : 0} a {Math.min(response.meta.total, (response.meta.page - 1) * response.meta.pageSize + rows.length)} de {response.meta.total} resultados</span>
                  <div>
                    <Link href={withParams("/excecoes", currentParams, { page: Math.max(1, response.meta.page - 1) })} aria-disabled={!response.meta.hasPrev}>‹</Link>
                    {pages.map((pageNumber) => (
                      <Link key={pageNumber} href={withParams("/excecoes", currentParams, { page: pageNumber })} data-active={pageNumber === response.meta.page}>{pageNumber}</Link>
                    ))}
                    <Link href={withParams("/excecoes", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })} aria-disabled={!response.meta.hasNext}>›</Link>
                  </div>
                </div>
              </section>
            </div>

            <aside className="nova-exceptions-board-right">
              <section className="nova-exceptions-board-card nova-exceptions-board-summary">
                <div className="nova-exceptions-board-side-title">
                  <Icon name="activity" />
                  <h2>Resumo das exceções</h2>
                </div>
                <SummaryDonut rows={rows} />
                <div className="nova-exceptions-board-pressure">
                  <ProgressLine label="Abertas" value={percent(openOnPage, rows.length)} tone="orange" />
                  <ProgressLine label="Críticas" value={percent(criticalOnPage, rows.length)} tone="red" />
                  <ProgressLine label="SLA estourado" value={percent(breachedOnPage, rows.length)} tone="red" />
                  <ProgressLine label="Automação" value={percent(automatedOnPage, rows.length)} tone="blue" />
                </div>
              </section>

              <section className="nova-exceptions-board-card nova-exceptions-board-quick">
                <div className="nova-exceptions-board-side-title">
                  <Icon name="activity" />
                  <h2>Ações rápidas</h2>
                </div>
                <Link href="/excecoes/nova"><Icon name="plus" /><span>Nova exceção</span></Link>
                <Link href="/operacao/importacao"><Icon name="import" /><span>Importar exceções</span></Link>
                <Link href={exportHref}><Icon name="download" /><span>Exportar relatório</span></Link>
                <Link href={firstCaseHref}><Icon name="file" /><span>Base de conhecimento</span></Link>
                <Link href="/administracao/sla"><Icon name="gear" /><span>Configurar regras</span></Link>
                <Link href="/operacao/atividade"><Icon name="clock" /><span>Histórico de exceções</span></Link>
              </section>
            </aside>
          </section>
      </main>
    </NovaLitShell>
  );
}
