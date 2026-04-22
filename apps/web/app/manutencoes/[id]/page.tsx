import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LinkedHostPanel } from "@/components/linked-host-panel";
import {
  ConnectedRoutesPanel,
  WorkflowStatsPanel,
} from "@/components/ops-side-panels";
import {
  RegistryDetailHero,
  RegistryInfoGrid,
  RegistryMetricGrid,
} from "@/components/registry-shell";
import {
  EmptyState,
  SectionIntro,
  Surface,
  TonePill,
} from "@/components/ops-ui";
import {
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";

type MaintenanceDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string; type: string; status: string } | null;
  occurrence: { id: string; code: string; title: string; severity: string; status: string } | null;
};

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    preventive: "Preventiva",
    corrective: "Corretiva",
    inspection: "Inspeção",
  };
  return labels[value] || value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    planned: "Planejada",
    in_progress: "Em execução",
    done: "Concluída",
    cancelled: "Cancelada",
  };
  return labels[value] || value;
}

function typeTone(value: string) {
  if (value === "corrective") return "attention";
  if (value === "inspection") return "info";
  return "success";
}

function statusTone(value: string) {
  if (value === "done") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "in_progress") return "info";
  return "attention";
}

function occurrenceTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "neutral";
}

function occurrenceSeverityLabel(value: string) {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[value] || value;
}

function occurrenceStatusLabel(value: string) {
  const labels: Record<string, string> = {
    open: "Aberta",
    investigating: "Em análise",
    resolved: "Resolvida",
    cancelled: "Cancelada",
  };
  return labels[value] || value;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(maintenance: MaintenanceDetail) {
  if (!maintenance.scheduledAt) return false;
  if (["done", "cancelled"].includes(maintenance.status)) return false;
  return new Date(maintenance.scheduledAt).getTime() < Date.now();
}

function RelatedLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 transition hover:border-white/14 hover:bg-[#10161d]"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-50">{value}</div>
    </Link>
  );
}

