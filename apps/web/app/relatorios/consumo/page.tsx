import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
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

function statusLabel(status: string) {
  if (status === "success") return "Pronto";
  if (status === "error" || status === "failed") return "Erro";
  if (status === "running") return "Rodando";
  if (status === "queued") return "Fila";
  return status || "Sem status";
}

function periodLabel(value: string) {
  if (value === "today") return "Hoje";
  if (value === "last_7_days") return "7 dias";
  if (value === "current_month") return "Este mês";
  if (value === "last_month") return "Mês passado";
  return value?.replaceAll("_", " ") || "manual";
}

function cadenceLabel(value: string) {
  if (value === "manual") return "manual";
  if (value === "daily") return "diária";
  if (value === "weekly") return "semanal";
  if (value === "monthly") return "mensal";
  return value?.replaceAll("_", " ") || "-";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function cityLine(unit: ReportUnit) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "sem cidade/UF";
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className="nova-lit-card nova-consumo-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-consumo-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-consumo-progress">
      <div>
        <span>{label}</span>
        <b>{safe}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safe}%` }} />
      </i>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="nova-consumo-empty">
      <div>N</div>
      <strong>{label}</strong>
      <span>Gere um relatório em Monitoramento ou complete os metadados das unidades.</span>
    </div>
  );
}

export default async function RelatoriosConsumoPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/relatorios/consumo");

  const [units, templates, runs] = await Promise.all([
    safeApiJson<ReportUnitsResponse>("/monitoring/reports/units", { total: 0, items: [] }),
    safeApiJson<ReportTemplate[]>("/monitoring/report-templates", []),
    safeApiJson<ReportRun[]>("/monitoring/report-template-runs", []),
  ]);

  const unitsWithContract = units.items.filter((unit) => hasText(unit.reportContractLabel)).length;
  const unitsWithBandwidth = units.items.filter((unit) => hasText(unit.reportContractedBandwidth)).length;
  const unitsWithAddress = units.items.filter((unit) => hasText(unit.reportAddressLine)).length;
  const enabledTemplates = templates.filter((item) => item.enabled).length;
  const withCharts = templates.filter((item) => item.includeCharts).length;
  const automatedTemplates = templates.filter((item) => item.automations.some((automation) => automation.enabled)).length;
  const readyUnits = units.items.filter((unit) =>
    hasText(unit.reportContractLabel) &&
    hasText(unit.reportContractedBandwidth) &&
    hasText(unit.reportAddressLine),
  );
  const pendingUnits = units.items.filter((unit) =>
    !hasText(unit.reportContractLabel) ||
    !hasText(unit.reportContractedBandwidth) ||
    !hasText(unit.reportAddressLine),
  );
  const successfulRuns = runs.filter((run) => statusTone(run.status) === "green").length;
  const failedRuns = runs.filter((run) => statusTone(run.status) === "red").length;
  const lastRun = runs[0] || null;

  const kpis = [
    { label: "Unidades", value: String(units.total), hint: "aptas para exportação", tone: "blue" as const },
    { label: "Com banda", value: String(unitsWithBandwidth), hint: "banda contratada", tone: unitsWithBandwidth ? "green" as const : "orange" as const },
    { label: "Modelos", value: String(templates.length), hint: `${enabledTemplates} ativo(s)`, tone: templates.length ? "orange" as const : "slate" as const },
    { label: "Com gráficos", value: String(withCharts), hint: "séries Zabbix", tone: withCharts ? "green" as const : "slate" as const },
    { label: "Última geração", value: lastRun ? formatShortDateTime(lastRun.startedAt) : "-", hint: lastRun ? statusLabel(lastRun.status) : "sem execução", tone: lastRun ? statusTone(lastRun.status) : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/relatorios/consumo">
      <div className="nova-lit-page-heading nova-consumo-heading">
        <div>
          <h1>Relatórios / Consumo</h1>
          <p className="nova-lit-page-subtitle">Biblioteca de relatórios, consumo de banda, metadados e exportações por unidade ou grupo.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/relatorios/monitoramento?source=template" className="nova-lit-button nova-lit-button-secondary">Usar modelo</Link>
          <Link href="/relatorios/monitoramento" className="nova-lit-button nova-lit-button-primary">Novo relatório</Link>
        </div>
      </div>

      <section className="nova-consumo-kpi-grid" aria-label="Indicadores de consumo">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="nova-consumo-main-grid">
        <div className="nova-consumo-left-col">
          <section className="nova-lit-card nova-consumo-table-card">
            <div className="nova-consumo-section-title">
              <div>
                <span>Biblioteca</span>
                <h2>Modelos de relatório</h2>
              </div>
              <div>
                <small>{templates.length} modelos</small>
                <Link href="/relatorios/monitoramento?source=template">Abrir templates</Link>
              </div>
            </div>

            <div className="nova-consumo-table is-templates">
              <div className="nova-consumo-table-head">
                <span>Modelo</span>
                <span>Origem</span>
                <span>Período</span>
                <span>Formato</span>
                <span>Escopo</span>
                <span>Automação</span>
                <span>Status</span>
                <span>Ações</span>
              </div>

              {templates.length ? templates.map((template) => {
                const automation = template.automations[0] || null;
                const scope = template.unitIds.length || template.groupIds.length || 0;

                return (
                  <div className={`nova-consumo-row ${template.enabled ? "is-green" : "is-slate"}`} key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <small>{template.code}</small>
                    </div>
                    <div>
                      <b>{template.integration?.name || "manual"}</b>
                      <small>{template.integration?.code || "seleção manual"}</small>
                    </div>
                    <div>
                      <b>{periodLabel(template.periodPreset)}</b>
                      <small>{template.includeCharts ? "com gráficos" : "sem gráficos"}</small>
                    </div>
                    <div>
                      <Badge tone="blue">{template.outputFormat || "PDF/DOCX"}</Badge>
                    </div>
                    <div>
                      <b>{scope || "manual"}</b>
                      <small>{template.unitIds.length ? "unidade(s)" : template.groupIds.length ? "grupo(s)" : "sob demanda"}</small>
                    </div>
                    <div>
                      <b>{automation ? cadenceLabel(automation.cadence) : "-"}</b>
                      <small>{automation?.nextRunAt ? `próx. ${formatShortDateTime(automation.nextRunAt)}` : "sem agenda"}</small>
                    </div>
                    <div>
                      <Badge tone={template.enabled ? "green" : "slate"}>{template.enabled ? "ativo" : "pausado"}</Badge>
                    </div>
                    <div>
                      <Link href={`/relatorios/monitoramento?templateId=${template.id}`}>Abrir</Link>
                    </div>
                  </div>
                );
              }) : (
                <EmptyState label="Nenhum modelo de consumo salvo" />
              )}
            </div>
          </section>

          <section className="nova-consumo-split-grid">
            <article className="nova-lit-card nova-consumo-ready-card">
              <div className="nova-consumo-section-title">
                <div>
                  <span>Unidades recentes</span>
                  <h2>Prontas para exportar</h2>
                </div>
                <Badge tone="green">{readyUnits.length} prontas</Badge>
              </div>

              <div className="nova-consumo-unit-list">
                {(readyUnits.length ? readyUnits : units.items).slice(0, 8).map((unit) => (
                  <Link key={unit.id} href={`/relatorios/monitoramento?unitId=${unit.id}`}>
                    <div>
                      <strong>{unit.name}</strong>
                      <span>{unit.partner.name} · {cityLine(unit)}</span>
                    </div>
                    <b>{unit.reportContractedBandwidth || "sem banda"}</b>
                  </Link>
                ))}
                {!units.items.length ? <div className="nova-consumo-list-empty">Nenhuma unidade carregada.</div> : null}
              </div>
            </article>

            <article className="nova-lit-card nova-consumo-coverage-card">
              <div className="nova-consumo-section-title">
                <div>
                  <span>Metadados</span>
                  <h2>Cobertura do relatório</h2>
                </div>
                <Badge tone={pendingUnits.length ? "orange" : "green"}>{pendingUnits.length} pendência(s)</Badge>
              </div>

              <div className="nova-consumo-progress-list">
                <ProgressLine label="Contrato" value={percent(unitsWithContract, units.total)} tone="blue" />
                <ProgressLine label="Banda" value={percent(unitsWithBandwidth, units.total)} tone="green" />
                <ProgressLine label="Endereço" value={percent(unitsWithAddress, units.total)} tone="orange" />
                <ProgressLine label="Completo" value={percent(readyUnits.length, units.total)} tone={pendingUnits.length ? "orange" : "green"} />
              </div>
            </article>
          </section>
        </div>

        <aside className="nova-consumo-right-col">
          <section className="nova-lit-card nova-consumo-preview">
            <div className="nova-lit-title-row">
              <h2>Exportação</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">PDF/DOCX</span>
            </div>
            <div className="nova-consumo-paper">
              <div>
                <strong>NOVA</strong>
                <span>TELECOM</span>
              </div>
              <i />
              <section>
                <small>Relatório</small>
                <b>Consumo</b>
                <p>Banda, tráfego e séries Zabbix por unidade monitorada.</p>
              </section>
            </div>
            <Link href="/relatorios/monitoramento" className="nova-consumo-primary-action">Gerar relatório</Link>
          </section>

          <section className="nova-lit-card nova-consumo-quality">
            <div className="nova-lit-title-row">
              <h2>Qualidade</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{units.total}</span>
            </div>
            <div className="nova-consumo-progress-list">
              <ProgressLine label="Modelos ativos" value={percent(enabledTemplates, Math.max(1, templates.length))} tone="green" />
              <ProgressLine label="Com gráficos" value={percent(withCharts, Math.max(1, templates.length))} tone="blue" />
              <ProgressLine label="Automatizados" value={percent(automatedTemplates, Math.max(1, templates.length))} tone="orange" />
              <ProgressLine label="Unidades prontas" value={percent(readyUnits.length, units.total)} tone="green" />
            </div>
          </section>

          <section className="nova-lit-card nova-consumo-quick">
            <span>Ação rápida</span>
            <Link href="/relatorios/monitoramento">Novo relatório <b>gerar</b></Link>
            <Link href="/relatorios/monitoramento?source=unit">Por unidade <b>{units.total}</b></Link>
            <Link href="/relatorios/monitoramento?source=template">Por template <b>{templates.length}</b></Link>
          </section>

          <section className="nova-lit-card nova-consumo-runs">
            <div className="nova-lit-title-row">
              <h2>Últimas exportações</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{runs.length}</span>
            </div>

            <div className="nova-consumo-run-list">
              {runs.length ? runs.slice(0, 6).map((run) => (
                <article key={run.id}>
                  <Dot tone={statusTone(run.status)} />
                  <div>
                    <strong>{run.rule.reportTemplate?.name || run.rule.name}</strong>
                    <span>{formatShortDateTime(run.startedAt)} · {statusLabel(run.status)}</span>
                    {run.attachments[0] ? <a href={run.attachments[0].url}>Baixar arquivo</a> : null}
                  </div>
                </article>
              )) : (
                <div className="nova-consumo-list-empty">Nenhuma exportação encontrada.</div>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-consumo-status">
            <div className="nova-lit-title-row">
              <h2>Recorte atual</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{failedRuns} erro(s)</span>
            </div>
            <div className="nova-consumo-status-list">
              <article><Dot tone="green" /><strong>Prontos</strong><b>{successfulRuns}</b></article>
              <article><Dot tone="red" /><strong>Com erro</strong><b>{failedRuns}</b></article>
              <article><Dot tone="blue" /><strong>Templates</strong><b>{templates.length}</b></article>
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
