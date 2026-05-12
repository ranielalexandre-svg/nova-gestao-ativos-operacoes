import Link from "next/link";
import type { CSSProperties } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import type {
  CommandCenter,
  UnitHostTelemetry,
} from "@/lib/noc-overview";

type Tone = "green" | "orange" | "blue" | "red" | "muted";

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

type Props = {
  userName: string;
  commandCenter: CommandCenter;
  exceptionSummary: ExceptionSummary;
  telemetryCounts: UnitHostTelemetry["counts"];
  pressure: number;
  coveragePct: number;
};

const quickLinks = [
  { href: "/unidades", label: "Abrir unidades", meta: "cadastro e operação" },
  { href: "/monitoramento/sensores", label: "Ver sensores", meta: "telemetria e vínculos" },
  { href: "/alertas", label: "Fila de alertas", meta: "eventos e ocorrências" },
  { href: "/relatorios/monitoramento", label: "Gerar relatório", meta: "monitoramento NOVA" },
];

const tableColumns = ["Caso", "Alvo", "Severidade", "Status", "Criado", "Responsável"];

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function pressureLabel(score: number) {
  if (score === 0) return "Normal";
  if (score <= 4) return "Baixa";
  if (score <= 10) return "Média";
  if (score <= 20) return "Alta";
  return "Crítica";
}

function pressureTone(score: number): Tone {
  if (score === 0) return "green";
  if (score <= 4) return "green";
  if (score <= 10) return "orange";
  return "red";
}

