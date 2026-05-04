import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RightPanel, SectionIntro, StatCard, Surface, TonePill } from "@/components/ops-ui";
import { API_BASE_URL } from "@/lib/api";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type CheckStatus = "ok" | "warning" | "error";

type HealthCheck = {
  name: string;
  status: CheckStatus;
  detail: string;
  required: boolean;
};

type HealthReadyResponse = {
  ok: boolean;
  service: string;
  database?: string;
  timestamp?: string;
  checks?: HealthCheck[];
  summary?: {
    passed: number;
    warnings: number;
    failed: number;
  };
};

type IntegrationSettings = {
  zabbixBaseUrl: string;
  grafanaBaseUrl: string;
  monitoringRefreshSeconds: number;
  integrations: Array<{
    code: string;
    name: string;
    type: string;
    baseUrl: string;
    apiPath: string | null;
  }>;
};

function statusTone(status: CheckStatus | boolean) {
  if (status === true || status === "ok") return "success";
  if (status === "warning") return "attention";
  return "critical";
}

function statusLabel(status: CheckStatus) {
  if (status === "ok") return "OK";
  if (status === "warning") return "Atenção";
  return "Falha";
}

function checkLabel(name: string) {
  const labels: Record<string, string> = {
    database: "Banco de dados",
    uploadDir: "Anexos",
    JWT_SECRET: "Sessão web",
    INTEGRATION_SECRET_KEY: "Segredos de integração",
    api: "API",
  };

  return labels[name] || name;
}

function normalizeHealthPayload(raw: unknown): HealthReadyResponse | null {
  if (raw && typeof raw === "object" && "checks" in raw) {
    return raw as HealthReadyResponse;
  }

  const message = raw && typeof raw === "object" ? (raw as { message?: unknown }).message : null;
  if (message && typeof message === "object" && "checks" in message) {
    return message as HealthReadyResponse;
  }

  return null;
}

async function readHealthSnapshot() {
  try {
    const response = await fetch(`${API_BASE_URL}/health/ready`, { cache: "no-store" });
    const raw = await response.json().catch(() => null);
    const payload = normalizeHealthPayload(raw);

    return {
      ok: response.ok && Boolean(payload?.ok),
      status: response.status,
      payload,
      error: response.ok ? "" : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: error instanceof Error ? error.message : "API indisponível.",
    };
  }
}

async function readIntegrationSettings() {
  try {
    return {
      data: await apiJson<IntegrationSettings>("/settings/integrations"),
      error: "",
    };
  } catch (error) {
    return {
      data: {
        zabbixBaseUrl: "",
        grafanaBaseUrl: "",
        monitoringRefreshSeconds: 0,
        integrations: [],
      } satisfies IntegrationSettings,
      error: error instanceof Error ? error.message : "Configurações indisponíveis.",
    };
  }
}

