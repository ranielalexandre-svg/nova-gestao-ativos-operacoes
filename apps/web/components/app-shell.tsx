import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebarNav, type NavItem } from "@/components/app-sidebar-nav";
import { getNovaLayoutVariant } from "@/lib/nova-layout";
import { emptyCommandCenter, safeApiJson, type CommandCenter } from "@/lib/noc-overview";
import { isAdminRole, roleLabel, roleShortLabel } from "@/lib/role-policy";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type NavEntry = NavItem & { adminOnly?: boolean };

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Visão geral", short: "VG", icon: "dashboard", section: "Geral" },

  { href: "/unidades", label: "Unidades", short: "UN", icon: "units", section: "Monitoramento" },
  { href: "/sensores", label: "Sensores", short: "SN", icon: "monitoring", section: "Monitoramento" },
  { href: "/mapas", label: "Mapas", short: "MP", icon: "map", section: "Monitoramento" },
  { href: "/alertas", label: "Alertas", short: "AL", icon: "incidents", section: "Monitoramento" },

  {
    href: "/ativos",
    label: "Ativos",
    short: "AT",
    icon: "equipment",
    section: "Gestão",
    children: [{ href: "/ativos/starlinks", label: "Starlinks", short: "ST", icon: "satellite" }],
  },
  { href: "/parceiros", label: "Parceiros", short: "PR", icon: "partners", section: "Gestão" },
  { href: "/contratos", label: "Contratos", short: "CT", icon: "contracts", section: "Gestão" },
  { href: "/chamados", label: "Chamados", short: "CH", icon: "queue", section: "Gestão" },
  { href: "/operacao/excecoes", label: "Exceções", short: "EX", icon: "exceptions", section: "Gestão" },
  { href: "/operacao/automacoes", label: "Automação", short: "AU", icon: "automation", section: "Gestão" },

  { href: "/operacao/relatorios/monitoramento", label: "Monitoramento", short: "RM", icon: "reports", section: "Relatórios" },
  { href: "/operacao/relatorios/consumo", label: "Consumo", short: "RC", icon: "reports", section: "Relatórios" },
  { href: "/operacao/relatorios/disponibilidade", label: "Disponibilidade", short: "DI", icon: "sla", section: "Relatórios" },
  { href: "/operacao/relatorios/performance", label: "Performance", short: "PF", icon: "activity", section: "Relatórios" },

  { href: "/importacao", label: "Importação", short: "IM", icon: "import", section: "Configurações", adminOnly: true },
  { href: "/reconciliacao", label: "Reconciliação", short: "RE", icon: "reconcile", section: "Configurações", adminOnly: true },
  { href: "/usuarios", label: "Usuários", short: "US", icon: "users", section: "Configurações", adminOnly: true },
  { href: "/perfis", label: "Perfis", short: "PF", icon: "profiles", section: "Configurações", adminOnly: true },
  { href: "/monitoramento/fontes", label: "Fontes NOC", short: "FN", icon: "integrations", section: "Monitoramento" },
  { href: "/configuracoes", label: "Sistema", short: "CF", icon: "settings", section: "Configurações", adminOnly: true },
];

function NovaLogo() {
  return (
    <Link
      href="/"
      aria-label="Ir para o início"
      className="nds-logo"
    >
      <span className="nds-logo-main">
        NOV<span className="nds-logo-a">A</span>
      </span>
      <span className="nds-logo-sub">
        TELECOM
      </span>
    </Link>
  );
}

function TopbarActionLink({
  href,
  label,
  children,
  count,
}: {
  href: string;
  label: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="nds-icon-button"
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span className="nds-notification-dot">{Math.min(count, 99)}</span>
      ) : null}
    </Link>
  );
}

type TopbarIconName = "alert" | "report" | "settings";

