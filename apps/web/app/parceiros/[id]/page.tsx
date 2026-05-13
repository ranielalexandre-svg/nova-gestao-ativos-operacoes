import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import { EntityEditModal } from "@/components/entity-edit-modal";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
import {
  RegistryDetailHero,
  RegistryInfoGrid,
  RegistryMetricGrid,
} from "@/components/registry-shell";
import {
  DenseTable,
  EmptyState,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionHeader,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
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
import { formatDate } from "@/lib/formatters";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PartnerOperationalContact = {
  id: string;
  source: string;
  sourceLegacyId: string | null;
  city: string | null;
  name: string | null;
  role: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

type PartnerDetail = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  operationalContacts: PartnerOperationalContact[];
  units: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    isActive: boolean;
    _count: {
      equipments: number;
      occurrences: number;
      maintenances: number;
    };
  }>;
  occurrences: Array<{
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  maintenances: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string | null;
    createdAt: string;
  }>;
  _count: {
    units: number;
    occurrences: number;
    maintenances: number;
    operationalContacts: number;
  };
};

function partnerStatusTone(isActive: boolean) {
  return isActive ? "success" : "subtle";
}

function contactSourceLabel(contact: PartnerOperationalContact) {
  return contact.source === "legacy_sqlite" ? "importado" : "manual";
}

function contactOriginLabel(contact: PartnerOperationalContact) {
  if (contact.sourceLegacyId) return `registro importado ${contact.sourceLegacyId}`;
  return contactSourceLabel(contact);
}

function CreatedNotice({ from }: { from: string }) {
  return (
    <Surface><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><div className="text-[12px] font-black text-slate-50">
            Parceiro criado com sucesso
          </div><div className="mt-1 text-[11px] leading-5 text-slate-400">
            Origem: {from === "wizard" ? "cadastro guiado" : "cadastro direto"}.
            Revise o vínculo das unidades e a cobertura importada.
          </div></div><div className="flex flex-wrap gap-2"><Link
            href="/parceiros/cadastro"
            className="nds-button"
            data-variant="primary"
          >
            Criar outro
          </Link><Link
            href="/parceiros"
            className="nds-button"
            data-variant="secondary"
          >
            Voltar para lista
          </Link></div></div></Surface>
  );
}

