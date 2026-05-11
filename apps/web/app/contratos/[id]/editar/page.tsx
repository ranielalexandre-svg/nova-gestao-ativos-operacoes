import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import {
  contractStatusLabel,
  formatMoneyCents,
  locationLabel,
  type ContractRow,
} from "@/lib/contracts";
import { type PaginatedResponse } from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Params = {
  id: string;
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

function moneyInputValue(value: number | null | undefined) {
  if (typeof value !== "number") return "";
  return (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function setOptional(payload: Record<string, unknown>, key: string, value: FormDataEntryValue | null) {
  const clean = optionalText(value);
  if (clean) payload[key] = clean;
}

async function readContract(id: string) {
  try {
    return await apiJson<ContractRow>(`/contracts/${id}`);
  } catch {
    notFound();
  }
}

export default async function EditarContratoPage({ params }: { params: Promise<Params> | Params }) {
  const session = await getServerWebSession();
  const resolved = await Promise.resolve(params);
  const contractId = resolved.id;

  if (!session.authenticated) {
    redirect(`/login?next=/contratos/${contractId}/editar`);
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect(`/contratos/${contractId}`);
  }

  async function updateContract(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const payload: Record<string, unknown> = {
        code: optionalText(formData.get("code")),
        title: optionalText(formData.get("title")),
        status: optionalText(formData.get("status")),
        type: optionalText(formData.get("type")),
        monthlyValueCents: moneyToCents(formData.get("monthlyValue")),
        paymentMethod: optionalText(formData.get("paymentMethod")),
        billingCycle: optionalText(formData.get("billingCycle")),
        adjustmentIndex: optionalText(formData.get("adjustmentIndex")),
        renewalMode: optionalText(formData.get("renewalMode")),
        loyaltyMonths: optionalNumber(formData.get("loyaltyMonths")),
        terminationPenalty: optionalText(formData.get("terminationPenalty")),
        slaPercent: optionalNumber(formData.get("slaPercent")),
        notes: optionalText(formData.get("notes")),
      };

      setOptional(payload, "startsAt", formData.get("startsAt"));
      setOptional(payload, "endsAt", formData.get("endsAt"));
      setOptional(payload, "signedAt", formData.get("signedAt"));

      await apiJson(`/contracts/${contractId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      revalidatePath("/contratos");
      revalidatePath(`/contratos/${contractId}`);
      revalidatePath(`/contratos/${contractId}/editar`);
      return { status: "success", message: "Contrato atualizado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function addUnit(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const unitId = optionalText(formData.get("unitId"));
      if (!unitId) {
        return { status: "error", message: "Selecione uma unidade." };
      }

      await apiJson(`/contracts/${contractId}/units`, {
        method: "POST",
        body: JSON.stringify([
          {
            unitId,
            role: optionalText(formData.get("role")) || "covered",
            status: optionalText(formData.get("unitStatus")) || "active",
            addressLine: optionalText(formData.get("addressLine")),
            bandwidthLabel: optionalText(formData.get("bandwidthLabel")),
            bandwidthMbps: optionalNumber(formData.get("bandwidthMbps")),
            notes: optionalText(formData.get("unitNotes")),
          },
        ]),
      });

      revalidatePath(`/contratos/${contractId}`);
      revalidatePath(`/contratos/${contractId}/editar`);
      return { status: "success", message: "Unidade vinculada." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function removeUnit(formData: FormData) {
    "use server";

    const unitId = optionalText(formData.get("unitId"));
    if (!unitId) return;

    await apiJson(`/contracts/${contractId}/units/${unitId}`, { method: "DELETE" });
    revalidatePath(`/contratos/${contractId}`);
    revalidatePath(`/contratos/${contractId}/editar`);
  }

  async function addService(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      await apiJson(`/contracts/${contractId}/services`, {
        method: "POST",
        body: JSON.stringify({
          name: optionalText(formData.get("name")),
          description: optionalText(formData.get("description")),
          serviceType: optionalText(formData.get("serviceType")),
          status: optionalText(formData.get("serviceStatus")) || "active",
          sortOrder: optionalNumber(formData.get("sortOrder")),
        }),
      });

      revalidatePath(`/contratos/${contractId}`);
      revalidatePath(`/contratos/${contractId}/editar`);
      return { status: "success", message: "Serviço adicionado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function upsertBilling(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const payload: Record<string, unknown> = {
        referenceMonth: optionalText(formData.get("referenceMonth")),
        status: optionalText(formData.get("billingStatus")) || "open",
        amountCents: moneyToCents(formData.get("amount")),
        notes: optionalText(formData.get("billingNotes")),
      };
      setOptional(payload, "dueDate", formData.get("dueDate"));
      setOptional(payload, "paidAt", formData.get("paidAt"));

      await apiJson(`/contracts/${contractId}/billing`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      revalidatePath(`/contratos/${contractId}`);
      revalidatePath(`/contratos/${contractId}/editar`);
      return { status: "success", message: "Faturamento atualizado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function addContact(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const payload: Record<string, unknown> = {
        name: optionalText(formData.get("name")),
        role: optionalText(formData.get("role")),
        phone: optionalText(formData.get("phone")),
        isPrimary: formData.get("isPrimary") === "on",
      };
      setOptional(payload, "email", formData.get("email"));

      await apiJson(`/contracts/${contractId}/contacts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      revalidatePath(`/contratos/${contractId}`);
      revalidatePath(`/contratos/${contractId}/editar`);
      return { status: "success", message: "Contato adicionado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [contract, unitsResponse] = await Promise.all([
    readContract(contractId),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
  ]);
  const linkedUnitIds = new Set(contract.units.map((item) => item.unit.id));
  const availableUnits = unitsResponse.items.filter(
    (unit) => unit.partner.id === contract.partner.id && !linkedUnitIds.has(unit.id),
  );

  return (
    <NovaLitShell activeHref="/contratos">
      <section className="nova-contract-detail-page" aria-label="Editar contrato">
        <header className="nova-contract-detail-hero">
          <nav className="nova-contract-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link href="/contratos">Contratos</Link>
            <span>/</span>
            <Link href={`/contratos/${contract.id}`}>{contract.code}</Link>
            <span>/</span>
            <strong>Editar</strong>
          </nav>

          <div className="nova-contract-detail-title-row">
            <div>
              <h1>Editar contrato {contract.code}</h1>
              <p>Atualize dados comerciais, vínculos de unidade, serviços, faturamento e contatos.</p>
            </div>
            <div className="nova-contract-detail-actions">
              <Link href={`/contratos/${contract.id}`}>Abrir contrato</Link>
              <Link href="/contratos">Carteira</Link>
            </div>
          </div>
        </header>

        <section className="nova-contract-detail-grid">
          <aside className="nova-contract-detail-left">
            <article className="nova-contract-detail-card">
              <h2>Dados principais</h2>
              <ActionForm action={updateContract} submitLabel="Salvar contrato" pendingLabel="Salvando..." className="grid gap-2">
                <label className="grid gap-1.5">
                  <span>Código</span>
                  <input name="code" defaultValue={contract.code} required />
                </label>
                <label className="grid gap-1.5">
                  <span>Título</span>
                  <input name="title" defaultValue={contract.title || ""} />
                </label>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span>Status</span>
                    <select name="status" defaultValue={contract.status}>
                      <option value="active">Ativo</option>
                      <option value="draft">Rascunho</option>
                      <option value="expired">Vencido</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>Tipo</span>
                    <input name="type" defaultValue={contract.type || ""} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Assinatura</span>
                    <input name="signedAt" type="date" defaultValue={dateInputValue(contract.signedAt)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Início</span>
                    <input name="startsAt" type="date" defaultValue={dateInputValue(contract.startsAt)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Fim</span>
                    <input name="endsAt" type="date" defaultValue={dateInputValue(contract.endsAt)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Valor mensal (R$)</span>
                    <input name="monthlyValue" inputMode="decimal" defaultValue={moneyInputValue(contract.monthlyValueCents)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>SLA (%)</span>
                    <input name="slaPercent" inputMode="decimal" defaultValue={contract.slaPercent ?? ""} />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Fidelidade (meses)</span>
                    <input name="loyaltyMonths" inputMode="numeric" defaultValue={contract.loyaltyMonths ?? ""} />
                  </label>
                </div>
                <label className="grid gap-1.5">
                  <span>Pagamento</span>
                  <input name="paymentMethod" defaultValue={contract.paymentMethod || ""} />
                </label>
                <label className="grid gap-1.5">
                  <span>Faturamento</span>
                  <input name="billingCycle" defaultValue={contract.billingCycle || ""} />
                </label>
                <label className="grid gap-1.5">
                  <span>Reajuste</span>
                  <input name="adjustmentIndex" defaultValue={contract.adjustmentIndex || ""} />
                </label>
                <label className="grid gap-1.5">
                  <span>Renovação</span>
                  <input name="renewalMode" defaultValue={contract.renewalMode || ""} />
                </label>
                <label className="grid gap-1.5">
                  <span>Multa rescisória</span>
                  <input name="terminationPenalty" defaultValue={contract.terminationPenalty || ""} />
                </label>
                <label className="grid gap-1.5">
                  <span>Observações</span>
                  <textarea name="notes" rows={4} defaultValue={contract.notes || ""} />
                </label>
              </ActionForm>
            </article>
          </aside>

          <main className="nova-contract-detail-main">
            <article className="nova-contract-detail-card" id="unidades">
              <h2>Unidades vinculadas</h2>
              <div className="nova-contract-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Local</th>
                      <th>Banda</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.units.length ? contract.units.map((item) => (
                      <tr key={item.id}>
                        <td><Link href={`/unidades/${item.unit.id}`}>{item.unit.code} - {item.unit.name}</Link></td>
                        <td>{item.addressLine || locationLabel(item.unit)}</td>
                        <td>{item.bandwidthLabel || (item.bandwidthMbps ? `${item.bandwidthMbps} Mbps` : "-")}</td>
                        <td>
                          <form action={removeUnit}>
                            <input type="hidden" name="unitId" value={item.unit.id} />
                            <button type="submit">Remover</button>
                          </form>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>Nenhuma unidade vinculada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <ActionForm action={addUnit} submitLabel="Vincular unidade" pendingLabel="Vinculando..." className="mt-3 grid gap-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-1.5 md:col-span-2">
                    <span>Unidade do parceiro {contract.partner.code}</span>
                    <select name="unitId">
                      <option value="">Selecione</option>
                      {availableUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} - {unit.name} · {[unit.city, unit.state].filter(Boolean).join("/")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>Papel</span>
                    <select name="role" defaultValue="covered">
                      <option value="covered">Coberta</option>
                      <option value="billing">Faturamento</option>
                      <option value="technical">Técnica</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>Status</span>
                    <select name="unitStatus" defaultValue="active">
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>Banda (Mbps)</span>
                    <input name="bandwidthMbps" inputMode="decimal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Rótulo da banda</span>
                    <input name="bandwidthLabel" />
                  </label>
                  <label className="grid gap-1.5 md:col-span-3">
                    <span>Endereço</span>
                    <input name="addressLine" />
                  </label>
                  <label className="grid gap-1.5 md:col-span-3">
                    <span>Notas</span>
                    <input name="unitNotes" />
                  </label>
                </div>
              </ActionForm>
            </article>

            <article className="nova-contract-detail-card" id="servicos">
              <h2>Serviços</h2>
              <div className="nova-contract-detail-services">
                {contract.services.length ? contract.services.map((service) => (
                  <div key={service.id}>
                    <i className={service.status === "active" ? "is-green" : "is-yellow"}>{service.name.slice(0, 2).toUpperCase()}</i>
                    <strong>{service.name}</strong>
                    <span>{service.description || service.serviceType || contractStatusLabel(contract.status)}</span>
                  </div>
                )) : (
                  <div><i className="is-yellow">S</i><strong>Sem serviço</strong><span>Adicione o escopo contratado.</span></div>
                )}
              </div>
              <ActionForm action={addService} submitLabel="Adicionar serviço" pendingLabel="Adicionando..." className="mt-3 grid gap-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span>Nome</span>
                    <input name="name" required placeholder="Internet Dedicada" />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Tipo</span>
                    <input name="serviceType" placeholder="connectivity" />
                  </label>
                  <label className="grid gap-1.5">
                    <span>Status</span>
                    <select name="serviceStatus" defaultValue="active">
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>Ordem</span>
                    <input name="sortOrder" inputMode="numeric" defaultValue="0" />
                  </label>
                  <label className="grid gap-1.5 md:col-span-2">
                    <span>Descrição</span>
                    <input name="description" />
                  </label>
                </div>
              </ActionForm>
            </article>
          </main>

          <aside className="nova-contract-detail-right">
            <article className="nova-contract-detail-card" id="faturamento">
              <h2>Faturamento</h2>
              <dl>
                <div><dt>Valor mensal atual</dt><dd>{formatMoneyCents(contract.monthlyValueCents)}</dd></div>
                <div><dt>Último registro</dt><dd>{contract.latestBilling?.referenceMonth || "sem registro"}</dd></div>
                <div><dt>Status</dt><dd>{contract.latestBilling?.status || "sem registro"}</dd></div>
              </dl>
              <ActionForm action={upsertBilling} submitLabel="Salvar faturamento" pendingLabel="Salvando..." className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span>Mês de referência</span>
                  <input name="referenceMonth" type="month" required />
                </label>
                <label className="grid gap-1.5">
                  <span>Valor (R$)</span>
                  <input name="amount" inputMode="decimal" />
                </label>
                <label className="grid gap-1.5">
                  <span>Status</span>
                  <select name="billingStatus" defaultValue="open">
                    <option value="open">Aberta</option>
                    <option value="paid">Paga</option>
                    <option value="overdue">Vencida</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span>Vencimento</span>
                  <input name="dueDate" type="date" />
                </label>
                <label className="grid gap-1.5">
                  <span>Pagamento</span>
                  <input name="paidAt" type="date" />
                </label>
                <label className="grid gap-1.5">
                  <span>Notas</span>
                  <input name="billingNotes" />
                </label>
              </ActionForm>
            </article>

            <article className="nova-contract-detail-card" id="contatos">
              <h2>Contatos</h2>
              <div className="nova-contract-detail-contacts">
                {contract.contacts.length ? contract.contacts.map((contact) => (
                  <div key={contact.id}>
                    <strong>{contact.name}<span>{contact.role || "Contato"}</span></strong>
                    <small>{contact.email || "sem e-mail"}</small>
                    <small>{contact.phone || "sem telefone"}</small>
                  </div>
                )) : (
                  <div><strong>Sem contato<span>Cadastre um responsável contratual.</span></strong></div>
                )}
              </div>
              <ActionForm action={addContact} submitLabel="Adicionar contato" pendingLabel="Adicionando..." className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span>Nome</span>
                  <input name="name" required />
                </label>
                <label className="grid gap-1.5">
                  <span>Papel</span>
                  <input name="role" placeholder="Gestor do contrato" />
                </label>
                <label className="grid gap-1.5">
                  <span>E-mail</span>
                  <input name="email" type="email" />
                </label>
                <label className="grid gap-1.5">
                  <span>Telefone</span>
                  <input name="phone" />
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] text-slate-300">
                  <input name="isPrimary" type="checkbox" />
                  Contato principal
                </label>
              </ActionForm>
            </article>
          </aside>
        </section>
      </section>
    </NovaLitShell>
  );
}