function TopbarIcon({ name }: { name: TopbarIconName }) {
  const paths = {
    alert: (
      <>
        <path d="M10 3.2 18.4 17H1.6L10 3.2Z" />
        <path d="M10 8v3.6" />
        <path d="M10 14.2h.01" />
      </>
    ),
    report: (
      <>
        <path d="M5 2.8h7.2L15 5.6v11.6H5z" />
        <path d="M12 2.8v3h3" />
        <path d="M7.2 9.1h5.6" />
        <path d="M7.2 12h5.6" />
        <path d="M7.2 14.9h3.2" />
      </>
    ),
    settings: (
      <>
        <path d="M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z" />
        <path d="M10 2.6v2" />
        <path d="M10 15.4v2" />
        <path d="M2.6 10h2" />
        <path d="M15.4 10h2" />
        <path d="m4.8 4.8 1.4 1.4" />
        <path d="m13.8 13.8 1.4 1.4" />
        <path d="m15.2 4.8-1.4 1.4" />
        <path d="m6.2 13.8-1.4 1.4" />
      </>
    ),
  } satisfies Record<TopbarIconName, ReactNode>;

  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function UserTopCard({
  session,
  role,
}: {
  session: Awaited<ReturnType<typeof getServerWebSession>>;
  role: string;
}) {
  if (!session.authenticated || !session.user) {
    return (
      <Link
        href="/login"
        className="nds-button"
        data-variant="secondary"
      >
        Entrar
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email || "N").trim().slice(0, 1).toUpperCase();

  return (
    <div className="nds-topbar-user flex min-w-0 items-center gap-2 border-l border-white/10 pl-3">
      <div className="nds-topbar-user-text hidden min-w-0 text-right md:block">
        <div className="truncate text-[11px] font-bold text-slate-50">
          {session.user.name}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-slate-500">
          {roleLabel(role)} · {session.user.email}
        </div>
      </div>
      <div className="nds-topbar-avatar grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--nova-primary)] text-[10px] font-black text-white">
        {initial}
      </div>
    </div>
  );
}

function SidebarUserCard({
  session,
  role,
}: {
  session: Awaited<ReturnType<typeof getServerWebSession>>;
  role: string;
}) {
  if (!session.authenticated || !session.user) {
    return (
      <div className="nds-card text-[11px]">
        <div className="text-slate-400">Sessão não autenticada.</div>
        <Link
          href="/login"
          className="nds-button mt-2"
          data-variant="secondary"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="nds-user-card text-[11px]">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--nova-primary)] text-[11px] font-black text-white">
          {(session.user.name || "N").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-white">{session.user.name}</div>
          <div className="mt-0.5 truncate text-[10px] text-slate-500">{session.user.email}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="nds-badge" data-tone="primary">
          {roleShortLabel(role)}
        </span>
        <LogoutButton />
      </div>
    </div>
  );
}

export async function AppShell({
  title,
  subtitle,
  children,
  hidePageHeader = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  hidePageHeader?: boolean;
}) {
  const session = await getServerWebSession();
  const role = normalizeRole(session.user?.role || "");
  const layoutVariant = getNovaLayoutVariant();
  const isAdmin = isAdminRole(role);
  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);
  const commandCenter = session.authenticated
    ? await safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter())
    : emptyCommandCenter();
  const urgentSignals =
    commandCenter.metrics.criticalOpenOccurrences +
    commandCenter.metrics.overdueMaintenances +
    commandCenter.metrics.dueTodayMaintenances;
  const alertHref = commandCenter.metrics.criticalOpenOccurrences
    ? "/alertas?severity=critical"
    : commandCenter.metrics.overdueMaintenances
      ? "/chamados?status=in_progress"
      : "/operacao/fila";

  return (
    <div className="nds-shell" data-nova-layout={layoutVariant}>
      <a href="#conteudo-principal" className="nova-skip-link">
        Pular para o conteúdo
      </a>

      <div className="nds-layout">
        <aside className="nds-sidebar">
          <div className="nds-sidebar-inner">
            <div className="nds-logo-wrap">
              <NovaLogo />
            </div>

            <div className="nds-sidebar-scroll">
              <AppSidebarNav items={visibleNav} />
            </div>

            <div className="shrink-0">
              <SidebarUserCard session={session} role={role} />
            </div>
          </div>
        </aside>

        <main className="nds-main">
          <div className="sticky top-0 z-50 border-b border-[var(--nova-border-soft)] bg-[color-mix(in_srgb,var(--nova-topbar)_88%,transparent)] px-3 py-2 lg:hidden">
            <details className="nova-mobile-menu group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 outline-none transition marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--nova-primary)]/35">
                <NovaLogo />
                <span className="nds-button" data-variant="secondary">
                  Menu
                </span>
              </summary>
              <div className="nova-mobile-drawer nds-card fixed inset-x-3 top-[68px] z-50 max-h-[calc(100dvh-80px)] overflow-hidden">
                <div className="max-h-[calc(100dvh-80px)] overflow-y-auto p-2">
                  <AppSidebarNav items={visibleNav} />
                  <div className="mt-2">
                    <SidebarUserCard session={session} role={role} />
                  </div>
                </div>
              </div>
            </details>
          </div>

          <div className="nds-topbar">
            <div className="nds-topbar-title">
              <span className="nds-topbar-menu" aria-hidden="true">≡</span>
              <div>
                Sistema de gestão operacional
              </div>
            </div>

            <div className="nds-topbar-actions">
              <TopbarActionLink href={alertHref} label="Sinais críticos" count={urgentSignals}>
                <TopbarIcon name="alert" />
              </TopbarActionLink>
              <TopbarActionLink href="/operacao/relatorios/monitoramento" label="Gerar relatório">
                <TopbarIcon name="report" />
              </TopbarActionLink>
              {isAdmin ? (
                <TopbarActionLink href="/configuracoes" label="Configurações">
                  <TopbarIcon name="settings" />
                </TopbarActionLink>
              ) : null}
              <UserTopCard session={session} role={role} />
            </div>
          </div>

          <div
            id="conteudo-principal"
            className="nds-content"
          >
            {!hidePageHeader ? (
              <header className="nds-page-header">
                <div className="min-w-0">
                  <div className="nds-breadcrumb">
                    <span>Nova</span>
                    <span className="mx-1">/</span>
                    <span className="text-slate-300">{title}</span>
                  </div>
                  <h1 className="nds-page-title">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="nds-page-subtitle">{subtitle}</p>
                  ) : null}
                </div>
              </header>
            ) : null}

            <div className="nds-stack min-w-0">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
