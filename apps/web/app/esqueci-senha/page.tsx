"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="m4.5 7.5 7.5 5.8 7.5-5.8" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
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

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok && data?.message) {
        setError(data.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Falha na conexão. Verifique sua rede e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

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

        {sent ? (
          /* ─── Estado de sucesso ─── */
          <div className="nova-auth-success">
            <div className="nova-auth-success-icon">
              <CheckCircle />
            </div>
            <h1 className="nova-auth-title">Verifique seu e-mail</h1>
            <p className="nova-auth-subtitle">
              Se houver uma conta vinculada a <strong>{email}</strong>, você receberá um link
              de recuperação em alguns minutos.
            </p>
            <p className="nova-auth-hint">
              Não recebeu? Verifique a caixa de spam ou aguarde alguns minutos antes de tentar novamente.
            </p>
            <div className="nova-auth-actions">
              <button
                type="button"
                className="nova-auth-button-secondary"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Tentar outro e-mail
              </button>
              <Link href="/login" className="nova-auth-button-primary">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : (
          /* ─── Formulário ─── */
          <>
            <div className="nova-auth-header">
              <h1 className="nova-auth-title">Recuperar senha</h1>
              <p className="nova-auth-subtitle">
                Informe o e-mail da sua conta. Enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="nova-auth-form" noValidate>
              <label className="nova-auth-field">
                <span className="nova-auth-label">
                  E-mail institucional <span aria-hidden="true">*</span>
                </span>
                <div className="nova-auth-input-wrap">
                  <span className="nova-auth-input-icon"><MailIcon /></span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="seu.email@secad.to.gov.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nova-auth-input"
                    disabled={loading}
                  />
                </div>
              </label>

              {error && (
                <div role="alert" className="nova-auth-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="nova-auth-button-primary nova-auth-button-full"
                disabled={loading || !email.trim()}
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>

            <div className="nova-auth-footer">
              <Link href="/login" className="nova-auth-back-link">
                <ArrowLeft />
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
