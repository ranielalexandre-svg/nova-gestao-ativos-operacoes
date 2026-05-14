import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  formatMs,
  formatPercent,
  healthLabel,
  safeApiJson,
  telemetryCoveragePct,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

const emptyTelemetry = {
  generatedAt: new Date(0).toISOString(),
  sources: [],
  counts: {
    units: 0,
    matched: 0,
    ambiguous: 0,
    unmapped: 0,
    online: 0,
    degraded: 0,
    down: 0,
    withProblems: 0,
    syncReady: 0,
    avgLatencyMs: null,
    avgLossPct: null,
    maxTemperatureC: null,
  },
  items: [],
} as unknown as UnitHostTelemetry;


function availabilityPct(monitoredUnits: number, down: number) {
  if (!monitoredUnits) return 0;
  return Math.max(0, ((monitoredUnits - down) / monitoredUnits) * 100);
}

function pct(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function toneFromHealth(value: string): Tone {
  if (value === "online") return "green";
  if (value === "down") return "red";
  if (value === "degraded" || value === "ambiguous") return "orange";
  if (value === "unmapped" || value === "unknown") return "slate";
  return "blue";
}

function availabilityTone(value: number): Tone {
  if (value >= 99) return "green";
  if (value >= 95) return "orange";
  return "red";
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={`nova-lit-metric-card is-${tone}`}>
      <div className="nova-lit-metric-card__dot" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`nova-lit-badge is-${tone}`}>{children}</span>;
}

function Bar({
  label,
  value,
  max,
  tone,
  href,
}: {
  label: string;
  value: number;
  max: number;
  tone: Tone;
  href: string;
}) {
  const width = max ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <Link href={href} className="nova-availability-bar">
      <div className="nova-availability-bar__head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="nova-availability-bar__track">
        <div className={`nova-availability-bar__fill is-${tone}`} style={{ width: `${width}%` }} />
      </div>
    </Link>
  );
}

