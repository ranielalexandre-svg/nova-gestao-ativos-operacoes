import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  KpiTile,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
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
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

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

type UnitHostTelemetry = {
  generatedAt: string;
  sources: Array<{
    id: string;
    code: string;
    name: string;
    ok: boolean;
    message: string;
    targetUrl: string;
    version?: string;
    totalHosts: number;
    matchedUnits: number;
  }>;
  counts: {
    units: number;
    matched: number;
    ambiguous: number;
    unmapped: number;
    online: number;
    degraded: number;
    down: number;
    withProblems: number;
    syncReady: number;
    avgLatencyMs: number | null;
    avgLossPct: number | null;
    maxTemperatureC: number | null;
  };
  items: Array<{
    unit: {
      id: string;
      code: string;
      name: string;
      city: string | null;
      state: string | null;
      isActive: boolean;
    };
    partner: {
      id: string;
      code: string;
      name: string;
    };
    match: {
      status: "matched" | "ambiguous" | "unmatched";
      score: number;
      confidence: number;
      integrationCode?: string;
      hostId?: string;
      host?: string;
      hostName?: string;
      matchedBy: string[];
      candidates: number;
      syncReady: boolean;
    };
    health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
    problems: Array<{ eventid: string; name: string; severity: string; clock: string }>;
  }>;
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

function emptyUnitTelemetry(message = "Telemetria de unidades indisponível.") {
  return {
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "telemetry",
        code: "ZBX",
        name: "Zabbix",
        ok: false,
        message,
        targetUrl: "",
        totalHosts: 0,
        matchedUnits: 0,
      },
    ],
    counts: {
      units: 0,
      matched: 0,
      ambiguous: 0,
      unmapped: 0,
      online: 0,
      degraded: 0,
      down: 0,
      withProblems: 0,
      syncReady: 0,
      avgLatencyMs: null,
      avgLossPct: null,
      maxTemperatureC: null,
    },
    items: [],
  } satisfies UnitHostTelemetry;
}

