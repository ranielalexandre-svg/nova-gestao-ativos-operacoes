import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebarNav, type NavItem } from "@/components/app-sidebar-nav";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type NavEntry = NavItem & { adminOnly?: boolean };

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Visão geral", short: "VG", icon: "dashboard", section: "Geral" },

  { href: "/monitoramento", label: "Sensores", short: "SN", icon: "monitoring", section: "Monitoramento" },
  { href: "/mapas", label: "Mapas", short: "MP", icon: "map", section: "Monitoramento" },
  { href: "/ocorrencias", label: "Alertas", short: "AL", icon: "incidents", section: "Monitoramento" },

  {
    href: "/equipamentos",
    label: "Ativos",
    short: "AT",
    icon: "equipment",
    section: "Gestão",
    children: [{ href: "/equipamentos/starlinks", label: "Starlinks", short: "ST", icon: "satellite" }],
  },
  { href: "/unidades", label: "Unidades", short: "UN", icon: "units", section: "Gestão" },
  { href: "/parceiros", label: "Parceiros", short: "PR", icon: "partners", section: "Gestão" },
  { href: "/contratos", label: "Contratos", short: "CT", icon: "contracts", section: "Gestão" },
  { href: "/manutencoes", label: "Chamados", short: "CH", icon: "queue", section: "Gestão" },
  { href: "/operacao/excecoes", label: "Exceções", short: "EX", icon: "exceptions", section: "Gestão" },
  { href: "/operacao/automacoes", label: "Automação", short: "AU", icon: "automation", section: "Gestão" },

  { href: "/relatorios/monitoramento", label: "Monitoramento", short: "RM", icon: "reports", section: "Relatórios" },
  { href: "/relatorios", label: "Consumo", short: "RC", icon: "reports", section: "Relatórios" },
  { href: "/relatorios/disponibilidade", label: "Disponibilidade", short: "DI", icon: "sla", section: "Relatórios", adminOnly: true },
  { href: "/relatorios/performance", label: "Performance", short: "PF", icon: "activity", section: "Relatórios", adminOnly: true },

  { href: "/operacao/importacao", label: "Importação", short: "IM", icon: "import", section: "Configurações", adminOnly: true },
  { href: "/reconciliacao-central", label: "Reconciliação", short: "RE", icon: "reconcile", section: "Configurações", adminOnly: true },
  { href: "/usuarios", label: "Usuários", short: "US", icon: "users", section: "Configurações", adminOnly: true },
  { href: "/perfis", label: "Perfis", short: "PF", icon: "profiles", section: "Configurações", adminOnly: true },
  { href: "/integracoes", label: "Integrações", short: "IN", icon: "integrations", section: "Configurações", adminOnly: true },
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

function IconButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="nds-icon-button"
    >
      {children}
    </button>
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
        className="inline-flex min-h-11 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08]"
      >
        Entrar
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email || "N").trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2 border-l border-white/10 pl-3">
      <div className="hidden min-w-0 text-right md:block">
        <div className="truncate text-[11px] font-bold text-slate-50">
          {role === "admin" ? "Administrador" : session.user.name}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-slate-500">{session.user.email}</div>
      </div>
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--nova-primary)] text-[10px] font-black text-white">
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
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm">
        <div className="text-slate-400">Sessão não autenticada.</div>
        <Link
          href="/login"
          className="mt-3 inline-flex min-h-10 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white transition hover:bg-white/[0.1]"
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
          {role === "admin" ? "Admin" : session.user.role}
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
  const visibleNav = NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <div className="nds-shell" data-nova-layout="layoutA">
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
          <div className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080d14]/88 px-4 py-3 backdrop-blur-2xl lg:hidden">
            <details className="nova-mobile-menu group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 outline-none transition marker:hidden focus-visible:ring-2 focus-visible:ring-orange-400/35">
                <NovaLogo />
                <span className="inline-flex min-h-10 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-sm font-bold text-slate-100">
                  Menu
                </span>
              </summary>
              <div className="nova-mobile-drawer fixed inset-x-3 top-[84px] z-50 max-h-[calc(100dvh-96px)] overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#070b10] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
                <div className="max-h-[calc(100dvh-96px)] overflow-y-auto p-4">
                  <AppSidebarNav items={visibleNav} />
                  <div className="mt-5">
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
              <IconButton label="Notificações">
                ♢
                <span className="nds-notification-dot">3</span>
              </IconButton>
              <IconButton label="Ajuda">?</IconButton>
              <IconButton label="Tema">☼</IconButton>
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
