import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  SectionIntro,
  Surface,
  TonePill,
} from "@/components/ops-ui";
import { RegistryHero, RegistrySummaryStrip } from "@/components/registry-shell";
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

type Resource = "partners" | "units" | "equipments" | "starlinks";

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
  description: string;
  target: string;
}> = [
  {
    key: "partners",
    label: "Parceiros",
    description: "Base de provedores, campo e suporte.",
    target: "/parceiros",
  },
  {
    key: "units",
    label: "Unidades",
    description: "Locais atendidos, cidade, UF e parceiro principal.",
    target: "/unidades",
  },
  {
    key: "equipments",
    label: "Equipamentos",
    description: "Ativos técnicos vinculados a unidades.",
    target: "/equipamentos",
  },
  {
    key: "starlinks",
    label: "Starlinks",
    description: "Kits satelitais tratados como recorte dedicado.",
    target: "/equipamentos/starlinks",
  },
];

function isResource(value: string): value is Resource {
  return RESOURCES.some((resource) => resource.key === value);
}

function resourceLabel(value: string) {
  return RESOURCES.find((resource) => resource.key === value)?.label || value;
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

  try {
    if (actionType === "execute") {
      const result = await apiJson<ExecuteResponse>(`/import/execute/${resource}`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });

      revalidatePath("/operacao/importacao");
      revalidatePath(RESOURCES.find((item) => item.key === resource)?.target || "/dashboard");

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
      ? ` Primeiros erros: ${result.errors.slice(0, 3).map((item) => `linha ${item.line}: ${item.message}`).join(" | ")}`
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

  const selectedTemplate = templates.find((template) => template.resource === selected)?.csv || "";

  return (
    <AppShell
      title="Importação"
      subtitle="Ponte controlada para migrar dados do legado ou ajustar cargas CSV antes da troca."
    >
      <RegistryHero
        eyebrow="Cutover Desk"
        title="Importação e exportação com validação"
        description="Use esta central para testar CSV, importar somente quando estiver consistente e exportar bases atuais para conferência."
      />

      <RegistrySummaryStrip
        items={RESOURCES.map((resource) => ({
          label: resource.label,
          value: resource.key === selected ? "ativo" : "CSV",
          meta: resource.description,
          tone: resource.key === selected ? "info" : "neutral",
        }))}
        noteTitle="Regra de segurança"
        noteCopy="A validação não altera dados. A importação executa upsert por código/tag e deve ser usada após backup ou conferência do CSV."
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="CSV"
            title="Validar ou importar"
            description="Cole o conteúdo CSV usando o template do recurso. O botão validar mostra a saúde estrutural; importar grava no banco."
            compact
          />

          <ActionForm
            action={importCsvAction}
            submitLabel="Processar"
            pendingLabel="Processando..."
            hideSubmit
            className="mt-5"
          >
            <div className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-[240px_minmax(0,1fr)] md:items-end">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Recurso
                  <select
                    name="resource"
                    defaultValue={selected}
                    className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                  >
                    {RESOURCES.map((resource) => (
                      <option key={resource.key} value={resource.key}>
                        {resource.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-sm leading-6 text-slate-400">
                  Trocar o recurso aqui não troca o template automaticamente no campo. Use o painel lateral para copiar o template certo.
                </div>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                CSV
                <textarea
                  name="csv"
                  defaultValue={selectedTemplate}
                  rows={12}
                  className="min-h-[260px] rounded-[14px] border border-white/10 bg-[#080d13] px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="submit"
                  name="actionType"
                  value="preview"
                  className="rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                >
                  Validar CSV
                </button>
                <button
                  type="submit"
                  name="actionType"
                  value="execute"
                  className="rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
                >
                  Importar agora
                </button>
              </div>
            </div>
          </ActionForm>
        </Surface>

        <div className="grid gap-5">
          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Templates"
              title="Modelos aceitos"
              description="Copie o cabeçalho e preencha as linhas abaixo dele."
              compact
            />
            <div className="mt-4 grid gap-3">
              {templates.map((template) => (
                <details
                  key={template.resource}
                  open={template.resource === selected}
                  className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-slate-50">
                    {resourceLabel(template.resource)}
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-[12px] border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">
                    {template.csv || "Template indisponível"}
                  </pre>
                </details>
              ))}
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Exportação"
              title="Baixar bases atuais"
              description="Use estes arquivos para comparar antes e depois da importação."
              compact
            />
            <div className="mt-4 grid gap-2">
              {RESOURCES.map((resource) => (
                <Link
                  key={resource.key}
                  href={`/export/${resource.key}`}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3 text-sm text-slate-200 transition hover:border-white/14 hover:bg-[#10161d]"
                >
                  <span>{resource.label}</span>
                  <TonePill tone="neutral">CSV</TonePill>
                </Link>
              ))}
            </div>
          </Surface>

          <EmptyState
            title="Nada automático demais"
            description="Se o CSV vier do legado, valide primeiro e importe em lotes pequenos. A pressa é ótima para café, péssima para migração."
          />
        </div>
      </section>
    </AppShell>
  );
}
