import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server-api";

const ALLOWED = new Set(["partners", "units", "equipments", "starlinks"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ resource: string }> | { resource: string } },
) {
  const params = await context.params;
  const resource = String(params.resource || "").trim().toLowerCase();

  if (!ALLOWED.has(resource)) {
    return NextResponse.json({ message: "Recurso inválido." }, { status: 404 });
  }

  const response = await apiFetch(`/export/${resource}`);
  const csv = await response.text();

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nova-${resource}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
