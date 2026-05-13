import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { type ContractRow } from "@/lib/contracts";
import { type PaginatedResponse } from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PartnerOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportAddressLine: string | null;
  reportContractedBandwidth: string | null;
  partner: { id: string; code: string; name: string };
};

function optionalText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function moneyToCents(value: FormDataEntryValue | null) {
  const raw = optionalText(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = optionalText(value).replace(",", ".");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setOptional(payload: Record<string, unknown>, key: string, value: FormDataEntryValue | null) {
  const clean = optionalText(value);
  if (clean) payload[key] = clean;
}

export default async function CadastroContratoPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/contratos/cadastro");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/contratos");
  }

  async function createContract(
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

      const unitId = optionalText(formData.get("unitId"));
      const bandwidthMbps = optionalNumber(formData.get("bandwidthMbps"));
      const units = unitId
        ? [
            {
              unitId,
              addressLine: optionalText(formData.get("addressLine")),
              bandwidthLabel: optionalText(formData.get("bandwidthLabel")),
              bandwidthMbps,
            },
          ]
        : [];

      const payload: Record<string, unknown> = {
        code: optionalText(formData.get("code")),
        partnerId: optionalText(formData.get("partnerId")),
        title: optionalText(formData.get("title")),
        status: optionalText(formData.get("status")) || "active",
        type: optionalText(formData.get("type")) || "corporate",
        monthlyValueCents: moneyToCents(formData.get("monthlyValue")),
        paymentMethod: optionalText(formData.get("paymentMethod")),
        billingCycle: optionalText(formData.get("billingCycle")),
        adjustmentIndex: optionalText(formData.get("adjustmentIndex")),
        renewalMode: optionalText(formData.get("renewalMode")),
        loyaltyMonths: optionalNumber(formData.get("loyaltyMonths")),
        terminationPenalty: optionalText(formData.get("terminationPenalty")),
        slaPercent: optionalNumber(formData.get("slaPercent")),
        notes: optionalText(formData.get("notes")),
        units,
      };

      setOptional(payload, "startsAt", formData.get("startsAt"));
      setOptional(payload, "endsAt", formData.get("endsAt"));
      setOptional(payload, "signedAt", formData.get("signedAt"));

      const created = await apiJson<ContractRow>("/contracts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      createdId = created.id;
      revalidatePath("/contratos");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect(`/contratos/${createdId}?created=1`);
  }

  const [partnersResponse, unitsResponse] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
  ]);
  const partners = partnersResponse.items.filter((partner) => partner.isActive);

  return (
    <NovaLitShell activeHref="/contratos">
      <section className="nova-contract-detail-page" aria-label="Cadastro de contrato">
        <header className="nova-contract-detail-hero">
          <nav className="nova-contract-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link href="/contratos">Contratos</Link>
            <span>/</span>
            <strong>Cadastro de contrato</strong>
          </nav>

          <div className="nova-contract-detail-title-row">
            <div>
              <h1>Cadastro de contrato</h1>
              <p>Crie a entidade contratual real e, se quiser, vincule a primeira unidade coberta.</p>
            </div>
            <div className="nova-contract-detail-actions">
              <Link href="/contratos">Cancelar</Link>
            </div>
          </div>
        </header>

        <div className="nova-lit-card nova-contract-form-card">
          <ActionForm
            action={createContract}
            submitLabel="Cadastrar contrato"
            pendingLabel="Cadastrando contrato..."
            className="grid gap-3"
          >
            <section className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span>Código do contrato</span>
                <input name="code" required placeholder="43779" />
              </label>
              <label className="grid gap-1.5 md:col-span-2">
                <span>Título</span>
                <input name="title" placeholder="Contrato corporativo principal" />
              </label>
              <label className="grid gap-1.5 md:col-span-2">
                <span>Parceiro</span>
                <select name="partnerId" required>
                  <option value="">Selecione um parceiro</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.code} - {partner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span>Status</span>
                <select name="status" defaultValue="active">
                  <option value="active">Ativo</option>
                  <option value="draft">Rascunho</option>
                  <option value="expired">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span>Tipo</span>
                <input name="type" defaultValue="corporate" />
              </label>
              <label className="grid gap-1.5">
                <span>Assinatura</span>
                <input name="signedAt" type="date" />
              </label>
              <label className="grid gap-1.5">
                <span>Início</span>
                <input name="startsAt" type="date" />
              </label>
              <label className="grid gap-1.5">
                <span>Fim</span>
                <input name="endsAt" type="date" />
              </label>
              <label className="grid gap-1.5">
                <span>Valor mensal (R$)</span>
                <input name="monthlyValue" inputMode="decimal" placeholder="3500,00" />
              </label>
              <label className="grid gap-1.5">
                <span>SLA (%)</span>
                <input name="slaPercent" inputMode="decimal" placeholder="99,8" />
              </label>
              <label className="grid gap-1.5">
                <span>Pagamento</span>
                <input name="paymentMethod" placeholder="Boleto bancário" />
              </label>
              <label className="grid gap-1.5">
                <span>Faturamento</span>
                <input name="billingCycle" placeholder="Mensal" />
              </label>
              <label className="grid gap-1.5">
                <span>Reajuste</span>
                <input name="adjustmentIndex" placeholder="IPCA" />
              </label>
              <label className="grid gap-1.5">
                <span>Renovação</span>
                <input name="renewalMode" placeholder="Automática" />
              </label>
              <label className="grid gap-1.5">
                <span>Fidelidade (meses)</span>
                <input name="loyaltyMonths" inputMode="numeric" placeholder="12" />
              </label>
              <label className="grid gap-1.5 md:col-span-2">
                <span>Multa rescisória</span>
                <input name="terminationPenalty" placeholder="20% sobre saldo restante" />
              </label>
            </section>

            <section className="nova-contract-detail-card" id="unidade-inicial">
              <h2>Unidade inicial</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5 md:col-span-2">
                  <span>Unidade coberta</span>
                  <select name="unitId">
                    <option value="">Sem unidade inicial por enquanto</option>
                    {unitsResponse.items.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.partner.code} · {unit.code} - {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span>Banda (Mbps)</span>
                  <input name="bandwidthMbps" inputMode="decimal" placeholder="200" />
                </label>
                <label className="grid gap-1.5">
                  <span>Rótulo da banda</span>
                  <input name="bandwidthLabel" placeholder="200 Mbps" />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span>Endereço contratual</span>
                  <input name="addressLine" placeholder="Endereço coberto pelo contrato" />
                </label>
              </div>
            </section>

            <label className="grid gap-1.5">
              <span>Observações</span>
              <textarea name="notes" rows={4} placeholder="Condições, escopo ou notas de implantação." />
            </label>
          </ActionForm>
        </div>
      </section>
    </NovaLitShell>
  );
}
