import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import { formatDateTime } from "@/lib/formatters";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

type IntegrationSettings = {
  apiBaseUrl?: string;
  environment?: string;
  allowDestructiveActions?: boolean;
  enableAutomation?: boolean;
  enableZabbixSync?: boolean;
  enableReports?: boolean;
  enableCsvImport?: boolean;
  [key: string]: unknown;
};

type MonitoringSummary = {
  checkedAt: string;
  counts: {
    usersTotal: number;
    usersActive: number;
    partnersTotal: number;
    partnersActive: number;
    unitsTotal: number;
    unitsActive: number;
    equipmentsTotal: number;
    equipmentsActive: number;
    integrationsTotal: number;
    integrationsActive: number;
    integrationsHealthy: number;
    integrationsFailing: number;
  };
  integrationChecks: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    isActive: boolean;
    ok: boolean;
    message: string;
    targetUrl: string;
    latencyMs: number;
    httpStatus?: number;
    version?: string;
    monitoredHosts?: number;
    openProblems?: number;
  }>;
  zabbixSnapshots: Array<{
    id: string;
    code: string;
    name: string;
    ok: boolean;
    targetUrl: string;
    version?: string;
    monitoredHosts?: number;
    openProblems?: number;
    message: string;
  }>;
};

function emptySummary(): MonitoringSummary {
  return {
    checkedAt: new Date().toISOString(),
    counts: {
      usersTotal: 0,
      usersActive: 0,
      partnersTotal: 0,
      partnersActive: 0,
      unitsTotal: 0,
      unitsActive: 0,
      equipmentsTotal: 0,
      equipmentsActive: 0,
      integrationsTotal: 0,
      integrationsActive: 0,
      integrationsHealthy: 0,
      integrationsFailing: 0,
    },
    integrationChecks: [],
    zabbixSnapshots: [],
  };
}

async function readSettings() {
  try {
    const data = await apiJson<IntegrationSettings>("/settings/integrations");
    return { data, error: "" };
  } catch (error) {
    return {
      data: {} as IntegrationSettings,
      error: error instanceof Error ? error.message : "Configurações indisponíveis.",
    };
  }
}

async function readMonitoringSummary() {
  try {
    return await apiJson<MonitoringSummary>("/monitoring/summary");
  } catch {
    return emptySummary();
  }
}

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function boolText(value: unknown) {
  return value ? "Ativo" : "Inativo";
}

