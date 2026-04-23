import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
import { EntityEditModal } from "@/components/entity-edit-modal";
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
import { getLegacyEquipmentProfileForEquipment } from "@/lib/legacy-catalog";
import { apiJson } from "@/lib/server-api";
import {
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
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

type UnitMonitorSnapshot = {
  unit: { id: string };
  match: {
    status: "matched" | "ambiguous" | "unmatched";
    confidence: number;
    host?: string;
    hostName?: string;
    syncReady: boolean;
  };
  health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
  metrics: {
    ping: { ok: boolean | null } | null;
    lossPct: number | null;
    latencyMs: number | null;
    temperatureC: number | null;
  };
  problems: Array<{ eventid: string; name: string; severity: string }>;
};

type UnitMonitorResponse = {
  items: UnitMonitorSnapshot[];
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  partner: { id: string; code: string; name: string };
};

type LegacyStarlink = {
  legacyId: string;
  antennaId: string;
  email: string;
  plan: string;
  card: string;
  localName: string;
  kitSerial: string;
  antennaSerial: string;
  ipvpn: string;
  installer: string;
  installedAt: string;
  notes: string;
};

type LegacyStarlinkHistory = {
  legacyId: string;
  starlinkLegacyId: string;
  action: string;
  details: string;
  user: string;
  datetime: string;
};

type LegacyEquipmentProfile = {
  sourceAvailable: boolean;
  message?: string;
  generatedAt?: string;
  redactedSecrets?: boolean;
  equipment: {
    tag: string;
    name: string;
    type: string;
    serialNumber: string;
    status: string;
    unitCode: string;
    partnerCode: string;
    source: string;
  } | null;
  starlinks: LegacyStarlink[];
  starlinkHistory: LegacyStarlinkHistory[];
};

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "ativo",
    stock: "estoque",
    repair: "reparo",
    retired: "retirado",
  };

  return labels[value] || value || "sem status";
}

function statusTone(value: string, isActive: boolean) {
  if (!isActive || value === "retired") return "subtle";
  if (value === "repair") return "attention";
  if (value === "active") return "success";
  return "neutral";
}

function healthLabel(value: UnitMonitorSnapshot["health"]) {
  const labels: Record<UnitMonitorSnapshot["health"], string> = {
    online: "online",
    degraded: "atenção",
    down: "offline",
    unmapped: "sem host",
    unknown: "sem item",
    ambiguous: "ambíguo",
  };
  return labels[value];
}

