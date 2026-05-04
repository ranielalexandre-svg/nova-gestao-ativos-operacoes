import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarList, ChartCard, DenseTable, ReportPreviewCard, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { formatShortDateTime } from "@/lib/formatters";
import { safeApiJson } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type ReportUnit = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportContractLabel: string | null;
  reportAddressLine: string | null;
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

function statusTone(status: string) {
  if (["success", "completed", "done"].includes(status)) return "success";
  if (["failed", "error"].includes(status)) return "critical";
  if (["running", "queued"].includes(status)) return "attention";
  return "neutral";
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
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
  const metadataBars = [
    { label: "Contrato", value: units.items.filter((unit) => hasText(unit.reportContractLabel)).length, tone: "info" },
    { label: "Banda", value: units.items.filter((unit) => hasText(unit.reportContractedBandwidth)).length, tone: "success" },
    { label: "Endereço", value: units.items.filter((unit) => hasText(unit.reportAddressLine)).length, tone: "attention" },
  ];
  const runStatusMap = new Map<string, number>();

  for (const run of runs) {
    runStatusMap.set(run.status, (runStatusMap.get(run.status) || 0) + 1);
  }

  const runStatusBars = Array.from(runStatusMap.entries()).map(([status, value]) => ({
    label: status,
    value,
    tone: statusTone(status),
  }));

  return (
    <AppShell title="Relatórios / Consumo" subtitle="Biblioteca de relatórios, filtros rápidos e exportações de consumo por unidade ou grupo.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-4">
            <StatCard label="Unidades" value={units.total} detail="aptas para exportação" tone="info" />
            <StatCard label="Modelos" value={templates.length} detail={`${enabledTemplates} ativo(s)`} tone="attention" />
            <StatCard label="Com gráficos" value={withCharts} detail="incluem séries Zabbix" tone="success" />
            <StatCard label="Última geração" value={lastRun ? formatShortDateTime(lastRun.startedAt) : "-"} detail={lastRun?.status || "sem execução"} tone={lastRun ? statusTone(lastRun.status) : "neutral"} />
          </div>

          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Biblioteca</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Modelos de relatório</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/relatorios/monitoramento" className="nds-button" data-variant="primary">Novo relatório</Link>
                <Link href="/relatorios/monitoramento?source=template" className="nds-button" data-variant="secondary">Usar modelo</Link>
              </div>
            </div>
            <div className="mt-2">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-3 py-2">Modelo</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Período</th><th className="px-3 py-2">Formato</th><th className="px-3 py-2">Escopo</th><th className="px-3 py-2">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {templates.length ? templates.map((template) => (
                      <tr key={template.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{template.name}</div><div className="mt-1 text-[10px] text-slate-500">{template.code}</div></TableCell>
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

          <div className="grid gap-2 lg:grid-cols-2">
            <ChartCard title="Cobertura do relatório" subtitle="campos preenchidos nas unidades ativas" tone={metadataBars.every((item) => item.value === units.total) ? "success" : "attention"}>
              <BarList data={metadataBars} max={Math.max(1, units.total)} emptyLabel="Nenhuma unidade ativa para exportação." />
            </ChartCard>
            <Surface>
              <div className="nds-label">Unidades recentes</div>
              <h2 className="mt-1 text-[15px] font-black text-white">Prontas para exportar</h2>
              <div className="mt-2 grid gap-2">
                {units.items.slice(0, 8).map((unit) => (
                  <Link key={unit.id} href={`/relatorios/monitoramento?unitId=${unit.id}`} className="nds-card block text-[11px] hover:border-[var(--nova-primary)]/30">
                    <div className="font-bold text-white">{unit.name}</div>
                    <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{unit.partner.name} · {[unit.city, unit.state].filter(Boolean).join("/") || "sem cidade"} · {unit.reportContractedBandwidth || "banda não informada"}</div>
                  </Link>
                ))}
              </div>
            </Surface>
          </div>
        </div>

        <RightPanel title="Exportação" description="Resumo da próxima saída.">
          <ReportPreviewCard title="Relatório de Consumo" format="PDF/DOCX" includeCharts units={Math.min(units.total, 12)} />
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Execuções por status</div>
            <div className="mt-2">
              <BarList data={runStatusBars} emptyLabel="Nenhuma execução registrada." />
            </div>
          </div>
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Últimos arquivos</div>
            <div className="mt-2 grid gap-2">
              {runs.slice(0, 4).map((run) => (
                <div key={run.id} className="nds-card text-[11px]">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold text-white">{run.rule.reportTemplate?.name || run.rule.name}</span><TonePill tone={statusTone(run.status)}>{run.status}</TonePill></div>
                  <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{formatShortDateTime(run.startedAt)}</div>
                  {run.attachments[0] ? <a href={run.attachments[0].url} className="nds-button mt-2" data-variant="secondary">Baixar arquivo</a> : null}
                </div>
              ))}
              {!runs.length ? <div className="text-[11px] text-slate-500">Nenhuma exportação encontrada.</div> : null}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