export default async function ManutencaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/manutencoes");
  }

  const resolved = await params;
  const [maintenance, commandCenter, telemetry] = await Promise.all([
    apiJson<MaintenanceDetail>(`/maintenances/${resolved.id}`),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry(),
  ]);
  const overdue = isOverdue(maintenance);
  const linkedHost =
    telemetry.items.find((item) => item.unit.id === maintenance.unit?.id) ||
    telemetry.items.find((item) =>
      maintenance.equipment ? item.equipments.some((equipment) => equipment.id === maintenance.equipment?.id) : false,
    ) ||
    telemetry.items.find((item) => item.partner.id === maintenance.partner?.id) ||
    null;
  const connectedRoutes = [
    {
      href: "/operacao/fila?view=dueSoon",
      title: "Voltar para a fila",
      description: "Se a manutenção já pressiona o turno, a ordem de execução e despacho continua na fila operacional.",
      badge: <TonePill tone="attention">prazo</TonePill>,
    },
    {
      href: "/ocorrencias",
      title: "Abrir incidente relacionado",
      description: "Quando a ação técnica ainda depende do contexto do evento originador, volte pela mesa de ocorrências.",
      badge: <TonePill tone="info">incidente</TonePill>,
    },
    {
      href: "/monitoramento",
      title: "Cruzar com host e telemetria",
      description: "Use o estado do host da unidade para confirmar impacto, recuperação ou necessidade de escalada.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <AppShell
      title={`${maintenance.code} · ${maintenance.title}`}
      subtitle="Ficha operacional da manutenção, vínculo técnico e janela de execução."
    >
      <RegistryDetailHero
        eyebrow="Manutenção"
        title={maintenance.title}
        description={maintenance.description || "Sem descrição complementar registrada."}
        badges={
          <>
            <TonePill tone={typeTone(maintenance.type)}>{typeLabel(maintenance.type)}</TonePill>
            <TonePill tone={overdue ? "critical" : statusTone(maintenance.status)}>
              {overdue ? "vencida" : statusLabel(maintenance.status)}
            </TonePill>
          </>
        }
        meta={
          <>
            <span>{maintenance.code}</span>
            <span className="text-slate-700">•</span>
            <span>Criada em {formatDateTime(maintenance.createdAt)}</span>
            <span className="text-slate-700">•</span>
            <span>Atualizada em {formatDateTime(maintenance.updatedAt)}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/manutencoes"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Voltar
            </Link>
            <Link
              href="/operacao/fila?view=dueSoon"
              className="rounded-full border border-blue-400/30 bg-[#17213a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1b2946]"
            >
              Abrir fila
            </Link>
          </div>
        }
      />

      <RegistryMetricGrid
        items={[
          {
            label: "Tipo",
            value: typeLabel(maintenance.type),
            detail: "classificação",
            tone: typeTone(maintenance.type),
          },
          {
            label: "Status",
            value: overdue ? "Vencida" : statusLabel(maintenance.status),
            detail: "situação atual",
            tone: overdue ? "critical" : statusTone(maintenance.status),
          },
          {
            label: "Agendada",
            value: formatDateTime(maintenance.scheduledAt),
            detail: "janela planejada",
            tone: overdue ? "critical" : maintenance.scheduledAt ? "info" : "neutral",
          },
          {
            label: "Concluída",
            value: formatDateTime(maintenance.completedAt),
            detail: "fechamento",
            tone: maintenance.completedAt ? "success" : "neutral",
          },
          {
            label: "Host da unidade",
            value: linkedHost?.match.hostName || linkedHost?.unit.code || "-",
            detail: linkedHost ? "monitoramento encontrado" : "sem match monitorado",
            tone: linkedHost ? "success" : "neutral",
          },
        ]}
        columnsClassName="md:grid-cols-2 xl:grid-cols-5"
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Resumo"
            title="Contexto da manutenção"
            description="Código, agenda e entidade relacionada em uma ficha mais direta."
            compact
          />

          <div className="mt-5">
            <RegistryInfoGrid
              columnsClassName="md:grid-cols-2 xl:grid-cols-3"
              items={[
                { label: "Código", value: maintenance.code },
                {
                  label: "Parceiro",
                  value: maintenance.partner
                    ? `${maintenance.partner.code} - ${maintenance.partner.name}`
                    : "-",
                },
                {
                  label: "Unidade",
                  value: maintenance.unit
                    ? `${maintenance.unit.code} - ${maintenance.unit.name}`
                    : "-",
                },
                {
                  label: "Equipamento",
                  value: maintenance.equipment
                    ? `${maintenance.equipment.tag} - ${maintenance.equipment.name}`
                    : "-",
                },
                {
                  label: "Ocorrência",
                  value: maintenance.occurrence
                    ? `${maintenance.occurrence.code} - ${maintenance.occurrence.title}`
                    : "-",
                },
                {
                  label: "Agenda",
                  value: `${formatDateTime(maintenance.scheduledAt)} -> ${formatDateTime(
                    maintenance.completedAt,
                  )}`,
                },
              ]}
            />
          </div>
        </Surface>

        <div className="grid gap-5">
          <LinkedHostPanel
            item={linkedHost}
            title="Host da unidade em manutenção"
            description="A ficha já mostra o estado do host correspondente quando o cadastro consegue bater com a unidade monitorada."
          />

          <WorkflowStatsPanel
            eyebrow="Turno"
            title="Leitura rápida da execução"
            description="Esses sinais ajudam a decidir se a manutenção continua na agenda, volta ao incidente ou já pressiona a fila."
            stats={[
              {
                label: "Está vencida",
                value: overdue ? "sim" : "não",
                tone: overdue ? "critical" : "success",
              },
              {
                label: "Com ocorrência",
                value: maintenance.occurrence ? "sim" : "não",
                tone: maintenance.occurrence ? "attention" : "neutral",
              },
              {
                label: "Vencidas no turno",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "critical" : "neutral",
              },
              {
                label: "Ocorrências abertas",
                value: commandCenter.metrics.openOccurrences,
                tone: commandCenter.metrics.openOccurrences ? "info" : "neutral",
              },
            ]}
          />

          <ConnectedRoutesPanel
            eyebrow="Trilha"
            title="Rotas que completam a execução"
            description="A manutenção conversa com fila, incidente e host. Essas são as rotas úteis da operação."
            routes={connectedRoutes}
          />

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Vínculos"
              title="Abrir relacionados"
              description="Use estes atalhos quando a execução depender de contexto adicional."
              compact
            />
            <div className="mt-5 grid gap-3">
              {maintenance.partner ? (
                <RelatedLink
                  href={`/parceiros/${maintenance.partner.id}`}
                  label="Parceiro"
                  value={`${maintenance.partner.code} · ${maintenance.partner.name}`}
                />
              ) : null}
              {maintenance.unit ? (
                <RelatedLink
                  href={`/unidades/${maintenance.unit.id}`}
                  label="Unidade"
                  value={`${maintenance.unit.code} · ${maintenance.unit.name}`}
                />
              ) : null}
              {maintenance.equipment ? (
                <RelatedLink
                  href={`/equipamentos/${maintenance.equipment.id}`}
                  label="Equipamento"
                  value={`${maintenance.equipment.tag} · ${maintenance.equipment.name}`}
                />
              ) : null}
              {maintenance.occurrence ? (
                <Link
                  href={`/ocorrencias/${maintenance.occurrence.id}`}
                  className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4 transition hover:border-white/14 hover:bg-[#10161d]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Ocorrência
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-50">
                        {maintenance.occurrence.code} · {maintenance.occurrence.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {occurrenceStatusLabel(maintenance.occurrence.status)}
                      </div>
                    </div>
                    <TonePill tone={occurrenceTone(maintenance.occurrence.severity)}>
                      {occurrenceSeverityLabel(maintenance.occurrence.severity)}
                    </TonePill>
                  </div>
                </Link>
              ) : null}
              {!maintenance.partner &&
              !maintenance.unit &&
              !maintenance.equipment &&
              !maintenance.occurrence ? (
                <EmptyState
                  title="Sem vínculos"
                  description="A manutenção ainda não aponta para parceiro, unidade, equipamento ou ocorrência."
                />
              ) : null}
            </div>
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
