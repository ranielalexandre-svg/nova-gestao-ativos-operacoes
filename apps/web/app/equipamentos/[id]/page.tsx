import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import { EntityEditModal } from "@/components/entity-edit-modal";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
import { StarlinkSecretActions } from "@/components/starlinks/starlink-secret-actions";
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
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDate } from "@/lib/formatters";
import {
  equipmentStatusLabel as statusLabel,
  equipmentStatusTone as statusTone,
} from "@/lib/status-ui";
import {
  formatMs,
  formatPercent,
  formatTemperature,
  healthLabel,
  healthTone,
  readUnitHostTelemetry,
} from "@/lib/noc-overview";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type EquipmentDetail = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partner: {
      id: string;
      code: string;
      name: string;
    };
  };
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
    occurrences: number;
    maintenances: number;
  };
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  partner: { id: string; code: string; name: string };
};


type StarlinkOperationalItem = {
  id: string;
  equipmentId: string;
  source: string;
  legacyId: string;
  antennaId: string | null;
  localName: string | null;
  kitSerial: string | null;
  antennaSerial: string | null;
  ipvpn: string | null;
  plan: string | null;
  installer: string | null;
  installedAt: string | null;
  notes: string | null;
  hasEmail: boolean;
  hasPassword: boolean;
  hasCard: boolean;
  email: string | null;
  password: string | null;
  card: string | null;
  revealed: boolean;
  createdAt: string;
  updatedAt: string;
};

type StarlinkOperationalResponse = {
  revealSecrets: boolean;
  total: number;
  items: StarlinkOperationalItem[];
};

