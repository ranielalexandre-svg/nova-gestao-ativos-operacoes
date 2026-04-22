import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerWebSession } from "@/lib/web-session";

export default async function LoginPage() {
  const session = await getServerWebSession();

  if (session.authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh bg-[#070b10] px-5 py-8 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_430px]">
        <section className="hidden lg:block">
          <div className="inline-flex rounded-full border border-sky-500/25 bg-sky-500/12 px-4 py-1.5 text-[11px] font-semibold text-sky-100">
            NOVA · Plataforma operacional
          </div>
          <h1 className="mt-5 max-w-2xl text-[36px] font-semibold leading-tight tracking-tight text-slate-50">
            NOVA Gestão de Ativos e Operações
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
            Inventário operacional, parceiros, unidades, ocorrências e monitoramento em uma experiência local pronta para a operação.
          </p>

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="text-sm font-semibold text-slate-50">Inventário centralizado</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Unidades, parceiros e ativos operacionais em uma leitura única.</p>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="text-sm font-semibold text-slate-50">Governança e auditoria</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Perfis, rastreabilidade e mudanças com contexto administrativo.</p>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="text-sm font-semibold text-slate-50">Fluxo NOC</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Ocorrências, manutenções, watchlist e monitoramento sem poluir a tela.</p>
            </div>
          </div>
        </section>

        <LoginForm />
      </div>
    </main>
  );
}
