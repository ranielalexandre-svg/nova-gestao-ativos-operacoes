import Link from "next/link";
import {
  formatMs,
  formatPercent,
  formatTemperature,
  healthLabel,
  healthTone,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { EmptyState, InlineStat, SectionIntro, Surface, TableActionLink, TonePill } from "@/components/ops-ui";

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
    <Surface><SectionIntro
        eyebrow="Host"
        title={title}
        description={description}
        compact
      />

      {!item ? (
        <div className="mt-2"><EmptyState
            title="Sem host relacionado"
            description="Ainda não foi possível ligar esta ficha a um host monitorado da unidade. A conferência continua em Monitoramento e Integrações."
            action={
              <Link
                href="/monitoramento/sensores"
                className="nds-button"
                data-variant="primary"
              >
                Abrir monitoramento
              </Link>
            }
            /></div>
      ) : (
        <><div className="mt-2 flex flex-wrap gap-2"><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill><TonePill tone={item.problems.length ? "critical" : "neutral"}>
              {item.problems.length} problema(s)
            </TonePill><TonePill tone={item.match.syncReady ? "success" : "attention"}>
              {item.match.syncReady ? "sync ready" : "revisar match"}
            </TonePill></div><div className="mt-2 grid gap-2"><InlineStat
              label="Host"
              value={item.match.hostName || item.match.host || "sem host"}
              tone={healthTone(item.health)}
            /><InlineStat
              label="Latência"
              value={formatMs(item.metrics.latencyMs)}
              tone={
                (item.metrics.latencyMs ?? 0) >= 140
                  ? "attention"
                  : item.metrics.latencyMs
                    ? "success"
                    : "neutral"
              }
            /><InlineStat
              label="Loss"
              value={formatPercent(item.metrics.lossPct)}
              tone={
                (item.metrics.lossPct ?? 0) >= 1.5
                  ? "attention"
                  : item.metrics.lossPct !== null
                    ? "success"
                    : "neutral"
              }
            /><InlineStat
              label="Temperatura"
              value={formatTemperature(item.metrics.temperatureC)}
              tone={
                (item.metrics.temperatureC ?? 0) >= 55
                  ? "attention"
                  : item.metrics.temperatureC !== null
                    ? "neutral"
                    : "neutral"
              }
            /></div><div className="nds-card mt-2"><div className="nds-label">
              Match operacional
            </div><div className="mt-2 text-[12px] font-bold text-slate-100">
              {item.match.status === "matched"
                ? "Ligação estável entre cadastro e host"
                : item.match.status === "ambiguous"
                  ? "Mais de um host possível para este cadastro"
                  : "Cadastro ainda sem host confirmado"}
            </div><div className="mt-2 text-[11px] leading-5 text-[var(--nova-text-muted)]">
              Parceiro {item.partner.code} · {item.partner.name}
              {item.match.matchedBy.length ? ` · por ${item.match.matchedBy.join(", ")}` : ""}
            </div><div className="mt-1 text-[10px] text-slate-500">
              {item.equipments.length} ativo(s) ligado(s) a esta unidade na leitura atual.
            </div></div><div className="mt-2 flex flex-wrap gap-2"><Link
              href="/monitoramento/sensores"
              className="nds-button"
              data-variant="secondary"
            >
              Ver host
            </Link><TableActionLink
              href="/integracoes"
            >
              Ajustar integração
            </TableActionLink></div></>
      )}
    </Surface>
  );
}
