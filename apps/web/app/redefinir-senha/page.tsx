"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5l17 17M10.6 10.7a2 2 0 0 0 2.8 2.8" />
      <path d="M8.2 8.3C6.5 9.3 5 10.8 3.5 12s3.2 5 8.5 5c1.7 0 3.2-.4 4.5-1.1M16 14.7c1.1-.9 2-1.8 2.8-2.7-1.7-2.4-4.5-5-8.8-5-.5 0-1 0-1.5.1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="10" width="10" height="9" rx="2" />
      <path d="M9 10V7.8a3 3 0 0 1 6 0V10" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function StrengthBar({ password }: { password: string }) {
  function score(p: string) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, s);
  }

  const s = score(password);
  const labels = ["", "Fraca", "Regular", "Boa", "Forte"];
  const colors = ["", "#ff3d70", "#f59e0b", "#38bdf8", "#22c563"];

  if (!password) return null;

  return (
    <div className="nova-auth-strength">
      <div className="nova-auth-strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="nova-auth-strength-bar"
            style={{ background: i <= s ? colors[s] : undefined }}
          />
        ))}
      </div>
      <span style={{ color: colors[s] }}>{labels[s]}</span>
    </div>
  );
}

function RedefinirSenhaForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace("/esqueci-senha");
    }
  }, [token, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "Erro ao redefinir senha. Tente novamente.");
      } else {
        setDone(true);
        // Redireciona para login após 3 segundos
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Falha na conexão. Verifique sua rede e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <main className="nova-auth-page">
      <div className="nova-auth-card">
        {/* Logo */}
        <div className="nova-auth-brand">
          <div className="nova-auth-brand-mark">N</div>
          <div>
            <div className="nova-auth-brand-name">NOVA</div>
            <div className="nova-auth-brand-sub">SECAD · Tocantins</div>
          </div>
        </div>

        {done ? (
          /* ─── Sucesso ─── */
          <div className="nova-auth-success">
            <div className="nova-auth-success-icon">
              <CheckCircle />
            </div>
            <h1 className="nova-auth-title">Senha redefinida!</h1>
            <p className="nova-auth-subtitle">
              Sua senha foi alterada com sucesso. Redirecionando para o login em alguns segundos...
            </p>
            <Link href="/login" className="nova-auth-button-primary" style={{ marginTop: "16px", display: "inline-block" }}>
              Ir para o login agora
            </Link>
          </div>
        ) : (
          /* ─── Formulário ─── */
          <>
            <div className="nova-auth-header">
              <h1 className="nova-auth-title">Criar nova senha</h1>
              <p className="nova-auth-subtitle">
                Escolha uma senha segura. Ela deve ter pelo menos 8 caracteres, uma maiúscula e um número.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="nova-auth-form" noValidate>
              {/* Nova senha */}
              <label className="nova-auth-field">
                <span className="nova-auth-label">
                  Nova senha <span aria-hidden="true">*</span>
                </span>
                <div className="nova-auth-input-wrap">
                  <span className="nova-auth-input-icon"><LockIcon /></span>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="nova-auth-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="nova-auth-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <StrengthBar password={password} />
              </label>

              {/* Confirmar senha */}
              <label className="nova-auth-field">
                <span className="nova-auth-label">
                  Confirmar nova senha <span aria-hidden="true">*</span>
                </span>
                <div className="nova-auth-input-wrap">
                  <span className="nova-auth-input-icon"><LockIcon /></span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`nova-auth-input ${
                      confirmPassword && password !== confirmPassword
                        ? "is-error"
                        : ""
                    }`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="nova-auth-eye"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <span className="nova-auth-field-error" role="alert">
                    As senhas não coincidem.
                  </span>
                )}
              </label>

              {error && (
                <div role="alert" className="nova-auth-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="nova-auth-button-primary nova-auth-button-full"
                disabled={
                  loading ||
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword
                }
              >
                {loading ? "Salvando..." : "Definir nova senha"}
              </button>
            </form>

            <div className="nova-auth-footer">
              <Link href="/esqueci-senha" className="nova-auth-back-link">
                Solicitar novo link
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/login" className="nova-auth-back-link">
                Voltar ao login
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
