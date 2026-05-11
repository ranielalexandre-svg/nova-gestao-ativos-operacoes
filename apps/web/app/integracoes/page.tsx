import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  getActionErrorMessage,
  type ActionFeedbackState,
} from "@/lib/action-state";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime } from "@/lib/formatters";
import { readUnitHostTelemetry, type UnitHostTelemetry } from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

type IntegrationRow = {
  id: string;
  code: string;
  name: string;
  type: "zabbix" | "generic_http";
  baseUrl: string;
  apiPath: string | null;
  authMode: "none" | "token" | "userpass";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type IntegrationCheck = {
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
};

type ZabbixSnapshot = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  ok: boolean;
  targetUrl: string;
  version?: string;
  monitoredHosts?: number;
  openProblems?: number;
  message: string;
  recentProblems: Array<{
    eventid: string;
    name: string;
    severity: string;
    acknowledged: string;
    clock: string;
  }>;
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
  integrationChecks: IntegrationCheck[];
  zabbixSnapshots: ZabbixSnapshot[];
};

type BulkZabbixSyncResult = {
  ok: boolean;
  generatedAt: string;
  totalUnits: number;
  readyUnits: number;
  synced: number;
  skipped: number;
  failed: number;
  pending: {
    unmapped: number;
    ambiguous: number;
    withoutExplicitTag: number;
  };
  sources: Array<{
    id: string;
    code: string;
    name: string;
    ok: boolean;
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

async function readMonitoringSummary() {
  try {
    return await apiJson<MonitoringSummary>("/monitoring/summary");
  } catch {
    return emptySummary();
  }
}

async function syncReadyUnitsAction(
  state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";
  void state;
  void formData;

  try {
    const session = await getServerWebSession();
    if (normalizeRole(session.user?.role || "") !== "admin") {
      return { status: "error", message: "Acesso negado." };
    }

    const result = await apiJson<BulkZabbixSyncResult>("/units/sync-zabbix-ready", {
      method: "POST",
    });

    revalidatePath("/integracoes");
    revalidatePath("/sensores");
    revalidatePath("/unidades");
    revalidatePath("/ativos");
    revalidatePath("/reconciliacao");

    return {
      status: result.ok ? "success" : "error",
      message: `${result.synced} sincronizada(s), ${result.skipped} ignorada(s), ${result.failed} falha(s). ${result.pending.unmapped} sem host, ${result.pending.ambiguous} ambigua(s), ${result.pending.withoutExplicitTag} sem tag explicita.`,
    };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

function toneClass(tone: Tone) {
  if (tone === "green") return "is-green";
  if (tone === "orange") return "is-orange";
  if (tone === "blue") return "is-blue";
  if (tone === "red") return "is-red";
  return "is-slate";
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-integracoes-badge ${toneClass(tone)}`}>{children}</span>;
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
    <article className={`nova-integracoes-stat ${toneClass(tone)}`}>
      <div className="nova-integracoes-dot" />
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Panel({
  id,
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`nova-integracoes-panel ${className}`}>
      <div className="nova-integracoes-panel-head">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div className="nova-integracoes-panel-action">{action}</div> : null}
      </div>
      <div className="nova-integracoes-panel-body">{children}</div>
    </section>
  );
}

function IntegrationsFlow() {
  return (
    <section className="nova-admin-flow nova-admin-flow--integrations" aria-label="Fluxo de integrações">
      <article className="is-active">
        <span>01</span>
        <strong>Conector</strong>
        <small>Zabbix, HTTP, autenticação e contrato de leitura.</small>
      </article>
      <i>→</i>
      <article>
        <span>02</span>
        <strong>Saúde</strong>
        <small>Teste, latência, hosts, problemas e fontes ativas.</small>
      </article>
      <i>→</i>
      <article>
        <span>03</span>
        <strong>Sincronização</strong>
        <small>Unidades prontas, tags explícitas e reconciliação segura.</small>
      </article>
    </section>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="nova-integracoes-empty">
      <div>N</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function progressPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
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
  const percent = progressPercent(value, total);
  return (
    <div className="nova-integracoes-progress-line">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="nova-integracoes-progress-track">
        <i className={toneClass(tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function typeLabel(type: string) {
  if (type === "generic_http") return "HTTP";
  return type.toUpperCase();
}

function authLabel(value: string) {
  if (value === "userpass") return "usuario/senha";
  if (value === "token") return "token";
  return "sem auth";
}

function truncateUrl(value: string) {
  return value.replace(/^https?:\/\//, "");
}

function healthTone(ok?: boolean): Tone {
  if (typeof ok === "undefined") return "slate";
  return ok ? "green" : "red";
}

function statusLabel(check?: IntegrationCheck) {
  if (!check) return "sem teste";
  const status = check.httpStatus ? `HTTP ${check.httpStatus}` : check.ok ? "ok" : "falha";
  return `${status} - ${check.latencyMs}ms`;
}

function matchLabel(item: UnitHostTelemetry["items"][number]) {
  if (item.match.status === "unmatched") return "sem host";
  if (item.match.status === "ambiguous") return "ambiguo";
  if (!item.match.syncReady) return "sem tag";
  return "pronto";
}

function matchTone(item: UnitHostTelemetry["items"][number]): Tone {
  if (item.match.syncReady) return "green";
  if (item.match.status === "matched") return "orange";
  if (item.match.status === "ambiguous") return "orange";
  return "slate";
}

function locationLine(unit: UnitHostTelemetry["items"][number]["unit"]) {
  return [unit.city, unit.state].filter(Boolean).join(" / ") || "sem cidade/UF";
}

function hrefWithParams(
  pathname: string,
  params: RawSearchParams,
  updates: Record<string, string | number | undefined>,
) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, String(item));
      });
      return;
    }

    if (value) query.set(key, String(value));
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value === "undefined" || value === "") {
      query.delete(key);
      return;
    }

    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function IntegrationHealthStrip({ checks }: { checks: IntegrationCheck[] }) {
  if (!checks.length) {
    return (
      <Panel eyebrow="Saude" title="Conectores ativos">
        <EmptyBlock
          title="Sem saude de integracoes"
          description="Nenhum teste de conector foi retornado pela API."
        />
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="Saude"
      title="Conectores ativos"
      action={<Badge tone="blue">{checks.length} fonte(s)</Badge>}
    >
      <div className="nova-integracoes-health-grid">
        {checks.slice(0, 6).map((check) => (
          <article key={`health-${check.id}`} className={`nova-integracoes-health ${check.ok ? "is-ok" : "is-bad"}`}>
            <div className="nova-integracoes-health-top">
              <div>
                <strong>{check.code}</strong>
                <p>{check.name}</p>
              </div>
              <Badge tone={check.ok ? "green" : "red"}>{check.ok ? "conectado" : "falha"}</Badge>
            </div>
            <div className="nova-integracoes-mini-grid">
              <div>
                <span>Latencia</span>
                <strong>{check.latencyMs} ms</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{check.httpStatus || (check.ok ? "OK" : "-")}</strong>
              </div>
            </div>
            <p className="nova-integracoes-truncate">{check.targetUrl || check.message}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ConnectorConfigForm({
  integration,
  updateAction,
  testAction,
}: {
  integration: IntegrationRow;
  updateAction: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  testAction: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
}) {
  const zabbixWithoutAuth = integration.type === "zabbix" && integration.authMode === "none";

  return (
    <div className="nova-integracoes-config-grid">
      <ActionForm
        action={updateAction}
        className="nova-integracoes-form-card"
        noticeClassName="nova-integracoes-form-wide"
        submitClassName="nova-integracoes-form-wide"
        submitLabel="Salvar conector"
        pendingLabel="Salvando..."
        variant="secondary"
      >
        <input type="hidden" name="id" value={integration.id} />

        <label>
          <span>Codigo</span>
          <input name="code" defaultValue={integration.code} />
        </label>

        <label>
          <span>Nome</span>
          <input name="name" defaultValue={integration.name} />
        </label>

        <label>
          <span>Tipo</span>
          <select name="type" defaultValue={integration.type}>
            <option value="zabbix">zabbix</option>
            <option value="generic_http">generic_http</option>
          </select>
        </label>

        <label>
          <span>Autenticacao</span>
          <select name="authMode" defaultValue={integration.authMode}>
            <option value="none">none</option>
            <option value="token">token</option>
            <option value="userpass">userpass</option>
          </select>
        </label>

        <label className="nova-integracoes-form-wide">
          <span>Base URL</span>
          <input name="baseUrl" defaultValue={integration.baseUrl} />
        </label>

        <label className="nova-integracoes-form-wide">
          <span>Caminho</span>
          <input name="apiPath" defaultValue={integration.apiPath || ""} placeholder="Opcional" />
        </label>

        <label className="nova-integracoes-form-wide">
          <span>Novo API token</span>
          <input name="apiToken" placeholder="Opcional, deixe em branco para preservar" />
        </label>

        <label>
          <span>Novo usuario</span>
          <input name="username" placeholder="Opcional" />
        </label>

        <label>
          <span>Nova senha</span>
          <input name="password" type="password" placeholder="Opcional" />
        </label>

        <label className="nova-integracoes-check nova-integracoes-form-wide">
          <input type="checkbox" name="isActive" defaultChecked={integration.isActive} />
          <span>Ativo</span>
        </label>

        <p className="nova-integracoes-form-note nova-integracoes-form-wide">
          Credenciais nao sao exibidas. Deixe token, usuario e senha em branco para preservar os valores atuais.
        </p>

        {zabbixWithoutAuth ? (
          <div className="nova-integracoes-warning nova-integracoes-form-wide">
            Este conector Zabbix esta sem autenticacao. A leitura de versao pode funcionar, mas hosts,
            telemetria e sincronizacao exigem token ou usuario/senha.
          </div>
        ) : null}
      </ActionForm>

      <ActionForm
        action={testAction}
        className="nova-integracoes-test-card"
        submitLabel="Testar agora"
        pendingLabel="Testando..."
        variant="secondary"
      >
        <input type="hidden" name="id" value={integration.id} />
        <div>
          <strong>Teste real</strong>
          <p>
            Valida reachability e, no Zabbix autenticado, consulta versao, hosts e problemas.
          </p>
        </div>
        <div className="nova-integracoes-code-card">
          {integration.type === "zabbix"
            ? "apiinfo.version + host.get + problem.get"
            : "GET simples no endpoint configurado"}
        </div>
      </ActionForm>
    </div>
  );
}

function NewConnectorPanel({
  action,
  closeHref,
}: {
  action: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  closeHref?: string;
}) {
  return (
    <Panel
      id="novo-conector"
      eyebrow="Administracao"
      title="Novo conector"
      className="nova-integracoes-new"
      action={
        <div className="nova-integracoes-actions">
          <Badge tone="green">admin</Badge>
          {closeHref ? (
            <Link href={closeHref} className="nova-lit-button nova-lit-button-secondary">
              Voltar
            </Link>
          ) : null}
        </div>
      }
    >
      <ActionForm
        action={action}
        className="nova-integracoes-create-form"
        noticeClassName="nova-integracoes-form-wide-all"
        submitClassName="nova-integracoes-form-wide-all"
        submitLabel="Criar conector"
        pendingLabel="Criando..."
      >
        <label>
          <span>Codigo</span>
          <input name="code" placeholder="ZBX" />
        </label>

        <label>
          <span>Nome</span>
          <input name="name" placeholder="Zabbix principal" />
        </label>

        <label>
          <span>Tipo</span>
          <select name="type" defaultValue="zabbix">
            <option value="zabbix">zabbix</option>
            <option value="generic_http">generic_http</option>
          </select>
        </label>

        <label>
          <span>Autenticacao</span>
          <select name="authMode" defaultValue="none">
            <option value="none">none</option>
            <option value="token">token</option>
            <option value="userpass">userpass</option>
          </select>
        </label>

        <label className="is-double">
          <span>Base URL</span>
          <input name="baseUrl" placeholder="https://sensores.exemplo/zabbix" />
        </label>

        <label className="is-double">
          <span>Caminho opcional</span>
          <input name="apiPath" placeholder="/api_jsonrpc.php" />
        </label>

        <label className="is-double">
          <span>API token</span>
          <input name="apiToken" placeholder="Opcional" />
        </label>

        <label>
          <span>Usuario</span>
          <input name="username" placeholder="Opcional" />
        </label>

        <label>
          <span>Senha</span>
          <input name="password" type="password" placeholder="Opcional" />
        </label>
      </ActionForm>
    </Panel>
  );
}

function ZabbixReadinessPanel({
  telemetry,
  isAdmin,
}: {
  telemetry: UnitHostTelemetry;
  isAdmin: boolean;
}) {
  const matchedNotReady = Math.max(0, telemetry.counts.matched - telemetry.counts.syncReady);
  const blocked = telemetry.counts.unmapped + telemetry.counts.ambiguous + matchedNotReady;
  const pendingRows = telemetry.items
    .filter((item) => !item.match.syncReady)
    .sort((a, b) => {
      const weight = { ambiguous: 0, unmatched: 1, matched: 2 };
      return weight[a.match.status] - weight[b.match.status] || a.unit.code.localeCompare(b.unit.code);
    })
    .slice(0, 8);
  const sourceFailures = telemetry.sources.filter((source) => !source.ok).length;

  return (
    <Panel
      eyebrow="Zabbix"
      title="Sincronizacao e vinculo de hosts"
      action={
        <div className="nova-integracoes-actions">
          <Badge tone={sourceFailures ? "orange" : "green"}>
            {sourceFailures ? `${sourceFailures} fonte(s) com alerta` : "fontes ok"}
          </Badge>
          {isAdmin ? (
            <ActionForm
              action={syncReadyUnitsAction}
              className="nova-integracoes-inline-action"
              submitLabel="Sincronizar prontos"
              pendingLabel="Sincronizando..."
              variant="secondary"
            >
              <span>{telemetry.counts.syncReady} unidade(s)</span>
            </ActionForm>
          ) : null}
        </div>
      }
    >
      <div className="nova-integracoes-kpis">
        <StatCard label="Prontas" value={telemetry.counts.syncReady} hint="host certo e tag explicita" tone={telemetry.counts.syncReady ? "green" : "slate"} />
        <StatCard label="Vinculadas" value={telemetry.counts.matched} hint={`${matchedNotReady} pedem tag`} tone={matchedNotReady ? "orange" : "green"} />
        <StatCard label="Sem host" value={telemetry.counts.unmapped} hint="sem candidato confiavel" tone={telemetry.counts.unmapped ? "orange" : "green"} />
        <StatCard label="Ambiguas" value={telemetry.counts.ambiguous} hint="mais de um candidato" tone={telemetry.counts.ambiguous ? "orange" : "green"} />
        <StatCard label="Bloqueadas" value={blocked} hint="fora do lote automatico" tone={blocked ? "orange" : "green"} />
      </div>

      <div className="nova-integracoes-zabbix-grid">
        <div className="nova-integracoes-table-wrap">
          {pendingRows.length ? (
            <table className="nova-integracoes-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Host</th>
                  <th>Estado</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((item) => (
                  <tr key={`sync-pending-${item.unit.id}`}>
                    <td>
                      <Link href={`/unidades/${item.unit.id}`}>{item.unit.code}</Link>
                      <small>{item.unit.name}</small>
                      <small>{locationLine(item.unit)}</small>
                    </td>
                    <td>
                      <strong>{item.match.hostName || item.match.host || "sem host confiavel"}</strong>
                      <small>
                        {item.match.integrationCode
                          ? `${item.match.integrationCode} - ${item.match.confidence}%`
                          : `${item.match.candidates} candidato(s)`}
                      </small>
                    </td>
                    <td><Badge tone={matchTone(item)}>{matchLabel(item)}</Badge></td>
                    <td><code>nova.unit_code={item.unit.code}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyBlock
              title="Nenhum bloqueio de sincronizacao"
              description="As unidades ativas no recorte estao aptas ou nao ha telemetria carregada."
            />
          )}
        </div>

        <aside className="nova-integracoes-side-stack">
          <div className="nova-integracoes-note-card">
            <span>Contrato usado pelo portal</span>
            <strong>nova.unit_code</strong>
            <p>Somente host inequívoco recebe escrita automatica. Sem tag explicita, a tela apenas monitora e sugere ajuste.</p>
          </div>

          {telemetry.sources.map((source) => (
            <div key={`zbx-source-${source.id}`} className="nova-integracoes-source-card">
              <div>
                <strong>{source.code} - {source.name}</strong>
                <Badge tone={source.ok ? "green" : "orange"}>{source.ok ? "lendo" : "alerta"}</Badge>
              </div>
              <p>{source.targetUrl || "sem URL"}</p>
              <div className="nova-integracoes-mini-grid">
                <div><span>Hosts</span><strong>{source.totalHosts}</strong></div>
                <div><span>Match</span><strong>{source.matchedUnits}</strong></div>
                <div><span>Versao</span><strong>{source.version || "-"}</strong></div>
              </div>
              <p>{source.message}</p>
            </div>
          ))}
        </aside>
      </div>
    </Panel>
  );
}

function ReadOnlyIntegrations({
  summary,
  telemetry,
}: {
  summary: MonitoringSummary;
  telemetry: UnitHostTelemetry;
}) {
  return (
    <>
      <ZabbixReadinessPanel telemetry={telemetry} isAdmin={false} />

      <Panel
        eyebrow="Conectores"
        title="Leitura disponivel"
        action={<Badge tone="slate">{formatDateTime(summary.checkedAt)}</Badge>}
      >
        <div className="nova-integracoes-list">
          {summary.integrationChecks.length ? (
            summary.integrationChecks.map((check) => (
              <div key={check.id} className="nova-integracoes-row-card">
                <div>
                  <strong>{check.code} - {check.name}</strong>
                  <p>{check.targetUrl}</p>
                </div>
                <Badge tone={check.ok ? "green" : "orange"}>{statusLabel(check)}</Badge>
              </div>
            ))
          ) : (
            <EmptyBlock title="Nenhum conector ativo" description="Cadastre uma integracao como admin para iniciar a leitura." />
          )}
        </div>
      </Panel>
    </>
  );
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/integracoes");
  }

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const type = readStringParam(params, "type", "all");
  const active = readStringParam(params, "active", "all");
  const sortBy = readStringParam(params, "sortBy", "code");
  const sortDir = readStringParam(params, "sortDir", "asc");
  const focus = readStringParam(params, "focus");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 20);

  async function createIntegration(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      await apiJson("/integrations", {
        method: "POST",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          type: String(formData.get("type") || ""),
          baseUrl: String(formData.get("baseUrl") || ""),
          apiPath: String(formData.get("apiPath") || ""),
          authMode: String(formData.get("authMode") || "none"),
          apiToken: String(formData.get("apiToken") || ""),
          username: String(formData.get("username") || ""),
          password: String(formData.get("password") || ""),
        }),
      });

      revalidatePath("/integracoes");
      revalidatePath("/sensores");
      revalidatePath("/monitoramento");
      return { status: "success", message: "Conector criado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function updateIntegration(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");

      await apiJson(`/integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          type: String(formData.get("type") || ""),
          baseUrl: String(formData.get("baseUrl") || ""),
          apiPath: String(formData.get("apiPath") || ""),
          authMode: String(formData.get("authMode") || "none"),
          apiToken: String(formData.get("apiToken") || ""),
          username: String(formData.get("username") || ""),
          password: String(formData.get("password") || ""),
          isActive: formData.get("isActive") === "on",
        }),
      });

      revalidatePath("/integracoes");
      revalidatePath("/sensores");
      revalidatePath("/monitoramento");
      return { status: "success", message: "Conector atualizado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function testIntegration(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");
      const result = await apiJson<{
        ok: boolean;
        message: string;
        targetUrl: string;
        latencyMs: number;
        httpStatus?: number;
      }>(`/integrations/${id}/test`, {
        method: "POST",
      });

      revalidatePath("/integracoes");
      revalidatePath("/sensores");
      revalidatePath("/monitoramento");

      return {
        status: result.ok ? "success" : "error",
        message: `${result.message} - ${result.latencyMs}ms`,
      };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [summary, telemetry] = await Promise.all([
    readMonitoringSummary(),
    readUnitHostTelemetry({ timeoutMs: 2_500 }),
  ]);

  const zabbixSources = summary.zabbixSnapshots.length;
  const healthTotal = Math.max(1, summary.counts.integrationsActive);
  const healthPercent = progressPercent(summary.counts.integrationsHealthy, healthTotal);

  if (!isAdmin) {
    return (
      <NovaLitShell activeHref="/integracoes">
        <main className="nova-integracoes-page">
          <header className="nova-integracoes-hero">
            <div>
              <span>Configurações / Integrações</span>
              <h1>Integrações</h1>
              <p>Leitura dos conectores e contrato de vinculo com o Zabbix.</p>
            </div>
            <div className="nova-integracoes-hero-actions">
              <Link href={hrefWithParams("/integracoes", params, {})} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
              <Link href="/monitoramento/sensores" className="nova-lit-button nova-lit-button-secondary">Ver sensores</Link>
            </div>
          </header>

          <IntegrationsFlow />

          <section className="nova-integracoes-kpis">
            <StatCard label="Conectores" value={summary.counts.integrationsTotal} hint={`${summary.counts.integrationsActive} ativos`} tone={summary.counts.integrationsActive ? "blue" : "slate"} />
            <StatCard label="Saudaveis" value={summary.counts.integrationsHealthy} hint={`${summary.counts.integrationsFailing} falhando`} tone={summary.counts.integrationsFailing ? "orange" : "green"} />
            <StatCard label="Zabbix" value={zabbixSources} hint="snapshot(s) ativos" tone={zabbixSources ? "green" : "slate"} />
            <StatCard label="Unidades" value={telemetry.counts.units} hint={`${telemetry.counts.matched} com host`} tone={telemetry.counts.unmapped || telemetry.counts.ambiguous ? "orange" : "green"} />
            <StatCard label="Saude" value={`${healthPercent}%`} hint="conectores ativos OK" tone={summary.counts.integrationsFailing ? "orange" : "green"} />
          </section>

          <IntegrationHealthStrip checks={summary.integrationChecks} />
          <ReadOnlyIntegrations summary={summary} telemetry={telemetry} />
        </main>
      </NovaLitShell>
    );
  }

  const integrationsResponse = await apiJson<PaginatedResponse<IntegrationRow>>(
    `/integrations${buildApiQuery({
      q,
      type: type !== "all" ? type : undefined,
      active: active !== "all" ? active : undefined,
      sortBy,
      sortDir,
      page,
      pageSize,
    })}`,
  );

  const total = integrationsResponse.meta.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const checkById = new Map(summary.integrationChecks.map((item) => [item.id, item]));
  const zabbixById = new Map(summary.zabbixSnapshots.map((item) => [item.id, item]));
  const showNewConnector = focus === "new";
  const clearFocusHref = hrefWithParams("/integracoes", params, { focus: undefined });

  return (
    <NovaLitShell activeHref="/integracoes">
      <main className="nova-integracoes-page">
        <header className="nova-integracoes-hero">
          <div>
            <span>Configurações / Integrações</span>
            <h1>Integrações</h1>
            <p>Conectores, endpoints, credenciais e sincronizacao segura que alimentam o monitoramento.</p>
          </div>
          <div className="nova-integracoes-hero-actions">
            <Link href={hrefWithParams("/integracoes", params, {})} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
            <Link href="/monitoramento/sensores" className="nova-lit-button nova-lit-button-secondary">Ver sensores</Link>
            <Link href={hrefWithParams("/integracoes", params, { focus: "new" })} className="nova-lit-button nova-lit-button-primary">Novo conector</Link>
          </div>
        </header>

        <IntegrationsFlow />

        {showNewConnector ? <NewConnectorPanel action={createIntegration} closeHref={clearFocusHref} /> : null}

        <section className="nova-integracoes-kpis">
          <StatCard label="Conectores" value={summary.counts.integrationsTotal} hint={`${summary.counts.integrationsActive} ativos`} tone={summary.counts.integrationsActive ? "blue" : "slate"} />
          <StatCard label="Saudaveis" value={summary.counts.integrationsHealthy} hint={`${summary.counts.integrationsFailing} falhando`} tone={summary.counts.integrationsFailing ? "orange" : "green"} />
          <StatCard label="Zabbix" value={zabbixSources} hint="snapshot(s) ativos" tone={zabbixSources ? "green" : "slate"} />
          <StatCard label="Filtro atual" value={total} hint="resultado(s)" tone={total ? "blue" : "slate"} />
          <StatCard label="Sync pronto" value={telemetry.counts.syncReady} hint="hosts com tag explicita" tone={telemetry.counts.syncReady ? "green" : "slate"} />
        </section>

        <IntegrationHealthStrip checks={summary.integrationChecks} />
        <ZabbixReadinessPanel telemetry={telemetry} isAdmin={isAdmin} />

        <div className="nova-integracoes-layout">
          <div className="nova-integracoes-main">
            <Panel
              eyebrow="Consulta"
              title="Buscar conectores"
              action={<Link href="/integracoes" className="nova-lit-button nova-lit-button-secondary">Limpar</Link>}
            >
              <form method="GET" className="nova-integracoes-filter">
                <label className="is-wide">
                  <span>Busca</span>
                  <input name="q" defaultValue={q} placeholder="Codigo, nome, tipo ou URL" />
                </label>

                <label>
                  <span>Tipo</span>
                  <select name="type" defaultValue={type}>
                    <option value="all">Todos</option>
                    <option value="zabbix">zabbix</option>
                    <option value="generic_http">generic_http</option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select name="active" defaultValue={active}>
                    <option value="all">Todos</option>
                    <option value="true">Ativos</option>
                    <option value="false">Inativos</option>
                  </select>
                </label>

                <label>
                  <span>Ordem</span>
                  <select name="sortBy" defaultValue={sortBy}>
                    <option value="code">Codigo</option>
                    <option value="name">Nome</option>
                    <option value="type">Tipo</option>
                    <option value="createdAt">Cadastro</option>
                  </select>
                </label>

                <label>
                  <span>Direcao</span>
                  <select name="sortDir" defaultValue={sortDir}>
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                </label>

                <label>
                  <span>Linhas</span>
                  <select name="pageSize" defaultValue={String(pageSize)}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </label>

                <button className="nova-lit-button nova-lit-button-primary" type="submit">Filtrar</button>
              </form>
            </Panel>

            <Panel
              eyebrow="Base"
              title="Conectores cadastrados"
              action={<Badge tone="blue">{integrationsResponse.items.length} linha(s)</Badge>}
            >
              {integrationsResponse.items.length ? (
                <div className="nova-integracoes-list">
                  {integrationsResponse.items.map((integration) => {
                    const check = checkById.get(integration.id);
                    const zabbix = zabbixById.get(integration.id);

                    return (
                      <article key={integration.id} className="nova-integracoes-connector">
                        <div className="nova-integracoes-connector-head">
                          <div>
                            <strong>{integration.code} - {integration.name}</strong>
                            <p>{truncateUrl(integration.baseUrl)}{integration.apiPath || ""}</p>
                          </div>
                          <div className="nova-integracoes-connector-tags">
                            <Badge tone="blue">{typeLabel(integration.type)}</Badge>
                            <Badge tone="slate">{authLabel(integration.authMode)}</Badge>
                            <Badge tone={integration.isActive ? "green" : "slate"}>{integration.isActive ? "ativo" : "inativo"}</Badge>
                            <Badge tone={healthTone(check?.ok)}>{statusLabel(check)}</Badge>
                          </div>
                        </div>

                        {zabbix ? (
                          <div className="nova-integracoes-zabbix-summary">
                            <div><span>Versao</span><strong>{zabbix.version || "-"}</strong></div>
                            <div><span>Hosts</span><strong>{zabbix.monitoredHosts ?? "-"}</strong></div>
                            <div><span>Problemas</span><strong>{zabbix.openProblems ?? "-"}</strong></div>
                          </div>
                        ) : null}

                        <ConnectorConfigForm
                          integration={integration}
                          updateAction={updateIntegration}
                          testAction={testIntegration}
                        />
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyBlock
                  title="Nenhum conector encontrado"
                  description="Ajuste os filtros ou cadastre um novo conector para alimentar o monitoramento."
                />
              )}

              <div className="nova-integracoes-pagination">
                <span>Pagina {page} de {totalPages} - {total} conector(es)</span>
                <div>
                  <Link
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "is-disabled" : ""}
                    href={page <= 1 ? "#" : hrefWithParams("/integracoes", params, { page: page - 1 })}
                  >
                    Anterior
                  </Link>
                  <Link
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? "is-disabled" : ""}
                    href={page >= totalPages ? "#" : hrefWithParams("/integracoes", params, { page: page + 1 })}
                  >
                    Proxima
                  </Link>
                </div>
              </div>
            </Panel>
          </div>

          <aside className="nova-integracoes-side">
            <Panel eyebrow="Rotina" title="Governanca">
              <ProgressLine label="Ativos" value={summary.counts.integrationsActive} total={summary.counts.integrationsTotal} tone="green" />
              <ProgressLine label="Saudaveis" value={summary.counts.integrationsHealthy} total={summary.counts.integrationsActive} tone="blue" />
              <ProgressLine label="Falhando" value={summary.counts.integrationsFailing} total={summary.counts.integrationsActive} tone="red" />
              <ProgressLine label="Prontos sync" value={telemetry.counts.syncReady} total={telemetry.counts.units} tone="orange" />
            </Panel>

            <Panel eyebrow="Acao rapida" title="Atalhos">
              <div className="nova-integracoes-shortcuts">
                <Link href="/monitoramento/sensores"><span>Sensores</span><strong>abrir</strong></Link>
                <Link href="/monitoramento"><span>Monitoramento</span><strong>abrir</strong></Link>
                <Link href="/administracao/reconciliacao"><span>Reconciliação</span><strong>abrir</strong></Link>
                <Link href="/administracao/automacoes"><span>Automação</span><strong>abrir</strong></Link>
              </div>
            </Panel>

            <Panel eyebrow="Contrato" title="Zabbix seguro">
              <div className="nova-integracoes-rule">
                <p>1. O portal localiza o host por código, nome, serial, MAC e tag.</p>
                <p>2. A escrita só ocorre quando existe match inequívoco.</p>
                <p>3. A tag recomendada é <code>nova.unit_code</code>.</p>
                <p>4. Sem tag explícita, a tela monitora e bloqueia sync automático.</p>
              </div>
            </Panel>
          </aside>
        </div>

        {!showNewConnector ? <NewConnectorPanel action={createIntegration} /> : null}
      </main>
    </NovaLitShell>
  );
}