function PersistedPartnerContactsBlock({
  partner,
  isAdmin,
  createAction,
  updateAction,
}: {
  partner: PartnerDetail;
  isAdmin: boolean;
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const contacts = partner.operationalContacts || [];
  const primary = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;

  return (
    <Surface>
      <SectionIntro
        eyebrow="Contatos"
        title="Contatos operacionais"
        description="Contatos importados dos dados operacionais e contatos manuais ficam gravados no banco, editáveis no cadastro do parceiro."
        actions={
          <div className="flex flex-wrap gap-2">
            <TonePill tone={contacts.length ? "success" : "attention"}>
              {contacts.length} contato(s)
            </TonePill>
            {primary?.phone ? <TonePill tone="info">telefone principal</TonePill> : null}
          </div>
        }
        compact
      />

      <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-2">
          {contacts.length ? (
            contacts.map((contact) => (
              <div key={contact.id} className="nds-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-black text-slate-50">
                      {contact.name || "Contato operacional"}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {[contact.role, contact.city].filter(Boolean).join(" · ") || contact.source}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contact.isPrimary ? <TonePill tone="success">principal</TonePill> : null}
                    <TonePill tone={contact.source === "legacy_sqlite" ? "info" : "neutral"}>
                      {contactSourceLabel(contact)}
                    </TonePill>
                  </div>
                </div>

                <div className="mt-2 grid gap-1 text-[11px] leading-5 text-slate-400 md:grid-cols-2">
                  <div>Telefone: <span className="text-slate-200">{contact.phone || "-"}</span></div>
                  <div>Cidade: <span className="text-slate-200">{contact.city || "-"}</span></div>
                  <div>Cargo: <span className="text-slate-200">{contact.role || "-"}</span></div>
                  <div>Origem: <span className="text-slate-200">{contactOriginLabel(contact)}</span></div>
                  {contact.notes ? (
                    <div className="md:col-span-2">Observações: <span className="text-slate-200">{contact.notes}</span></div>
                  ) : null}
                </div>

                {isAdmin ? (
                  <details className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                    <summary className="cursor-pointer text-[11px] font-black text-slate-100">
                      Editar contato
                    </summary>
                    <form action={updateAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="partnerId" value={partner.id} />
                      <input type="hidden" name="contactId" value={contact.id} />

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="nds-label">Nome</span>
                          <input name="name" defaultValue={contact.name || ""} />
                        </label>
                        <label className="grid gap-1">
                          <span className="nds-label">Cargo / função</span>
                          <input name="role" defaultValue={contact.role || ""} />
                        </label>
                        <label className="grid gap-1">
                          <span className="nds-label">Telefone / WhatsApp</span>
                          <input name="phone" defaultValue={contact.phone || ""} />
                        </label>
                        <label className="grid gap-1">
                          <span className="nds-label">Cidade base</span>
                          <input name="city" defaultValue={contact.city || ""} />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="nds-label">Observações / cobertura</span>
                          <textarea name="notes" defaultValue={contact.notes || ""} rows={3} />
                        </label>
                      </div>

                      <label className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} />
                        Definir como contato principal
                      </label>

                      <div className="flex justify-end">
                        <button type="submit" className="nds-button" data-variant="primary">
                          Salvar contato
                        </button>
                      </div>
                    </form>
                  </details>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="Nenhum contato operacional"
              description="Cadastre um contato operacional para este parceiro."
            />
          )}
        </div>

        <div className="nds-card">
          <div className="text-[12px] font-black text-slate-50">Novo contato</div>
          <div className="mt-1 text-[11px] leading-5 text-slate-400">
            Adicione contato manual para manter o acionamento atualizado no cadastro.
          </div>

          {isAdmin ? (
            <form action={createAction} className="mt-3 grid gap-2">
              <input type="hidden" name="partnerId" value={partner.id} />

              <label className="grid gap-1">
                <span className="nds-label">Nome</span>
                <input name="name" placeholder="Central, NOC, responsável" />
              </label>
              <label className="grid gap-1">
                <span className="nds-label">Cargo / função</span>
                <input name="role" placeholder="Suporte, NOC, financeiro" />
              </label>
              <label className="grid gap-1">
                <span className="nds-label">Telefone / WhatsApp</span>
                <input name="phone" placeholder="(63) 99999-0000" />
              </label>
              <label className="grid gap-1">
                <span className="nds-label">Cidade base</span>
                <input name="city" placeholder="Araguaína, Palmas..." />
              </label>
              <label className="grid gap-1">
                <span className="nds-label">Observações / cobertura</span>
                <textarea name="notes" rows={3} placeholder="Horário, cidades, canal preferencial..." />
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input type="checkbox" name="isPrimary" defaultChecked={!contacts.length} />
                Contato principal
              </label>

              <button type="submit" className="nds-button" data-variant="primary">
                Adicionar contato
              </button>
            </form>
          ) : (
            <div className="mt-3 text-[11px] leading-5 text-slate-500">
              Apenas administradores podem criar contatos.
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

function PartnerOperationalSummaryBlock({ partner }: { partner: PartnerDetail }) {
  const contacts = partner.operationalContacts || [];
  const importedContacts = contacts.filter((contact) => contact.source === "legacy_sqlite").length;
  const manualContacts = contacts.length - importedContacts;
  const activeUnits = partner.units.filter((unit) => unit.isActive).length;
  const unitsWithAssets = partner.units.filter((unit) => unit._count.equipments > 0).length;
  const cities = Array.from(
    new Set(
      partner.units
        .map((unit) => [unit.city, unit.state].filter(Boolean).join("/"))
        .filter(Boolean),
    ),
  );
  const primary = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;

  return (
    <Surface><SectionIntro
        eyebrow="Dados operacionais"
        title="Cobertura e acionamento"
        description="Resumo calculado a partir dos contatos, unidades e ativos já gravados no banco."
        actions={
          <div className="flex flex-wrap gap-2">
            <TonePill tone={importedContacts ? "success" : "neutral"}>{importedContacts} importado(s)</TonePill>
            <TonePill tone={manualContacts ? "info" : "neutral"}>{manualContacts} manual(is)</TonePill>
          </div>
        }
        compact
      /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><div className="nds-card"><div className="nds-label">
            Contatos
          </div><div className="mt-2 text-[22px] font-semibold leading-none text-slate-50">{contacts.length}</div><div className="mt-1 truncate text-[10px] text-slate-500">
            {primary ? `principal: ${primary.name || primary.role || "contato cadastrado"}` : "sem contato principal"}
          </div></div><div className="nds-card"><div className="nds-label">
            Unidades ativas
          </div><div className="mt-2 text-[22px] font-semibold leading-none text-slate-50">{activeUnits}</div><div className="mt-1 text-[10px] text-slate-500">
            {partner.units.length} unidade(s) vinculada(s)
          </div></div><div className="nds-card"><div className="nds-label">
            Com ativos
          </div><div className="mt-2 text-[22px] font-semibold leading-none text-slate-50">{unitsWithAssets}</div><div className="mt-1 text-[10px] text-slate-500">
            locais com inventário operacional
          </div></div><div className="nds-card"><div className="nds-label">
            Cidades
          </div><div className="mt-2 text-[22px] font-semibold leading-none text-slate-50">{cities.length}</div><div className="mt-1 truncate text-[10px] text-slate-500">
            {cities.slice(0, 4).join(", ") || "sem cidade informada"}
          </div></div></div></Surface>
  );
}

export default async function ParceiroDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/parceiros");
  }

  const resolved = await params;
  const query = await resolveSearchParams(searchParams);
  const created = readStringParam(query, "created");
  const from = readStringParam(query, "from");
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = isAdminRole(role);
  const canEditAttachments = canEditAttachmentsForRole(role);
  const partner = await apiJson<PartnerDetail>(`/partners/${resolved.id}`);
  const totalEquipments = partner.units.reduce((sum, unit) => sum + unit._count.equipments, 0);
  const activeUnits = partner.units.filter((unit) => unit.isActive).length;
  const importedContacts = partner.operationalContacts.filter((contact) => contact.source === "legacy_sqlite").length;

  async function createPartnerContact(formData: FormData): Promise<void> {
    "use server";

    const partnerId = String(formData.get("partnerId") || "");
    const actionSession = await getServerWebSession();

    if (normalizeRole(actionSession.user?.role || "") !== "admin") {
      redirect(`/parceiros/${partnerId}`);
    }

    await apiJson(`/partners/${partnerId}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        city: String(formData.get("city") || ""),
        name: String(formData.get("name") || ""),
        role: String(formData.get("role") || ""),
        phone: String(formData.get("phone") || ""),
        notes: String(formData.get("notes") || ""),
        isPrimary: formData.get("isPrimary") === "on",
      }),
    });

    revalidatePath("/parceiros");
    revalidatePath(`/parceiros/${partnerId}`);
    redirect(`/parceiros/${partnerId}`);
  }

  async function updatePartnerContact(formData: FormData): Promise<void> {
    "use server";

    const partnerId = String(formData.get("partnerId") || "");
    const contactId = String(formData.get("contactId") || "");
    const actionSession = await getServerWebSession();

    if (normalizeRole(actionSession.user?.role || "") !== "admin") {
      redirect(`/parceiros/${partnerId}`);
    }

    await apiJson(`/partners/${partnerId}/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify({
        city: String(formData.get("city") || ""),
        name: String(formData.get("name") || ""),
        role: String(formData.get("role") || ""),
        phone: String(formData.get("phone") || ""),
        notes: String(formData.get("notes") || ""),
        isPrimary: formData.get("isPrimary") === "on",
      }),
    });

    revalidatePath("/parceiros");
    revalidatePath(`/parceiros/${partnerId}`);
    redirect(`/parceiros/${partnerId}`);
  }

  async function updatePartner(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");

      await apiJson(`/partners/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          isActive: formData.get("isActive") === "on",
        }),
      });

      revalidatePath("/parceiros");
      revalidatePath(`/parceiros/${id}`);
      return { status: "success", message: "Parceiro atualizado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function deletePartner(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    const id = String(formData.get("id") || "");

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }
      if (formData.get("confirmDelete") !== "yes") {
        return { status: "error", message: "Confirme a exclusão para continuar." };
      }

      await apiJson(`/partners/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      revalidatePath("/parceiros");
      revalidatePath(`/parceiros/${id}`);
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect("/parceiros?active=true");
  }

  const partnerEditSteps = [
    {
      title: "Identificação",
      description: "Código interno e nome comercial do parceiro.",
      body: (
        <div className="grid gap-2 md:grid-cols-2"><input type="hidden" name="id" value={partner.id} /><div className="grid gap-1.5"><label
              htmlFor="partner-code"
              className="nds-label"
            >
              Código
            </label><input
              id="partner-code"
              name="code"
              defaultValue={partner.code}
              className="uppercase"
            /></div><div className="grid gap-1.5"><label
              htmlFor="partner-name"
              className="nds-label"
            >
              Nome
            </label><input
              id="partner-name"
              name="name"
              defaultValue={partner.name}
            /></div></div>
      ),
    },
    {
      title: "Escopo",
      description: "Unidades e ativos ligados ao parceiro.",
      body: (
        <div className="grid gap-2"><div className="nds-card"><div className="grid gap-2 text-[11px] leading-5 text-slate-400 md:grid-cols-2"><div>
                Unidades vinculadas: <span className="text-slate-200">{partner._count.units}</span></div><div>
                Ativos associados: <span className="text-slate-200">{totalEquipments}</span></div><div>
                Contatos operacionais:{" "}
                <span className="text-slate-200">{partner._count.operationalContacts}</span></div><div>
                Contatos importados:{" "}
                <span className="text-slate-200">{importedContacts}</span></div></div></div><div className="flex flex-wrap gap-2"><Link
              href={`/unidades?partnerId=${partner.id}`}
              className="nds-button"
              data-variant="secondary"
            >
              Ver unidades
            </Link><Link
              href={`/unidades/cadastro?partnerId=${partner.id}`}
              className="nds-button"
              data-variant="primary"
            >
              Cadastrar unidade
            </Link></div></div>
      ),
    },
    {
      title: "Fechamento",
      description: "Status do parceiro e revisão final antes de salvar.",
      body: (
        <div className="grid gap-2"><label className="nds-card flex items-start gap-2 text-[11px] leading-5 text-slate-300"><input
              type="checkbox"
              name="isActive"
              defaultChecked={partner.isActive}
              className="mt-1"
            /><span><span className="block font-medium text-slate-100">Parceiro ativo</span><span className="mt-1 block text-slate-400">
                Mantém o parceiro disponível para novas unidades e leitura operacional.
              </span></span></label></div>
      ),
    },
  ];

  return (
    <NovaLitShell activeHref="/parceiros">
      <div className="nova-partner-detail-lit-page">
      {created ? <CreatedNotice from={from} /> : null}

      <nav className="nova-detail-crumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span>/</span>
        <Link href="/parceiros">Parceiros</Link>
        <span>/</span>
        <strong>{partner.code}</strong>
      </nav>


      <RegistryDetailHero
        eyebrow="Parceiro"
        title={partner.name}
        description={
          <>
            Parceiro vinculado a {partner._count.units} unidade(s), com {totalEquipments} ativo(s)
            cadastrados e dados operacionais de acionamento quando disponíveis.
          </>
        }
        badges={
          <><TonePill tone={partnerStatusTone(partner.isActive)}>
              {partner.isActive ? "ativo" : "inativo"}
            </TonePill><TonePill tone="info">{partner.code}</TonePill>
            {importedContacts ? <TonePill tone="success">dados importados</TonePill> : null}
          </>
        }
        actions={
          <><Link
              href="/parceiros"
              className="nds-button"
              data-variant="secondary"
            >
              Voltar
            </Link>
            {isAdmin ? (
              <Link
                href={`/unidades/cadastro?partnerId=${partner.id}`}
                className="nds-button"
                data-variant="primary"
              >
                Cadastrar unidade
              </Link>
            ) : null}
            {isAdmin ? (
              <EntityEditModal
                triggerLabel="Editar parceiro"
                title="Editar parceiro"
                kicker="Cadastro"
                description="Ajuste identificação, escopo operacional e status do parceiro."
                submitLabel="Salvar parceiro"
                pendingLabel="Salvando..."
                steps={partnerEditSteps}
                action={updatePartner}
              />
            ) : null}
            {isAdmin ? (
              <OperationalDeletePanel
                action={deletePartner}
                entityId={partner.id}
                entityLabel="parceiro"
                entityName={`${partner.code} - ${partner.name}`}
                blockedReason={!partner.isActive ? "Este parceiro já está inativo." : undefined}
              />
            ) : null}
          </>
        }
      /><RegistryMetricGrid
        items={[
          {
            label: "Unidades",
            value: partner._count.units,
            detail: `${activeUnits} ativa(s) no cadastro`,
            tone: activeUnits ? "success" : "neutral",
          },
          {
            label: "Ativos",
            value: totalEquipments,
            detail: "somatório das unidades",
            tone: totalEquipments ? "info" : "neutral",
          },
          {
            label: "Alertas",
            value: partner._count.occurrences,
            detail: "registros vinculados",
            tone: partner._count.occurrences ? "attention" : "neutral",
          },
          {
            label: "Chamados",
            value: partner._count.maintenances,
            detail: "ações vinculadas",
            tone: partner._count.maintenances ? "info" : "neutral",
          },
        ]}
      /><PersistedPartnerContactsBlock
        partner={partner}
        isAdmin={isAdmin}
        createAction={createPartnerContact}
        updateAction={updatePartnerContact}
      /><section className="nova-detail-grid nova-detail-grid--partner"><Surface><SectionIntro
            eyebrow="Visão operacional"
            title="Unidades vinculadas"
            description="Unidades, ativos e casos vinculados."
            actions={<TonePill tone="neutral">{partner.units.length} linhas</TonePill>}
            compact
          /><div className="mt-2">
            {partner.units.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Cidade</th><th className="px-3 py-2">Ativos</th><th className="px-3 py-2">Operação</th><TableActionHeader /></tr></TableHead><tbody>
                    {partner.units.map((unit) => (
                      <tr key={unit.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><TableCell><Link
                            href={`/unidades/${unit.id}`}
                            className="font-medium text-white transition hover:text-white"
                          >
                            {unit.code}
                          </Link><div className="mt-1 max-w-[300px] truncate text-[10px] text-slate-500">
                            {unit.name}
                          </div></TableCell><TableCell className="text-slate-400">
                          {[unit.city, unit.state].filter(Boolean).join("/") || "-"}
                        </TableCell><TableCell><div className="text-[12px] font-medium text-slate-100">{unit._count.equipments}</div><div className="mt-1 text-[10px] text-slate-500">ativo(s)</div></TableCell><TableCell><div className="flex flex-wrap gap-2"><TonePill tone={unit.isActive ? "success" : "subtle"}>
                              {unit.isActive ? "ativa" : "inativa"}
                            </TonePill>
                            {unit._count.occurrences ? (
                              <TonePill tone="attention">{unit._count.occurrences} oc.</TonePill>
                            ) : null}
                            {unit._count.maintenances ? (
                              <TonePill tone="info">{unit._count.maintenances} manut.</TonePill>
                            ) : null}
                          </div></TableCell><TableActionCell><TableActionLink href={`/unidades/${unit.id}`}>
                            Abrir
                          </TableActionLink></TableActionCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhuma unidade vinculada"
                description="Crie uma unidade usando este parceiro para começar a formar a cobertura operacional."
                action={
                  isAdmin ? (
                    <Link
                      href={`/unidades/cadastro?partnerId=${partner.id}`}
                      className="nds-button"
                      data-variant="primary"
                    >
                      Cadastrar unidade
                    </Link>
                  ) : null
                }
              />
            )}
          </div></Surface><div className="nova-page-stack grid gap-2"><Surface><SectionIntro
              eyebrow="Auditoria"
              title="Cadastro e atualização"
              description="Rastro básico do registro atual."
              compact
            /><div className="mt-2"><RegistryInfoGrid
                items={[
                  {
                    label: "Criado em",
                    value: formatDate(partner.createdAt),
                  },
                  {
                    label: "Atualizado em",
                    value: formatDate(partner.updatedAt),
                  },
                  {
                    label: "Cobertura ativa",
                    value: `${activeUnits} unidade(s)`,
                  },
                  {
                    label: "Dados operacionais",
                    value: `${partner._count.operationalContacts} contato(s)`,
                  },
                ]}
              /></div></Surface></div></section><PartnerOperationalSummaryBlock partner={partner} /><AttachmentPanel
        entityPath="partners"
        entityId={partner.id}
        entityLabel="parceiro"
        returnPath={`/parceiros/${partner.id}`}
        canEdit={canEditAttachments}
      /><section className="grid gap-2 xl:grid-cols-2"><Surface><SectionIntro
            eyebrow="Eventos"
            title="Alertas recentes"
            description={`${partner._count.occurrences} alerta(s) vinculados ao parceiro.`}
            compact
          /><div className="mt-2">
            {partner.occurrences.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Caso</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Status</th></tr></TableHead><tbody>
                    {partner.occurrences.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/alertas/${item.id}`} className="font-medium text-white hover:text-white">
                            {item.code}
                          </Link><div className="mt-1 max-w-[280px] truncate text-[10px] text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone={item.severity}>{item.severity}</TonePill></TableCell><TableCell className="text-slate-400">{item.status}</TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum alerta recente"
                description="Incidentes vinculados a este parceiro aparecem aqui."
              />
            )}
          </div></Surface><Surface><SectionIntro
            eyebrow="Rotina"
            title="Chamados recentes"
            description={`${partner._count.maintenances} chamado(ões) vinculados ao parceiro.`}
            compact
          /><div className="mt-2">
            {partner.maintenances.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Chamado</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th></tr></TableHead><tbody>
                    {partner.maintenances.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/chamados/${item.id}`} className="font-medium text-white hover:text-white">
                            {item.code}
                          </Link><div className="mt-1 max-w-[280px] truncate text-[10px] text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell className="text-slate-400">{item.type}</TableCell><TableCell className="text-slate-400">{item.status}</TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum chamado recente"
                description="Ações vinculadas a este parceiro aparecem aqui."
              />
            )}
          </div></Surface></section>      </div>
    </NovaLitShell>
  );
}
