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
      className="nova-login-card w-full"
    ><input type="hidden" name="next" value={next} /><div className="flex items-start gap-2"><div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--nova-border)] bg-[var(--nova-primary-soft)] text-[11px] font-black text-white">
          N
        </div><div className="min-w-0"><h2 className="text-[18px] font-black text-slate-50">Entrar no ambiente</h2><p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">Acesse com sua conta operacional.</p></div></div><div className="mt-2 grid gap-2"><label className="grid gap-1.5"><span className="nds-label">E-mail</span><input
            className="nds-input"
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            required
          /></label><label className="grid gap-1.5"><span className="nds-label">Senha</span><div className="nova-login-password-field flex rounded-[4px] border border-[var(--nova-border)] bg-[var(--nova-surface-3)]"><input
              className="min-h-[30px] min-w-0 flex-1 border-0 bg-transparent px-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
            /><button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="nds-button m-0.5"
              data-variant="secondary"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button></div></label><div className="flex flex-col gap-2 text-[10px] text-slate-400 sm:flex-row sm:items-start sm:justify-between"><label className="flex items-start gap-2"><input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-[var(--nova-surface-3)]"
            /><span className="font-semibold uppercase">Lembrar login neste dispositivo</span></label><span className="sm:max-w-[150px]">Salva apenas o e-mail.</span></div>

        {error ? (
          <div
            role="alert"
            className="nds-notice-error rounded-[6px] border px-3 py-2 text-[11px]"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="nds-button mt-1 w-full"
          data-variant="primary"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button></div></form>
  );
}
