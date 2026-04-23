import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

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

function severityLabel(value: string) {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[value] || value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    open: "Aberta",
    investigating: "Em análise",
    resolved: "Resolvida",
    cancelled: "Cancelada",
  };
  return labels[value] || value;
}

function severityTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "neutral";
}

function statusTone(value: string) {
  if (value === "resolved") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "investigating") return "info";
  return "attention";
}

function maintenanceStatusTone(value: string) {
  if (value === "done") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "in_progress") return "info";
  return "attention";
}

function maintenanceStatusLabel(value: string) {
  const labels: Record<string, string> = {
    planned: "Planejada",
    in_progress: "Em execução",
    done: "Concluída",
    cancelled: "Cancelada",
  };
  return labels[value] || value;
}

function maintenanceTypeLabel(value: string) {
  const labels: Record<string, string> = {
    preventive: "Preventiva",
    corrective: "Corretiva",
    inspection: "Inspeção",
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

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ocorrencias");
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
  const canEditAttachments = ["admin", "editor"].includes(
    normalizeRole(session.user?.role || ""),
  );
  const connectedRoutes = [
    {
      href: "/operacao/fila?view=pending",
      title: "Voltar para a fila",
      description: "Se a ocorrência ainda pede triagem ou despacho, a ordem do turno continua na fila operacional.",
      badge: <TonePill tone="info">fila</TonePill>,
    },
    {
      href: "/manutencoes",
      title: "Abrir agenda técnica",
      description: "Use a agenda quando o incidente já virou ação planejada, execução ou acompanhamento em campo.",
      badge: <TonePill tone="success">agenda</TonePill>,
    },
    {
      href: "/monitoramento",
      title: "Cruzar com host e eventos",
      description: "Veja o estado real do host da unidade antes de decidir acionamento, escalada ou fechamento.",
      badge: <TonePill tone="attention">NOC</TonePill>,
    },
  ];

  return (
    <AppShell
      title={`${occurrence.code} · ${occurrence.title}`}
      subtitle="Ficha operacional da ocorrência, vínculos e ações relacionadas."
    >
      <RegistryDetailHero
        eyebrow="Ocorrência"
        title={occurrence.title}
        description={occurrence.description || "Sem descrição complementar registrada."}
        badges={
          <>
            <TonePill tone={severityTone(occurrence.severity)}>
              {severityLabel(occurrence.severity)}
            </TonePill>
            <TonePill tone={statusTone(occurrence.status)}>
              {statusLabel(occurrence.status)}
            </TonePill>
            {occurrence.source ? <TonePill tone="subtle">{occurrence.source}</TonePill> : null}
          </>
        }
        meta={
          <>
            <span>{occurrence.code}</span>
            <span className="text-slate-700">•</span>
            <span>Criada em {formatDateTime(occurrence.createdAt)}</span>
            <span className="text-slate-700">•</span>
            <span>Atualizada em {formatDateTime(occurrence.updatedAt)}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/ocorrencias"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Voltar
            </Link>
            <Link
              href="/operacao/fila?view=pending"
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
            label: "Manutenções",
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
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Resumo"
            title="Contexto do incidente"
            description="Entidade afetada, código e vínculo operacional em uma ficha mais direta."
            compact
          />

          <div className="mt-5">
            <RegistryInfoGrid
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
                  label: "Equipamento",
                  value: occurrence.equipment
                    ? `${occurrence.equipment.tag} - ${occurrence.equipment.name}`
                    : "-",
                  span: "full",
                },
              ]}
            />
          </div>
        </Surface>

        <div className="grid gap-5">
          <LinkedHostPanel
            item={linkedHost}
            title="Host da unidade afetada"
            description="Quando existe correspondência entre cadastro e host, a ficha já mostra o sinal técnico que ajuda a decidir o próximo passo."
          />

          <WorkflowStatsPanel
            eyebrow="Turno"
            title="Leitura rápida do caso"
            description="O ponto aqui é saber se o caso pede fila, agenda técnica ou monitoramento antes de abrir mais telas."
            stats={[
              {
                label: "Manutenções abertas",
                value: openMaintenances,
                tone: openMaintenances ? "attention" : "neutral",
              },
              {
                label: "Manutenções agendadas",
                value: scheduledMaintenances,
                tone: scheduledMaintenances ? "info" : "neutral",
              },
              {
                label: "Críticas no turno",
                value: commandCenter.metrics.criticalOpenOccurrences,
                tone: commandCenter.metrics.criticalOpenOccurrences ? "critical" : "neutral",
              },
              {
                label: "Manutenções vencidas",
                value: commandCenter.metrics.overdueMaintenances,
                tone: commandCenter.metrics.overdueMaintenances ? "attention" : "neutral",
              },
            ]}
          />

          <ConnectedRoutesPanel
            eyebrow="Trilha"
            title="Rotas que completam o caso"
            description="Essas rotas continuam a operação sem repetir navegação de enfeite."
            routes={connectedRoutes}
          />

          <Surface className="p-5 sm:p-6">
            <SectionIntro
              eyebrow="Vínculos"
              title="Abrir relacionados"
              description="Use estes atalhos quando o trabalho exigir contexto de parceiro, unidade ou equipamento."
              compact
            />
            <div className="mt-5 grid gap-3">
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
                  href={`/equipamentos/${occurrence.equipment.id}`}
                  label="Equipamento"
                  value={`${occurrence.equipment.tag} · ${occurrence.equipment.name}`}
                />
              ) : null}
              {!occurrence.partner && !occurrence.unit && !occurrence.equipment ? (
                <EmptyState
                  title="Sem vínculos"
                  description="A ocorrência ainda não aponta para parceiro, unidade ou equipamento."
                />
              ) : null}
            </div>
          </Surface>
        </div>
      </section>

      <AttachmentPanel
        entityPath="occurrences"
        entityId={occurrence.id}
        entityLabel="ocorrência"
        returnPath={`/ocorrencias/${occurrence.id}`}
        canEdit={canEditAttachments}
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Agenda"
          title="Manutenções vinculadas"
          description="Ações abertas ou já executadas para resolver ou acompanhar este incidente."
          actions={
            <Link
              href="/manutencoes"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Abrir agenda
            </Link>
          }
          compact
        />

        <div className="mt-5">
          {occurrence.maintenances.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Manutenção</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Agendada</th>
                    <th className="px-4 py-3">Concluída</th>
                  </tr>
                </TableHead>
                <tbody>
                  {occurrence.maintenances.map((item) => (
                    <tr key={item.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                      <TableCell>
                        <Link
                          href={`/manutencoes/${item.id}`}
                          className="font-medium text-white transition hover:text-sky-200"
                        >
                          {item.code}
                        </Link>
                        <div className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                          {item.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{maintenanceTypeLabel(item.type)}</TableCell>
                      <TableCell>
                        <TonePill tone={maintenanceStatusTone(item.status)}>
                          {maintenanceStatusLabel(item.status)}
                        </TonePill>
                      </TableCell>
                      <TableCell className="text-slate-400">{formatDateTime(item.scheduledAt)}</TableCell>
                      <TableCell className="text-slate-400">{formatDateTime(item.completedAt)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </DenseTable>
            </TableShell>
          ) : (
            <EmptyState
              title="Nenhuma manutenção vinculada"
              description="Quando uma manutenção for vinculada à ocorrência, ela aparecerá nesta mesa."
            />
          )}
        </div>
      </Surface>
    </AppShell>
  );
}