function formatLatency(ms: number | null) {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms)} ms`;
}

function formatLoss(pct: number | null) {
  if (pct === null || pct === undefined) return "—";
  return `${pct.toFixed(1)}%`;
}

function severityTone(sev: string): Tone {
  if (sev === "critical") return "red";
  if (sev === "high") return "orange";
  if (sev === "medium") return "blue";
  return "muted";
}

function severityLabel(sev: string) {
  if (sev === "critical") return "Crítico";
  if (sev === "high") return "Alto";
  if (sev === "medium") return "Médio";
  if (sev === "low") return "Baixo";
  return sev;
}

function statusLabel(status: string) {
  if (status === "open") return "Aberto";
  if (status === "investigating") return "Em análise";
  if (status === "resolved") return "Resolvido";
  if (status === "closed") return "Fechado";
  return status;
}

function formatRelative(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function Dot({ tone }: { tone: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function LineIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {path.split("M").filter(Boolean).map((segment) => (
        <path key={segment} d={`M${segment}`} />
      ))}
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  icon: string;
}) {
  return (
    <article className="nova-lit-card nova-lit-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <div className="nova-lit-kpi-body">
        <strong>{value}</strong>
        <span className="nova-lit-kpi-icon">
          <LineIcon path={icon} />
        </span>
      </div>
      <p>{hint}</p>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="nova-lit-empty-state">
      <div className="nova-lit-empty-mark">N</div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export default function NovaDashboardView({
  userName,
  commandCenter,
  exceptionSummary,
  telemetryCounts,
  pressure,
  coveragePct,
}: Props) {
  const { metrics, recentOccurrences, recentMaintenances, buckets } = commandCenter;
  const { counts: exc } = exceptionSummary;

  // KPIs dinâmicos conectados à API
  const kpis: Array<{ label: string; value: string; hint: string; tone: Tone; icon: string }> = [
    {
      label: "Unidades online",
      value: telemetryCounts.matched > 0
        ? `${telemetryCounts.online}/${telemetryCounts.matched}`
        : "—",
      hint: telemetryCounts.matched > 0
        ? `cobertura ${coveragePct}%`
        : "aguardando telemetria",
      tone: coveragePct >= 90 ? "green" : coveragePct >= 70 ? "orange" : "red",
      icon: "M4 20V8l8-4 8 4v12M9 20v-7h6v7",
    },
    {
      label: "Críticas",
      value: String(metrics.criticalOpenOccurrences),
      hint: metrics.criticalOpenOccurrences > 0 ? "ação imediata necessária" : "sem alertas críticos",
      tone: metrics.criticalOpenOccurrences > 0 ? "red" : "green",
      icon: "M12 3l9 16H3L12 3Z",
    },
    {
      label: "Chamados vencidos",
      value: String(metrics.overdueMaintenances),
      hint: metrics.overdueMaintenances > 0 ? "fora do prazo" : "todos no prazo",
      tone: metrics.overdueMaintenances > 0 ? "orange" : "green",
      icon: "M5 7h14M5 12h14M5 17h10",
    },
    {
      label: "Pressão operacional",
      value: pressureLabel(pressure),
      hint: `índice ${pressure} · ${exc.openCount} exceções abertas`,
      tone: pressureTone(pressure),
      icon: "M4 12h4l2-7 4 14 2-7h4",
    },
  ];

  // Buckets para barra de severidades
  const severityBuckets = buckets.occurrenceBySeverity;
  const bySev = (key: string) => severityBuckets.find((b) => b.key === key)?.count ?? 0;
  const critCount = bySev("critical");
  const highCount = bySev("high");
  const medCount = bySev("medium");
  const resolvedBucket = buckets.occurrenceByStatus.find((b) => b.key === "resolved")?.count ?? 0;

  // Status Strip
  const backlogCount = exc.pendingTriageCount;
  const nocCount = exc.openCount - exc.unassignedCount;
  const fieldCount = recentMaintenances.filter(
    (m) => m.status === "in_progress"
  ).length;

  return (
    <NovaLitShell activeHref="/dashboard">
      <div className="nova-lit-page-heading">
        <div>
          <div className="nova-lit-breadcrumb">
            <span>Nova</span>
            <b>/ Visão geral</b>
          </div>
          <h1>
            {userName ? `${greetingWord()}, ${firstName(userName)}` : "Visão geral"}
          </h1>
          <p className="nova-lit-page-subtitle">
            {metrics.openOccurrences > 0
              ? `${metrics.openOccurrences} alertas abertos · ${metrics.overdueMaintenances} chamados vencidos · SLA: ${coveragePct}% cobertura`
              : "Resumo executivo da operação, alertas, chamados e cobertura monitorada."}
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/alertas" className="nova-lit-button nova-lit-button-secondary">
            Atualizar fila
          </Link>
          <Link href="/relatorios/monitoramento" className="nova-lit-button nova-lit-button-primary">
            Gerar relatório
          </Link>
        </div>
      </div>

      <section className="nova-lit-kpi-grid" aria-label="Indicadores principais">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="nova-lit-dashboard-grid">
        <div className="nova-lit-dashboard-left">
          <section className="nova-lit-card nova-lit-command-card">
            <div className="nova-lit-action-row">
              <div>
                <span>Operação em tempo real</span>
                <h2>Fila operacional</h2>
              </div>
              <Link href="/operacao/fila">Abrir fila completa</Link>
            </div>

            <div className="nova-lit-filter-row" aria-label="Filtros da fila operacional">
              <button type="button" className="is-active">Todos</button>
              <button type="button"><Dot tone="red" />Críticos {critCount > 0 ? `(${critCount})` : ""}</button>
              <button type="button"><Dot tone="orange" />Atenção {highCount > 0 ? `(${highCount})` : ""}</button>
              <button type="button"><Dot tone="blue" />Em análise {medCount > 0 ? `(${medCount})` : ""}</button>
              <button type="button"><Dot tone="green" />Resolvidos {resolvedBucket > 0 ? `(${resolvedBucket})` : ""}</button>
              <label>
                <span>Buscar</span>
                <input placeholder="Buscar alerta, unidade ou ativo..." />
              </label>
            </div>

            <div className="nova-lit-table">
              <div className="nova-lit-table-head">
                {tableColumns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              {recentOccurrences.length > 0 ? (
                <div className="nova-lit-table-body">
                  {recentOccurrences.slice(0, 8).map((occ) => (
                    <Link
                      key={occ.id}
                      href={`/alertas/${occ.id}`}
                      className="nova-lit-table-row"
                    >
                      <span className="nova-lit-table-code">{occ.code}</span>
                      <span>
                        {occ.unit?.name ?? occ.equipment?.tag ?? occ.partner?.name ?? "—"}
                      </span>
                      <span>
                        <span className={`nova-lit-pill nova-lit-pill-${severityTone(occ.severity)}`}>
                          {severityLabel(occ.severity)}
                        </span>
                      </span>
                      <span>
                        <span className="nova-lit-pill nova-lit-pill-muted">
                          {statusLabel(occ.status)}
                        </span>
                      </span>
                      <span>{formatRelative(occ.createdAt)}</span>
                      <span>—</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="nova-lit-table-empty">
                  <EmptyState
                    title="Nenhum alerta recente"
                    description="Quando houver eventos da rede, eles aparecerão nesta fila."
                  />
                </div>
              )}
            </div>
          </section>

          <section className="nova-lit-row-3">
            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Saúde da rede</h2>
                <span
                  className={`nova-lit-pill nova-lit-pill-${
                    coveragePct >= 90 ? "green" : coveragePct >= 70 ? "orange" : "red"
                  }`}
                >
                  {telemetryCounts.matched > 0 ? `${coveragePct}%` : "—"}
                </span>
              </div>
              <p>
                {telemetryCounts.avgLatencyMs !== null
                  ? `latência ${formatLatency(telemetryCounts.avgLatencyMs)} · perda ${formatLoss(telemetryCounts.avgLossPct)}`
                  : "perda, latência e disponibilidade consolidada"}
              </p>
              <div className="nova-lit-mini-chart">
                <span style={{ height: `${Math.min(100, (telemetryCounts.online / Math.max(1, telemetryCounts.matched)) * 100)}%` }} />
                <span style={{ height: `${Math.min(100, (telemetryCounts.degraded / Math.max(1, telemetryCounts.matched)) * 100)}%` }} />
                <span style={{ height: `${Math.min(100, (telemetryCounts.down / Math.max(1, telemetryCounts.matched)) * 100)}%` }} />
                <span />
                <span />
                <span />
              </div>
            </article>

            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Backlog</h2>
                <span
                  className={`nova-lit-pill nova-lit-pill-${exc.openCount > 0 ? "orange" : "green"}`}
                >
                  {exc.openCount}
                </span>
              </div>
              <p>alertas abertos por severidade</p>
              <div className="nova-lit-status-strip">
                <div>
                  <span><Dot tone="orange" />Backlog</span>
                  <strong>{backlogCount}</strong>
                </div>
                <div>
                  <span><Dot tone="blue" />NOC</span>
                  <strong>{Math.max(0, nocCount)}</strong>
                </div>
                <div>
                  <span><Dot tone="green" />Campo</span>
                  <strong>{fieldCount}</strong>
                </div>
              </div>
            </article>

            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Chamados</h2>
                <span
                  className={`nova-lit-pill nova-lit-pill-${metrics.overdueMaintenances > 0 ? "red" : "blue"}`}
                >
                  {recentMaintenances.length > 0
                    ? `${recentMaintenances.filter((m) => m.status !== "done" && m.status !== "cancelled").length} ativos`
                    : "0 hoje"}
                </span>
              </div>
              <p>status dos chamados técnicos</p>
              {recentMaintenances.length > 0 ? (
                <div className="nova-lit-maintenance-list">
                  {recentMaintenances.slice(0, 3).map((m) => (
                    <Link key={m.id} href={`/chamados/${m.id}`} className="nova-lit-maintenance-item">
                      <strong>{m.code}</strong>
                      <span>{m.title}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem chamados recentes"
                  description="Nenhum chamado cadastrado para o turno."
                />
              )}
            </article>
          </section>

          <section className="nova-lit-card nova-lit-events-card">
            <div className="nova-lit-action-row">
              <div>
                <span>Eventos recentes</span>
                <h2>Linha do turno</h2>
              </div>
              <Link href="/alertas">Ver todos</Link>
            </div>

            <div className="nova-lit-events-grid">
              {[
                { key: "critical", label: "Crítico", tone: "nova-lit-event-1" },
                { key: "high",     label: "Atenção",  tone: "nova-lit-event-2" },
                { key: "medium",   label: "Em análise", tone: "nova-lit-event-3" },
                { key: "resolved", label: "Resolvido", tone: "nova-lit-event-4" },
              ].map(({ key, label, tone }) => {
                const count =
                  key === "resolved"
                    ? resolvedBucket
                    : severityBuckets.find((b) => b.key === key)?.count ?? 0;
                const recent = recentOccurrences.find(
                  (o) => key === "resolved" ? o.status === "resolved" : o.severity === key
                );
                return (
                  <article key={key} className={`nova-lit-event-card ${tone}`}>
                    <small>{label}</small>
                    <strong>{count > 0 ? `${count} registro${count > 1 ? "s" : ""}` : "Sem registros"}</strong>
                    <span>
                      {recent
                        ? `${recent.code} · ${recent.unit?.name ?? recent.equipment?.tag ?? "—"}`
                        : "Nenhum registro ativo."}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="nova-lit-dashboard-right">
          <section className="nova-lit-card nova-lit-shortcuts">
            <h2>Atalhos</h2>
            <p>Ações principais do turno.</p>
            {quickLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                <span>{item.meta}</span>
              </Link>
            ))}
          </section>

          <section className="nova-lit-card nova-lit-severity-card">
            <div className="nova-lit-title-row">
              <h2>Severidades</h2>
              <span
                className={`nova-lit-pill nova-lit-pill-${metrics.openOccurrences > 0 ? "orange" : "green"}`}
              >
                {metrics.openOccurrences} ativa{metrics.openOccurrences !== 1 ? "s" : ""}
              </span>
            </div>
            <div
              className="nova-lit-severity-bars"
              style={{
                "--bar-critical": `${Math.min(100, (critCount / Math.max(1, metrics.openOccurrences)) * 100)}%`,
                "--bar-high": `${Math.min(100, (highCount / Math.max(1, metrics.openOccurrences)) * 100)}%`,
                "--bar-medium": `${Math.min(100, (medCount / Math.max(1, metrics.openOccurrences)) * 100)}%`,
                "--bar-low": `${Math.min(100, (resolvedBucket / Math.max(1, metrics.openOccurrences)) * 100)}%`,
              } as CSSProperties}
            >
              <span data-tone="red"   style={{ width: `${Math.min(100, (critCount   / Math.max(1, metrics.openOccurrences)) * 100)}%` }} />
              <span data-tone="orange" style={{ width: `${Math.min(100, (highCount   / Math.max(1, metrics.openOccurrences)) * 100)}%` }} />
              <span data-tone="blue"  style={{ width: `${Math.min(100, (medCount    / Math.max(1, metrics.openOccurrences)) * 100)}%` }} />
              <span data-tone="green" style={{ width: `${Math.min(100, (resolvedBucket / Math.max(1, metrics.openOccurrences)) * 100)}%` }} />
            </div>
            <ul>
              <li><Dot tone="red"    />Críticos    <b>{critCount}</b></li>
              <li><Dot tone="orange" />Alto        <b>{highCount}</b></li>
              <li><Dot tone="blue"   />Em análise  <b>{medCount}</b></li>
              <li><Dot tone="green"  />Resolvidos  <b>{resolvedBucket}</b></li>
            </ul>
          </section>

          <section className="nova-lit-card nova-lit-coverage-card">
            <h2>Cobertura monitorada</h2>
            <div className="nova-lit-ring">
              <strong>{telemetryCounts.matched > 0 ? `${coveragePct}%` : "—"}</strong>
              <span>online</span>
            </div>
            <p>
              {telemetryCounts.matched > 0
                ? `${telemetryCounts.online} online · ${telemetryCounts.degraded} degradadas · ${telemetryCounts.down} offline de ${telemetryCounts.matched} monitoradas`
                : "Sem telemetria carregada para calcular disponibilidade."}
            </p>
          </section>

          {exc.breachedCount > 0 || exc.dueSoonCount > 0 ? (
            <section className="nova-lit-card">
              <div className="nova-lit-title-row">
                <h2>SLA</h2>
                <span className="nova-lit-pill nova-lit-pill-red">
                  {exc.breachedCount} violado{exc.breachedCount !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="nova-lit-sla-list">
                {exc.breachedCount > 0 && (
                  <li>
                    <Dot tone="red" /> {exc.breachedCount} exceção{exc.breachedCount > 1 ? "ões" : ""} com SLA violado
                  </li>
                )}
                {exc.dueSoonCount > 0 && (
                  <li>
                    <Dot tone="orange" /> {exc.dueSoonCount} vencendo em breve
                  </li>
                )}
                {exc.unassignedCount > 0 && (
                  <li>
                    <Dot tone="muted" /> {exc.unassignedCount} sem responsável
                  </li>
                )}
              </ul>
              <Link href="/operacao/fila?view=breached" className="nova-lit-button nova-lit-button-secondary nova-lit-sla-button">
                Ver fila SLA
              </Link>
            </section>
          ) : null}
        </aside>
      </section>
    </NovaLitShell>
  );
}
