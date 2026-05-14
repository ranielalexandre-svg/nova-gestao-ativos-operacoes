import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server-api";

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

export async function POST(request: Request) {
  const formData = await request.formData();
  const unitIds = parseUnitIds(formData);

  if (!unitIds.length) {
    return NextResponse.json({ message: "Selecione ao menos uma unidade para exportar." }, { status: 400 });
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

  const response = await apiFetch("/monitoring/reports/export", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const buffer = await response.arrayBuffer();
  const contentDisposition = response.headers.get("content-disposition") || `attachment; filename=\"nova-relatorio-consumo.${payload.format}\"`;
  const contentType = response.headers.get("content-type") || "application/octet-stream";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "no-store",
    },
  });
}
