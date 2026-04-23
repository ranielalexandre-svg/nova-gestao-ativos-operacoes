import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

const NAV = [
  { href: "/dashboard", label: "Painel", short: "PA", section: "Core" },
  { href: "/parceiros", label: "Parceiros", short: "PR", section: "Core" },
  { href: "/unidades", label: "Unidades", short: "UN", section: "Core" },
  { href: "/equipamentos", label: "Equipamentos", short: "EQ", section: "Core" },
  { href: "/equipamentos/starlinks", label: "Starlinks", short: "ST", section: "Core" },
  { href: "/monitoramento", label: "Monitoramento", short: "MO", section: "Core" },
  { href: "/relatorios/monitoramento", label: "Relatórios", short: "RL", section: "Core" },
  { href: "/ocorrencias", label: "Ocorrências", short: "OC", section: "Core" },
  { href: "/operacao/fila", label: "Fila", short: "FL", section: "Operação" },
  { href: "/operacao/excecoes", label: "Exceções", short: "EX", section: "Operação" },
  { href: "/operacao/automacoes", label: "Automações", short: "AU", section: "Operação" },
  { href: "/operacao/sla", label: "SLA", short: "SL", section: "Operação", adminOnly: true },
  { href: "/usuarios", label: "Usuários", short: "US", section: "Admin", adminOnly: true },
  { href: "/operacao/atividade", label: "Atividade", short: "AT", section: "Admin", adminOnly: true },
  { href: "/operacao/importacao", label: "Importação", short: "IM", section: "Admin", adminOnly: true },
  { href: "/reconciliacao-central", label: "Reconciliação", short: "RC", section: "Admin", adminOnly: true },
  { href: "/integracoes", label: "Integrações", short: "IN", section: "Admin", adminOnly: true },
];

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
    <div className="nova-app min-h-dvh bg-[#070b10] text-slate-100">
      <div className="nova-layout grid min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="nova-sidebar border-b border-white/[0.08] bg-[#070b10] lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
          <div className="flex h-full min-h-0 flex-col px-4 py-4">
            <div className="mb-7 flex shrink-0 items-start gap-3">
              <Link
                href="/"
                aria-label="Início"
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.035] text-sm font-bold leading-none text-slate-200 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              >
                N
              </Link>
              <div className="min-w-0 pt-1">
                <div className="text-[15px] font-bold uppercase leading-none tracking-tight text-white">NOVA OPS</div>
                <div className="mt-2 text-[10px] font-semibold uppercase leading-4 tracking-[0.24em] text-slate-500">
                  Cadastro +<br />Monitoramento
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <AppSidebarNav items={visibleNav} />
            </div>

            <div className="mt-6 shrink-0 rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4 text-sm">
              {session.authenticated && session.user ? (
                <div className="space-y-3">
                  <div>
                    <div className="truncate font-semibold text-white">{session.user.name}</div>
                    <div className="mt-1 truncate text-slate-400">{session.user.email}</div>
                    <div className="mt-3 inline-flex rounded-full border border-sky-500/24 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100">
                      {session.user.role}
                    </div>
                  </div>
                  <LogoutButton />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-slate-400">Sessão não autenticada.</div>
                  <Link href="/login" className="inline-flex rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]">
                    Entrar
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="nova-main min-w-0 bg-[#080d13]">
          <div className="nova-content mx-auto w-full max-w-[1500px] px-5 py-5 sm:px-7 lg:px-8">
            <header className="nova-topbar mb-5 grid gap-4 border-b border-white/[0.07] pb-4 xl:grid-cols-[minmax(220px,1fr)_minmax(360px,760px)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">NOVA OPS</div>
                <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-50 sm:text-[26px]">{title}</h1>
                {subtitle ? <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
              </div>

              <form action="/unidades" className="hidden min-w-0 rounded-[18px] border border-white/[0.08] bg-[#0d131a] p-1 lg:flex">
                <input
                  name="q"
                  type="search"
                  aria-label="Busca global"
                  placeholder="Pesquisar parceiro, local, ativo, IP ou serial"
                  className="min-w-0 flex-1 rounded-[14px] border-0 bg-transparent px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 w-12 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label="Buscar"
                >
                  Buscar
                </button>
              </form>

              <div className="flex min-w-0 items-center gap-2 xl:justify-end">
                {session.authenticated && session.user ? (
                  <div className="hidden min-w-0 text-right md:block">
                    <div className="truncate text-sm font-semibold text-slate-50">{session.user.name}</div>
                    <div className="text-xs text-slate-500">{role === "admin" ? "Administrador" : session.user.role}</div>
                  </div>
                ) : null}
                <Link
                  href={role === "admin" ? "/usuarios" : "/dashboard"}
                  className="inline-flex h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Perfil
                </Link>
              </div>
            </header>

            <div className="min-w-0 space-y-5">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
