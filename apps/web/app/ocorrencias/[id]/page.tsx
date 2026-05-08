import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { AttachmentPanel } from "@/components/attachment-panel";
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
  emptyCommandCenter,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { canEditAttachmentsForRole, isAdminRole } from "@/lib/role-policy";
import { formatDateTime } from "@/lib/formatters";
import {
  maintenanceStatusLabel,
  maintenanceStatusTone,
  maintenanceTypeLabel,
  occurrenceSeverityLabel as severityLabel,
  occurrenceSeverityTone as severityTone,
  occurrenceStatusLabel as statusLabel,
  occurrenceStatusTone as statusTone,
} from "@/lib/status-ui";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";

type OccurrenceDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  maintenances: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string | null;
    completedAt: string | null;
    createdAt: string;
  }>;
  _count: {
    maintenances: number;
  };
};

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

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/alertas");
  }

  const resolved = await params;
  const [occurrence, commandCenter, telemetry] = await Promise.all([
    apiJson<OccurrenceDetail>(`/occurrences/${resolved.id}`),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
    readUnitHostTelemetry(),
  ]);
  const linkedHost =
    telemetry.items.find((item) => item.unit.id === occurrence.unit?.id) ||
    telemetry.items.find((item) =>
      occurrence.equipment ? item.equipments.some((equipment) => equipment.id === occurrence.equipment?.id) : false,
    ) ||
    telemetry.items.find((item) => item.partner.id === occurrence.partner?.id) ||
    null;
  const openMaintenances = occurrence.maintenances.filter(
    (item) => !["done", "cancelled"].includes(item.status),
  ).length;
  const scheduledMaintenances = occurrence.maintenances.filter(
    (item) => Boolean(item.scheduledAt),
  ).length;
  const canEditAttachments = canEditAttachmentsForRole(session.user?.role || "");
  const isAdmin = isAdminRole(session.user?.role || "");
  const newExceptionParams = new URLSearchParams();
  newExceptionParams.set("kind", "occurrence");
  newExceptionParams.set("occurrenceId", occurrence.id);
  newExceptionParams.set("title", `Exceção - ${occurrence.code}`);
  newExceptionParams.set("severity", occurrence.severity || "medium");
  newExceptionParams.set("source", "manual");
  if (occurrence.partner?.id) newExceptionParams.set("partnerId", occurrence.partner.id);
  if (occurrence.unit?.id) newExceptionParams.set("unitId", occurrence.unit.id);
  if (occurrence.equipment?.id) newExceptionParams.set("equipmentId", occurrence.equipment.id);
  const newExceptionHref = `/excecoes/nova?${newExceptionParams.toString()}`;

  const newTicketParams = new URLSearchParams();
  newTicketParams.set("occurrenceId", occurrence.id);
  newTicketParams.set("title", `Ação técnica - ${occurrence.code}`);
  if (occurrence.partner?.id) newTicketParams.set("partnerId", occurrence.partner.id);
  if (occurrence.unit?.id) newTicketParams.set("unitId", occurrence.unit.id);
  if (occurrence.equipment?.id) newTicketParams.set("equipmentId", occurrence.equipment.id);
  const newTicketHref = `/chamados/novo?${newTicketParams.toString()}`;

  const connectedRoutes = [
    {
      href: "/operacao/fila?view=pending",
      title: "Voltar para a fila",
      description: "Se o alerta ainda pede triagem ou despacho, a ordem do turno continua na fila operacional.",
      badge: <TonePill tone="info">fila</TonePill>,
    },
    {
      href: "/chamados",
      title: "Abrir agenda técnica",
      description: "Use a agenda quando o incidente já virou ação planejada, execução ou acompanhamento em campo.",
      badge: <TonePill tone="success">agenda</TonePill>,
    },
    {
      href: "/sensores",
      title: "Cruzar com host e eventos",
      description: "Veja o estado real do host da unidade antes de decidir acionamento, escalada ou fechamento.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <NovaLitShell activeHref="/alertas">
      <div className="nova-occurrence-detail-lit-page"><RegistryDetailHero
        eyebrow="Alerta"
        title={occurrence.title}
        description={occurrence.description || "Sem descrição complementar registrada."}
        badges={
          <><TonePill tone={severityTone(occurrence.severity)}>
              {severityLabel(occurrence.severity)}
            </TonePill><TonePill tone={statusTone(occurrence.status)}>
              {statusLabel(occurrence.status)}
            </TonePill>
            {occurrence.source ? <TonePill tone="subtle">{occurrence.source}</TonePill> : null}
          </>
        }
        meta={
          <><span>{occurrence.code}</span><span className="text-slate-700">•</span><span>Criada em {formatDateTime(occurrence.createdAt)}</span><span className="text-slate-700">•</span><span>Atualizada em {formatDateTime(occurrence.updatedAt)}</span></>
        }
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/alertas"
              className="nds-button"
              data-variant="secondary"
            >
              Voltar
            </Link>{isAdmin ? (
              <Link
                href={newExceptionHref}
                className="nds-button"
                data-variant="secondary"
              >
                Enviar para fila
              </Link>
            ) : null}{isAdmin ? (
              <Link
                href={newTicketHref}
                className="nds-button"
                data-variant="secondary"
              >
                Novo chamado
              </Link>
            ) : null}{isAdmin ? (
              <Link
                href={`/alertas/${occurrence.id}/editar`}
                className="nds-button"
                data-variant="secondary"
              >
                Editar
              </Link>
            ) : null}<Link
              href="/operacao/fila?view=pending"
              className="nds-button"
              data-variant="primary"
            >
              Abrir fila
            </Link></div>
        }
      /><RegistryMetricGrid
        items={[
          {
            label: "Chamados",
            value: occurrence._count.maintenances,
            detail: `${openMaintenances} ainda abertas`,
            tone: openMaintenances ? "attention" : occurrence._count.maintenances ? "info" : "neutral",
          },
          {
            label: "Severidade",
            value: severityLabel(occurrence.severity),
            detail: "classificação atual",
            tone: severityTone(occurrence.severity),
          },
          {
            label: "Status",
            value: statusLabel(occurrence.status),
            detail: "estado operacional",
            tone: statusTone(occurrence.status),
          },
          {
            label: "Origem",
            value: occurrence.source || "-",
            detail: "fonte informada",
            tone: occurrence.source ? "info" : "neutral",
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
            title="Contexto do alerta"
            description="Entidade afetada, código e vínculo operacional em uma ficha mais direta."
            compact
          /><div className="mt-2"><RegistryInfoGrid
              columnsClassName="md:grid-cols-2 xl:grid-cols-3"
              items={[
                { label: "Código", value: occurrence.code },
                {
                  label: "Parceiro",
                  value: occurrence.partner
                    ? `${occurrence.partner.code} - ${occurrence.partner.name}`
                    : "-",
                },
                {
                  label: "Unidade",
                  value: occurrence.unit ? `${occurrence.unit.code} - ${occurrence.unit.name}` : "-",
                },
                {
                  label: "Ativo",
                  value: occurrence.equipment
                    ? `${occurrence.equipment.tag} - ${occurrence.equipment.name}`
                    : "-",
                  span: "full",
                },
              ]}
            /></div></Surface><div className="nova-page-stack grid gap-2"><LinkedHostPanel
            item={linkedHost}
            title="Host da unidade afetada"
            description="Quando existe correspondência entre cadastro e host, a ficha já mostra o sinal técnico que ajuda a decidir o próximo passo."
          /><WorkflowStatsPanel
            eyebrow="Turno"
            title="Resumo do caso"
            description="O ponto aqui é saber se o caso pede fila, agenda técnica ou monitoramento antes de abrir mais telas."
            stats={[
              {
                label: "Chamados abertos",
                value: openMaintenances,
                tone: openMaintenances ? "attention" : "neutral",
              },
              {
                label: "Chamados agendados",
                value: scheduledMaintenances,
                tone: scheduledMaintenances ? "info" : "neutral",
              },
              {
                label: "Críticas no turno",
                value: commandCenter.metrics.criticalOpenOccurrences,
                tone: commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral",
              },
              {
                label: "Chamados vencidos",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "attention" : "neutral",
              },
            ]}
          /><ConnectedRoutesPanel
            eyebrow="Histórico"
            title="Rotas que completam o caso"
            description="Essas rotas continuam a operação sem repetir navegação de enfeite."
            routes={connectedRoutes}
          /><Surface><SectionIntro
              eyebrow="Vínculos"
              title="Abrir relacionados"
              description="Use estes atalhos quando o trabalho exigir contexto de parceiro, unidade ou ativo."
              compact
            /><div className="mt-2 grid gap-2">
              {occurrence.partner ? (
                <RelatedLink
                  href={`/parceiros/${occurrence.partner.id}`}
                  label="Parceiro"
                  value={`${occurrence.partner.code} · ${occurrence.partner.name}`}
                />
              ) : null}
              {occurrence.unit ? (
                <RelatedLink
                  href={`/unidades/${occurrence.unit.id}`}
                  label="Unidade"
                  value={`${occurrence.unit.code} · ${occurrence.unit.name}`}
                />
              ) : null}
              {occurrence.equipment ? (
                <RelatedLink
                  href={`/ativos/${occurrence.equipment.id}`}
                  label="Ativo"
                  value={`${occurrence.equipment.tag} · ${occurrence.equipment.name}`}
                />
              ) : null}
              {!occurrence.partner && !occurrence.unit && !occurrence.equipment ? (
                <EmptyState
                  title="Sem vínculos"
                  description="O alerta ainda não aponta para parceiro, unidade ou ativo."
                />
              ) : null}
            </div></Surface></div></section><AttachmentPanel
        entityPath="occurrences"
        entityId={occurrence.id}
        entityLabel="alerta"
        returnPath={`/alertas/${occurrence.id}`}
        canEdit={canEditAttachments}
      /><Surface><SectionIntro
          eyebrow="Agenda"
          title="Chamados"
          description="Ações do incidente."
          actions={
            <Link
              href="/chamados"
              className="nds-button"
              data-variant="secondary"
            >
              Abrir agenda
            </Link>
          }
          compact
        /><div className="mt-2">
          {occurrence.maintenances.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Chamado</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Agendada</th><th className="px-3 py-2">Concluída</th></tr></TableHead><tbody>
                  {occurrence.maintenances.map((item) => (
                    <tr key={item.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><TableCell><Link
                          href={`/chamados/${item.id}`}
                          className="font-medium text-white transition hover:text-white"
                        >
                          {item.code}
                        </Link><div className="mt-1 max-w-[360px] truncate text-[10px] text-slate-500">
                          {item.title}
                        </div></TableCell><TableCell className="text-slate-300">{maintenanceTypeLabel(item.type)}</TableCell><TableCell><TonePill tone={maintenanceStatusTone(item.status)}>
                          {maintenanceStatusLabel(item.status)}
                        </TonePill></TableCell><TableCell className="text-slate-400">{formatDateTime(item.scheduledAt)}</TableCell><TableCell className="text-slate-400">{formatDateTime(item.completedAt)}</TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum chamado vinculado"
              description="Chamados vinculados ao alerta."
            />
          )}
        </div></Surface>      </div>
    </NovaLitShell>
  );
}
