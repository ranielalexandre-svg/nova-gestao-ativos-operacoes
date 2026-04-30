import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartCard, DenseTable, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
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
  const risky = telemetry.items.filter((item) => item.health !== "online").slice(0, 12);

  return (
    <AppShell title="Relatórios / Disponibilidade" subtitle="SLA por unidade, vínculo Zabbix e indisponibilidade operacional.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="SLA estimado" value={`${availability.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} detail="baseado em hosts online/offline" tone={availability >= 99 ? "success" : availability >= 95 ? "attention" : "critical"} />
            <StatCard label="Cobertura" value={`${coverage}%`} detail="unidades com host confiável" tone={coverage >= 90 ? "success" : "attention"} />
            <StatCard label="Offline" value={telemetry.counts.down} detail="unidades indisponíveis" tone={telemetry.counts.down ? "critical" : "success"} />
            <StatCard label="Atenção" value={telemetry.counts.degraded + telemetry.counts.ambiguous} detail="degradado ou ambíguo" tone="attention" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="SLA consolidado" subtitle="Curva visual para o relatório final" tone="success" />
            <ChartCard title="Indisponibilidade por período" subtitle="Janelas críticas e eventos de queda" tone={telemetry.counts.down ? "critical" : "info"} />
          </div>

          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">SLA por unidade</div>
                <h2 className="mt-2 text-xl font-black text-white">Disponibilidade operacional</h2>
              </div>
              <Link href="/relatorios/monitoramento" className="nova-primary-action rounded-[10px] px-4 py-2.5 text-sm font-black">Gerar relatório</Link>
            </div>
            <div className="mt-5">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Host</th><th className="px-4 py-3">Latência</th><th className="px-4 py-3">Perda</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {telemetry.items.slice(0, 20).map((item) => (
                      <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{item.unit.name}</div><div className="mt-1 text-xs text-slate-500">{item.unit.code}</div></TableCell>
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
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm text-slate-400">
            <div className="flex justify-between gap-3"><span>Unidades avaliadas</span><span className="font-bold text-white">{telemetry.counts.units}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span>Com host vinculado</span><span className="font-bold text-white">{telemetry.counts.matched}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span>Com problema</span><span className="font-bold text-white">{telemetry.counts.withProblems}</span></div>
          </div>
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4">
            <div className="text-sm font-black text-white">Fila de atenção</div>
            <div className="mt-3 grid gap-2">
              {risky.length ? risky.map((item) => (
                <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 text-sm hover:border-orange-300/30">
                  <div className="font-bold text-white">{item.unit.name}</div>
                  <div className="mt-2"><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill></div>
                </Link>
              )) : <div className="text-sm text-slate-500">Nenhuma unidade fora da normalidade.</div>}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
