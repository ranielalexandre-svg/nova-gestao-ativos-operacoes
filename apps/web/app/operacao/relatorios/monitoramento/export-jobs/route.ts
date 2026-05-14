import { NextResponse } from "next/server";
import { apiJson } from "@/lib/server-api";

function parseUnitIds(formData: FormData) {
  return formData
    .getAll("unitIds")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function parseOptional(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function parseUnitMetadataJson(formData: FormData) {
  const metadata: Record<string, { contractLabel?: string; addressLine?: string; contractedBandwidth?: string; notes?: string }> = {};

  for (const [rawKey, rawValue] of formData.entries()) {
    const key = String(rawKey);
    if (!key.startsWith("unitMetadata.")) continue;

    const [, unitKey, field] = key.split(".");
    if (!unitKey || !field) continue;

    const value = String(rawValue || "").trim();
    if (!value) continue;

    metadata[unitKey] = metadata[unitKey] || {};

    if (field === "contractLabel") metadata[unitKey].contractLabel = value;
    if (field === "addressLine") metadata[unitKey].addressLine = value;
    if (field === "contractedBandwidth") metadata[unitKey].contractedBandwidth = value;
    if (field === "notes") metadata[unitKey].notes = value;
  }

  return Object.keys(metadata).length ? JSON.stringify(metadata) : undefined;
}

function redirectBack(request: Request, formData: FormData, params: Record<string, string>) {
  const returnTo = parseOptional(formData, "returnTo") || "/operacao/relatorios/monitoramento";
  const url = new URL(returnTo, request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const unitIds = parseUnitIds(formData);

  if (!unitIds.length) {
    return redirectBack(request, formData, {
      exportStatus: "error",
      exportMessage: "Selecione ao menos uma unidade para exportar.",
    });
  }

  const payload = {
    unitIds,
    from: parseOptional(formData, "from"),
    to: parseOptional(formData, "to"),
    format: String(formData.get("format") || "pdf").trim().toLowerCase(),
    includeCharts: formData.get("includeCharts") === "on",
    reportStyle: "complete",
    title: parseOptional(formData, "title"),
    interestedParty: parseOptional(formData, "interestedParty"),
    contractLabel: parseOptional(formData, "contractLabel"),
    addressLine: parseOptional(formData, "addressLine"),
    contractedBandwidth: parseOptional(formData, "contractedBandwidth"),
    unitMetadataJson: parseUnitMetadataJson(formData) || parseOptional(formData, "unitMetadataJson"),
    competenceLabel: parseOptional(formData, "competenceLabel"),
    issueDateLabel: parseOptional(formData, "issueDateLabel"),
  };

  try {
    const run = await apiJson<{ id: string }>("/monitoring/reports/export-jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return redirectBack(request, formData, {
      exportStatus: "queued",
      exportRunId: run.id,
    });
  } catch (error) {
    return redirectBack(request, formData, {
      exportStatus: "error",
      exportMessage: error instanceof Error ? error.message : "Falha ao iniciar exportação.",
    });
  }
}
