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
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  partner: { id: string; code: string; name: string };
};

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function buildWizardHref(
  step: number,
  values: {
    tag?: string;
    name?: string;
    type?: string;
    serialNumber?: string;
    status?: string;
    unitId?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("step", String(step));

  for (const [key, value] of Object.entries(values)) {
    const clean = value?.trim();
    if (clean) params.set(key, clean);
  }

  return `/equipamentos/nova?${params.toString()}`;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    stock: "Estoque",
    repair: "Reparo",
    retired: "Retirado",
  };
  return labels[value] || value || "Ativo";
}

export default async function NovoEquipamentoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/equipamentos/nova");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/equipamentos");
  }

  const params = await resolveSearchParams(searchParams);
  const requestedStep = Number(readStringParam(params, "step", "1")) || 1;
  const tag = normalizeUpper(readStringParam(params, "tag"));
  const name = readStringParam(params, "name").trim();
  const type = readStringParam(params, "type").trim();
  const serialNumber = readStringParam(params, "serialNumber").trim();
  const status = readStringParam(params, "status", "active").trim() || "active";
  const unitId = readStringParam(params, "unitId").trim();
  const baseReady = tag.length >= 2 && name.length >= 2 && type.length >= 2;
  const linkReady = baseReady && Boolean(unitId);
  const wizardValues = { tag, name, type, serialNumber, status, unitId };

  const unitsResponse = await apiJson<PaginatedResponse<UnitOption>>(
    "/units?page=1&pageSize=100&sortBy=code&sortDir=asc",
  );
  const selectedUnit = unitsResponse.items.find((unit) => unit.id === unitId) || null;

  let step = 1;
  if (requestedStep >= 3 && linkReady) {
    step = 3;
  } else if (requestedStep >= 2 && baseReady) {
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

      const created = await apiJson<{ id: string }>("/equipments", {
        method: "POST",
        body: JSON.stringify({
          tag: String(formData.get("tag") || ""),
          name: String(formData.get("name") || ""),
          type: String(formData.get("type") || ""),
          serialNumber: String(formData.get("serialNumber") || ""),
          status: String(formData.get("status") || "active"),
          unitId: String(formData.get("unitId") || ""),
        }),
      });

      createdId = created.id;
      revalidatePath("/equipamentos");
      revalidatePath("/unidades");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect(`/equipamentos/${createdId}?created=1&from=wizard`);
  }

  return (
    <AppShell
      title="Novo equipamento"
      subtitle="Cadastro guiado para vincular ativo, unidade e rastreabilidade."
    >
      <div className="mx-auto max-w-6xl rounded-[22px] border border-white/[0.08] bg-[#0c1016] shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <SectionIntro
            eyebrow="Cadastro guiado"
            title="Novo equipamento"
            description="Fluxo guiado para identificar o ativo, vincular à unidade e revisar antes de criar."
            compact
          />
          <Link
            href="/equipamentos"
            aria-label="Fechar cadastro"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] text-lg leading-none text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            ×
          </Link>
        </div>

        <div className="border-b border-white/[0.08] bg-[#0f141b] px-5 py-4 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-3">
            <WizardStep
              index={1}
              title="Base"
              description="Tag, nome e tipo."
              state={step === 1 ? "current" : step > 1 ? "done" : "available"}
              href={buildWizardHref(1, wizardValues)}
            />
            <WizardStep
              index={2}
              title="Vínculo"
              description="Unidade, serial e status."
              state={step === 2 ? "current" : step > 2 ? "done" : baseReady ? "available" : "locked"}
              href={baseReady ? buildWizardHref(2, wizardValues) : undefined}
            />
            <WizardStep
              index={3}
              title="Revisão"
              description="Salvar ativo."
              state={step === 3 ? "current" : linkReady ? "available" : "locked"}
              href={linkReady ? buildWizardHref(3, wizardValues) : undefined}
            />
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {step === 1 ? (
            <WizardPanel
              title="Base"
              description="Crie uma identidade técnica que funcione na busca, na unidade e na mesa de monitoramento."
            >
              <form method="GET" className="grid gap-5">
                <input type="hidden" name="step" value="2" />
                <input type="hidden" name="serialNumber" value={serialNumber} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="unitId" value={unitId} />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-tag" label="Tag" hint="Código único do ativo" />
                    <input
                      id="equipment-tag"
                      name="tag"
                      defaultValue={tag}
                      placeholder="EQ-UNITINS-001"
                      minLength={2}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm uppercase text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-name" label="Nome" hint="Nome visível para operação" />
                    <input
                      id="equipment-name"
                      name="name"
                      defaultValue={name}
                      placeholder="Switch Core Araguaína"
                      minLength={2}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-type" label="Tipo" hint="switch, rádio, roteador..." />
                    <input
                      id="equipment-type"
                      name="type"
                      defaultValue={type}
                      placeholder="switch"
                      minLength={2}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
                  <Link
                    href="/equipamentos"
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link>
                  <button className="rounded-[16px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]">
                    Próximo
                  </button>
                </div>
              </form>
            </WizardPanel>
          ) : null}

          {step === 2 ? (
            <WizardPanel
              title="Vínculo"
              description="Associe o ativo à unidade correta. É esse vínculo que permite ler parceiro, legado e monitoramento sem duplicar contexto."
            >
              <form method="GET" className="grid gap-5">
                <input type="hidden" name="step" value="3" />
                <input type="hidden" name="tag" value={tag} />
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="type" value={type} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-unit" label="Unidade" hint="Obrigatório" />
                    <select
                      id="equipment-unit"
                      name="unitId"
                      defaultValue={unitId}
                      required
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                    >
                      <option value="">Selecione uma unidade</option>
                      {unitsResponse.items.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} - {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-serial" label="Serial / MAC" hint="Ajuda no match com legado/Zabbix" />
                    <input
                      id="equipment-serial"
                      name="serialNumber"
                      defaultValue={serialNumber}
                      placeholder="SN, MAC ou identificador salvo"
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="equipment-status" label="Status" hint="Estado operacional" />
                    <select
                      id="equipment-status"
                      name="status"
                      defaultValue={status}
                      className="w-full rounded-[16px] border border-white/10 bg-[#090d13] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                    >
                      <option value="active">Ativo</option>
                      <option value="stock">Estoque</option>
                      <option value="repair">Reparo</option>
                      <option value="retired">Retirado</option>
                    </select>
                  </div>
                  <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] px-4 py-4">
                    <div className="text-sm font-semibold text-slate-50">Leitura do vínculo</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      A unidade traz o parceiro, cidade e host de monitoramento. O equipamento fica como ativo técnico dentro dessa operação.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
                  <Link
                    href={buildWizardHref(1, wizardValues)}
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link>
                  <button className="rounded-[16px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]">
                    Próximo
                  </button>
                </div>
              </form>
            </WizardPanel>
          ) : null}

          {step === 3 ? (
            <WizardPanel
              title="Revisão"
              description="Confirme o ativo antes de gravar. A próxima leitura acontece no detalhe do equipamento e da unidade."
            >
              <ActionForm
                action={createFromWizard}
                className="grid gap-5"
                submitLabel="Criar equipamento"
                pendingLabel="Criando equipamento..."
                hideSubmit
              >
                <input type="hidden" name="tag" value={tag} />
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="serialNumber" value={serialNumber} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="unitId" value={unitId} />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <SummaryItem label="Tag" value={tag} />
                  <SummaryItem label="Nome" value={name} />
                  <SummaryItem label="Tipo" value={type} />
                  <SummaryItem label="Serial / MAC" value={serialNumber || "-"} />
                  <SummaryItem label="Status" value={statusLabel(status)} />
                  <SummaryItem
                    label="Unidade"
                    value={selectedUnit ? `${selectedUnit.code} - ${selectedUnit.name}` : "-"}
                  />
                </div>

                <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 text-sm leading-6 text-slate-400">
                  Ao salvar, o equipamento já aparece no inventário e passa a herdar o contexto operacional da unidade: parceiro, cidade, legado e monitoramento.
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
                  <Link
                    href={buildWizardHref(2, wizardValues)}
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Voltar
                  </Link>
                  <FormSubmitButton
                    idleLabel="Criar equipamento"
                    pendingLabel="Criando equipamento..."
                    className="min-w-[148px]"
                  />
                </div>
              </ActionForm>
            </WizardPanel>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-5 py-4 sm:px-6">
          <TonePill tone="info">cadastro guiado</TonePill>
          <Link
            href="/equipamentos"
            className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
