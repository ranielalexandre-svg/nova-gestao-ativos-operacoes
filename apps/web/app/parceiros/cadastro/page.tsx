import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  WizardFieldLabel as FieldLabel,
  WizardPanel,
  WizardStep,
  WizardSummaryItem as SummaryItem,
} from "@/components/guided-wizard";
import { SectionIntro, TonePill } from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import {
  getActionErrorMessage,
  type ActionFeedbackState,
} from "@/lib/action-state";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function buildWizardHref(
  step: number,
  values: {
    code?: string;
    name?: string;
    cityBase?: string;
    contactName?: string;
    contactPhone?: string;
    coverage?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("step", String(step));

  for (const [key, value] of Object.entries(values)) {
    const clean = value?.trim();
    if (clean) params.set(key, clean);
  }

  return `/parceiros/cadastro?${params.toString()}`;
}

export default async function CadastroParceiroPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/parceiros/cadastro");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/parceiros");
  }

  const params = await resolveSearchParams(searchParams);
  const requestedStep = Number(readStringParam(params, "step", "1")) || 1;
  const code = normalizeUpper(readStringParam(params, "code"));
  const name = readStringParam(params, "name").trim();
  const cityBase = readStringParam(params, "cityBase").trim();
  const contactName = readStringParam(params, "contactName").trim();
  const contactPhone = readStringParam(params, "contactPhone").trim();
  const coverage = readStringParam(params, "coverage").trim();
  const identityReady = code.length >= 2 && name.length >= 2;
  const wizardValues = { code, name, cityBase, contactName, contactPhone, coverage };

  let step = 1;
  if (requestedStep >= 3 && identityReady) {
    step = 3;
  } else if (requestedStep >= 2 && identityReady) {
    step = 2;
  }

  async function createFromWizard(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    let createdId = "";

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const created = await apiJson<{ id: string }>("/partners", {
        method: "POST",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          cityBase: String(formData.get("cityBase") || ""),
          contactName: String(formData.get("contactName") || ""),
          contactPhone: String(formData.get("contactPhone") || ""),
          coverage: String(formData.get("coverage") || ""),
        }),
      });

      createdId = created.id;
      revalidatePath("/parceiros");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect(`/parceiros/${createdId}?created=1&from=wizard`);
  }

  return (
    <NovaLitShell activeHref="/parceiros">
      <div className="nova-partner-create-lit-page"><div className="nds-surface w-full"><div className="flex items-start justify-between gap-2 border-b border-white/[0.08] px-3 py-2 sm:px-3"><SectionIntro
            eyebrow="Cadastro guiado"
            title="Cadastro de parceiro"
            description="Fluxo direto para criar a estrutura parceira e persistir contato/cobertura inicial."
            compact
          /><Link
            href="/parceiros"
            aria-label="Fechar cadastro"
            className="nds-icon-button shrink-0"
          >
            ×
          </Link></div><div className="border-b border-white/[0.08] bg-[var(--nova-surface-3)] px-3 py-2 sm:px-3"><div className="grid gap-2 lg:grid-cols-3"><WizardStep
              index={1}
              title="Identificação"
              description="Código e nome."
              state={step === 1 ? "current" : step > 1 ? "done" : "available"}
              href={buildWizardHref(1, wizardValues)}
            /><WizardStep
              index={2}
              title="Contato"
              description="Acionamento e cidade base."
              state={step === 2 ? "current" : step > 2 ? "done" : identityReady ? "available" : "locked"}
              href={identityReady ? buildWizardHref(2, wizardValues) : undefined}
            /><WizardStep
              index={3}
              title="Operação"
              description="Revisão e cadastro."
              state={step === 3 ? "current" : identityReady ? "available" : "locked"}
              href={identityReady ? buildWizardHref(3, wizardValues) : undefined}
            /></div></div><div className="px-3 py-2 sm:px-3">
          {step === 1 ? (
            <WizardPanel
              title="Identificação"
              description="Identificação e contato do parceiro."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="2" /><input type="hidden" name="cityBase" value={cityBase} /><input type="hidden" name="contactName" value={contactName} /><input type="hidden" name="contactPhone" value={contactPhone} /><input type="hidden" name="coverage" value={coverage} /><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="partner-code" label="Código" hint="Mínimo de 2 caracteres" /><input
                      id="partner-code"
                      name="code"
                      defaultValue={code}
                      placeholder="ARANET"
                      minLength={2}
                      required
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="partner-name" label="Nome do parceiro" hint="Nome operacional claro" /><input
                      id="partner-name"
                      name="name"
                      defaultValue={name}
                      placeholder="Aranet Telecom"
                      minLength={2}
                      required
                    /></div></div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href="/parceiros"
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Voltar
                  </Link><button className="nds-button" data-variant="primary">
                    Próximo
                  </button></div></form></WizardPanel>
          ) : null}

          {step === 2 ? (
            <WizardPanel
              title="Contato"
              description="Centralize contato, acionamento e cobertura antes de revisar."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="3" /><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="partner-city" label="Cidade base" hint="Preparado para cobertura operacional" /><input
                      id="partner-city"
                      name="cityBase"
                      defaultValue={cityBase}
                      placeholder="Araguaína"
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="partner-contact-name" label="Contato principal" hint="Referência de acionamento" /><input
                      id="partner-contact-name"
                      name="contactName"
                      defaultValue={contactName}
                      placeholder="Central de atendimento"
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="partner-phone" label="Telefone / WhatsApp" hint="Canal de acionamento" /><input
                      id="partner-phone"
                      name="contactPhone"
                      defaultValue={contactPhone}
                      placeholder="(63) 99999-0000"
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="partner-coverage" label="Cobertura" hint="Notas operacionais" /><input
                      id="partner-coverage"
                      name="coverage"
                      defaultValue={coverage}
                      placeholder="24h, cidades atendidas, central"
                    /></div></div><div className="rounded-[6px] border border-[var(--nova-primary)]/20 bg-[var(--nova-primary-soft)] p-2 text-[11px] leading-5 text-slate-300">
                  Use esta etapa para conferir contato e cobertura antes de criar o parceiro. Esses dados serão salvos como contato operacional inicial.
                </div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href={buildWizardHref(1, wizardValues)}
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Voltar
                  </Link><button className="nds-button" data-variant="primary">
                    Próximo
                  </button></div></form></WizardPanel>
          ) : null}

          {step === 3 ? (
            <WizardPanel
              title="Operação"
              description="Revise a entidade que será cadastrada e mantenha contato e cobertura como guia operacional."
            ><ActionForm
                action={createFromWizard}
                className="grid gap-2"
                submitLabel="Cadastrar parceiro"
                pendingLabel="Cadastrando parceiro..."
                hideSubmit
              ><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><input type="hidden" name="cityBase" value={cityBase} /><input type="hidden" name="contactName" value={contactName} /><input type="hidden" name="contactPhone" value={contactPhone} /><input type="hidden" name="coverage" value={coverage} /><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><SummaryItem label="Código" value={code} /><SummaryItem label="Nome" value={name} /><SummaryItem label="Cidade base" value={cityBase || "não informado"} /><SummaryItem label="Contato" value={contactName || "não informado"} /><SummaryItem label="Telefone" value={contactPhone || "não informado"} /><SummaryItem label="Cobertura" value={coverage || "não informado"} /></div><div className="nds-card text-[11px] leading-5 text-slate-400">
                  O parceiro será criado com identificação principal e, quando informado, o contato operacional ficará gravado no banco.
                </div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href={buildWizardHref(2, wizardValues)}
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Voltar
                  </Link><FormSubmitButton
                    idleLabel="Cadastrar parceiro"
                    pendingLabel="Cadastrando parceiro..."
                    className="min-w-[148px]"
                  /></div></ActionForm></WizardPanel>
          ) : null}
        </div><div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-3 py-2 sm:px-3"><TonePill tone="info">cadastro guiado</TonePill><Link
            href="/parceiros"
            className="nds-button"
            data-variant="secondary"
          >
            Cancelar
          </Link></div></div>      </div>
    </NovaLitShell>
  );
}
