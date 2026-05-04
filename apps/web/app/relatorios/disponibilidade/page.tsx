import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarList, ChartCard, DenseTable, RightPanel, StackedMeter, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { formatMs, formatPercent, healthLabel, healthTone, readUnitHostTelemetry, telemetryCoveragePct } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

function availabilityPct(units: number, down: number) {
  if (!units) return 0;
  return Math.max(0, ((units - down) / units) * 100);
}

export default async function RelatorioDisponibilidadePage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios/disponibilidade");

  const telemetry = await readUnitHostTelemetry({ timeoutMs: 1500 });
  const availability = availabilityPct(telemetry.counts.units, telemetry.counts.down);
  const coverage = telemetryCoveragePct(telemetry);
  const attentionRows = telemetry.items.filter((item) => item.health !== "online").slice(0, 12);
  const attention = telemetry.counts.degraded + telemetry.counts.ambiguous;
  const healthSegments = [
    { label: "online", value: telemetry.counts.online, tone: "success" },
    { label: "atenção", value: attention, tone: "attention" },
    { label: "offline", value: telemetry.counts.down, tone: "critical" },
    { label: "sem vínculo", value: telemetry.counts.unmapped, tone: "subtle" },
  ];
  const interruptionBars = [
    { label: "Offline", value: telemetry.counts.down, tone: "critical", href: "/sensores?health=down" },
    { label: "Degradado", value: telemetry.counts.degraded, tone: "attention", href: "/sensores?health=degraded" },
    { label: "Ambíguo", value: telemetry.counts.ambiguous, tone: "attention", href: "/sensores?health=ambiguous" },
    { label: "Sem vínculo", value: telemetry.counts.unmapped, tone: "subtle", href: "/sensores?health=unmapped" },
  ];

  return (
    <AppShell title="Relatórios / Disponibilidade" subtitle="SLA por unidade, vínculo Zabbix e indisponibilidade operacional.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-4">
            <StatCard label="SLA estimado" value={`${availability.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} detail="baseado em hosts online/offline" tone={availability >= 99 ? "success" : availability >= 95 ? "attention" : "critical"} />
            <StatCard label="Cobertura" value={`${coverage}%`} detail="unidades com host confiável" tone={coverage >= 90 ? "success" : "attention"} />
            <StatCard label="Offline" value={telemetry.counts.down} detail="unidades indisponíveis" tone={telemetry.counts.down ? "critical" : "success"} />
            <StatCard label="Atenção" value={telemetry.counts.degraded + telemetry.counts.ambiguous} detail="degradado ou ambíguo" tone="attention" />
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <ChartCard title="SLA consolidado" subtitle="estado atual das unidades monitoradas" tone={availability >= 99 ? "success" : availability >= 95 ? "attention" : "critical"}>
              <StackedMeter segments={healthSegments} total={telemetry.counts.units} emptyLabel="Sem telemetria carregada." />
            </ChartCard>
            <ChartCard title="Indisponibilidade" subtitle="unidades por condição de risco" tone={telemetry.counts.down ? "critical" : "info"}>
              <BarList data={interruptionBars} max={Math.max(1, telemetry.counts.units)} emptyLabel="Nenhuma unidade fora da normalidade." />
            </ChartCard>
          </div>

          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">SLA por unidade</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Disponibilidade operacional</h2>
              </div>
              <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">Gerar relatório</Link>
            </div>
            <div className="mt-2">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Host</th><th className="px-3 py-2">Latência</th><th className="px-3 py-2">Perda</th><th className="px-3 py-2">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {telemetry.items.slice(0, 20).map((item) => (
                      <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{item.unit.name}</div><div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{item.unit.code}</div></TableCell>
                        <TableCell className="text-slate-300">{item.partner.name}</TableCell>
                        <TableCell className="text-slate-300">{item.match.hostName || item.match.host || "sem host"}</TableCell>
                        <TableCell className="text-slate-300">{formatMs(item.metrics.latencyMs)}</TableCell>
                        <TableCell className="text-slate-300">{formatPercent(item.metrics.lossPct)}</TableCell>
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

        <RightPanel title="Resumo SLA" description="Pontos que entram no relatório.">
          <div className="nds-card text-[11px] text-slate-400">
            <div className="flex justify-between gap-2"><span>Unidades avaliadas</span><span className="font-bold text-white">{telemetry.counts.units}</span></div>
            <div className="mt-2 flex justify-between gap-2"><span>Com host vinculado</span><span className="font-bold text-white">{telemetry.counts.matched}</span></div>
            <div className="mt-2 flex justify-between gap-2"><span>Com problema</span><span className="font-bold text-white">{telemetry.counts.withProblems}</span></div>
          </div>
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Fila de atenção</div>
            <div className="mt-2 grid gap-2">
              {attentionRows.length ? attentionRows.map((item) => (
                <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="nds-card block text-[11px] hover:border-[var(--nova-primary)]/30">
                  <div className="font-bold text-white">{item.unit.name}</div>
                  <div className="mt-2"><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill></div>
                </Link>
              )) : <div className="text-[11px] text-slate-500">Nenhuma unidade fora da normalidade.</div>}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
