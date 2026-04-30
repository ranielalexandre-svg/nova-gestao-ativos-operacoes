import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartCard, RightPanel, StatCard, Surface, TonePill } from "@/components/ops-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

const settingsGroups = [
  { title: "Aparência", description: "Tema NOVA, densidade de tabelas e preferências visuais.", tone: "attention" },
  { title: "Relatórios", description: "Cabeçalho, rodapé, formatos PDF/DOCX e política de gráficos.", tone: "info" },
  { title: "Operação", description: "SLA, filas, severidades, automações e notificações.", tone: "success" },
  { title: "Segurança", description: "Sessão, perfis, auditoria e integrações sensíveis.", tone: "critical" },
];

export default async function ConfiguracoesPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/configuracoes");
  if (normalizeRole(session.user?.role || "") !== "admin") redirect("/dashboard");

  return (
    <AppShell title="Configurações do Sistema" subtitle="Parâmetros do produto, regras operacionais e governança do ambiente.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Tema" value="NOVA" detail="dark command center" tone="attention" />
            <StatCard label="Exportação" value="PDF/DOCX" detail="relatórios com timbrado" tone="info" />
            <StatCard label="Auditoria" value="ativa" detail="eventos preservados" tone="success" />
            <StatCard label="Integrações" value="Zabbix" detail="fonte operacional" tone="neutral" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {settingsGroups.map((group) => (
              <Surface key={group.title} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Configuração</div>
                    <h2 className="mt-2 text-xl font-black text-white">{group.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{group.description}</p>
                  </div>
                  <TonePill tone={group.tone}>{group.tone}</TonePill>
                </div>
              </Surface>
            ))}
          </div>

          <ChartCard title="Saúde do ambiente" subtitle="placeholder visual para status do produto" tone="success" />
        </div>

        <RightPanel title="Ações rápidas" description="Rotas administrativas relacionadas.">
          <Link href="/integracoes" className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm font-bold text-white hover:border-orange-300/30">Integrações</Link>
          <Link href="/usuarios" className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm font-bold text-white hover:border-orange-300/30">Usuários</Link>
          <Link href="/perfis" className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm font-bold text-white hover:border-orange-300/30">Perfis</Link>
          <div className="rounded-[12px] border border-orange-400/20 bg-orange-500/[0.08] p-4 text-sm leading-6 text-orange-100">
            Configurações destrutivas devem continuar protegidas por confirmação explícita e auditoria.
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
