import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { formatDateTime } from "@/lib/formatters";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "neutral" | "info" | "success" | "attention" | "critical";

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

type ExceptionRow = {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  queueKey: string;
  triageStatus: string;
  priorityScore: number;
  resolveDueAt: string | null;
  breachedAt: string | null;
  updatedAt: string;
  assignee: { id: string; name: string; email: string; role: string } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  _count: { comments: number; activities: number };
};

type OperationalReconciliation = {
  sourceAvailable: boolean;
  message?: string | null;
  generatedAt?: string | null;
  counts: {
    importedUnits: number;
    currentUnits: number;
    matchedUnits: number;
    weakUnitMatches: number;
    unmatchedImportedUnits: number;
    unmatchedCurrentUnits: number;
    importedPartners: number;
    currentPartners: number;
    matchedPartners: number;
    importedEquipments: number;
    currentEquipments: number;
    matchedEquipments: number;
    starlinks: number;
  };
};

type ActionCard = {
  title: string;
  description: string;
  value: number;
  tone: Tone;
  href: string;
  action: string;
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

const emptyExceptionPage: PaginatedResponse<ExceptionRow> = {
  items: [],
  meta: {
    page: 1,
    pageSize: 0,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  },
};

const emptyReconciliation: OperationalReconciliation = {
  sourceAvailable: false,
  generatedAt: null,
  counts: {
    importedUnits: 0,
    currentUnits: 0,
    matchedUnits: 0,
    weakUnitMatches: 0,
    unmatchedImportedUnits: 0,
    unmatchedCurrentUnits: 0,
    importedPartners: 0,
    currentPartners: 0,
    matchedPartners: 0,
    importedEquipments: 0,
    currentEquipments: 0,
    matchedEquipments: 0,
    starlinks: 0,
  },
};

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR");
}

