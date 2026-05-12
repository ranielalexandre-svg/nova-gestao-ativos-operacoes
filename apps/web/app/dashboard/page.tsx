import { redirect } from "next/navigation";
import NovaDashboardView from "@/components/dashboard/nova-dashboard-view";
import {
  emptyCommandCenter,
  operationPressure,
  safeApiJson,
  readUnitHostTelemetry,
  type CommandCenter,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

type ExceptionSummary = {
  counts: {
    openCount: number;
    criticalCount: number;
    silencedCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};

const emptyExceptionSummary: ExceptionSummary = {
  counts: {
    openCount: 0,
    criticalCount: 0,
    silencedCount: 0,
    breachedCount: 0,
    dueSoonCount: 0,
    unassignedCount: 0,
    pendingTriageCount: 0,
  },
};

function emptyTelemetryCounts(): UnitHostTelemetry["counts"] {
  return {
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
  };
}

export default async function DashboardPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/dashboard");
  }

  const [commandCenter, exceptionSummary, telemetry] = await Promise.all([
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    safeApiJson<ExceptionSummary>("/exceptions/summary", emptyExceptionSummary),
    readUnitHostTelemetry({ timeoutMs: 1_500, fast: true }).catch(() => ({
      generatedAt: new Date().toISOString(),
      sources: [],
      counts: emptyTelemetryCounts(),
      items: [],
    })),
  ]);

  const pressure = operationPressure(commandCenter, telemetry);
  const coveragePct =
    telemetry.counts.matched > 0
      ? Math.round((telemetry.counts.online / telemetry.counts.matched) * 100)
      : 0;

  return (
    <NovaDashboardView
      userName={session.user?.name ?? ""}
      commandCenter={commandCenter}
      exceptionSummary={exceptionSummary}
      telemetryCounts={telemetry.counts}
      pressure={pressure}
      coveragePct={coveragePct}
    />
  );
}