function healthTone(value: UnitMonitorSnapshot["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatMs(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ms`;
}

function formatTemperature(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
}

function locationLabel(equipment: EquipmentDetail) {
  return [equipment.unit.city, equipment.unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function CreatedNotice({ from }: { from: string }) {
  return (
    <Surface className="border-emerald-500/18 bg-emerald-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-emerald-100">
            Equipamento criado com sucesso
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Origem: {from === "wizard" ? "cadastro guiado" : "cadastro direto"}.
            Revise serial, vínculo com a unidade e leitura de monitoramento herdada.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/equipamentos/nova"
            className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
          >
            Criar outro
          </Link>
          <Link
            href="/equipamentos"
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06]"
          >
            Voltar para lista
          </Link>
        </div>
      </div>
    </Surface>
  );
}

async function readMonitorSnapshots() {
  try {
    return await apiJson<UnitMonitorResponse>("/monitoring/unit-hosts");
  } catch {
    return { items: [] } satisfies UnitMonitorResponse;
  }
}

function LegacyEquipmentBlock({ profile }: { profile: LegacyEquipmentProfile | null }) {
  if (!profile) return null;

  if (!profile.sourceAvailable) {
    return (
      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Legado"
          title="Base legada pronta para conectar"
          description={profile.message || "Gere o arquivo legado para exibir origem técnica e histórico Starlink deste equipamento."}
          compact
        />
      </Surface>
    );
  }

  const hasLegacy = Boolean(profile.equipment || profile.starlinks.length || profile.starlinkHistory.length);
  if (!hasLegacy) return null;

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Legado operacional"
        title="Origem técnica e Starlink"
        description="Leitura dos SQLite para preservar serial, IP VPN, kit e histórico sem gravar campos novos no Prisma."
        actions={profile.redactedSecrets ? <TonePill tone="attention">segredos ocultos</TonePill> : null}
        compact
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-3 md:grid-cols-2">
          {profile.equipment ? (
            <>
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Origem</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{profile.equipment.source || "-"}</div>
              </div>
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Parceiro legado</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{profile.equipment.partnerCode || "-"}</div>
              </div>
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4 md:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Serial/MAC legado</div>
                <div className="mt-2 break-all text-sm font-medium text-slate-100">{profile.equipment.serialNumber || "-"}</div>
              </div>
            </>
          ) : null}

          {profile.starlinks.map((item) => (
            <div key={item.legacyId} className="rounded-[14px] border border-sky-400/15 bg-sky-400/[0.04] p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-50">
                  {item.antennaId || item.kitSerial || "Starlink legado"}
                </div>
                <TonePill tone="info">starlink</TonePill>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                <div>Local: <span className="text-slate-200">{item.localName || "-"}</span></div>
                <div>Plano: <span className="text-slate-200">{item.plan || "-"}</span></div>
                <div>IP VPN: <span className="text-slate-200">{item.ipvpn || "-"}</span></div>
                <div>Instalador: <span className="text-slate-200">{item.installer || "-"}</span></div>
                <div className="md:col-span-2">Kit: <span className="break-all text-slate-200">{item.kitSerial || "-"}</span></div>
                <div className="md:col-span-2">Antena: <span className="break-all text-slate-200">{item.antennaSerial || "-"}</span></div>
                {item.notes ? <div className="md:col-span-2 text-slate-300">{item.notes}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
          <div className="text-sm font-semibold text-slate-50">Histórico importado</div>
          <div className="mt-3 grid gap-3">
            {profile.starlinkHistory.length ? (
              profile.starlinkHistory.map((item) => (
                <div key={item.legacyId} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="text-sm font-medium text-slate-100">{item.action || "Registro"}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.datetime || "-"}</div>
                  {item.details ? <div className="mt-2 text-sm text-slate-400">{item.details}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">Nenhum histórico Starlink vinculado a este equipamento.</div>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default async function EquipamentoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/equipamentos");
  }

  const resolved = await params;
  const query = await resolveSearchParams(searchParams);
  const created = readStringParam(query, "created");
  const from = readStringParam(query, "from");
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const canEditAttachments = ["admin", "editor"].includes(role);
  const [equipment, monitorResponse, unitsResponse] = await Promise.all([
    apiJson<EquipmentDetail>(`/equipments/${resolved.id}`),
    readMonitorSnapshots(),
    apiJson<PaginatedResponse<UnitOption>>(
      "/units?page=1&pageSize=100&sortBy=code&sortDir=asc",
    ),
  ]);
  const legacyProfile = (await getLegacyEquipmentProfileForEquipment(equipment)) satisfies LegacyEquipmentProfile | null;
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

      revalidatePath("/equipamentos");
      revalidatePath(`/equipamentos/${id}`);
      revalidatePath(`/unidades/${String(formData.get("unitId") || "")}`);
      return { status: "success", message: "Equipamento atualizado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const equipmentEditSteps = [
    {
      title: "Inventário",
      description: "Tag, nome operacional e tipo do ativo.",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={equipment.id} />
          <div className="grid gap-2">
            <label
              htmlFor="equipment-tag"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Tag
            </label>
            <input
              id="equipment-tag"
              name="tag"
              defaultValue={equipment.tag}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm uppercase text-white outline-none transition focus:border-sky-400/40"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="equipment-name"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Nome
            </label>
            <input
              id="equipment-name"
              name="name"
              defaultValue={equipment.name}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <label
              htmlFor="equipment-type"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Tipo
            </label>
            <input
              id="equipment-type"
              name="type"
              defaultValue={equipment.type}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            />
          </div>
        </div>
      ),
    },
    {
      title: "Rede",
      description: "Identificador técnico e situação do equipamento.",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label
              htmlFor="equipment-serial"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Serial / MAC
            </label>
            <input
              id="equipment-serial"
              name="serialNumber"
              defaultValue={equipment.serialNumber || ""}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="equipment-status"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Status
            </label>
            <select
              id="equipment-status"
              name="status"
              defaultValue={equipment.status}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="active">Ativo</option>
              <option value="stock">Estoque</option>
              <option value="repair">Reparo</option>
              <option value="retired">Retirado</option>
            </select>
          </div>

          <div className="md:col-span-2 rounded-[16px] border border-white/[0.08] bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Campos como IP, firmware, fabricante e modelo ainda não estão no contrato real do
            ativo. Por enquanto, o fluxo segue enxuto como no legado: edita o essencial e salva
            no fechamento.
          </div>
        </div>
      ),
    },
    {
      title: "Vínculos",
      description: "Unidade atendida e contexto operacional ligado ao ativo.",
      body: (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label
              htmlFor="equipment-unit"
              className="text-[10px] uppercase tracking-[0.16em] text-slate-500"
            >
              Unidade
            </label>
            <select
              id="equipment-unit"
              name="unitId"
              defaultValue={equipment.unit.id}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              {unitsResponse.items.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4">
            <div className="text-sm font-semibold text-slate-100">Vínculo atual</div>
            <div className="mt-3 grid gap-3 text-sm text-slate-400 md:grid-cols-2">
              <div>
                Unidade: <span className="text-slate-200">{equipment.unit.code}</span>
              </div>
              <div>
                Parceiro: <span className="text-slate-200">{equipment.unit.partner.name}</span>
              </div>
              <div>
                Localização: <span className="text-slate-200">{locationLabel(equipment)}</span>
              </div>
              <div>
                Saúde monitorada:{" "}
                <span className="text-slate-200">
                  {monitor ? healthLabel(monitor.health) : "sem leitura"}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Fechamento",
      description: "Status final do cadastro antes de persistir as mudanças.",
      body: (
        <div className="grid gap-4">
          <label className="flex items-start gap-3 rounded-[16px] border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-slate-300">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={equipment.isActive}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-slate-100">Equipamento ativo</span>
              <span className="mt-1 block text-slate-400">
                Mantém o ativo disponível para operação, ocorrências e monitoramento.
              </span>
            </span>
          </label>

          <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 text-sm leading-6 text-slate-400">
            O modal reproduz a leitura que você já usava no legado: inventário, rede, vínculos e
            fechamento em blocos curtos.
          </div>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="Detalhes do equipamento"
      subtitle="Ativo vinculado a uma unidade; use a unidade para contexto operacional e monitoramento."
    >
      {created ? <CreatedNotice from={from} /> : null}

      <RegistryDetailHero
        eyebrow="Equipamento"
        title={equipment.tag}
        description={`${equipment.name} · ${equipment.type} · ${equipment.unit.code} · ${equipment.unit.partner.name}`}
        badges={
          <>
            <TonePill tone={statusTone(equipment.status, equipment.isActive)}>
              {statusLabel(equipment.status)}
            </TonePill>
            {!equipment.isActive ? <TonePill tone="subtle">inativo</TonePill> : null}
            {monitor ? (
              <TonePill tone={healthTone(monitor.health)}>{healthLabel(monitor.health)}</TonePill>
            ) : null}
          </>
        }
        actions={
          <>
            <Link
              href="/equipamentos"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Voltar
            </Link>
            <Link
              href={`/unidades/${equipment.unit.id}`}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Abrir unidade
            </Link>
            {isAdmin ? (
              <EntityEditModal
                triggerLabel="Editar ativo"
                title="Editar ativo"
                kicker="Cadastro"
                description="Fluxo inspirado no legado para ajustar o essencial do ativo sem poluir a ficha."
                submitLabel="Salvar ativo"
                pendingLabel="Salvando..."
                steps={equipmentEditSteps}
                action={updateEquipment}
              />
            ) : null}
          </>
        }
      />

      <RegistryMetricGrid
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
            label: "Ocorrências",
            value: equipment._count.occurrences,
            detail: "ligadas ao ativo",
            tone: equipment._count.occurrences ? "attention" : "neutral",
          },
          {
            label: "Manutenções",
            value: equipment._count.maintenances,
            detail: "planejadas ou executadas",
            tone: equipment._count.maintenances ? "info" : "neutral",
          },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Cadastro"
            title="Identificação técnica"
            description="Dados mínimos do ativo e seu vínculo com a unidade atendida."
            compact
          />

          <div className="mt-5">
            <RegistryInfoGrid
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
            />
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Monitoramento"
            title="Leitura herdada da unidade"
            description="O host Zabbix é vinculado à unidade; o ativo aparece como contexto do atendimento."
            compact
          />

          {monitor ? (
            <div className="mt-5 grid gap-3">
              <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TonePill tone={healthTone(monitor.health)}>{healthLabel(monitor.health)}</TonePill>
                  {monitor.match.syncReady ? <TonePill tone="success">sync</TonePill> : null}
                </div>
                <div className="mt-3 truncate text-sm font-medium text-slate-100">
                  {monitor.match.hostName || monitor.match.host || "Sem host confiável"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  confiança {Math.round(monitor.match.confidence * 100)}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                  <div className="text-xs text-slate-500">Latência</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">
                    {formatMs(monitor.metrics.latencyMs)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                  <div className="text-xs text-slate-500">Perda</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">
                    {formatPercent(monitor.metrics.lossPct)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                  <div className="text-xs text-slate-500">Temperatura</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">
                    {formatTemperature(monitor.metrics.temperatureC)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
                  <div className="text-xs text-slate-500">Problemas</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">
                    {monitor.problems.length}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Sem leitura de host"
              description="Quando a unidade estiver vinculada a um host Zabbix, o resumo do ativo mostra a telemetria aqui."
            />
          )}
        </Surface>
      </section>

      <LegacyEquipmentBlock profile={legacyProfile} />

      <AttachmentPanel
        entityPath="equipments"
        entityId={equipment.id}
        entityLabel="equipamento"
        returnPath={`/equipamentos/${equipment.id}`}
        canEdit={canEditAttachments}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Eventos"
            title="Ocorrências recentes"
            description={`${equipment._count.occurrences} ocorrência(s) vinculadas ao equipamento.`}
            compact
          />

          <div className="mt-5">
            {equipment.occurrences.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3">Caso</th>
                      <th className="px-4 py-3">Sev.</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Criado</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {equipment.occurrences.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0">
                        <TableCell>
                          <Link href={`/ocorrencias/${item.id}`} className="font-medium text-white hover:text-sky-100">
                            {item.code}
                          </Link>
                          <div className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
                            {item.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={item.severity}>{item.severity}</TonePill>
                        </TableCell>
                        <TableCell className="text-slate-400">{item.status}</TableCell>
                        <TableCell className="text-slate-400">{formatDate(item.createdAt)}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Nenhuma ocorrência recente"
                description="Incidentes vinculados a este equipamento aparecem aqui."
              />
            )}
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Rotina"
            title="Manutenções recentes"
            description={`${equipment._count.maintenances} manutenção(ões) vinculadas ao equipamento.`}
            compact
          />

          <div className="mt-5">
            {equipment.maintenances.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3">Manutenção</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Agenda</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {equipment.maintenances.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0">
                        <TableCell>
                          <Link href={`/manutencoes/${item.id}`} className="font-medium text-white hover:text-sky-100">
                            {item.code}
                          </Link>
                          <div className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
                            {item.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400">{item.type}</TableCell>
                        <TableCell className="text-slate-400">{item.status}</TableCell>
                        <TableCell className="text-slate-400">{formatDate(item.scheduledAt)}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Nenhuma manutenção recente"
                description="Ações preventivas ou corretivas vinculadas a este equipamento aparecem aqui."
              />
            )}
          </div>
        </Surface>
      </section>
    </AppShell>
  );
}
