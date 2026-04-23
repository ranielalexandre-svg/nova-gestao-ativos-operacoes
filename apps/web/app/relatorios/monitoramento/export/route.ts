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
    title: parseOptional(formData, "title"),
    interestedParty: parseOptional(formData, "interestedParty"),
    contractLabel: parseOptional(formData, "contractLabel"),
    addressLine: parseOptional(formData, "addressLine"),
    contractedBandwidth: parseOptional(formData, "contractedBandwidth"),
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
