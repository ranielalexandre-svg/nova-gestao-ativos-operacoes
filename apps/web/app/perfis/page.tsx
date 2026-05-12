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
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

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

const ACTIVE_ROLE = "operator";

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
    <NovaLitShell activeHref="/perfis" hidePageHeader>
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
    </NovaLitShell>
  );
}
