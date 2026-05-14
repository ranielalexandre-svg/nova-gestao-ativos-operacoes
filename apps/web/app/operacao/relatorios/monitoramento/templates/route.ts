import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server-api";

function csv(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const returnTo = value(formData, "returnTo") || "/operacao/relatorios/monitoramento";

  const payload = {
    code: value(formData, "code"),
    name: value(formData, "name"),
    integrationId: value(formData, "integrationId") || undefined,
    sourceType: value(formData, "sourceType") || "manual",
    unitIds: csv(formData, "unitIds"),
    groupIds: csv(formData, "groupIds"),
    periodPreset: value(formData, "periodPreset") || "last_7_days",
    outputFormat: value(formData, "outputFormat") || "pdf",
    includeCharts: formData.get("includeCharts") === "on",
    title: value(formData, "title") || undefined,
    interestedParty: value(formData, "interestedParty") || undefined,
    contractLabel: value(formData, "contractLabel") || undefined,
    addressLine: value(formData, "addressLine") || undefined,
    contractedBandwidth: value(formData, "contractedBandwidth") || undefined,
  };

  try {
    await apiFetch("/monitoring/report-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const url = new URL(returnTo, request.url);
    url.searchParams.set("templateStatus", "saved");
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set("templateStatus", "error");
    url.searchParams.set("templateMessage", error instanceof Error ? error.message : "Falha ao salvar template.");
    return NextResponse.redirect(url);
  }
}
