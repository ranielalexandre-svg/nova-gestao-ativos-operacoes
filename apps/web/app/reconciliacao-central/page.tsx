import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { readUnitHostTelemetry } from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
import { ReconciliationWorkspace } from "./reconciliation-workspace";

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

const EMPTY_RECONCILIATION: OperationalReconciliation = {
  sourceAvailable: false,
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
};

async function syncReadyZabbixAction(
  state: ActionFeedbackState,
): Promise<ActionFeedbackState> {
  "use server";
  void state;

  const session = await getServerWebSession();
  if (normalizeRole(session.user?.role || "") !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  try {
    const result = await apiJson<SyncReadyResult>("/units/sync-zabbix-ready", {
      method: "POST",
    });

    revalidatePath("/reconciliacao");
    revalidatePath("/sensores");
    revalidatePath("/unidades");

    return {
      status: result.failed ? "error" : "success",
      message: `${result.synced} host(s) sincronizado(s), ${result.skipped} ignorado(s) e ${result.failed} falha(s).`,
    };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
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

async function readOperationalReconciliation() {
  try {
    return (await apiJson<OperationalReconciliation>("/operational-data/reconciliation")) satisfies OperationalReconciliation;
  } catch (error) {
    return {
      ...EMPTY_RECONCILIATION,
      message: error instanceof Error ? error.message : "Reconciliação de dados importados indisponível.",
    } satisfies OperationalReconciliation;
  }
}

export default async function ReconciliacaoCentralPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/reconciliacao");
  }

  const [telemetry, operationalDataSummary, operationalReconciliation] = await Promise.all([
    readUnitHostTelemetry({ timeoutMs: 3_000, fast: true }),
    readOperationalDataSummary(),
    readOperationalReconciliation(),
  ]);

  return (
    <NovaLitShell activeHref="/reconciliacao">
      <ReconciliationWorkspace
        isAdmin={normalizeRole(session.user?.role || "") === "admin"}
        telemetry={telemetry}
        summary={operationalDataSummary}
        reconciliation={operationalReconciliation}
        syncAction={syncReadyZabbixAction}
      />
    </NovaLitShell>
  );
}
