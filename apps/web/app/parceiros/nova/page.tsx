import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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

  return `/parceiros/nova?${params.toString()}`;
}

export default async function NovoParceiroPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/parceiros/nova");
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
    <AppShell
      title="Novo parceiro"
      subtitle="Cadastro guiado para identificar o parceiro, registrar contato e revisar a operação."
    ><div className="mx-auto max-w-6xl rounded-[22px] border border-white/[0.08] bg-[#0c1016] shadow-[0_30px_80px_rgba(0,0,0,0.32)]"><div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6"><SectionIntro
            eyebrow="Cadastro guiado"
            title="Novo parceiro"
            description="Fluxo direto para criar a estrutura parceira e preparar contato/cobertura para a próxima etapa de dados."
            compact
          /><Link
            href="/parceiros"
            aria-label="Fechar cadastro"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] text-lg leading-none text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            ×
          </Link></div><div className="border-b border-white/[0.08] bg-[#0f141b] px-5 py-4 sm:px-6"><div className="grid gap-3 lg:grid-cols-3"><WizardStep
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
              description="Revisão e criação."
              state={step === 3 ? "current" : identityReady ? "available" : "locked"}
              href={identityReady ? buildWizardHref(3, wizardValues) : undefined}
            /></div></div><div className="px-5 py-5 sm:px-6">
          {step === 1 ? (
            <WizardPanel
              title="Identificação"
              description="Identificação e contato do parceiro."
            ><form method="GET" className="grid gap-5"><input type="hidden" name="step" value="2" /><input type="hidden" name="cityBase" value={cityBase} /><input type="hidden" name="contactName" value={contactName} /><input type="hidden" name="contactPhone" value={contactPhone} /><input type="hidden" name="coverage" value={coverage} /><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><FieldLabel htmlFor="partner-code" label="Código" hint="Mínimo de 2 caracteres" /><input
                      id="partner-code"
                      name="code"
                      defaultValue={code}
                      placeholder="ARANET"
                      minLength={2}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm uppercase text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div><div className="grid gap-2"><FieldLabel htmlFor="partner-name" label="Nome do parceiro" hint="Nome operacional claro" /><input
                      id="partner-name"
                      name="name"
                      defaultValue={name}
                      placeholder="Aranet Telecom"
                      minLength={2}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div></div><div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5"><Link
                    href="/parceiros"
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link><button className="rounded-[16px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]">
                    Próximo
                  </button></div></form></WizardPanel>
          ) : null}

          {step === 2 ? (
            <WizardPanel
              title="Contato"
              description="Centralize contato, acionamento e cobertura antes de revisar."
            ><form method="GET" className="grid gap-5"><input type="hidden" name="step" value="3" /><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><FieldLabel htmlFor="partner-city" label="Cidade base" hint="Preparado para cobertura operacional" /><input
                      id="partner-city"
                      name="cityBase"
                      defaultValue={cityBase}
                      placeholder="Araguaína"
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div><div className="grid gap-2"><FieldLabel htmlFor="partner-contact-name" label="Contato principal" hint="Referência de acionamento" /><input
                      id="partner-contact-name"
                      name="contactName"
                      defaultValue={contactName}
                      placeholder="Central de atendimento"
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div><div className="grid gap-2"><FieldLabel htmlFor="partner-phone" label="Telefone / WhatsApp" hint="Canal de acionamento" /><input
                      id="partner-phone"
                      name="contactPhone"
                      defaultValue={contactPhone}
                      placeholder="(63) 99999-0000"
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div><div className="grid gap-2"><FieldLabel htmlFor="partner-coverage" label="Cobertura" hint="Notas para futura persistência" /><input
                      id="partner-coverage"
                      name="coverage"
                      defaultValue={coverage}
                      placeholder="24h, cidades atendidas, central"
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    /></div></div><div className="rounded-[16px] border border-sky-500/18 bg-sky-500/[0.06] p-4 text-sm leading-6 text-slate-300">
                  Use esta etapa para conferir contato e cobertura antes de criar o parceiro. A ficha fica preparada para receber a cobertura completa na próxima camada.
                </div><div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5"><Link
                    href={buildWizardHref(1, wizardValues)}
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link><button className="rounded-[16px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]">
                    Próximo
                  </button></div></form></WizardPanel>
          ) : null}

          {step === 3 ? (
            <WizardPanel
              title="Operação"
              description="Revise a entidade que será criada e mantenha contato e cobertura como guia operacional."
            ><ActionForm
                action={createFromWizard}
                className="grid gap-5"
                submitLabel="Criar parceiro"
                pendingLabel="Criando parceiro..."
                hideSubmit
              ><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><SummaryItem label="Código" value={code} /><SummaryItem label="Nome" value={name} /><SummaryItem label="Cidade base" value={cityBase || "preparado"} /><SummaryItem label="Contato" value={contactName || "preparado"} /><SummaryItem label="Telefone" value={contactPhone || "preparado"} /><SummaryItem label="Cobertura" value={coverage || "preparado"} /></div><div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 text-sm leading-6 text-slate-400">
                  O parceiro será criado com a identificação principal. Contato, cidade base e cobertura permanecem visíveis como contexto operacional para a próxima etapa.
                </div><div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5"><Link
                    href={buildWizardHref(2, wizardValues)}
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link><FormSubmitButton
                    idleLabel="Criar parceiro"
                    pendingLabel="Criando parceiro..."
                    className="min-w-[148px]"
                  /></div></ActionForm></WizardPanel>
          ) : null}
        </div><div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-5 py-4 sm:px-6"><TonePill tone="info">cadastro guiado</TonePill><Link
            href="/parceiros"
            className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            Cancelar
          </Link></div></div></AppShell>
  );
}
