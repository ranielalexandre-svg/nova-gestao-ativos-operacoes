import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  getActionErrorMessage,
  type ActionFeedbackState,
} from "@/lib/action-state";
import { apiJson } from "@/lib/server-api";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
import { ImportCsvWorkspace } from "./import-csv-workspace";

type Resource = "partners" | "units" | "equipments" | "starlinks";
type Tone = "green" | "orange" | "blue" | "red" | "slate";

type TemplateResponse = {
  resource: Resource;
  csv: string;
};

type PreviewResponse = {
  resource: Resource;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headers: string[];
  errors: Array<{ line: number; message: string }>;
};

type ExecuteResponse = {
  resource: Resource;
  totalRows: number;
  created: number;
  updated: number;
};

const RESOURCES: Array<{
  key: Resource;
  label: string;
  short: string;
  description: string;
  target: string;
  tone: Tone;
}> = [
  {
    key: "partners",
    label: "Parceiros",
    short: "parceiros",
    description: "Base de provedores, campo, suporte e contatos operacionais.",
    target: "/parceiros",
    tone: "blue",
  },
  {
    key: "units",
    label: "Unidades",
    short: "unidades",
    description: "Locais atendidos, cidade, UF e parceiro principal.",
    target: "/unidades",
    tone: "green",
  },
  {
    key: "equipments",
    label: "Ativos",
    short: "ativos",
    description: "Inventário técnico vinculado às unidades monitoradas.",
    target: "/ativos",
    tone: "orange",
  },
  {
    key: "starlinks",
    label: "Starlinks",
    short: "starlinks",
    description: "Kits satelitais tratados como recorte dedicado do inventário.",
    target: "/ativos/starlinks",
    tone: "slate",
  },
];

function isResource(value: string): value is Resource {
  return RESOURCES.some((resource) => resource.key === value);
}

function resourceLabel(value: string) {
  return RESOURCES.find((resource) => resource.key === value)?.label || value;
}

function resourceTarget(value: Resource) {
  return RESOURCES.find((resource) => resource.key === value)?.target || "/dashboard";
}

async function importCsvAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const session = await getServerWebSession();
  if (normalizeRole(session.user?.role || "") !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const resource = String(formData.get("resource") || "").trim() as Resource;
  const csv = String(formData.get("csv") || "");
  const actionType = String(formData.get("actionType") || "preview");

  if (!isResource(resource)) {
    return { status: "error", message: "Recurso inválido para importação." };
  }

  if (!csv.trim()) {
    return { status: "error", message: "Cole um CSV antes de validar ou importar." };
  }

  const dataLineCount = csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim()).length;

  if (!dataLineCount) {
    return { status: "error", message: "Informe ao menos uma linha de dados abaixo do cabeçalho." };
  }

  try {
    if (actionType === "execute") {
      const result = await apiJson<ExecuteResponse>(`/import/execute/${resource}`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });

      revalidatePath("/importacao");
      revalidatePath("/operacao/importacao");
      revalidatePath(resourceTarget(resource));

      return {
        status: "success",
        message: `${resourceLabel(result.resource)} importado: ${result.created} criado(s), ${result.updated} atualizado(s), ${result.totalRows} linha(s) lidas.`,
      };
    }

    const result = await apiJson<PreviewResponse>(`/import/preview/${resource}`, {
      method: "POST",
      body: JSON.stringify({ csv }),
    });

    const suffix = result.errors.length
      ? ` Primeiros erros: ${result.errors
          .slice(0, 3)
          .map((item) => `linha ${item.line}: ${item.message}`)
          .join(" | ")}`
      : " Nenhum erro estrutural encontrado.";

    return {
      status: result.invalidRows ? "error" : "success",
      message: `${resourceLabel(result.resource)} validado: ${result.validRows}/${result.totalRows} linha(s) válidas.${suffix}`,
    };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export default async function ImportacaoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/operacao/importacao");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/dashboard");
  }

  const params = await resolveSearchParams(searchParams);
  const selectedParam = readStringParam(params, "resource", "units");
  const selected: Resource = isResource(selectedParam) ? selectedParam : "units";

  const templates = await Promise.all(
    RESOURCES.map(async (resource) => {
      try {
        return await apiJson<TemplateResponse>(`/import/templates/${resource.key}`);
      } catch {
        return { resource: resource.key, csv: "" } satisfies TemplateResponse;
      }
    }),
  );

  return (
    <NovaLitShell activeHref="/administracao/importacao">
      <ImportCsvWorkspace
        action={importCsvAction}
        resources={RESOURCES}
        selected={selected}
        templates={templates}
      />
    </NovaLitShell>
  );
}
