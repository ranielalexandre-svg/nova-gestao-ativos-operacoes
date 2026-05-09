"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Tone = "green" | "orange" | "blue" | "red" | "purple" | "teal" | "slate";
type PermissionLevel = "none" | "read" | "write" | "admin";
type TabKey = "permissions" | "scopes" | "users" | "audit";

type ProfileModule = {
  label: string;
  description: string;
  icon: string;
  tone: Tone;
  value: string;
  level: PermissionLevel;
};

type LinkedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
};

type AuditItem = {
  id: string;
  atLabel: string;
  actorName: string;
  action: string;
  details: string;
};

type StoredProfileState = {
  permissions?: Record<string, PermissionLevel>;
  scopes?: Record<string, boolean>;
  active?: boolean;
  updatedAtLabel?: string;
  copies?: string[];
};

type ProfileEditorWorkspaceProps = {
  description: string;
  initialModules: ProfileModule[];
  linkedUsers: LinkedUser[];
  audits: AuditItem[];
  latestUserChangeLabel: string;
};

const STORAGE_KEY = "nova-profile-editor:operator-noc";

const LEVELS: Array<{ key: PermissionLevel; label: string }> = [
  { key: "none", label: "Sem acesso" },
  { key: "read", label: "Somente leitura" },
  { key: "write", label: "Leitura e escrita" },
  { key: "admin", label: "Administrativo" },
];

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "permissions", label: "Permissões", icon: "lock" },
  { key: "scopes", label: "Escopos", icon: "shield" },
  { key: "users", label: "Usuários vinculados", icon: "users" },
  { key: "audit", label: "Auditoria", icon: "activity" },
];