const SETTINGS_TABS = [
  { key: "geral", label: "Geral" },
  { key: "backup", label: "Backup" },
  { key: "seguranca", label: "Segurança" },
  { key: "integracoes", label: "Integrações" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

function readSettingsTab(value: string): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.key === value) ? (value as SettingsTab) : "geral";
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/configuracoes");
  if (normalizeRole(session.user?.role || "") !== "admin") redirect("/dashboard");

  const params = await resolveSearchParams(searchParams);
  const activeTab = readSettingsTab(readStringParam(params, "tab", "geral"));
  const [health, integrationSettings] = await Promise.all([
    readHealthSnapshot(),
    readIntegrationSettings(),
  ]);
  const checks = health.payload?.checks?.length
    ? health.payload.checks
    : [{
        name: "api",
        status: health.ok ? "ok" as const : "error" as const,
        detail: health.error || "Readiness sem payload estruturado.",
        required: true,
      }];
  const databaseCheck = checks.find((check) => check.name === "database");
  const uploadCheck = checks.find((check) => check.name === "uploadDir");
  const secretChecks = checks.filter((check) => check.name.includes("SECRET"));
  const securityTone = secretChecks.some((check) => check.status === "error")
    ? "critical"
    : secretChecks.some((check) => check.status === "warning")
      ? "attention"
      : "success";
  const activeIntegrations = integrationSettings.data.integrations;
  const settingsGroups = [
    { title: "Aparência", description: "Tema NOVA, densidade de tabelas e preferências visuais.", tone: "success" },
    { title: "Relatórios", description: "Cabeçalho, rodapé, formatos PDF/DOCX e política de gráficos.", tone: uploadCheck?.status === "ok" ? "success" : "attention" },
    { title: "Operação", description: "SLA, filas, severidades, automações e notificações.", tone: activeIntegrations.length ? "success" : "attention" },
    { title: "Segurança", description: "Sessão, perfis, auditoria e integrações sensíveis.", tone: securityTone },
  ];
  const healthSummary = health.payload?.summary || {
    passed: checks.filter((check) => check.status === "ok").length,
    warnings: checks.filter((check) => check.status === "warning").length,
    failed: checks.filter((check) => check.status === "error").length,
  };
  const readinessTone = healthSummary.failed
    ? "critical"
    : healthSummary.warnings
      ? "attention"
      : "success";
  const readinessLabel = healthSummary.failed
    ? "bloqueado"
    : healthSummary.warnings
      ? "atenção"
      : "pronto";
  const specialRules = [
    { label: "Criar chamados automaticamente", checked: activeIntegrations.length > 0, tone: activeIntegrations.length ? "success" : "attention", href: "/automacao" },
    { label: "Fechar chamados automaticamente", checked: false, tone: "neutral", href: "/automacao" },
    { label: "Verificar links a cada 5 minutos", checked: health.ok, tone: health.ok ? "success" : "critical", href: "/integracoes" },
  ];

  return (
    <AppShell title="Configurações do Sistema" subtitle="Parâmetros do produto, regras operacionais e governança do ambiente.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-4">
            <StatCard label="API" value={health.ok ? "OK" : "Falha"} detail={health.status ? `HTTP ${health.status}` : "sem resposta"} tone={statusTone(health.ok)} />
            <StatCard label="Banco" value={databaseCheck ? statusLabel(databaseCheck.status) : "-"} detail={databaseCheck?.detail || "sem leitura"} tone={statusTone(databaseCheck?.status || "error")} />
            <StatCard label="Anexos" value={uploadCheck ? statusLabel(uploadCheck.status) : "-"} detail={uploadCheck?.detail || "sem leitura"} tone={statusTone(uploadCheck?.status || "error")} />
            <StatCard label="Integrações" value={activeIntegrations.length} detail="ativas no ambiente" tone={activeIntegrations.length ? "success" : "attention"} />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {settingsGroups.map((group) => (
              <Surface key={group.title}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="nds-label">Configuração</div>
                    <h2 className="mt-1 text-[15px] font-black text-white">{group.title}</h2>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{group.description}</p>
                  </div>
                  <TonePill tone={group.tone}>{group.tone}</TonePill>
                </div>
              </Surface>
            ))}
          </div>

          <Surface>
            <SectionIntro
              eyebrow="Sistema"
              title="Preferências centrais"
              description="Configuração visual e operacional no formato de tabs e toggles da prancha."
              compact
            />
            <div className="nova-settings-tabs mt-2">
              {SETTINGS_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/configuracoes?tab=${tab.key}`}
                  className="nova-settings-tab"
                  data-active={activeTab === tab.key ? "true" : "false"}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            {activeTab === "geral" ? (
              <div className="mt-2 nova-side-grid nova-side-grid--320 nova-side-grid--lg">
                <div className="grid gap-2">
                  {specialRules.map((rule) => (
                    <Link key={rule.label} href={rule.href} className="nova-settings-toggle-row">
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-white">{rule.label}</div>
                        <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">Abrir configuração relacionada</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TonePill tone={rule.tone}>{rule.checked ? "ativo" : "manual"}</TonePill>
                        <span className="nds-toggle" data-checked={rule.checked ? "true" : "false"} aria-hidden="true" />
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="nds-card">
                  <div className="nds-label">Informações do sistema</div>
                  <div className="mt-2 grid gap-2 text-[11px] text-[var(--nova-text-muted)]">
                    <div className="flex items-center justify-between gap-2"><span>Serviço</span><span className="text-slate-100">{health.payload?.service || "API NOVA"}</span></div>
                    <div className="flex items-center justify-between gap-2"><span>Ambiente</span><span className="text-slate-100">Produção</span></div>
                    <div className="flex items-center justify-between gap-2"><span>Readiness</span><TonePill tone={readinessTone}>{readinessLabel}</TonePill></div>
                    <div className="flex items-center justify-between gap-2"><span>Integrações</span><span className="text-slate-100">{activeIntegrations.length}</span></div>
                  </div>
                </div>
              </div>
            ) : null}
            {activeTab === "backup" ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Link href="/importacao" className="nds-card block">
                  <div className="nds-label">Importação</div>
                  <div className="mt-1 text-[12px] font-black text-white">Validar CSV</div>
                </Link>
                <Link href="/export/units" className="nds-card block">
                  <div className="nds-label">Exportação</div>
                  <div className="mt-1 text-[12px] font-black text-white">Unidades CSV</div>
                </Link>
                <Link href="/export/equipments" className="nds-card block">
                  <div className="nds-label">Exportação</div>
                  <div className="mt-1 text-[12px] font-black text-white">Ativos CSV</div>
                </Link>
                <Link href="/export/partners" className="nds-card block">
                  <div className="nds-label">Exportação</div>
                  <div className="mt-1 text-[12px] font-black text-white">Parceiros CSV</div>
                </Link>
              </div>
            ) : null}
            {activeTab === "seguranca" ? (
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <div className="nds-card"><div className="nds-label">Segredos</div><div className="mt-1 text-[12px] font-black text-white">{secretChecks.length}</div></div>
                <Link href="/perfis" className="nds-card block"><div className="nds-label">Permissões</div><div className="mt-1 text-[12px] font-black text-white">Gerenciar perfis</div></Link>
                <Link href="/usuarios" className="nds-card block"><div className="nds-label">Acesso</div><div className="mt-1 text-[12px] font-black text-white">Gerenciar usuários</div></Link>
              </div>
            ) : null}
            {activeTab === "integracoes" ? (
              <div className="mt-2 grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TonePill tone={activeIntegrations.length ? "info" : "attention"}>{activeIntegrations.length} ativa(s)</TonePill>
                  <Link href="/integracoes" className="nds-button" data-variant="secondary">Gerenciar</Link>
                </div>
                {activeIntegrations.length ? activeIntegrations.map((integration) => (
                  <div key={integration.code} className="nds-card nova-settings-integration-row text-[11px]">
                    <div className="font-black text-white">{integration.code}</div>
                    <div className="min-w-0">
                      <div className="truncate text-slate-200">{integration.name}</div>
                      <div className="mt-1 truncate text-[10px] text-slate-500">{integration.baseUrl}</div>
                    </div>
                    <TonePill tone="info">{integration.type}</TonePill>
                  </div>
                )) : (
                  <div className="nds-empty text-[11px] text-slate-500">
                    Nenhuma integração ativa encontrada.
                  </div>
                )}
              </div>
            ) : null}
          </Surface>

          <Surface>
            <SectionIntro
              eyebrow="Readiness"
              title="Saúde do ambiente"
              description="Verificação real usada antes do corte: API, banco, anexos e segredos mínimos."
              actions={<TonePill tone={readinessTone}>{readinessLabel}</TonePill>}
              compact
            />
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              <div className="nds-card">
                <div className="nds-label">Checks OK</div>
                <div className="mt-1 text-[18px] font-black text-white">{healthSummary.passed}</div>
              </div>
              <div className="nds-card">
                <div className="nds-label">Atenção</div>
                <div className="mt-1 text-[18px] font-black text-[var(--nova-warning)]">{healthSummary.warnings}</div>
              </div>
              <div className="nds-card">
                <div className="nds-label">Falhas</div>
                <div className="mt-1 text-[18px] font-black text-[color:var(--nova-danger)]">{healthSummary.failed}</div>
              </div>
            </div>
            <div className="mt-2 overflow-hidden rounded-[6px] border border-white/[0.08]">
              {checks.map((check) => (
                <div key={check.name} className="nova-settings-health-row border-b border-white/[0.06] bg-[var(--nova-surface-3)] px-3 py-2 text-[11px] last:border-b-0">
                  <div className="font-bold text-slate-100">{checkLabel(check.name)}</div>
                  <TonePill tone={statusTone(check.status)}>{statusLabel(check.status)}</TonePill>
                  <div className="text-slate-400">{check.detail}</div>
                </div>
              ))}
            </div>
            {health.payload?.timestamp ? (
              <div className="mt-2 text-[10px] text-slate-500">
                Última leitura: {new Date(health.payload.timestamp).toLocaleString("pt-BR")}
              </div>
            ) : null}
          </Surface>

        </div>

        <RightPanel title="Ações rápidas" description="Rotas administrativas relacionadas.">
          <Link href="/usuarios" className="nds-card block text-[12px] font-bold text-white hover:border-[var(--nova-primary)]/30">Usuários</Link>
          <Link href="/perfis" className="nds-card block text-[12px] font-bold text-white hover:border-[var(--nova-primary)]/30">Perfis</Link>
          <div className="nds-card text-[11px] leading-5 text-slate-300">
            <div className="nds-label">API interna</div>
            <div className="mt-2 break-all text-slate-100">{API_BASE_URL}</div>
          </div>
          <div className="nds-card border-[color-mix(in_srgb,var(--nova-primary)_28%,transparent)] bg-[var(--nova-primary-soft)] text-[11px] leading-5 text-slate-100">
            Configurações destrutivas devem continuar protegidas por confirmação explícita e auditoria.
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
