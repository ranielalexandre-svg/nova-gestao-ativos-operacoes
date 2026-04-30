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
  title = "Ocorrências recentes",
  description = "Eventos internos mais novos para cruzar com a leitura do turno.",
}: {
  commandCenter: CommandCenter;
  title?: string;
  description?: string;
}) {
  return (
    <Surface className="p-5 sm:p-6"><SectionIntro
        eyebrow="Ocorrências"
        title={title}
        description={description}
        actions={
          <Link href="/ocorrencias" className="text-xs font-semibold text-sky-200 transition hover:text-white">
            Ver todas
          </Link>
        }
        compact
      /><div className="mt-4 grid gap-2">
        {commandCenter.recentOccurrences.length ? (
          commandCenter.recentOccurrences.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`/ocorrencias/${item.id}`}
              className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-3 transition hover:border-white/14 hover:bg-[#111820]"
            ><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-50">
                    {item.code} · {item.title}
                  </div><div className="mt-1 truncate text-xs text-slate-500">{targetLabel(item)}</div></div><TonePill tone={occurrenceTone(item)}>{item.severity}</TonePill></div></Link>
          ))
        ) : (
          <EmptyState
            title="Sem ocorrências recentes"
            description="Nenhuma ocorrência foi retornada por este recorte."
          />
        )}
      </div></Surface>
  );
}

export function RecentMaintenancesPanel({
  commandCenter,
  title = "Manutenções recentes",
  description = "Ações em andamento ou concluídas há pouco para contextualizar a operação.",
}: {
  commandCenter: CommandCenter;
  title?: string;
  description?: string;
}) {
  return (
    <Surface className="p-5 sm:p-6"><SectionIntro
        eyebrow="Manutenções"
        title={title}
        description={description}
        actions={
          <Link href="/manutencoes" className="text-xs font-semibold text-sky-200 transition hover:text-white">
            Ver todas
          </Link>
        }
        compact
      /><div className="mt-4 grid gap-2">
        {commandCenter.recentMaintenances.length ? (
          commandCenter.recentMaintenances.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`/manutencoes/${item.id}`}
              className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-3 transition hover:border-white/14 hover:bg-[#111820]"
            ><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-50">
                    {item.code} · {item.title}
                  </div><div className="mt-1 truncate text-xs text-slate-500">{targetLabel(item)}</div></div><TonePill tone={maintenanceTone(item)}>{item.status}</TonePill></div></Link>
          ))
        ) : (
          <EmptyState
            title="Sem manutenções recentes"
            description="Nenhuma manutenção foi retornada por este recorte."
          />
        )}
      </div></Surface>
  );
}
