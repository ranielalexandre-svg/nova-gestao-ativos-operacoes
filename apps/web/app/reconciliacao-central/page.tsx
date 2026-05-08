import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  DenseTable,
  EmptyState,
  KpiTile,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionHeader,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import {
  formatPercent,
  healthTone,
  readUnitHostTelemetry,
  type UnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type SyncReadyResult = {
  ok: boolean;
  generatedAt: string;
  limit: number;
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
  results: Array<{
    unit: {
      id: string;
      code: string;
      name: string;
      partnerCode: string;
      partnerName: string;
    };
    ok: boolean;
    status: "synced" | "skipped" | "failed";
    message: string;
    integrationCode?: string;
    hostId?: string;
    hostName?: string;
  }>;
};

type OperationalDataSummary = {
  sourceAvailable: boolean;
  message?: string;
  expectedPath?: string | null;
  generatedAt?: string;
  redactedSecrets?: boolean;
  summary?: {
    raw: Record<string, number>;
    normalized: Record<string, number>;
  };
  sources?: Record<string, string>;
};

type OperationalSignal = {
  backupLinks: number;
  links: number;
  phones: number;
  contracts: number;
  starlinks: number;
  equipments: number;
  hasMacOnu: boolean;
};

type OperationalReconciliation = {
  sourceAvailable: boolean;
  message?: string;
  expectedPath?: string | null;
  generatedAt?: string | null;
  redactedSecrets?: boolean;
  counts: {
    importedUnits: number;
    currentUnits: number;
    matchedUnits: number;
    weakUnitMatches: number;
    unmatchedImportedUnits: number;
    unmatchedCurrentUnits: number;
    importedPartners: number;
    currentPartners: number;
    matchedPartners: number;
    importedEquipments: number;
    currentEquipments: number;
    matchedEquipments: number;
    starlinks: number;
  };
  unmatchedImportedUnits: Array<{
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    bestScore: number;
    bestCurrentUnit: { id: string; code: string; name: string } | null;
    signal: OperationalSignal;
  }>;
  weakUnitMatches: Array<{
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    score: number;
    currentUnit: { id: string; code: string; name: string } | null;
    signal: OperationalSignal;
  }>;
  unmatchedCurrentUnits: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    partnerName: string;
  }>;
  unmatchedImportedPartners: Array<{
    code: string;
    name: string;
    contacts: number;
    primaryUnitCount: number;
    backupUnitCount: number;
  }>;
  unmatchedImportedEquipments: Array<{
    tag: string;
    name: string;
    type: string;
    serialNumber: string | null;
    unitCode: string;
    partnerCode: string;
    source: string;
  }>;
};

async function syncReadyZabbixAction(
  state: ActionFeedbackState,
): Promise<ActionFeedbackState> {
  "use server";
  void state;

  try {
    const result = await apiJson<SyncReadyResult>("/units/sync-zabbix-ready", {
      method: "POST",
    });

    revalidatePath("/reconciliacao");
    revalidatePath("/sensores");
    revalidatePath("/unidades");

    const message =
      result.readyUnits === 0
        ? "Nenhuma unidade com vínculo explícito pronta para sincronizar."
        : `${result.synced} host(s) sincronizado(s), ${result.skipped} ignorado(s) e ${result.failed} falha(s).`;

    return {
      status: result.failed ? "error" : "success",
      message,
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionErrorMessage(error),
    };
  }
}

async function readOperationalDataSummary() {
  try {
    return (await apiJson<OperationalDataSummary>("/operational-data/summary")) satisfies OperationalDataSummary;
  } catch (error) {
    return {
      sourceAvailable: false,
      message: error instanceof Error ? error.message : "Resumo de dados importados indisponível.",
    } satisfies OperationalDataSummary;
  }
}

function emptyOperationalReconciliation(message = "Reconciliação de dados importados indisponível.") {
  return {
    sourceAvailable: false,
    message,
    generatedAt: null,
    redactedSecrets: true,
    counts: {
      importedUnits: 0,
      currentUnits: 0,
      matchedUnits: 0,
      weakUnitMatches: 0,
      unmatchedImportedUnits: 0,
      unmatchedCurrentUnits: 0,
      importedPartners: 0,
      currentPartners: 0,
      matchedPartners: 0,
      importedEquipments: 0,
      currentEquipments: 0,
      matchedEquipments: 0,
      starlinks: 0,
    },
    unmatchedImportedUnits: [],
    weakUnitMatches: [],
    unmatchedCurrentUnits: [],
    unmatchedImportedPartners: [],
    unmatchedImportedEquipments: [],
  } satisfies OperationalReconciliation;
}

