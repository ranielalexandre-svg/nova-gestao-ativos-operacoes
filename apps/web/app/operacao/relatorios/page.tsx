import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { formatShortDateTime } from "@/lib/formatters";
import { safeApiJson } from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

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
  automations: Array<{
    id: string;
    cadence: string;
    enabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
  }>;
};

type ReportRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
  rule: {
    code: string;
    name: string;
    cadence: string;
    reportTemplate: { id: string; code: string; name: string } | null;
  };
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function statusTone(status: string): Tone {
  if (["success", "completed", "done"].includes(status)) return "green";
  if (["failed", "error"].includes(status)) return "red";
  if (["running", "queued"].includes(status)) return "orange";
  return "slate";
}

function templateScope(template: ReportTemplate) {
  const total = template.unitIds.length + template.groupIds.length;

  if (total) return String(total);
  return "manual";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-reports-hub-badge is-${tone}`}>{children}</span>;
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-reports-hub-stat is-${tone}`}>
      <i />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Panel({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nova-reports-hub-panel ${className}`}>
      <div className="nova-reports-hub-panel-head">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="nova-reports-hub-panel-body">{children}</div>
    </section>
  );
}

function ProgressLine({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: Tone;
}) {
  const current = percent(value, total);

  return (
    <div className="nova-reports-hub-progress">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${current}%` }} />
      </i>
    </div>
  );
}

function ReportShortcut({
  title,
  description,
  href,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  tone: Tone;
}) {
  return (
    <Link href={href} className={`nova-reports-hub-shortcut is-${tone}`}>
      <span>{title}</span>
      <p>{description}</p>
      <strong>Abrir</strong>
    </Link>
  );
}

function RunStatusItem({ run }: { run: ReportRun }) {
  const attachment = run.attachments[0];

  return (
    <article className="nova-reports-hub-run">
      <div>
        <strong>{run.rule.reportTemplate?.name || run.rule.name}</strong>
        <span>{formatShortDateTime(run.startedAt)} · {run.status}</span>
      </div>
      <div>
        <Badge tone={statusTone(run.status)}>{run.status}</Badge>
        {attachment ? <a href={attachment.url}>Baixar</a> : null}
      </div>
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="nova-reports-hub-empty">
      <b>N</b>
      <span>{children}</span>
    </div>
  );
}

