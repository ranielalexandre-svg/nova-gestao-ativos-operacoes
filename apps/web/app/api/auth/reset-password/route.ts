import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

function passwordStrength(password: string): { ok: boolean; message: string } {
  if (password.length < 8) {
    return { ok: false, message: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "A senha deve conter pelo menos uma letra maiúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "A senha deve conter pelo menos um número." };
  }
  return { ok: true, message: "" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token de recuperação ausente ou inválido." },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { ok: false, message: "Nova senha é obrigatória." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "As senhas não coincidem." },
        { status: 400 },
      );
    }

    const strength = passwordStrength(password);
    if (!strength.ok) {
      return NextResponse.json(
        { ok: false, message: strength.message },
        { status: 400 },
      );
    }

    // Envia para o backend
    const backendResponse = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      let message = "Link de recuperação expirado ou inválido. Solicite um novo.";
      try {
        const payload = await backendResponse.json();
        if (payload?.message) message = String(payload.message);
      } catch { /* ignore */ }

      return NextResponse.json({ ok: false, message }, { status: backendResponse.status });
    }

    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso. Você já pode fazer login.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Erro ao processar solicitação." },
      { status: 500 },
    );
  }
}
