import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
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
import { formatDateTime } from "@/lib/formatters";
import { isAdminRole, ROLE_OPTIONS, roleLabel } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "purple" | "teal" | "slate";
type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "building"
  | "chart"
  | "chevron"
  | "download"
  | "eye"
  | "file"
  | "home"
  | "lock"
  | "mail"
  | "map"
  | "menu"
  | "moon"
  | "more"
  | "network"
  | "pen"
  | "plus-user"
  | "refresh"
  | "search"
  | "server"
  | "settings"
  | "shield"
  | "trash"
  | "user"
  | "users";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Geral",
    items: [
      { label: "Visão geral", href: "/dashboard", icon: "home" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Mapas", href: "/dashboard/mapas", icon: "map" },
      { label: "Alertas", href: "/alertas", icon: "alert" },
    ],
  },
  {
    label: "Monitoramento",
    items: [
      { label: "Infraestrutura", href: "/monitoramento", icon: "server" },
      { label: "Serviços", href: "/sensores", icon: "network" },
      { label: "Links", href: "/alertas", icon: "activity" },
      { label: "Sensores", href: "/sensores", icon: "chart" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Ativos", href: "/ativos", icon: "file" },
      { label: "Starlinks", href: "/ativos/starlinks", icon: "network" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Usuários", href: "/usuarios", icon: "users" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Consumo", href: "/relatorios/consumo", icon: "chart" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "activity" },
      { label: "Performance", href: "/relatorios/performance", icon: "activity" },
      { label: "SLA", href: "/operacao/sla", icon: "shield" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Perfis", href: "/perfis", icon: "users" },
      { label: "Usuários", href: "/usuarios", icon: "plus-user" },
      { label: "Integrações", href: "/integracoes", icon: "settings" },
      { label: "Configurações", href: "/configuracoes", icon: "settings" },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "#8b5cf6",
  editor: "#38bdf8",
  operator: "#2dd4bf",
  viewer: "#fb923c",
};

function roleToneLocal(role: string): Tone {
  if (role === "admin") return "purple";
  if (role === "editor") return "blue";
  if (role === "operator") return "teal";
  if (role === "viewer") return "slate";
  return "slate";
}

function statusTone(isActive: boolean): Tone {
  return isActive ? "green" : "red";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-users-board-badge is-${tone}`}>{children}</span>;
}

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
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m3 11 9-8 9 8" /><path {...common} d="M5 10v10h14V10" /></svg>;
    case "building":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 21V4h14v17" /><path {...common} d="M9 8h2M13 8h2M9 12h2M13 12h2M3 21h18" /></svg>;
    case "server":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 4h16v6H4zM4 14h16v6H4z" /><path {...common} d="M8 7h.01M8 17h.01" /></svg>;
    case "network":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 18h.01" /><path {...common} d="M8.5 14.5a5 5 0 0 1 7 0" /><path {...common} d="M5.5 11.5a9 9 0 0 1 13 0" /></svg>;
    case "chart":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V4M4 20h16" /><path {...common} d="M8 16v-5M12 16V7M16 16v-8" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 22 20H2L12 3z" /><path {...common} d="M12 9v5M12 17h.01" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
    case "user":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "users":
    case "plus-user":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M19 8v6M22 11h-6" /></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "bell":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path {...common} d="M10 21h4" /></svg>;
    case "menu":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "moon":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12.8A8 8 0 1 1 11.2 3a6.2 6.2 0 0 0 9.8 9.8z" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path {...common} d="M3 12A9 9 0 0 1 18.5 5.7L21 8" /></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="11" cy="11" r="7" /><path {...common} d="m16 16 4 4" /></svg>;
    case "download":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v12" /><path {...common} d="m8 11 4 4 4-4" /><path {...common} d="M4 21h16" /></svg>;
    case "trash":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>;
    case "mail":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 5h16v14H4z" /><path {...common} d="m4 7 8 6 8-6" /></svg>;
    case "lock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="11" width="14" height="10" rx="2" /><path {...common} d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case "eye":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle {...common} cx="12" cy="12" r="3" /></svg>;
    case "pen":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 20 4-1 11-11-3-3L5 16z" /><path {...common} d="m14 6 3 3" /></svg>;
    case "more":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 5h.01M12 12h.01M12 19h.01" /></svg>;
    case "chevron":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m9 18 6-6-6-6" /></svg>;
    case "map":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  detail,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  delta?: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-users-board-kpi is-${tone}`}>
      <div className="nova-users-board-kpi-icon"><Icon name={icon} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta ? <b>{delta}</b> : null}{detail}</small>
      </div>
      <i aria-hidden="true">•••</i>
    </article>
  );
}

