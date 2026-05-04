import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  FieldLabel,
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
    label: "Ativos",
    description: "Ativos técnicos vinculados a unidades.",
    target: "/ativos",
  },
  {
    key: "starlinks",
    label: "Starlinks",
    description: "Kits satelitais tratados como recorte dedicado.",
    target: "/ativos/starlinks",
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

      revalidatePath("/importacao");
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
    redirect("/login?next=/importacao");
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
  const activeIndex = selectedTemplate ? 1 : 0;
  const templateHeaders = selectedTemplate.split(/\r?\n/)[0]?.split(",").filter(Boolean).length || 0;

  return (
    <AppShell
      title="Importação"
      subtitle="Ponte controlada para migrar dados do legado ou ajustar cargas CSV antes da troca."
    ><RegistryHero
        eyebrow="Cutover Desk"
        title="Importação e exportação com validação"
        description="Use esta central para testar CSV, importar somente quando estiver consistente e exportar bases atuais para conferência."
      /><RegistrySummaryStrip
        items={RESOURCES.map((resource) => ({
          label: resource.label,
          value: resource.key === selected ? "ativo" : "CSV",
          meta: resource.description,
          tone: resource.key === selected ? "info" : "neutral",
        }))}
        noteTitle="Regra de segurança"
        noteCopy="A validação não altera dados. A importação executa upsert por código/tag e deve ser usada após backup ou conferência do CSV."
      /><section className="nova-side-grid nova-side-grid--380"><div className="grid gap-2"><Surface>
            <SectionIntro
              eyebrow="Fluxo"
              title="Carga assistida"
              description="Stepper visual da importação: template, validação e execução controlada."
              compact
            />
            <div className="nova-import-stepper mt-2">
              {[
                { title: "Template", detail: `${templateHeaders} coluna(s)` },
                { title: "Validação", detail: "preview sem gravar" },
                { title: "Importação", detail: "upsert auditável" },
              ].map((step, index) => (
                <div key={step.title} className="nova-import-step" data-active={index === activeIndex ? "true" : "false"} data-complete={index < activeIndex ? "true" : "false"}>
                  <span>{index + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-black text-white">{step.title}</div>
                    <div className="mt-1 truncate text-[10px] text-[var(--nova-text-muted)]">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="nova-import-dropzone mt-2">
              <div className="text-[22px] font-black text-[var(--nova-primary)]">↑</div>
              <div className="mt-2 text-[12px] font-black text-white">Arraste o arquivo CSV aqui</div>
              <div className="mt-1 text-[10px] text-[var(--nova-text-muted)]">O campo abaixo continua sendo a entrada funcional enquanto o upload direto não existir.</div>
            </div>
          </Surface><Surface><SectionIntro
            eyebrow="CSV"
            title="Validar ou importar"
            description="Cole o conteúdo CSV usando o template do recurso. O botão validar mostra a saúde estrutural; importar grava no banco."
            compact
          /><ActionForm
            action={importCsvAction}
            submitLabel="Processar"
            pendingLabel="Processando..."
            hideSubmit
            className="mt-2"
          ><div className="grid gap-2"><div className="nova-resource-row"><label className="grid gap-2">
                  <FieldLabel>Recurso</FieldLabel>
                  <select
                    name="resource"
                    defaultValue={selected}
                  >
                    {RESOURCES.map((resource) => (
                      <option key={resource.key} value={resource.key}>
                        {resource.label}
                      </option>
                    ))}
                  </select></label><div className="text-[11px] leading-5 text-slate-400">
                  Trocar o recurso aqui não troca o template automaticamente no campo. Use o painel lateral para copiar o template certo.
                </div></div><label className="grid gap-2">
                <FieldLabel>CSV</FieldLabel>
                <textarea
                  name="csv"
                  defaultValue={selectedTemplate}
                  rows={12}
                  className="min-h-[160px] font-mono"
                /></label><div className="flex flex-wrap justify-end gap-2"><button
                  type="submit"
                  name="actionType"
                  value="preview"
                  className="nds-button"
                  data-variant="secondary"
                >
                  Validar CSV
                </button><button
                  type="submit"
                  name="actionType"
                  value="execute"
                  className="nds-button"
                  data-variant="primary"
                >
                  Importar agora
                </button></div></div></ActionForm></Surface></div><div className="grid gap-2"><Surface><SectionIntro
              eyebrow="Validação"
              title="Resumo esperado"
              description="Conferência rápida antes de rodar o preview."
              compact
            /><div className="mt-2 grid gap-2">
              <div className="nds-card flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--nova-text-muted)]">Recurso</span>
                <TonePill tone="info">{resourceLabel(selected)}</TonePill>
              </div>
              <div className="nds-card flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--nova-text-muted)]">Colunas do template</span>
                <TonePill tone={templateHeaders ? "success" : "attention"}>{templateHeaders}</TonePill>
              </div>
              <div className="nds-card flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--nova-text-muted)]">Modo seguro</span>
                <TonePill tone="success">preview primeiro</TonePill>
              </div>
            </div></Surface><Surface><SectionIntro
              eyebrow="Templates"
              title="Modelos aceitos"
              description="Copie o cabeçalho e preencha as linhas abaixo dele."
              compact
            /><div className="mt-2 grid gap-2">
              {templates.map((template) => (
                <details
                  key={template.resource}
                  open={template.resource === selected}
                  className="nds-card"
                ><summary className="cursor-pointer text-[12px] font-semibold text-slate-50">
                    {resourceLabel(template.resource)}
                  </summary><pre className="mt-2 overflow-x-auto rounded-[6px] border border-white/10 bg-black/20 p-2 text-[10px] leading-5 text-slate-300">
                    {template.csv || "Template indisponível"}
                  </pre></details>
              ))}
            </div></Surface><Surface><SectionIntro
              eyebrow="Exportação"
              title="Baixar bases atuais"
              description="Use estes arquivos para comparar antes e depois da importação."
              compact
            /><div className="mt-2 grid gap-2">
              {RESOURCES.map((resource) => (
                <Link
                  key={resource.key}
                  href={`/export/${resource.key}`}
                  className="nds-card flex items-center justify-between gap-2 text-[11px] text-slate-200 transition"
                ><span>{resource.label}</span><TonePill tone="neutral">CSV</TonePill></Link>
              ))}
            </div></Surface><EmptyState
            title="Nada automático demais"
            description="Se o CSV vier do legado, valide primeiro e importe em lotes pequenos. A pressa é ótima para café, péssima para migração."
          /></div></section></AppShell>
  );
}
