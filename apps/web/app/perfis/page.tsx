import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import { formatDate } from "@/lib/formatters";
import type { PaginatedResponse } from "@/lib/list-query";
import {
  isAdminRole,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_ROWS,
  roleLabel,
} from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function roleToneLocal(role: string): Tone {
  if (role === "admin") return "green";
  if (role === "editor") return "blue";
  if (role === "operator") return "orange";
  if (role === "viewer") return "slate";
  return "red";
}

function permissionTone(value: string): Tone {
  if (["Administra", "Edita", "Exporta", "Opera"].includes(value)) return "green";
  if (value === "Comenta") return "orange";
  if (value === "Consulta") return "blue";
  return "slate";
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-profiles-badge ${toneClass(tone)}`}>{children}</span>;
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-profiles-metric ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProgressLine({
  label,
  value,
  total,
  tone,
  detail,
}: {
  label: string;
  value: number;
  total: number;
  tone: Tone;
  detail?: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="nova-profiles-progress-line">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="nova-profiles-track" aria-label={`${label}: ${percent}%`}>
        <i className={toneClass(tone)} style={{ width: `${percent}%` }} />
      </div>
      {detail ? <small>{detail}</small> : null}
    </div>
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

export default async function PerfisPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/perfis");
  if (!isAdminRole(session.user?.role || "")) redirect("/dashboard");

  const users = await readUsers();
  const activeUsers = users.items.filter((user) => user.isActive);
  const inactiveUsers = users.items.filter((user) => !user.isActive);
  const unknownRoles = users.items.filter(
    (user) => !ROLE_DEFINITIONS.some((role) => role.key === user.role),
  );

  const roleStats = ROLE_DEFINITIONS.map((role) => {
    const roleUsers = users.items.filter((user) => user.role === role.key);
    const active = roleUsers.filter((user) => user.isActive);

    return {
      ...role,
      total: roleUsers.length,
      active: active.length,
      inactive: roleUsers.length - active.length,
      users: roleUsers,
    };
  });

  const activeAdmins = roleStats.find((role) => role.key === "admin")?.active || 0;
  const activeEditors = roleStats.find((role) => role.key === "editor")?.active || 0;
  const activeOperators = roleStats.find((role) => role.key === "operator")?.active || 0;
  const activeViewers = roleStats.find((role) => role.key === "viewer")?.active || 0;

  const permissionValues = ROLE_PERMISSION_ROWS.flatMap((row) =>
    ROLE_DEFINITIONS.map((role) => row.permissions[role.key]),
  );
  const grantedPermissions = permissionValues.filter((value) =>
    ["Administra", "Edita", "Exporta", "Opera"].includes(value),
  ).length;
  const partialPermissions = permissionValues.filter((value) =>
    ["Consulta", "Comenta"].includes(value),
  ).length;
  const deniedPermissions = Math.max(
    0,
    permissionValues.length - grantedPermissions - partialPermissions,
  );
  const grantedPercent = permissionValues.length
    ? Math.round((grantedPermissions / permissionValues.length) * 100)
    : 0;
  const partialEndPercent = permissionValues.length
    ? Math.round(((grantedPermissions + partialPermissions) / permissionValues.length) * 100)
    : 0;
  const permissionDonutStyle = {
    "--nova-profiles-donut-granted": `${grantedPercent}%`,
    "--nova-profiles-donut-partial": `${partialEndPercent}%`,
  } as CSSProperties;

  const governanceItems = [
    {
      label: "Administradores ativos",
      value: activeAdmins,
      tone: activeAdmins ? "green" : "red",
      detail: activeAdmins ? "há responsável por acesso" : "sem admin ativo",
    },
    {
      label: "Editores ativos",
      value: activeEditors,
      tone: activeEditors ? "blue" : "orange",
      detail: activeEditors ? "anexos delegáveis" : "anexos ficam com admin",
    },
    {
      label: "Usuários inativos",
      value: inactiveUsers.length,
      tone: inactiveUsers.length ? "orange" : "green",
      detail: "mantidos para rastreio",
    },
    {
      label: "Papéis desconhecidos",
      value: unknownRoles.length,
      tone: unknownRoles.length ? "red" : "green",
      detail: "fora da matriz atual",
    },
  ] as const;

  return (
    <NovaLitShell activeHref="/perfis">
      <main className="nova-profiles-page">
        <header className="nova-profiles-hero">
          <div>
            <p>Configurações / Perfis</p>
            <h1>Perfis</h1>
            <span>Matriz real de permissões, usuários por papel e alertas de governança.</span>
          </div>
          <div className="nova-profiles-actions">
            <Link href="/usuarios" className="nova-profiles-button is-secondary">
              Usuários
            </Link>
            <Link href="/configuracoes" className="nova-profiles-button">
              Configurações
            </Link>
          </div>
        </header>

        <section className="nova-profiles-metrics" aria-label="Indicadores de perfis">
          <MetricCard
            label="Perfis"
            value={ROLE_DEFINITIONS.length}
            detail="papéis operacionais"
            tone="blue"
          />
          <MetricCard
            label="Usuários"
            value={users.meta.total}
            detail={`${activeUsers.length} ativo(s)`}
            tone="green"
          />
          <MetricCard
            label="Admins"
            value={activeAdmins}
            detail="governança total"
            tone={activeAdmins ? "green" : "red"}
          />
          <MetricCard
            label="Editores"
            value={activeEditors}
            detail="anexos e evidências"
            tone={activeEditors ? "blue" : "orange"}
          />
          <MetricCard
            label="Alertas"
            value={unknownRoles.length}
            detail="papéis desconhecidos"
            tone={unknownRoles.length ? "red" : "green"}
          />
        </section>

        <section className="nova-profiles-layout">
          <div className="nova-profiles-main">
            <section className="nova-profiles-panel">
              <div className="nova-profiles-section-head">
                <div>
                  <p>Papéis</p>
                  <h2>Como o acesso está distribuído</h2>
                  <span>
                    {users.meta.total} usuário(s) cadastrados, {activeUsers.length} ativo(s).
                  </span>
                </div>
                <Badge tone="blue">{ROLE_DEFINITIONS.length} perfis</Badge>
              </div>

              <div className="nova-profiles-role-grid">
                {roleStats.map((role) => (
                  <article key={role.key} className={`nova-profiles-role-card ${toneClass(roleToneLocal(role.key))}`}>
                    <div className="nova-profiles-role-top">
                      <div>
                        <h3>{role.label}</h3>
                        <p>{role.description}</p>
                      </div>
                      <Badge tone={roleToneLocal(role.key)}>{role.active} ativo(s)</Badge>
                    </div>

                    <div className="nova-profiles-role-numbers">
                      <span>
                        <b>{role.total}</b>
                        total
                      </span>
                      <span>
                        <b>{role.inactive}</b>
                        inativo(s)
                      </span>
                    </div>

                    <div className="nova-profiles-user-mini-list">
                      {role.users.slice(0, 4).map((user) => (
                        <Link
                          href={`/usuarios?q=${encodeURIComponent(user.email)}`}
                          key={user.id}
                          className="nova-profiles-user-mini"
                        >
                          <span>
                            <b>{user.name}</b>
                            <small>{user.email}</small>
                          </span>
                          <Badge tone={user.isActive ? "green" : "red"}>
                            {user.isActive ? "ativo" : "inativo"}
                          </Badge>
                        </Link>
                      ))}

                      {!role.users.length ? (
                        <div className="nova-profiles-empty-small">Nenhum usuário neste papel.</div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="nova-profiles-panel">
              <div className="nova-profiles-section-head">
                <div>
                  <p>Permissões</p>
                  <h2>Matriz aplicada hoje</h2>
                  <span>Resumo dos papéis aceitos pelo backend e usados nas telas administrativas.</span>
                </div>
                <Badge tone="green">{grantedPermissions} concedida(s)</Badge>
              </div>

              <div className="nova-profiles-table-wrap">
                <table className="nova-profiles-table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      {ROLE_DEFINITIONS.map((role) => (
                        <th key={`head-${role.key}`}>{role.short}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_PERMISSION_ROWS.map((row) => (
                      <tr key={row.module}>
                        <td>
                          <strong>{row.module}</strong>
                        </td>
                        {ROLE_DEFINITIONS.map((role) => {
                          const value = row.permissions[role.key];

                          return (
                            <td key={`${row.module}-${role.key}`}>
                              <Badge tone={permissionTone(value)}>{value}</Badge>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="nova-profiles-panel">
              <div className="nova-profiles-section-head">
                <div>
                  <p>Amostra</p>
                  <h2>Usuários na matriz</h2>
                  <span>Leitura rápida para conferir distribuição, papel e status antes da troca.</span>
                </div>
                <Badge tone="blue">{Math.min(users.items.length, 12)} linhas</Badge>
              </div>

              <div className="nova-profiles-table-wrap">
                <table className="nova-profiles-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Papel</th>
                      <th>Status</th>
                      <th>Cadastro</th>
                      <th>Acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.items.slice(0, 12).map((user) => (
                      <tr key={`user-row-${user.id}`}>
                        <td>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </td>
                        <td>
                          <Badge tone={roleToneLocal(user.role)}>{roleLabel(user.role)}</Badge>
                        </td>
                        <td>
                          <Badge tone={user.isActive ? "green" : "red"}>
                            {user.isActive ? "ativo" : "inativo"}
                          </Badge>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>
                          <Link
                            href={`/usuarios?q=${encodeURIComponent(user.email)}`}
                            className="nova-profiles-row-action"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!users.items.length ? (
                  <div className="nova-profiles-empty">
                    <b>Nenhum usuário carregado</b>
                    <span>A matriz depende da listagem administrativa de usuários.</span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="nova-profiles-side">
            <section className="nova-profiles-panel">
              <div className="nova-profiles-side-title">
                <p>Governança</p>
                <h2>Matriz atual</h2>
              </div>

              <div className="nova-profiles-donut-card">
                <div className="nova-profiles-donut" style={permissionDonutStyle}>
                  <span>{grantedPercent}%</span>
                  <small>permissões</small>
                </div>
                <div className="nova-profiles-donut-copy">
                  <b>Permissões do perfil</b>
                  <span>
                    {grantedPermissions} concedida(s), {partialPermissions} parcial(is) e{" "}
                    {deniedPermissions} bloqueada(s).
                  </span>
                </div>
              </div>

              <ProgressLine
                label="Concedidas"
                value={grantedPermissions}
                total={permissionValues.length}
                tone="green"
              />
              <ProgressLine
                label="Parciais"
                value={partialPermissions}
                total={permissionValues.length}
                tone="blue"
              />
              <ProgressLine
                label="Negadas"
                value={deniedPermissions}
                total={permissionValues.length}
                tone="red"
              />
            </section>

            <section className="nova-profiles-panel">
              <div className="nova-profiles-side-title">
                <p>Recorte atual</p>
                <h2>Pontos de controle</h2>
              </div>

              <div className="nova-profiles-side-list">
                {governanceItems.map((item) => (
                  <div key={item.label} className="nova-profiles-side-item">
                    <span>
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                    </span>
                    <Badge tone={item.tone}>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </section>

            <section className="nova-profiles-panel">
              <div className="nova-profiles-side-title">
                <p>Distribuição</p>
                <h2>Usuários ativos</h2>
              </div>

              <ProgressLine label="Administradores" value={activeAdmins} total={Math.max(activeUsers.length, 1)} tone="green" />
              <ProgressLine label="Editores" value={activeEditors} total={Math.max(activeUsers.length, 1)} tone="blue" />
              <ProgressLine label="Operadores" value={activeOperators} total={Math.max(activeUsers.length, 1)} tone="orange" />
              <ProgressLine label="Leitores" value={activeViewers} total={Math.max(activeUsers.length, 1)} tone="slate" />
            </section>

            <section className="nova-profiles-panel">
              <div className="nova-profiles-side-title">
                <p>Regra rápida</p>
                <h2>Controle de acesso</h2>
              </div>

              <div className="nova-profiles-rule-list">
                <div>
                  <b>Admin</b>
                  <span>gerencia usuários, perfis, integrações e configurações.</span>
                </div>
                <div>
                  <b>Editor</b>
                  <span>mantém evidências e anexos sem governar usuários.</span>
                </div>
                <div>
                  <b>Operador</b>
                  <span>atua na rotina operacional e consulta relatórios.</span>
                </div>
                <div>
                  <b>Leitor</b>
                  <span>consulta cadastros, documentos e histórico.</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
