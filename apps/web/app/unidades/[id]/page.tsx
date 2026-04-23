import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
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
import { apiJson } from "@/lib/server-api";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { getLegacyUnitProfileForUnit } from "@/lib/legacy-catalog";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UnitDetail = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  equipments: Array<{
    id: string;
    tag: string;
    name: string;
    type: string;
    serialNumber: string | null;
    status: string;
    isActive: boolean;
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
    equipments: number;
    occurrences: number;
    maintenances: number;
  };
};

type UnitZabbixSnapshot = {
  unit: { id: string; code: string; name: string };
  match: {
    status: "matched" | "ambiguous" | "unmatched";
    confidence: number;
    integrationCode?: string;
    hostId?: string;
    host?: string;
    hostName?: string;
    matchedBy: string[];
    syncReady: boolean;
  };
  health: "online" | "degraded" | "down" | "unmapped" | "unknown" | "ambiguous";
  metrics: {
    ping: { ok: boolean | null; name: string; key: string; lastClock: string | null } | null;
    lossPct: number | null;
    latencyMs: number | null;
    temperatureC: number | null;
  };
  problems: Array<{
    eventid: string;
    name: string;
    severity: string;
    acknowledged: string;
    clock: string;
  }>;
};

type UnitZabbixSyncResult = {
  ok: boolean;
  status: "synced" | "skipped" | "failed";
  message: string;
  integrationCode?: string;
  hostId?: string;
  hostName?: string;
  updatedTags?: number;
  updatedInventoryFields?: string[];
};

type LegacyLink = {
  legacyId: string;
  partnerCode: string;
  serviceType: string;
  connectionType: string;
  routerPort: string;
  technology: string;
  latency: string;
  macOnu: string;
  phone: string;
  notes: string;
  contractIxc: string;
};