export default async function RelatorioDisponibilidadePage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/relatorios/disponibilidade");

  const telemetry = await safeApiJson<UnitHostTelemetry>("/monitoring/unit-hosts?mode=fast", emptyTelemetry);
  const availabilityBase = telemetry.counts.matched;
  const availability = availabilityPct(availabilityBase, telemetry.counts.down);
  const coverage = telemetryCoveragePct(telemetry);
  const attentionRows = telemetry.items.filter((item) => item.health !== "online").slice(0, 10);
  const visibleRows = telemetry.items.slice(0, 18);
  const attention = telemetry.counts.degraded + telemetry.counts.ambiguous;
  const totalRisk = telemetry.counts.down + attention + telemetry.counts.unmapped;

  const segments = [
    { label: "Online", value: telemetry.counts.online, tone: "green" as const },
    { label: "Atenção", value: attention, tone: "orange" as const },
    { label: "Offline", value: telemetry.counts.down, tone: "red" as const },
    { label: "Sem vínculo", value: telemetry.counts.unmapped, tone: "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/operacao/relatorios/disponibilidade">
      <main className="nova-lit-page nova-availability-page">
        <section className="nova-lit-hero">
          <div>
            <span className="nova-lit-eyebrow">Relatórios NOC / Disponibilidade</span>
            <h1>Relatório de disponibilidade</h1>
            <p>SLA por unidade, vínculo Zabbix, perda, latência e indisponibilidade operacional.</p>
          </div>
          <div className="nova-lit-hero__actions">
            <Link href="/monitoramento/sensores" className="nds-button" data-variant="secondary">Ver sensores</Link>
            <Link href="/operacao/relatorios/monitoramento" className="nds-button" data-variant="primary">Gerar relatório</Link>
          </div>
        </section>

        <section className="nova-lit-metrics-grid is-five">
          <MetricCard
            label="SLA estimado"
            value={availabilityBase ? pct(availability) : "0%"}
            detail={availabilityBase ? "baseado em hosts online/offline" : "sem host vinculado"}
            tone={availabilityBase ? availabilityTone(availability) : "orange"}
          />
          <MetricCard label="Cobertura" value={`${coverage}%`} detail="unidades com host confiável" tone={coverage >= 90 ? "green" : "orange"} />
          <MetricCard label="Offline" value={telemetry.counts.down} detail="unidades indisponíveis" tone={telemetry.counts.down ? "red" : "green"} />
          <MetricCard label="Atenção" value={attention} detail="degradado ou ambíguo" tone={attention ? "orange" : "green"} />
          <MetricCard label="Sem vínculo" value={telemetry.counts.unmapped} detail="sem host confiável" tone={telemetry.counts.unmapped ? "orange" : "green"} />
        </section>

        <section className="nova-lit-layout">
          <div className="nova-lit-main-col">
            <section className="nova-lit-panel nova-availability-summary">
              <div className="nova-lit-panel__head">
                <div>
                  <span className="nova-lit-eyebrow">SLA consolidado</span>
                  <h2>Estado atual da disponibilidade</h2>
                </div>
                <Badge tone={availabilityBase ? availabilityTone(availability) : "orange"}>
                  {availabilityBase ? pct(availability) : "sem base"}
                </Badge>
              </div>

              <div className="nova-availability-meter">
                {segments.map((segment) => {
                  const width = telemetry.counts.units ? Math.max(2, (segment.value / telemetry.counts.units) * 100) : 0;
                  return (
                    <div
                      key={segment.label}
                      className={`nova-availability-meter__segment is-${segment.tone}`}
                      style={{ width: `${width}%` }}
                      title={`${segment.label}: ${segment.value}`}
                    />
                  );
                })}
              </div>

              <div className="nova-availability-legend">
                {segments.map((segment) => (
                  <div key={segment.label}>
                    <i className={`is-${segment.tone}`} />
                    <span>{segment.label}</span>
                    <strong>{segment.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="nova-lit-panel">
              <div className="nova-lit-panel__head">
                <div>
                  <span className="nova-lit-eyebrow">SLA por unidade</span>
                  <h2>Disponibilidade operacional</h2>
                </div>
                <Badge tone="blue">{visibleRows.length} linhas</Badge>
              </div>

              <div className="nova-lit-table-wrap">
                <table className="nova-lit-table">
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Parceiro</th>
                      <th>Host</th>
                      <th>Latência</th>
                      <th>Perda</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length ? visibleRows.map((item) => (
                      <tr key={item.unit.id}>
                        <td>
                          <strong>{item.unit.name}</strong>
                          <small>{item.unit.code}</small>
                        </td>
                        <td>
                          <strong>{item.partner.name}</strong>
                          <small>{item.unit.city || "Sem cidade"}{item.unit.state ? `/${item.unit.state}` : ""}</small>
                        </td>
                        <td>
                          <strong>{item.match.hostName || item.match.host || "Sem host"}</strong>
                          <small>{item.match.status === "matched" ? "host correlacionado" : "vínculo pendente"}</small>
                        </td>
                        <td>{formatMs(item.metrics.latencyMs)}</td>
                        <td>{formatPercent(item.metrics.lossPct)}</td>
                        <td><Badge tone={toneFromHealth(item.health)}>{healthLabel(item.health)}</Badge></td>
                        <td><Link href={`/unidades/${item.unit.id}`} className="nova-lit-row-action">Abrir</Link></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>
                          <div className="nova-lit-empty">
                            <strong>Nenhuma unidade encontrada</strong>
                            <span>A telemetria ainda não retornou dados para este recorte.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="nova-lit-side-col">
            <section className="nova-lit-panel">
              <div className="nova-lit-panel__head">
                <div>
                  <span className="nova-lit-eyebrow">Indisponibilidade</span>
                  <h2>Condições de risco</h2>
                </div>
                <Badge tone={totalRisk ? "orange" : "green"}>{totalRisk}</Badge>
              </div>
              <div className="nova-availability-bars">
                <Bar label="Offline" value={telemetry.counts.down} max={Math.max(1, telemetry.counts.units)} tone="red" href="/monitoramento/sensores?health=down" />
                <Bar label="Degradado" value={telemetry.counts.degraded} max={Math.max(1, telemetry.counts.units)} tone="orange" href="/monitoramento/sensores?health=degraded" />
                <Bar label="Ambíguo" value={telemetry.counts.ambiguous} max={Math.max(1, telemetry.counts.units)} tone="orange" href="/monitoramento/sensores?health=ambiguous" />
                <Bar label="Sem vínculo" value={telemetry.counts.unmapped} max={Math.max(1, telemetry.counts.units)} tone="slate" href="/monitoramento/sensores?health=unmapped" />
              </div>
            </section>

            <section className="nova-lit-panel">
              <div className="nova-lit-panel__head">
                <div>
                  <span className="nova-lit-eyebrow">Resumo SLA</span>
                  <h2>Pontos do relatório</h2>
                </div>
              </div>
              <div className="nova-availability-kv">
                <div><span>Unidades avaliadas</span><strong>{telemetry.counts.units}</strong></div>
                <div><span>Com host vinculado</span><strong>{telemetry.counts.matched}</strong></div>
                <div><span>Com problema</span><strong>{telemetry.counts.withProblems}</strong></div>
                <div><span>Cobertura técnica</span><strong>{coverage}%</strong></div>
              </div>
            </section>

            <section className="nova-lit-panel">
              <div className="nova-lit-panel__head">
                <div>
                  <span className="nova-lit-eyebrow">Fila de atenção</span>
                  <h2>Prioridade operacional</h2>
                </div>
                <Badge tone={attentionRows.length ? "orange" : "green"}>{attentionRows.length}</Badge>
              </div>
              <div className="nova-lit-list">
                {attentionRows.length ? attentionRows.map((item) => (
                  <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="nova-lit-list-item">
                    <div>
                      <strong>{item.unit.name}</strong>
                      <small>{item.partner.name} · {item.unit.city || "Sem cidade"}{item.unit.state ? `/${item.unit.state}` : ""}</small>
                    </div>
                    <Badge tone={toneFromHealth(item.health)}>{healthLabel(item.health)}</Badge>
                  </Link>
                )) : (
                  <div className="nova-lit-empty compact">
                    <strong>Nenhuma unidade fora da normalidade.</strong>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
