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
import { equipmentStatusLabel } from "@/lib/status-ui";
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

  return `/ativos/cadastro?${params.toString()}`;
}

export default async function NovoAtivoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ativos/cadastro");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/ativos");
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
      revalidatePath("/ativos");
      revalidatePath("/unidades");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect(`/ativos/${createdId}?created=1&from=wizard`);
  }

  return (
    <NovaLitShell activeHref="/ativos">
      <div className="nova-equipment-create-lit-page"><div className="nds-surface w-full"><div className="flex items-start justify-between gap-2 border-b border-white/[0.08] px-3 py-2 sm:px-3"><SectionIntro
            eyebrow="Cadastro guiado"
            title="Cadastrar ativo"
            description="Cadastro de ativo."
            compact
          /><Link
            href="/ativos"
            aria-label="Fechar cadastro"
            className="nds-icon-button shrink-0"
          >
            ×
          </Link></div><div className="border-b border-white/[0.08] bg-[var(--nova-surface-3)] px-3 py-2 sm:px-3"><div className="grid gap-2 lg:grid-cols-3"><WizardStep
              index={1}
              title="Base"
              description="Tag, nome e tipo."
              state={step === 1 ? "current" : step > 1 ? "done" : "available"}
              href={buildWizardHref(1, wizardValues)}
            /><WizardStep
              index={2}
              title="Vínculo"
              description="Unidade, serial e status."
              state={step === 2 ? "current" : step > 2 ? "done" : baseReady ? "available" : "locked"}
              href={baseReady ? buildWizardHref(2, wizardValues) : undefined}
            /><WizardStep
              index={3}
              title="Revisão"
              description="Salvar ativo."
              state={step === 3 ? "current" : linkReady ? "available" : "locked"}
              href={linkReady ? buildWizardHref(3, wizardValues) : undefined}
            /></div></div><div className="px-3 py-2 sm:px-3">
          {step === 1 ? (
            <WizardPanel
              title="Base"
              description="Identificação, unidade e monitoramento."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="2" /><input type="hidden" name="serialNumber" value={serialNumber} /><input type="hidden" name="status" value={status} /><input type="hidden" name="unitId" value={unitId} /><div className="grid gap-2 md:grid-cols-3"><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-tag" label="Tag" hint="Código único do ativo" /><input
                      id="equipment-tag"
                      name="tag"
                      defaultValue={tag}
                      placeholder="EQ-UNITINS-001"
                      minLength={2}
                      required
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-name" label="Nome" hint="Nome visível para operação" /><input
                      id="equipment-name"
                      name="name"
                      defaultValue={name}
                      placeholder="Switch Core Araguaína"
                      minLength={2}
                      required
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-type" label="Tipo" hint="switch, rádio, roteador..." /><input
                      id="equipment-type"
                      name="type"
                      defaultValue={type}
                      placeholder="switch"
                      minLength={2}
                      required
                    /></div></div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href="/ativos"
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
              title="Vínculo"
              description="Associe o ativo à unidade correta. É esse vínculo que permite ler parceiro, dados operacionais e monitoramento sem duplicar contexto."
            ><form method="GET" className="grid gap-2"><input type="hidden" name="step" value="3" /><input type="hidden" name="tag" value={tag} /><input type="hidden" name="name" value={name} /><input type="hidden" name="type" value={type} /><div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-unit" label="Unidade" hint="Obrigatório" /><select
                      id="equipment-unit"
                      name="unitId"
                      defaultValue={unitId}
                      required
                    ><option value="">Selecione uma unidade</option>
                      {unitsResponse.items.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} - {unit.name}
                        </option>
                      ))}
                    </select></div><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-serial" label="Serial / MAC" hint="Ajuda no match com operação/Zabbix" /><input
                      id="equipment-serial"
                      name="serialNumber"
                      defaultValue={serialNumber}
                      placeholder="SN, MAC ou identificador salvo"
                    /></div><div className="grid gap-1.5"><FieldLabel htmlFor="equipment-status" label="Status" hint="Estado operacional" /><select
                      id="equipment-status"
                      name="status"
                      defaultValue={status}
                    ><option value="active">Ativo</option><option value="stock">Estoque</option><option value="repair">Reparo</option><option value="retired">Retirado</option></select></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">Leitura do vínculo</div><div className="mt-1 text-[11px] leading-5 text-slate-400">
                      A unidade traz o parceiro, cidade e host de monitoramento. O registro fica como ativo técnico dentro dessa operação.
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
              title="Revisão"
              description="Confirme o ativo antes de gravar. A próxima leitura acontece no detalhe do ativo e da unidade."
            ><ActionForm
                action={createFromWizard}
                className="grid gap-2"
                submitLabel="Criar ativo"
                pendingLabel="Criando ativo..."
                hideSubmit
              ><input type="hidden" name="tag" value={tag} /><input type="hidden" name="name" value={name} /><input type="hidden" name="type" value={type} /><input type="hidden" name="serialNumber" value={serialNumber} /><input type="hidden" name="status" value={status} /><input type="hidden" name="unitId" value={unitId} /><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><SummaryItem label="Tag" value={tag} /><SummaryItem label="Nome" value={name} /><SummaryItem label="Tipo" value={type} /><SummaryItem label="Serial / MAC" value={serialNumber || "-"} /><SummaryItem label="Status" value={equipmentStatusLabel(status, "title")} /><SummaryItem
                    label="Unidade"
                    value={selectedUnit ? `${selectedUnit.code} - ${selectedUnit.name}` : "-"}
                  /></div><div className="nds-card text-[11px] leading-5 text-slate-400">
                  Ao salvar, o ativo já aparece no inventário e passa a herdar o contexto operacional da unidade: parceiro, cidade, dados operacionais e monitoramento.
                </div><div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2"><Link
                    href={buildWizardHref(2, wizardValues)}
                    className="nds-button"
                    data-variant="secondary"
                  >
                    Voltar
                  </Link><FormSubmitButton
                    idleLabel="Criar ativo"
                    pendingLabel="Criando ativo..."
                    className="min-w-[148px]"
                  /></div></ActionForm></WizardPanel>
          ) : null}
        </div><div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-3 py-2 sm:px-3"><TonePill tone="info">cadastro guiado</TonePill><Link
            href="/ativos"
            className="nds-button"
            data-variant="secondary"
          >
            Cancelar
          </Link></div></div>      </div>
    </NovaLitShell>
  );
}
