import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RecentMaintenancesPanel, RecentOccurrencesPanel } from "@/components/recent-ops-panels";
import { ActionTile, InlineStat, KpiTile, SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import {
  emptyCommandCenter,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

export default async function DashboardPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/dashboard");
  }

  const commandCenter = await safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter());

  const pathways = [
    {
      href: "/operacao/fila",
      title: "Fila",
      description: "Triagem, backlog, SLA e despacho do turno.",
      badge: <TonePill tone="info">core</TonePill>,
    },
    {
      href: "/monitoramento",
      title: "Monitoramento",
      description: "Hosts, perda, latência, sensores e reconciliação assistida.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
    {
      href: "/unidades",
      title: "Unidades",
      description: "Cadastro operacional, vínculos, equipamentos e status da base.",
      badge: <TonePill tone="success">cadastro</TonePill>,
    },
    {
      href: "/parceiros",
      title: "Parceiros",
      description: "Cobertura, acionamento e contexto da operação terceirizada.",
      badge: <TonePill tone="neutral">rede</TonePill>,
    },
    {
      href: "/equipamentos",
      title: "Equipamentos",
      description: "Inventário, serial, MAC salvo e associação à unidade real.",
      badge: <TonePill tone="subtle">ativos</TonePill>,
    },
    {
      href: "/integracoes",
      title: "Integrações",
      description: "Conectores, reconciliação e preparação da sincronização segura.",
      badge: <TonePill tone="violet">sync</TonePill>,
    },
  ];

  return (
    <AppShell
      title="Dashboard"
    ><section className="nova-dashboard-page grid gap-5"><Surface className="p-5 sm:p-6"><SectionIntro
            eyebrow="Painel"
            title="Saúde operacional"
            actions={
              <div className="flex flex-wrap gap-2"><Link
                  href="/operacao/fila"
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
                >
                  Abrir fila
                </Link><Link
                  href="/monitoramento"
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Abrir monitoramento
                </Link></div>
            }
          /><div className="mt-4 flex flex-wrap gap-2"><TonePill tone={commandCenter.metrics.openOccurrences ? "attention" : "success"}>
              {commandCenter.metrics.openOccurrences} ocorrência(s) aberta(s)
            </TonePill><TonePill tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "success"}>
              {commandCenter.metrics.criticalOpenOccurrences} crítica(s)
            </TonePill><TonePill tone="info">telemetria ao vivo em Monitoramento</TonePill></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><InlineStat label="Ocorrências abertas" value={commandCenter.metrics.openOccurrences} tone={commandCenter.metrics.openOccurrences ? "info" : "neutral"} /><InlineStat label="Críticas abertas" value={commandCenter.metrics.criticalOpenOccurrences} tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral"} /><InlineStat label="Manutenções vencidas" value={commandCenter.metrics.overdueMaintenances} tone={commandCenter.metrics.overdueMaintenances ? "attention" : "neutral"} /><InlineStat label="Manutenções hoje" value={commandCenter.metrics.dueTodayMaintenances} tone={commandCenter.metrics.dueTodayMaintenances ? "info" : "neutral"} /></div></Surface><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="nova-page-stack nova-page-dashboard grid gap-5"><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><KpiTile
                href="/operacao/fila"
                label="Fila"
                value={commandCenter.metrics.openOccurrences}
                meta="ocorrências abertas para triagem"
                tone={commandCenter.metrics.openOccurrences ? "attention" : "success"}
              /><KpiTile
                href="/monitoramento?health=down"
                label="Monitoramento"
                value="Zabbix"
                meta="abrir leitura completa de hosts e sensores"
                tone="info"
              /><KpiTile
                href="/unidades"
                label="Unidades"
                value="Base"
                meta="cadastro, vínculos e equipamentos"
                tone="neutral"
              /><KpiTile
                href="/relatorios"
                label="Relatórios"
                value="Exportar"
                meta="consumo técnico em PDF ou DOCX"
                tone="subtle"
              /></section><section className="grid gap-5 xl:grid-cols-2"><RecentOccurrencesPanel commandCenter={commandCenter} /><RecentMaintenancesPanel commandCenter={commandCenter} /></section></div><Surface className="p-5 sm:p-6"><SectionIntro
              eyebrow="Rotas reais"
              title="Acessos"
              description=" "
              compact
            /><div className="mt-4 grid gap-3">
              {pathways.map((item) => (
                <ActionTile
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                />
              ))}
            </div></Surface></div></section></AppShell>
  );
}
