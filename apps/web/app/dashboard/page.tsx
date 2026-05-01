import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ChartCard,
  DenseTable,
  RightPanel,
  StatCard,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  emptyCommandCenter,
  safeApiJson,
  targetLabel,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

function severityTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "neutral";
}

function statusTone(value: string) {
  if (["resolved", "done", "completed"].includes(value)) return "success";
  if (["acknowledged", "in_progress"].includes(value)) return "info";
  if (["open", "planned"].includes(value)) return "attention";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/dashboard");
  }

  const commandCenter = await safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter());
  const pressure =
    commandCenter.metrics.openOccurrences +
    commandCenter.metrics.criticalOpenOccurrences * 2 +
    commandCenter.metrics.overdueMaintenances +
    commandCenter.metrics.dueTodayMaintenances;

  return (
    <AppShell title="Visão geral" subtitle="Resumo operacional no padrão NOVA Telecom.">
      <section className="nova-dashboard-mock grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ocorrências abertas"
            value={commandCenter.metrics.openOccurrences}
            detail="triagem e atendimento"
            tone={commandCenter.metrics.openOccurrences ? "attention" : "success"}
          />
          <StatCard
            label="Críticas"
            value={commandCenter.metrics.criticalOpenOccurrences}
            detail="prioridade máxima"
            tone={commandCenter.metrics.criticalOpenOccurrences ? "critical" : "success"}
          />
          <StatCard
            label="Manutenções vencidas"
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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-3">
              <ChartCard title="Saúde da rede" subtitle="tendência de disponibilidade" tone="success" />
              <ChartCard title="Backlog" subtitle="ocorrências por severidade" tone={pressure ? "attention" : "info"} />
              <ChartCard title="Tempo de resposta" subtitle="janela operacional" tone="info" />
            </div>

            <Surface>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-orange-300/80">Eventos recentes</div>
                  <h2 className="mt-1 text-[15px] font-black text-white">Ocorrências</h2>
                </div>
                <Link href="/ocorrencias" className="nova-primary-action px-3 py-1.5 text-[11px] font-black">Abrir alertas</Link>
              </div>
              <div className="mt-3">
                <TableShell>
                  <DenseTable>
                    <TableHead>
                      <tr>
                        <th className="px-4 py-3">Caso</th>
                        <th className="px-4 py-3">Alvo</th>
                        <th className="px-4 py-3">Severidade</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Criado</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {commandCenter.recentOccurrences.slice(0, 6).map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.025]">
                          <TableCell>
                            <Link href={`/ocorrencias/${item.id}`} className="font-bold text-white hover:text-orange-100">{item.code}</Link>
                            <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{item.title}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{targetLabel(item)}</TableCell>
                          <TableCell><TonePill tone={severityTone(item.severity)}>{item.severity}</TonePill></TableCell>
                          <TableCell><TonePill tone={statusTone(item.status)}>{item.status}</TonePill></TableCell>
                          <TableCell className="text-slate-400">{formatDate(item.createdAt)}</TableCell>
                        </tr>
                      ))}
                      {!commandCenter.recentOccurrences.length ? (
                        <tr><TableCell colSpan={5} className="text-slate-500">Nenhuma ocorrência recente.</TableCell></tr>
                      ) : null}
                    </tbody>
                  </DenseTable>
                </TableShell>
              </div>
            </Surface>

            <Surface>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-orange-300/80">Rotina</div>
                  <h2 className="mt-1 text-[15px] font-black text-white">Manutenções</h2>
                </div>
                <Link href="/manutencoes" className="rounded border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white hover:border-orange-300/30">Abrir chamados</Link>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {commandCenter.recentMaintenances.slice(0, 4).map((item) => (
                  <Link key={item.id} href={`/manutencoes/${item.id}`} className="rounded-md border border-white/[0.08] bg-[#07101a] p-3 hover:border-orange-300/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{item.code}</span>
                      <TonePill tone={statusTone(item.status)}>{item.status}</TonePill>
                    </div>
                    <div className="mt-2 truncate text-xs text-slate-400">{item.title}</div>
                    <div className="mt-2 text-[10px] text-slate-500">{formatDate(item.scheduledAt || item.createdAt)}</div>
                  </Link>
                ))}
                {!commandCenter.recentMaintenances.length ? <div className="text-xs text-slate-500">Nenhuma manutenção recente.</div> : null}
              </div>
            </Surface>
          </div>

          <RightPanel title="Atalhos" description="Ações principais do turno.">
            <Link href="/monitoramento" className="rounded-md border border-white/[0.08] bg-[#07101a] p-3 text-sm font-bold text-white hover:border-orange-300/30">Monitoramento</Link>
            <Link href="/unidades" className="rounded-md border border-white/[0.08] bg-[#07101a] p-3 text-sm font-bold text-white hover:border-orange-300/30">Unidades</Link>
            <Link href="/relatorios/monitoramento" className="rounded-md border border-orange-400/30 bg-orange-500/[0.12] p-3 text-sm font-bold text-orange-100 hover:bg-orange-500/[0.18]">Gerar relatório</Link>
            <div className="rounded-md border border-white/[0.08] bg-[#07101a] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">Severidades</div>
              <div className="mt-3 grid gap-2">
                {commandCenter.buckets.occurrenceBySeverity.slice(0, 5).map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-3 text-xs text-slate-300">
                    <span>{bucket.key}</span>
                    <TonePill tone={severityTone(bucket.key)}>{bucket.count}</TonePill>
                  </div>
                ))}
                {!commandCenter.buckets.occurrenceBySeverity.length ? <div className="text-xs text-slate-500">Sem buckets ativos.</div> : null}
              </div>
            </div>
          </RightPanel>
        </div>
      </section>
    </AppShell>
  );
}