async function readUnitTelemetry() {
  try {
    return await apiJson<UnitHostTelemetry>("/monitoring/unit-hosts");
  } catch (error) {
    return emptyUnitTelemetry(error instanceof Error ? error.message : "Falha ao carregar telemetria.");
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
    revalidatePath("/monitoramento");
    revalidatePath("/unidades");
    revalidatePath("/equipamentos");

    return {
      status: result.ok ? "success" : "error",
      message: `${result.synced} sincronizada(s), ${result.skipped} ignorada(s), ${result.failed} falha(s). ${result.pending.unmapped} sem host, ${result.pending.ambiguous} ambígua(s), ${result.pending.withoutExplicitTag} sem tag explícita.`,
    };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

function typeLabel(type: string) {
  if (type === "generic_http") return "HTTP";
  return type.toUpperCase();
}

function authLabel(value: string) {
  if (value === "userpass") return "usuário/senha";
  if (value === "token") return "token";
  return "sem auth";
}

function truncateUrl(value: string) {
  return value.replace(/^https?:\/\//, "");
}

function healthTone(ok?: boolean) {
  if (typeof ok === "undefined") return "neutral";
  return ok ? "success" : "critical";
}

function statusLabel(check?: IntegrationCheck) {
  if (!check) return "sem teste";
  const status = check.httpStatus ? `HTTP ${check.httpStatus}` : check.ok ? "ok" : "falha";
  return `${status} · ${check.latencyMs}ms`;
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><ActionForm
        action={updateAction}
        className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 md:grid-cols-2"
        noticeClassName="md:col-span-2"
        submitClassName="md:col-span-2"
        submitLabel="Salvar conector"
        pendingLabel="Salvando..."
        variant="secondary"
      ><input type="hidden" name="id" value={integration.id} /><label className="grid gap-2"><FieldLabel>Código</FieldLabel><input name="code" defaultValue={integration.code} /></label><label className="grid gap-2"><FieldLabel>Nome</FieldLabel><input name="name" defaultValue={integration.name} /></label><label className="grid gap-2"><FieldLabel>Tipo</FieldLabel><select name="type" defaultValue={integration.type}><option value="zabbix">zabbix</option><option value="generic_http">generic_http</option></select></label><label className="grid gap-2"><FieldLabel>Autenticação</FieldLabel><select name="authMode" defaultValue={integration.authMode}><option value="none">none</option><option value="token">token</option><option value="userpass">userpass</option></select></label><label className="grid gap-2 md:col-span-2"><FieldLabel>Base URL</FieldLabel><input name="baseUrl" defaultValue={integration.baseUrl} /></label><label className="grid gap-2 md:col-span-2"><FieldLabel>Caminho</FieldLabel><input name="apiPath" defaultValue={integration.apiPath || ""} placeholder="Opcional" /></label><label className="grid gap-2 md:col-span-2"><FieldLabel>Novo API token</FieldLabel><input name="apiToken" placeholder="Opcional, deixa em branco para preservar" /></label><label className="grid gap-2"><FieldLabel>Novo usuário</FieldLabel><input name="username" placeholder="Opcional" /></label><label className="grid gap-2"><FieldLabel>Nova senha</FieldLabel><input name="password" type="password" placeholder="Opcional" /></label><label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2"><input type="checkbox" name="isActive" defaultChecked={integration.isActive} />
          Ativo
        </label><div className="text-xs leading-5 text-slate-500 md:col-span-2">
          Segredos não são exibidos. Deixe token, usuário e senha em branco para preservar os valores atuais.
        </div>
        {zabbixWithoutAuth ? (
          <div className="rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100 md:col-span-2">
            Este conector Zabbix está em <span className="font-semibold">sem auth</span>. Leitura de
            versão ainda funciona, mas <span className="font-semibold">host.get</span>, telemetria e
            sincronização de host exigem <span className="font-semibold">token</span> ou{" "}
            <span className="font-semibold">usuário/senha</span>.
          </div>
        ) : null}
      </ActionForm><ActionForm
        action={testAction}
        className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"
        submitLabel="Testar agora"
        pendingLabel="Testando..."
        variant="secondary"
      ><input type="hidden" name="id" value={integration.id} /><div><div className="text-sm font-semibold text-slate-50">Teste real</div><p className="mt-2 text-sm leading-6 text-slate-400">
            Valida reachability e, no Zabbix autenticado, consulta versão, hosts e problemas.
          </p></div><div className="rounded-[14px] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300">
          {integration.type === "zabbix"
            ? "apiinfo.version + host.get + problem.get"
            : "GET simples no endpoint configurado"}
        </div></ActionForm></div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function matchLabel(item: UnitHostTelemetry["items"][number]) {
  if (item.match.status === "unmatched") return "sem host";
  if (item.match.status === "ambiguous") return "ambíguo";
  if (!item.match.syncReady) return "sem tag explícita";
  return "pronto";
}

function matchTone(item: UnitHostTelemetry["items"][number]) {
  if (item.match.syncReady) return "success";
  if (item.match.status === "matched") return "attention";
  if (item.match.status === "ambiguous") return "attention";
  return "subtle";
}

function locationLine(unit: UnitHostTelemetry["items"][number]["unit"]) {
  return [unit.city, unit.state].filter(Boolean).join(" / ") || "sem cidade/UF";
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
    <Surface className="p-5 sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start"><SectionIntro
          eyebrow="Zabbix"
          title="Sincronização e vínculo de hosts"
          description="Integrações concentra credenciais, teste, contrato de vínculo e atualização segura dos hosts."
          actions={
            <TonePill tone={sourceFailures ? "attention" : "success"}>
              {sourceFailures ? `${sourceFailures} fonte(s) com alerta` : "fontes ok"}
            </TonePill>
          }
          compact
        />

        {isAdmin ? (
          <ActionForm
            action={syncReadyUnitsAction}
            className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"
            submitLabel="Sincronizar prontos"
            pendingLabel="Sincronizando..."
            variant="secondary"
          ><div className="text-sm font-semibold text-slate-50">
              Lote seguro: {telemetry.counts.syncReady} unidade(s)
            </div><p className="mt-2 text-sm leading-6 text-slate-400">
              Apenas hosts com vínculo explícito entram no lote.
            </p></ActionForm>
        ) : (
          <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="text-sm font-semibold text-slate-50">Leitura administrativa</div><p className="mt-2 text-sm leading-6 text-slate-400">
              Configuração e escrita no Zabbix ficam restritas ao admin.
            </p></div>
        )}
      </div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><KpiTile
          label="Prontas"
          value={telemetry.counts.syncReady}
          meta="host certo e tag explícita"
          tone={telemetry.counts.syncReady ? "success" : "neutral"}
        /><KpiTile
          label="Vinculadas"
          value={telemetry.counts.matched}
          meta={`${matchedNotReady} pedem tag explícita`}
          tone={matchedNotReady ? "attention" : "success"}
        /><KpiTile
          label="Sem host"
          value={telemetry.counts.unmapped}
          meta="sem candidato confiável"
          tone={telemetry.counts.unmapped ? "attention" : "success"}
        /><KpiTile
          label="Ambíguas"
          value={telemetry.counts.ambiguous}
          meta="mais de um candidato"
          tone={telemetry.counts.ambiguous ? "attention" : "success"}
        /><KpiTile
          label="Bloqueadas"
          value={blocked}
          meta="fora do lote automático"
          tone={blocked ? "attention" : "success"}
        /></div><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"><div>
          {pendingRows.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Host</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Ação</th></tr></TableHead><tbody>
                  {pendingRows.map((item) => (
                    <tr key={`sync-pending-${item.unit.id}`} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-sky-100">
                          {item.unit.code}
                        </Link><div className="mt-1 max-w-[300px] text-sm text-slate-300">{item.unit.name}</div><div className="mt-1 text-xs text-slate-500">{locationLine(item.unit)}</div></TableCell><TableCell><div className="max-w-[320px] truncate text-sm font-medium text-slate-100">
                          {item.match.hostName || item.match.host || "sem host confiável"}
                        </div><div className="mt-1 text-xs text-slate-500">
                          {item.match.integrationCode
                            ? `${item.match.integrationCode} · ${item.match.confidence}%`
                            : `${item.match.candidates} candidato(s)`}
                        </div></TableCell><TableCell><TonePill tone={matchTone(item)}>{matchLabel(item)}</TonePill></TableCell><TableCell><div className="font-mono text-xs text-slate-400">nova.unit_code={item.unit.code}</div></TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum bloqueio de sincronização"
              description="As unidades ativas no recorte estão aptas ou não há telemetria carregada."
            />
          )}
        </div><div className="grid content-start gap-3"><div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="text-sm font-semibold text-slate-50">Contrato usado pelo portal</div><div className="mt-3 grid gap-2"><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Tag principal</div><div className="mt-1 font-mono text-sm text-slate-100">nova.unit_code</div></div><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Inventário</div><div className="mt-1 text-sm text-slate-100">unidade, parceiro, cidade, serial e MAC</div></div><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Escrita</div><div className="mt-1 text-sm text-slate-100">somente host inequívoco</div></div></div></div>

          {telemetry.sources.map((source) => (
            <div key={`zbx-source-${source.id}`} className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-slate-50">{source.code} · {source.name}</div><div className="mt-1 truncate text-xs text-slate-500">{source.targetUrl || "sem URL"}</div></div><TonePill tone={source.ok ? "success" : "attention"}>
                  {source.ok ? "lendo" : "alerta"}
                </TonePill></div><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Hosts</div><div className="mt-1 font-semibold text-slate-50">{source.totalHosts}</div></div><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Match</div><div className="mt-1 font-semibold text-slate-50">{source.matchedUnits}</div></div><div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Versão</div><div className="mt-1 truncate font-semibold text-slate-50">{source.version || "-"}</div></div></div><div className="mt-3 text-sm leading-5 text-slate-400">{source.message}</div></div>
          ))}
        </div></div></Surface>
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
    <><ZabbixReadinessPanel telemetry={telemetry} isAdmin={false} /><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Conectores"
          title="Leitura disponível"
          description="Endpoints e credenciais."
          actions={<TonePill tone="neutral">{formatDateTime(summary.checkedAt)}</TonePill>}
          compact
        /><div className="mt-4 grid gap-3">
          {summary.integrationChecks.length ? (
            summary.integrationChecks.map((check) => (
              <div key={check.id} className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-slate-50">{check.code} · {check.name}</div><div className="mt-1 truncate text-xs text-slate-500">{check.targetUrl}</div></div><TonePill tone={check.ok ? "success" : "attention"}>{statusLabel(check)}</TonePill></div></div>
            ))
          ) : (
            <EmptyState title="Nenhum conector ativo" description="Cadastre uma integração como admin para iniciar a leitura." />
          )}
        </div></Surface></>
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
      revalidatePath("/monitoramento");

      return {
        status: result.ok ? "success" : "error",
        message: `${result.message} · ${result.latencyMs}ms`,
      };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [summary, telemetry] = await Promise.all([
    apiJson<MonitoringSummary>("/monitoring/summary"),
    readUnitTelemetry(),
  ]);

  if (!isAdmin) {
    return (
      <AppShell
        title="Integrações"
        subtitle="Leitura dos conectores e contrato de vínculo com o Zabbix."
      ><Surface className="p-5 sm:p-6"><SectionIntro
            eyebrow="Integrações"
            title="Conectores sem sair para o dashboard"
            description="Você continua nesta rota para entender o estado das fontes; edição e sincronização ficam com admin."
            actions={
              <Link
                href="/monitoramento"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Ver monitoramento
              </Link>
            }
            compact
          /></Surface><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><KpiTile
            label="Conectores"
            value={summary.counts.integrationsTotal}
            meta={`${summary.counts.integrationsActive} ativos`}
            tone={summary.counts.integrationsActive ? "info" : "neutral"}
          /><KpiTile
            label="Saudáveis"
            value={summary.counts.integrationsHealthy}
            meta={`${summary.counts.integrationsFailing} falhando`}
            tone={summary.counts.integrationsFailing ? "attention" : "success"}
          /><KpiTile
            label="Zabbix"
            value={summary.zabbixSnapshots.length}
            meta="snapshot(s) ativos"
            tone={summary.zabbixSnapshots.length ? "success" : "neutral"}
          /><KpiTile
            label="Unidades"
            value={telemetry.counts.units}
            meta={`${telemetry.counts.matched} com host`}
            tone={telemetry.counts.unmapped || telemetry.counts.ambiguous ? "attention" : "success"}
          /></section><ReadOnlyIntegrations summary={summary} telemetry={telemetry} /></AppShell>
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

  const checkById = new Map(summary.integrationChecks.map((item) => [item.id, item]));
  const zabbixById = new Map(summary.zabbixSnapshots.map((item) => [item.id, item]));

  return (
    <AppShell
      title="Integrações"
      subtitle="Conectores, endpoints e credenciais que alimentam o monitoramento."
    ><Surface className="p-5 sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start"><SectionIntro
            eyebrow="Configuração"
            title="Conectores, credenciais e sync"
            description="Aqui ficam endpoint, teste, contrato de host e sincronização segura. Monitoramento fica livre para o dashboard NOC."
            compact
          /><div className="flex flex-wrap gap-2 xl:justify-end"><Link
              href="/monitoramento"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Ver monitoramento
            </Link><a
              href="#novo-conector"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-slate-50 transition hover:bg-[#1b2946]"
            >
              Novo conector
            </a></div></div></Surface><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Conectores</div><div className="mt-3 text-[26px] font-semibold text-slate-50">{summary.counts.integrationsTotal}</div><div className="mt-1 text-sm text-slate-400">{summary.counts.integrationsActive} ativos</div></div><div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Saudáveis</div><div className="mt-3 text-[26px] font-semibold text-slate-50">{summary.counts.integrationsHealthy}</div><div className="mt-1 text-sm text-slate-400">{summary.counts.integrationsFailing} falhando</div></div><div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Zabbix</div><div className="mt-3 text-[26px] font-semibold text-slate-50">{summary.zabbixSnapshots.length}</div><div className="mt-1 text-sm text-slate-400">snapshot(s) ativos</div></div><div className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Filtro atual</div><div className="mt-3 text-[26px] font-semibold text-slate-50">{integrationsResponse.meta.total}</div><div className="mt-1 text-sm text-slate-400">resultado(s)</div></div></section><ZabbixReadinessPanel telemetry={telemetry} isAdmin={isAdmin} /><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Consulta"
          title="Buscar conectores"
          description="Filtros persistem na URL para retornar à mesma visão de configuração."
          actions={
            <Link href="/integracoes" className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]">
              Limpar
            </Link>
          }
          compact
        /><form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="grid gap-2 xl:col-span-2"><FieldLabel>Busca</FieldLabel><input name="q" defaultValue={q} placeholder="Código, nome, tipo ou URL" /></label><label className="grid gap-2"><FieldLabel>Tipo</FieldLabel><select name="type" defaultValue={type}><option value="all">Todos</option><option value="zabbix">zabbix</option><option value="generic_http">generic_http</option></select></label><label className="grid gap-2"><FieldLabel>Status</FieldLabel><select name="active" defaultValue={active}><option value="all">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></select></label><label className="grid gap-2"><FieldLabel>Ordenar por</FieldLabel><select name="sortBy" defaultValue={sortBy}><option value="code">Código</option><option value="name">Nome</option><option value="type">Tipo</option><option value="createdAt">Cadastro</option></select></label><label className="grid gap-2"><FieldLabel>Direção</FieldLabel><select name="sortDir" defaultValue={sortDir}><option value="asc">Ascendente</option><option value="desc">Descendente</option></select></label><label className="grid gap-2 md:col-span-1 xl:col-span-2"><FieldLabel>Página</FieldLabel><select name="pageSize" defaultValue={String(pageSize)}><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select></label><button className="md:col-span-1 xl:col-span-4">Aplicar filtros</button></form></Surface><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Base"
          title="Conectores cadastrados"
          description="Conectores e testes."
          compact
        /><div className="mt-4">
          {integrationsResponse.items.length ? (
            <div className="grid gap-3">
              {integrationsResponse.items.map((integration) => {
                const check = checkById.get(integration.id);
                const zabbix = zabbixById.get(integration.id);

                return (
                  <article
                    key={integration.id}
                    className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"
                  ><div className="grid gap-3 border-b border-white/[0.08] pb-4 lg:grid-cols-[minmax(0,1fr)_120px_150px_120px_140px] lg:items-center"><div className="min-w-0"><div className="font-semibold text-slate-50">
                          {integration.code} · {integration.name}
                        </div><div className="mt-1 truncate text-sm text-slate-500">
                          {truncateUrl(integration.baseUrl)}
                          {integration.apiPath || ""}
                        </div></div><div className="text-sm text-slate-300">{typeLabel(integration.type)}</div><div className="text-sm text-slate-400">{authLabel(integration.authMode)}</div><div><TonePill tone={integration.isActive ? "success" : "subtle"}>
                          {integration.isActive ? "ativo" : "inativo"}
                        </TonePill></div><div className="flex items-center gap-2 lg:justify-end"><TonePill tone={healthTone(check?.ok)}>{statusLabel(check)}</TonePill></div></div><div className="pt-4">
                      {zabbix ? (
                        <div className="mb-4 grid gap-3 md:grid-cols-3"><div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Versão</div><div className="mt-2 text-lg font-semibold text-slate-50">{zabbix.version || "-"}</div></div><div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Hosts</div><div className="mt-2 text-lg font-semibold text-slate-50">{zabbix.monitoredHosts ?? "-"}</div></div><div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Problemas</div><div className="mt-2 text-lg font-semibold text-slate-50">{zabbix.openProblems ?? "-"}</div></div></div>
                      ) : null}

                      <ConnectorConfigForm
                        integration={integration}
                        updateAction={updateIntegration}
                        testAction={testIntegration}
                      /></div></article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nenhum conector encontrado"
              description="Ajuste filtros ou cadastre um novo conector para alimentar o monitoramento."
            />
          )}
        </div></Surface><ListPagination pathname="/integracoes" searchParams={params} meta={integrationsResponse.meta} /><Surface id="novo-conector" className="p-5 sm:p-6"><SectionIntro
          eyebrow="Administração"
          title="Novo conector"
          description="Endpoint e credenciais de monitoramento."
          compact
        /><ActionForm
          action={createIntegration}
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
          noticeClassName="md:col-span-2 xl:col-span-6"
          submitClassName="md:col-span-2 xl:col-span-6"
          submitLabel="Criar conector"
          pendingLabel="Criando..."
        ><label className="grid gap-2"><FieldLabel>Código</FieldLabel><input name="code" placeholder="ZBX" /></label><label className="grid gap-2"><FieldLabel>Nome</FieldLabel><input name="name" placeholder="Zabbix principal" /></label><label className="grid gap-2"><FieldLabel>Tipo</FieldLabel><select name="type" defaultValue="zabbix"><option value="zabbix">zabbix</option><option value="generic_http">generic_http</option></select></label><label className="grid gap-2"><FieldLabel>Autenticação</FieldLabel><select name="authMode" defaultValue="none"><option value="none">none</option><option value="token">token</option><option value="userpass">userpass</option></select></label><label className="grid gap-2 xl:col-span-2"><FieldLabel>Base URL</FieldLabel><input name="baseUrl" placeholder="https://monitoramento.exemplo/zabbix" /></label><label className="grid gap-2 md:col-span-2"><FieldLabel>Caminho opcional</FieldLabel><input name="apiPath" placeholder="/api_jsonrpc.php" /></label><label className="grid gap-2 md:col-span-2"><FieldLabel>API token</FieldLabel><input name="apiToken" placeholder="Opcional" /></label><label className="grid gap-2"><FieldLabel>Usuário</FieldLabel><input name="username" placeholder="Opcional" /></label><label className="grid gap-2"><FieldLabel>Senha</FieldLabel><input name="password" type="password" placeholder="Opcional" /></label></ActionForm></Surface></AppShell>
  );
}
