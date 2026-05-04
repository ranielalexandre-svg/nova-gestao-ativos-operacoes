import Link from "next/link";
import { EmptyState, SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import {
  targetLabel,
  type CommandCenter,
  type RecentMaintenance,
  type RecentOccurrence,
} from "@/lib/noc-overview";

function occurrenceTone(item: RecentOccurrence) {
  if (item.severity === "critical") return "critical";
  if (item.severity === "high" || item.status !== "closed") return "attention";
  return "neutral";
}

function maintenanceTone(item: RecentMaintenance) {
  if (item.status === "overdue") return "critical";
  if (item.status === "scheduled" || item.status === "in_progress") return "attention";
  if (item.status === "completed") return "success";
  return "neutral";
}

export function RecentOccurrencesPanel({
  commandCenter,
  title = "Alertas recentes",
  description = "Eventos internos mais novos para cruzar com a leitura do turno.",
}: {
  commandCenter: CommandCenter;
  title?: string;
  description?: string;
}) {
  return (
    <Surface><SectionIntro
        eyebrow="Alertas"
        title={title}
        description={description}
        actions={
          <Link href="/alertas" className="nds-button" data-variant="secondary">
            Ver todas
          </Link>
        }
        compact
      /><div className="mt-2 grid gap-2">
        {commandCenter.recentOccurrences.length ? (
          commandCenter.recentOccurrences.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`/alertas/${item.id}`}
              className="nds-card block transition"
            ><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[12px] font-bold text-slate-50">
                    {item.code} · {item.title}
                  </div><div className="mt-1 truncate text-[10px] text-slate-500">{targetLabel(item)}</div></div><TonePill tone={occurrenceTone(item)}>{item.severity}</TonePill></div></Link>
          ))
        ) : (
          <EmptyState
            title="Sem alertas recentes"
            description="Nenhum alerta foi retornado por este recorte."
          />
        )}
      </div></Surface>
  );
}

export function RecentMaintenancesPanel({
  commandCenter,
  title = "Chamados recentes",
  description = "Ações em andamento ou concluídas há pouco para contextualizar a operação.",
}: {
  commandCenter: CommandCenter;
  title?: string;
  description?: string;
}) {
  return (
    <Surface><SectionIntro
        eyebrow="Chamados"
        title={title}
        description={description}
        actions={
          <Link href="/chamados" className="nds-button" data-variant="secondary">
            Ver todas
          </Link>
        }
        compact
      /><div className="mt-2 grid gap-2">
        {commandCenter.recentMaintenances.length ? (
          commandCenter.recentMaintenances.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`/chamados/${item.id}`}
              className="nds-card block transition"
            ><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[12px] font-bold text-slate-50">
                    {item.code} · {item.title}
                  </div><div className="mt-1 truncate text-[10px] text-slate-500">{targetLabel(item)}</div></div><TonePill tone={maintenanceTone(item)}>{item.status}</TonePill></div></Link>
          ))
        ) : (
          <EmptyState
            title="Sem chamados recentes"
            description="Nenhum chamado foi retornado por este recorte."
          />
        )}
      </div></Surface>
  );
}
