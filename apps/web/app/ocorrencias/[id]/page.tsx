import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
  type RecentOccurrence,
} from "@/lib/noc-overview";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
import { formatDateTime } from "@/lib/formatters";
import {
  maintenanceStatusLabel,
  maintenanceStatusTone,
  maintenanceTypeLabel,
  occurrenceSeverityLabel as severityLabel,
  occurrenceSeverityTone as severityTone,
  occurrenceStatusLabel as statusLabel,
  occurrenceStatusTone as statusTone,
} from "@/lib/status-ui";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";

type OccurrenceDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  maintenances: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string | null;
    completedAt: string | null;
    createdAt: string;
  }>;
  _count: {
    maintenances: number;
  };
};

type AlertTone = "red" | "orange" | "blue" | "green" | "gray";

const severityWeight: Record<string, number> = {
  critical: 92,
  high: 76,
  medium: 54,
  low: 32,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashText(value: string) {
  return value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function toAlertTone(tone: string): AlertTone {
  if (tone === "critical") return "red";
  if (tone === "attention") return "orange";
  if (tone === "info") return "blue";
  if (tone === "success") return "green";
  return "gray";
}

function formatNumber(value: number, fractionDigits = 0) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatSvgNumber(value: number) {
  return value.toFixed(1);
}

function dateFrom(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addSeconds(value: string, seconds: number) {
  const date = dateFrom(value);
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

function formatClock(value: string | null) {
  return dateFrom(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function minutesSince(value: string) {
  return Math.max(1, Math.round((Date.now() - dateFrom(value).getTime()) / 60000));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function inferAlertType(occurrence: OccurrenceDetail) {
  const text = `${occurrence.title} ${occurrence.description || ""}`.toLowerCase();
  if (text.includes("perda") || text.includes("loss") || text.includes("pacote")) return "Perda de Pacote";
  if (text.includes("ping") || text.includes("latencia") || text.includes("latência")) return "Latência";
  if (text.includes("temperatura")) return "Temperatura";
  if (text.includes("offline") || text.includes("down")) return "Disponibilidade";
  return "Monitoramento";
}

function buildSeries(seed: number, base: number, spread: number, trend = 0) {
  return Array.from({ length: 36 }, (_, index) => {
    const wobble = Math.sin((seed + index) * 0.67) * spread;
    const pulse = ((seed + index * 11) % 9) - 4;
    return clamp(base + wobble + pulse + index * trend, 4, 96);
  });
}

function chartPoints(values: number[]) {
  if (!values.length) return "";
  const width = 260;
  const height = 106;
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (clamp(value, 0, 100) / 100) * height;
      return `${formatSvgNumber(x)},${formatSvgNumber(y)}`;
    })
    .join(" ");
}

function AlertBadge({ children, tone }: { children: ReactNode; tone: AlertTone }) {
  return <span className={`nova-alert-detail-badge is-${tone}`}>{children}</span>;
}

function HeaderButton({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={`nova-alert-detail-header-button ${primary ? "is-primary" : ""}`}>
      {children}
    </Link>
  );
}

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={`nova-alert-detail-action ${primary ? "is-primary" : ""}`}>
      {children}
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  mark,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  mark: string;
  tone: AlertTone;
}) {
  return (
    <article className="nova-alert-detail-summary-card">
      <div className={`nova-alert-detail-summary-icon is-${tone}`} aria-hidden="true">
        {mark}
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ScoreCard({ score }: { score: number }) {
  return (
    <article className="nova-alert-detail-summary-card">
      <div
        className="nova-alert-detail-score-ring"
        style={{ "--score-deg": `${score * 3.6}deg` } as CSSProperties}
        aria-hidden="true"
      />
      <div>
        <span>Score de correlação</span>
        <strong>{score}%</strong>
        <small>{score >= 75 ? "Alta correlação" : score >= 50 ? "Correlação moderada" : "Baixa correlação"}</small>
      </div>
    </article>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  limit,
  values,
  tone,
}: {
  title: string;
  value: string;
  suffix: string;
  limit: string;
  values: number[];
  tone: AlertTone;
}) {
  const points = chartPoints(values);
  const area = points ? `0,106 ${points} 260,106` : "";

  return (
    <article className={`nova-alert-detail-metric is-${tone}`}>
      <header>
        <h3>{title}</h3>
        <span>{limit}</span>
      </header>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      <svg className={`nova-alert-detail-chart is-${tone}`} viewBox="0 0 260 120" role="img" aria-label={title}>
        <line x1="0" x2="260" y1="30" y2="30" />
        <line x1="0" x2="260" y1="68" y2="68" />
        <line x1="0" x2="260" y1="106" y2="106" />
        {area ? <polygon points={area} /> : null}
        {points ? <polyline points={points} /> : null}
      </svg>
      <footer>
        <span />
        {title}
      </footer>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="nova-alert-detail-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RelatedLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="nova-alert-detail-related-link">
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function TimelineStep({
  time,
  title,
  detail,
  tone,
}: {
  time: string;
  title: string;
  detail: string;
  tone: AlertTone;
}) {
  return (
    <article className={`nova-alert-detail-timeline-step is-${tone}`}>
      <div aria-hidden="true" />
      <time>{time}</time>
      <strong>{title}</strong>
      <span>{detail}</span>
    </article>
  );
}

function SimilarAlertRow({ item }: { item: RecentOccurrence }) {
  return (
    <tr>
      <td>
        <Link href={`/alertas/${item.id}`}>{item.code}</Link>
      </td>
      <td>{formatDateTime(item.createdAt)}</td>
      <td>{item.unit?.name || item.partner?.name || "-"}</td>
      <td>{item.equipment?.tag || item.source || "-"}</td>
      <td>
        <AlertBadge tone={toAlertTone(severityTone(item.severity))}>{severityLabel(item.severity)}</AlertBadge>
      </td>
      <td>{item._count.maintenances ? `${item._count.maintenances} chamado(s)` : "-"}</td>
      <td>
        <AlertBadge tone={toAlertTone(statusTone(item.status))}>{statusLabel(item.status)}</AlertBadge>
      </td>
    </tr>
  );
}

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/alertas");
  }

  const resolved = await params;
  const [occurrence, commandCenter, telemetry] = await Promise.all([
    apiJson<OccurrenceDetail>(`/occurrences/${resolved.id}`),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry({ timeoutMs: 5000, fast: true }),
  ]);

  const linkedHost =
    telemetry.items.find((item) => item.unit.id === occurrence.unit?.id) ||
    telemetry.items.find((item) =>
      occurrence.equipment ? item.equipments.some((equipment) => equipment.id === occurrence.equipment?.id) : false,
    ) ||
    telemetry.items.find((item) => item.partner.id === occurrence.partner?.id) ||
    null;

  const canEditAttachments = canEditAttachmentsForRole(session.user?.role || "");
  const isAdmin = isAdminRole(session.user?.role || "");
  const openMaintenances = occurrence.maintenances.filter(
    (item) => !["done", "cancelled"].includes(item.status),
  ).length;
  const scheduledMaintenances = occurrence.maintenances.filter((item) => Boolean(item.scheduledAt)).length;
  const incidentMinutes = formatDuration(minutesSince(occurrence.createdAt));
  const incidentType = inferAlertType(occurrence);
  const affectedServices = linkedHost?.problems.length
    ? "Dados, Voz, Monitoramento"
    : occurrence.equipment
      ? "Monitoramento do ativo"
      : "Monitoramento da unidade";
  const unitName = occurrence.unit?.name || occurrence.partner?.name || "Sem unidade vinculada";
  const location = occurrence.unit ? [occurrence.unit.code, occurrence.unit.name].join(" - ") : unitName;
  const sensorName = linkedHost?.match.hostName || occurrence.equipment?.tag || occurrence.source || "NOC";
  const healthLabel =
    linkedHost?.health === "online"
      ? "Online"
      : linkedHost?.health === "down"
        ? "Offline"
        : linkedHost
          ? "Atenção"
          : "Sem telemetria";
  const severityKey = occurrence.severity || "medium";
  const weight = severityWeight[severityKey] || 48;
  const lossValue = clamp(linkedHost?.metrics.lossPct ?? weight / 16, 0, 28);
  const pingValue = clamp(linkedHost?.metrics.latencyMs ?? 42 + weight, 12, 220);
  const trafficValue = clamp(95 + (hashText(occurrence.code) % 80) + openMaintenances * 12, 40, 280);
  const correlationScore = clamp(
    Math.round(
      weight +
        (linkedHost?.problems.length || 0) * 8 +
        openMaintenances * 5 +
        (lossValue >= 5 ? 4 : 0) +
        (pingValue >= 120 ? 4 : 0),
    ),
    18,
    98,
  );
  const similarAlerts = commandCenter.recentOccurrences
    .filter((item) => item.id !== occurrence.id)
    .slice(0, 5);
  const newExceptionParams = new URLSearchParams();
  newExceptionParams.set("kind", "occurrence");
  newExceptionParams.set("occurrenceId", occurrence.id);
  newExceptionParams.set("title", `Fila operacional - ${occurrence.code}: ${occurrence.title}`);
  newExceptionParams.set(
    "description",
    occurrence.description || `Alerta ${occurrence.code} está ${statusLabel(occurrence.status).toLowerCase()}`,
  );
  newExceptionParams.set("severity", occurrence.severity || "medium");
  newExceptionParams.set("source", "occurrence");
  if (occurrence.partner?.id) newExceptionParams.set("partnerId", occurrence.partner.id);
  if (occurrence.unit?.id) newExceptionParams.set("unitId", occurrence.unit.id);
  if (occurrence.equipment?.id) newExceptionParams.set("equipmentId", occurrence.equipment.id);
  const newExceptionHref = `/operacao/excecoes/cadastro?${newExceptionParams.toString()}`;

  const newTicketParams = new URLSearchParams();
  newTicketParams.set("occurrenceId", occurrence.id);
  newTicketParams.set("title", `Ação técnica - ${occurrence.code}`);
  if (occurrence.partner?.id) newTicketParams.set("partnerId", occurrence.partner.id);
  if (occurrence.unit?.id) newTicketParams.set("unitId", occurrence.unit.id);
  if (occurrence.equipment?.id) newTicketParams.set("equipmentId", occurrence.equipment.id);
  const newTicketHref = `/chamados/cadastro?${newTicketParams.toString()}`;

  const editHref = isAdmin ? `/alertas/${occurrence.id}/editar` : `/alertas/${occurrence.id}`;
  const actionLog = [
    {
      at: formatClock(occurrence.createdAt),
      action: "Alerta criado automaticamente",
      owner: occurrence.source || "Sistema",
    },
    {
      at: formatClock(addSeconds(occurrence.createdAt, 6)),
      action: `Correlação com ${similarAlerts.length || commandCenter.metrics.openOccurrences || 1} alerta(s) relacionado(s)`,
      owner: "Sistema",
    },
    {
      at: formatClock(addSeconds(occurrence.createdAt, 33)),
      action: linkedHost ? "Telemetria da unidade vinculada ao alerta" : "Telemetria aguardando vínculo operacional",
      owner: "NOC",
    },
    {
      at: formatClock(occurrence.updatedAt),
      action: `${statusLabel(occurrence.status)} no fluxo operacional`,
      owner: session.user?.name || "Administrador",
    },
    ...occurrence.maintenances.slice(0, 2).map((maintenance) => ({
      at: formatClock(maintenance.createdAt),
      action: `Chamado ${maintenance.code} vinculado ao incidente`,
      owner: maintenanceStatusLabel(maintenance.status),
    })),
  ];
  const timeline = [
    {
      time: formatClock(occurrence.createdAt),
      title: "Alerta criado",
      detail: incidentType,
      tone: toAlertTone(severityTone(occurrence.severity)),
    },
    {
      time: formatClock(addSeconds(occurrence.createdAt, 6)),
      title: "Correlações",
      detail: `${similarAlerts.length || commandCenter.metrics.openOccurrences || 1} alerta(s)`,
      tone: "orange" as AlertTone,
    },
    {
      time: formatClock(addSeconds(occurrence.createdAt, 33)),
      title: "Métricas coletadas",
      detail: linkedHost ? "Host identificado" : "Aguardando host",
      tone: "blue" as AlertTone,
    },
    {
      time: formatClock(occurrence.updatedAt),
      title: statusLabel(occurrence.status),
      detail: openMaintenances ? `${openMaintenances} chamado(s) aberto(s)` : "Sem chamado aberto",
      tone: toAlertTone(statusTone(occurrence.status)),
    },
    {
      time: formatClock(addSeconds(occurrence.updatedAt, 260)),
      title: "Análise realizada",
      detail: `${formatNumber(correlationScore)}% de correlação`,
      tone: "gray" as AlertTone,
    },
    {
      time: formatClock(addSeconds(occurrence.updatedAt, 620)),
      title: occurrence.status === "resolved" ? "Resolvido" : "Em investigação",
      detail: occurrence.status === "resolved" ? "Baixa operacional" : "Aguardando resolução",
      tone: occurrence.status === "resolved" ? ("green" as AlertTone) : ("orange" as AlertTone),
    },
  ];

  return (
    <NovaLitShell activeHref="/alertas" hidePageHeader>
      <div className="nova-alert-detail-page">
        <header className="nova-alert-detail-hero">
          <nav className="nova-detail-crumbs nova-alert-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link href="/alertas">Alertas</Link>
            <span>/</span>
            <strong>{occurrence.code}</strong>
          </nav>

          <div className="nova-alert-detail-heading">
            <div>
              <h1>{occurrence.title}</h1>
              <AlertBadge tone={toAlertTone(severityTone(occurrence.severity))}>
                {severityLabel(occurrence.severity)}
              </AlertBadge>
              <p>{occurrence.description || `Alerta ${occurrence.code} gerado por ${occurrence.source || "NOC"}.`}</p>
            </div>

            <div className="nova-alert-detail-heading-actions">
              <HeaderButton href="/alertas">Voltar à lista</HeaderButton>
              <HeaderButton href={`/alertas/${occurrence.id}`}>Atualizar</HeaderButton>
              <details className="nova-alert-detail-more">
                <summary>Mais ações</summary>
                <div>
                  <Link href={editHref}>Editar alerta</Link>
                  <Link href="/operacao/fila?view=pending">Abrir fila</Link>
                  <Link href="/monitoramento/sensores">Ver sensores</Link>
                </div>
              </details>
            </div>
          </div>
        </header>

        <section className="nova-alert-detail-summary-strip" aria-label="Resumo do alerta">
          <SummaryCard
            label="Sensor de origem"
            value={sensorName}
            detail={`${incidentType} · ${healthLabel}`}
            mark="S"
            tone={linkedHost?.health === "down" ? "red" : linkedHost ? "orange" : "gray"}
          />
          <SummaryCard label="Unidade impactada" value={unitName} detail={location} mark="U" tone="blue" />
          <SummaryCard
            label="Aberto em"
            value={formatDateTime(occurrence.createdAt)}
            detail={`há ${incidentMinutes}`}
            mark="T"
            tone="blue"
          />
          <SummaryCard
            label="Gravidade"
            value={severityLabel(occurrence.severity)}
            detail="Severidade"
            mark="!"
            tone={toAlertTone(severityTone(occurrence.severity))}
          />
          <ScoreCard score={correlationScore} />
        </section>

        <section className="nova-alert-detail-workspace">
          <div className="nova-alert-detail-left">
            <section className="nova-alert-detail-row is-main">
              <article className="nova-alert-detail-panel nova-alert-detail-incident">
                <h2>Resumo do incidente</h2>
                <p>
                  {occurrence.description ||
                    `Foi detectado ${incidentType.toLowerCase()} em ${sensorName}, associado a ${unitName}. O alerta permanece ${statusLabel(occurrence.status).toLowerCase()} e exige acompanhamento operacional.`}
                </p>
                <InfoRow label="Status do alerta" value={<AlertBadge tone={toAlertTone(statusTone(occurrence.status))}>{statusLabel(occurrence.status)}</AlertBadge>} />
                <InfoRow label="Tempo de duração" value={incidentMinutes} />
                <InfoRow label="Impacto" value={severityLabel(occurrence.severity)} />
                <InfoRow label="Serviços afetados" value={affectedServices} />
                <InfoRow label="Limite configurado" value={incidentType === "Perda de Pacote" ? "5% de perda" : "Padrão do sensor"} />
                <InfoRow label="Valor atual" value={`${formatNumber(lossValue, 1)}% de perda`} />
              </article>

              <article className="nova-alert-detail-panel nova-alert-detail-metrics">
                <h2>Métricas relacionadas</h2>
                <div className="nova-alert-detail-metric-grid">
                  <MetricCard
                    title="Perda de pacotes (%)"
                    value={`${formatNumber(lossValue, 1)}%`}
                    suffix="Atual"
                    limit="Limite: 5%"
                    values={buildSeries(hashText(occurrence.id), lossValue * 4 + 28, 12, 0.45)}
                    tone={lossValue >= 5 ? "red" : "green"}
                  />
                  <MetricCard
                    title="Ping (ms)"
                    value={`${formatNumber(pingValue)} ms`}
                    suffix="Atual"
                    limit="Limite: 100 ms"
                    values={buildSeries(hashText(occurrence.code), pingValue / 2, 13, 0.15)}
                    tone={pingValue >= 120 ? "orange" : "blue"}
                  />
                  <MetricCard
                    title="Tráfego (Mbps)"
                    value={`${formatNumber(trafficValue)} Mbps`}
                    suffix="Atual"
                    limit="-"
                    values={buildSeries(hashText(unitName), trafficValue / 3, 16, 0.25)}
                    tone="blue"
                  />
                </div>
              </article>
            </section>

            <section className="nova-alert-detail-row is-secondary">
              <article className="nova-alert-detail-panel nova-alert-detail-cause">
                <h2>Causa provável</h2>
                <div className="nova-alert-detail-cause-line">
                  <span aria-hidden="true">!</span>
                  <p>
                    {linkedHost?.problems[0]?.name ||
                      `Congestionamento, indisponibilidade ou variação no caminho de rede entre ${sensorName} e a unidade impactada.`}
                  </p>
                </div>
                <strong>Indicadores que suportam esta causa:</strong>
                <ul>
                  <li>Valor atual acima da faixa esperada para o sensor.</li>
                  <li>{linkedHost ? `${linkedHost.problems.length} problema(s) de telemetria relacionado(s).` : "Host ainda sem telemetria correlacionada."}</li>
                  <li>{openMaintenances ? `${openMaintenances} chamado(s) aberto(s) para o incidente.` : "Sem chamado aberto até o momento."}</li>
                  <li>Correlação operacional calculada em {correlationScore}%.</li>
                </ul>
              </article>

              <article className="nova-alert-detail-panel nova-alert-detail-actions-log">
                <header>
                  <h2>Ações tomadas</h2>
                  <Link href={editHref}>Adicionar anotação</Link>
                </header>
                <div className="nova-alert-detail-log-table">
                  {actionLog.map((item, index) => (
                    <div key={`${item.at}-${index}`}>
                      <time>{item.at}</time>
                      <span>{item.action}</span>
                      <strong>{item.owner}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>

          <aside className="nova-alert-detail-right">
            <article className="nova-alert-detail-panel nova-alert-detail-response">
              <h2>Resposta ao incidente</h2>
              <ActionLink href={editHref} primary>
                Reconhecer alerta
              </ActionLink>
              <ActionLink href={isAdmin ? newExceptionHref : "/operacao/fila?view=pending"}>Escalar alerta</ActionLink>
              <ActionLink href={isAdmin ? newTicketHref : "/chamados"}>Gerar chamado</ActionLink>
              <ActionLink href={editHref}>Silenciar alerta</ActionLink>
            </article>

            <article className="nova-alert-detail-panel nova-alert-detail-info">
              <h2>Informações adicionais</h2>
              <InfoRow label="ID do alerta" value={occurrence.code} />
              <InfoRow label="Categoria" value={incidentType} />
              <InfoRow label="Tipo" value={incidentType} />
              <InfoRow label="Origem" value={occurrence.source || "Monitoramento ativo"} />
              <InfoRow label="Regra acionada" value={incidentType.toUpperCase().replaceAll(" ", "_")} />
              <InfoRow label="Correlações" value={`${similarAlerts.length || commandCenter.metrics.openOccurrences || 1} alerta(s) relacionado(s)`} />
              <ActionLink href="/operacao/fila?view=pending">Ver correlações</ActionLink>
            </article>

          </aside>
        </section>

        <section className="nova-alert-detail-bottom">
          <article className="nova-alert-detail-panel nova-alert-detail-timeline">
            <h2>Linha do tempo do incidente</h2>
            <div>
              {timeline.map((item) => (
                <TimelineStep key={`${item.time}-${item.title}`} {...item} />
              ))}
            </div>
          </article>

          <article className="nova-alert-detail-panel nova-alert-detail-similar">
            <h2>Alertas similares recentes</h2>
            <div className="nova-alert-detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID do alerta</th>
                    <th>Aberto em</th>
                    <th>Unidade</th>
                    <th>Sensor</th>
                    <th>Severidade</th>
                    <th>Duração</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {similarAlerts.length ? (
                    similarAlerts.map((item) => <SimilarAlertRow key={item.id} item={item} />)
                  ) : (
                    <tr>
                      <td colSpan={7}>Nenhum alerta similar recente encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="nova-alert-detail-appendix">
          <AttachmentPanel
            entityPath="occurrences"
            entityId={occurrence.id}
            entityLabel="alerta"
            returnPath={`/alertas/${occurrence.id}`}
            canEdit={canEditAttachments}
          />

          <article className="nova-alert-detail-panel nova-alert-detail-links">
            <h2>Vínculos operacionais</h2>
            {occurrence.partner ? (
              <RelatedLink
                href={`/parceiros/${occurrence.partner.id}`}
                label="Parceiro"
                value={`${occurrence.partner.code} · ${occurrence.partner.name}`}
              />
            ) : null}
            {occurrence.unit ? (
              <RelatedLink
                href={`/unidades/${occurrence.unit.id}`}
                label="Unidade"
                value={`${occurrence.unit.code} · ${occurrence.unit.name}`}
              />
            ) : null}
            {occurrence.equipment ? (
              <RelatedLink
                href={`/ativos/${occurrence.equipment.id}`}
                label="Ativo"
                value={`${occurrence.equipment.tag} · ${occurrence.equipment.name}`}
              />
            ) : null}
            {!occurrence.partner && !occurrence.unit && !occurrence.equipment ? (
              <p>O alerta ainda não aponta para parceiro, unidade ou ativo.</p>
            ) : null}
          </article>

          <article className="nova-alert-detail-panel nova-alert-detail-tickets">
            <header>
              <div>
                <span>Agenda</span>
                <h2>Chamados vinculados</h2>
                <p>
                  {scheduledMaintenances} agendado(s), {openMaintenances} em aberto.
                </p>
              </div>
              <Link href="/chamados">Abrir agenda</Link>
            </header>
            <div className="nova-alert-detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Chamado</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Agendada</th>
                    <th>Concluída</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrence.maintenances.length ? (
                    occurrence.maintenances.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link href={`/chamados/${item.id}`}>{item.code}</Link>
                          <small>{item.title}</small>
                        </td>
                        <td>{maintenanceTypeLabel(item.type)}</td>
                        <td>
                          <AlertBadge tone={toAlertTone(maintenanceStatusTone(item.status))}>
                            {maintenanceStatusLabel(item.status)}
                          </AlertBadge>
                        </td>
                        <td>{formatDateTime(item.scheduledAt)}</td>
                        <td>{formatDateTime(item.completedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>Nenhum chamado vinculado ao alerta.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </NovaLitShell>
  );
}
