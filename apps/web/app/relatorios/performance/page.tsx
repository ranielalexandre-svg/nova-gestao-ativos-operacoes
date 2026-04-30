import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartCard, DenseTable, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { buildWatchlist, formatMs, formatPercent, healthLabel, healthTone, readUnitHostTelemetry } from "@/lib/noc-overview";
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

  return (
    <AppShell title="Relatórios / Performance" subtitle="Comparativo de tráfego, latência, perda e saúde por unidade.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Latência média" value={avgLabel(telemetry.counts.avgLatencyMs, " ms")} detail={`${withLatency} unidade(s) com leitura`} tone="info" />
            <StatCard label="Perda média" value={avgLabel(telemetry.counts.avgLossPct, "%")} detail={`${withLoss} unidade(s) com leitura`} tone={(telemetry.counts.avgLossPct ?? 0) >= 1 ? "attention" : "success"} />
            <StatCard label="Problemas" value={telemetry.counts.withProblems} detail="eventos ativos no Zabbix" tone={telemetry.counts.withProblems ? "critical" : "success"} />
            <StatCard label="Temperatura máx." value={avgLabel(telemetry.counts.maxTemperatureC, " C")} detail="equipamentos com sensor" tone={(telemetry.counts.maxTemperatureC ?? 0) >= 50 ? "attention" : "neutral"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <ChartCard title="Latência" subtitle="média e pico por janela" tone="info" />
            <ChartCard title="Perda de pacote" subtitle="consistência estatística" tone="attention" />
            <ChartCard title="Tráfego" subtitle="download/upload comparativo" tone="success" />
          </div>

          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Performance</div>
                <h2 className="mt-2 text-xl font-black text-white">Ranking técnico</h2>
              </div>
              <Link href="/relatorios/monitoramento" className="nova-primary-action rounded-[10px] px-4 py-2.5 text-sm font-black">Gerar relatório</Link>
            </div>
            <div className="mt-5">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Latência</th><th className="px-4 py-3">Perda</th><th className="px-4 py-3">Problemas</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{item.unit.name}</div><div className="mt-1 text-xs text-slate-500">{item.unit.code}</div></TableCell>
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
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm leading-6 text-slate-400">
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
