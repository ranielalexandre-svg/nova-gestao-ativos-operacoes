import Link from "next/link";
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
  buildWatchlist,
  formatMs,
  formatPercent,
  healthLabel,
  healthTone,
  type UnitHostTelemetry,
} from "@/lib/noc-overview";

function signalLine(telemetry: UnitHostTelemetry["items"][number]) {
  const parts = [
    telemetry.metrics.latencyMs ? formatMs(telemetry.metrics.latencyMs) : null,
    telemetry.metrics.lossPct ? formatPercent(telemetry.metrics.lossPct) : null,
    telemetry.problems.length ? `${telemetry.problems.length} problema(s)` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Sem sinais fora do esperado";
}

function isActionableWatchItem(item: UnitHostTelemetry["items"][number]) {
  return (
    item.health === "down" ||
    item.health === "degraded" ||
    item.health === "ambiguous" ||
    item.health === "unmapped" ||
    item.problems.length > 0 ||
    (item.metrics.lossPct ?? 0) >= 1.5 ||
    (item.metrics.latencyMs ?? 0) >= 140 ||
    (item.metrics.temperatureC ?? 0) >= 55
  );
}

export function UnitWatchlistPanel({
  telemetry,
  title = "Watchlist de unidades",
  description = "Unidades prioritárias do turno.",
  limit = 6,
  onlyActionable = false,
}: {
  telemetry: UnitHostTelemetry;
  title?: string;
  description?: string;
  limit?: number;
  onlyActionable?: boolean;
}) {
  const rows = (onlyActionable
    ? buildWatchlist(telemetry, Math.max(limit * 3, limit)).filter(isActionableWatchItem)
    : buildWatchlist(telemetry, limit)
  ).slice(0, limit);

  return (
    <Surface><SectionIntro eyebrow="Watchlist" title={title} description={description} compact /><div className="mt-2">
        {rows.length ? (
          <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Sinais</th><th className="px-3 py-2 text-right">Acesso</th></tr></TableHead><tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]"><TableCell><div className="font-semibold text-slate-50">
                        {item.unit.code} · {item.unit.name}
                      </div><div className="mt-1 text-[10px] text-slate-500">
                        {[item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "Local não informado"}
                      </div></TableCell><TableCell><div className="font-medium text-slate-200">{item.partner.name}</div><div className="mt-1 text-[10px] text-slate-500">{item.partner.code}</div></TableCell><TableCell><TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill></TableCell><TableCell className="text-slate-400">{signalLine(item)}</TableCell><TableCell className="text-right"><Link
                        href={`/unidades/${item.unit.id}`}
                        className="nds-button"
                        data-variant="secondary"
                      >
                        Abrir
                      </Link></TableCell></tr>
                ))}
              </tbody></DenseTable></TableShell>
        ) : (
          <EmptyState
            title={onlyActionable ? "Sem unidade pressionando o turno" : "Sem unidades em atenção"}
            description={onlyActionable ? "A lista foi reduzida para mostrar apenas offline, atenção, sem vínculo ou métrica fora do limite." : "Nenhum host deste recorte está pressionando a operação neste momento."}
          />
        )}
      </div></Surface>
  );
}
