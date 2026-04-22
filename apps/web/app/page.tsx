import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionTile, InlineStat, KpiTile, SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  telemetryCoveragePct,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

const paths = [
  {
    area: "Dashboard",
    href: "/dashboard",
    context: "Leitura executiva curta para abrir o turno sem perder o foco.",
    tone: "info",
    signal: "painel",
  },
  {
    area: "Fila operacional",
    href: "/operacao/fila",
    context: "Triagem, prioridade, SLA e despacho do turno.",
    tone: "info",
    signal: "core",
  },
  {
    area: "Unidades",
    href: "/unidades",
    context: "Base de locais, parceiros, ativos e monitoramento.",
    tone: "success",
    signal: "cadastro",
  },
  {
    area: "Monitoramento",
    href: "/monitoramento",
    context: "Hosts, latência, perda, sensores e vínculos técnicos.",
    tone: "attention",
    signal: "noc",
  },
];

export default async function HomePage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/");
  }

  const [telemetry, commandCenter] = await Promise.all([
    readUnitHostTelemetry(),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);

  const coveragePct = telemetryCoveragePct(telemetry);
  const sourceFailures = telemetry.sources.filter((item) => !item.ok).length;

  return (
    <AppShell
      title="NOVA"
      subtitle="Workbench interno para ativos, unidades e operação diária."
    >
      <section className="grid gap-5">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Início"
            title="Centro de trabalho"
            description="Entrada curta para seguir para as superfícies reais, com os sinais mínimos que ajudam a escolher o próximo movimento."
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard"
                  className="rounded-[12px] border border-blue-400/30 bg-[#17213a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
                >
                  Abrir dashboard
                </Link>
                <Link
                  href="/operacao/fila"
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/18 hover:bg-white/[0.08]"
                >
                  Ir para fila
                </Link>
              </div>
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <TonePill tone={coveragePct >= 80 ? "success" : coveragePct >= 50 ? "attention" : "critical"}>
              cobertura host {coveragePct}%
            </TonePill>
            <TonePill tone={telemetry.counts.down ? "critical" : telemetry.counts.degraded ? "attention" : "success"}>
              {telemetry.counts.down} offline · {telemetry.counts.degraded} em atenção
            </TonePill>
            <TonePill tone={sourceFailures ? "attention" : "success"}>
              {telemetry.sources.length} fonte(s) · {sourceFailures} falha(s)
            </TonePill>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InlineStat label="Ocorrências abertas" value={commandCenter.metrics.openOccurrences} tone={commandCenter.metrics.openOccurrences ? "info" : "neutral"} />
            <InlineStat label="Críticas abertas" value={commandCenter.metrics.criticalOpenOccurrences} tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral"} />
            <InlineStat label="Manutenções vencidas" value={commandCenter.metrics.overdueMaintenances} tone={commandCenter.metrics.overdueMaintenances ? "attention" : "neutral"} />
            <InlineStat label="Unidades sem host" value={telemetry.counts.unmapped} tone={telemetry.counts.unmapped ? "attention" : "neutral"} />
          </div>
        </Surface>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            href="/monitoramento"
            label="Cobertura de hosts"
            value={`${coveragePct}%`}
            meta={`${telemetry.counts.matched} vinculadas nesta leitura`}
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
            href="/unidades"
            label="Unidades ativas"
            value={telemetry.counts.units}
            meta={`${telemetry.counts.syncReady} host(s) prontos para sync`}
            tone="neutral"
          />
          <KpiTile
            href="/parceiros"
            label="Parceiros no recorte"
            value={new Set(telemetry.items.map((item) => item.partner.id)).size}
            meta="cobertura observada neste instante"
            tone="subtle"
          />
        </section>

        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Rotas principais"
            title="Caminhos principais"
            description="Os caminhos que mais importam na rotina aparecem como blocos de acesso direto, sem uma camada de apresentação extra."
            compact
          />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {paths.map((item) => (
              <ActionTile
                key={item.href}
                href={item.href}
                title={item.area}
                description={item.context}
                badge={<TonePill tone={item.tone}>{item.signal}</TonePill>}
              />
            ))}
          </div>
        </Surface>
      </section>
    </AppShell>
  );
}