async function readOperationalReconciliation() {
  try {
    return (await apiJson<OperationalReconciliation>("/operational-data/reconciliation")) satisfies OperationalReconciliation;
  } catch (error) {
    return emptyOperationalReconciliation(error instanceof Error ? error.message : undefined);
  }
}

function cityLine(item: UnitHostTelemetryItem) {
  return [item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "Local não informado";
}

function matchTone(value: UnitHostTelemetryItem["match"]) {
  if (value.status === "matched" && value.syncReady) return "success";
  if (value.status === "matched") return "info";
  if (value.status === "ambiguous") return "attention";
  return "subtle";
}

function matchLabel(value: UnitHostTelemetryItem["match"]) {
  if (value.status === "matched" && value.syncReady) return "pronto";
  if (value.status === "matched") return "sem tag explícita";
  if (value.status === "ambiguous") return "ambíguo";
  return "sem host";
}

function suggestedTag(item: UnitHostTelemetryItem) {
  return `nova.unit_code=${item.unit.code}`;
}

function sourceFailures(telemetry: UnitHostTelemetry) {
  return telemetry.sources.filter((source) => !source.ok).length;
}

function operationalDataCount(summary: OperationalDataSummary, section: "raw" | "normalized", key: string) {
  return summary.summary?.[section]?.[key] ?? 0;
}

function sourceName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function importedUnitWizardHref(unit: {
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  partnerCode: string;
}) {
  const params = new URLSearchParams();
  params.set("step", "3");
  params.set("from", "imported");

  const entries = {
    code: unit.code,
    name: unit.name,
    city: unit.city || "",
    state: unit.state || "",
    partnerCode: unit.partnerCode || "",
  };

  for (const [key, value] of Object.entries(entries)) {
    const normalized = value.trim();
    if (normalized) params.set(key, normalized);
  }

  return `/unidades/nova?${params.toString()}`;
}

function operationalSignalWeight(signal: OperationalSignal) {
  return signal.backupLinks + signal.starlinks + signal.equipments + (signal.hasMacOnu ? 2 : 0);
}

function OperationalSignalPills({ signal }: { signal: OperationalSignal }) {
  const items = [
    signal.backupLinks ? { label: `${signal.backupLinks} backup`, tone: "attention" } : null,
    signal.starlinks ? { label: `${signal.starlinks} starlink`, tone: "info" } : null,
    signal.equipments ? { label: `${signal.equipments} ativo`, tone: "success" } : null,
    signal.hasMacOnu ? { label: "mac/onu", tone: "violet" } : null,
    signal.phones ? { label: `${signal.phones} fone`, tone: "subtle" } : null,
  ].filter((item): item is { label: string; tone: string } => Boolean(item));

  if (!items.length) return <span className="text-[10px] text-slate-500">sem sinal operacional</span>;

  return (
    <div className="flex max-w-[360px] flex-wrap gap-1">
      {items.map((item) => (
        <TonePill key={item.label} tone={item.tone}>
          {item.label}
        </TonePill>
      ))}
    </div>
  );
}

function ReconciliationHero({
  telemetry,
  isAdmin,
}: {
  telemetry: UnitHostTelemetry;
  isAdmin: boolean;
}) {
  const coverage = telemetry.counts.units
    ? Math.round((telemetry.counts.matched / telemetry.counts.units) * 100)
    : 0;
  const failures = sourceFailures(telemetry);

  return (
    <Surface><div className="nova-side-grid nova-side-grid--360 xl:items-stretch"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><TonePill tone={failures ? "attention" : "success"}>
              {failures ? "fonte com alerta" : "fontes ok"}
            </TonePill><TonePill tone="neutral">leitura {formatDateTime(telemetry.generatedAt)}</TonePill></div><h2 className="mt-2 max-w-5xl text-[18px] font-black leading-tight text-slate-50">
            Reconcilie cadastro, host Zabbix e inventário antes de automatizar.
          </h2><p className="mt-2 max-w-4xl text-[11px] leading-5 text-slate-400">
            Esta tela separa o trabalho de saneamento do dashboard NOC. A escrita no Zabbix só acontece
            quando a unidade tem host único e tag explícita; os demais casos ficam em fila de ajuste.
          </p></div><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="nds-label">
                Cobertura reconciliada
              </div><div className="mt-1 text-[22px] font-black text-slate-50">{coverage}%</div><div className="mt-1 text-[11px] text-slate-400">
                {telemetry.counts.matched} de {telemetry.counts.units} unidade(s) com host
              </div></div><TonePill tone={telemetry.counts.syncReady ? "success" : "attention"}>
              {telemetry.counts.syncReady} pronto(s)
            </TonePill></div>

          {isAdmin && telemetry.counts.syncReady > 0 ? (
            <ActionForm
              action={syncReadyZabbixAction}
              submitLabel="Sincronizar prontos"
              pendingLabel="Sincronizando..."
              variant="secondary"
              className="mt-2"
              submitClassName="justify-start"
            ><div className="nds-card text-[11px] leading-5 text-slate-400">
                Atualiza apenas hosts com vínculo explícito. Casos ambíguos ou sem tag continuam bloqueados.
              </div></ActionForm>
          ) : (
            <div className="nds-card mt-2 text-[11px] leading-5 text-slate-400">
              {isAdmin
                ? "Nenhum host está pronto para sincronização automática nesta leitura."
                : "A sincronização é restrita a administradores."}
            </div>
          )}
        </div></div></Surface>
  );
}

function ReadyTable({ rows }: { rows: UnitHostTelemetryItem[] }) {
  return (
    <Surface><SectionIntro
        eyebrow="Execução segura"
        title="Prontos para sincronizar"
        description="Unidades com host único e tag explícita. O sync atualiza tags e inventário do host, preservando a regra de não criar hosts automaticamente."
        actions={<TonePill tone={rows.length ? "success" : "neutral"}>{rows.length} unidade(s)</TonePill>}
        compact
      /><div className="mt-2">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Host Zabbix</th><th className="px-3 py-2">Saúde</th><th className="px-3 py-2">Loss</th><th className="px-3 py-2">Itens de vínculo</th></tr></TableHead><tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-white">
                        {item.unit.code}
                      </Link><div className="mt-1 max-w-[260px] text-[11px] text-slate-300">{item.unit.name}</div><div className="mt-1 text-[10px] text-slate-500">{cityLine(item)}</div></TableCell><TableCell><div className="font-medium text-slate-100">{item.partner.code}</div><div className="mt-1 max-w-[220px] text-[10px] text-slate-500">{item.partner.name}</div></TableCell><TableCell><div className="font-medium text-slate-50">{item.match.hostName || item.match.host}</div><div className="mt-1 text-[10px] text-slate-500">
                        {item.match.integrationCode} · {item.match.confidence}% confiança
                      </div></TableCell><TableCell><TonePill tone={healthTone(item.health)}>{item.health}</TonePill></TableCell><TableCell><TonePill tone={(item.metrics.lossPct ?? 0) >= 5 ? "attention" : "success"}>
                        {formatPercent(item.metrics.lossPct)}
                      </TonePill></TableCell><TableCell><div className="flex max-w-[340px] flex-wrap gap-1">
                        {item.match.matchedBy.slice(0, 4).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500"
                          >
                            {reason}
                          </span>
                        ))}
                      </div></TableCell></tr>
                ))}
              </tbody></DenseTable></TableShell>
        ) : (
          <EmptyState
            title="Nenhum item pronto"
            description="Adicione a tag explícita no host correto ou saneie os candidatos ambíguos para liberar a sincronização."
          />
        )}
      </div></Surface>
  );
}

