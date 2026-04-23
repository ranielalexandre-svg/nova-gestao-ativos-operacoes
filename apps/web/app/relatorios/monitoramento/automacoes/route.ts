import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server-api";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const returnTo = value(formData, "returnTo") || "/relatorios/monitoramento";

  const payload = {
    code: value(formData, "code"),
    name: value(formData, "name"),
    detector: "monitoring_report_export",
    reportTemplateId: value(formData, "templateId"),
    severity: "medium",
    cadence: value(formData, "cadence") || "hourly",
    enabled: formData.get("enabled") === "on",
    createExceptions: false,
    createActivities: true,
    resolveOnRecovery: false,
  };

  try {
    await apiFetch("/automations", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const url = new URL(returnTo, request.url);
    url.searchParams.set("automationStatus", "saved");
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set("automationStatus", "error");
    url.searchParams.set("automationMessage", error instanceof Error ? error.message : "Falha ao criar automação.");
    return NextResponse.redirect(url);
  }
}
