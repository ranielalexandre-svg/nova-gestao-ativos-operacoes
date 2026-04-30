import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartCard, DenseTable, ReportPreviewCard, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { safeApiJson } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type ReportUnit = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportContractLabel: string | null;
  reportContractedBandwidth: string | null;
  partner: { id: string; code: string; name: string };
};

type ReportUnitsResponse = { total: number; items: ReportUnit[] };

type ReportTemplate = {
  id: string;
  code: string;
  name: string;
  periodPreset: string;
  outputFormat: string;
  includeCharts: boolean;
  enabled: boolean;
  unitIds: string[];
  groupIds: string[];
  integration: { code: string; name: string } | null;
  automations: Array<{ id: string; cadence: string; enabled: boolean; lastRunAt: string | null; nextRunAt: string | null }>;
};

type ReportRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  attachments: Array<{ id: string; name: string; url: string; mimeType: string; size: number; createdAt: string }>;
  rule: { code: string; name: string; cadence: string; reportTemplate: { id: string; code: string; name: string } | null };
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status: string) {
  if (["success", "completed", "done"].includes(status)) return "success";
  if (["failed", "error"].includes(status)) return "critical";
  if (["running", "queued"].includes(status)) return "attention";
  return "neutral";
}

export default async function RelatoriosPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios");

  const [units, templates, runs] = await Promise.all([
    safeApiJson<ReportUnitsResponse>("/monitoring/reports/units", { total: 0, items: [] }),
    safeApiJson<ReportTemplate[]>("/monitoring/report-templates", []),
    safeApiJson<ReportRun[]>("/monitoring/report-template-runs", []),
  ]);

  const enabledTemplates = templates.filter((item) => item.enabled).length;
  const withCharts = templates.filter((item) => item.includeCharts).length;
  const lastRun = runs[0] || null;

  return (
    <AppShell title="Relatórios / Consumo" subtitle="Biblioteca de relatórios, filtros rápidos e exportações de consumo por unidade ou grupo.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Unidades" value={units.total} detail="aptas para exportação" tone="info" />
            <StatCard label="Modelos" value={templates.length} detail={`${enabledTemplates} ativo(s)`} tone="attention" />
            <StatCard label="Com gráficos" value={withCharts} detail="incluem séries Zabbix" tone="success" />
            <StatCard label="Última geração" value={lastRun ? formatDate(lastRun.startedAt) : "-"} detail={lastRun?.status || "sem execução"} tone={lastRun ? statusTone(lastRun.status) : "neutral"} />
          </div>

          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Biblioteca</div>
                <h2 className="mt-2 text-xl font-black text-white">Modelos de relatório</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/relatorios/monitoramento" className="nova-primary-action rounded-[10px] px-4 py-2.5 text-sm font-black">Novo relatório</Link>
                <Link href="/relatorios/monitoramento?tab=templates" className="rounded-[10px] border border-white/10 bg-[#070b10] px-4 py-2.5 text-sm font-bold text-white hover:border-orange-300/30">Automações</Link>
              </div>
            </div>
            <div className="mt-5">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Formato</th><th className="px-4 py-3">Escopo</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {templates.length ? templates.map((template) => (
                      <tr key={template.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{template.name}</div><div className="mt-1 text-xs text-slate-500">{template.code}</div></TableCell>
                        <TableCell className="text-slate-300">{template.integration?.name || "manual"}</TableCell>
                        <TableCell className="text-slate-300">{template.periodPreset}</TableCell>
                        <TableCell><TonePill tone="info">{template.outputFormat}</TonePill></TableCell>
                        <TableCell className="text-slate-300">{template.unitIds.length || template.groupIds.length || "manual"}</TableCell>
                        <TableCell><TonePill tone={template.enabled ? "success" : "subtle"}>{template.enabled ? "ativo" : "pausado"}</TonePill></TableCell>
                        <TableActionCell><TableActionLink href={`/relatorios/monitoramento?templateId=${template.id}`}>Abrir</TableActionLink></TableActionCell>
                      </tr>
                    )) : (
                      <tr><TableCell colSpan={7} className="text-slate-500">Nenhum modelo salvo. Gere o primeiro em Monitoramento.</TableCell></tr>
                    )}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Consumo por período" subtitle="prévia visual do relatório de consumo" tone="success" />
            <Surface className="p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Unidades recentes</div>
              <h2 className="mt-2 text-xl font-black text-white">Prontas para exportar</h2>
              <div className="mt-4 grid gap-2">
                {units.items.slice(0, 8).map((unit) => (
                  <Link key={unit.id} href={`/relatorios/monitoramento?unitId=${unit.id}`} className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-3 text-sm hover:border-orange-300/30">
                    <div className="font-bold text-white">{unit.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{unit.partner.name} · {[unit.city, unit.state].filter(Boolean).join("/") || "sem cidade"} · {unit.reportContractedBandwidth || "banda não informada"}</div>
                  </Link>
                ))}
              </div>
            </Surface>
          </div>
        </div>

        <RightPanel title="Exportação" description="Resumo da próxima saída.">
          <ReportPreviewCard title="Relatório de Consumo" format="PDF/DOCX" includeCharts units={Math.min(units.total, 12)} />
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4">
            <div className="text-sm font-black text-white">Últimos arquivos</div>
            <div className="mt-3 grid gap-2">
              {runs.slice(0, 4).map((run) => (
                <div key={run.id} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{run.rule.reportTemplate?.name || run.rule.name}</span><TonePill tone={statusTone(run.status)}>{run.status}</TonePill></div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(run.startedAt)}</div>
                  {run.attachments[0] ? <a href={run.attachments[0].url} className="mt-2 inline-flex text-xs font-bold text-orange-200 hover:text-orange-100">Baixar arquivo</a> : null}
                </div>
              ))}
              {!runs.length ? <div className="text-sm text-slate-500">Nenhuma exportação encontrada.</div> : null}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
