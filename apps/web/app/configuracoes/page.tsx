import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type ConfigTab = "config" | "backup" | "logs" | "licenca";

const CONFIG_TABS: Array<{ key: ConfigTab; label: string; href: string }> = [
  { key: "config", label: "Config", href: "/configuracoes?tab=config" },
  { key: "backup", label: "Backup", href: "/configuracoes?tab=backup" },
  { key: "logs", label: "Logs", href: "/configuracoes?tab=logs" },
  { key: "licenca", label: "Licença", href: "/configuracoes?tab=licenca" },
];

type IntegrationSettings = {
  environment?: string;
  allowDestructiveActions?: boolean;
  enableAutomation?: boolean;
  enableZabbixSync?: boolean;
  enableReports?: boolean;
  enableCsvImport?: boolean;
  runtime?: {
    uploadDir?: string;
    importedDataPathConfigured?: boolean;
    zabbixTelemetryCacheMs?: number;
    zabbixReportCacheMs?: number;
  };
  secrets?: {
    jwtSecret?: "configured" | "weak" | "missing" | string;
    integrationSecretKey?: "configured" | "weak" | "missing" | string;
  };
  counts?: {
    activeIntegrations?: number;
    activeAutomationRules?: number;
    enabledReportTemplates?: number;
  };
};

type SelectRow = {
  label: string;
  value: string;
  options: string[];
};

type ToggleRow = {
  label: string;
  checked: boolean;
};

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

function resolveConfigTab(value: string): ConfigTab {
  if (value === "geral") return "config";
  if (value === "seguranca") return "logs";
  if (value === "integracoes") return "config";
  if (CONFIG_TABS.some((tab) => tab.key === value)) return value as ConfigTab;
  return "config";
}

function durationText(value: unknown, fallback: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value >= 1000) return `${Math.round(value / 1000)}s`;
  return `${value}ms`;
}

function boolValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function SettingsTabs({ activeTab }: { activeTab: ConfigTab }) {
  return (
    <nav className="nova-config-board-tabs" aria-label="Seções de configuração">
      {CONFIG_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className="nova-config-board-tab"
          data-active={tab.key === activeTab}
        >
          {tab.key === "config" ? <i aria-hidden="true" /> : null}
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function BoardPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nova-config-board-panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SelectSetting({ label, value, options }: SelectRow) {
  return (
    <label className="nova-config-board-select-row">
      <span>{label}</span>
      <select defaultValue={value} aria-label={label}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleSetting({ label, checked }: ToggleRow) {
  return (
    <div className="nova-config-board-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className="nova-config-board-toggle"
        data-checked={checked}
        aria-label={label}
        aria-pressed={checked}
      >
        <i />
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="nova-config-board-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function readTabRows(activeTab: ConfigTab, settings: IntegrationSettings): SelectRow[] {
  const runtime = settings.runtime || {};
  const backupWindow = runtime.importedDataPathConfigured ? "03:00" : "03:00";

  if (activeTab === "backup") {
    return [
      { label: "Frequência", value: "Diário", options: ["Diário", "Semanal", "Mensal"] },
      { label: "Retenção", value: "30 dias", options: ["7 dias", "30 dias", "90 dias"] },
      { label: "Janela", value: backupWindow, options: [backupWindow, "01:00", "05:00"] },
    ];
  }

  if (activeTab === "logs") {
    return [
      { label: "Nível", value: "Operacional", options: ["Operacional", "Auditoria", "Debug"] },
      { label: "Retenção", value: "90 dias", options: ["30 dias", "90 dias", "180 dias"] },
      { label: "Auditoria", value: "Ativa", options: ["Ativa", "Somente leitura", "Desativada"] },
    ];
  }

  if (activeTab === "licenca") {
    return [
      { label: "Plano", value: "Enterprise", options: ["Enterprise", "Professional", "Essential"] },
      { label: "Usuários", value: "Ilimitado", options: ["Ilimitado", "100", "50"] },
      { label: "Suporte", value: "Prioritário", options: ["Prioritário", "Padrão", "Básico"] },
    ];
  }

  return [
    { label: "Tema", value: "Escuro", options: ["Escuro", "Claro", "Automático"] },
    { label: "Cor primária", value: "Laranja", options: ["Laranja", "Azul", "Verde"] },
    { label: "Densidade", value: "Padrão", options: ["Padrão", "Compacta", "Confortável"] },
  ];
}

function readRuleRows(activeTab: ConfigTab, settings: IntegrationSettings): ToggleRow[] {
  const automationEnabled = boolValue(settings.enableAutomation);
  const reportsEnabled = boolValue(settings.enableReports);
  const zabbixSyncEnabled = boolValue(settings.enableZabbixSync);
  const csvEnabled = boolValue(settings.enableCsvImport);

  if (activeTab === "backup") {
    return [
      { label: "Executar backup automaticamente", checked: true },
      { label: "Validar integridade após backup", checked: reportsEnabled },
      { label: "Notificar falhas por e-mail", checked: automationEnabled },
    ];
  }

  if (activeTab === "logs") {
    return [
      { label: "Registrar ações administrativas", checked: true },
      { label: "Alertar falhas críticas", checked: automationEnabled },
      { label: "Permitir exportação de logs", checked: reportsEnabled },
    ];
  }

  if (activeTab === "licenca") {
    return [
      { label: "Renovação automática", checked: true },
      { label: "Validar licença no login", checked: true },
      { label: "Bloquear uso expirado", checked: csvEnabled },
    ];
  }

  return [
    { label: "Criar chamados automaticamente", checked: Boolean(settings.allowDestructiveActions) },
    { label: "Fechar chamados automaticamente", checked: automationEnabled },
    { label: "Verificar links a cada 5 minutos", checked: zabbixSyncEnabled },
  ];
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/configuracoes");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/dashboard");
  }

  const params = await resolveSearchParams(searchParams);
  const activeTab = resolveConfigTab(readStringParam(params, "tab", "config"));
  const settingsResult = await readSettings();
  const settings = settingsResult.data;
  const runtime = settings.runtime || {};
  const selectRows = readTabRows(activeTab, settings);
  const ruleRows = readRuleRows(activeTab, settings);
  const environmentLabel = "Produção";

  return (
    <NovaLitShell activeHref="/configuracoes" hidePageHeader>
      <main className="nova-config-board-page">
        <header className="nova-config-board-heading">
          <span>20.</span>
          <h1>Configurações do sistema</h1>
        </header>

        <section className="nova-config-board-surface" aria-label="Configurações do sistema">
          <SettingsTabs activeTab={activeTab} />

          <div className="nova-config-board-grid">
            <BoardPanel title={activeTab === "config" ? "Aparência" : CONFIG_TABS.find((tab) => tab.key === activeTab)?.label || "Config"}>
              <div className="nova-config-board-select-list">
                {selectRows.map((row) => (
                  <SelectSetting key={row.label} {...row} />
                ))}
              </div>
            </BoardPanel>

            <BoardPanel title="Regras operacionais" className="nova-config-board-panel-rules">
              <div className="nova-config-board-toggle-list">
                {ruleRows.map((row) => (
                  <ToggleSetting key={row.label} {...row} />
                ))}
              </div>
            </BoardPanel>

            <BoardPanel title="Informações do sistema" className="nova-config-board-panel-info">
              <div className="nova-config-board-info-list">
                <InfoRow label="Versão" value="2.4.3" />
                <InfoRow label="Ambiente" value={environmentLabel} />
                <InfoRow label="Último backup" value="30/04/2026 03:00" />
                <InfoRow label="Próximo backup" value="01/05/2026 03:00" />
              </div>
              {settingsResult.error ? (
                <p className="nova-config-board-note">{settingsResult.error}</p>
              ) : null}
              <p className="nova-config-board-note">
                Cache: {durationText(runtime.zabbixTelemetryCacheMs, "45s")} / {durationText(runtime.zabbixReportCacheMs, "180s")}
              </p>
            </BoardPanel>
          </div>
        </section>
      </main>
    </NovaLitShell>
  );
}
