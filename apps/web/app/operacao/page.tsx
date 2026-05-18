import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { RecentMaintenancesPanel, RecentOccurrencesPanel } from "@/components/recent-ops-panels";
import { UnitWatchlistPanel } from "@/components/unit-watchlist-panel";
import {
  ActionTile,
  FilterChip,
  InlineStat,
  KpiTile,
  SectionIntro,
  Surface,
  TonePill,
} from "@/components/ops-ui";
import { getServerWebSession } from "@/lib/web-session";
import {
  emptyCommandCenter,
  operationPressure,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";

type ExceptionSummary = {
  counts: {
    openCount: number;
    criticalCount: number;
    silencedCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};

type AutomationSummary = {
  counts: {
    enabledRules: number;
    failedRuns24h: number;
    dueRules: number;
  };
};

const emptyExceptionSummary: ExceptionSummary = {
  counts: {
    openCount: 0,
    criticalCount: 0,
    silencedCount: 0,
    breachedCount: 0,
    dueSoonCount: 0,
    unassignedCount: 0,
    pendingTriageCount: 0,
  },
};

const emptyAutomationSummary: AutomationSummary = {
  counts: {
    enabledRules: 0,
    failedRuns24h: 0,
    dueRules: 0,
  },
};

export default async function OperacaoPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao");

  const [commandCenter, exceptionSummary, automationSummary, telemetry] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptyExceptionSummary),
    safeApiJson<AutomationSummary>("/automations/summary", emptyAutomationSummary),
    readUnitHostTelemetry({ timeoutMs: 1_200, fast: true }),
  ]);

  const pressure = operationPressure(commandCenter, telemetry);
  const sourceFailures = telemetry.sources.filter((item) => !item.ok).length;

  const priorityRoutes = [
    {
      href: "/operacao/fila?view=pending",
      title: "Triagem",
      description: "Itens novos ou sem leitura inicial definida.",
      badge: <TonePill tone={exceptionSummary.counts.pendingTriageCount ? "info" : "neutral"}>{exceptionSummary.counts.pendingTriageCount}</TonePill>,
    },
    {
      href: "/operacao/fila?view=breached",
      title: "SLA estourado",
      description: "Casos vencidos ou em condição de resposta imediata.",
      badge: <TonePill tone={exceptionSummary.counts.breachedCount ? "critical" : "neutral"}>{exceptionSummary.counts.breachedCount}</TonePill>,
    },
    {
      href: "/operacao/fila?view=dueSoon",
      title: "Vencendo",
      description: "Casos com risco de vencimento.",
      badge: <TonePill tone={exceptionSummary.counts.dueSoonCount ? "attention" : "neutral"}>{exceptionSummary.counts.dueSoonCount}</TonePill>,
    },
    {
      href: "/operacao/fila?view=unassigned",
      title: "Sem dono",
      description: "Backlog aberto sem responsável claro ou despacho concluído.",
      badge: <TonePill tone={exceptionSummary.counts.unassignedCount ? "attention" : "neutral"}>{exceptionSummary.counts.unassignedCount}</TonePill>,
    },
  ];


  const nextActions = [
    {
      href: exceptionSummary.counts.breachedCount > 0 ? "/operacao/fila?view=breached" : "/operacao/fila?view=pending",
      title: exceptionSummary.counts.breachedCount > 0 ? "Despachar SLA estourado" : "Abrir triagem do turno",
      description: exceptionSummary.counts.breachedCount > 0
        ? "Comece pelos casos vencidos antes de abrir novas frentes."
        : "Reconheça, atribua dono e tire os itens pendentes da fila.",
      badge: (
        <TonePill tone={exceptionSummary.counts.breachedCount > 0 ? "critical" : exceptionSummary.counts.pendingTriageCount > 0 ? "attention" : "success"}>
          {exceptionSummary.counts.breachedCount > 0 ? `${exceptionSummary.counts.breachedCount} vencido(s)` : `${exceptionSummary.counts.pendingTriageCount} triagem`}
        </TonePill>
      ),
    },
    {
      href: telemetry.counts.down > 0 || telemetry.counts.degraded > 0 ? "/monitoramento/sensores" : "/operacao/reconciliacao",
      title: telemetry.counts.down > 0 || telemetry.counts.degraded > 0 ? "Validar risco NOC" : "Revisar vínculo técnico",
      description: telemetry.counts.down > 0 || telemetry.counts.degraded > 0
        ? "Confirme hosts offline, degradados e impacto antes do despacho."
        : "Sem host crítico agora; priorize vínculos e base pronta para execução.",
      badge: (
        <TonePill tone={telemetry.counts.down > 0 ? "critical" : telemetry.counts.degraded > 0 ? "attention" : telemetry.counts.unmapped > 0 ? "neutral" : "success"}>
          {telemetry.counts.down > 0 ? `${telemetry.counts.down} offline` : telemetry.counts.degraded > 0 ? `${telemetry.counts.degraded} atenção` : `${telemetry.counts.unmapped} sem vínculo`}
        </TonePill>
      ),
    },
    {
      href: sourceFailures > 0 || automationSummary.counts.failedRuns24h > 0 ? "/operacao/automacoes" : "/operacao/atividade",
      title: sourceFailures > 0 || automationSummary.counts.failedRuns24h > 0 ? "Corrigir automação/fonte" : "Conferir rastro do turno",
      description: sourceFailures > 0 || automationSummary.counts.failedRuns24h > 0
        ? "Trate falhas de fonte ou execução antes de confiar no próximo ciclo."
        : "Use a atividade para fechar contexto, decisões e histórico recente.",
      badge: (
        <TonePill tone={sourceFailures > 0 || automationSummary.counts.failedRuns24h > 0 ? "attention" : "neutral"}>
          {sourceFailures > 0 ? `${sourceFailures} fonte(s)` : automationSummary.counts.failedRuns24h > 0 ? `${automationSummary.counts.failedRuns24h} falha(s)` : "histórico"}
        </TonePill>
      ),
    },
    {
      href: exceptionSummary.counts.openCount > 0 ? "/operacao/excecoes" : "/operacao/relatorio-turno",
      title: exceptionSummary.counts.openCount > 0 ? "Fechar exceções abertas" : "Preparar relatório do turno",
      description: exceptionSummary.counts.openCount > 0
        ? "Resolva backlog qualificado antes de encerrar o ciclo operacional."
        : "Com baixa pressão, avance para registro executivo e handoff.",
      badge: (
        <TonePill tone={exceptionSummary.counts.openCount > 0 ? "attention" : "info"}>
          {exceptionSummary.counts.openCount > 0 ? `${exceptionSummary.counts.openCount} aberto(s)` : "relatório"}
        </TonePill>
      ),
    },
  ];

  return (
    <NovaLitShell activeHref="/operacao">
      <div className="nova-operation-lit-page"><section className="nova-operation-top-stack grid gap-2"><Surface className="nova-operation-overview-card"><SectionIntro
            eyebrow="Operação"
            title="Cockpit do turno operacional"
            description="Visão consolidada para priorizar fila, SLA, hosts em risco, automações e próximos passos sem sair do workspace."
            actions={
              <div className="nova-operation-hero-actions flex flex-wrap gap-2"><Link href="/operacao/fila?view=pending" className="nds-button" data-variant="primary">
                  Abrir fila do turno
                </Link><Link href="/monitoramento/sensores" className="nds-button" data-variant="secondary">
                  Ver sensores
                </Link></div>
            }
          /><div className="nova-operation-priority-row mt-2 flex flex-wrap gap-2"><FilterChip href="/operacao/fila?view=pending" active label="Triagem" count={exceptionSummary.counts.pendingTriageCount} /><FilterChip href="/operacao/fila?view=breached" label="SLA estourado" count={exceptionSummary.counts.breachedCount} /><FilterChip href="/operacao/fila?view=dueSoon" label="Vencendo" count={exceptionSummary.counts.dueSoonCount} /><FilterChip href="/operacao/fila?view=unassigned" label="Sem dono" count={exceptionSummary.counts.unassignedCount} /></div><div className="nova-operation-kpi-grid mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><KpiTile href="/operacao/fila" label="Fila aberta" value={exceptionSummary.counts.openCount} meta={`${exceptionSummary.counts.pendingTriageCount} pendentes de triagem`} tone="info" /><KpiTile href="/operacao/fila?view=breached" label="SLA estourado" value={exceptionSummary.counts.breachedCount} meta={`${exceptionSummary.counts.dueSoonCount} vencendo em breve`} tone={exceptionSummary.counts.breachedCount > 0 ? "critical" : "neutral"} /><KpiTile href="/operacao/fila?view=unassigned" label="Sem responsável" value={exceptionSummary.counts.unassignedCount} meta={`${exceptionSummary.counts.silencedCount} silenciadas`} tone={exceptionSummary.counts.unassignedCount > 0 ? "attention" : "neutral"} /><KpiTile href="/monitoramento/sensores?health=down" label="Hosts offline" value={telemetry.counts.down} meta={`${telemetry.counts.degraded} em atenção`} tone={telemetry.counts.down > 0 ? "critical" : telemetry.counts.degraded > 0 ? "attention" : "neutral"} /></div><div className="nova-operation-signal-grid mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-6"><InlineStat label="Alertas abertos" value={commandCenter.metrics.openOccurrences} tone={commandCenter.metrics.openOccurrences > 0 ? "info" : "neutral"} /><InlineStat label="Críticas abertas" value={commandCenter.metrics.criticalOpenOccurrences} tone={commandCenter.metrics.criticalOpenOccurrences > 0 ? "critical" : "neutral"} /><InlineStat label="Chamados vencidos" value={commandCenter.metrics.overdueMaintenances} tone={commandCenter.metrics.overdueMaintenances > 0 ? "attention" : "neutral"} /><InlineStat label="Regras vencendo" value={automationSummary.counts.dueRules} tone={automationSummary.counts.dueRules > 0 ? "attention" : "neutral"} /><InlineStat label="Fonte com falha" value={sourceFailures} tone={sourceFailures > 0 ? "attention" : "neutral"} /><InlineStat label="Pressão do turno" value={pressure} tone={pressure > 0 ? "attention" : "neutral"} /></div></Surface><Surface><SectionIntro
            eyebrow="Prioridades"
            title="Prioridades que mudam o turno agora"
            description="Acesse os recortes que mais alteram prioridade, dono e prazo de resposta."
            compact
          /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {priorityRoutes.map((item) => (
              <ActionTile
                key={item.href}
                href={item.href}
                title={item.title}
                description={item.description}
                badge={item.badge}
              />
            ))}
          </div></Surface><div className="nova-side-grid nova-side-grid--380"><UnitWatchlistPanel
            telemetry={telemetry}
            title="Unidades com impacto real no turno"
            description="Mostra só hosts offline, em atenção, sem vínculo ou com métrica fora do limite."
            limit={5}
            onlyActionable
          /><Surface><SectionIntro
              eyebrow="Próxima ação"
              title="O que fazer agora"
              description="Ações priorizadas pelo estado atual da fila, NOC, automações e exceções."
              compact
            /><div className="mt-2 grid gap-2">
              {nextActions.map((item) => (
                <ActionTile
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                />
              ))}
            </div></Surface></div><section className="grid gap-2 xl:grid-cols-2"><RecentOccurrencesPanel
            commandCenter={commandCenter}
            title="Alertas que ainda pesam no turno"
            description="Eventos recentes para cruzar com triagem, SLA e estado dos hosts."
          /><RecentMaintenancesPanel
            commandCenter={commandCenter}
            title="Chamados ligados ao turno"
            description="Ações abertas, vencidas ou concluídas há pouco, ainda relevantes para o contexto."
          /></section><Surface className="nova-operation-support-card"><SectionIntro eyebrow="Apoio técnico" title="Sinais de bastidor" description="Indicadores secundários: use quando a próxima ação pedir conferência técnica." compact /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><InlineStat label="Automações ativas" value={automationSummary.counts.enabledRules} tone="neutral" /><InlineStat label="Falhas automação 24h" value={automationSummary.counts.failedRuns24h} tone={automationSummary.counts.failedRuns24h > 0 ? "attention" : "success"} /><InlineStat label="Hosts sem vínculo" value={telemetry.counts.unmapped} tone={telemetry.counts.unmapped > 0 ? "attention" : "neutral"} /><InlineStat label="Prontos para sync" value={telemetry.counts.syncReady} tone={telemetry.counts.syncReady > 0 ? "success" : "neutral"} /></div></Surface></section>      </div>
    </NovaLitShell>
  );
}
