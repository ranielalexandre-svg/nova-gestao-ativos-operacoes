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
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PartnerOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count: { units: number };
  createdAt: string;
};

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function buildWizardHref(
  step: number,
  values: {
    code?: string;
    name?: string;
    city?: string;
    state?: string;
    partnerId?: string;
    partnerCode?: string;
    from?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("step", String(step));

  const entries = {
    code: values.code?.trim() || "",
    name: values.name?.trim() || "",
    city: values.city?.trim() || "",
    state: values.state?.trim() || "",
    partnerId: values.partnerId?.trim() || "",
    partnerCode: values.partnerCode?.trim() || "",
    from: values.from?.trim() || "",
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }

  return `/unidades/cadastro?${params.toString()}`;
}

export default async function NovaUnidadePage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/unidades/cadastro");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/unidades");
  }

  const params = await resolveSearchParams(searchParams);
  const requestedStep = Number(readStringParam(params, "step", "1")) || 1;

  const code = normalizeUpper(readStringParam(params, "code"));
  const name = readStringParam(params, "name").trim();
  const city = readStringParam(params, "city").trim();
  const state = normalizeUpper(readStringParam(params, "state"));
  const partnerIdParam = readStringParam(params, "partnerId").trim();
  const partnerCode = normalizeUpper(readStringParam(params, "partnerCode"));
  const originParam = readStringParam(params, "from").trim();
  const origin = originParam === "legacy" ? "imported" : originParam;
  const isImportedOrigin = origin === "imported";

  const baseReady = code.length >= 2 && name.length >= 2;

  const partnersResponse = await apiJson<PaginatedResponse<PartnerOption>>(
    "/partners?page=1&pageSize=100&sortBy=code&sortDir=asc",
  );
  const partnerOptions = partnersResponse.items.filter((item) => item.isActive);
  const partnerFromImported = partnerCode
    ? partnerOptions.find((partner) => normalizeUpper(partner.code) === partnerCode)
    : null;
  const partnerId = partnerIdParam || partnerFromImported?.id || "";
  const linkReady = baseReady && Boolean(partnerId);

  let step = 1;
  if (requestedStep >= 4 && linkReady) {
    step = 4;
  } else if (requestedStep >= 3 && linkReady) {
    step = 3;
  } else if (requestedStep >= 2 && baseReady) {
    step = 2;
  }

  const selectedPartner =
    partnerOptions.find((partner) => partner.id === partnerId) || partnerFromImported || null;
  const wizardValues = { code, name, city, state, partnerId, partnerCode, from: origin };
  async function createFromWizard(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    let createdId = "";
    const submittedOrigin = String(formData.get("from") || "");
    const createOrigin = submittedOrigin === "legacy" || submittedOrigin === "imported" ? "imported" : "wizard";

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const created = await apiJson<{ id: string }>("/units", {
        method: "POST",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          city: String(formData.get("city") || ""),
          state: String(formData.get("state") || ""),
          partnerId: String(formData.get("partnerId") || ""),
          reportContractLabel: String(formData.get("reportContractLabel") || ""),
          reportAddressLine: String(formData.get("reportAddressLine") || ""),
          reportContractedBandwidth: String(formData.get("reportContractedBandwidth") || ""),
          reportNotes: String(formData.get("reportNotes") || ""),
        }),
      });

      createdId = created.id;
      revalidatePath("/unidades");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect(`/unidades/${createdId}?created=1&from=${createOrigin}`);
  }

  return (
    <NovaLitShell activeHref="/unidades">
      <div className="nova-unit-create-lit-page"><div className="nds-surface w-full"><div className="flex items-start justify-between gap-2 border-b border-white/[0.08] px-3 py-2 sm:px-3"><SectionIntro
            eyebrow="Cadastro guiado"
            title="Cadastrar unidade"
            description="Cadastre base, parceiro e dados de relatório antes de abrir detalhes operacionais."
            actions={
              isImportedOrigin ? (
                <TonePill tone="info">pré-preenchido por dados importados</TonePill>
              ) : undefined
            }
            compact
          /><div className="shrink-0"><Link
              href="/unidades"
              aria-label="Fechar cadastro"
              className="nds-icon-button"
            >
              ×
            </Link></div></div><div className="border-b border-white/[0.08] bg-[var(--nova-surface-3)] px-3 py-2 sm:px-3"><div className="grid gap-2 lg:grid-cols-4"><WizardStep
              index={1}
              title="Base"
              description="Código e nome operacional."
              state={step === 1 ? "current" : step > 1 ? "done" : "available"}
              href={buildWizardHref(1, wizardValues)}
            /><WizardStep
              index={2}
              title="Vínculos"
              description="Parceiro, cidade e UF."
              state={step === 2 ? "current" : step > 2 ? "done" : baseReady ? "available" : "locked"}
              href={baseReady ? buildWizardHref(2, wizardValues) : undefined}
            /><WizardStep
              index={3}
              title="Monitoramento"
              description="Match técnico após criar."
              state={step === 3 ? "current" : step > 3 ? "done" : linkReady ? "available" : "locked"}
              href={linkReady ? buildWizardHref(3, wizardValues) : undefined}
            /><WizardStep
              index={4}
              title="Observações"
              description="Revisão final."
              state={step === 4 ? "current" : linkReady ? "available" : "locked"}
              href={linkReady ? buildWizardHref(4, wizardValues) : undefined}
            /></div></div><div className="px-3 py-2 sm:px-3">
          {step === 1 ? (
            <WizardPanel
              title="Base"
              description="Informe código e nome usados na operação."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="2" /><input type="hidden" name="city" value={city} /><input type="hidden" name="state" value={state} /><input type="hidden" name="partnerId" value={partnerId} /><input type="hidden" name="partnerCode" value={partnerCode} /><input type="hidden" name="from" value={origin} /><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="wizard-code" label="Código" hint="Mínimo de 2 caracteres" /><input
                      id="wizard-code"
                      name="code"
                      defaultValue={code}
                      placeholder="UNITINS-ARAGUAINA"
                      minLength={2}
                      required
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="wizard-name" label="Nome da unidade" hint="Nome operacional claro" /><input
                      id="wizard-name"
                      name="name"
                      defaultValue={name}
                      placeholder="Unitins Araguaína"
                      minLength={2}
                      required
                    /></div></div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href="/unidades"
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
              title="Vínculos"
              description="Associe parceiro principal e localização para consulta e reconciliação."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="3" /><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><input type="hidden" name="partnerCode" value={partnerCode} /><input type="hidden" name="from" value={origin} /><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="wizard-partner" label="Parceiro principal" hint="Obrigatório para avançar" /><select
                      id="wizard-partner"
                      name="partnerId"
                      defaultValue={partnerId}
                      required
                    ><option value="">Selecione um parceiro</option>
                      {partnerOptions.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.code} - {partner.name}
                        </option>
                      ))}
                    </select>
                    {partnerCode ? (
                      <div className="text-[10px] leading-5 text-slate-500">
                        Parceiro sugerido pelos dados importados:{" "}
                        <span className="font-semibold text-slate-300">{partnerCode}</span>
                        {partnerFromImported
                          ? " · selecionado automaticamente"
                          : " · selecione o equivalente antes de gravar"}
                      </div>
                    ) : null}
                  </div><div className="grid gap-1.5"><FieldLabel htmlFor="wizard-city" label="Cidade" hint="Opcional" /><input
                      id="wizard-city"
                      name="city"
                      defaultValue={city}
                      placeholder="Araguaína"
                    /></div></div><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="wizard-state" label="UF" hint="Sigla" /><input
                      id="wizard-state"
                      name="state"
                      defaultValue={state}
                      placeholder="TO"
                      maxLength={2}
                    /></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">Vínculo operacional</div><div className="mt-1 text-[11px] leading-5 text-slate-400">
                      O parceiro sustenta o atendimento externo; host, acionamento e dados técnicos ficam no detalhe da unidade.
                    </div></div></div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
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
              title="Monitoramento"
              description="Confirme que o monitoramento será amarrado no detalhe após a criação."
            ><div className="nova-side-grid nova-side-grid--320 nova-side-grid--lg"><div className="grid gap-2"><div className="nds-card"><div className="text-[12px] font-black text-slate-50">Próximo passo recomendado</div><div className="mt-1 text-[11px] leading-5 text-slate-400">
                      Crie a unidade, abra a ficha e resolva host Zabbix, dados importados e cobertura no detalhe operacional.
