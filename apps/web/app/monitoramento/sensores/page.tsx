import NovaSensoresView, {
  type NovaSensorsHealthFilter,
  type NovaSensorsSearchState,
  type NovaSensorsTelemetry,
} from "@/components/sensores/nova-sensores-view";
import { readUnitHostTelemetry } from "@/lib/noc-overview";
import {
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";

const healthOptions = ["all", "online", "degraded", "down", "unmapped", "ambiguous", "unknown"] as const;
const pageSizeOptions = [12, 24, 48] as const;

function isHealthOption(value: string): value is NovaSensorsHealthFilter {
  return healthOptions.includes(value as NovaSensorsHealthFilter);
}

function isPageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]);
}

export default async function SensoresPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const resolved = await resolveSearchParams(searchParams);
  const health = readStringParam(resolved, "health", "all");
  const pageSize = readPositiveIntParam(resolved, "pageSize", 12);

  const state: NovaSensorsSearchState = {
    q: readStringParam(resolved, "q", ""),
    health: isHealthOption(health) ? health : "all",
    page: readPositiveIntParam(resolved, "page", 1),
    pageSize: isPageSizeOption(pageSize) ? pageSize : 12,
  };

  let telemetry: NovaSensorsTelemetry | null = null;
  let error = "";

  try {
    telemetry = await readUnitHostTelemetry({ timeoutMs: 1800, fast: true });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar a telemetria.";
  }

  return <NovaSensoresView telemetry={telemetry} state={state} error={error} />;
}