function plural(value: number, singular: string, pluralLabel: string) {
  return value === 1 ? singular : pluralLabel;
}

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-pendencias-pill ${toneClass(tone)}`}>{children}</span>;
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-pendencias-kpi ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function actionTone(value: number, important = false): Tone {
  if (!value) return "success";
  return important ? "critical" : "attention";
}

function sourceLabel(item: ExceptionRow) {
  if (item.integration) return `Integração ${item.integration.code}`;
  if (item.occurrence) return `Alerta ${item.occurrence.code}`;
  if (item.maintenance) return `Chamado ${item.maintenance.code}`;
  if (item.unit) return `Unidade ${item.unit.code}`;
  if (item.partner) return `Parceiro ${item.partner.code}`;
  return "Sem vínculo";
}

function severityTone(value: string): Tone {
  if (["critical", "high"].includes(value)) return "critical";
  if (["medium", "warning"].includes(value)) return "attention";
  if (["low", "info"].includes(value)) return "info";
  return "neutral";
}

function queueLabel(value: string) {
  if (value === "noc") return "NOC";
  if (value === "field") return "Campo";
  if (value === "billing") return "Financeiro";
  if (value === "support") return "Suporte";
  if (value === "ops") return "Operação";
  return value || "Fila";
}

function dueLabel(item: ExceptionRow) {
  if (item.breachedAt) return "SLA estourado";
  if (!item.resolveDueAt) return "Sem prazo";
  const due = new Date(item.resolveDueAt);
  if (Number.isNaN(due.getTime())) return "Prazo inválido";

  const minutes = Math.round((due.getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "Vencido";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

function pickTopRows(...groups: Array<ExceptionRow[]>) {
  const byId = new Map<string, ExceptionRow>();

  for (const group of groups) {
    for (const item of group) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const breached = Number(Boolean(b.breachedAt)) - Number(Boolean(a.breachedAt));
      if (breached) return breached;
      return b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 10);
}

async function readExceptionQueue(params: Record<string, string | number | undefined>) {
  return safeApiJson<PaginatedResponse<ExceptionRow>>(
    `/exceptions${buildApiQuery(params)}`,
    emptyExceptionPage,
  );
}

export default async function PendenciasOperacionaisPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/pendencias");

  const [
    commandCenter,
    exceptionSummary,
    automationSummary,
    telemetry,
    breachedCases,
    dueSoonCases,
    pendingCases,
    unassignedCases,
    reconciliation,
  ] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptyExceptionSummary),
    safeApiJson<AutomationSummary>("/automations/summary", emptyAutomationSummary),
    readUnitHostTelemetry({ timeoutMs: 1_800, fast: true }),
    readExceptionQueue({ onlyBreached: "true", pageSize: 6, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyDueSoon: "true", pageSize: 6, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ triageStatus: "pending", status: "open", pageSize: 6, sortBy: "priorityScore", sortDir: "desc" }),
    readExceptionQueue({ onlyUnassigned: "true", pageSize: 6, sortBy: "priorityScore", sortDir: "desc" }),
    safeApiJson<OperationalReconciliation>("/operational-data/reconciliation", emptyReconciliation),
  ]);

  const sourceFailures = telemetry.sources.filter((item) => !item.ok);
  const reconciliationPending =
    reconciliation.counts.weakUnitMatches +
    reconciliation.counts.unmatchedImportedUnits +
    reconciliation.counts.unmatchedCurrentUnits;
  const nocPressure =
    telemetry.counts.down * 4 +
    telemetry.counts.degraded * 2 +
    telemetry.counts.withProblems * 2 +
    sourceFailures.length * 3;
  const operationPressure =
    exceptionSummary.counts.breachedCount * 5 +
    exceptionSummary.counts.dueSoonCount * 3 +
    exceptionSummary.counts.pendingTriageCount * 2 +
    exceptionSummary.counts.unassignedCount * 2 +
    automationSummary.counts.failedRuns24h * 4 +
    reconciliationPending * 2 +
    nocPressure +
    commandCenter.metrics.criticalOpenOccurrences * 3 +
    commandCenter.metrics.overdueMaintenances * 2;

  const actionCards: ActionCard[] = [
    {
      title: "SLA estourado",
      description: "Casos vencidos ou já fora da janela operacional.",
      value: exceptionSummary.counts.breachedCount,
      tone: actionTone(exceptionSummary.counts.breachedCount, true),
      href: "/operacao/fila?view=breached",
      action: "Atacar agora",
    },
    {
      title: "Triagem pendente",
      description: "Itens abertos sem decisão de fila, responsável ou próximo passo.",
      value: exceptionSummary.counts.pendingTriageCount,
      tone: actionTone(exceptionSummary.counts.pendingTriageCount),
      href: "/operacao/fila?view=pending",
      action: "Triar fila",
    },
    {
      title: "Vencendo",
      description: "Casos com risco de virar rompimento de SLA no turno.",
      value: exceptionSummary.counts.dueSoonCount,
      tone: actionTone(exceptionSummary.counts.dueSoonCount),
      href: "/operacao/fila?view=dueSoon",
      action: "Repriorizar",
    },
    {
      title: "Sem dono",
      description: "Pendências abertas sem operador ou responsável definido.",
      value: exceptionSummary.counts.unassignedCount,
      tone: actionTone(exceptionSummary.counts.unassignedCount),
      href: "/operacao/fila?view=unassigned",
      action: "Atribuir",
    },
    {
      title: "Falhas de automação",
      description: "Execuções com erro nas últimas 24 horas.",
      value: automationSummary.counts.failedRuns24h,
      tone: actionTone(automationSummary.counts.failedRuns24h, true),
      href: "/operacao/automacoes",
      action: "Revisar regras",
    },
    {
      title: "Host sem vínculo",
      description: "Unidades sem correlação confiável com sensores NOC.",
      value: telemetry.counts.unmapped + telemetry.counts.ambiguous,
      tone: actionTone(telemetry.counts.unmapped + telemetry.counts.ambiguous),
      href: "/monitoramento/sensores?health=unmapped",
      action: "Corrigir vínculo",
    },
  ];

  const rows = pickTopRows(
    breachedCases.items,
    dueSoonCases.items,
    pendingCases.items,
    unassignedCases.items,
  );

  return (
    <NovaLitShell activeHref="/operacao/pendencias">
      <main className="nova-pendencias-page">
        <header className="nova-pendencias-hero">
          <div>
            <span>Operação / Pendências</span>
            <h1>Central de pendências operacionais</h1>
            <p>
              Uma fila executiva para priorizar SLA, triagem, automações, vínculos NOC e reconciliação
              antes da passagem de turno.
            </p>
          </div>
          <div className="nova-pendencias-hero-actions">
            <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-primary">
              Abrir War Room
            </Link>
            <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
              Playbooks
            </Link>
            <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
              Preparar handoff
            </Link>
            <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
              Abrir fila
            </Link>
            <Link href="/operacao/atividade" className="nova-lit-button nova-lit-button-secondary">
              Ver atividade
            </Link>
            <Link href="/operacao/relatorios/monitoramento" className="nova-lit-button nova-lit-button-secondary">
              Relatório NOC
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório do turno
            </Link>
          </div>
        </header>

        <section className="nova-pendencias-kpi-grid" aria-label="Resumo de pendências">
          <Kpi
            label="Pressão operacional"
            value={operationPressure}
            hint="Soma ponderada de SLA, NOC, automações e reconciliação."
            tone={operationPressure > 20 ? "critical" : operationPressure > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Casos abertos"
            value={exceptionSummary.counts.openCount}
            hint={`${formatNumber(exceptionSummary.counts.criticalCount)} crítico(s), ${formatNumber(exceptionSummary.counts.silencedCount)} silenciado(s).`}
            tone={exceptionSummary.counts.criticalCount ? "critical" : exceptionSummary.counts.openCount ? "attention" : "success"}
          />
          <Kpi
            label="NOC em atenção"
            value={telemetry.counts.down + telemetry.counts.degraded + telemetry.counts.withProblems}
            hint={`${formatNumber(sourceFailures.length)} fonte(s) com alerta.`}
            tone={telemetry.counts.down || sourceFailures.length ? "critical" : telemetry.counts.degraded ? "attention" : "success"}
          />
          <Kpi
            label="Reconciliação"
            value={reconciliationPending}
            hint={`${formatNumber(reconciliation.counts.weakUnitMatches)} match fraco, ${formatNumber(reconciliation.counts.unmatchedImportedUnits)} importado(s) sem par.`}
            tone={reconciliationPending ? "attention" : "success"}
          />
        </section>

        <section className="nova-pendencias-action-grid" aria-label="Ações prioritárias">
          {actionCards.map((card) => (
            <Link key={card.title} href={card.href} className={`nova-pendencias-action-card ${toneClass(card.tone)}`}>
              <div>
                <span>{card.title}</span>
                <strong>{formatNumber(card.value)}</strong>
              </div>
              <p>{card.description}</p>
              <b>{card.action}</b>
            </Link>
          ))}
        </section>

        <section className="nova-pendencias-layout">
          <div className="nova-pendencias-main">
            <section className="nova-pendencias-panel">
              <div className="nova-pendencias-panel-head">
                <div>
                  <span>Execução</span>
                  <h2>Fila consolidada do turno</h2>
                  <p>
                    Top {rows.length} caso(s) reunindo SLA estourado, vencendo, triagem pendente e sem dono.
                  </p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Ver fila completa
                </Link>
              </div>

              {rows.length ? (
                <div className="nova-pendencias-list">
                  {rows.map((item) => (
                    <article key={item.id} className="nova-pendencias-row">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>
                          {sourceLabel(item)} · prioridade {item.priorityScore} · {item._count.comments} comentário(s)
                        </small>
                      </div>
                      <div className="nova-pendencias-row-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>
                          {dueLabel(item)}
                        </Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>
                          {item.assignee ? item.assignee.name : "sem dono"}
                        </Pill>
                      </div>
                      <div className="nova-pendencias-row-meta">
                        <span>{queueLabel(item.queueKey)}</span>
                        <small>{formatDateTime(item.updatedAt)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-pendencias-empty">
                  <strong>Nenhuma pendência crítica na fila consolidada.</strong>
                  <p>Continue monitorando a fila operacional e as fontes NOC durante o turno.</p>
                </div>
              )}
            </section>

            <section className="nova-pendencias-panel">
              <div className="nova-pendencias-panel-head">
                <div>
                  <span>Monitoramento</span>
                  <h2>Sinais NOC e fontes</h2>
                  <p>Leituras técnicas que podem gerar pendências de vínculo, disponibilidade ou integração.</p>
                </div>
                <Link href="/monitoramento/sensores" className="nova-lit-button nova-lit-button-secondary">
                  Abrir sensores
                </Link>
              </div>

              <div className="nova-pendencias-signal-grid">
                <div>
                  <span>Offline</span>
                  <strong>{formatNumber(telemetry.counts.down)}</strong>
                  <p>{plural(telemetry.counts.down, "host fora", "hosts fora")}</p>
                </div>
                <div>
                  <span>Degradado</span>
                  <strong>{formatNumber(telemetry.counts.degraded)}</strong>
                  <p>{plural(telemetry.counts.degraded, "host em atenção", "hosts em atenção")}</p>
                </div>
                <div>
                  <span>Sem vínculo</span>
                  <strong>{formatNumber(telemetry.counts.unmapped)}</strong>
                  <p>unidade(s) sem host confiável</p>
                </div>
                <div>
                  <span>Fontes falhando</span>
                  <strong>{formatNumber(sourceFailures.length)}</strong>
                  <p>{sourceFailures[0]?.message || "sem falhas de fonte"}</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="nova-pendencias-side">
            <section className="nova-pendencias-panel">
              <div className="nova-pendencias-panel-head is-compact">
                <div>
                  <span>Handoff</span>
                  <h2>Checklist do operador</h2>
                </div>
              </div>
              <div className="nova-pendencias-checklist">
                <Link href="/operacao/fila?view=breached">
                  <Pill tone={actionTone(exceptionSummary.counts.breachedCount, true)}>
                    {formatNumber(exceptionSummary.counts.breachedCount)}
                  </Pill>
                  <span>Resolver SLA estourado antes do próximo handoff</span>
                </Link>
                <Link href="/operacao/automacoes">
                  <Pill tone={actionTone(automationSummary.counts.failedRuns24h, true)}>
                    {formatNumber(automationSummary.counts.failedRuns24h)}
                  </Pill>
                  <span>Reprocessar ou silenciar automações com erro</span>
                </Link>
                <Link href="/operacao/reconciliacao">
                  <Pill tone={actionTone(reconciliationPending)}>
                    {formatNumber(reconciliationPending)}
                  </Pill>
                  <span>Fechar divergências de reconciliação operacional</span>
                </Link>
                <Link href="/monitoramento/fontes">
                  <Pill tone={actionTone(sourceFailures.length)}>
                    {formatNumber(sourceFailures.length)}
                  </Pill>
                  <span>Validar fontes NOC com falha de leitura</span>
                </Link>
              </div>
            </section>

            <section className="nova-pendencias-panel">
              <div className="nova-pendencias-panel-head is-compact">
                <div>
                  <span>Contexto</span>
                  <h2>Dados usados</h2>
                </div>
              </div>
              <div className="nova-pendencias-context">
                <div>
                  <span>Comando NOC</span>
                  <strong>{formatDateTime(commandCenter.generatedAt)}</strong>
                </div>
                <div>
                  <span>Sensores</span>
                  <strong>{formatDateTime(telemetry.generatedAt)}</strong>
                </div>
                <div>
                  <span>Reconciliação</span>
                  <strong>{formatDateTime(reconciliation.generatedAt || null)}</strong>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
