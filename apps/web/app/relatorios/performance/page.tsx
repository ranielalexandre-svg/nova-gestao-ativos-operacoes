import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarList, ChartCard, DenseTable, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { buildWatchlist, formatMs, formatPercent, healthLabel, healthTone, metricTone, readUnitHostTelemetry } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

function avgLabel(value: number | null, suffix: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

export default async function RelatorioPerformancePage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios/performance");

  const telemetry = await readUnitHostTelemetry({ timeoutMs: 1500 });
  const watchlist = buildWatchlist(telemetry, 10);
  const withLatency = telemetry.items.filter((item) => typeof item.metrics.latencyMs === "number").length;
  const withLoss = telemetry.items.filter((item) => typeof item.metrics.lossPct === "number").length;
  const withTemperature = telemetry.items.filter((item) => typeof item.metrics.temperatureC === "number").length;
  const latencyBars = telemetry.items
    .filter((item) => typeof item.metrics.latencyMs === "number")
    .sort((a, b) => (b.metrics.latencyMs || 0) - (a.metrics.latencyMs || 0))
    .slice(0, 6)
    .map((item) => ({
      label: item.unit.code,
      value: item.metrics.latencyMs || 0,
      tone: metricTone(item.metrics.latencyMs, 50, 150),
      meta: item.unit.name,
      href: `/unidades/${item.unit.id}`,
    }));
  const lossBars = telemetry.items
    .filter((item) => typeof item.metrics.lossPct === "number")
    .sort((a, b) => (b.metrics.lossPct || 0) - (a.metrics.lossPct || 0))
    .slice(0, 6)
    .map((item) => ({
      label: item.unit.code,
      value: item.metrics.lossPct || 0,
      tone: metricTone(item.metrics.lossPct, 1, 3),
      meta: item.unit.name,
      href: `/unidades/${item.unit.id}`,
    }));
  const sensorBars = [
    { label: "Ping", value: telemetry.items.filter((item) => item.metrics.ping).length, tone: "success" },
    { label: "Latência", value: withLatency, tone: "info" },
    { label: "Perda", value: withLoss, tone: "attention" },
    { label: "Temperatura", value: withTemperature, tone: "critical" },
  ];

  return (
    <AppShell title="Relatórios / Performance" subtitle="Comparativo de tráfego, latência, perda e saúde por unidade.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-4">
            <StatCard label="Latência média" value={avgLabel(telemetry.counts.avgLatencyMs, " ms")} detail={`${withLatency} unidade(s) com leitura`} tone="info" />
            <StatCard label="Perda média" value={avgLabel(telemetry.counts.avgLossPct, "%")} detail={`${withLoss} unidade(s) com leitura`} tone={(telemetry.counts.avgLossPct ?? 0) >= 1 ? "attention" : "success"} />
            <StatCard label="Problemas" value={telemetry.counts.withProblems} detail="eventos ativos no Zabbix" tone={telemetry.counts.withProblems ? "critical" : "success"} />
            <StatCard label="Temperatura máx." value={avgLabel(telemetry.counts.maxTemperatureC, " C")} detail="ativos com sensor" tone={(telemetry.counts.maxTemperatureC ?? 0) >= 50 ? "attention" : "neutral"} />
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            <ChartCard title="Latência" subtitle="maiores leituras por unidade" tone="info">
              <BarList data={latencyBars} emptyLabel="Nenhuma leitura de latência disponível." valueFormatter={(value) => formatMs(value)} />
            </ChartCard>
            <ChartCard title="Perda de pacote" subtitle="maiores leituras por unidade" tone="attention">
              <BarList data={lossBars} emptyLabel="Nenhuma leitura de perda disponível." valueFormatter={(value) => formatPercent(value)} />
            </ChartCard>
            <ChartCard title="Cobertura de sensores" subtitle="itens encontrados nos hosts vinculados" tone="success">
              <BarList data={sensorBars} max={Math.max(1, telemetry.counts.units)} emptyLabel="Nenhum sensor vinculado." />
            </ChartCard>
          </div>

          <Surface>
            <div className="nova-side-grid nova-side-grid--300">
              <div>
                <div className="nds-label">Operação</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Validação de performance</h2>
                <div className="nova-performance-upload mt-2">
                  <div className="text-[22px] font-black text-[var(--nova-primary)]">↑</div>
                  <div className="mt-2 text-[12px] font-black text-white">Arraste e solte o arquivo aqui</div>
                  <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">CSV/XLSX com medições de tráfego, latência e perda.</div>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="nds-card flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--nova-text-muted)]">Latência validada</span>
                  <TonePill tone={withLatency ? "success" : "attention"}>{withLatency}</TonePill>
                </div>
                <div className="nds-card flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--nova-text-muted)]">Perda validada</span>
                  <TonePill tone={withLoss ? "success" : "attention"}>{withLoss}</TonePill>
                </div>
                <div className="nds-card flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--nova-text-muted)]">Sensores térmicos</span>
                  <TonePill tone={withTemperature ? "info" : "neutral"}>{withTemperature}</TonePill>
                </div>
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Performance</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Ranking técnico</h2>
              </div>
              <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">Gerar relatório</Link>
            </div>
            <div className="mt-2">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Latência</th><th className="px-3 py-2">Perda</th><th className="px-3 py-2">Problemas</th><th className="px-3 py-2">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{item.unit.name}</div><div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{item.unit.code}</div></TableCell>
                        <TableCell className="text-slate-300">{item.partner.name}</TableCell>
                        <TableCell className="text-slate-300">{formatMs(item.metrics.latencyMs)}</TableCell>
                        <TableCell className="text-slate-300">{formatPercent(item.metrics.lossPct)}</TableCell>
                        <TableCell className="text-slate-300">{item.problems.length}</TableCell>
                        <TableCell><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill></TableCell>
                        <TableActionCell><TableActionLink href={`/unidades/${item.unit.id}`}>Abrir</TableActionLink></TableActionCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>
        </div>

        <RightPanel title="Leitura técnica" description="Critérios usados na performance.">
          <div className="nds-card text-[11px] leading-5 text-slate-400">
            Latência e perda vêm dos itens do host Zabbix vinculado à unidade. Tráfego entra no relatório final quando existir item SNMP de entrada e saída.
          </div>
          <div className="grid gap-2">
            <TonePill tone="success">ideal: perda menor que 1%</TonePill>
            <TonePill tone="attention">atenção: latência acima de 50 ms</TonePill>
            <TonePill tone="critical">crítico: offline ou evento ativo</TonePill>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
