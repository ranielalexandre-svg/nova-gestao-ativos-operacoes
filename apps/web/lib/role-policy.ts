import { normalizeRole } from "@/lib/web-session";

export const ROLE_DEFINITIONS = [
  {
    key: "admin",
    label: "Administrador",
    short: "Admin",
    tone: "success",
    description: "Administra usuários, integrações, cadastros, operação e relatórios.",
  },
  {
    key: "editor",
    label: "Editor",
    short: "Editor",
    tone: "violet",
    description: "Consulta a operação e mantém anexos/evidências nos registros.",
  },
  {
    key: "operator",
    label: "Operador",
    short: "Operador",
    tone: "info",
    description: "Acompanha monitoramento, fila operacional e relatórios de leitura.",
  },
  {
    key: "viewer",
    label: "Leitor",
    short: "Leitor",
    tone: "neutral",
    description: "Consulta cadastros, documentos, dashboards e histórico sem edição.",
  },
] as const;

export type RoleKey = (typeof ROLE_DEFINITIONS)[number]["key"];

export const ROLE_KEYS = ROLE_DEFINITIONS.map((role) => role.key);
export const ROLE_OPTIONS = ROLE_DEFINITIONS.map(({ key, label }) => ({ value: key, label }));

export const ROLE_PERMISSION_ROWS = [
  {
    module: "Usuários e perfis",
    permissions: {
      admin: "Administra",
      editor: "Sem acesso",
      operator: "Sem acesso",
      viewer: "Sem acesso",
    },
  },
  {
    module: "Integrações",
    permissions: {
      admin: "Administra",
      editor: "Consulta",
      operator: "Consulta",
      viewer: "Consulta",
    },
  },
  {
    module: "Sistema e segredos",
    permissions: {
      admin: "Administra",
      editor: "Sem acesso",
      operator: "Sem acesso",
      viewer: "Sem acesso",
    },
  },
  {
    module: "Cadastros principais",
    permissions: {
      admin: "Edita",
      editor: "Consulta",
      operator: "Consulta",
      viewer: "Consulta",
    },
  },
  {
    module: "Anexos e evidências",
    permissions: {
      admin: "Edita",
      editor: "Edita",
      operator: "Consulta",
      viewer: "Consulta",
    },
  },
  {
    module: "Operação e fila",
    permissions: {
      admin: "Administra",
      editor: "Comenta",
      operator: "Comenta",
      viewer: "Consulta",
    },
  },
  {
    module: "Relatórios",
    permissions: {
      admin: "Exporta",
      editor: "Consulta",
      operator: "Consulta",
      viewer: "Consulta",
    },
  },
] as const;

export function roleDefinition(role: string) {
  const normalized = normalizeRole(role);
  return ROLE_DEFINITIONS.find((item) => item.key === normalized) || null;
}

export function roleLabel(role: string) {
  return roleDefinition(role)?.label || role || "Sem papel";
}

export function roleShortLabel(role: string) {
  return roleDefinition(role)?.short || role || "Sem papel";
}

export function roleTone(role: string) {
  return roleDefinition(role)?.tone || "attention";
}

export function isAdminRole(role: string) {
  return normalizeRole(role) === "admin";
}

export function canEditAttachmentsForRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "editor";
}