export default async function RelatoriosPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/operacao/relatorios");
  }

  const [units, templates, runs] = await Promise.all([
    safeApiJson<ReportUnitsResponse>("/monitoring/reports/units", { total: 0, items: [] }),
    safeApiJson<ReportTemplate[]>("/monitoring/report-templates", []),
    safeApiJson<ReportRun[]>("/monitoring/report-template-runs", []),
  ]);

  const enabledTemplates = templates.filter((item) => item.enabled).length;
  const withCharts = templates.filter((item) => item.includeCharts).length;
  const lastRun = runs[0] || null;
  const unitsWithContract = units.items.filter((unit) => hasText(unit.reportContractLabel)).length;
  const unitsWithBandwidth = units.items.filter((unit) => hasText(unit.reportContractedBandwidth)).length;
  const unitsWithAddress = units.items.filter((unit) => hasText(unit.reportAddressLine)).length;
  const readyUnits = units.items.filter(
    (unit) =>
      hasText(unit.reportContractLabel) &&
      hasText(unit.reportContractedBandwidth) &&
      hasText(unit.reportAddressLine),
  ).length;

  const runStatusMap = new Map<string, number>();

  for (const run of runs) {
    runStatusMap.set(run.status, (runStatusMap.get(run.status) || 0) + 1);
  }

  const successfulRuns = runs.filter((run) => statusTone(run.status) === "green").length;
  const failedRuns = runs.filter((run) => statusTone(run.status) === "red").length;

  return (
    <NovaLitShell activeHref="/operacao/relatorios">
      <main className="nova-reports-hub-page">
        <header className="nova-reports-hub-hero">
          <div>
            <span>Operação / Relatórios NOC</span>
            <h1>Relatórios NOC e exportações</h1>
            <p>Central de geração e acompanhamento de relatórios operacionais, com modelos, exportações e qualidade dos metadados.</p>
          </div>
          <div className="nova-reports-hub-actions">
            <Link href="/operacao/relatorios/monitoramento" className="nova-lit-button nova-lit-button-secondary">
              Abrir monitoramento
            </Link>
            <Link href="/operacao/relatorios/monitoramento?source=unit" className="nova-lit-button nova-lit-button-primary">
              Novo relatório
            </Link>
          </div>
        </header>

        <section className="nova-reports-hub-stats" aria-label="Indicadores de relatórios">
          <StatCard label="Unidades" value={units.total} hint="no catálogo de relatórios" tone="blue" />
          <StatCard label="Modelos" value={templates.length} hint={`${enabledTemplates} ativo(s)`} tone={enabledTemplates ? "green" : "slate"} />
          <StatCard label="Com gráficos" value={withCharts} hint="incluem séries Zabbix" tone={withCharts ? "green" : "slate"} />
          <StatCard label="Última geração" value={lastRun ? formatShortDateTime(lastRun.startedAt) : "-"} hint={lastRun?.status || "sem execução"} tone={lastRun ? statusTone(lastRun.status) : "slate"} />
          <StatCard label="Metadados completos" value={readyUnits} hint="prontas para exportar" tone={readyUnits ? "green" : "orange"} />
        </section>

        <section className="nova-reports-hub-layout">
          <div className="nova-reports-hub-main">
            <Panel
              eyebrow="Biblioteca"
              title="Modelos salvos"
              action={<Badge tone="blue">{templates.length} modelo(s)</Badge>}
            >
              {templates.length ? (
                <div className="nova-reports-hub-table">
                  <div className="nova-reports-hub-table-head">
                    <span>Modelo</span>
                    <span>Origem</span>
                    <span>Período</span>
                    <span>Formato</span>
                    <span>Escopo</span>
                    <span>Status</span>
                    <span>Ações</span>
                  </div>
                  {templates.map((template) => (
                    <div key={template.id} className="nova-reports-hub-row">
                      <div>
                        <strong>{template.name}</strong>
                        <small>{template.code}</small>
                      </div>
                      <div>{template.integration?.name || "manual"}</div>
                      <div>{template.periodPreset}</div>
                      <div><Badge tone="blue">{template.outputFormat}</Badge></div>
                      <div>{templateScope(template)}</div>
                      <div><Badge tone={template.enabled ? "green" : "slate"}>{template.enabled ? "ativo" : "pausado"}</Badge></div>
                      <div>
                        <Link href={`/operacao/relatorios/monitoramento?templateId=${template.id}`}>Abrir</Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhum modelo salvo. Gere o primeiro relatório na central de monitoramento.</EmptyState>
              )}
            </Panel>

            <Panel
              eyebrow="Rotas"
              title="Tipos de relatório"
              action={<Badge tone="green">4 áreas</Badge>}
            >
              <div className="nova-reports-hub-shortcut-grid">
                <ReportShortcut
                  title="Monitoramento"
                  description="Monte DOCX por unidade, grupo Zabbix ou modelo salvo."
                  href="/operacao/relatorios/monitoramento"
                  tone="green"
                />
                <ReportShortcut
                  title="Consumo"
                  description="Acompanhe modelos, exportações e cobertura de metadados."
                  href="/operacao/relatorios/consumo"
                  tone="blue"
                />
                <ReportShortcut
                  title="Disponibilidade"
                  description="Veja disponibilidade, vínculo Zabbix e unidades que exigem atenção."
                  href="/operacao/relatorios/disponibilidade"
                  tone="orange"
                />
                <ReportShortcut
                  title="Performance"
                  description="Compare latência, perda, temperatura e saúde técnica por unidade."
                  href="/operacao/relatorios/performance"
                  tone="slate"
                />
              </div>
            </Panel>

            <section className="nova-reports-hub-split">
              <Panel
                eyebrow="Catálogo"
                title="Unidades prontas para exportar"
                action={<Badge tone="green">{readyUnits} prontas</Badge>}
              >
                <div className="nova-reports-hub-unit-list">
                  {units.items.slice(0, 8).map((unit) => (
                    <Link key={unit.id} href={`/operacao/relatorios/monitoramento?unitId=${unit.id}`}>
                      <span>
                        <strong>{unit.name}</strong>
                        <small>{unit.partner.name} · {[unit.city, unit.state].filter(Boolean).join("/") || "sem cidade"}</small>
                      </span>
                      <b>{unit.reportContractedBandwidth || "sem banda"}</b>
                    </Link>
                  ))}
                  {!units.items.length ? <EmptyState>Nenhuma unidade retornada para exportação.</EmptyState> : null}
                </div>
              </Panel>

              <Panel
                eyebrow="Metadados"
                title="Qualidade dos metadados"
                action={<Badge tone={readyUnits === units.total && units.total ? "green" : "orange"}>{percent(readyUnits, units.total)}%</Badge>}
              >
                <div className="nova-reports-hub-progress-list">
                  <ProgressLine label="Contrato" value={unitsWithContract} total={Math.max(units.total, 1)} tone="green" />
                  <ProgressLine label="Banda" value={unitsWithBandwidth} total={Math.max(units.total, 1)} tone="blue" />
                  <ProgressLine label="Endereço" value={unitsWithAddress} total={Math.max(units.total, 1)} tone="orange" />
                  <ProgressLine label="Completo" value={readyUnits} total={Math.max(units.total, 1)} tone="green" />
                </div>
              </Panel>
            </section>
          </div>

          <aside className="nova-reports-hub-side">
            <Panel eyebrow="Exportação" title="Próxima exportação">
              <div className="nova-reports-hub-preview">
                <div>
                  <b>NOVA</b>
                  <i />
                  <span>Relatório</span>
                  <strong>MONITORAMENTO</strong>
                  <p>Unidade, contrato, sensores e séries Zabbix para acompanhamento operacional.</p>
                </div>
              </div>
              <Link href="/operacao/relatorios/monitoramento" className="nova-reports-hub-primary-action">
                Gerar relatório
              </Link>
            </Panel>

            <Panel eyebrow="Histórico" title="Últimas exportações" action={<Badge tone={failedRuns ? "orange" : "blue"}>{runs.length}</Badge>}>
              <div className="nova-reports-hub-run-list">
                {runs.slice(0, 6).map((run) => (
                  <RunStatusItem key={run.id} run={run} />
                ))}
                {!runs.length ? <EmptyState>Nenhuma execução registrada.</EmptyState> : null}
              </div>
            </Panel>

            <Panel eyebrow="Qualidade" title="Saúde da base">
              <div className="nova-reports-hub-progress-list">
                <ProgressLine label="Prontos" value={readyUnits} total={Math.max(units.total, 1)} tone="green" />
                <ProgressLine label="Com erro" value={failedRuns} total={Math.max(runs.length, 1)} tone="red" />
                <ProgressLine label="Sucesso" value={successfulRuns} total={Math.max(runs.length, 1)} tone="blue" />
                <ProgressLine label="Templates" value={templates.length} total={Math.max(templates.length, 1)} tone="orange" />
              </div>
            </Panel>

            <Panel eyebrow="Ação rápida" title="Atalhos de geração">
              <div className="nova-reports-hub-quick">
                <Link href="/operacao/relatorios/monitoramento"><span>Gerar agora</span><b>novo</b></Link>
                <Link href="/operacao/relatorios/monitoramento?source=unit"><span>Por unidade</span><b>{units.total}</b></Link>
                <Link href="/operacao/relatorios/monitoramento?source=template"><span>Por modelo</span><b>{templates.length}</b></Link>
              </div>
            </Panel>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
