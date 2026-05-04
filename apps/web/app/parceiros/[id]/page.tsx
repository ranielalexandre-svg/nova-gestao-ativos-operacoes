import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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
import { getLegacyPartnerProfileForPartner } from "@/lib/legacy-catalog";
import { apiJson } from "@/lib/server-api";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDate } from "@/lib/formatters";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PartnerDetail = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  };
};

type LegacyPartnerContact = {
  legacyId: string;
  city: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
};

type LegacyUnitSummary = {
  key: string;
  code: string;
  name: string;
  group: string;
  city: string;
  state: string;
  partnerCode: string;
  phones: string[];
  contracts: string[];
  notes: string[];
};

type LegacyPartnerProfile = {
  sourceAvailable: boolean;
  message?: string;
  generatedAt?: string;
  redactedSecrets?: boolean;
  partner: {
    code: string;
    name: string;
    primaryUnitCount: number;
    backupUnitCount: number;
  } | null;
  contacts: LegacyPartnerContact[];
  units: LegacyUnitSummary[];
};

function partnerStatusTone(isActive: boolean) {
  return isActive ? "success" : "subtle";
}

function CreatedNotice({ from }: { from: string }) {
  return (
    <Surface><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><div className="text-[12px] font-black text-slate-50">
            Parceiro criado com sucesso
          </div><div className="mt-1 text-[11px] leading-5 text-slate-400">
            Origem: {from === "wizard" ? "cadastro guiado" : "cadastro direto"}.
            Revise o vínculo das unidades e a cobertura importada.
          </div></div><div className="flex flex-wrap gap-2"><Link
            href="/parceiros/nova"
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

function LegacyPartnerBlock({ profile }: { profile: LegacyPartnerProfile | null }) {
  if (!profile) return null;

  if (!profile.sourceAvailable) {
    return (
      <Surface><SectionIntro
          eyebrow="Legado"
          title="Base legada pronta para conectar"
          description={
            profile.message ||
            "Gere o arquivo legado para exibir contatos, cidades atendidas e cobertura histórica deste parceiro."
          }
          compact
        /></Surface>
    );
  }

  const hasLegacy = Boolean(profile.partner || profile.contacts.length || profile.units.length);
  if (!hasLegacy) return null;

  return (
    <Surface><SectionIntro
        eyebrow="Legado operacional"
        title="Contatos e cobertura importada"
        description="Contexto lido dos bancos antigos para orientar acionamento sem gravar campos novos no Prisma."
        actions={profile.redactedSecrets ? <TonePill tone="attention">segredos ocultos</TonePill> : null}
        compact
      /><div className="mt-2 nova-side-grid nova-side-grid--360"><div>
          {profile.units.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade legada</th><th className="px-3 py-2">Cidade</th><th className="px-3 py-2">Contratos</th><th className="px-3 py-2">Contato</th></tr></TableHead><tbody>
                  {profile.units.slice(0, 12).map((unit) => (
                    <tr key={unit.key} className="border-b border-white/6 last:border-b-0"><TableCell><div className="font-medium text-slate-100">{unit.code || unit.name}</div><div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">
                          {unit.group || unit.name}
                        </div></TableCell><TableCell className="text-slate-400">
                        {[unit.city, unit.state].filter(Boolean).join("/") || "-"}
                      </TableCell><TableCell className="text-slate-400">
                        {unit.contracts.slice(0, 2).join(", ") || "-"}
                      </TableCell><TableCell className="text-slate-400">
                        {unit.phones.slice(0, 2).join(" · ") || "-"}
                      </TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Sem unidade legada vinculada"
              description="Cobertura por código e nome."
            />
          )}
        </div><div className="grid gap-2"><div className="nds-card"><div className="nds-label">
              Cobertura legada
            </div><div className="mt-2 grid grid-cols-2 gap-2"><div><div className="text-[22px] font-semibold leading-none text-slate-50">
                  {profile.partner?.primaryUnitCount ?? profile.units.length}
                </div><div className="mt-1 text-[10px] text-slate-500">principal</div></div><div><div className="text-[22px] font-semibold leading-none text-slate-50">
                  {profile.partner?.backupUnitCount ?? 0}
                </div><div className="mt-1 text-[10px] text-slate-500">backup</div></div></div></div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">Contatos de acionamento</div><div className="mt-2 grid gap-2">
              {profile.contacts.length ? (
                profile.contacts.slice(0, 6).map((contact) => (
                  <div
                    key={contact.legacyId}
                    className="nova-micro-card"
                  ><div className="text-[12px] font-medium text-slate-100">
                      {contact.name || "Contato"}
                    </div><div className="mt-1 text-[10px] text-slate-500">
                      {[contact.role, contact.city].filter(Boolean).join(" · ") || "Sem cargo/cidade"}
                    </div><div className="mt-1 text-[11px] text-slate-300">{contact.phone || "-"}</div></div>
                ))
              ) : (
                <div className="text-[11px] leading-5 text-slate-500">
                  Nenhum contato legado encontrado para este parceiro.
                </div>
              )}
            </div></div></div></div></Surface>
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
  const legacyProfile = (await getLegacyPartnerProfileForPartner(partner)) satisfies LegacyPartnerProfile | null;
  const totalEquipments = partner.units.reduce((sum, unit) => sum + unit._count.equipments, 0);
  const activeUnits = partner.units.filter((unit) => unit.isActive).length;

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
                Base legada:{" "}
                <span className="text-slate-200">
                  {legacyProfile?.partner ? "conectada" : "sem associação"}
                </span></div><div>
                Contatos legados:{" "}
                <span className="text-slate-200">{legacyProfile?.contacts.length || 0}</span></div></div></div><div className="flex flex-wrap gap-2"><Link
              href={`/unidades?partnerId=${partner.id}`}
              className="nds-button"
              data-variant="secondary"
            >
              Ver unidades
            </Link><Link
              href={`/unidades/nova?partnerId=${partner.id}`}
              className="nds-button"
              data-variant="primary"
            >
              Nova unidade
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
    <AppShell
      title="Detalhes do parceiro"
      subtitle="Ficha operacional com unidades atendidas, contatos legados e edição controlada."
      hidePageHeader
    >
      {created ? <CreatedNotice from={from} /> : null}

      <RegistryDetailHero
        eyebrow="Parceiro"
        title={partner.name}
        description={
          <>
            Parceiro vinculado a {partner._count.units} unidade(s), com {totalEquipments} ativo(s)
            cadastrados e contexto legado para acionamento quando disponível.
          </>
        }
        badges={
          <><TonePill tone={partnerStatusTone(partner.isActive)}>
              {partner.isActive ? "ativo" : "inativo"}
            </TonePill><TonePill tone="info">{partner.code}</TonePill>
            {legacyProfile?.partner ? <TonePill tone="success">legado</TonePill> : null}
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
                href={`/unidades/nova?partnerId=${partner.id}`}
                className="nds-button"
                data-variant="primary"
              >
                Nova unidade
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
                      href={`/unidades/nova?partnerId=${partner.id}`}
                      className="nds-button"
                      data-variant="primary"
                    >
                      Nova unidade
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
                    label: "Leitura legada",
                    value: legacyProfile?.partner ? "Conectada" : "Sem base associada",
                  },
                ]}
              /></div></Surface></div></section><LegacyPartnerBlock profile={legacyProfile} /><AttachmentPanel
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
          </div></Surface></section></AppShell>
  );
}
