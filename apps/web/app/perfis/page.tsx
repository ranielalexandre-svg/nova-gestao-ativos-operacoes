import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { apiJson } from "@/lib/server-api";
import { formatDateTime } from "@/lib/formatters";
import type { PaginatedResponse } from "@/lib/list-query";
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

function levelLabel(level: PermissionLevel) {
  if (level === "admin") return "Administrativo";
  if (level === "write") return "Leitura e escrita";
  if (level === "read") return "Somente leitura";
  return "Sem acesso";
}

function toneForRole(role: string): Tone {
  if (role === "admin") return "purple";
  if (role === "editor") return "blue";
  if (role === "operator") return "orange";
  if (role === "viewer") return "slate";
  return "slate";
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-profile-editor-badge is-${tone}`}>{children}</span>;
}

function Switch({ active }: { active: boolean }) {
  return <span className={`nova-profile-editor-switch ${active ? "is-on" : ""}`} />;
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
  const levelCounts = moduleRows.reduce<Record<PermissionLevel, number>>(
    (acc, row) => {
      acc[row.level] += 1;
      return acc;
    },
    { none: 0, read: 0, write: 0, admin: 0 },
  );

  return (
    <div className="nova-profile-editor-shell">
      <Nav />
      <div className="nova-profile-editor-main">
        <Topbar userEmail={session.user?.email} userName={session.user?.name} />
        <main className="nova-profile-editor-page">
          <header className="nova-profile-editor-heading">
            <nav aria-label="Breadcrumb">
              <Link href="/configuracoes">Configurações</Link>
              <span>/</span>
              <Link href="/perfis">Perfis</Link>
              <span>/</span>
              <strong>Editar perfil</strong>
            </nav>
            <div>
              <h1>Perfil Operador NOC</h1>
              <Badge tone="green">Ativo</Badge>
            </div>
            <p>Edite as permissões, escopos e vinculações deste perfil.</p>
          </header>

          <section className="nova-profile-editor-layout">
            <div className="nova-profile-editor-left">
              <section className="nova-profile-editor-card nova-profile-editor-summary">
                <div className="nova-profile-editor-profile-icon"><Icon name="users" /></div>
                <div>
                  <h2>Perfil Operador NOC <Badge tone="green">Ativo</Badge></h2>
                  <dl>
                    <div>
                      <dt>Código do perfil</dt>
                      <dd>OP-NOC-001</dd>
                    </div>
                    <div>
                      <dt>Criado em</dt>
                      <dd>Perfil padrão</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <span>Descrição do perfil</span>
                  <p>{roleDefinition?.description || "Perfil operacional do sistema."}</p>
                </div>
                <div>
                  <span>Nível de aprovação</span>
                  <Badge tone="purple">Nível 2</Badge>
                  <p>Aprova rotinas de risco operacional baixo e médio.</p>
                </div>
                <div>
                  <span>Escopo de ambiente</span>
                  <p className="nova-profile-editor-scope">
                    <Badge tone="green">Produção</Badge>
                    <Badge tone="blue">Homologação</Badge>
                    <Badge tone="slate">Lab</Badge>
                  </p>
                </div>
              </section>

              <section className="nova-profile-editor-card nova-profile-editor-permissions">
                <div className="nova-profile-editor-tabs">
                  <Link href="/perfis" data-active="true"><Icon name="lock" />Permissões</Link>
                  <Link href="/perfis"><Icon name="shield" />Escopos</Link>
                  <Link href="/usuarios?role=operator"><Icon name="users" />Usuários vinculados</Link>
                  <Link href="/perfis"><Icon name="activity" />Auditoria</Link>
                </div>
                <div className="nova-profile-editor-section-title">
                  <h2>Matriz de permissões</h2>
                  <p>Defina o nível de acesso deste perfil para cada área do sistema.</p>
                </div>

                <div className="nova-profile-editor-matrix">
                  <div className="nova-profile-editor-matrix-head">
                    <span />
                    <span>Sem acesso</span>
                    <span>Somente leitura</span>
                    <span>Leitura e escrita</span>
                    <span>Administrativo</span>
                  </div>
                  {moduleRows.map((row) => (
                    <div key={row.label} className="nova-profile-editor-matrix-row">
                      <div>
                        <span className={`nova-profile-editor-module-icon is-${row.tone}`}>
                          <Icon name={row.icon} />
                        </span>
                        <span>
                          <strong>{row.label}</strong>
                          <small>{row.description}</small>
                        </span>
                      </div>
                      {(["none", "read", "write", "admin"] as PermissionLevel[]).map((level) => (
                        <span key={`${row.label}-${level}`} title={levelLabel(level)}>
                          <Switch active={row.level === level} />
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              <section className="nova-profile-editor-card nova-profile-editor-audit">
                <div className="nova-profile-editor-section-title">
                  <h2>Log de auditoria do perfil</h2>
                  <p>Histórico recente de alterações administrativas no sistema.</p>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Usuário</th>
                      <th>Ação</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.length ? audits.map((audit) => (
                      <tr key={audit.id}>
                        <td>{formatDateTime(audit.at)}</td>
                        <td>{audit.actorName}</td>
                        <td>{audit.action}</td>
                        <td>{audit.details || audit.targetLabel}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4}>Sem registros de auditoria carregados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </div>

            <aside className="nova-profile-editor-right">
              <section className="nova-profile-editor-card nova-profile-editor-side-card">
                <h2>Resumo do perfil</h2>
                <dl>
                  <div><dt>Permissões total</dt><dd>{moduleRows.length}</dd></div>
                  <div><dt>Acesso administrativo</dt><dd>{levelCounts.admin}</dd></div>
                  <div><dt>Acesso leitura e escrita</dt><dd>{levelCounts.write}</dd></div>
                  <div><dt>Somente leitura</dt><dd>{levelCounts.read}</dd></div>
                  <div><dt>Sem acesso</dt><dd>{levelCounts.none}</dd></div>
                  <div><dt>Usuários vinculados</dt><dd>{linkedUsers.length}</dd></div>
                  <div><dt>Última alteração</dt><dd>{latestUserChange ? formatDateTime(latestUserChange) : "Sem alteração"}</dd></div>
                  <div><dt>Status</dt><dd><Badge tone="green">Ativo</Badge></dd></div>
                </dl>
              </section>

              <section className="nova-profile-editor-card nova-profile-editor-side-card">
                <h2>Usuários vinculados <Link href="/usuarios?role=operator">Ver todos</Link></h2>
                <div className="nova-profile-editor-linked-users">
                  {linkedUsers.slice(0, 5).map((user) => (
                    <Link key={user.id} href={`/usuarios?q=${encodeURIComponent(user.email)}`}>
                      <b className={`is-${toneForRole(user.role)}`}>{initials(user.name)}</b>
                      <span>{user.name}<small>{roleLabel(user.role)}</small></span>
                    </Link>
                  ))}
                  {linkedUsers.length > 5 ? (
                    <Link href="/usuarios?role=operator">
                      <b className="is-slate">+{linkedUsers.length - 5}</b>
                      <span>Mais usuários<small>{roleLabel(ACTIVE_ROLE)}</small></span>
                    </Link>
                  ) : null}
                  {!linkedUsers.length ? <p>Nenhum usuário vinculado a este perfil.</p> : null}
                </div>
              </section>

              <section className="nova-profile-editor-card nova-profile-editor-actions">
                <h2>Ações do perfil</h2>
                <Link href="/perfis" className="is-primary"><Icon name="save" />Salvar alterações</Link>
                <Link href="/perfis"><Icon name="copy" />Duplicar perfil</Link>
                <Link href="/perfis" className="is-danger"><Icon name="power" />Desativar perfil</Link>
              </section>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
