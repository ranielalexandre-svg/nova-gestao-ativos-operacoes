import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

type Tone = "green" | "orange" | "blue" | "red" | "purple" | "slate";
type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "box"
  | "check"
  | "clock"
  | "file"
  | "gear"
  | "home"
  | "integration"
  | "list"
  | "map"
  | "menu"
  | "moon"
  | "plus"
  | "search"
  | "ticket"
  | "tool"
  | "user"
  | "users";
type TicketType = "all" | "preventive" | "corrective" | "inspection";
type TicketStatus = "all" | "planned" | "in_progress" | "done" | "cancelled";
type OwnerFilter = "all" | "noc" | "field" | "partner";
type SortBy = "createdAt" | "code" | "title" | "type" | "status";
type SortDir = "asc" | "desc";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

type PartnerOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

type EquipmentOption = {
  id: string;
  tag: string;
  name: string;
};

type OccurrenceOption = {
  id: string;
  code: string;
  title: string;
};

type MaintenanceRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  occurrence: OccurrenceOption | null;
};

type ChamadosState = {
  q: string;
  type: TicketType;
  status: TicketStatus;
  owner: OwnerFilter;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const typeOptions = ["all", "preventive", "corrective", "inspection"] as const;
const statusOptions = ["all", "planned", "in_progress", "done", "cancelled"] as const;
const ownerOptions = ["all", "noc", "field", "partner"] as const;
const sortByOptions = ["createdAt", "code", "title", "type", "status"] as const;
const sortDirOptions = ["asc", "desc"] as const;
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
      { label: "Sensores", href: "/sensores", icon: "activity" },
      { label: "Mapas", href: "/mapas", icon: "map" },
      { label: "Alertas", href: "/alertas", icon: "alert" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Ativos", href: "/ativos", icon: "box" },
      { label: "Starlinks", href: "/ativos/starlinks", icon: "activity" },
      { label: "Unidades", href: "/unidades", icon: "file" },
      { label: "Parceiros", href: "/parceiros", icon: "users" },
      { label: "Contratos", href: "/contratos", icon: "file" },
      { label: "Chamados", href: "/chamados", icon: "ticket" },
      { label: "Exceções", href: "/excecoes", icon: "alert" },
      { label: "Automação", href: "/automacao", icon: "gear" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Monitoramento", href: "/relatorios/monitoramento", icon: "activity" },
      { label: "Consumo", href: "/relatorios/consumo", icon: "list" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "clock" },
      { label: "Performance", href: "/relatorios/performance", icon: "activity" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Usuários", href: "/usuarios", icon: "users" },
      { label: "Perfis", href: "/perfis", icon: "user" },
      { label: "Integrações", href: "/integracoes", icon: "integration" },
      { label: "Sistema", href: "/configuracoes", icon: "gear" },
    ],
  },
];

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
    case "box":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path {...common} d="M12 12 4.5 7.8M12 12l7.5-4.2M12 12v8.5" /></svg>;
    case "check":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m8 12 3 3 5-6" /></svg>;
    case "clock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M12 7v5l3 2" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
    case "gear":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
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
    case "plus":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 5v14M5 12h14" /></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="11" cy="11" r="7" /><path {...common} d="m16 16 4 4" /></svg>;
    case "ticket":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V7z" /><path {...common} d="M9 9v6M15 9v6" /></svg>;
    case "tool":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3z" /></svg>;
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

function typeLabel(value: string) {
  if (value === "preventive") return "Preventiva";
  if (value === "corrective") return "Conectividade";
  if (value === "inspection") return "Vistoria";
  return value || "Sem categoria";
}

function statusLabel(value: string) {
  if (value === "planned") return "Aberto";
  if (value === "in_progress") return "Em andamento";
  if (value === "done") return "Resolvido";
  if (value === "cancelled") return "Cancelado";
  return value || "Sem status";
}

function statusTone(value: string): Tone {
  if (value === "planned") return "purple";
  if (value === "in_progress") return "blue";
  if (value === "done") return "green";
  if (value === "cancelled") return "slate";
  return "slate";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isOverdue(item: MaintenanceRow) {
  if (!item.scheduledAt) return false;
  if (["done", "cancelled"].includes(item.status)) return false;
  return new Date(item.scheduledAt).getTime() < Date.now();
}

function isDoneToday(item: MaintenanceRow) {
  if (item.status !== "done" || !item.completedAt) return false;
  const done = new Date(item.completedAt);
  if (Number.isNaN(done.getTime())) return false;
  const now = new Date();
  return done.getFullYear() === now.getFullYear() && done.getMonth() === now.getMonth() && done.getDate() === now.getDate();
}

function ownerKey(item: MaintenanceRow): OwnerFilter {
  if (item.status === "in_progress") return "field";
  if (item.partner && !item.equipment) return "partner";
  return "noc";
}

function ownerLabel(item: MaintenanceRow) {
  const owner = ownerKey(item);
  if (owner === "field") return "Equipe de Campo";
  if (owner === "partner") return item.partner?.name || "Parceiro";
  return "NOC NOVA";
}

function entityLabel(item: MaintenanceRow) {
  if (item.unit) return `${item.unit.code} - ${item.unit.name}`;
  if (item.equipment) return `${item.equipment.tag} - ${item.equipment.name}`;
  if (item.partner) return `${item.partner.code} - ${item.partner.name}`;
  return "Sem unidade vinculada";
}

function displayStatus(item: MaintenanceRow) {
  if (isOverdue(item)) return "SLA vencido";
  return statusLabel(item.status);
}

function displayTone(item: MaintenanceRow): Tone {
  if (isOverdue(item)) return "orange";
  return statusTone(item.status);
}

function stateParams(state: ChamadosState): RawSearchParams {
  return {
    q: state.q || undefined,
    type: state.type,
    status: state.status,
    owner: state.owner,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-tickets-board-dot is-${tone}`} />;
}

function Nav() {
  return (
    <aside className="nova-exceptions-board-sidebar nova-tickets-board-sidebar">
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
                data-active={item.href === "/chamados"}
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

function Topbar({ userName, userEmail }: { userName?: string; userEmail?: string }) {
  const initial = (userName || "Administrador").slice(0, 1).toUpperCase();

  return (
    <header className="nova-exceptions-board-topbar nova-tickets-board-topbar">
      <div>
        <button type="button" aria-label="Menu"><Icon name="menu" /></button>
        <span>Sistema de gestão operacional</span>
      </div>
      <div>
        <button type="button" aria-label="Notificações"><Icon name="bell" /><i>7</i></button>
        <button type="button" aria-label="Ajuda">?</button>
        <button type="button" aria-label="Configurações"><Icon name="gear" /></button>
        <Link href="/usuarios" className="nova-exceptions-board-user">
          <span>{userName || "Administrador"}<small>{userEmail || "admin@novatelecom.com.br"}</small></span>
          <b>{initial}</b>
        </Link>
      </div>
    </header>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className="nova-tickets-board-kpi">
      <div>
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-tickets-board-badge is-${tone}`}><Dot tone={tone} />{children}</span>;
}

function QueueGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: Tone;
  items: MaintenanceRow[];
}) {
  return (
    <section className="nova-tickets-board-queue-group">
      <div>
        <h3>{title}</h3>
        <b className={`is-${tone}`}>{items.length}</b>
      </div>
      {items.length ? items.slice(0, 3).map((item) => (
        <Link href={`/chamados/${item.id}`} key={item.id}>
          <span>{item.code}</span>
          <strong>{item.title}</strong>
        </Link>
      )) : (
        <p>Nenhum chamado nesta fila.</p>
      )}
      <Link href="/operacao/fila">Ver todos</Link>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="nova-tickets-board-empty">
      <Icon name="ticket" />
      <strong>Nenhum chamado encontrado</strong>
      <span>Ajuste os filtros ou abra um novo chamado operacional.</span>
    </div>
  );
}

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/chamados");

  const params = await resolveSearchParams(searchParams);
  const state: ChamadosState = {
    q: readStringParam(params, "q", ""),
    type: option(typeOptions, readStringParam(params, "type", "all"), "all"),
    status: option(statusOptions, readStringParam(params, "status", "all"), "all"),
    owner: option(ownerOptions, readStringParam(params, "owner", "all"), "all"),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "createdAt"), "createdAt"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const [response, summaryResponse, commandCenter] = await Promise.all([
    apiJson<PaginatedResponse<MaintenanceRow>>(
      `/maintenances${buildApiQuery({
        q: state.q,
        type: state.type !== "all" ? state.type : undefined,
        status: state.status !== "all" ? state.status : undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      })}`,
    ),
    apiJson<PaginatedResponse<MaintenanceRow>>(
      "/maintenances?page=1&pageSize=100&sortBy=createdAt&sortDir=desc",
    ),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const rawRows = response.items;
  const rows = state.owner === "all" ? rawRows : rawRows.filter((item) => ownerKey(item) === state.owner);
  const allRows = summaryResponse.items;
  const openCount = allRows.filter((item) => !["done", "cancelled"].includes(item.status)).length;
  const runningCount = allRows.filter((item) => item.status === "in_progress").length;
  const overdueCount = allRows.filter(isOverdue).length;
  const resolvedTodayCount = allRows.filter(isDoneToday).length;
  const currentParams = stateParams(state);
  const highPriorityRows = allRows.filter((item) => isOverdue(item) || item.type === "corrective").slice(0, 5);
  const waitingRows = allRows.filter((item) => item.status === "planned" && !isOverdue(item)).slice(0, 5);
  const fieldRows = allRows.filter((item) => item.status === "in_progress").slice(0, 5);
  const historyRows = allRows.slice(0, 4);

  const kpis = [
    { label: "Abertos", value: String(openCount), hint: "chamados abertos", tone: openCount ? "green" as const : "slate" as const },
    { label: "Em andamento", value: String(runningCount), hint: "em atendimento", tone: runningCount ? "blue" as const : "slate" as const },
    { label: "SLA vencido", value: String(overdueCount), hint: "fora do SLA", tone: overdueCount ? "red" as const : "green" as const },
    { label: "Resolvidos hoje", value: String(resolvedTodayCount), hint: "concluídos hoje", tone: "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/chamados" hidePageHeader>
      <main className="nova-tickets-board-page">
          <header className="nova-tickets-board-heading">
            <div>
              <nav aria-label="Breadcrumb">
                <Link href="/dashboard">Nova</Link>
                <span>/</span>
                <strong>Chamados</strong>
              </nav>
              <h1>Chamados</h1>
              <p>Fila operacional de tickets e tratativas técnicas.</p>
            </div>
            <div>
              <Link href="/operacao/fila?view=dueSoon"><Icon name="ticket" />Abrir fila</Link>
              <Link href="/chamados/novo"><Icon name="plus" />Novo chamado</Link>
            </div>
          </header>

          <section className="nova-tickets-board-kpis" aria-label="Indicadores de chamados">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>

          <section className="nova-tickets-board-grid">
            <section className="nova-tickets-board-card nova-tickets-board-table-card">
              <div className="nova-tickets-board-card-title">
                <h2>Fila de chamados</h2>
              </div>

              <form action="/chamados" className="nova-tickets-board-filters">
                <label>
                  <Icon name="search" />
                  <input name="q" defaultValue={state.q} placeholder="Buscar chamado..." />
                </label>

                <label>
                  <span>Categoria</span>
                  <select name="type" defaultValue={state.type}>
                    <option value="all">Todos</option>
                    <option value="preventive">Preventiva</option>
                    <option value="corrective">Conectividade</option>
                    <option value="inspection">Vistoria</option>
                  </select>
                </label>

                <label>
                  <span>Responsável</span>
                  <select name="owner" defaultValue={state.owner}>
                    <option value="all">Todos</option>
                    <option value="noc">NOC NOVA</option>
                    <option value="field">Equipe de Campo</option>
                    <option value="partner">Parceiro</option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select name="status" defaultValue={state.status}>
                    <option value="all">Todos</option>
                    <option value="planned">Aberto</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="done">Resolvido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>

                <input type="hidden" name="sortBy" value={state.sortBy} />
                <input type="hidden" name="sortDir" value={state.sortDir} />
                <input type="hidden" name="pageSize" value={state.pageSize} />
                <input type="hidden" name="page" value="1" />
                <Link href="/chamados">Limpar filtros</Link>
                <button type="submit">Filtrar</button>
              </form>

              <div className="nova-tickets-board-table-wrap">
                <table className="nova-tickets-board-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Título</th>
                      <th>Unidade</th>
                      <th>Categoria</th>
                      <th>Responsável</th>
                      <th>Status</th>
                      <th>Criado</th>
                      <th>Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((item) => (
                      <tr key={item.id}>
                        <td><Link href={`/chamados/${item.id}`}>{item.code}</Link></td>
                        <td><strong>{item.title}</strong><small>{item.description || item.occurrence?.title || "Sem descrição complementar"}</small></td>
                        <td>{entityLabel(item)}</td>
                        <td>{typeLabel(item.type)}</td>
                        <td>{ownerLabel(item)}</td>
                        <td><Badge tone={displayTone(item)}>{displayStatus(item)}</Badge></td>
                        <td>{formatShortDateTime(item.createdAt)}</td>
                        <td>{formatShortDateTime(item.updatedAt)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8}><EmptyState /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Link href={withParams("/chamados", currentParams, { pageSize: 50, page: 1 })} className="nova-tickets-board-see-all">
                Ver todos os chamados <span>›</span>
              </Link>
            </section>

            <aside className="nova-tickets-board-right">
              <section className="nova-tickets-board-card nova-tickets-board-shift">
                <h2>Fila do turno</h2>
                <QueueGroup title="Prioridade alta" tone="red" items={highPriorityRows} />
                <QueueGroup title="Aguardando cliente" tone="orange" items={waitingRows} />
                <QueueGroup title="Despacho em campo" tone="blue" items={fieldRows} />
                <Link href="/operacao/fila"><Icon name="ticket" />Abrir backlog</Link>
                <Link href="/relatorios/monitoramento"><Icon name="list" />Ver relatórios</Link>
              </section>
            </aside>
          </section>

          <section className="nova-tickets-board-card nova-tickets-board-history">
            <div className="nova-tickets-board-card-title">
              <h2>Histórico recente</h2>
              <Link href={withParams("/chamados", currentParams, { status: "done", page: 1 })}>Ver todo histórico <span>›</span></Link>
            </div>

            <div className="nova-tickets-board-history-list">
              {historyRows.length ? historyRows.map((item) => (
                <Link href={`/chamados/${item.id}`} key={item.id}>
                  <div className={`is-${displayTone(item)}`}><Icon name={item.status === "done" ? "check" : item.status === "in_progress" ? "tool" : "ticket"} /></div>
                  <section>
                    <strong>{item.code}</strong>
                    <span>{item.title}</span>
                    <small>{entityLabel(item)}</small>
                    <p>{formatDateTime(item.updatedAt)} por {ownerLabel(item)}</p>
                  </section>
                  <Badge tone={displayTone(item)}>{displayStatus(item)}</Badge>
                </Link>
              )) : (
                <EmptyState />
              )}
            </div>
          </section>

          <section className="nova-tickets-board-pagination">
            <span>
              Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} chamado(s) · {commandCenter.metrics.overdueMaintenances} vencidos no NOC
            </span>
            <div>
              <Link
                href={withParams("/chamados", currentParams, { page: Math.max(1, response.meta.page - 1) })}
                aria-disabled={!response.meta.hasPrev}
              >
                Anterior
              </Link>
              <Link
                href={withParams("/chamados", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })}
                aria-disabled={!response.meta.hasNext}
              >
                Próxima
              </Link>
            </div>
          </section>
      </main>
    </NovaLitShell>
  );
}
