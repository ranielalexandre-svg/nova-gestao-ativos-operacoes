"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const REMEMBERED_EMAIL_KEY = "nova.login.email";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const loginAction = `/api/auth/web-session?next=${encodeURIComponent(next)}`;

  const emailRef = useRef<HTMLInputElement>(null);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail && emailRef.current) {
      emailRef.current.value = rememberedEmail;
    }
  }, []);

  function onSubmit() {
    const normalizedEmail = emailRef.current?.value.trim() || "";

    if (rememberEmail && normalizedEmail) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    setLoading(true);
    setError("");
  }

  return (
    <form
      onSubmit={onSubmit}
      method="post"
      action={loginAction}
      className="nova-login-card w-full rounded-[28px] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(18,26,37,0.96),rgba(8,13,19,0.96))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.035] backdrop-blur sm:p-6"
    ><input type="hidden" name="next" value={next} /><div className="flex items-start gap-4"><div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-sky-500/25 bg-sky-500/14 text-sm font-black text-sky-100 shadow-[0_16px_34px_rgba(14,165,233,0.12)]">
          N
        </div><div className="min-w-0"><h2 className="text-[26px] font-black tracking-[-0.04em] text-slate-50">Entrar no ambiente</h2><p className="mt-1 text-sm leading-6 text-slate-400">Acesse com sua conta operacional.</p></div></div><div className="mt-7 grid gap-4"><label className="grid gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">E-mail</span><input
            className="h-12 rounded-[16px] border border-white/10 bg-[#080d13] px-3.5 text-sm font-medium text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-4 focus:ring-sky-500/15"
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            required
          /></label><label className="grid gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Senha</span><div className="flex rounded-[16px] border border-white/10 bg-[#080d13] focus-within:border-sky-400/60 focus-within:ring-4 focus-within:ring-sky-500/15"><input
              className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
            /><button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="m-1 inline-flex items-center rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button></div></label><div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-start sm:justify-between"><label className="flex items-start gap-2"><input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#090e14]"
            /><span className="font-semibold uppercase tracking-[0.16em]">Lembrar login neste dispositivo</span></label><span className="sm:max-w-[160px]">Salva apenas o e-mail.</span></div>

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
          className="mt-1 h-12 rounded-[16px] border border-sky-400/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.24),rgba(37,99,235,0.22))] px-4 text-sm font-black text-slate-50 shadow-[0_18px_38px_rgba(14,165,233,0.14)] transition hover:border-sky-300/45 hover:bg-[#1b2946] disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button></div></form>
  );
}
