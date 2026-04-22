import Link from "next/link";
import {
  formatMs,
  formatPercent,
  formatTemperature,
  healthLabel,
  healthTone,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { EmptyState, InlineStat, SectionIntro, Surface, TonePill } from "@/components/ops-ui";

export function LinkedHostPanel({
  item,
  title = "Host vinculado à unidade",
  description = "Quando existe match entre cadastro e host monitorado, a ficha mostra o contexto técnico sem tirar você da operação.",
}: {
  item: UnitHostTelemetryItem | null;
  title?: string;
  description?: string;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow="Host"
        title={title}
        description={description}
        compact
      />

      {!item ? (
        <div className="mt-4">
          <EmptyState
            title="Sem host relacionado"
            description="Ainda não foi possível ligar esta ficha a um host monitorado da unidade. A conferência continua em Monitoramento e Integrações."
            action={
              <Link
                href="/monitoramento"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Abrir monitoramento
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
            <TonePill tone={item.problems.length ? "critical" : "neutral"}>
              {item.problems.length} problema(s)
            </TonePill>
            <TonePill tone={item.match.syncReady ? "success" : "attention"}>
              {item.match.syncReady ? "sync ready" : "revisar match"}
            </TonePill>
          </div>

          <div className="mt-4 grid gap-3">
            <InlineStat
              label="Host"
              value={item.match.hostName || item.match.host || "sem host"}
              tone={healthTone(item.health)}
            />
            <InlineStat
              label="Latência"
              value={formatMs(item.metrics.latencyMs)}
              tone={
                (item.metrics.latencyMs ?? 0) >= 140
                  ? "attention"
                  : item.metrics.latencyMs
                    ? "success"
                    : "neutral"
              }
            />
            <InlineStat
              label="Loss"
              value={formatPercent(item.metrics.lossPct)}
              tone={
                (item.metrics.lossPct ?? 0) >= 1.5
                  ? "attention"
                  : item.metrics.lossPct !== null
                    ? "success"
                    : "neutral"
              }
            />
            <InlineStat
              label="Temperatura"
              value={formatTemperature(item.metrics.temperatureC)}
              tone={
                (item.metrics.temperatureC ?? 0) >= 55
                  ? "attention"
                  : item.metrics.temperatureC !== null
                    ? "neutral"
                    : "neutral"
              }
            />
          </div>

          <div className="mt-4 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Match operacional
            </div>
            <div className="mt-2 text-sm font-medium text-slate-100">
              {item.match.status === "matched"
                ? "Ligação estável entre cadastro e host"
                : item.match.status === "ambiguous"
                  ? "Mais de um host possível para este cadastro"
                  : "Cadastro ainda sem host confirmado"}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              Parceiro {item.partner.code} · {item.partner.name}
              {item.match.matchedBy.length ? ` · por ${item.match.matchedBy.join(", ")}` : ""}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {item.equipments.length} equipamento(s) ligado(s) a esta unidade na leitura atual.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/monitoramento"
              className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Ver host no monitoramento
            </Link>
            <Link
              href="/integracoes"
              className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              Ajustar integração
            </Link>
          </div>
        </>
      )}
    </Surface>
  );
}
