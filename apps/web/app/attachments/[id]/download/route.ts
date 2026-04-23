import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const id = String(params.id || "").trim();

  if (!id) {
    return NextResponse.json({ message: "Anexo inválido." }, { status: 404 });
  }

  try {
    const response = await apiFetch(`/attachments/${id}/download`);

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition":
          response.headers.get("Content-Disposition") ||
          `attachment; filename="nova-anexo-${id}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao baixar anexo.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