function BacklogTable({ rows }: { rows: UnitHostTelemetryItem[] }) {
  return (
    <Surface><SectionIntro
        eyebrow="Backlog"
        title="Pendências de vínculo"
        description="Casos que não devem receber escrita automática: sem host, mais de um candidato ou host encontrado sem a tag de unidade."
        actions={<TonePill tone={rows.length ? "attention" : "success"}>{rows.length} pendente(s)</TonePill>}
        compact
      /><div className="mt-2">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Candidatos</th><th className="px-3 py-2">Ajuste recomendado</th><th className="px-3 py-2">Ativos</th></tr></TableHead><tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/unidades/${item.unit.id}`} className="font-semibold text-slate-50 hover:text-white">
                        {item.unit.code}
                      </Link><div className="mt-1 max-w-[280px] text-[11px] text-slate-300">{item.unit.name}</div><div className="mt-1 text-[10px] text-slate-500">{item.partner.code} · {cityLine(item)}</div></TableCell><TableCell><TonePill tone={matchTone(item.match)}>{matchLabel(item.match)}</TonePill>
                      {item.match.hostName || item.match.host ? (
                        <div className="mt-2 max-w-[260px] truncate text-[10px] text-slate-500">
                          {item.match.hostName || item.match.host}
                        </div>
                      ) : null}
                    </TableCell><TableCell className="text-slate-400">{item.match.candidates}</TableCell><TableCell><code className="rounded-[6px] border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] text-slate-200">
                        {suggestedTag(item)}
                      </code><div className="mt-2 max-w-[420px] text-[10px] leading-5 text-slate-500">
                        Use esta tag no host da unidade. Serial/MAC no inventário do host ajuda a reduzir ambiguidade.
                      </div></TableCell><TableCell><div className="max-w-[280px] text-[10px] leading-5 text-slate-400">
                        {item.equipments.length
                          ? item.equipments
                              .slice(0, 4)
                              .map((equipment) => equipment.serialNumber || equipment.tag)
                              .join(", ")
                          : "Sem ativo cadastrado"}
                      </div></TableCell></tr>
                ))}
              </tbody></DenseTable></TableShell>
        ) : (
          <EmptyState
            title="Sem pendências de vínculo"
            description="Todos os hosts encontrados estão confiáveis para leitura e sincronização controlada."
          />
        )}
      </div></Surface>
  );
}

function SourcePanel({ telemetry }: { telemetry: UnitHostTelemetry }) {
  return (
    <Surface><SectionIntro
        eyebrow="Conectores"
        title="Fontes Zabbix usadas na reconciliação"
        description="Integração e host da unidade."
        compact
      /><div className="mt-2 grid gap-2">
        {telemetry.sources.map((source) => (
          <div key={source.id} className="nds-card"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="text-[12px] font-black text-slate-50">{source.code} · {source.name}</div><div className="mt-1 max-w-[620px] truncate text-[10px] text-slate-500">
                  {source.targetUrl || "URL não exposta"}
                </div></div><TonePill tone={source.ok ? "success" : "attention"}>
                {source.ok ? "operante" : "atenção"}
              </TonePill></div><div className="mt-2 grid gap-2 sm:grid-cols-3"><div className="nova-micro-card px-2 py-2"><div className="nds-label">Versão</div><div className="mt-1 font-semibold text-slate-50">{source.version || "-"}</div></div><div className="nova-micro-card px-2 py-2"><div className="nds-label">Hosts lidos</div><div className="mt-1 font-semibold text-slate-50">{source.totalHosts}</div></div><div className="nova-micro-card px-2 py-2"><div className="nds-label">Unidades vinculadas</div><div className="mt-1 font-semibold text-slate-50">{source.matchedUnits}</div></div></div><div className="mt-2 text-[11px] leading-5 text-slate-400">{source.message}</div></div>
        ))}
      </div></Surface>
  );
}

function ImportedDataPanel({
  summary,
  telemetry,
}: {
  summary: OperationalDataSummary;
  telemetry: UnitHostTelemetry;
}) {
  if (!summary.sourceAvailable) {
    return (
      <Surface><SectionIntro
          eyebrow="Dados importados"
          title="Bases SQLite ainda não carregadas nesta execução"
          description={summary.message || "Gere o pacote de dados importados para cruzar contatos, parceiros, Starlinks e ativos antigos com o cadastro atual."}
          actions={<TonePill tone="attention">pendente</TonePill>}
          compact
        />
        {summary.expectedPath ? (
          <div className="nds-card mt-2 text-[11px] text-slate-400">
            Caminho esperado: <span className="font-medium text-slate-200">{summary.expectedPath}</span></div>
        ) : null}
      </Surface>
    );
  }

  const importedUnits = operationalDataCount(summary, "normalized", "units");
  const importedPartners = operationalDataCount(summary, "normalized", "partners");
  const importedEquipments = operationalDataCount(summary, "normalized", "equipments");
  const starlinksInstalled = operationalDataCount(summary, "normalized", "starlinksInstalled");
  const contactsWithBackup = operationalDataCount(summary, "normalized", "contactsWithBackup");
  const contactsWithMacOnu = operationalDataCount(summary, "normalized", "contactsWithMacOnu");
  const adoption = importedUnits ? Math.round((telemetry.counts.units / importedUnits) * 100) : 0;
  const sources = Object.entries(summary.sources || {});

  return (
    <Surface><div className="nova-side-grid nova-side-grid--360"><div className="min-w-0"><SectionIntro
            eyebrow="Dados importados"
            title="SQLite virou fonte de reconciliação operacional"
            description="Contatos, parceiros, Starlinks e ativos antigos ficam disponíveis para consulta e saneamento sem aumentar o Prisma nesta etapa."
            actions={
              <div className="flex flex-wrap gap-2"><TonePill tone={summary.redactedSecrets ? "attention" : "success"}>
                  {summary.redactedSecrets ? "credenciais mascaradas" : "credenciais disponíveis"}
                </TonePill>
                {summary.generatedAt ? <TonePill tone="neutral">{formatDateTime(summary.generatedAt)}</TonePill> : null}
              </div>
            }
            compact
          /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><KpiTile label="Unidades importadas" value={importedUnits} meta={`${telemetry.counts.units} no cadastro atual`} tone="info" /><KpiTile label="Parceiros" value={importedPartners} meta={`${operationalDataCount(summary, "raw", "parceiros")} linha(s) na origem`} tone="info" /><KpiTile label="Ativos importados" value={importedEquipments} meta={`${contactsWithMacOnu} com MAC/ONU`} tone="success" /><KpiTile label="Starlinks" value={starlinksInstalled} meta={`${operationalDataCount(summary, "raw", "starlinks")} registro(s) brutos`} tone="attention" /></div><div className="mt-2 grid gap-2 md:grid-cols-3"><div className="nds-card"><div className="text-[12px] font-black text-slate-50">{adoption}% migrado para leitura atual</div><div className="mt-1 text-[10px] leading-5 text-[var(--nova-text-muted)]">Comparação simples entre unidades ativas lidas e unidades normalizadas da base importada.</div></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">{contactsWithBackup} com contingência</div><div className="mt-1 text-[10px] leading-5 text-[var(--nova-text-muted)]">Registros que já trazem parceiro/rota de backup para orientar operação.</div></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">{operationalDataCount(summary, "raw", "starlinkHistory")} histórico(s)</div><div className="mt-1 text-[10px] leading-5 text-[var(--nova-text-muted)]">Movimentações de Starlink preservadas para consulta nos detalhes.</div></div></div></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">Arquivos coletados</div><div className="mt-2 grid gap-2">
            {sources.length ? (
              sources.map(([key, path]) => (
                <div key={key} className="nds-card"><div className="nds-label">{key}</div><div className="mt-1 truncate text-[11px] font-medium text-slate-100" title={path}>
                    {sourceName(path)}
                  </div></div>
              ))
            ) : (
              <div className="text-[11px] text-slate-500">Sem lista de origem no pacote.</div>
            )}
          </div><div className="nds-card mt-2 border-[color-mix(in_srgb,var(--nova-primary)_28%,transparent)] bg-[var(--nova-primary-soft)] text-[11px] leading-5 text-slate-100">
            A conversão atual é consultiva: blocos de unidade, parceiro e ativo exibem dados importados quando há correspondência segura.
          </div></div></div></Surface>
  );
}

function OperationalReconciliationPanel({
  reconciliation,
}: {
  reconciliation: OperationalReconciliation;
}) {
  if (!reconciliation.sourceAvailable) {
    return (
      <Surface><SectionIntro
          eyebrow="Fila de migração"
          title="Reconciliação de dados importados indisponível"
          description={reconciliation.message || "A fila será exibida quando o pacote de dados importados puder ser lido pela API."}
          actions={<TonePill tone="attention">sem leitura</TonePill>}
          compact
        /></Surface>
    );
  }

  const counts = reconciliation.counts;
  const unitCoverage = counts.importedUnits ? Math.round((counts.matchedUnits / counts.importedUnits) * 100) : 0;
  const equipmentCoverage = counts.importedEquipments
    ? Math.round((counts.matchedEquipments / counts.importedEquipments) * 100)
    : 0;
  const prioritizedUnits = reconciliation.unmatchedImportedUnits
    .slice()
    .sort((a, b) => operationalSignalWeight(b.signal) - operationalSignalWeight(a.signal) || a.code.localeCompare(b.code))
    .slice(0, 12);
  const weakMatches = reconciliation.weakUnitMatches.slice(0, 6);
  const unmatchedCurrent = reconciliation.unmatchedCurrentUnits.slice(0, 6);
  const totalDivergences =
    counts.unmatchedImportedUnits +
    counts.weakUnitMatches +
    reconciliation.unmatchedImportedPartners.length +
    reconciliation.unmatchedImportedEquipments.length +
    reconciliation.unmatchedCurrentUnits.length;

  return (
    <Surface><SectionIntro
        eyebrow="Fila de migração"
        title="Dados importados mostram o que precisa entrar no cadastro atual"
        description="A prioridade fica nas unidades com backup, Starlink, MAC/ONU ou ativo, porque esses sinais afetam acionamento e monitoramento dos hosts."
        actions={
          <div className="flex flex-wrap gap-2"><TonePill tone={counts.unmatchedImportedUnits ? "attention" : "success"}>
              {counts.unmatchedImportedUnits} sem match
            </TonePill><TonePill tone={counts.weakUnitMatches ? "attention" : "neutral"}>
              {counts.weakUnitMatches} fraco(s)
            </TonePill></div>
        }
        compact
      /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><KpiTile label="Unidades cruzadas" value={`${unitCoverage}%`} meta={`${counts.matchedUnits} de ${counts.importedUnits} registro(s)`} tone={counts.unmatchedImportedUnits ? "attention" : "success"} /><KpiTile label="Ativos cruzados" value={`${equipmentCoverage}%`} meta={`${counts.matchedEquipments} de ${counts.importedEquipments} ativo(s)`} tone={counts.importedEquipments - counts.matchedEquipments ? "attention" : "success"} /><KpiTile label="Parceiros cruzados" value={counts.matchedPartners} meta={`${counts.importedPartners - counts.matchedPartners} sem cadastro atual`} tone={counts.importedPartners - counts.matchedPartners ? "attention" : "success"} /><KpiTile label="Starlinks importados" value={counts.starlinks} meta="consultivos nesta fase" tone="info" /></div><div className="nova-reconcile-action-panel mt-2"><div className="min-w-0"><div className="nds-label">Ações de reconciliação</div><div className="mt-1 text-[13px] font-black text-white">{totalDivergences} divergência(s) priorizadas</div><div className="mt-1 text-[11px] text-[var(--nova-text-muted)]">Resolver unidade sem match, revisar match fraco, criar parceiro ou vincular ativo importado.</div></div><div className="nova-reconcile-action-list"><TonePill tone={counts.unmatchedImportedUnits ? "attention" : "success"}>{counts.unmatchedImportedUnits} unidades</TonePill><TonePill tone={counts.weakUnitMatches ? "attention" : "neutral"}>{counts.weakUnitMatches} fracos</TonePill><TonePill tone={reconciliation.unmatchedImportedEquipments.length ? "attention" : "success"}>{reconciliation.unmatchedImportedEquipments.length} ativos</TonePill></div></div><div className="mt-2 nova-side-grid nova-side-grid--380"><div><SectionIntro
            eyebrow="Saneamento prioritário"
            title="Unidades importadas sem cadastro seguro"
            description="Lista limitada aos sinais mais úteis para decidir o próximo cadastro ou ajuste de vínculo."
            compact
          /><div className="mt-2">
            {prioritizedUnits.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade importada</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Sinais</th><th className="px-3 py-2">Possível match</th><TableActionHeader className="min-w-[11rem]" /></tr></TableHead><tbody>
                    {prioritizedUnits.map((unit) => (
                      <tr key={`${unit.partnerCode}:${unit.code}:${unit.name}`} className="border-b border-white/6 last:border-b-0"><TableCell><div className="font-semibold text-slate-50">{unit.code || "sem código"}</div><div className="mt-1 max-w-[320px] text-[11px] text-slate-300">{unit.name}</div><div className="mt-1 text-[10px] text-slate-500">
                            {[unit.city, unit.state].filter(Boolean).join(" / ") || "Local não informado"}
                          </div></TableCell><TableCell><TonePill tone={unit.partnerCode ? "info" : "neutral"}>{unit.partnerCode || "sem parceiro"}</TonePill></TableCell><TableCell><OperationalSignalPills signal={unit.signal} /></TableCell><TableCell>
                          {unit.bestCurrentUnit ? (
                            <><Link
                                href={`/unidades/${unit.bestCurrentUnit.id}`}
                                className="font-semibold text-slate-50 hover:text-white"
                              >
                                {unit.bestCurrentUnit.code}
                              </Link><div className="mt-1 max-w-[260px] text-[10px] text-slate-500">
                                {unit.bestCurrentUnit.name} · score {unit.bestScore}
                              </div></>
                          ) : (
                            <span className="text-[11px] text-slate-500">Sem candidato</span>
                          )}
                        </TableCell><TableActionCell className="min-w-[11rem]"><TableActionLink
                            href={importedUnitWizardHref(unit)}
                            className="border-[var(--nova-primary)]/25 bg-[var(--nova-primary-soft)] text-slate-50 hover:border-[var(--nova-primary)]/45"
                          >
                            Abrir cadastro guiado
                          </TableActionLink></TableActionCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Sem unidades importadas pendentes"
                description="As unidades do pacote de dados importados encontraram correspondência segura no cadastro atual."
              />
            )}
          </div></div><div className="grid gap-2"><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="nds-label">Matches fracos</div><div className="mt-1 text-[12px] font-black text-slate-50">Revisar antes de importar</div></div><TonePill tone={weakMatches.length ? "attention" : "success"}>{weakMatches.length}</TonePill></div><div className="mt-2 grid gap-2">
              {weakMatches.length ? (
                weakMatches.map((unit) => (
                  <div key={`${unit.partnerCode}:${unit.code}:${unit.score}`} className="nds-card"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[12px] font-black text-slate-50">{unit.code || unit.name}</div><div className="mt-1 truncate text-[10px] text-[var(--nova-text-muted)]">
                          {unit.currentUnit ? `${unit.currentUnit.code} · ${unit.currentUnit.name}` : "Sem candidato atual"}
                        </div></div><TonePill tone="attention">{unit.score}</TonePill></div></div>
                ))
              ) : (
                <div className="text-[11px] leading-5 text-slate-500">Nenhum match fraco nesta leitura.</div>
              )}
            </div></div><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="nds-label">Parceiros</div><div className="mt-1 text-[12px] font-black text-slate-50">Importado sem cadastro atual</div></div><TonePill tone={reconciliation.unmatchedImportedPartners.length ? "attention" : "success"}>
                {reconciliation.unmatchedImportedPartners.length}
              </TonePill></div><div className="mt-2 grid gap-2">
              {reconciliation.unmatchedImportedPartners.slice(0, 5).map((partner) => (
                <div key={`${partner.code}:${partner.name}`} className="nds-card"><div className="text-[12px] font-black text-slate-50">{partner.code || partner.name}</div><div className="mt-1 text-[10px] leading-5 text-[var(--nova-text-muted)]">
                    {partner.name} · {partner.contacts} contato(s) · {partner.primaryUnitCount + partner.backupUnitCount} vínculo(s)
                  </div></div>
              ))}
              {!reconciliation.unmatchedImportedPartners.length ? (
                <div className="text-[11px] leading-5 text-slate-500">Todos os parceiros importados encontraram match.</div>
              ) : null}
            </div></div><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="nds-label">Ativos</div><div className="mt-1 text-[12px] font-black text-slate-50">Importado sem match por tag/serial</div></div><TonePill tone={reconciliation.unmatchedImportedEquipments.length ? "attention" : "success"}>
                {reconciliation.unmatchedImportedEquipments.length}
              </TonePill></div><div className="mt-2 grid gap-2">
              {reconciliation.unmatchedImportedEquipments.slice(0, 5).map((equipment) => (
                <div key={`${equipment.source}:${equipment.tag}:${equipment.serialNumber || ""}`} className="nds-card"><div className="text-[12px] font-black text-slate-50">{equipment.tag || equipment.name}</div><div className="mt-1 text-[10px] leading-5 text-[var(--nova-text-muted)]">
                    {equipment.type || "tipo não informado"} · {equipment.serialNumber || "sem serial"} · {equipment.unitCode || "sem unidade"}
                  </div></div>
              ))}
              {!reconciliation.unmatchedImportedEquipments.length ? (
                <div className="text-[11px] leading-5 text-slate-500">Todos os ativos importados bateram por tag ou serial.</div>
              ) : null}
            </div></div><div className="nds-card"><div className="flex items-start justify-between gap-2"><div><div className="nds-label">Cadastro atual</div><div className="mt-1 text-[12px] font-black text-slate-50">Unidades sem rastro importado</div></div><TonePill tone={unmatchedCurrent.length ? "neutral" : "success"}>{unmatchedCurrent.length}</TonePill></div><div className="mt-2 grid gap-2">
              {unmatchedCurrent.length ? (
                unmatchedCurrent.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/unidades/${unit.id}`}
                    className="nds-card block transition hover:border-white/14 hover:bg-white/[0.06]"
                  ><div className="text-[12px] font-black text-slate-50">{unit.code}</div><div className="mt-1 truncate text-[10px] text-[var(--nova-text-muted)]">
                      {unit.name} · {unit.partnerCode}
                    </div></Link>
                ))
              ) : (
                <div className="text-[11px] leading-5 text-slate-500">Sem cadastro atual órfão dos dados importados.</div>
              )}
            </div></div></div></div></Surface>
  );
}

