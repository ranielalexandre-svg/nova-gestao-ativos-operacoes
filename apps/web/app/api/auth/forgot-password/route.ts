import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "E-mail inválido." },
        { status: 400 },
      );
    }

    // Repassa para o backend. Se o backend não tiver este endpoint,
    // retornamos ok=true de qualquer forma (não revela se o e-mail existe).
    try {
      await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      });
    } catch {
      // Ignora erros de backend — resposta genérica para não vazar info
    }

    // Resposta genérica: não revelar se o e-mail existe no sistema
    return NextResponse.json({
      ok: true,
      message:
        "Se houver uma conta vinculada a este e-mail, você receberá um link de recuperação em alguns minutos.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Erro ao processar solicitação." },
      { status: 500 },
    );
  }
}