function safeInitialPermissions(modules: ProfileModule[]) {
  return modules.reduce<Record<string, PermissionLevel>>((acc, item) => {
    acc[item.label] = item.level;
    return acc;
  }, {});
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toneForRole(role: string): Tone {
  if (role === "admin") return "purple";
  if (role === "editor") return "blue";
  if (role === "operator") return "orange";
  if (role === "viewer") return "slate";
  return "slate";
}

function Icon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  switch (name) {
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle {...common} cx="9.5" cy="7" r="4" /><path {...common} d="M20 21v-2a4 4 0 0 0-3-3.9" /><path {...common} d="M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "lock":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="11" width="14" height="10" rx="2" /><path {...common} d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "activity":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 14h4l2-5 4 10 2-5h4" /></svg>;
    case "chart":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V4M4 20h16" /><path {...common} d="M8 16v-5M12 16V7M16 16v-8" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 3h9l3 3v15H6z" /><path {...common} d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
    case "book":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path {...common} d="M4 5.5V21" /></svg>;
    case "network":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 18h.01" /><path {...common} d="M8.5 14.5a5 5 0 0 1 7 0" /><path {...common} d="M5.5 11.5a9 9 0 0 1 13 0" /></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "save":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 3h12l2 2v16H5z" /><path {...common} d="M8 3v6h8V3M8 21v-7h8v7" /></svg>;
    case "copy":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="8" y="8" width="12" height="12" rx="2" /><path {...common} d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>;
    case "power":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 2v10" /><path {...common} d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-profile-editor-badge is-${tone}`}>{children}</span>;
}

function SwitchVisual({ active }: { active: boolean }) {
  return <span className={`nova-profile-editor-switch ${active ? "is-on" : ""}`} />;
}

export function ProfileEditorWorkspace({
  description,
  initialModules,
  linkedUsers,
  audits,
  latestUserChangeLabel,
}: ProfileEditorWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("permissions");
  const [permissions, setPermissions] = useState(() => safeInitialPermissions(initialModules));
  const [scopes, setScopes] = useState({ production: true, homologation: true, lab: true });
  const [active, setActive] = useState(true);
  const [updatedAtLabel, setUpdatedAtLabel] = useState(latestUserChangeLabel || "Sem alteração");
  const [copies, setCopies] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [localAudits, setLocalAudits] = useState<AuditItem[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as StoredProfileState;
      window.setTimeout(() => {
        if (stored.permissions) {
          setPermissions((current) => ({ ...current, ...stored.permissions }));
        }
        if (stored.scopes) {
          setScopes((current) => ({ ...current, ...stored.scopes }));
        }
        if (typeof stored.active === "boolean") {
          setActive(stored.active);
        }
        if (stored.updatedAtLabel) {
          setUpdatedAtLabel(stored.updatedAtLabel);
        }
        if (Array.isArray(stored.copies)) {
          setCopies(stored.copies.filter(Boolean).slice(0, 4));
        }
      }, 0);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const modules = useMemo(
    () => initialModules.map((item) => ({ ...item, level: permissions[item.label] || item.level })),
    [initialModules, permissions],
  );

  const levelCounts = useMemo(
    () =>
      modules.reduce<Record<PermissionLevel, number>>(
        (acc, row) => {
          acc[row.level] += 1;
          return acc;
        },
        { none: 0, read: 0, write: 0, admin: 0 },
      ),
    [modules],
  );

  const allAudits = [...localAudits, ...audits].slice(0, 6);
  const activeLinkedUsers = linkedUsers.filter((user) => user.isActive).length;

  function persist(next?: Partial<StoredProfileState>, message = "Alterações salvas.") {
    const timestamp = nowLabel();
    const payload: StoredProfileState = {
      permissions,
      scopes,
      active,
      updatedAtLabel: timestamp,
      copies,
      ...next,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setUpdatedAtLabel(payload.updatedAtLabel || timestamp);
    setFeedback(message);
    setLocalAudits((current) => [
      {
        id: `local-${Date.now()}`,
        atLabel: timestamp,
        actorName: "Administrador",
        action: message,
        details: "Perfil Operador NOC atualizado nesta estação.",
      },
      ...current,
    ]);
  }

  function changePermission(moduleLabel: string, level: PermissionLevel) {
    setPermissions((current) => ({ ...current, [moduleLabel]: level }));
    setFeedback("Alteração pendente. Salve para manter neste navegador.");
  }

  function toggleScope(key: keyof typeof scopes) {
    setScopes((current) => ({ ...current, [key]: !current[key] }));
    setFeedback("Escopo alterado. Salve para manter neste navegador.");
  }

  function saveProfile() {
    persist(undefined, "Alterações salvas.");
  }

  function duplicateProfile() {
    const copyName = `Perfil Operador NOC - cópia ${copies.length + 1}`;
    const nextCopies = [copyName, ...copies].slice(0, 4);
    setCopies(nextCopies);
    persist({ copies: nextCopies }, "Perfil duplicado.");
  }

  function toggleActive() {
    const nextActive = !active;
    setActive(nextActive);
    persist({ active: nextActive }, nextActive ? "Perfil reativado." : "Perfil desativado.");
  }

  return (
    <>
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
          <Badge tone={active ? "green" : "red"}>{active ? "Ativo" : "Inativo"}</Badge>
        </div>
        <p>Edite as permissões, escopos e vinculações deste perfil.</p>
      </header>

      <section className="nova-profile-editor-layout">
        <div className="nova-profile-editor-left">
          <section className="nova-profile-editor-card nova-profile-editor-summary">
            <div className="nova-profile-editor-profile-icon"><Icon name="users" /></div>
            <div>
              <h2>Perfil Operador NOC <Badge tone={active ? "green" : "red"}>{active ? "Ativo" : "Inativo"}</Badge></h2>
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
              <p>{description}</p>
            </div>
            <div>
              <span>Nível de aprovação</span>
              <Badge tone="purple">Nível 2</Badge>
              <p>Aprova rotinas de risco operacional baixo e médio.</p>
            </div>
            <div>
              <span>Escopo de ambiente</span>
              <p className="nova-profile-editor-scope">
                {scopes.production ? <Badge tone="green">Produção</Badge> : null}
                {scopes.homologation ? <Badge tone="blue">Homologação</Badge> : null}
                {scopes.lab ? <Badge tone="slate">Lab</Badge> : null}
                {!scopes.production && !scopes.homologation && !scopes.lab ? <Badge tone="red">Sem escopo</Badge> : null}
              </p>
            </div>
          </section>

          <section className="nova-profile-editor-card nova-profile-editor-permissions">
            <div className="nova-profile-editor-tabs" role="tablist" aria-label="Edição do perfil">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  data-active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon name={tab.icon} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "permissions" ? (
              <>
                <div className="nova-profile-editor-section-title">
                  <h2>Matriz de permissões</h2>
                  <p>Defina o nível de acesso deste perfil para cada área do sistema.</p>
                </div>

                <div className="nova-profile-editor-matrix">
                  <div className="nova-profile-editor-matrix-head">
                    <span />
                    {LEVELS.map((level) => <span key={level.key}>{level.label}</span>)}
                  </div>
                  {modules.map((row) => (
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
                      {LEVELS.map((level) => (
                        <button
                          key={`${row.label}-${level.key}`}
                          type="button"
                          className="nova-profile-editor-matrix-cell"
                          aria-label={`${row.label}: ${level.label}`}
                          aria-pressed={row.level === level.key}
                          onClick={() => changePermission(row.label, level.key)}
                        >
                          <SwitchVisual active={row.level === level.key} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {activeTab === "scopes" ? (
              <div className="nova-profile-editor-tab-panel">
                <div className="nova-profile-editor-section-title">
                  <h2>Escopos do perfil</h2>
                  <p>Controle em quais ambientes este perfil pode atuar.</p>
                </div>
                <div className="nova-profile-editor-scope-grid">
                  {[
                    { key: "production", label: "Produção", detail: "Permite rotinas operacionais reais.", tone: "green" as Tone },
                    { key: "homologation", label: "Homologação", detail: "Permite validação antes da operação.", tone: "blue" as Tone },
                    { key: "lab", label: "Lab", detail: "Permite simulações e testes isolados.", tone: "slate" as Tone },
                  ].map((scope) => (
                    <button
                      key={scope.key}
                      type="button"
                      className="nova-profile-editor-scope-option"
                      data-active={scopes[scope.key as keyof typeof scopes]}
                      onClick={() => toggleScope(scope.key as keyof typeof scopes)}
                    >
                      <Badge tone={scope.tone}>{scope.label}</Badge>
                      <span>{scope.detail}</span>
                      <SwitchVisual active={scopes[scope.key as keyof typeof scopes]} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "users" ? (
              <div className="nova-profile-editor-tab-panel">
                <div className="nova-profile-editor-section-title">
                  <h2>Usuários vinculados</h2>
                  <p>{linkedUsers.length} usuário(s) com este perfil, {activeLinkedUsers} ativo(s).</p>
                </div>
                <div className="nova-profile-editor-users-list">
                  {linkedUsers.map((user) => (
                    <Link key={user.id} href={`/usuarios?q=${encodeURIComponent(user.email)}`}>
                      <b className={`is-${toneForRole(user.role)}`}>{initials(user.name)}</b>
                      <span>{user.name}<small>{user.email}</small></span>
                      <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Ativo" : "Inativo"}</Badge>
                    </Link>
                  ))}
                  {!linkedUsers.length ? <p>Nenhum usuário vinculado a este perfil.</p> : null}
                </div>
              </div>
            ) : null}

            {activeTab === "audit" ? (
              <div className="nova-profile-editor-tab-panel">
                <div className="nova-profile-editor-section-title">
                  <h2>Auditoria do perfil</h2>
                  <p>Histórico recente de alterações administrativas no sistema.</p>
                </div>
                <table className="nova-profile-editor-inline-table">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Usuário</th>
                      <th>Ação</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAudits.length ? allAudits.map((audit) => (
                      <tr key={`tab-${audit.id}`}>
                        <td>{audit.atLabel}</td>
                        <td>{audit.actorName}</td>
                        <td>{audit.action}</td>
                        <td>{audit.details}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>Sem registros de auditoria carregados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
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
                {allAudits.length ? allAudits.slice(0, 4).map((audit) => (
                  <tr key={audit.id}>
                    <td>{audit.atLabel}</td>
                    <td>{audit.actorName}</td>
                    <td>{audit.action}</td>
                    <td>{audit.details}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}>Sem registros de auditoria carregados.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="nova-profile-editor-right">
          <section className="nova-profile-editor-card nova-profile-editor-side-card">
            <h2>Resumo do perfil</h2>
            <dl>
              <div><dt>Permissões total</dt><dd>{modules.length}</dd></div>
              <div><dt>Acesso administrativo</dt><dd>{levelCounts.admin}</dd></div>
              <div><dt>Acesso leitura e escrita</dt><dd>{levelCounts.write}</dd></div>
              <div><dt>Somente leitura</dt><dd>{levelCounts.read}</dd></div>
              <div><dt>Sem acesso</dt><dd>{levelCounts.none}</dd></div>
              <div><dt>Usuários vinculados</dt><dd>{linkedUsers.length}</dd></div>
              <div><dt>Última alteração</dt><dd>{updatedAtLabel}</dd></div>
              <div><dt>Status</dt><dd><Badge tone={active ? "green" : "red"}>{active ? "Ativo" : "Inativo"}</Badge></dd></div>
            </dl>
          </section>

          <section className="nova-profile-editor-card nova-profile-editor-side-card">
            <h2>Usuários vinculados <Link href="/usuarios?role=operator">Ver todos</Link></h2>
            <div className="nova-profile-editor-linked-users">
              {linkedUsers.slice(0, 5).map((user) => (
                <Link key={user.id} href={`/usuarios?q=${encodeURIComponent(user.email)}`}>
                  <b className={`is-${toneForRole(user.role)}`}>{initials(user.name)}</b>
                  <span>{user.name}<small>{user.roleLabel}</small></span>
                </Link>
              ))}
              {linkedUsers.length > 5 ? (
                <Link href="/usuarios?role=operator">
                  <b className="is-slate">+{linkedUsers.length - 5}</b>
                  <span>Mais usuários<small>Operador</small></span>
                </Link>
              ) : null}
              {!linkedUsers.length ? <p>Nenhum usuário vinculado a este perfil.</p> : null}
            </div>
          </section>

          <section className="nova-profile-editor-card nova-profile-editor-actions">
            <h2>Ações do perfil</h2>
            <button type="button" className="is-primary" onClick={saveProfile}><Icon name="save" />Salvar alterações</button>
            <button type="button" onClick={duplicateProfile}><Icon name="copy" />Duplicar perfil</button>
            <button type="button" className="is-danger" onClick={toggleActive}><Icon name="power" />{active ? "Desativar perfil" : "Reativar perfil"}</button>
            {feedback ? <p className="nova-profile-editor-action-feedback">{feedback}</p> : null}
            {copies.length ? (
              <div className="nova-profile-editor-copy-list">
                {copies.map((copy) => <span key={copy}>{copy}</span>)}
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </>
  );
}
