import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  BarList,
  DenseTable,
  RightPanel,
  StatCard,
  StackedMeter,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  emptyCommandCenter,
  formatMs,
  formatPercent,
  operationPressure,
  readUnitHostTelemetry,
  safeApiJson,
  targetLabel,
  telemetryCoveragePct,
  type CommandCenter,
} from "@/lib/noc-overview";
import { formatShortDateTime } from "@/lib/formatters";
import { occurrenceSeverityTone as severityTone } from "@/lib/status-ui";
import { getServerWebSession } from "@/lib/web-session";

function statusTone(value: string) {
  if (["resolved", "done", "completed"].includes(value)) return "success";
  if (["acknowledged", "in_progress"].includes(value)) return "info";
  if (["open", "planned"].includes(value)) return "attention";
  return "neutral";
}

export default async function DashboardPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/dashboard");
  }

  const [commandCenter, telemetry] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry({ timeoutMs: 1200 }),
  ]);
  const attentionUnits = telemetry.counts.degraded + telemetry.counts.ambiguous;
  const pressure = operationPressure(commandCenter, telemetry);
  const healthSegments = [
    { label: "online", value: telemetry.counts.online, tone: "success" },
    { label: "atenção", value: attentionUnits, tone: "attention" },
    { label: "offline", value: telemetry.counts.down, tone: "critical" },
    { label: "sem vínculo", value: telemetry.counts.unmapped, tone: "subtle" },
  ];
  const severityBars = commandCenter.buckets.occurrenceBySeverity.map((bucket) => ({
    label: bucket.key,
    value: bucket.count,
    tone: severityTone(bucket.key),
    href: `/alertas?severity=${encodeURIComponent(bucket.key)}`,
  }));
  const maintenanceBars = commandCenter.buckets.maintenanceByStatus.map((bucket) => ({
    label: bucket.key,
    value: bucket.count,
    tone: statusTone(bucket.key),
    href: `/chamados?status=${encodeURIComponent(bucket.key)}`,
  }));

  return (
    <AppShell title="Visão geral" subtitle="Resumo operacional no padrão NOVA Telecom.">
      <section className="nova-dashboard-live grid gap-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Unidades online"
            value={`${telemetry.counts.online}/${telemetry.counts.units}`}
            detail={`cobertura ${telemetryCoveragePct(telemetry)}%`}
            tone={telemetry.counts.down ? "critical" : attentionUnits ? "attention" : "success"}
          />
          <StatCard
            label="Críticas"
            value={commandCenter.metrics.criticalOpenOccurrences}
            detail="prioridade máxima"
            tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "success"}
          />
          <StatCard
            label="Chamados vencidos"
            value={commandCenter.metrics.overdueMaintenances}
            detail="fora do prazo"
            tone={commandCenter.metrics.overdueMaintenances ? "attention" : "success"}
          />
          <StatCard
            label="Pressão operacional"
            value={pressure}
            detail="índice do turno"
            tone={pressure >= 10 ? "critical" : pressure >= 4 ? "attention" : "success"}
          />
        </div>

        <div className="nova-side-grid nova-side-grid--320">
          <div className="grid gap-2">
            <div className="grid gap-2 lg:grid-cols-3">
              <Surface className="p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-black text-white">Saúde da rede</h3>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--nova-text-muted)]">
                      perda {formatPercent(telemetry.counts.avgLossPct)} · latência {formatMs(telemetry.counts.avgLatencyMs)}
                    </p>
                  </div>
                  <TonePill tone={telemetry.counts.down ? "critical" : attentionUnits ? "attention" : "success"}>{telemetry.counts.units}</TonePill>
                </div>
                <div className="mt-2">
                  <StackedMeter segments={healthSegments} total={telemetry.counts.units} emptyLabel="Sem telemetria carregada." />
                </div>
              </Surface>
              <Surface className="p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-black text-white">Backlog</h3>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--nova-text-muted)]">alertas abertos por severidade</p>
                  </div>
                  <TonePill tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : commandCenter.metrics.openOccurrences ? "attention" : "success"}>
                    {commandCenter.metrics.openOccurrences}
                  </TonePill>
                </div>
                <div className="mt-2">
                  <BarList data={severityBars} emptyLabel="Nenhum alerta aberto." />
                </div>
              </Surface>
              <Surface className="p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-black text-white">Chamados</h3>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--nova-text-muted)]">status dos chamados técnicos</p>
                  </div>
                  <TonePill tone={commandCenter.metrics.overdueMaintenances ? "attention" : "info"}>
                    {commandCenter.metrics.dueTodayMaintenances} hoje
                  </TonePill>
                </div>
                <div className="mt-2">
                  <BarList data={maintenanceBars} emptyLabel="Nenhum chamado cadastrado." />
                </div>
              </Surface>
            </div>

            <Surface>
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
                <div>
                  <div className="nds-label">Eventos recentes</div>
                  <h2 className="mt-1 text-[15px] font-black text-white">Alertas</h2>
                </div>
                <Link href="/alertas" className="nds-button" data-variant="primary">Abrir alertas</Link>
              </div>
              <div className="mt-2">
                <TableShell>
                  <DenseTable>
                    <TableHead>
                      <tr>
                        <th className="px-3 py-2">Caso</th>
                        <th className="px-3 py-2">Alvo</th>
                        <th className="px-3 py-2">Severidade</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Criado</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {commandCenter.recentOccurrences.slice(0, 6).map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.025]">
                          <TableCell>
                            <Link href={`/alertas/${item.id}`} className="font-bold text-white hover:text-white">{item.code}</Link>
                            <div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">{item.title}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{targetLabel(item)}</TableCell>
                          <TableCell><TonePill tone={severityTone(item.severity)}>{item.severity}</TonePill></TableCell>
                          <TableCell><TonePill tone={statusTone(item.status)}>{item.status}</TonePill></TableCell>
                          <TableCell className="text-slate-400">{formatShortDateTime(item.createdAt)}</TableCell>
                        </tr>
                      ))}
                      {!commandCenter.recentOccurrences.length ? (
                        <tr><TableCell colSpan={5} className="text-slate-500">Nenhum alerta recente.</TableCell></tr>
                      ) : null}
                    </tbody>
                  </DenseTable>
                </TableShell>
              </div>
            </Surface>

            <Surface>
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
                <div>
                  <div className="nds-label">Rotina</div>
                  <h2 className="mt-1 text-[15px] font-black text-white">Chamados</h2>
                </div>
                <Link href="/chamados" className="nds-button" data-variant="secondary">Abrir chamados</Link>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {commandCenter.recentMaintenances.slice(0, 4).map((item) => (
                  <Link key={item.id} href={`/chamados/${item.id}`} className="nds-card block transition">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{item.code}</span>
                      <TonePill tone={statusTone(item.status)}>{item.status}</TonePill>
                    </div>
                    <div className="mt-2 truncate text-[10px] text-slate-400">{item.title}</div>
                    <div className="mt-2 text-[10px] text-slate-500">{formatShortDateTime(item.scheduledAt || item.createdAt)}</div>
                  </Link>
                ))}
                {!commandCenter.recentMaintenances.length ? <div className="text-[10px] text-slate-500">Nenhum chamado recente.</div> : null}
              </div>
            </Surface>
          </div>

          <RightPanel title="Atalhos" description="Ações principais do turno.">
            <Link href="/sensores" className="nds-card block text-[12px] font-bold text-white">Monitoramento</Link>
            <Link href="/unidades" className="nds-card block text-[12px] font-bold text-white">Unidades</Link>
            <Link href="/relatorios/monitoramento" className="nds-card block text-[12px] font-bold text-white">Gerar relatório</Link>
            <div className="nds-card">
              <div className="nds-label">Severidades</div>
              <div className="mt-2 grid gap-2">
                {commandCenter.buckets.occurrenceBySeverity.slice(0, 5).map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                    <span>{bucket.key}</span>
                    <TonePill tone={severityTone(bucket.key)}>{bucket.count}</TonePill>
                  </div>
                ))}
                {!commandCenter.buckets.occurrenceBySeverity.length ? <div className="text-[10px] text-slate-500">Sem buckets ativos.</div> : null}
              </div>
            </div>
          </RightPanel>
        </div>
      </section>
    </AppShell>
  );
}
