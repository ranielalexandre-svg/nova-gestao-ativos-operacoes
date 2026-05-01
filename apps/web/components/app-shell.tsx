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
    section: "Cadastro",
    children: [{ href: "/equipamentos/starlinks", label: "Starlinks", short: "ST", icon: "satellite" }],
  },
  { href: "/unidades", label: "Unidades", short: "UN", icon: "units", section: "Cadastro" },
  { href: "/parceiros", label: "Parceiros", short: "PR", icon: "partners", section: "Cadastro" },
  { href: "/contratos", label: "Contratos", short: "CT", icon: "contracts", section: "Cadastro" },

  { href: "/manutencoes", label: "Chamados", short: "CH", icon: "queue", section: "Operação" },
  { href: "/operacao/excecoes", label: "Exceções", short: "EX", icon: "exceptions", section: "Operação" },
  { href: "/operacao/automacoes", label: "Automação", short: "AU", icon: "automation", section: "Operação" },

  { href: "/relatorios/monitoramento", label: "Monitoramento", short: "RM", icon: "reports", section: "Relatórios" },
  { href: "/relatorios", label: "Consumo", short: "RC", icon: "reports", section: "Relatórios" },
  { href: "/relatorios/disponibilidade", label: "Disponibilidade", short: "DI", icon: "sla", section: "Relatórios", adminOnly: true },
  { href: "/relatorios/performance", label: "Performance", short: "PF", icon: "activity", section: "Relatórios", adminOnly: true },

  { href: "/operacao/importacao", label: "Importação", short: "IM", icon: "import", section: "Dados", adminOnly: true },
  { href: "/reconciliacao-central", label: "Reconciliação", short: "RE", icon: "reconcile", section: "Dados", adminOnly: true },

  { href: "/usuarios", label: "Usuários", short: "US", icon: "users", section: "Administração", adminOnly: true },
  { href: "/perfis", label: "Perfis", short: "PF", icon: "profiles", section: "Administração", adminOnly: true },
  { href: "/integracoes", label: "Integrações", short: "IN", icon: "integrations", section: "Administração", adminOnly: true },
  { href: "/configuracoes", label: "Configurações", short: "CF", icon: "settings", section: "Administração", adminOnly: true },
];

function NovaLogo() {
  return (
    <Link
      href="/"
      aria-label="Ir para o início"
      className="nova-brand group inline-flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-orange-400/45"
    >
      <span className="leading-none">
        <span className="block text-[18px] font-black tracking-[-0.13em] text-white">
          NOV<span className="text-orange-500">A</span>
        </span>
        <span className="mt-0.5 block text-[6px] font-semibold uppercase tracking-[0.42em] text-slate-400">
          TELECOM
        </span>
      </span>
    </Link>
  );
}

function IconButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-[11px] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400/35"
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
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-[11px] font-black text-white shadow-[0_12px_26px_rgba(249,115,22,0.2)]">
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
    <div className="nova-sidebar-user rounded-md border border-white/[0.08] bg-white/[0.035] p-2 text-[11px] shadow-none">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-[11px] font-black text-white">
          {(session.user.name || "N").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-white">{session.user.name}</div>
          <div className="mt-0.5 truncate text-[10px] text-slate-500">{session.user.email}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex rounded border border-orange-400/25 bg-orange-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-orange-100">
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
    <div className="nova-app nova-command-center min-h-dvh text-slate-100">
      <a href="#conteudo-principal" className="nova-skip-link">
        Pular para o conteúdo
      </a>

      <div className="nova-layout grid min-h-dvh lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="nova-sidebar hidden border-r border-white/[0.08] bg-[#080d14]/98 lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="border-b border-white/[0.08] px-3 py-3">
              <NovaLogo />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 [scrollbar-gutter:stable]">
              <AppSidebarNav items={visibleNav} />
            </div>

            <div className="shrink-0 px-2 pb-3 pt-2">
              <SidebarUserCard session={session} role={role} />
            </div>
          </div>
        </aside>

        <main className="nova-main min-w-0">
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

          <div className="nova-top-strip hidden h-[42px] items-center justify-between border-b border-white/[0.08] bg-[#080d14]/72 px-4 backdrop-blur-2xl lg:flex">
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Command center operacional
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconButton label="Notificações">
                <span className="relative text-lg leading-none">
                  ♢
                  <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                    3
                  </span>
                </span>
              </IconButton>
              <IconButton label="Ajuda">?</IconButton>
              <IconButton label="Tema">☼</IconButton>
              <UserTopCard session={session} role={role} />
            </div>
          </div>

          <div
            id="conteudo-principal"
            className="nova-content mx-auto w-full max-w-[1340px] px-4 py-4 sm:px-5 lg:px-5"
          >
            {!hidePageHeader ? (
              <header className="nova-page-heading mb-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Nova</span>
                    <span>/</span>
                    <span className="text-slate-300">{title}</span>
                  </div>
                  <h1 className="mt-3 text-[26px] font-black tracking-[-0.035em] text-white sm:text-[31px]">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{subtitle}</p>
                  ) : null}
                </div>
              </header>
            ) : null}

            <div className="min-w-0 space-y-5">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
