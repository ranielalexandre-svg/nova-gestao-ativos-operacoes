import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  EmptyState,
  RightPanel,
  SectionIntro,
  StatCard,
  Surface,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { formatDate } from "@/lib/formatters";
import type { PaginatedResponse } from "@/lib/list-query";
import {
  isAdminRole,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_ROWS,
  roleLabel,
  roleTone,
} from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

function permissionTone(value: string) {
  if (["Administra", "Edita", "Exporta", "Opera"].includes(value)) return "success";
  if (value === "Comenta") return "info";
  if (value === "Consulta") return "info";
  return "subtle";
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
        pageSize: 500,
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
  const permissionValues = ROLE_PERMISSION_ROWS.flatMap((row) =>
    ROLE_DEFINITIONS.map((role) => row.permissions[role.key]),
  );
  const grantedPermissions = permissionValues.filter((value) =>
    ["Administra", "Edita", "Exporta", "Opera"].includes(value),
  ).length;
  const partialPermissions = permissionValues.filter((value) =>
    ["Consulta", "Comenta"].includes(value),
  ).length;
  const deniedPermissions = Math.max(0, permissionValues.length - grantedPermissions - partialPermissions);
  const grantedPercent = permissionValues.length ? Math.round((grantedPermissions / permissionValues.length) * 100) : 0;
  const partialEndPercent = permissionValues.length ? Math.round(((grantedPermissions + partialPermissions) / permissionValues.length) * 100) : 0;
  const permissionDonutStyle = {
    "--nova-donut-granted": `${grantedPercent}%`,
    "--nova-donut-partial": `${partialEndPercent}%`,
  } as CSSProperties;
  const governanceItems = [
    {
      label: "Administradores ativos",
      value: activeAdmins,
      tone: activeAdmins ? "success" : "critical",
      detail: activeAdmins ? "há responsável por acesso" : "sem admin ativo",
    },
    {
      label: "Editores ativos",
      value: activeEditors,
      tone: activeEditors ? "violet" : "attention",
      detail: activeEditors ? "anexos delegáveis" : "anexos ficam com admin",
    },
    {
      label: "Usuários inativos",
      value: inactiveUsers.length,
      tone: inactiveUsers.length ? "attention" : "success",
      detail: "mantidos para rastreio",
    },
    {
      label: "Papéis desconhecidos",
      value: unknownRoles.length,
      tone: unknownRoles.length ? "critical" : "success",
      detail: "fora da matriz atual",
    },
  ];

  return (
    <AppShell title="Perfis" subtitle="Matriz real de permissões, usuários por papel e alertas de governança.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {roleStats.map((role) => (
              <StatCard
                key={role.key}
                label={role.label}
                value={role.active}
                detail={`${role.total} total · ${role.inactive} inativo(s)`}
                tone={role.tone}
              />
            ))}
          </div>

          <Surface>
            <SectionIntro
              eyebrow="Papéis"
              title="Como o acesso está distribuído"
              description={`${users.meta.total} usuário(s) cadastrados, ${activeUsers.length} ativo(s).`}
              actions={<Link href="/usuarios" className="nds-button" data-variant="secondary">Gerenciar usuários</Link>}
              compact
            />
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {roleStats.map((role) => (
                <div key={`role-card-${role.key}`} className="nds-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-white">{role.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-400">{role.description}</div>
                    </div>
                    <TonePill tone={role.tone}>{role.active} ativo(s)</TonePill>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {role.users.slice(0, 4).map((user) => (
                      <div key={user.id} className="nova-micro-card flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-100">{user.name}</div>
                          <div className="truncate text-[10px] text-slate-500">{user.email}</div>
                        </div>
                        <TonePill tone={user.isActive ? "success" : "critical"}>
                          {user.isActive ? "ativo" : "inativo"}
                        </TonePill>
                      </div>
                    ))}
                    {!role.users.length ? (
                      <div className="rounded-[6px] border border-dashed border-white/12 bg-black/10 px-3 py-2 text-[11px] text-slate-500">
                        Nenhum usuário neste papel.
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface>
            <SectionIntro
              eyebrow="Permissões"
              title="Matriz aplicada hoje"
              description="Resumo dos papéis aceitos pelo backend e usados nas telas administrativas."
              compact
            />
            <div className="mt-2">
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-3 py-2">Módulo</th>
                      {ROLE_DEFINITIONS.map((role) => (
                        <th key={`head-${role.key}`} className="px-3 py-2">{role.short}</th>
                      ))}
                    </tr>
                  </TableHead>
                  <tbody>
                    {ROLE_PERMISSION_ROWS.map((row) => (
                      <tr key={row.module} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell>
                          <div className="font-bold text-white">{row.module}</div>
                        </TableCell>
                        {ROLE_DEFINITIONS.map((role) => {
                          const value = row.permissions[role.key];
                          return (
                          <TableCell key={`${row.module}-${role.key}`}>
                            <TonePill tone={permissionTone(value)}>{value}</TonePill>
                          </TableCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>

          <Surface>
            <SectionIntro
              eyebrow="Amostra"
              title="Usuários na matriz"
              description="Leitura rápida para conferir se a distribuição bate com o esperado antes da troca."
              compact
            />
            <div className="mt-2">
              {users.items.length ? (
                <TableShell>
                  <DenseTable>
                    <TableHead>
                      <tr>
                        <th className="px-3 py-2">Usuário</th>
                        <th className="px-3 py-2">Papel</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Cadastro</th>
                        <th className="px-3 py-2">Acesso</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {users.items.slice(0, 12).map((user) => (
                        <tr key={`user-row-${user.id}`} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                          <TableCell>
                            <div className="font-medium text-white">{user.name}</div>
                            <div className="mt-1 text-[10px] text-slate-500">{user.email}</div>
                          </TableCell>
                          <TableCell><TonePill tone={roleTone(user.role)}>{roleLabel(user.role)}</TonePill></TableCell>
                          <TableCell><TonePill tone={user.isActive ? "success" : "critical"}>{user.isActive ? "ativo" : "inativo"}</TonePill></TableCell>
                          <TableCell className="text-slate-400">{formatDate(user.createdAt)}</TableCell>
                          <TableCell><TableActionLink href={`/usuarios?q=${encodeURIComponent(user.email)}`}>Abrir</TableActionLink></TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </DenseTable>
                </TableShell>
              ) : (
                <EmptyState
                  title="Nenhum usuário carregado"
                  description="A matriz depende da listagem administrativa de usuários."
                />
              )}
            </div>
          </Surface>
        </div>

        <RightPanel title="Governança" description="Sinais que devem estar claros antes da troca.">
          <div className="nds-card nova-permission-panel">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="nds-label">Permissões do perfil</div>
                <div className="mt-1 text-[12px] font-black text-white">Matriz atual</div>
              </div>
              <div className="nova-permission-donut" style={permissionDonutStyle}>
                <span>{grantedPercent}%</span>
              </div>
            </div>
            <div className="mt-2 grid gap-2">
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--nova-text-muted)]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--nova-success)]" />Concedidas</span>
                <TonePill tone="success">{grantedPermissions}</TonePill>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--nova-text-muted)]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--nova-info)]" />Parciais</span>
                <TonePill tone="info">{partialPermissions}</TonePill>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--nova-text-muted)]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--nova-danger)]" />Negadas</span>
                <TonePill tone="critical">{deniedPermissions}</TonePill>
              </div>
            </div>
          </div>
          {governanceItems.map((item) => (
            <div key={item.label} className="nds-card">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-bold text-slate-100">{item.label}</div>
                <TonePill tone={item.tone}>{item.value}</TonePill>
              </div>
              <div className="mt-2 text-[10px] leading-5 text-slate-500">{item.detail}</div>
            </div>
          ))}
          <div className="rounded-[6px] border border-[var(--nova-primary)]/25 bg-[var(--nova-primary-soft)] p-2 text-[11px] leading-5 text-slate-100">
            O papel editor agora pode ser criado e filtrado em Usuários, alinhando a tela com a permissão de envio e remoção de anexos.
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
