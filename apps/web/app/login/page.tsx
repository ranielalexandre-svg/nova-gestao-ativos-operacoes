import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getNovaLayoutVariant } from "@/lib/nova-layout";
import { getServerWebSession } from "@/lib/web-session";

export default async function LoginPage() {
  const session = await getServerWebSession();

  if (session.authenticated) {
    redirect("/dashboard");
  }

  const layoutVariant = getNovaLayoutVariant();

  return (
    <main data-nova-layout={layoutVariant} className="nova-login-page min-h-dvh overflow-hidden px-3 py-2 text-slate-100">
      <div className="nova-login-grid relative z-10 mx-auto min-h-[calc(100dvh-1.5rem)] w-full max-w-5xl items-center">
        <section className="hidden lg:grid lg:gap-2">
          <div className="flex items-end justify-between gap-2 border-b border-[var(--nova-border-soft)] pb-2">
            <div>
              <div className="text-[20px] font-black leading-none text-slate-50">
                NOV<span className="text-[var(--nova-primary)]">A</span>
              </div>
              <div className="mt-1 text-[7px] font-black uppercase text-[var(--nova-text-muted)]">Telecom</div>
            </div>
            <div className="nds-badge" data-tone="primary">Layout A</div>
          </div>
          <div>
            <div className="nds-label">Site de gestão</div>
            <h1 className="mt-2 text-[18px] font-black leading-tight text-slate-50">
              Gestão de Ativos e Operações
            </h1>
            <p className="mt-2 max-w-xl text-[11px] leading-5 text-[var(--nova-text-muted)]">
              Entrada operacional compacta para inventário, monitoramento, alertas e relatórios.
            </p>
          </div>
          <div className="grid gap-2 xl:grid-cols-3">
            <div className="nova-login-feature"><div className="nds-label">Inventário</div><div className="mt-2 text-[13px] font-black text-slate-50">Ativos</div><p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">Unidades, parceiros e ativos.</p></div>
            <div className="nova-login-feature"><div className="nds-label">Operação</div><div className="mt-2 text-[13px] font-black text-slate-50">NOC</div><p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">Alertas, chamados e exceções.</p></div>
            <div className="nova-login-feature"><div className="nds-label">Governança</div><div className="mt-2 text-[13px] font-black text-slate-50">Auditoria</div><p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">Perfis, acessos e trilhas.</p></div>
          </div>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
