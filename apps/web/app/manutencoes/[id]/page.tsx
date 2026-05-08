import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
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
import { formatDateTime } from "@/lib/formatters";
import {
  maintenanceStatusLabel as statusLabel,
  maintenanceStatusTone as statusTone,
  maintenanceTypeLabel as typeLabel,
  maintenanceTypeTone as typeTone,
  occurrenceSeverityLabel,
  occurrenceSeverityTone,
  occurrenceStatusLabel,
} from "@/lib/status-ui";
import { getServerWebSession } from "@/lib/web-session";
import { isAdminRole } from "@/lib/role-policy";

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
      className="nds-card block transition"
    ><div className="nds-label">
        {label}
      </div><div className="mt-1 text-[12px] font-semibold text-slate-50">{value}</div></Link>
  );
}

export default async function ManutencaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/chamados");
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
  const isAdmin = isAdminRole(session.user?.role || "");
  const connectedRoutes = [
    {
      href: "/operacao/fila?view=dueSoon",
      title: "Voltar para a fila",
      description: "Se o chamado já pressiona o turno, a ordem de execução e despacho continua na fila operacional.",
      badge: <TonePill tone="attention">prazo</TonePill>,
    },
    {
      href: "/alertas",
      title: "Abrir incidente relacionado",
      description: "Evento originador e vínculos.",
      badge: <TonePill tone="info">incidente</TonePill>,
    },
    {
      href: "/sensores",
      title: "Cruzar com host e telemetria",
      description: "Use o estado do host da unidade para confirmar impacto, recuperação ou necessidade de escalada.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <NovaLitShell activeHref="/chamados">
      <div className="nova-maintenance-detail-lit-page"><RegistryDetailHero
        eyebrow="Chamado"
        title={maintenance.title}
        description={maintenance.description || "Sem descrição complementar registrada."}
        badges={
          <><TonePill tone={typeTone(maintenance.type)}>{typeLabel(maintenance.type)}</TonePill><TonePill tone={overdue ? "critical" : statusTone(maintenance.status)}>
              {overdue ? "vencida" : statusLabel(maintenance.status)}
            </TonePill></>
        }
        meta={
          <><span>{maintenance.code}</span><span className="text-slate-700">•</span><span>Criada em {formatDateTime(maintenance.createdAt)}</span><span className="text-slate-700">•</span><span>Atualizada em {formatDateTime(maintenance.updatedAt)}</span></>
        }
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/chamados"
              className="nds-button"
              data-variant="secondary"
            >
              Voltar
            </Link>{isAdmin ? (
              <Link
                href={`/chamados/${maintenance.id}/editar`}
                className="nds-button"
                data-variant="secondary"
              >
                Editar
              </Link>
            ) : null}<Link
              href="/operacao/fila?view=dueSoon"
              className="nds-button"
              data-variant="primary"
            >
              Abrir fila
            </Link></div>
        }
      /><RegistryMetricGrid
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
      /><section className="nova-side-grid nova-side-grid--380"><Surface><SectionIntro
            eyebrow="Resumo"
            title="Contexto do chamado"
            description="Código, agenda e entidade relacionada em uma ficha mais direta."
            compact
          /><div className="mt-2"><RegistryInfoGrid
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
                  label: "Ativo",
                  value: maintenance.equipment
                    ? `${maintenance.equipment.tag} - ${maintenance.equipment.name}`
                    : "-",
                },
                {
                  label: "Alerta",
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
            /></div></Surface><div className="nova-page-stack grid gap-2"><LinkedHostPanel
            item={linkedHost}
            title="Host da unidade no chamado"
            description="A ficha já mostra o estado do host correspondente quando o cadastro consegue bater com a unidade monitorada."
          /><WorkflowStatsPanel
            eyebrow="Turno"
            title="Execução"
            description="Esses sinais ajudam a decidir se o chamado continua na agenda, volta ao alerta ou já pressiona a fila."
            stats={[
              {
                label: "Está vencida",
                value: overdue ? "sim" : "não",
                tone: overdue ? "critical" : "success",
              },
              {
                label: "Com alerta",
                value: maintenance.occurrence ? "sim" : "não",
                tone: maintenance.occurrence ? "attention" : "neutral",
              },
              {
                label: "Vencidas no turno",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "critical" : "neutral",
              },
              {
                label: "Alertas abertos",
                value: commandCenter.metrics.openOccurrences,
                tone: commandCenter.metrics.openOccurrences ? "info" : "neutral",
              },
            ]}
          /><ConnectedRoutesPanel
            eyebrow="Histórico"
            title="Rotas que completam a execução"
            description="O chamado conversa com fila, alerta e host. Essas são as rotas úteis da operação."
            routes={connectedRoutes}
          /><Surface><SectionIntro
              eyebrow="Vínculos"
              title="Abrir relacionados"
              description="Use estes atalhos quando a execução depender de contexto adicional."
              compact
            /><div className="mt-2 grid gap-2">
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
                  href={`/ativos/${maintenance.equipment.id}`}
                  label="Ativo"
                  value={`${maintenance.equipment.tag} · ${maintenance.equipment.name}`}
                />
              ) : null}
              {maintenance.occurrence ? (
                <Link
                  href={`/alertas/${maintenance.occurrence.id}`}
                  className="nds-card block transition"
                ><div className="flex items-start justify-between gap-2"><div><div className="nds-label">
                        Alerta
                      </div><div className="mt-1 text-[12px] font-semibold text-slate-50">
                        {maintenance.occurrence.code} · {maintenance.occurrence.title}
                      </div><div className="mt-1 text-[10px] text-slate-500">
                        {occurrenceStatusLabel(maintenance.occurrence.status)}
                      </div></div><TonePill tone={occurrenceSeverityTone(maintenance.occurrence.severity)}>
                      {occurrenceSeverityLabel(maintenance.occurrence.severity)}
                    </TonePill></div></Link>
              ) : null}
              {!maintenance.partner &&
              !maintenance.unit &&
              !maintenance.equipment &&
              !maintenance.occurrence ? (
                <EmptyState
                  title="Sem vínculos"
                  description="O chamado ainda não aponta para parceiro, unidade, ativo ou alerta."
                />
              ) : null}
            </div></Surface></div></section>      </div>
    </NovaLitShell>
  );
}
