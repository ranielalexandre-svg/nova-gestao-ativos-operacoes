import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
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

function Dot({ tone }: { tone: Tone }) {
  return <span className={`nova-import-dot is-${tone}`} />;
}

function Badge({ tone, children }: { tone: Tone; children: string | number }) {
  return <span className={`nova-import-badge is-${tone}`}>{children}</span>;
}

function MetricCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string | number;
  meta: string;
  tone: Tone;
}) {
  return (
    <div className="nova-import-kpi">
      <div className="nova-import-kpi-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{meta}</p>
    </div>
  );
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
  const selectedResource = RESOURCES.find((resource) => resource.key === selected) || RESOURCES[1];
  const templateHeaders = selectedTemplate
    .split(/\r?\n/)[0]
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) || [];

  return (
    <NovaLitShell activeHref="/importacao">
      <div className="nova-importacao-lit-page">
        <header className="nova-import-hero">
          <div>
            <div className="nova-import-breadcrumb">Configurações / Importação</div>
            <h1>Importação</h1>
            <p>
              Valide CSV, execute cargas controladas e exporte bases atuais antes do saneamento operacional.
            </p>
          </div>
          <div className="nova-import-actions">
            <Link href="/operacao/fila">Fila operacional</Link>
            <Link href="/reconciliacao" className="is-primary">Reconciliação</Link>
          </div>
        </header>

        <section className="nova-import-kpi-grid">
          <MetricCard
            label="Recursos"
            value={RESOURCES.length}
            meta="parceiros, unidades, ativos e Starlinks"
            tone="blue"
          />
          <MetricCard
            label="Selecionado"
            value={selectedResource.label}
            meta={selectedResource.short}
            tone={selectedResource.tone}
          />
          <MetricCard
            label="Template"
            value={templateHeaders.length}
            meta="coluna(s) esperada(s)"
            tone={templateHeaders.length ? "green" : "orange"}
          />
          <MetricCard
            label="Segurança"
            value="Preview"
            meta="validação antes do upsert"
            tone="green"
          />
          <MetricCard
            label="Destino"
            value="CSV"
            meta="importação e exportação"
            tone="orange"
          />
        </section>

        <section className="nova-import-card">
          <div className="nova-import-section-head">
            <div>
              <span>Cutover Desk</span>
              <h2>Central de importação e exportação</h2>
              <p>
                A validação não altera dados. A importação executa upsert por código, tag ou serial conforme o recurso.
              </p>
            </div>
            <Badge tone={selectedResource.tone}>{selectedResource.label}</Badge>
          </div>

          <div className="nova-import-resource-grid">
            {RESOURCES.map((resource) => (
              <Link
                key={resource.key}
                href={`/importacao?resource=${resource.key}`}
                className={`nova-import-resource-card${resource.key === selected ? " is-active" : ""}`}
              >
                <div>
                  <Dot tone={resource.tone} />
                  <strong>{resource.label}</strong>
                </div>
                <p>{resource.description}</p>
                <small>{resource.key === selected ? "recurso ativo" : "abrir template"}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="nova-import-layout">
          <div className="nova-import-left">
            <div className="nova-import-card">
              <div className="nova-import-section-head">
                <div>
                  <span>Fluxo assistido</span>
                  <h2>Carga segura em três etapas</h2>
                  <p>Copie o template, valide o CSV e só depois execute a importação.</p>
                </div>
              </div>

              <div className="nova-import-stepper">
                {[
                  { title: "Template", detail: `${templateHeaders.length} coluna(s)` },
                  { title: "Validação", detail: "preview sem gravar" },
                  { title: "Importação", detail: "upsert controlado" },
                ].map((step, index) => (
                  <div key={step.title} className="nova-import-step" data-active={index === 0 ? "true" : "false"}>
                    <b>{index + 1}</b>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="nova-import-dropzone">
                <strong>Entrada funcional por texto CSV</strong>
                <span>
                  O upload direto ainda não existe nesta tela. Cole o conteúdo abaixo usando o template correto.
                </span>
              </div>
            </div>

            <div className="nova-import-card">
              <div className="nova-import-section-head">
                <div>
                  <span>CSV</span>
                  <h2>Validar ou importar</h2>
                  <p>Use validar para conferir estrutura; importar grava no banco somente para administradores.</p>
                </div>
                <Badge tone="green">admin</Badge>
              </div>

              <ActionForm
                action={importCsvAction}
                submitLabel="Processar"
                pendingLabel="Processando..."
                hideSubmit
                className="nova-import-form"
              >
                <div className="nova-import-form-grid">
                  <label>
                    <span>Recurso</span>
                    <select name="resource" defaultValue={selected}>
                      {RESOURCES.map((resource) => (
                        <option key={resource.key} value={resource.key}>
                          {resource.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="is-wide">
                    <span>CSV</span>
                    <textarea
                      name="csv"
                      defaultValue={selectedTemplate}
                      rows={14}
                      spellCheck={false}
                    />
                  </label>
                </div>

                <div className="nova-import-form-actions">
                  <button type="submit" name="actionType" value="preview">
                    Validar CSV
                  </button>
                  <button type="submit" name="actionType" value="execute" className="is-primary">
                    Importar agora
                  </button>
                </div>
              </ActionForm>
            </div>
          </div>

          <aside className="nova-import-right">
            <div className="nova-import-card">
              <div className="nova-import-section-head">
                <div>
                  <span>Validação</span>
                  <h2>Resumo esperado</h2>
                </div>
              </div>
              <div className="nova-import-mini-list">
                <div><span>Recurso</span><b>{selectedResource.label}</b></div>
                <div><span>Colunas</span><b>{templateHeaders.length}</b></div>
                <div><span>Modo seguro</span><b>preview primeiro</b></div>
                <div><span>Gravação</span><b>upsert</b></div>
              </div>
            </div>

            <div className="nova-import-card">
              <div className="nova-import-section-head">
                <div>
                  <span>Templates</span>
                  <h2>Modelos aceitos</h2>
                  <p>Copie o cabeçalho e preencha as linhas abaixo dele.</p>
                </div>
              </div>
              <div className="nova-import-template-list">
                {templates.map((template) => (
                  <details key={template.resource} open={template.resource === selected}>
                    <summary>{resourceLabel(template.resource)}</summary>
                    <pre>{template.csv || "Template indisponível"}</pre>
                  </details>
                ))}
              </div>
            </div>

            <div className="nova-import-card">
              <div className="nova-import-section-head">
                <div>
                  <span>Exportação</span>
                  <h2>Bases atuais</h2>
                  <p>Baixe CSV para comparar antes e depois da carga.</p>
                </div>
              </div>
              <div className="nova-import-export-list">
                {RESOURCES.map((resource) => (
                  <Link key={resource.key} href={`/export/${resource.key}`}>
                    <span>{resource.label}</span>
                    <Badge tone="slate">CSV</Badge>
                  </Link>
                ))}
              </div>
            </div>

            <div className="nova-import-warning">
              <strong>Regra operacional</strong>
              <span>
                Valide primeiro e importe em lotes pequenos. Parceiros devem existir antes das unidades; unidades devem existir antes dos ativos.
              </span>
            </div>
          </aside>
        </section>
      </div>
    </NovaLitShell>
  );
}
