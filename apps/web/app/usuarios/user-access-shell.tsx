import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "building"
  | "chart"
  | "chevron"
  | "file"
  | "home"
  | "lock"
  | "mail"
  | "menu"
  | "moon"
  | "network"
  | "plus-user"
  | "refresh"
  | "settings"
  | "shield"
  | "trash"
  | "users";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Geral",
    items: [
      { label: "Visão geral", href: "/dashboard", icon: "home" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Mapas", href: "/mapas", icon: "chart" },
      { label: "Alertas", href: "/alertas", icon: "alert" },
    ],
  },
  {
    label: "Monitoramento",
    items: [
      { label: "Infraestrutura", href: "/monitoramento", icon: "building" },
      { label: "Serviços", href: "/sensores", icon: "network" },
      { label: "Links", href: "/alertas", icon: "activity" },
      { label: "Sensores", href: "/sensores", icon: "chart" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Ativos", href: "/ativos", icon: "file" },
      { label: "Starlinks", href: "/ativos/starlinks", icon: "network" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Usuários", href: "/usuarios", icon: "users" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Consumo", href: "/relatorios/consumo", icon: "chart" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "activity" },
      { label: "Performance", href: "/relatorios/performance", icon: "activity" },
      { label: "SLA", href: "/operacao/sla", icon: "shield" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Perfis", href: "/perfis", icon: "users" },
      { label: "Usuários", href: "/usuarios", icon: "plus-user" },
      { label: "Integrações", href: "/integracoes", icon: "settings" },
      { label: "Configurações", href: "/configuracoes", icon: "settings" },
    ],
  },
];

export function UserAccessIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  switch (name) {
    case "home":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m3 11 9-8 9 8" /><path {...common} d="M5 10v10h14V10" /></svg>;
    case "building":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 21V4h14v17" /><path {...common} d="M9 8h2M13 8h2M9 12h2M13 12h2M3 21h18" /></svg>;
    case "network":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 18h.01" /><path {...common} d="M8.5 14.5a5 5 0 0 1 7 0" /><path {...common} d="M5.5 11.5a9 9 0 0 1 13 0" /></svg>;
    case "chart":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V4M4 20h16" /><path {...common} d="M8 16v-5M12 16V7M16 16v-8" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 22 20H2L12 3z" /><path {...common} d="M12 9v5M12 17h.01" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
    case "users":
    case "plus-user":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M19 8v6M22 11h-6" /></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "bell":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path {...common} d="M10 21h4" /></svg>;
    case "menu":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "moon":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12.8A8 8 0 1 1 11.2 3a6.2 6.2 0 0 0 9.8 9.8z" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path {...common} d="M3 12A9 9 0 0 1 18.5 5.7L21 8" /></svg>;
    case "trash":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>;
    case "mail":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 5h16v14H4z" /><path {...common} d="m4 7 8 6 8-6" /></svg>;
    case "lock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="11" width="14" height="10" rx="2" /><path {...common} d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case "chevron":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m9 18 6-6-6-6" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Nav() {
  return (
    <aside className="nova-users-board-sidebar">
      <Link href="/dashboard" className="nova-users-board-logo" aria-label="NOVA Telecom">
        <Image
          src="/brand/nova-telecom-logo.svg"
          alt="NOVA Telecom"
          width={170}
          height={70}
          priority
        />
      </Link>
      <nav aria-label="Navegação principal">
        {NAV_SECTIONS.map((section) => (
          <section key={section.label} className="nova-users-board-nav-section">
            <h2>{section.label}</h2>
            {section.items.map((item) => (
              <Link
                key={`${section.label}-${item.href}-${item.label}`}
                href={item.href}
                className="nova-users-board-nav-link"
                data-active={section.label === "Configurações" && item.href === "/usuarios"}
              >
                <UserAccessIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ userEmail, userName }: { userEmail?: string; userName?: string }) {
  return (
    <header className="nova-users-board-topbar">
      <div>
        <Link href="/dashboard" className="nova-users-board-topbar-action" aria-label="Menu">
          <UserAccessIcon name="menu" />
        </Link>
        <span>Sistema de gestão operacional</span>
      </div>
      <div>
        <Link href="/alertas" className="nova-users-board-topbar-action" aria-label="Notificações">
          <UserAccessIcon name="bell" />
          <i>12</i>
        </Link>
        <Link href="/configuracoes" className="nova-users-board-topbar-action" aria-label="Ajuda">
          ?
        </Link>
        <Link href="/configuracoes" className="nova-users-board-topbar-action" aria-label="Tema">
          <UserAccessIcon name="moon" />
        </Link>
        <Link href="/usuarios" className="nova-users-board-user">
          <b>{initials(userName || "Administrador").slice(0, 1)}</b>
          <span>{userName || "Administrador"}<small>{userEmail || "admin@novatelecom.com.br"}</small></span>
          <UserAccessIcon name="chevron" />
        </Link>
      </div>
    </header>
  );
}

export function UserAccessShell({
  userEmail,
  userName,
  children,
}: {
  userEmail?: string;
  userName?: string;
  children: ReactNode;
}) {
  return (
    <div className="nova-users-board-shell">
      <Nav />
      <div className="nova-users-board-main">
        <Topbar userEmail={userEmail} userName={userName} />
        {children}
      </div>
    </div>
  );
}
