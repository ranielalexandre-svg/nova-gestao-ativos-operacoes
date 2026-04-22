"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const loginAction = `/api/auth/web-session?next=${encodeURIComponent(next)}`;

  const [email, setEmail] = useState("admin@nova.local");
  const [password, setPassword] = useState("Nova123456");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const sessionResponse = await fetch("/api/auth/web-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const sessionPayload = await sessionResponse.json().catch(() => ({}));

      if (!sessionResponse.ok) {
        throw new Error(String((sessionPayload as { message?: string })?.message || "Falha ao criar sessão web"));
      }

      window.location.assign(next);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      method="post"
      action={loginAction}
      className="w-full rounded-[20px] border border-white/[0.08] bg-[#0f141b] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] sm:p-6"
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex items-start gap-4">
        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-sky-500/20 bg-sky-500/12 text-sm font-bold text-sky-100">
          N
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Entrar no ambiente</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Acesse com sua conta operacional.</p>
        </div>
      </div>

      <div className="mt-7 grid gap-4">
        <label className="grid gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">E-mail</span>
          <input
            className="h-11 rounded-[14px] border border-white/10 bg-[#090e14] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/55 focus:ring-4 focus:ring-sky-500/15"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Senha</span>
          <div className="flex rounded-[14px] border border-white/10 bg-[#090e14] focus-within:border-sky-400/55 focus-within:ring-4 focus-within:ring-sky-500/15">
            <input
              className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="m-1 inline-flex items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>

        <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex items-start gap-2">
            <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#090e14]" />
            <span className="font-semibold uppercase tracking-[0.16em]">Lembrar login neste dispositivo</span>
          </label>
          <span className="sm:max-w-[160px]">O navegador pode lembrar o e-mail.</span>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-[14px] border border-rose-500/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-11 rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 text-sm font-semibold text-slate-50 shadow-[0_14px_28px_rgba(0,0,0,0.24)] transition hover:bg-[#1b2946] disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </form>
  );
}
