"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

const REMEMBERED_EMAIL_KEY = "nova.login.email";
const BOARD_WIDTH = 1800;
const BOARD_HEIGHT = 1000;
const FRAME_WIDTH = 1736;
const FRAME_HEIGHT = 940;
const FRAME_OFFSET_X = 32;
const FRAME_OFFSET_Y = 30;

function safeNext(value: string | null) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="m4.5 7.5 7.5 5.8 7.5-5.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="10" width="10" height="9" rx="2" />
      <path d="M9 10V7.8a3 3 0 0 1 6 0V10" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.7 18 6v5.2c0 4.2-2.5 7.3-6 9-3.5-1.7-6-4.8-6-9V6l6-2.3Z" />
      <path d="m9.4 12 1.8 1.8 3.8-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 17h5l3-8 5 15 4-7h5" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 24V14" />
      <path d="M16 24V8" />
      <path d="M24 24V18" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="11" width="16" height="13" rx="3" />
      <path d="M16 11V6" />
      <path d="M12 6h8" />
      <path d="M12 17h.1" />
      <path d="M20 17h.1" />
      <path d="M13 22h6" />
    </svg>
  );
}

function NovaLogo() {
  return (
    <div className="nova-login-fixed-logo" aria-label="NOVA Telecom">
      <div>NOV<span>A</span></div>
      <strong>TELECOM</strong>
    </div>
  );
}

function FeatureCard({
  tone,
  icon,
  title,
  text,
  label,
  value,
}: {
  tone: "orange" | "purple" | "cyan";
  icon: ReactNode;
  title: string;
  text: string;
  label: string;
  value: string;
}) {
  return (
    <article className={`nova-login-fixed-feature is-${tone}`}>
      <div className="nova-login-fixed-feature-main">
        <span>{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
      </div>

      <footer>
        <small>{label}</small>
        <b>{value}</b>
      </footer>
    </article>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const loginAction = `/api/auth/web-session?next=${encodeURIComponent(next)}`;

  const [scale, setScale] = useState(1);
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      const availableWidth = Math.max(320, window.innerWidth - 64);
      const widthScale = availableWidth / FRAME_WIDTH;

      // Mockup literal: prioriza largura para manter o tamanho visual da prancha.
      // Em telas com pouca altura, a página rola verticalmente em vez de virar miniatura.
      setScale(Math.max(0.78, Math.min(1.04, widthScale)));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRemember(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const normalizedEmail = String(formData.get("email") || "").trim();

    if (remember && normalizedEmail) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  }

  return (
    <main className="nova-login-fixed-page">
      <div
        className="nova-login-fixed-wrap"
        style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
      >
        <section
          className="nova-login-fixed-stage"
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            left: -FRAME_OFFSET_X * scale,
            top: -FRAME_OFFSET_Y * scale,
            transform: `scale(${scale})`,
          }}
          aria-label="Login NOVA Telecom"
        >
          <div className="nova-login-fixed-frame" />
          <div className="nova-login-fixed-grid" />

          <NovaLogo />

          <div className="nova-login-fixed-online">
            <span />
            Operação online
          </div>

          <section className="nova-login-fixed-copy">
            <h1>
              Bem-vindo ao sistema de
              <br />
              gestão operacional
            </h1>
            <p>
              Monitore, analise e automatize suas operações de telecom com
              inteligência e segurança.
            </p>
            <i />
          </section>

          <div className="nova-login-fixed-network" aria-hidden="true">
            <div className="nova-login-fixed-earth" />
            <span className="beam beam-1" />
            <span className="beam beam-2" />
            <span className="beam beam-3" />
            <span className="beam beam-4" />
            <span className="orbit orbit-1" />
            <span className="orbit orbit-2" />
            <span className="orbit orbit-3" />
            <span className="node node-1" />
            <span className="node node-2" />
            <span className="node node-3" />
            <span className="node node-4" />
          </div>

          <section className="nova-login-fixed-features" aria-label="Recursos">
            <FeatureCard
              tone="orange"
              icon={<MonitorIcon />}
              title="Monitoramento"
              text="Acompanhe serviços, redes e dispositivos em tempo real."
              label="Operação contínua"
              value="24/7"
            />
            <FeatureCard
              tone="purple"
              icon={<ReportsIcon />}
              title="Relatórios"
              text="Dashboards e relatórios com métricas inteligentes."
              label="Dados confiáveis"
              value="100%"
            />
            <FeatureCard
              tone="cyan"
              icon={<BotIcon />}
              title="Automação"
              text="Fluxos automatizados e processos sem intervenção."
              label="Eficiência operacional"
              value="Alta"
            />
          </section>

          <footer className="nova-login-fixed-safe">
            <ShieldIcon />
            <span>Segurança, performance e disponibilidade para o seu negócio.</span>
          </footer>

          <form
            method="post"
            action={loginAction}
            onSubmit={handleSubmit}
            className="nova-login-fixed-card"
            aria-label="Formulário de acesso"
          >
            <div className="nova-login-fixed-lock">
              <LockIcon />
            </div>

            <header className="nova-login-fixed-card-title">
              <h2>Acessar plataforma</h2>
              <p>Informe suas credenciais para continuar</p>
            </header>

            <label className="nova-login-fixed-field">
              <span>E-mail</span>
              <div>
                <MailIcon />
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu.email@empresa.com"
                />
              </div>
            </label>

            <label className="nova-login-fixed-field">
              <span>Senha</span>
              <div>
                <LockIcon />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeIcon />
                </button>
              </div>
            </label>

            <div className="nova-login-fixed-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Lembrar acesso</span>
              </label>

              <a href="/login?forgot=1">Esqueci minha senha</a>
            </div>

            <button className="nova-login-fixed-submit" type="submit">
              <span>Entrar</span>
              <ArrowIcon />
            </button>

            <button className="nova-login-fixed-sso" type="button">
              <ShieldIcon />
              <span>Acessar com SSO</span>
            </button>

            <footer className="nova-login-fixed-card-footer">
              <ShieldIcon />
              <span>Ambiente seguro</span>
              <i />
              <span>Nova Telecom</span>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}
