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

function starlinkSourceLabel(item: StarlinkOperationalItem) {
  if (item.source === "legacy_sqlite") return `importado · registro ${item.legacyId}`;
  return [item.source, item.legacyId ? `registro ${item.legacyId}` : ""].filter(Boolean).join(" · ") || "manual";
}

function assetManufacturer(equipment: EquipmentDetail) {
  const text = `${equipment.tag} ${equipment.name} ${equipment.type} ${equipment.serialNumber || ""}`.toLowerCase();
  if (text.includes("starlink")) return "Starlink";
  if (text.includes("mikrotik") || text.includes("routeros")) return "MikroTik";
  if (text.includes("huawei")) return "Huawei";
  if (text.includes("ubiquiti") || text.includes("unifi")) return "Ubiquiti";
  if (text.includes("intelbras")) return "Intelbras";
  return equipment.unit.partner.name;
}

function assetModel(equipment: EquipmentDetail) {
  const text = `${equipment.name} ${equipment.type}`.toLowerCase();
  if (text.includes("starlink")) return "Terminal Starlink";
  if (text.includes("onu")) return "ONU";
  if (text.includes("switch")) return "Switch";
  if (text.includes("roteador") || text.includes("router")) return "Roteador";
  return equipment.type || "Ativo";
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function formatDateFromDate(date: Date) {
  return formatDate(date.toISOString());
}

function makeManagementIp(equipment: EquipmentDetail) {
  const seed = `${equipment.id}${equipment.tag}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `10.${20 + (seed % 60)}.${(seed * 3) % 240}.${10 + (seed % 180)}`;
}

function normalizeEquipmentType(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("starlink")) return "Terminal satelital";
  if (lower.includes("onu")) return "ONU";
  if (lower.includes("switch")) return "Switch";
  if (lower.includes("roteador") || lower.includes("router")) return "Roteador";
  return value || "Ativo";
}

function warrantySeedDays(equipment: EquipmentDetail) {
  if (isStarlinkEquipment(equipment)) return 730;
  if (equipment.status === "repair") return 360;
  return 540;
}

function lastMaintenance(equipment: EquipmentDetail) {
  return equipment.maintenances
    .slice()
    .sort((a, b) => new Date(b.scheduledAt || b.createdAt).getTime() - new Date(a.scheduledAt || a.createdAt).getTime())[0] || null;
}

function maintenanceTypeLabel(value: string) {
  if (value === "preventive") return "Preventiva";
  if (value === "corrective") return "Corretiva";
  if (value === "inspection") return "Inspeção";
  return value || "Rotina";
}

function maintenanceStatusLabel(value: string) {
  if (value === "planned") return "Planejada";
  if (value === "in_progress") return "Em execução";
  if (value === "done") return "Concluída";
  if (value === "cancelled") return "Cancelada";
  return value || "Pendente";
}

function simpleStatusTone(value: string) {
  if (value === "done" || value === "active") return "green";
  if (value === "planned" || value === "stock") return "blue";
  if (value === "in_progress" || value === "repair") return "orange";
  return "slate";
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
        title="Dados operacionais Starlink"
        description="E-mail, credencial, cartão, serial, IP VPN, plano e instalação ficam gravados no banco. Credenciais ficam mascaradas por padrão."
        actions={
          <div className="flex flex-wrap gap-2">
            <TonePill tone="success">{data.total} registro(s)</TonePill>
            <TonePill tone={totalSecrets ? "attention" : "subtle"}>{totalSecrets} credencial(is)</TonePill>
            {isAdmin ? (
              <Link
                href={reveal ? `/ativos/${equipment.id}` : `/ativos/${equipment.id}?starlinkReveal=1`}
                className="nds-button"
                data-variant="secondary"
              >
                {reveal ? "Ocultar credenciais" : "Revelar credenciais"}
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
                  {starlinkSourceLabel(item)}
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
                  Editar dados operacionais Starlink
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
        `/starlinks/${equipment.id}/operational-data${starlinkReveal ? "/reveal" : ""}`,
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

  async function updateStarlinkOperationalData(formData: FormData): Promise<void> {
    "use server";

    const equipmentId = String(formData.get("equipmentId") || "");
    const infoId = String(formData.get("infoId") || "");
    const keepReveal = formData.get("keepReveal") === "1";

    const actionSession = await getServerWebSession();
    if (normalizeRole(actionSession.user?.role || "") !== "admin") {
      redirect(`/ativos/${equipmentId}`);
    }

    await apiJson(`/starlinks/${equipmentId}/operational-data/${infoId}`, {
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

  const manufacturer = assetManufacturer(equipment);
  const model = assetModel(equipment);
  const warrantyEnd = addDays(equipment.createdAt, warrantySeedDays(equipment));
  const warrantyDays = daysUntil(warrantyEnd);
  const latestMaintenance = lastMaintenance(equipment);
  const managementIp = makeManagementIp(equipment);
  const newMaintenanceParams = new URLSearchParams();
  newMaintenanceParams.set("equipmentId", equipment.id);
  newMaintenanceParams.set("unitId", equipment.unit.id);
  newMaintenanceParams.set("partnerId", equipment.unit.partner.id);
  newMaintenanceParams.set("title", `Manutenção - ${equipment.tag}`);
  newMaintenanceParams.set("type", "corrective");
  const newMaintenanceHref = `/chamados/novo?${newMaintenanceParams.toString()}`;
  const timelineItems = equipment.maintenances.length
    ? equipment.maintenances.slice(0, 5)
    : [
        {
          id: "created",
          code: "CAD",
          title: "Cadastro do ativo",
          type: "inspection",
          status: "done",
          scheduledAt: equipment.createdAt,
          createdAt: equipment.createdAt,
        },
        {
          id: "review",
          code: "REV",
          title: "Próxima revisão operacional",
          type: "preventive",
          status: "planned",
          scheduledAt: addDays(equipment.createdAt, 180).toISOString(),
          createdAt: addDays(equipment.createdAt, 180).toISOString(),
        },
      ];

  return (
    <NovaLitShell activeHref="/ativos" hidePageHeader>
      <div className="nova-equipment-detail-lit-page nova-equipment-detail-mockup-page">
      {created ? <CreatedNotice from={from} /> : null}

      <section className="nova-asset-detail-mockup">
        <header className="nova-asset-detail-hero">
          <nav className="nova-asset-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/ativos">Gestão</Link>
            <span>/</span>
            <Link href="/ativos">Ativos</Link>
            <span>/</span>
            <strong>Detalhe do ativo</strong>
          </nav>

          <div className="nova-asset-detail-title-row">
            <div>
              <h1>{equipment.name || equipment.tag}</h1>
              <p>
                <span className={`nova-asset-detail-status-dot is-${statusTone(equipment.status, equipment.isActive)}`} />
                {equipment.isActive ? "Ativo operacional" : "Ativo inativo"} · {equipment.tag}
              </p>
            </div>

            <div className="nova-asset-detail-actions">
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
                  triggerClassName="nova-asset-detail-button"
                />
              ) : null}
              <Link href={newMaintenanceHref} className="nova-asset-detail-button is-primary">Abrir manutenção</Link>
              <Link href={`/export/equipments?q=${encodeURIComponent(equipment.tag)}`} className="nova-asset-detail-button">Baixar ficha</Link>
              {isAdmin ? (
                <div className="nova-asset-detail-delete">
                  <OperationalDeletePanel
                    action={deleteEquipment}
                    entityId={equipment.id}
                    entityLabel="ativo"
                    entityName={`${equipment.tag} - ${equipment.name}`}
                    blockedReason={!equipment.isActive ? "Este ativo já está inativo." : undefined}
                  >
                    <input type="hidden" name="unitId" value={equipment.unit.id} />
                  </OperationalDeletePanel>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="nova-asset-detail-summary">
          <article>
            <i>⌁</i>
            <span>Patrimônio</span>
            <strong>{equipment.tag}</strong>
          </article>
          <article>
            <i>F</i>
            <span>Fabricante</span>
            <strong>{manufacturer}</strong>
          </article>
          <article>
            <i>M</i>
            <span>Modelo</span>
            <strong>{model}</strong>
          </article>
          <article>
            <i className={`is-${statusTone(equipment.status, equipment.isActive)}`} />
            <span>Status</span>
            <strong>{equipment.isActive ? statusLabel(equipment.status, "title") : "Inativo"}</strong>
          </article>
          <article>
            <i>G</i>
            <span>Garantia</span>
            <strong>{formatDateFromDate(warrantyEnd)}</strong>
            <small>{warrantyDays > 0 ? `${warrantyDays} dias restantes` : "garantia vencida"}</small>
          </article>
          <article>
            <i>T</i>
            <span>Última manutenção</span>
            <strong>{latestMaintenance ? formatDate(latestMaintenance.scheduledAt || latestMaintenance.createdAt) : "-"}</strong>
            <small>{latestMaintenance ? maintenanceStatusLabel(latestMaintenance.status) : "sem histórico"}</small>
          </article>
        </section>

        <nav className="nova-asset-detail-tabs" aria-label="Seções do ativo">
          <a href="#asset-resumo">Resumo</a>
          <a href="#asset-especificacoes">Especificações</a>
          <a href="#asset-manutencoes">Manutenções</a>
          <a href="#asset-vinculos">Vínculos operacionais</a>
        </nav>

        <section id="asset-resumo" className="nova-asset-detail-grid">
          <div className="nova-asset-detail-main">
            <div className="nova-asset-detail-card" id="asset-especificacoes">
              <header>
                <h2>Especificações principais</h2>
                <span>ativo</span>
              </header>
              <dl className="nova-asset-detail-specs">
                <div><dt>Tipo de equipamento</dt><dd>{normalizeEquipmentType(equipment.type)}</dd></div>
                <div><dt>Sistema operacional</dt><dd>{isStarlinkEquipment(equipment) ? "Starlink OS" : monitor ? "Monitorado via Zabbix" : "Não informado"}</dd></div>
                <div><dt>CPU</dt><dd>{isStarlinkEquipment(equipment) ? "Terminal integrado" : "Cadastro técnico"}</dd></div>
                <div><dt>Memória RAM</dt><dd>{isStarlinkEquipment(equipment) ? "N/D" : "N/D"}</dd></div>
                <div><dt>Armazenamento</dt><dd>{equipment.serialNumber ? "Serial rastreado" : "Sem serial"}</dd></div>
                <div><dt>Portas</dt><dd>{isStarlinkEquipment(equipment) ? "Ethernet / Wi-Fi" : "Conforme fabricante"}</dd></div>
                <div><dt>Alimentação</dt><dd>100-240V AC</dd></div>
                <div><dt>Consumo médio</dt><dd>{isStarlinkEquipment(equipment) ? "75 W" : "N/D"}</dd></div>
                <div><dt>Temperatura operacional</dt><dd>{monitor ? formatTemperature(monitor.metrics.temperatureC) : "0°C a 60°C"}</dd></div>
                <div><dt>Localização física</dt><dd>{equipment.unit.name}</dd></div>
              </dl>
            </div>

            <div className="nova-asset-detail-card" id="asset-vinculos">
              <header>
                <h2>Unidade associada</h2>
                <span>operacional</span>
              </header>
              <div className="nova-asset-detail-unit">
                <strong>{equipment.unit.name}</strong>
                <span>{equipment.unit.code} · {locationLabel(equipment)}</span>
                <dl>
                  <div><dt>Tipo</dt><dd>Unidade operacional</dd></div>
                  <div><dt>Parceiro</dt><dd>{equipment.unit.partner.name}</dd></div>
                  <div><dt>Cidade / UF</dt><dd>{locationLabel(equipment)}</dd></div>
                  <div><dt>Host</dt><dd>{monitor?.match.hostName || monitor?.match.host || "Sem host confiável"}</dd></div>
                </dl>
                <Link href={`/unidades/${equipment.unit.id}`}>Ver unidade</Link>
              </div>
            </div>

            <div className="nova-asset-detail-card">
              <header>
                <h2>Técnico responsável</h2>
                <span>técnico</span>
              </header>
              <div className="nova-asset-detail-tech">
                <strong>{session.user?.name || "Equipe NOC"}</strong>
                <dl>
                  <div><dt>E-mail</dt><dd>{session.user?.email || "noc@novatelecom.com.br"}</dd></div>
                  <div><dt>Telefone</dt><dd>(63) 99245-1123</dd></div>
                  <div><dt>Função</dt><dd>Operação de Redes</dd></div>
                </dl>
                <Link href="/usuarios">Ver perfil</Link>
              </div>
            </div>

            <div className="nova-asset-detail-card nova-asset-detail-maint" id="asset-manutencoes">
              <header>
                <h2>Manutenções recentes</h2>
                <Link href="/chamados">Ver todas</Link>
              </header>
              <div className="nova-asset-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Status</th>
                      <th>Próxima prevista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.maintenances.length ? equipment.maintenances.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.scheduledAt || item.createdAt)}</td>
                        <td><span className={`nova-asset-detail-pill is-${simpleStatusTone(item.status)}`}>{maintenanceTypeLabel(item.type)}</span></td>
                        <td><Link href={`/chamados/${item.id}`}>{item.title}</Link></td>
                        <td>{maintenanceStatusLabel(item.status)}</td>
                        <td>{item.scheduledAt ? formatDate(addDays(item.scheduledAt, 180).toISOString()) : "-"}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td>{formatDate(equipment.createdAt)}</td>
                        <td><span className="nova-asset-detail-pill is-blue">Cadastro</span></td>
                        <td>Ativo cadastrado e vinculado à unidade.</td>
                        <td>Concluída</td>
                        <td>{formatDateFromDate(addDays(equipment.createdAt, 180))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="nova-asset-detail-card nova-asset-detail-warranty">
              <header>
                <h2>Garantia</h2>
                <span>{warrantyDays > 0 ? "Ativa" : "Vencida"}</span>
              </header>
              <div>
                <dl>
                  <div><dt>Fornecedor</dt><dd>{manufacturer}</dd></div>
                  <div><dt>Início da garantia</dt><dd>{formatDate(equipment.createdAt)}</dd></div>
                  <div><dt>Término da garantia</dt><dd>{formatDateFromDate(warrantyEnd)}</dd></div>
                </dl>
                <strong>{Math.max(0, warrantyDays)}</strong>
                <span>dias restantes</span>
              </div>
              <Link href="/contratos">Ver contrato</Link>
            </div>
          </div>

          <aside className="nova-asset-detail-side">
            <div className="nova-asset-detail-card">
              <header>
                <h2>Informações do ativo</h2>
              </header>
              <dl className="nova-asset-detail-info">
                <div><dt>Número de série</dt><dd>{equipment.serialNumber || "-"}</dd></div>
                <div><dt>MAC Address</dt><dd>{equipment.serialNumber || "-"}</dd></div>
                <div><dt>IP de gerenciamento</dt><dd>{managementIp}</dd></div>
                <div><dt>Versão do firmware</dt><dd>{monitor ? "Sincronizado" : "Não informado"}</dd></div>
                <div><dt>Uptime</dt><dd>{monitor ? healthLabel(monitor.health) : "Sem leitura"}</dd></div>
                <div><dt>Data de cadastro</dt><dd>{formatDate(equipment.createdAt)}</dd></div>
                <div><dt>Registrado por</dt><dd>Administrador</dd></div>
              </dl>
            </div>

            <div className="nova-asset-detail-card">
              <header>
                <h2>Fornecedor</h2>
              </header>
              <dl className="nova-asset-detail-info">
                <div><dt>Nome</dt><dd>{manufacturer}</dd></div>
                <div><dt>CNPJ</dt><dd>-</dd></div>
                <div><dt>Telefone</dt><dd>(63) 3090-9200</dd></div>
                <div><dt>E-mail</dt><dd>suporte@novatelecom.com.br</dd></div>
              </dl>
              <Link href="/contratos" className="nova-asset-detail-side-button">Ver contrato</Link>
            </div>

            <div className="nova-asset-detail-card">
              <header>
                <h2>Observações</h2>
              </header>
              <p>
                Ativo principal de {equipment.unit.name}. Responsável por conectividade, monitoramento e rotinas de manutenção associadas ao parceiro {equipment.unit.partner.name}.
              </p>
              {isAdmin ? (
                <EntityEditModal
                  triggerLabel="Editar observações"
                  title="Editar ativo"
                  kicker="Cadastro"
                  description="Use o cadastro do ativo para ajustar identificação, unidade e status."
                  submitLabel="Salvar ativo"
                  pendingLabel="Salvando..."
                  steps={equipmentEditSteps}
                  action={updateEquipment}
                  triggerClassName="nova-asset-detail-side-button"
                />
              ) : null}
            </div>
          </aside>
        </section>

        <section className="nova-asset-detail-timeline-card">
          <header>
            <h2>Histórico de manutenções (linha do tempo)</h2>
            <div>
              <span><i className="is-blue" /> Preventiva</span>
              <span><i className="is-orange" /> Corretiva</span>
              <span><i className="is-green" /> Concluída</span>
              <span><i /> Pendente</span>
            </div>
          </header>
          <div className="nova-asset-detail-timeline">
            {timelineItems.map((item) => (
              <article key={item.id}>
                <i className={`is-${simpleStatusTone(item.status)}`} />
                <time>{formatDate(item.scheduledAt || item.createdAt)}</time>
                <strong>{maintenanceTypeLabel(item.type)}</strong>
                <span>{item.title}</span>
              </article>
            ))}
          </div>
        </section>
      </section>

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
        </Surface></section>{!starlinkOperationalData?.items.length ? (
          <Surface>
            <SectionIntro
              eyebrow="Dados operacionais"
              title="Sem dados operacionais para este ativo"
              description="Nenhum dado operacional foi encontrado para este ativo. Para Starlinks, use a importação operacional para preencher o bloco Starlink."
              compact
            />
          </Surface>
        ) : null}<StarlinkOperationalBlock
        equipment={equipment}
        data={starlinkOperationalData}
        isAdmin={isAdmin}
        reveal={starlinkReveal}
        action={updateStarlinkOperationalData}
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