function boolTone(value: unknown): Tone {
  return value ? "green" : "slate";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-config-badge ${toneClass(tone)}`}>{children}</span>;
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
    <article className={`nova-config-stat ${toneClass(tone)}`}>
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
    <section className={`nova-config-panel ${className}`}>
      <div className="nova-config-panel-head">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="nova-config-panel-body">{children}</div>
    </section>
  );
}

function ProgressLine({
  label,
  value,
  total,
  tone,
  detail,
}: {
  label: string;
  value: number;
  total: number;
  tone: Tone;
  detail?: string;
}) {
  const current = percent(value, total);

  return (
    <div className="nova-config-progress-line">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="nova-config-progress-track">
        <i className={toneClass(tone)} style={{ width: `${current}%` }} />
      </div>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function SettingRow({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: ReactNode;
  tone: Tone;
  detail: string;
}) {
  return (
    <div className="nova-config-setting-row">
      <span>
        <b>{label}</b>
        <small>{detail}</small>
      </span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function ShortcutCard({
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
    <Link href={href} className={`nova-config-shortcut ${toneClass(tone)}`}>
      <span>{title}</span>
      <p>{description}</p>
      <strong>Abrir</strong>
    </Link>
  );
}

function healthTone(ok: boolean): Tone {
  return ok ? "green" : "red";
}

function telemetryCoverage(telemetry: UnitHostTelemetry) {
  return percent(telemetry.counts.matched, telemetry.counts.units);
}

type OperationalSnapshot = {
  openOccurrences: number;
  criticalOpenOccurrences: number;
  overdueMaintenances: number;
  dueTodayMaintenances: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readNumberField(source: unknown, key: string) {
  if (!isRecord(source)) return 0;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function firstNumberFrom(candidates: unknown[], key: string) {
  for (const candidate of candidates) {
    const value = readNumberField(candidate, key);
    if (value) return value;
  }

  return 0;
}

function readOperationalSnapshot(commandCenter: CommandCenter): OperationalSnapshot {
  const root = commandCenter as unknown as Record<string, unknown>;
  const candidates = [
    root.occurrences,
    root.operationalPressure,
    root.pressure,
    root.summary,
    root.metrics,
    root,
  ];

  return {
    openOccurrences: firstNumberFrom(candidates, "openOccurrences"),
    criticalOpenOccurrences: firstNumberFrom(candidates, "criticalOpenOccurrences"),
    overdueMaintenances: firstNumberFrom(candidates, "overdueMaintenances"),
    dueTodayMaintenances: firstNumberFrom(candidates, "dueTodayMaintenances"),
  };
}

export default async function ConfiguracoesPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/configuracoes");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/dashboard");
  }

  const [settingsResult, summary, commandCenter, telemetry] = await Promise.all([
    readSettings(),
    readMonitoringSummary(),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry({ timeoutMs: 2_500 }),
  ]);

  const settings = settingsResult.data;
  const settingsError = settingsResult.error;
  const activeIntegrations = summary.counts.integrationsActive;
  const integrationHealth = percent(summary.counts.integrationsHealthy, activeIntegrations || summary.counts.integrationsTotal);
  const zabbixSnapshot = summary.zabbixSnapshots[0];
  const operationalSnapshot = readOperationalSnapshot(commandCenter);
  const criticalPressure =
    operationalSnapshot.criticalOpenOccurrences +
    operationalSnapshot.overdueMaintenances +
    summary.counts.integrationsFailing;
  const securityItems = [
    {
      label: "Ações destrutivas",
      value: boolText(settings.allowDestructiveActions),
      tone: settings.allowDestructiveActions ? "orange" : "green",
      detail: "devem exigir confirmação e auditoria",
    },
    {
      label: "Automação",
      value: boolText(settings.enableAutomation),
      tone: boolTone(settings.enableAutomation),
      detail: "rotinas e geração automática de casos",
    },
    {
      label: "Sync Zabbix",
      value: boolText(settings.enableZabbixSync),
      tone: boolTone(settings.enableZabbixSync),
      detail: "escrita controlada em hosts reconciliados",
    },
    {
      label: "Relatórios",
      value: boolText(settings.enableReports),
      tone: boolTone(settings.enableReports),
      detail: "exportação operacional e consumo",
    },
    {
      label: "Importação CSV",
      value: boolText(settings.enableCsvImport),
      tone: boolTone(settings.enableCsvImport),
      detail: "cargas controladas por preview",
    },
  ] as const;

  return (
    <NovaLitShell activeHref="/configuracoes">
      <main className="nova-config-page">
        <header className="nova-config-hero">
          <div>
            <span>Configurações / Sistema</span>
            <h1>Sistema</h1>
            <p>Parâmetros do produto, integrações, segurança operacional e governança do ambiente.</p>
          </div>
          <div className="nova-config-actions">
            <Link href="/integracoes" className="nova-lit-button nova-lit-button-secondary">
              Integrações
            </Link>
            <Link href="/usuarios" className="nova-lit-button nova-lit-button-primary">
              Usuários
            </Link>
          </div>
        </header>

        <section className="nova-config-stats" aria-label="Indicadores do sistema">
          <StatCard
            label="Ambiente"
            value={String(settings.environment || "local")}
            hint={settings.apiBaseUrl ? "API configurada" : "API padrão"}
            tone={settingsError ? "orange" : "blue"}
          />
          <StatCard
            label="Integrações"
            value={summary.counts.integrationsTotal}
            hint={`${summary.counts.integrationsActive} ativa(s)`}
            tone={summary.counts.integrationsActive ? "green" : "slate"}
          />
          <StatCard
            label="Saúde"
            value={`${integrationHealth}%`}
            hint={`${summary.counts.integrationsFailing} falha(s)`}
            tone={summary.counts.integrationsFailing ? "orange" : "green"}
          />
          <StatCard
            label="Usuários"
            value={summary.counts.usersTotal}
            hint={`${summary.counts.usersActive} ativo(s)`}
            tone="blue"
          />
          <StatCard
            label="Pressão"
            value={criticalPressure}
            hint="críticos, vencidos e falhas"
            tone={criticalPressure ? "orange" : "green"}
          />
        </section>

        <section className="nova-config-layout">
          <div className="nova-config-main">
            <Panel
              eyebrow="Sistema"
              title="Central de governança"
              action={<Badge tone={settingsError ? "orange" : "green"}>{settingsError ? "atenção" : "online"}</Badge>}
            >
              {settingsError ? (
                <div className="nova-config-warning">
                  {settingsError}
                </div>
              ) : null}

              <div className="nova-config-command-grid">
                <article>
                  <span>Ocorrências abertas</span>
                  <strong>{operationalSnapshot.openOccurrences}</strong>
                  <small>{operationalSnapshot.criticalOpenOccurrences} crítica(s)</small>
                </article>
                <article>
                  <span>Manutenções vencidas</span>
                  <strong>{operationalSnapshot.overdueMaintenances}</strong>
                  <small>{operationalSnapshot.dueTodayMaintenances} para hoje</small>
                </article>
                <article>
                  <span>Unidades monitoradas</span>
                  <strong>{summary.counts.unitsTotal}</strong>
                  <small>{summary.counts.unitsActive} ativa(s)</small>
                </article>
                <article>
                  <span>Ativos técnicos</span>
                  <strong>{summary.counts.equipmentsTotal}</strong>
                  <small>{summary.counts.equipmentsActive} em operação</small>
                </article>
              </div>
            </Panel>

            <Panel
              eyebrow="Atalhos"
              title="Áreas administrativas"
              action={<Badge tone="blue">admin</Badge>}
            >
              <div className="nova-config-shortcut-grid">
                <ShortcutCard
                  title="Usuários"
                  description="Convites, papéis, status e reset de acesso."
                  href="/usuarios"
                  tone="green"
                />
                <ShortcutCard
                  title="Perfis"
                  description="Matriz de permissões e distribuição de papéis."
                  href="/perfis"
                  tone="blue"
                />
                <ShortcutCard
                  title="Integrações"
                  description="Conectores, endpoints, credenciais e testes."
                  href="/integracoes"
                  tone="orange"
                />
                <ShortcutCard
                  title="Importação"
                  description="Templates CSV, preview e upsert controlado."
                  href="/importacao"
                  tone="slate"
                />
                <ShortcutCard
                  title="Reconciliação"
                  description="Vínculo entre cadastro, dados operacionais e Zabbix."
                  href="/reconciliacao"
                  tone="blue"
                />
                <ShortcutCard
                  title="Automação"
                  description="Regras, detectores, cadência e execuções."
                  href="/automacao"
                  tone="orange"
                />
              </div>
            </Panel>

            <Panel
              eyebrow="Políticas"
              title="Chaves operacionais"
              action={<Badge tone="slate">{Object.keys(settings).length} chave(s)</Badge>}
            >
              <div className="nova-config-settings-grid">
                {securityItems.map((item) => (
                  <SettingRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    tone={item.tone as Tone}
                    detail={item.detail}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              eyebrow="Conectores"
              title="Saúde das integrações"
              action={<Badge tone="blue">{formatDateTime(summary.checkedAt)}</Badge>}
            >
              {summary.integrationChecks.length ? (
                <div className="nova-config-health-list">
                  {summary.integrationChecks.map((check) => (
                    <article key={check.id} className={`nova-config-health-row ${check.ok ? "is-ok" : "is-bad"}`}>
                      <div>
                        <strong>{check.code} - {check.name}</strong>
                        <span>{check.targetUrl || check.message}</span>
                      </div>
                      <div>
                        <Badge tone={healthTone(check.ok)}>{check.ok ? "conectado" : "falha"}</Badge>
                        <small>{check.httpStatus ? `HTTP ${check.httpStatus}` : check.ok ? "OK" : "-"} · {check.latencyMs} ms</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-config-empty">
                  <b>Nenhuma integração retornada</b>
                  <span>Cadastre ou ative um conector para alimentar monitoramento e relatórios.</span>
                </div>
              )}
            </Panel>
          </div>

          <aside className="nova-config-side">
            <Panel eyebrow="Segurança" title="Recorte atual">
              <ProgressLine
                label="Integrações ativas"
                value={summary.counts.integrationsActive}
                total={Math.max(summary.counts.integrationsTotal, 1)}
                tone="green"
              />
              <ProgressLine
                label="Integrações saudáveis"
                value={summary.counts.integrationsHealthy}
                total={Math.max(summary.counts.integrationsActive, 1)}
                tone={summary.counts.integrationsFailing ? "orange" : "blue"}
              />
              <ProgressLine
                label="Cobertura Zabbix"
                value={telemetry.counts.matched}
                total={Math.max(telemetry.counts.units, 1)}
                tone="orange"
                detail={`${telemetryCoverage(telemetry)}% das unidades com host`}
              />
              <ProgressLine
                label="Sync pronto"
                value={telemetry.counts.syncReady}
                total={Math.max(telemetry.counts.units, 1)}
                tone="green"
              />
            </Panel>

            <Panel eyebrow="Zabbix" title="Fonte principal">
              {zabbixSnapshot ? (
                <div className="nova-config-zabbix-card">
                  <div>
                    <strong>{zabbixSnapshot.code} - {zabbixSnapshot.name}</strong>
                    <Badge tone={zabbixSnapshot.ok ? "green" : "orange"}>
                      {zabbixSnapshot.ok ? "lendo" : "atenção"}
                    </Badge>
                  </div>
                  <p>{zabbixSnapshot.targetUrl || zabbixSnapshot.message}</p>
                  <div className="nova-config-mini-grid">
                    <span>
                      <b>{zabbixSnapshot.version || "-"}</b>
                      versão
                    </span>
                    <span>
                      <b>{zabbixSnapshot.monitoredHosts ?? 0}</b>
                      hosts
                    </span>
                    <span>
                      <b>{zabbixSnapshot.openProblems ?? 0}</b>
                      problemas
                    </span>
                  </div>
                </div>
              ) : (
                <div className="nova-config-empty is-small">
                  <b>Sem snapshot Zabbix</b>
                  <span>Configure o conector em Integrações.</span>
                </div>
              )}
            </Panel>

            <Panel eyebrow="Rotina" title="Regras rápidas">
              <div className="nova-config-rules">
                <div>
                  <b>Segredos</b>
                  <span>Não são exibidos em tela; atualização preserva valor em branco.</span>
                </div>
                <div>
                  <b>Sync Zabbix</b>
                  <span>Escrita apenas com host inequívoco e tag explícita.</span>
                </div>
                <div>
                  <b>Importação</b>
                  <span>Preview antes do upsert e lotes pequenos para auditoria.</span>
                </div>
                <div>
                  <b>Relatórios</b>
                  <span>Exportações ficam registradas no histórico operacional.</span>
                </div>
              </div>
            </Panel>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
