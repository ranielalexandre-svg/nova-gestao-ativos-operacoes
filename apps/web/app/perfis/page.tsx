import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiJson } from "@/lib/server-api";
import { formatDateTime } from "@/lib/formatters";
import type { PaginatedResponse } from "@/lib/list-query";
import { ProfileEditorWorkspace } from "./profile-editor-workspace";
import {
  isAdminRole,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_ROWS,
  roleLabel,
} from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "purple" | "teal" | "slate";
type PermissionLevel = "none" | "read" | "write" | "admin";
type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "book"
  | "building"
  | "chart"
  | "chevron"
  | "copy"
  | "eye"
  | "file"
  | "home"
  | "lock"
  | "menu"
  | "moon"
  | "network"
  | "power"
  | "save"
  | "settings"
  | "shield"
  | "users";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

type AuditRow = {
  id: string;
  at: string;
  actorName: string;
  action: string;
  targetType: string;
  targetLabel: string;
  details: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

const ACTIVE_ROLE = "operator";

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Geral",
    items: [{ label: "Visão geral", href: "/dashboard", icon: "home" }],
  },
  {
    label: "Monitoramento",
    items: [
      { label: "Unidades", href: "/unidades", icon: "building" },
      { label: "Sensores", href: "/sensores", icon: "network" },
      { label: "Mapas", href: "/mapas", icon: "book" },
      { label: "Alertas", href: "/alertas", icon: "alert" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Ativos", href: "/ativos", icon: "file" },
      { label: "Contratos", href: "/contratos", icon: "book" },
      { label: "Chamados", href: "/chamados", icon: "activity" },
      { label: "Exceções", href: "/excecoes", icon: "shield" },
      { label: "Automação", href: "/automacao", icon: "settings" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Monitoramento", href: "/relatorios/monitoramento", icon: "chart" },
      { label: "Consumo", href: "/relatorios/consumo", icon: "chart" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "chart" },
      { label: "Performance", href: "/relatorios/performance", icon: "chart" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Usuários", href: "/usuarios", icon: "users" },
      { label: "Perfis", href: "/perfis", icon: "users" },
      { label: "Integrações", href: "/integracoes", icon: "settings" },
      { label: "Configurações", href: "/configuracoes", icon: "settings" },
      { label: "Sistema", href: "/configuracoes", icon: "settings" },
    ],
  },
];

const PROFILE_MODULES = [
  {
    label: "Dashboard",
    description: "Visão geral, indicadores e widgets",
    sourceModule: "Relatórios",
    icon: "chart" as IconName,
    tone: "orange" as Tone,
  },
  {
    label: "Monitoramento",
    description: "Unidades, sensores, mapas e alertas",
    sourceModule: "Operação e fila",
    icon: "activity" as IconName,
    tone: "teal" as Tone,
  },
  {
    label: "Gestão",
    description: "Ativos, contratos, chamados e automação",
    sourceModule: "Cadastros principais",
    icon: "file" as IconName,
    tone: "green" as Tone,
  },
  {
    label: "Relatórios",
    description: "Monitoramento, consumo, disponibilidade e performance",
    sourceModule: "Relatórios",
    icon: "book" as IconName,
    tone: "purple" as Tone,
  },
  {
    label: "Usuários",
    description: "Usuários, perfis e auditoria de acessos",
    sourceModule: "Usuários e perfis",
    icon: "users" as IconName,
    tone: "blue" as Tone,
  },
  {
    label: "Integrações",
    description: "APIs, conectores e integrações externas",
    sourceModule: "Integrações",
    icon: "network" as IconName,
    tone: "green" as Tone,
  },
  {
    label: "Sistemas",
    description: "Configurações gerais e informações do sistema",
    sourceModule: "Sistema e credenciais",
    icon: "settings" as IconName,
    tone: "orange" as Tone,
  },
];

function Icon({ name }: { name: IconName }) {
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
    case "book":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path {...common} d="M4 5.5V21" /></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 22 20H2L12 3z" /><path {...common} d="M12 9v5M12 17h.01" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "chart":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V4M4 20h16" /><path {...common} d="M8 16v-5M12 16V7M16 16v-8" /></svg>;
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M20 21v-2a4 4 0 0 0-3-3.9" /><path {...common} d="M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
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
    case "lock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="11" width="14" height="10" rx="2" /><path {...common} d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case "eye":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle {...common} cx="12" cy="12" r="3" /></svg>;
    case "save":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 3h12l2 2v16H5z" /><path {...common} d="M8 3v6h8V3M8 21v-7h8v7" /></svg>;
    case "copy":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="8" y="8" width="12" height="12" rx="2" /><path {...common} d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>;
    case "power":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 2v10" /><path {...common} d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>;
    case "chevron":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m9 18 6-6-6-6" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function permissionValue(sourceModule: string) {
  const row = ROLE_PERMISSION_ROWS.find((item) => item.module === sourceModule);
  return row?.permissions[ACTIVE_ROLE] || "Sem acesso";
}

function permissionLevel(value: string): PermissionLevel {
  if (value === "Administra") return "admin";
  if (["Edita", "Exporta", "Opera", "Comenta"].includes(value)) return "write";
  if (value === "Consulta") return "read";
  return "none";
}

function Nav() {
  return (
    <aside className="nova-profile-editor-sidebar">
      <Link href="/dashboard" className="nova-profile-editor-logo" aria-label="NOVA Telecom">
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
          <section key={section.label} className="nova-profile-editor-nav-section">
            <h2>{section.label}</h2>
            {section.items.map((item) => (
              <Link
                key={`${section.label}-${item.href}-${item.label}`}
                href={item.href}
                className="nova-profile-editor-nav-link"
                data-active={section.label === "Configurações" && item.href === "/perfis"}
              >
                <Icon name={item.icon} />
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
    <header className="nova-profile-editor-topbar">
      <div>
        <button type="button" aria-label="Menu"><Icon name="menu" /></button>
      </div>
      <div>
        <button type="button" aria-label="Notificações"><Icon name="bell" /><i>3</i></button>
        <button type="button" aria-label="Ajuda">?</button>
        <button type="button" aria-label="Tema"><Icon name="moon" /></button>
        <Link href="/usuarios" className="nova-profile-editor-user">
          <span>
            <strong>{userName || "Administrador"}</strong>
            <small>{userEmail || "admin@novatelecom.com.br"}</small>
          </span>
          <b>{initials(userName || "Administrador").slice(0, 1)}</b>
        </Link>
      </div>
    </header>
  );
}

async function readUsers() {
  try {
    return await apiJson<PaginatedResponse<UserRow>>(
      "/users?page=1&pageSize=100&active=all&sortBy=role&sortDir=asc",
    );
  } catch {
    return {
      items: [],
      meta: {
        page: 1,
        pageSize: 100,
        total: 0,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    };
  }
}

async function readAudits() {
  try {
    return await apiJson<AuditRow[]>("/audits?limit=4");
  } catch {
    return [];
  }
}

export default async function PerfisPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/perfis");
  if (!isAdminRole(session.user?.role || "")) redirect("/dashboard");

  const [users, audits] = await Promise.all([readUsers(), readAudits()]);
  const roleDefinition = ROLE_DEFINITIONS.find((role) => role.key === ACTIVE_ROLE);
  const linkedUsers = users.items.filter((user) => user.role === ACTIVE_ROLE);
  const latestUserChange = users.items
    .map((user) => user.updatedAt || user.createdAt)
    .sort()
    .at(-1);
  const moduleRows = PROFILE_MODULES.map((module) => {
    const value = permissionValue(module.sourceModule);
    return {
      ...module,
      value,
      level: permissionLevel(value),
    };
  });
  const linkedUsersPayload = linkedUsers.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: roleLabel(user.role),
    isActive: user.isActive,
  }));
  const auditsPayload = audits.map((audit) => ({
    id: audit.id,
    atLabel: formatDateTime(audit.at),
    actorName: audit.actorName,
    action: audit.action,
    details: audit.details || audit.targetLabel,
  }));

  return (
    <div className="nova-profile-editor-shell">
      <Nav />
      <div className="nova-profile-editor-main">
        <Topbar userEmail={session.user?.email} userName={session.user?.name} />
        <main className="nova-profile-editor-page">
          <ProfileEditorWorkspace
            description={roleDefinition?.description || "Perfil operacional do sistema."}
            initialModules={moduleRows}
            linkedUsers={linkedUsersPayload}
            audits={auditsPayload}
            latestUserChangeLabel={
              latestUserChange ? formatDateTime(latestUserChange) : "Sem alteração"
            }
          />
        </main>
      </div>
    </div>
  );
}