function locationLabel(equipment: EquipmentDetail) {
  return [equipment.unit.city, equipment.unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function isStarlinkEquipment(equipment: EquipmentDetail) {
  const text = [equipment.tag, equipment.name, equipment.type, equipment.serialNumber].join(" ").toLowerCase();
  return text.includes("starlink");
}

function CreatedNotice({ from }: { from: string }) {
  return (
    <Surface><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><div className="text-[12px] font-black text-slate-50">
            Ativo criado com sucesso
          </div><div className="mt-1 text-[11px] leading-5 text-slate-400">
            Origem: {from === "wizard" ? "cadastro guiado" : "cadastro direto"}.
            Revise serial, vínculo com a unidade e leitura de monitoramento herdada.
          </div></div><div className="flex flex-wrap gap-2"><Link
            href="/ativos/nova"
            className="nds-button"
            data-variant="primary"
          >
            Criar outro
          </Link><Link
            href="/ativos"
            className="nds-button"
            data-variant="secondary"
          >
            Voltar para lista
          </Link></div></div></Surface>
  );
}

async function readMonitorSnapshots() {
  return readUnitHostTelemetry({ timeoutMs: 1_500, fast: true });
}

function StarlinkOperationalBlock({
  equipment,
  data,
  isAdmin,
  reveal,
  action,
}: {
  equipment: EquipmentDetail;
  data: StarlinkOperationalResponse | null;
  isAdmin: boolean;
  reveal: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  if (!data || !data.items.length) return null;

  const totalSecrets = data.items.reduce(
    (sum, item) => sum + [item.hasEmail, item.hasPassword, item.hasCard].filter(Boolean).length,
    0,
  );

  return (
    <Surface>
      <SectionIntro
        eyebrow="Starlink"
        title="Dados operacionais persistidos"
        description="E-mail, senha, cartão, serial, IP VPN, plano e instalação persistidos no banco. Segredos ficam mascarados por padrão."
        actions={
          <div className="flex flex-wrap gap-2">
            <TonePill tone="success">{data.total} registro(s)</TonePill>
            <TonePill tone={totalSecrets ? "attention" : "subtle"}>{totalSecrets} segredo(s)</TonePill>
            {isAdmin ? (
              <Link
                href={reveal ? `/ativos/${equipment.id}` : `/ativos/${equipment.id}?starlinkReveal=1`}
                className="nds-button"
                data-variant="secondary"
              >
                {reveal ? "Ocultar segredos" : "Revelar segredos"}
              </Link>
            ) : null}
          </div>
        }
        compact
      />

      <div className="mt-2 grid gap-2">
        {data.items.map((item) => (
          <div key={item.id} className="nds-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-black text-slate-50">
                  {item.antennaId ? `Antena ${item.antennaId}` : item.kitSerial || "Starlink operacional"}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {item.source} · {item.legacyId}
                </div>
              </div>
              <TonePill tone={item.revealed ? "attention" : "info"}>
                {item.revealed ? "revelado" : "mascarado"}
              </TonePill>
            </div>

            <div className="mt-2 grid gap-2 text-[11px] leading-5 text-slate-400 md:grid-cols-2">
              <div>Localidade: <span className="text-slate-200">{item.localName || "-"}</span></div>
              <div>Plano: <span className="text-slate-200">{item.plan || "-"}</span></div>
              <div>IP VPN: <span className="text-slate-200">{item.ipvpn || "-"}</span></div>
              <div>Instalador: <span className="text-slate-200">{item.installer || "-"}</span></div>
              <div>Instalado em: <span className="text-slate-200">{item.installedAt || "-"}</span></div>
              <div>Cartão: <span className="text-slate-200">{item.revealed ? item.card || "-" : item.hasCard ? "••••••••" : "-"}</span></div>
              <div className="md:col-span-2">Kit serial: <span className="break-all text-slate-200">{item.kitSerial || "-"}</span></div>
              <div className="md:col-span-2">Antena serial: <span className="break-all text-slate-200">{item.antennaSerial || "-"}</span></div>
              <div>E-mail: <span className="break-all text-slate-200">{item.revealed ? item.email || "-" : item.hasEmail ? "••••••••" : "-"}</span></div>
              <div>Senha: <span className="break-all text-slate-200">{item.revealed ? item.password || "-" : item.hasPassword ? "••••••••" : "-"}</span></div>
              {item.notes ? <div className="md:col-span-2">Notas: <span className="text-slate-200">{item.notes}</span></div> : null}
            </div>

            <StarlinkSecretActions
              email={item.email}
              password={item.password}
              card={item.card}
              revealed={item.revealed}
            />

            {isAdmin ? (
              <details className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                <summary className="cursor-pointer text-[11px] font-black text-slate-100">
                  Editar dados Starlink operacionals
                </summary>
                <form action={action} className="mt-3 grid gap-2">
                  <input type="hidden" name="equipmentId" value={equipment.id} />
                  <input type="hidden" name="infoId" value={item.id} />
                  <input type="hidden" name="keepReveal" value={reveal ? "1" : "0"} />

                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="nds-label">Localidade</span>
                      <input name="localName" defaultValue={item.localName || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Plano</span>
                      <input name="plan" defaultValue={item.plan || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">IP VPN</span>
                      <input name="ipvpn" defaultValue={item.ipvpn || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Instalador</span>
                      <input name="installer" defaultValue={item.installer || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Instalado em</span>
                      <input name="installedAt" defaultValue={item.installedAt || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Antena ID</span>
                      <input name="antennaId" defaultValue={item.antennaId || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Kit serial</span>
                      <input name="kitSerial" defaultValue={item.kitSerial || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Antena serial</span>
                      <input name="antennaSerial" defaultValue={item.antennaSerial || ""} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">E-mail</span>
                      <input name="email" placeholder={item.hasEmail ? "preencha para substituir" : "novo e-mail"} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Senha</span>
                      <input name="password" placeholder={item.hasPassword ? "preencha para substituir" : "nova senha"} />
                    </label>
                    <label className="grid gap-1">
                      <span className="nds-label">Cartão</span>
                      <input name="card" placeholder={item.hasCard ? "preencha para substituir" : "novo cartão"} />
                    </label>
                    <label className="grid gap-1 md:col-span-2">
                      <span className="nds-label">Notas</span>
                      <textarea name="notes" defaultValue={item.notes || ""} rows={3} />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className="nds-button" data-variant="primary">
                      Salvar dados Starlink
                    </button>
                  </div>
                </form>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </Surface>
  );
}


export default async function AtivoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ativos");
  }

  const resolved = await params;
  const query = await resolveSearchParams(searchParams);
  const created = readStringParam(query, "created");
  const from = readStringParam(query, "from");
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = isAdminRole(role);
  const canEditAttachments = canEditAttachmentsForRole(role);
  const starlinkReveal = isAdmin && readStringParam(query, "starlinkReveal", "") === "1";
  const [equipment, monitorResponse, unitsResponse] = await Promise.all([
    apiJson<EquipmentDetail>(`/equipments/${resolved.id}`),
    readMonitorSnapshots(),
    apiJson<PaginatedResponse<UnitOption>>(
      "/units?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
  ]);
  const starlinkOperationalData = isStarlinkEquipment(equipment)
    ? await apiJson<StarlinkOperationalResponse>(
        `/starlinks/${equipment.id}/legacy-data${starlinkReveal ? "/reveal" : ""}`,
      ).catch(() => null)
    : null;
  const monitor = monitorResponse.items.find((item) => item.unit.id === equipment.unit.id);

  async function updateEquipment(
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

      await apiJson(`/equipments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tag: String(formData.get("tag") || ""),
          name: String(formData.get("name") || ""),
          type: String(formData.get("type") || ""),
          serialNumber: String(formData.get("serialNumber") || ""),
          status: String(formData.get("status") || "active"),
          unitId: String(formData.get("unitId") || ""),
          isActive: formData.get("isActive") === "on",
        }),
      });

      revalidatePath("/ativos");
      revalidatePath(`/ativos/${id}`);
      revalidatePath(`/unidades/${String(formData.get("unitId") || "")}`);
      return { status: "success", message: "Ativo atualizado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function updateStarlinkLegacyData(formData: FormData): Promise<void> {
    "use server";

    const equipmentId = String(formData.get("equipmentId") || "");
    const infoId = String(formData.get("infoId") || "");
    const keepReveal = formData.get("keepReveal") === "1";

    const actionSession = await getServerWebSession();
    if (normalizeRole(actionSession.user?.role || "") !== "admin") {
      redirect(`/ativos/${equipmentId}`);
    }

    await apiJson(`/starlinks/${equipmentId}/legacy-data/${infoId}`, {
      method: "PATCH",
      body: JSON.stringify({
        antennaId: String(formData.get("antennaId") || ""),
        localName: String(formData.get("localName") || ""),
        kitSerial: String(formData.get("kitSerial") || ""),
        antennaSerial: String(formData.get("antennaSerial") || ""),
        ipvpn: String(formData.get("ipvpn") || ""),
        plan: String(formData.get("plan") || ""),
        installer: String(formData.get("installer") || ""),
        installedAt: String(formData.get("installedAt") || ""),
        notes: String(formData.get("notes") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        card: String(formData.get("card") || ""),
      }),
    });

    revalidatePath("/ativos/starlinks");
    revalidatePath(`/ativos/${equipmentId}`);
    redirect(`/ativos/${equipmentId}${keepReveal ? "?starlinkReveal=1" : ""}`);
  }

  async function deleteEquipment(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    const id = String(formData.get("id") || "");
    const unitId = String(formData.get("unitId") || "");

    try {
      const actionSession = await getServerWebSession();
      if (normalizeRole(actionSession.user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }
      if (formData.get("confirmDelete") !== "yes") {
        return { status: "error", message: "Confirme a exclusão para continuar." };
      }

      await apiJson(`/equipments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false, status: "retired" }),
      });

      revalidatePath("/ativos");
      revalidatePath(`/ativos/${id}`);
      revalidatePath("/sensores");
      revalidatePath("/relatorios/monitoramento");
      if (unitId) revalidatePath(`/unidades/${unitId}`);
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect("/ativos?active=true");
  }

  const equipmentEditSteps = [
    {
      title: "Inventário",
      description: "Tag, nome operacional e tipo do ativo.",
      body: (
        <div className="grid gap-2 md:grid-cols-2"><input type="hidden" name="id" value={equipment.id} /><div className="grid gap-1.5"><label
              htmlFor="equipment-tag"
              className="nds-label"
            >
              Tag
            </label><input
              id="equipment-tag"
              name="tag"
              defaultValue={equipment.tag}
              className="uppercase"
            /></div><div className="grid gap-1.5"><label
              htmlFor="equipment-name"
              className="nds-label"
            >
              Nome
            </label><input
              id="equipment-name"
              name="name"
              defaultValue={equipment.name}
            /></div><div className="grid gap-1.5 md:col-span-2"><label
              htmlFor="equipment-type"
              className="nds-label"
            >
              Tipo
            </label><input
              id="equipment-type"
              name="type"
              defaultValue={equipment.type}
            /></div></div>
      ),
    },
    {
      title: "Rede",
      description: "Identificador técnico e situação do ativo.",
      body: (
        <div className="grid gap-2 md:grid-cols-2"><div className="grid gap-1.5"><label
              htmlFor="equipment-serial"
              className="nds-label"
            >
              Serial / MAC
            </label><input
              id="equipment-serial"
              name="serialNumber"
              defaultValue={equipment.serialNumber || ""}
            /></div><div className="grid gap-1.5"><label
              htmlFor="equipment-status"
              className="nds-label"
            >
              Status
            </label><select
              id="equipment-status"
              name="status"
              defaultValue={equipment.status}
            ><option value="active">Ativo</option><option value="stock">Estoque</option><option value="repair">Reparo</option><option value="retired">Retirado</option></select></div></div>
      ),
    },
    {
      title: "Vínculos",
      description: "Unidade atendida e contexto operacional ligado ao ativo.",
      body: (
        <div className="grid gap-2"><div className="grid gap-1.5"><label
              htmlFor="equipment-unit"
              className="nds-label"
            >
              Unidade
            </label><select
              id="equipment-unit"
              name="unitId"
              defaultValue={equipment.unit.id}
            >
              {unitsResponse.items.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name}
                </option>
              ))}
            </select></div><div className="nds-card"><div className="text-[12px] font-black text-slate-100">Vínculo atual</div><div className="mt-2 grid gap-2 text-[11px] leading-5 text-slate-400 md:grid-cols-2"><div>
                Unidade: <span className="text-slate-200">{equipment.unit.code}</span></div><div>
                Parceiro: <span className="text-slate-200">{equipment.unit.partner.name}</span></div><div>
                Localização: <span className="text-slate-200">{locationLabel(equipment)}</span></div><div>
                Saúde monitorada:{" "}
                <span className="text-slate-200">
                  {monitor ? healthLabel(monitor.health) : "sem leitura"}
                </span></div></div></div></div>
      ),
    },
    {
      title: "Fechamento",
      description: "Status final do cadastro antes de persistir as mudanças.",
      body: (
        <div className="grid gap-2"><label className="nds-card flex items-start gap-2 text-[11px] leading-5 text-slate-300"><input
              type="checkbox"
              name="isActive"
              defaultChecked={equipment.isActive}
              className="mt-1"
            /><span><span className="block font-medium text-slate-100">Ativo operacional</span><span className="mt-1 block text-slate-400">
                Mantém o ativo disponível para operação, alertas e monitoramento.
              </span></span></label></div>
      ),
    },
  ];

  return (
    <NovaLitShell activeHref="/ativos">
      <div className="nova-equipment-detail-lit-page">
      {created ? <CreatedNotice from={from} /> : null}

      <RegistryDetailHero
        eyebrow="Ativo"
        title={equipment.tag}
        description={`${equipment.name} · ${equipment.type} · ${equipment.unit.code} · ${equipment.unit.partner.name}`}
        badges={
          <><TonePill tone={statusTone(equipment.status, equipment.isActive)}>
              {statusLabel(equipment.status)}
            </TonePill>
            {!equipment.isActive ? <TonePill tone="subtle">inativo</TonePill> : null}
            {monitor ? (
              <TonePill tone={healthTone(monitor.health)}>{healthLabel(monitor.health)}</TonePill>
            ) : null}
          </>
        }
        actions={
          <><Link
              href="/ativos"
              className="nds-button"
              data-variant="secondary"
            >
              Voltar
            </Link><Link
              href={`/unidades/${equipment.unit.id}`}
              className="nds-button"
              data-variant="secondary"
            >
              Abrir unidade
            </Link>
            {isAdmin ? (
              <EntityEditModal
                triggerLabel="Editar ativo"
                title="Editar ativo"
                kicker="Cadastro"
                description="Ajuste tag, tipo, serial, unidade e status do ativo."
                submitLabel="Salvar ativo"
                pendingLabel="Salvando..."
                steps={equipmentEditSteps}
                action={updateEquipment}
              />
            ) : null}
            {isAdmin ? (
              <OperationalDeletePanel
                action={deleteEquipment}
                entityId={equipment.id}
                entityLabel="ativo"
                entityName={`${equipment.tag} - ${equipment.name}`}
                blockedReason={!equipment.isActive ? "Este ativo já está inativo." : undefined}
              ><input type="hidden" name="unitId" value={equipment.unit.id} /></OperationalDeletePanel>
            ) : null}
          </>
        }
      /><RegistryMetricGrid
        items={[
          {
            label: "Unidade",
            value: equipment.unit.code,
            detail: equipment.unit.name,
            tone: "info",
          },
          {
            label: "Parceiro",
            value: equipment.unit.partner.code,
            detail: equipment.unit.partner.name,
          },
          {
            label: "Alertas",
            value: equipment._count.occurrences,
            detail: "ligadas ao ativo",
            tone: equipment._count.occurrences ? "attention" : "neutral",
          },
          {
            label: "Chamados",
            value: equipment._count.maintenances,
            detail: "planejadas ou executadas",
            tone: equipment._count.maintenances ? "info" : "neutral",
          },
        ]}
      /><section className="nova-side-grid nova-side-grid--420"><Surface><SectionIntro
            eyebrow="Cadastro"
            title="Identificação técnica"
            description="Dados mínimos do ativo e seu vínculo com a unidade atendida."
            compact
          /><div className="mt-2"><RegistryInfoGrid
              items={[
                {
                  label: "Serial / MAC",
                  value: equipment.serialNumber || "-",
                  breakWords: true,
                },
                {
                  label: "Localização",
                  value: locationLabel(equipment),
                },
                {
                  label: "Cadastro",
                  value: formatDate(equipment.createdAt),
                },
                {
                  label: "Atualização",
                  value: formatDate(equipment.updatedAt),
                },
              ]}
            /></div></Surface><Surface><SectionIntro
            eyebrow="Monitoramento"
            title="Leitura herdada da unidade"
            description="O host Zabbix é vinculado à unidade; o ativo aparece como contexto do atendimento."
            compact
          />

          {monitor ? (
            <div className="mt-2 grid gap-2"><div className="nds-card"><div className="flex flex-wrap items-center gap-2"><TonePill tone={healthTone(monitor.health)}>{healthLabel(monitor.health)}</TonePill>
                  {monitor.match.syncReady ? <TonePill tone="success">sync</TonePill> : null}
                </div><div className="mt-2 truncate text-[12px] font-medium text-slate-100">
                  {monitor.match.hostName || monitor.match.host || "Sem host confiável"}
                </div><div className="mt-1 text-[10px] text-slate-500">
                  confiança {Math.round(monitor.match.confidence * 100)}%
                </div></div><div className="grid grid-cols-2 gap-2"><div className="nds-card"><div className="text-[10px] text-slate-500">Latência</div><div className="mt-2 text-[16px] font-semibold text-slate-50">
                    {formatMs(monitor.metrics.latencyMs)}
                  </div></div><div className="nds-card"><div className="text-[10px] text-slate-500">Perda</div><div className="mt-2 text-[16px] font-semibold text-slate-50">
                    {formatPercent(monitor.metrics.lossPct)}
                  </div></div><div className="nds-card"><div className="text-[10px] text-slate-500">Temperatura</div><div className="mt-2 text-[16px] font-semibold text-slate-50">
                    {formatTemperature(monitor.metrics.temperatureC)}
                  </div></div><div className="nds-card"><div className="text-[10px] text-slate-500">Problemas</div><div className="mt-2 text-[16px] font-semibold text-slate-50">
                    {monitor.problems.length}
                  </div></div></div></div>
          ) : (
            <EmptyState
              title="Sem leitura de host"
              description="Quando a unidade estiver vinculada a um host Zabbix, o resumo do ativo mostra a telemetria aqui."
            />
          )}
        </Surface></section><Surface>
          <SectionIntro
            eyebrow="Dados operacionais"
            title="Sem dados persistidos para este ativo"
            description="Nenhum dado operacional persistido foi encontrado para este ativo. Para Starlinks, use a importação operacional e o bloco Starlink persistido."
            compact
          />
        </Surface><StarlinkOperationalBlock
        equipment={equipment}
        data={starlinkOperationalData}
        isAdmin={isAdmin}
        reveal={starlinkReveal}
        action={updateStarlinkLegacyData}
      /><AttachmentPanel
        entityPath="equipments"
        entityId={equipment.id}
        entityLabel="ativo"
        returnPath={`/ativos/${equipment.id}`}
        canEdit={canEditAttachments}
      /><section className="grid gap-2 xl:grid-cols-2"><Surface><SectionIntro
            eyebrow="Eventos"
            title="Alertas recentes"
            description={`${equipment._count.occurrences} alerta(s) vinculados ao ativo.`}
            compact
          /><div className="mt-2">
            {equipment.occurrences.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Caso</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Criado</th></tr></TableHead><tbody>
                    {equipment.occurrences.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/alertas/${item.id}`} className="font-medium text-white hover:text-white">
                            {item.code}
                          </Link><div className="mt-1 max-w-[280px] truncate text-[10px] text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell><TonePill tone={item.severity}>{item.severity}</TonePill></TableCell><TableCell className="text-slate-400">{item.status}</TableCell><TableCell className="text-slate-400">{formatDate(item.createdAt)}</TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum alerta recente"
                description="Incidentes vinculados a este ativo aparecem aqui."
              />
            )}
          </div></Surface><Surface><SectionIntro
            eyebrow="Rotina"
            title="Chamados recentes"
            description={`${equipment._count.maintenances} chamado(s) vinculados ao ativo.`}
            compact
          /><div className="mt-2">
            {equipment.maintenances.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Chamado</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Agenda</th></tr></TableHead><tbody>
                    {equipment.maintenances.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0"><TableCell><Link href={`/chamados/${item.id}`} className="font-medium text-white hover:text-white">
                            {item.code}
                          </Link><div className="mt-1 max-w-[280px] truncate text-[10px] text-slate-500">
                            {item.title}
                          </div></TableCell><TableCell className="text-slate-400">{item.type}</TableCell><TableCell className="text-slate-400">{item.status}</TableCell><TableCell className="text-slate-400">{formatDate(item.scheduledAt)}</TableCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : (
              <EmptyState
                title="Nenhum chamado recente"
                description="Ações preventivas ou corretivas vinculadas a este ativo aparecem aqui."
              />
            )}
          </div></Surface></section>      </div>
    </NovaLitShell>
  );
}