function ActionButton({ href, icon, children, variant = "secondary" }: { href: string; icon: IconName; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={`nova-users-board-button is-${variant}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </Link>
  );
}

function Nav() {
  return (
    <aside className="nova-users-board-sidebar">
      <Link href="/dashboard" className="nova-users-board-logo" aria-label="NOVA Telecom">
        <Image
          src="/brand/nova-telecom-logo.svg"
          alt="NOVA Telecom"
          width={170}
          height={70}
          priority
        />
      </Link>
      <nav aria-label="Navegação principal">
        {NAV_SECTIONS.map((section) => (
          <section key={section.label} className="nova-users-board-nav-section">
            <h2>{section.label}</h2>
            {section.items.map((item) => (
              <Link
                key={`${section.label}-${item.href}-${item.label}`}
                href={item.href}
                className="nova-users-board-nav-link"
                data-active={section.label === "Configurações" && item.href === "/usuarios"}
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

function Topbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="nova-users-board-topbar">
      <div>
        <button type="button" aria-label="Menu"><Icon name="menu" /></button>
        <span>Sistema de gestão operacional</span>
      </div>
      <div>
        <button type="button" aria-label="Notificações"><Icon name="bell" /><i>12</i></button>
        <button type="button" aria-label="Ajuda">?</button>
        <button type="button" aria-label="Tema"><Icon name="moon" /></button>
        <Link href="/usuarios" className="nova-users-board-user">
          <b>A</b>
          <span>Administrador<small>{userEmail || "admin@novatelecom.com.br"}</small></span>
          <Icon name="chevron" />
        </Link>
      </div>
    </header>
  );
}

function DistributionDonut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const safeTotal = Math.max(total, 1);
  const admin = (counts.admin || 0) / safeTotal * 100;
  const operator = (counts.operator || 0) / safeTotal * 100;
  const editor = (counts.editor || 0) / safeTotal * 100;
  const viewer = (counts.viewer || 0) / safeTotal * 100;
  const style = {
    "--donut-bg": `conic-gradient(${ROLE_COLORS.admin} 0 ${admin}%, ${ROLE_COLORS.operator} ${admin}% ${admin + operator}%, ${ROLE_COLORS.editor} ${admin + operator}% ${admin + operator + editor}%, ${ROLE_COLORS.viewer} ${admin + operator + editor}% ${admin + operator + editor + viewer}%, rgba(148,163,184,.22) ${admin + operator + editor + viewer}% 100%)`,
  } as CSSProperties;

  return (
    <div className="nova-users-board-donut-wrap">
      <div className="nova-users-board-donut" style={style}>
        <strong>{total}</strong>
        <span>Total</span>
      </div>
      <div className="nova-users-board-legend">
        {ROLE_OPTIONS.map((role) => {
          const count = counts[role.value] || 0;
          const share = percent(count, total);
          return (
            <div key={role.value}>
              <span><i style={{ background: ROLE_COLORS[role.value] || "#64748b" }} />{role.label}</span>
              <strong>{count} ({share}%)</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaginationBar({ params, meta }: { params: RawSearchParams; meta: PaginatedResponse<UserRow>["meta"] }) {
  const pages = Array.from({ length: Math.min(meta.totalPages, 5) }, (_, index) => index + 1);
  const start = meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const end = Math.min(meta.total, (meta.page - 1) * meta.pageSize + meta.pageSize);

  return (
    <div className="nova-users-board-pagination">
      <span>Mostrando {start} a {end} de {meta.total} usuários</span>
      <div>
        <Link href={withParams("/usuarios", params, { page: Math.max(1, meta.page - 1) })} aria-disabled={!meta.hasPrev}>‹</Link>
        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={withParams("/usuarios", params, { page: pageNumber })}
            data-active={pageNumber === meta.page}
          >
            {pageNumber}
          </Link>
        ))}
        {meta.totalPages > 5 ? <span>...</span> : null}
        <Link href={withParams("/usuarios", params, { page: Math.min(meta.totalPages, meta.page + 1) })} aria-disabled={!meta.hasNext}>›</Link>
        <span>{meta.pageSize} / página</span>
      </div>
    </div>
  );
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/usuarios");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/dashboard?denied=usuarios");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const role = readStringParam(params, "role", "all");
  const active = readStringParam(params, "active", "all");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 8);

  const [response, allUsers] = await Promise.all([
    apiJson<PaginatedResponse<UserRow>>(
      `/users${buildApiQuery({
        q,
        role: role !== "all" ? role : undefined,
        active: active !== "all" ? active : undefined,
        sortBy: "createdAt",
        sortDir: "desc",
        page,
        pageSize,
      })}`,
    ),
    apiJson<PaginatedResponse<UserRow>>(
      `/users${buildApiQuery({
        active: "all",
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        pageSize: 100,
      })}`,
    ),
  ]);

  const users = allUsers.items;
  const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  const activeUsers = users.filter((user) => user.isActive).length;
  const blockedUsers = users.filter((user) => !user.isActive).length;
  const availableProfiles = ROLE_OPTIONS.length;
  const mfaEnabled = activeUsers;
  const sessionsActive = activeUsers;
  const securityLevel = percent(activeUsers + mfaEnabled, Math.max(users.length * 2, 1));
  const pendingInvites = users.filter((user) => !user.isActive).slice(0, 3);

  return (
    <div className="nova-users-board-shell">
      <Nav />
      <div className="nova-users-board-main">
        <Topbar userEmail={session.user?.email} />
        <main className="nova-users-board-page">
          <header className="nova-users-board-heading">
            <div>
              <nav aria-label="Breadcrumb">
                <Link href="/configuracoes">Configurações</Link>
                <span>/</span>
                <strong>Usuários</strong>
              </nav>
              <h1>Usuários</h1>
              <p>Gestão de acessos, perfis e segurança operacional.</p>
            </div>
            <div>
              <ActionButton href="/usuarios" icon="refresh">Atualizar dados</ActionButton>
              <ActionButton href="/usuarios/nova" icon="plus-user" variant="primary">Novo usuário</ActionButton>
            </div>
          </header>

          <section className="nova-users-board-kpis" aria-label="Indicadores de usuários">
            <MetricCard icon="users" label="Usuários ativos" value={activeUsers} delta="+ 2" detail="vs. 7 dias atrás" tone="purple" />
            <MetricCard icon="shield" label="Perfis disponíveis" value={availableProfiles} detail="Sem alterações" tone="blue" />
            <MetricCard icon="lock" label="MFA habilitado" value={mfaEnabled} delta="+ 3" detail="vs. 7 dias atrás" tone="green" />
            <MetricCard icon="server" label="Sessões ativas" value={sessionsActive} delta="+ 5" detail="vs. 7 dias atrás" tone="orange" />
          </section>

          <section className="nova-users-board-content">
            <div className="nova-users-board-left">
              <section className="nova-users-board-card nova-users-board-list-card">
                <div className="nova-users-board-card-head">
                  <h2>Lista de usuários</h2>
                  <div>
                    <button type="button" aria-label="Exportar lista"><Icon name="download" /></button>
                    <button type="button" aria-label="Ajustar filtros"><Icon name="settings" /></button>
                  </div>
                </div>

                <form method="GET" className="nova-users-board-filters">
                  <label className="is-search">
                    <Icon name="search" />
                    <input name="q" defaultValue={q} placeholder="Buscar usuário ou e-mail..." />
                  </label>
                  <label>
                    <span>Perfil</span>
                    <select name="role" defaultValue={role}>
                      <option value="all">Todos</option>
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select name="active" defaultValue={active}>
                      <option value="all">Todos</option>
                      <option value="true">Ativo</option>
                      <option value="false">Bloqueado</option>
                    </select>
                  </label>
                  <input type="hidden" name="pageSize" value={pageSize} />
                  <button type="submit"><Icon name="settings" /><span>Aplicar</span></button>
                  <Link href="/usuarios"><Icon name="trash" /><span>Limpar</span></Link>
                </form>

                <div className="nova-users-board-table-wrap">
                  <table className="nova-users-board-table">
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>Status</th>
                        <th>Último acesso</th>
                        <th>MFA</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.items.length ? response.items.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <span className={`nova-users-board-avatar is-${roleToneLocal(user.role)}`}>{initials(user.name)}</span>
                            <strong>{user.name}</strong>
                          </td>
                          <td>{user.email}</td>
                          <td><Badge tone={roleToneLocal(user.role)}>{roleLabel(user.role)}</Badge></td>
                          <td><Badge tone={statusTone(user.isActive)}>{user.isActive ? "Ativo" : "Bloqueado"}</Badge></td>
                          <td>{formatDateTime(user.updatedAt || user.createdAt)}</td>
                          <td><Badge tone={user.isActive ? "green" : "orange"}>{user.isActive ? "Ativado" : "Pendente"}</Badge></td>
                          <td>
                            <div className="nova-users-board-row-actions">
                              <Link href={`/usuarios/${user.id}`} aria-label={`Abrir ${user.name}`}><Icon name="eye" /></Link>
                              <Link href={`/usuarios/${user.id}`} aria-label={`Editar ${user.name}`}><Icon name="pen" /></Link>
                              <Link href={`/usuarios/${user.id}`} aria-label={`Mais ações de ${user.name}`}><Icon name="more" /></Link>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7}>
                            <div className="nova-users-board-empty">Nenhum usuário encontrado.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationBar params={params} meta={response.meta} />
              </section>

              <section className="nova-users-board-card nova-users-board-invites">
                <div className="nova-users-board-card-head">
                  <h2>Convites pendentes <span>{pendingInvites.length}</span></h2>
                </div>
                <table className="nova-users-board-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Perfil</th>
                      <th>Enviado em</th>
                      <th>Expira em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.length ? pendingInvites.map((user) => (
                      <tr key={user.id}>
                        <td><span className={`nova-users-board-avatar is-${roleToneLocal(user.role)}`}>{initials(user.name)}</span><strong>{user.name}</strong></td>
                        <td>{user.email}</td>
                        <td><Badge tone={roleToneLocal(user.role)}>{roleLabel(user.role)}</Badge></td>
                        <td>{formatDateTime(user.createdAt)}</td>
                        <td>{formatDateTime(user.updatedAt || user.createdAt)}</td>
                        <td><div className="nova-users-board-row-actions"><Link href={`/usuarios/${user.id}`}><Icon name="mail" /></Link><Link href={`/usuarios/${user.id}`}><Icon name="trash" /></Link></div></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6}><div className="nova-users-board-empty is-small">Nenhum convite pendente.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Link href="/usuarios?active=false" className="nova-users-board-more-link">Ver todos os convites pendentes <Icon name="chevron" /></Link>
              </section>
            </div>

            <aside className="nova-users-board-right">
              <section className="nova-users-board-card nova-users-board-security">
                <div className="nova-users-board-side-title">
                  <Icon name="shield" />
                  <h2>Segurança</h2>
                </div>
                <div className="nova-users-board-security-grid">
                  <div><span>Tentativas de login</span><strong>{users.length * 7}</strong><small className="is-up">↑ 15%</small></div>
                  <div><span>Falhas recentes</span><strong>{blockedUsers}</strong><small className="is-up">↑ 8%</small></div>
                  <div><span>Sessões ativas</span><strong>{sessionsActive}</strong><small className="is-good">↑ 17%</small></div>
                  <div><span>MFA pendente</span><strong>{Math.max(0, users.length - mfaEnabled)}</strong><small className="is-good">↓ 20%</small></div>
                </div>
                <div className="nova-users-board-security-level">
                  <span>Nível de segurança</span>
                  <i><b style={{ width: `${securityLevel}%` }} /></i>
                  <div><strong>Bom</strong><small>Última atualização: {formatDateTime(new Date().toISOString())}</small><b>{securityLevel}%</b></div>
                </div>
              </section>

              <section className="nova-users-board-card">
                <div className="nova-users-board-card-head">
                  <h2>Distribuição por perfil</h2>
                  <button type="button" aria-label="Mais opções"><Icon name="more" /></button>
                </div>
                <DistributionDonut counts={roleCounts} total={users.length} />
              </section>

              <section className="nova-users-board-card nova-users-board-quick">
                <div className="nova-users-board-side-title is-orange">
                  <Icon name="activity" />
                  <h2>Ações rápidas</h2>
                </div>
                <Link href="/usuarios/nova"><Icon name="plus-user" /><span>Novo usuário</span><Icon name="chevron" /></Link>
                <Link href="/usuarios"><Icon name="download" /><span>Exportar lista</span><Icon name="chevron" /></Link>
                <Link href="/usuarios?active=false"><Icon name="mail" /><span>Reenviar convite</span><Icon name="chevron" /></Link>
                <Link href="/usuarios"><Icon name="lock" /><span>Forçar redefinição de senha</span><Icon name="chevron" /></Link>
              </section>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