function ContractPanel() {
  const rules = [
    "Tag de vínculo recomendada: nova.unit_code=<código da unidade>.",
    "Tags gerenciadas pelo portal usam prefixo nova.* e podem ser regravadas.",
    "Inventário do host recebe unidade, parceiro, localização e serial/MAC conhecido.",
    "Sem tag explícita, a tela monitora e sugere ajuste, mas não escreve no Zabbix.",
  ];

  return (
    <Surface><SectionIntro
        eyebrow="Contrato operacional"
        title="Como preparar o host para automação"
        description="Um contrato pequeno evita o erro caro: atualizar o host errado."
        compact
      /><div className="mt-2 grid gap-2">
        {rules.map((rule) => (
          <div key={rule} className="nds-card text-[11px] leading-5 text-slate-300">
            {rule}
          </div>
        ))}
      </div></Surface>
  );
}

export default async function ReconciliacaoCentralPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/reconciliacao");
  }

  const [telemetry, operationalDataSummary, operationalReconciliation] = await Promise.all([
    readUnitHostTelemetry({ timeoutMs: 2_500 }),
    readOperationalDataSummary(),
    readOperationalReconciliation(),
  ]);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";
  const readyRows = telemetry.items
    .filter((item) => item.match.status === "matched" && item.match.syncReady)
    .sort((a, b) => a.partner.code.localeCompare(b.partner.code) || a.unit.code.localeCompare(b.unit.code));
  const backlogRows = telemetry.items
    .filter((item) => !(item.match.status === "matched" && item.match.syncReady))
    .sort((a, b) => {
      const weight = { ambiguous: 0, matched: 1, unmatched: 2 };
      return weight[a.match.status] - weight[b.match.status] || a.unit.code.localeCompare(b.unit.code);
    });

  return (
    <NovaLitShell activeHref="/reconciliacao">
      <nav className="nova-admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/operacao">Operação</Link>
        <span>/</span>
        <strong>Reconciliação</strong>
      </nav>

      <section className="nova-admin-flow nova-admin-flow--reconcile" aria-label="Fluxo de reconciliação">
        <article className="is-active">
          <span>01</span>
          <strong>Fontes</strong>
          <small>Cadastro atual, Zabbix e bases SQLite importadas.</small>
        </article>
        <i>→</i>
        <article>
          <span>02</span>
          <strong>Cruzamento</strong>
          <small>Unidades, parceiros, ativos, Starlinks, MAC/ONU e contatos.</small>
        </article>
        <i>→</i>
        <article>
          <span>03</span>
          <strong>Saneamento</strong>
          <small>Tags, vínculos, pendências e sincronização controlada.</small>
        </article>
      </section>

      <div className="nova-reconciliacao-page nova-reconciliacao-lit-page">
        <div className="nova-lit-page-hero nova-reconciliacao-page-hero">
          <div>
            <div className="nova-lit-breadcrumb">Configurações / Reconciliação</div>
            <h1>Reconciliação</h1>
            <p>Vínculo entre unidades, parceiros, ativos e hosts Zabbix antes da automação.</p>
          </div>
          <div className="nova-lit-page-actions">
            <Link href="/importacao" className="nova-lit-secondary-action">Importação</Link>
            <Link href="/sensores" className="nova-lit-primary-action">Sensores</Link>
          </div>
        </div>
        <ReconciliationHero telemetry={telemetry} isAdmin={isAdmin} /><section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><KpiTile
          label="Unidades lidas"
          value={telemetry.counts.units}
          meta={`${telemetry.counts.matched} com host identificado`}
          tone={telemetry.counts.unmapped ? "attention" : "success"}
        /><KpiTile
          label="Prontas para sync"
          value={telemetry.counts.syncReady}
          meta={`${telemetry.counts.matched - telemetry.counts.syncReady} com host sem tag explícita`}
          tone={telemetry.counts.syncReady ? "success" : "neutral"}
        /><KpiTile
          label="Backlog"
          value={backlogRows.length}
          meta={`${telemetry.counts.ambiguous} ambígua(s) · ${telemetry.counts.unmapped} sem host`}
          tone={backlogRows.length ? "attention" : "success"}
        /><KpiTile
          label="Perda média"
          value={formatPercent(telemetry.counts.avgLossPct)}
          meta={`${telemetry.counts.withProblems} unidade(s) com problema Zabbix`}
          tone={telemetry.counts.withProblems ? "attention" : "success"}
        /></section><ImportedDataPanel summary={operationalDataSummary} telemetry={telemetry} /><OperationalReconciliationPanel reconciliation={operationalReconciliation} /><section className="nova-side-grid nova-side-grid--420"><ReadyTable rows={readyRows} /><ContractPanel /></section><BacklogTable rows={backlogRows} /><SourcePanel telemetry={telemetry} />      </div>
    </NovaLitShell>
  );
}