type LegacyPartnerContact = {
  legacyId: string;
  city: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
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

type LegacyUnitProfile = {
  sourceAvailable: boolean;
  message?: string;
  generatedAt?: string;
  redactedSecrets?: boolean;
  unit: {
    code: string;
    name: string;
    group: string;
    city: string;
    state: string;
    phones: string[];
    contracts: string[];
    notes: string[];
  } | null;
  links: LegacyLink[];
  backupLinks: LegacyLink[];
  partnerContacts: LegacyPartnerContact[];
  starlinks: LegacyStarlink[];
  starlinkHistory: LegacyStarlinkHistory[];
  equipments: Array<{
    tag: string;
    name: string;
    type: string;
    serialNumber: string;
    source: string;
  }>;
};

async function syncZabbixAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const unitId = String(formData.get("unitId") || "");

  if (!unitId) {
    return { status: "error", message: "Unidade inválida para sincronização." };
  }

  try {
    const result = await apiJson<UnitZabbixSyncResult>(`/units/${unitId}/sync-zabbix`, {
      method: "POST",
    });

    revalidatePath(`/unidades/${unitId}`);
    revalidatePath("/monitoramento");

    return {
      status: result.ok ? "success" : "error",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionErrorMessage(error),
    };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
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
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} C`;
}

function locationLabel(unit: Pick<UnitDetail, "city" | "state">) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "Sem cidade/UF";
}

function toneForStatus(value: string) {
  const normalized = value.toLowerCase();
  if (["resolved", "closed", "active", "done", "completed"].includes(normalized)) {
    return "success";
  }
  if (["critical", "high", "overdue", "repair"].includes(normalized)) {
    return "attention";
  }
  return "neutral";
}

function toneForHealth(value: UnitZabbixSnapshot["health"]) {
  if (value === "online") return "success";
  if (value === "degraded" || value === "ambiguous") return "attention";
  if (value === "down") return "critical";
  return "neutral";
}

function labelForHealth(value: UnitZabbixSnapshot["health"]) {
  const labels: Record<UnitZabbixSnapshot["health"], string> = {
    online: "online",
    degraded: "atenção",
    down: "offline",
    unmapped: "sem vínculo",
    unknown: "sem item",
    ambiguous: "ambíguo",
  };
  return labels[value];
}

function toneForMetric(value: number | null, warning: number, critical: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value >= critical) return "critical";
  if (value >= warning) return "info";
  return "success";
}

async function readUnitZabbixSnapshot(unitId: string) {
  try {
    const telemetry = await apiJson<{ items: UnitZabbixSnapshot[] }>("/monitoring/unit-hosts");
    return telemetry.items.find((item) => item.unit.id === unitId) || null;
  } catch {
    return null;
  }
}

function LegacyLinkCard({
  title,
  link,
}: {
  title: string;
  link: LegacyLink;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-50">{title}</div>
        <TonePill tone="info">{link.partnerCode}</TonePill>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
        <div>Serviço: <span className="text-slate-200">{link.serviceType || "-"}</span></div>
        <div>Conexão: <span className="text-slate-200">{link.connectionType || "-"}</span></div>
        <div>Porta RB: <span className="text-slate-200">{link.routerPort || "-"}</span></div>
        <div>Tecnologia: <span className="text-slate-200">{link.technology || "-"}</span></div>
        <div>Latência: <span className="text-slate-200">{link.latency || "-"}</span></div>
        <div>Acionamento: <span className="text-slate-200">{link.phone || "-"}</span></div>
        <div>Contrato IXC: <span className="text-slate-200">{link.contractIxc || "-"}</span></div>
        <div className="md:col-span-2">
          MAC/ONU: <span className="break-all text-slate-200">{link.macOnu || "-"}</span>
        </div>
        {link.notes ? (
          <div className="md:col-span-2">
            Observação: <span className="text-slate-200">{link.notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LegacyUnitBlock({ profile }: { profile: LegacyUnitProfile | null }) {
  if (!profile) return null;

  if (!profile.sourceAvailable) {
    return (
      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Legado"
          title="Base legada pronta para conectar"
          description={profile.message || "Gere o arquivo legado para exibir transporte, contatos e Starlinks nesta tela."}
          compact
        />
      </Surface>
    );
  }

  const hasLegacy =
    profile.links.length ||
    profile.backupLinks.length ||
    profile.partnerContacts.length ||
    profile.starlinks.length ||
    profile.equipments.length;

  if (!hasLegacy) return null;

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Legado operacional"
        title="Acionamento, transporte e contingência"
        description="Dados importados dos SQLite de contatos, parceiros e Starlinks para apoiar reconciliação operacional."
        actions={
          profile.redactedSecrets ? (
            <TonePill tone="attention">segredos ocultos</TonePill>
          ) : (
            <TonePill tone="success">completo</TonePill>
          )
        }
        compact
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          {profile.links.map((link, index) => (
            <LegacyLinkCard
              key={`legacy-link-${link.legacyId}-${index}`}
              title={index === 0 ? "Link principal" : `Link principal ${index + 1}`}
              link={link}
            />
          ))}

          {profile.backupLinks.map((link, index) => (
            <LegacyLinkCard
              key={`legacy-backup-${link.legacyId}-${index}`}
              title={index === 0 ? "Backup / contingência" : `Backup ${index + 1}`}
              link={link}
            />
          ))}

          {profile.starlinks.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-50">Starlink</div>
                <TonePill tone="info">{profile.starlinks.length}</TonePill>
              </div>
              <div className="mt-3 grid gap-3">
                {profile.starlinks.map((item) => (
                  <div key={item.legacyId} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400">
                    <div className="font-medium text-slate-100">
                      {item.antennaId || item.kitSerial || "Starlink"}
                    </div>
                    <div className="mt-1">Local: <span className="text-slate-200">{item.localName || "-"}</span></div>
                    <div>IP VPN: <span className="text-slate-200">{item.ipvpn || "-"}</span></div>
                    <div>Kit: <span className="break-all text-slate-200">{item.kitSerial || "-"}</span></div>
                    <div>Antena: <span className="break-all text-slate-200">{item.antennaSerial || "-"}</span></div>
                    <div>Instalação: <span className="text-slate-200">{item.installedAt || "-"}</span></div>
                    {item.notes ? <div className="mt-1 text-slate-300">{item.notes}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid content-start gap-3">
          {profile.unit ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="text-sm font-semibold text-slate-50">Resumo legado</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400">
                <div>Grupo: <span className="text-slate-200">{profile.unit.group || "-"}</span></div>
                <div>Contratos: <span className="text-slate-200">{profile.unit.contracts.join(", ") || "-"}</span></div>
                <div>Telefones: <span className="text-slate-200">{profile.unit.phones.join(", ") || "-"}</span></div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
            <div className="text-sm font-semibold text-slate-50">Contatos do parceiro</div>
            <div className="mt-3 grid gap-2">
              {profile.partnerContacts.length ? (
                profile.partnerContacts.slice(0, 6).map((contact) => (
                  <div key={contact.legacyId} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-sm font-medium text-slate-100">{contact.name || "Contato"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[contact.role, contact.city].filter(Boolean).join(" · ") || "Sem cargo/cidade"}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{contact.phone || "-"}</div>
                    {contact.notes ? <div className="mt-1 text-xs text-slate-500">{contact.notes}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">Nenhum contato legado vinculado.</div>
              )}
            </div>
          </div>

          {profile.equipments.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-50">Ativos legados</div>
                <TonePill tone="success">{profile.equipments.length}</TonePill>
              </div>
              <div className="mt-3 grid gap-2">
                {profile.equipments.slice(0, 8).map((equipment) => (
                  <div key={`${equipment.source}-${equipment.tag}-${equipment.serialNumber}`} className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-sm font-medium text-slate-100">{equipment.tag || equipment.name || "Ativo legado"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[equipment.type, equipment.source].filter(Boolean).join(" · ") || "Sem tipo"}
                    </div>
                    <div className="mt-1 break-all text-sm text-slate-300">{equipment.serialNumber || "Sem serial/MAC"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {profile.starlinkHistory.length ? (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
              <div className="text-sm font-semibold text-slate-50">Histórico Starlink</div>
              <div className="mt-3 grid gap-2">
                {profile.starlinkHistory.map((item) => (
                  <div key={item.legacyId} className="text-sm text-slate-400">
                    <span className="text-slate-200">{item.action}</span> · {item.datetime}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

export default async function UnidadeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/unidades");
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const created = readStringParam(resolvedSearchParams, "created") === "1";
  const from = readStringParam(resolvedSearchParams, "from");

  const [unit, zabbixSnapshot] = await Promise.all([
    apiJson<UnitDetail>(`/units/${resolvedParams.id}`),
    readUnitZabbixSnapshot(resolvedParams.id),
  ]);
  const legacyProfile = (await getLegacyUnitProfileForUnit(unit)) satisfies LegacyUnitProfile | null;
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const canEditAttachments = ["admin", "editor"].includes(role);

  return (
    <AppShell
      title={`${unit.code} · ${unit.name}`}
      subtitle={`${locationLabel(unit)} · parceiro ${unit.partner.code}.`}
    >
      {created ? (
        <Surface className="border-emerald-500/20 bg-emerald-500/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <SectionIntro
              eyebrow="Cadastro concluído"
              title="Unidade criada com sucesso"
              description={
                from === "legacy"
                  ? "A unidade nasceu a partir de uma pista do legado. Revise vínculos, equipamentos e host Zabbix antes de sincronizar."
                  : from === "wizard"
                  ? "O fluxo guiado foi concluído e a unidade já está pronta para receber vínculos operacionais."
                  : "A unidade criada pelo cadastro direto já está disponível para consulta e próximos vínculos."
              }
              compact
            />

            <div className="flex flex-wrap gap-2">
              <Link
                href="/unidades/nova"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-95"
              >
                Criar outra
              </Link>
              <Link
                href="/unidades"
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white transition hover:bg-white/[0.06]"
              >
                Voltar para lista
              </Link>
            </div>
          </div>
        </Surface>
      ) : null}

      <RegistryDetailHero
        eyebrow="Unidade"
        title={`${unit.code} · ${unit.name}`}
        description="Cadastro, parceiro e vínculos recentes em uma visão única, sem criar campos fora do domínio atual."
        badges={
          <>
            <TonePill tone={unit.isActive ? "success" : "subtle"}>
              {unit.isActive ? "ativo" : "inativo"}
            </TonePill>
            <TonePill tone={unit.partner.isActive ? "success" : "attention"}>
              parceiro {unit.partner.code}
            </TonePill>
          </>
        }
        meta={<>{locationLabel(unit)}</>}
        actions={
          <Link
            href="/unidades"
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
          >
            Voltar
          </Link>
        }
      />

      <RegistryMetricGrid
        items={[
          {
            label: "Equipamentos",
            value: unit._count.equipments,
            detail: "inventário vinculado",
            tone: unit._count.equipments > 0 ? "info" : "neutral",
          },
          {
            label: "Ocorrências",
            value: unit._count.occurrences,
            detail: "histórico operacional",
            tone: unit._count.occurrences > 0 ? "attention" : "neutral",
          },
          {
            label: "Manutenções",
            value: unit._count.maintenances,
            detail: "ações ligadas à unidade",
            tone: unit._count.maintenances > 0 ? "info" : "neutral",
          },
          {
            label: "Parceiro",
            value: unit.partner.code,
            detail: unit.partner.name,
            tone: unit.partner.isActive ? "success" : "attention",
          },
        ]}
      />

      <Surface className="p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <SectionIntro
              eyebrow="Zabbix"
              title="Host vinculado à unidade"
              description="Leitura do host encontrado para esta unidade. A sincronização só roda quando o vínculo está seguro."
              actions={
                <TonePill tone={zabbixSnapshot ? toneForHealth(zabbixSnapshot.health) : "neutral"}>
                  {zabbixSnapshot ? labelForHealth(zabbixSnapshot.health) : "sem leitura"}
                </TonePill>
              }
              compact
            />

            <div className="mt-4">
              <RegistryInfoGrid
                columnsClassName="md:grid-cols-2 xl:grid-cols-4"
                items={[
                  {
                    label: "Host",
                    value:
                      zabbixSnapshot?.match.hostName ||
                      zabbixSnapshot?.match.host ||
                      "Sem host confiável",
                  },
                  {
                    label: "Fonte",
                    value: zabbixSnapshot?.match.integrationCode || "-",
                  },
                  {
                    label: "Confiança",
                    value: zabbixSnapshot ? `${zabbixSnapshot.match.confidence}%` : "-",
                  },
                  {
                    label: "Problemas",
                    value: zabbixSnapshot ? String(zabbixSnapshot.problems.length) : "-",
                  },
                ]}
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[14px] border border-white/7 bg-black/20 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Ping</div>
                <div className="mt-2">
                  <TonePill tone={zabbixSnapshot?.metrics.ping?.ok ? "success" : zabbixSnapshot?.metrics.ping?.ok === false ? "critical" : "neutral"}>
                    {zabbixSnapshot?.metrics.ping ? (zabbixSnapshot.metrics.ping.ok ? "up" : "down") : "-"}
                  </TonePill>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Loss</div>
                <div className="mt-2">
                  <TonePill tone={toneForMetric(zabbixSnapshot?.metrics.lossPct ?? null, 3, 10)}>
                    {formatPercent(zabbixSnapshot?.metrics.lossPct ?? null)}
                  </TonePill>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Latência</div>
                <div className="mt-2">
                  <TonePill tone={toneForMetric(zabbixSnapshot?.metrics.latencyMs ?? null, 150, 700)}>
                    {formatMs(zabbixSnapshot?.metrics.latencyMs ?? null)}
                  </TonePill>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Temperatura</div>
                <div className="mt-2">
                  <TonePill tone={toneForMetric(zabbixSnapshot?.metrics.temperatureC ?? null, 55, 70)}>
                    {formatTemperature(zabbixSnapshot?.metrics.temperatureC ?? null)}
                  </TonePill>
                </div>
              </div>
            </div>

            {zabbixSnapshot?.match.matchedBy.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {zabbixSnapshot.match.matchedBy.map((reason) => (
                  <span key={reason} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4">
            <div className="text-sm font-semibold text-slate-50">Sincronização segura</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Atualiza tags e inventário do host no Zabbix com código da unidade, parceiro,
              localização e serial/MAC dos equipamentos cadastrados.
            </p>
            <div className="mt-3 rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400">
              Requer tag <span className="font-semibold text-slate-200">nova.unit_code={unit.code}</span> no host correto.
            </div>
            {isAdmin ? (
              <ActionForm
                action={syncZabbixAction}
                submitLabel="Sincronizar Zabbix"
                pendingLabel="Sincronizando..."
                variant="secondary"
                className="mt-4"
                submitClassName="justify-start"
              >
                <input type="hidden" name="unitId" value={unit.id} />
              </ActionForm>
            ) : null}
          </div>
        </div>
      </Surface>

      <section className="grid gap-5">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Cadastro"
            title="Identidade e localização"
            description="Campos persistidos hoje no contrato real de unidade."
            compact
          />
          <div className="mt-4">
            <RegistryInfoGrid
              items={[
                { label: "Código", value: unit.code },
                { label: "Nome", value: unit.name },
                { label: "Cidade/UF", value: locationLabel(unit) },
                { label: "Atualizado em", value: formatDate(unit.updatedAt) },
                {
                  label: "Parceiro responsável",
                  value: `${unit.partner.code} - ${unit.partner.name}`,
                  span: "full",
                },
              ]}
            />
          </div>
        </Surface>
      </section>

      <LegacyUnitBlock profile={legacyProfile} />

      <AttachmentPanel
        entityPath="units"
        entityId={unit.id}
        entityLabel="unidade"
        returnPath={`/unidades/${unit.id}`}
        canEdit={canEditAttachments}
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Inventário"
          title="Equipamentos"
          description="Equipamentos já vinculados a esta unidade."
          compact
        />
        <div className="mt-4">
          {unit.equipments.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Tag</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Serial/MAC</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </TableHead>
                <tbody>
                  {unit.equipments.map((equipment) => (
                    <tr
                      key={equipment.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    >
                      <TableCell>
                        <Link
                          href={`/equipamentos/${equipment.id}`}
                          className="font-medium text-white hover:text-sky-100"
                        >
                          {equipment.tag}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-300">{equipment.name}</TableCell>
                      <TableCell className="text-slate-400">{equipment.serialNumber || "-"}</TableCell>
                      <TableCell className="text-slate-400">{equipment.type}</TableCell>
                      <TableCell>
                        <TonePill tone={toneForStatus(equipment.status)}>
                          {equipment.status}
                        </TonePill>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/equipamentos/${equipment.id}`}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          Abrir
                        </Link>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </DenseTable>
            </TableShell>
          ) : (
            <EmptyState
              title="Nenhum equipamento vinculado"
              description="Quando o inventário for associado, ele aparece aqui com tag, tipo e status."
              action={
                <Link
                  href="/equipamentos"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Abrir equipamentos
                </Link>
              }
            />
          )}
        </div>
      </Surface>

      <section className="grid gap-5 xl:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Histórico"
            title="Ocorrências recentes"
            description="Últimas ocorrências ligadas à unidade."
            compact
          />
          <div className="mt-4">
            {unit.occurrences.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-4 py-3">Ocorrência</th>
                      <th className="px-4 py-3">Sev.</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Criada</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {unit.occurrences.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <TableCell>
                          <Link
                            href={`/ocorrencias/${item.id}`}
                            className="font-medium text-white hover:text-sky-100"
                          >
                            {item.code}
                          </Link>
                          <div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                            {item.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={toneForStatus(item.severity)}>
                            {item.severity}
                          </TonePill>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDate(item.createdAt)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Nenhuma ocorrência recente"
                description="Ocorrências vinculadas à unidade serão listadas aqui."
              />
            )}
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Histórico"
            title="Manutenções recentes"
            description="Ações de manutenção associadas à unidade."
            compact
          />
          <div className="mt-4">
            {unit.maintenances.length ? (
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
                    {unit.maintenances.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <TableCell>
                          <Link
                            href={`/manutencoes/${item.id}`}
                            className="font-medium text-white hover:text-sky-100"
                          >
                            {item.code}
                          </Link>
                          <div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                            {item.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TonePill tone="neutral">{item.type}</TonePill>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={toneForStatus(item.status)}>
                            {item.status}
                          </TonePill>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDate(item.scheduledAt)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Nenhuma manutenção recente"
                description="Manutenções ligadas à unidade serão listadas aqui."
              />
            )}
          </div>
        </Surface>
      </section>
    </AppShell>
  );
}
