import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  formatMs,
  formatPercent,
  healthLabel,
  safeApiJson,
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

function avgLabel(value: number | null | undefined, suffix: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function metricTone(value: number | null | undefined, warn: number, critical: number): Tone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "slate";
  if (value >= critical) return "red";
  if (value >= warn) return "orange";
  return "green";
}

function healthToneLocal(value: string): Tone {
  if (value === "online") return "green";
  if (value === "down") return "red";
  if (value === "degraded" || value === "ambiguous") return "orange";
  if (value === "unmapped" || value === "unknown") return "slate";
  return "blue";
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
    <div className={`nova-performance-metric is-${tone}`}>
      <div className="nova-performance-metric__dot" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-performance-badge is-${tone}`}>{children}</span>;
}

function Bar({
  label,
  value,
  max,
  tone,
  meta,
  formatter,
}: {
  label: string;
  value: number;
  max: number;
  tone: Tone;
  meta: string;
  formatter: (value: number) => string;
}) {
  const width = max ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="nova-performance-bar">
      <div className="nova-performance-bar__head">
        <div>
          <strong>{label}</strong>
          <small>{meta}</small>
        </div>
        <b>{formatter(value)}</b>
      </div>
      <div className="nova-performance-bar__track">
        <div className={`nova-performance-bar__fill is-${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function RelatorioPerformancePage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios/performance");

  const telemetry = await safeApiJson<UnitHostTelemetry>("/monitoring/unit-hosts?mode=fast", emptyTelemetry);

  const withLatency = telemetry.items.filter((item) => typeof item.metrics.latencyMs === "number").length;
  const withLoss = telemetry.items.filter((item) => typeof item.metrics.lossPct === "number").length;
  const withTemperature = telemetry.items.filter((item) => typeof item.metrics.temperatureC === "number").length;
  const withPing = telemetry.items.filter((item) => Boolean(item.metrics.ping)).length;
  const withHost = telemetry.counts.matched || 0;
  const coverage = telemetry.counts.units ? Math.round((withHost / telemetry.counts.units) * 100) : 0;

  const latencyRows = telemetry.items
    .filter((item) => typeof item.metrics.latencyMs === "number")
    .sort((a, b) => (b.metrics.latencyMs || 0) - (a.metrics.latencyMs || 0))
    .slice(0, 6);

  const lossRows = telemetry.items
    .filter((item) => typeof item.metrics.lossPct === "number")
    .sort((a, b) => (b.metrics.lossPct || 0) - (a.metrics.lossPct || 0))
    .slice(0, 6);

  const rankingRows = telemetry.items
    .slice()
    .sort((a, b) => {
      const scoreA =
        (a.problems?.length || 0) * 1000 +
        (a.metrics.lossPct || 0) * 100 +
        (a.metrics.latencyMs || 0) +
        (a.health === "down" ? 5000 : 0) +
        (a.health === "degraded" ? 2000 : 0) +
        (a.match?.status === "matched" ? 0 : 250);
      const scoreB =
        (b.problems?.length || 0) * 1000 +
        (b.metrics.lossPct || 0) * 100 +
        (b.metrics.latencyMs || 0) +
        (b.health === "down" ? 5000 : 0) +
        (b.health === "degraded" ? 2000 : 0) +
        (b.match?.status === "matched" ? 0 : 250);
      return scoreB - scoreA;
    })
    .slice(0, 18);

  const maxLatency = Math.max(1, ...latencyRows.map((item) => item.metrics.latencyMs || 0));
  const maxLoss = Math.max(1, ...lossRows.map((item) => item.metrics.lossPct || 0));
  const sensorMax = Math.max(1, telemetry.counts.units);

  return (
    <NovaLitShell activeHref="/relatorios/performance">
      <main className="nova-performance-page">
        <section className="nova-performance-hero">
          <div>
            <span>Relatórios / Performance</span>
            <h1>Relatório de performance</h1>
            <p>Comparativo de latência, perda, sensores, temperatura e saúde técnica por unidade monitorada.</p>
          </div>
          <div className="nova-performance-hero__actions">
            <Link href="/monitoramento/sensores" className="nds-button" data-variant="secondary">Ver sensores</Link>
            <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">Gerar relatório</Link>
          </div>
        </section>

        <section className="nova-performance-metrics">
          <MetricCard
            label="Latência média"
            value={avgLabel(telemetry.counts.avgLatencyMs, " ms")}
            detail={`${withLatency} unidade(s) com leitura`}
            tone={metricTone(telemetry.counts.avgLatencyMs, 50, 150)}
          />
          <MetricCard
            label="Perda média"
            value={avgLabel(telemetry.counts.avgLossPct, "%")}
            detail={`${withLoss} unidade(s) com leitura`}
            tone={metricTone(telemetry.counts.avgLossPct, 1, 3)}
          />
          <MetricCard
            label="Problemas"
            value={telemetry.counts.withProblems}
            detail="eventos ativos no Zabbix"
            tone={telemetry.counts.withProblems ? "red" : "green"}
          />
          <MetricCard
            label="Temperatura máx."
            value={avgLabel(telemetry.counts.maxTemperatureC, " °C")}
            detail={`${withTemperature} ativo(s) com sensor`}
            tone={metricTone(telemetry.counts.maxTemperatureC, 45, 60)}
          />
          <MetricCard
            label="Cobertura"
            value={`${coverage}%`}
            detail={`${withHost} de ${telemetry.counts.units} com host`}
            tone={coverage >= 80 ? "green" : coverage ? "orange" : "slate"}
          />
        </section>

        <section className="nova-performance-layout">
          <div className="nova-performance-main">
            <section className="nova-performance-card">
              <div className="nova-performance-card__head">
                <div>
                  <span>Comparativo</span>
                  <h2>Indicadores por sensor</h2>
                </div>
                <Badge tone={withLatency || withLoss ? "blue" : "slate"}>{withLatency + withLoss} leituras</Badge>
              </div>

              <div className="nova-performance-charts">
                <div className="nova-performance-mini-panel">
                  <h3>Latência</h3>
                  <p>maiores leituras por unidade</p>
                  <div className="nova-performance-bars">
                    {latencyRows.length ? latencyRows.map((item) => (
                      <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="nova-performance-bar-link">
                        <Bar
                          label={item.unit.code}
                          value={item.metrics.latencyMs || 0}
                          max={maxLatency}
                          tone={metricTone(item.metrics.latencyMs, 50, 150)}
                          meta={item.unit.name}
                          formatter={formatMs}
                        />
                      </Link>
                    )) : (
                      <div className="nova-performance-empty compact">Nenhuma leitura de latência disponível.</div>
                    )}
                  </div>
                </div>

                <div className="nova-performance-mini-panel">
                  <h3>Perda de pacote</h3>
                  <p>maiores leituras por unidade</p>
                  <div className="nova-performance-bars">
                    {lossRows.length ? lossRows.map((item) => (
                      <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="nova-performance-bar-link">
                        <Bar
                          label={item.unit.code}
                          value={item.metrics.lossPct || 0}
                          max={maxLoss}
                          tone={metricTone(item.metrics.lossPct, 1, 3)}
                          meta={item.unit.name}
                          formatter={formatPercent}
                        />
                      </Link>
                    )) : (
                      <div className="nova-performance-empty compact">Nenhuma leitura de perda disponível.</div>
                    )}
                  </div>
                </div>

                <div className="nova-performance-mini-panel">
                  <h3>Cobertura de sensores</h3>
                  <p>itens encontrados nos hosts vinculados</p>
                  <div className="nova-performance-bars">
                    <Bar label="Ping" value={withPing} max={sensorMax} tone="green" meta="ICMP disponível" formatter={(value) => String(value)} />
                    <Bar label="Latência" value={withLatency} max={sensorMax} tone="blue" meta="tempo de resposta" formatter={(value) => String(value)} />
                    <Bar label="Perda" value={withLoss} max={sensorMax} tone="orange" meta="packet loss" formatter={(value) => String(value)} />
                    <Bar label="Temperatura" value={withTemperature} max={sensorMax} tone="red" meta="sensor térmico" formatter={(value) => String(value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className="nova-performance-card">
              <div className="nova-performance-card__head">
                <div>
                  <span>Performance</span>
                  <h2>Ranking técnico</h2>
                </div>
                <Badge tone="blue">{rankingRows.length} linhas</Badge>
              </div>

              <div className="nova-performance-table-wrap">
                <table className="nova-performance-table">
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Parceiro</th>
                      <th>Latência</th>
                      <th>Perda</th>
                      <th>Problemas</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingRows.length ? rankingRows.map((item) => (
                      <tr key={item.unit.id}>
                        <td>
                          <strong>{item.unit.name}</strong>
                          <small>{item.unit.code}</small>
                        </td>
                        <td>
                          <strong>{item.partner.name}</strong>
                          <small>{item.unit.city || "Sem cidade"}{item.unit.state ? `/${item.unit.state}` : ""}</small>
                        </td>
                        <td>{formatMs(item.metrics.latencyMs)}</td>
                        <td>{formatPercent(item.metrics.lossPct)}</td>
                        <td>{item.problems?.length || 0}</td>
                        <td><Badge tone={healthToneLocal(item.health)}>{healthLabel(item.health)}</Badge></td>
                        <td><Link href={`/unidades/${item.unit.id}`} className="nova-performance-row-action">Abrir</Link></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>
                          <div className="nova-performance-empty">
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

          <aside className="nova-performance-side">
            <section className="nova-performance-card">
              <div className="nova-performance-card__head">
                <div>
                  <span>Leitura técnica</span>
                  <h2>Critérios</h2>
                </div>
              </div>
              <div className="nova-performance-notes">
                <div><strong>Ideal</strong><span>perda menor que 1%</span></div>
                <div><strong>Atenção</strong><span>latência acima de 50 ms</span></div>
                <div><strong>Crítico</strong><span>offline ou evento ativo</span></div>
              </div>
            </section>

            <section className="nova-performance-card">
              <div className="nova-performance-card__head">
                <div>
                  <span>Validação</span>
                  <h2>Cobertura técnica</h2>
                </div>
                <Badge tone={coverage ? "blue" : "slate"}>{coverage}%</Badge>
              </div>
              <div className="nova-performance-kv">
                <div><span>Unidades</span><strong>{telemetry.counts.units}</strong></div>
                <div><span>Hosts vinculados</span><strong>{withHost}</strong></div>
                <div><span>Sem vínculo</span><strong>{telemetry.counts.unmapped}</strong></div>
                <div><span>Com problema</span><strong>{telemetry.counts.withProblems}</strong></div>
              </div>
            </section>

            <section className="nova-performance-card">
              <div className="nova-performance-card__head">
                <div>
                  <span>Operação</span>
                  <h2>Importação de medições</h2>
                </div>
              </div>
              <div className="nova-performance-upload">
                <b>↑</b>
                <strong>CSV/XLSX de performance</strong>
                <small>tráfego, latência, perda e banda por unidade</small>
              </div>
              <div className="nova-performance-actions">
                <Link href="/operacao/importacao" className="nds-button" data-variant="secondary">Importar base operacional</Link>
                <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">Exportar relatório</Link>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
