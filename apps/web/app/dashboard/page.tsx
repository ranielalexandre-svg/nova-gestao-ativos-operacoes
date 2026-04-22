import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RecentMaintenancesPanel, RecentOccurrencesPanel } from "@/components/recent-ops-panels";
import { UnitWatchlistPanel } from "@/components/unit-watchlist-panel";
import { ActionTile, InlineStat, KpiTile, SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import {
  atRiskPartnerCount,
  emptyCommandCenter,
  operationPressure,
  readUnitHostTelemetry,
  safeApiJson,
  telemetryCoveragePct,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

export default async function DashboardPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/dashboard");
  }

  const [telemetry, commandCenter] = await Promise.all([
    readUnitHostTelemetry(),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const coveragePct = telemetryCoveragePct(telemetry);
  const pressure = operationPressure(commandCenter, telemetry);
  const partnersUnderWatch = atRiskPartnerCount(telemetry);
  const sourceFailures = telemetry.sources.filter((item) => !item.ok).length;

  const pathways = [
    {
      href: "/operacao/fila",
      title: "Fila operacional",
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
      badge: <TonePill tone="violet">base</TonePill>,
    },
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle="Leitura executiva curta para orientar o turno sem competir com as mesas de trabalho."
    >
      <section className="grid gap-5">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Painel do turno"
            title="Saúde operacional e prioridades do momento"
            description="O dashboard fica curto: mostra cobertura, risco e atalhos reais. A operação detalhada continua na fila, no monitoramento e nas fichas."
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/operacao/fila"
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
                >
                  Abrir fila
                </Link>
                <Link
                  href="/monitoramento"
                  className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Abrir monitoramento
                </Link>
              </div>
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <TonePill tone={coveragePct >= 80 ? "success" : coveragePct >= 50 ? "attention" : "critical"}>
              cobertura {coveragePct}%
            </TonePill>
            <TonePill tone={pressure ? "attention" : "success"}>{pressure} pressão</TonePill>
            <TonePill tone={sourceFailures ? "attention" : "success"}>
              {telemetry.sources.length} fonte(s) · {sourceFailures} falha(s)
            </TonePill>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InlineStat label="Ocorrências abertas" value={commandCenter.metrics.openOccurrences} tone={commandCenter.metrics.openOccurrences ? "info" : "neutral"} />
            <InlineStat label="Críticas abertas" value={commandCenter.metrics.criticalOpenOccurrences} tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral"} />
            <InlineStat label="Manutenções vencidas" value={commandCenter.metrics.overdueMaintenances} tone={commandCenter.metrics.overdueMaintenances ? "attention" : "neutral"} />
            <InlineStat label="Hosts sem vínculo" value={telemetry.counts.unmapped} tone={telemetry.counts.unmapped ? "attention" : "neutral"} />
          </div>
        </Surface>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiTile
                href="/monitoramento"
                label="Cobertura de hosts"
                value={`${coveragePct}%`}
                meta={`${telemetry.counts.matched} unidade(s) com host · ${telemetry.counts.unmapped} sem vínculo`}
                tone={coveragePct >= 80 ? "success" : coveragePct >= 50 ? "attention" : "critical"}
              />
              <KpiTile
                href="/monitoramento?health=down"
                label="Hosts offline"
                value={telemetry.counts.down}
                meta={`${telemetry.counts.degraded} em atenção`}
                tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"}
              />
              <KpiTile
                href="/parceiros"
                label="Parceiros em atenção"
                value={partnersUnderWatch}
                meta="parceiros com ao menos uma unidade pressionando o turno"
                tone={partnersUnderWatch ? "attention" : "neutral"}
              />
              <KpiTile
                href="/integracoes"
                label="Hosts prontos para sync"
                value={telemetry.counts.syncReady}
                meta={`${sourceFailures} fonte(s) com falha na leitura`}
                tone={telemetry.counts.syncReady ? "success" : "neutral"}
              />
            </section>

            <UnitWatchlistPanel
              telemetry={telemetry}
              title="Unidades que tendem a mudar a resposta do turno"
              description="Lista curta para escolher onde olhar primeiro sem entrar em cada mesa."
              limit={8}
            />

            <section className="grid gap-5 xl:grid-cols-2">
              <RecentOccurrencesPanel commandCenter={commandCenter} />
              <RecentMaintenancesPanel commandCenter={commandCenter} />
            </section>
          </div>

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Rotas reais"
              title="Caminhos que sustentam a operação"
              description="Cada bloco aponta para uma superfície de trabalho. Nada de navegação decorativa."
              compact
            />

            <div className="mt-4 grid gap-3">
              {pathways.map((item) => (
                <ActionTile
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                />
              ))}
            </div>
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
