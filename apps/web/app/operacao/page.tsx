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
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
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

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";
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

  const executionAreas = [
    {
      href: "/operacao/fila",
      title: "Fila",
      description: "Workbench principal com filtros persistidos, SLA e ação em lote.",
      badge: <TonePill tone="info">core</TonePill>,
    },
    {
      href: "/excecoes",
      title: "Exceções",
      description: "Backlog qualificado e abertura manual de casos especiais.",
      badge: (
        <TonePill tone={exceptionSummary.counts.openCount ? "attention" : "success"}>
          {exceptionSummary.counts.openCount} aberto(s)
        </TonePill>
      ),
    },
    {
      href: "/operacao/atividade",
      title: "Atividade",
      description: "Rastro do sistema, das automações e dos operadores.",
      badge: <TonePill tone="neutral">histórico</TonePill>,
    },
    {
      href: "/automacao",
      title: "Automações",
      description: "Saúde das execuções, falhas e recovery das regras recorrentes.",
      badge: (
        <TonePill tone={automationSummary.counts.failedRuns24h ? "attention" : "success"}>
          {automationSummary.counts.failedRuns24h ? `${automationSummary.counts.failedRuns24h} falha(s)` : "ok"}
        </TonePill>
      ),
    },
    ...(isAdmin
      ? [{
          href: "/operacao/sla",
          title: "Políticas SLA",
          description: "Cadastro e revisão administrativa de prazo e roteamento.",
          badge: <TonePill tone="neutral">admin</TonePill>,
        }]
      : []),
  ];

  return (
    <NovaLitShell activeHref="/operacao">
      <div className="nova-operation-lit-page"><section className="grid gap-2"><Surface><SectionIntro
            eyebrow="Operação"
            title="Triagem, backlog e resposta imediata"
            description="SLA, responsável, risco de host e atalhos operacionais."
            actions={
              <div className="flex flex-wrap gap-2"><Link href="/operacao/fila?view=pending" className="nds-button" data-variant="primary">
                  Abrir triagem
                </Link><Link href="/sensores" className="nds-button" data-variant="secondary">
                  Monitoramento
                </Link></div>
            }
          /><div className="mt-2 flex flex-wrap gap-2"><FilterChip href="/operacao/fila?view=pending" active label="Triagem" count={exceptionSummary.counts.pendingTriageCount} /><FilterChip href="/operacao/fila?view=breached" label="SLA estourado" count={exceptionSummary.counts.breachedCount} /><FilterChip href="/operacao/fila?view=dueSoon" label="Vencendo" count={exceptionSummary.counts.dueSoonCount} /><FilterChip href="/operacao/fila?view=unassigned" label="Sem dono" count={exceptionSummary.counts.unassignedCount} /></div><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><KpiTile href="/operacao/fila" label="Fila aberta" value={exceptionSummary.counts.openCount} meta={`${exceptionSummary.counts.pendingTriageCount} pendentes de triagem`} tone="info" /><KpiTile href="/operacao/fila?view=breached" label="SLA estourado" value={exceptionSummary.counts.breachedCount} meta={`${exceptionSummary.counts.dueSoonCount} vencendo em breve`} tone={exceptionSummary.counts.breachedCount > 0 ? "critical" : "neutral"} /><KpiTile href="/operacao/fila?view=unassigned" label="Sem responsável" value={exceptionSummary.counts.unassignedCount} meta={`${exceptionSummary.counts.silencedCount} silenciadas`} tone={exceptionSummary.counts.unassignedCount > 0 ? "attention" : "neutral"} /><KpiTile href="/sensores?health=down" label="Hosts offline" value={telemetry.counts.down} meta={`${telemetry.counts.degraded} em atenção`} tone={telemetry.counts.down > 0 ? "critical" : telemetry.counts.degraded > 0 ? "attention" : "neutral"} /></div><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-6"><InlineStat label="Alertas abertos" value={commandCenter.metrics.openOccurrences} tone={commandCenter.metrics.openOccurrences > 0 ? "info" : "neutral"} /><InlineStat label="Críticas abertas" value={commandCenter.metrics.criticalOpenOccurrences} tone={commandCenter.metrics.criticalOpenOccurrences > 0 ? "critical" : "neutral"} /><InlineStat label="Chamados vencidos" value={commandCenter.metrics.overdueMaintenances} tone={commandCenter.metrics.overdueMaintenances > 0 ? "attention" : "neutral"} /><InlineStat label="Regras vencendo" value={automationSummary.counts.dueRules} tone={automationSummary.counts.dueRules > 0 ? "attention" : "neutral"} /><InlineStat label="Fonte com falha" value={sourceFailures} tone={sourceFailures > 0 ? "attention" : "neutral"} /><InlineStat label="Pressão do turno" value={pressure} tone={pressure > 0 ? "attention" : "neutral"} /></div></Surface><Surface><SectionIntro
            eyebrow="Prioridades"
            title="O que muda a resposta agora"
            description="Essas quatro rotas concentram o backlog que mais rapidamente altera a operação."
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
            title="Unidades que já interferem na resposta do turno"
            description="Se o host caiu, degradou ou perdeu vínculo, a fila e a ação com parceiro tendem a mudar."
            limit={8}
          /><Surface><SectionIntro
              eyebrow="Execução"
              title="Áreas de trabalho"
              description="Os destinos operacionais aparecem como blocos de ação, não como uma lista neutra."
              compact
            /><div className="mt-2 grid gap-2">
              {executionAreas.map((item) => (
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
          /></section><Surface><SectionIntro eyebrow="Fluxo" title="Execução" description="Destinos operacionais." compact /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><InlineStat label="Automações ativas" value={automationSummary.counts.enabledRules} tone="neutral" /><InlineStat label="Falhas em 24h" value={automationSummary.counts.failedRuns24h} tone={automationSummary.counts.failedRuns24h > 0 ? "attention" : "success"} /><InlineStat label="Hosts sem vínculo" value={telemetry.counts.unmapped} tone={telemetry.counts.unmapped > 0 ? "attention" : "neutral"} /><InlineStat label="Hosts prontos para sync" value={telemetry.counts.syncReady} tone={telemetry.counts.syncReady > 0 ? "success" : "neutral"} /></div></Surface></section>      </div>
    </NovaLitShell>
  );
}
