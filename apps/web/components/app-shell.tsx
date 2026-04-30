import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebarNav, type NavItem } from "@/components/app-sidebar-nav";
import { SidebarCollapseControls } from "@/components/sidebar-collapse-controls";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type NavEntry = NavItem & { adminOnly?: boolean };

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Painel", short: "PA", icon: "dashboard", section: "Core" },
  { href: "/parceiros", label: "Parceiros", short: "PR", icon: "partners", section: "Core" },
  { href: "/unidades", label: "Unidades", short: "UN", icon: "units", section: "Core" },
  {
    href: "/equipamentos",
    label: "Equipamentos",
    short: "EQ",
    icon: "equipment",
    section: "Core",
    children: [{ href: "/equipamentos/starlinks", label: "Starlinks", short: "ST", icon: "satellite" }],
  },
  { href: "/monitoramento", label: "Monitoramento", short: "MO", icon: "monitoring", section: "Core" },
  { href: "/relatorios", label: "Relatórios", short: "RL", icon: "reports", section: "Core" },
  { href: "/ocorrencias", label: "Ocorrências", short: "OC", icon: "incidents", section: "Core" },
  { href: "/operacao/fila", label: "Fila", short: "FL", icon: "queue", section: "Operação" },
  { href: "/operacao/excecoes", label: "Exceções", short: "EX", icon: "exceptions", section: "Operação" },
  { href: "/operacao/automacoes", label: "Automações", short: "AU", icon: "automation", section: "Operação" },
  { href: "/operacao/sla", label: "SLA", short: "SL", icon: "sla", section: "Operação", adminOnly: true },
  { href: "/usuarios", label: "Usuários", short: "US", icon: "users", section: "Admin", adminOnly: true },
  { href: "/operacao/atividade", label: "Atividade", short: "AT", icon: "activity", section: "Admin", adminOnly: true },
  { href: "/operacao/importacao", label: "Importação", short: "IM", icon: "import", section: "Admin", adminOnly: true },
  { href: "/reconciliacao-central", label: "Reconciliação", short: "RC", icon: "reconcile", section: "Admin", adminOnly: true },
  { href: "/integracoes", label: "Integrações", short: "IN", icon: "integrations", section: "Admin", adminOnly: true },
];

function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Ir para o início"
      className="group inline-flex min-w-0 items-center gap-3 rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35"
    ><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.045] text-[15px] font-black tracking-tight text-white shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition group-hover:border-sky-300/30 group-hover:bg-sky-400/10">
        N
      </span><span className="min-w-0"><span className="block text-[15px] font-black uppercase leading-none tracking-tight text-white">NOVA OPS</span><span className="mt-1.5 block text-[10px] font-bold uppercase leading-4 tracking-[0.2em] text-slate-500">
          Gestão de ativos
        </span></span></Link>
  );
}

function UserCard({ session, role }: { session: Awaited<ReturnType<typeof getServerWebSession>>; role: string }) {
  if (!session.authenticated || !session.user) {
    return (
      <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4 text-sm"><div className="text-slate-400">Sessão não autenticada.</div><Link
          href="/login"
          className="mt-3 inline-flex min-h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white transition hover:bg-white/[0.1]"
        >
          Entrar
        </Link></div>
    );
  }

  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-4 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.16)]"><div className="min-w-0"><div className="truncate font-bold text-white">{session.user.name}</div><div className="mt-1 truncate text-xs text-slate-400">{session.user.email}</div><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-100">
            {role === "admin" ? "Admin" : session.user.role}
          </span><LogoutButton /></div></div></div>
  );
}

export async function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const session = await getServerWebSession();
  const role = normalizeRole(session.user?.role || "");
  const visibleNav = NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <div className="nova-app min-h-dvh bg-[#070b10] text-slate-100"><a href="#conteudo-principal" className="nova-skip-link">Pular para o conteúdo</a><div className="nova-layout grid min-h-dvh lg:grid-cols-[276px_minmax(0,1fr)]"><SidebarCollapseControls items={visibleNav} /><aside className="nova-sidebar hidden border-r border-white/[0.08] bg-[#070b10] lg:sticky lg:top-0 lg:flex lg:h-dvh"><div className="flex h-full min-h-0 w-full flex-col px-4 py-4"><div className="shrink-0 pb-5"><BrandMark /></div><div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"><AppSidebarNav items={visibleNav} /></div><div className="shrink-0 pt-5"><UserCard session={session} role={role} /></div></div></aside><main className="nova-main min-w-0 bg-[#080d13]"><div className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080d13]/92 px-4 py-3 backdrop-blur-xl lg:hidden"><details className="nova-mobile-menu group"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 outline-none transition marker:hidden focus-visible:ring-2 focus-visible:ring-sky-400/35"><BrandMark /><span className="inline-flex min-h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.05] px-3 text-sm font-bold text-slate-100">
                  Menu
                </span></summary><div className="nova-mobile-drawer fixed inset-x-3 top-[76px] z-50 max-h-[calc(100dvh-88px)] overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#070b10] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"><div className="max-h-[calc(100dvh-88px)] overflow-y-auto p-4"><AppSidebarNav items={visibleNav} /><div className="mt-5"><UserCard session={session} role={role} /></div></div></div></details></div><div id="conteudo-principal" className="nova-content mx-auto w-full max-w-[1500px] px-5 py-5 sm:px-7 lg:px-8"><header className="nova-topbar mb-5 grid gap-4 border-b border-white/[0.07] pb-4 xl:grid-cols-[minmax(220px,1fr)_minmax(360px,760px)_auto] xl:items-center"><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">NOVA OPS</div><h1 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-50 sm:text-[26px]">{title}</h1>
                {subtitle ? <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
              </div><form action="/unidades" className="nova-global-search hidden min-w-0 rounded-[18px] border border-white/[0.08] bg-[#0d131a] p-1 lg:flex"><input
                  name="q"
                  type="search"
                  aria-label="Busca global"
                  placeholder="Pesquisar parceiro, local, ativo, IP ou serial"
                  className="min-w-0 flex-1 rounded-[14px] border-0 bg-transparent px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                /><button
                  type="submit"
                  className="inline-flex min-h-10 min-w-24 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400/35"
                  aria-label="Buscar"
                >
                  Buscar
                </button></form><div className="flex min-w-0 items-center gap-2 xl:justify-end">
                {session.authenticated && session.user ? (
                  <div className="hidden min-w-0 text-right md:block"><div className="truncate text-sm font-bold text-slate-50">{session.user.name}</div><div className="text-xs text-slate-500">{role === "admin" ? "Administrador" : session.user.role}</div></div>
                ) : null}
                <Link
                  href={role === "admin" ? "/usuarios" : "/dashboard"}
                  className="inline-flex min-h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400/35"
                >
                  Perfil
                </Link></div></header><div className="min-w-0 space-y-5">{children}</div></div></main></div></div>
  );
}
