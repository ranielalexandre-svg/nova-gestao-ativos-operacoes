import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerWebSession } from "@/lib/web-session";

export default async function LoginPage() {
  const session = await getServerWebSession();

  if (session.authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="nova-login-page min-h-dvh overflow-hidden bg-[#070b10] px-5 py-8 text-slate-100"><div className="relative z-10 mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_440px]"><section className="hidden lg:block"><div className="inline-flex rounded-full border border-sky-400/25 bg-sky-500/12 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-sky-100 shadow-[0_12px_34px_rgba(14,165,233,0.12)]">
            NOVA · Plataforma operacional
          </div><h1 className="mt-5 max-w-2xl text-[40px] font-black leading-[1.02] tracking-[-0.055em] text-slate-50 xl:text-[48px]">
            NOVA Gestão de Ativos e Operações
          </h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
            Inventário operacional, parceiros, unidades, ocorrências e monitoramento em uma experiência local pronta para a operação.
          </p><div className="mt-8 grid gap-4 xl:grid-cols-3"><div className="nova-login-feature rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"><div className="text-sm font-semibold text-slate-50">Inventário centralizado</div><p className="mt-2 text-sm leading-6 text-slate-400">Unidades, parceiros e ativos.</p></div><div className="nova-login-feature rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"><div className="text-sm font-semibold text-slate-50">Governança e auditoria</div><p className="mt-2 text-sm leading-6 text-slate-400">Perfis, auditoria e rastreabilidade.</p></div><div className="nova-login-feature rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"><div className="text-sm font-semibold text-slate-50">Fluxo NOC</div><p className="mt-2 text-sm leading-6 text-slate-400">Ocorrências, manutenções e monitoramento.</p></div></div></section><LoginForm /></div></main>
  );
}