</div></div><div className="grid gap-2 md:grid-cols-3"><SummaryItem label="Código" value={code} /><SummaryItem label="Nome" value={name} /><SummaryItem label="Parceiro" value={selectedPartner ? `${selectedPartner.code} - ${selectedPartner.name}` : "-"} /><SummaryItem label="Cidade" value={city || "-"} /><SummaryItem label="UF" value={state || "-"} /><SummaryItem label="Origem" value={isImportedOrigin ? "dados importados" : "cadastro manual"} /></div></div><div className="rounded-[6px] border border-[var(--nova-primary)]/20 bg-[var(--nova-primary-soft)] p-2"><div className="nds-label">
                    pós-criação
                  </div><div className="mt-2 text-[12px] font-black text-white">
                    Monitoramento fica no detalhe
                  </div><div className="mt-1 text-[11px] leading-5 text-slate-300">
                    Após criar, complete host, vínculos, acionamento e ativos.
                  </div></div></div><div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                  href={buildWizardHref(2, wizardValues)}
                  className="nds-button"
                  data-variant="secondary"
                >
                  Voltar
                </Link><Link
                  href={buildWizardHref(4, wizardValues)}
                  className="nds-button"
                  data-variant="primary"
                >
                  Próximo
                </Link></div></WizardPanel>
          ) : null}

          {step === 4 ? (
            <WizardPanel
              title="Observações"
              description="Revise cadastro e dados de relatório antes de criar."
            ><ActionForm
                action={createFromWizard}
                className="grid gap-2"
                submitLabel="Criar unidade"
                pendingLabel="Criando unidade..."
                hideSubmit
><input type="hidden" name="code" value={code} /><input type="hidden" name="name" value={name} /><input type="hidden" name="city" value={city} /><input type="hidden" name="state" value={state} /><input type="hidden" name="partnerId" value={partnerId} /><input type="hidden" name="partnerCode" value={partnerCode} /><input type="hidden" name="from" value={origin} /><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><SummaryItem label="Código" value={code} /><SummaryItem label="Nome da unidade" value={name} /><SummaryItem label="Parceiro" value={selectedPartner ? `${selectedPartner.code} - ${selectedPartner.name}` : "-"} /><SummaryItem label="Cidade" value={city || "-"} /><SummaryItem label="UF" value={state || "-"} /><SummaryItem label="Origem" value={isImportedOrigin ? "dados importados" : "cadastro manual"} /></div><div className="nds-card"><div className="nds-label">
                  Dados do relatório
                </div><div className="mt-1 text-[11px] leading-5 text-slate-400">
                  Preencha contrato, endereço e banda quando já existirem; esses dados entram automaticamente no DOCX/PDF.
                </div><div className="mt-2 grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="new-unit-report-contract" label="Contrato do relatório" hint="Opcional" /><input
                      id="new-unit-report-contract"
                      name="reportContractLabel"
                      placeholder="Contrato nº ..."
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="new-unit-report-bandwidth" label="Banda contratada" hint="Opcional" /><input
                      id="new-unit-report-bandwidth"
                      name="reportContractedBandwidth"
                      placeholder="Ex.: 100 Mbps"
                    /></div><div className="grid gap-1.5 md:col-span-2"><FieldLabel htmlFor="new-unit-report-address" label="Endereço do relatório" hint="Opcional; vazio usa Cidade - UF" /><input
                      id="new-unit-report-address"
                      name="reportAddressLine"
                      placeholder="Endereço de instalação ou Cidade - UF"
                    /></div><div className="grid gap-1.5 md:col-span-2"><FieldLabel htmlFor="new-unit-report-notes" label="Observações do relatório" hint="Opcional" /><textarea
                      id="new-unit-report-notes"
                      name="reportNotes"
                      rows={3}
                      placeholder="Observações internas para emissão do relatório"
                    /></div></div></div><div className="nds-card text-[11px] leading-5 text-slate-400">
                  Depois de criar, abra a ficha para amarrar monitoramento, dados operacionais, backup e ativos.
                </div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href={buildWizardHref(3, wizardValues)}
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Voltar
                  </Link><FormSubmitButton
                    idleLabel="Criar unidade"
                    pendingLabel="Criando unidade..."
                    className="min-w-[148px]"
                  /></div></ActionForm></WizardPanel>
          ) : null}
        </div><div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-3 py-2 sm:px-3"><TonePill tone="info">cadastro guiado</TonePill><Link
            href="/unidades"
            className="nds-button"
            data-variant="secondary"
          >
            Cancelar
          </Link></div></div>      </div>
    </NovaLitShell>
  );
}
