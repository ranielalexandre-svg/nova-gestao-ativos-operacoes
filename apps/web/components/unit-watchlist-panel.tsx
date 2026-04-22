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

export function UnitWatchlistPanel({
  telemetry,
  title = "Watchlist de unidades",
  description = "Leitura curta das unidades que mais tendem a mudar a resposta do turno.",
  limit = 6,
}: {
  telemetry: UnitHostTelemetry;
  title?: string;
  description?: string;
  limit?: number;
}) {
  const rows = buildWatchlist(telemetry, limit);

  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro eyebrow="Watchlist" title={title} description={description} compact />

      <div className="mt-4">
        {rows.length ? (
          <TableShell>
            <DenseTable>
              <TableHead>
                <tr>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Sinais</th>
                  <th className="px-4 py-3 text-right">Acesso</th>
                </tr>
              </TableHead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.unit.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]">
                    <TableCell>
                      <div className="font-semibold text-slate-50">
                        {item.unit.code} · {item.unit.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[item.unit.city, item.unit.state].filter(Boolean).join(" / ") || "Local não informado"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-200">{item.partner.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.partner.code}</div>
                    </TableCell>
                    <TableCell>
                      <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                    </TableCell>
                    <TableCell className="text-slate-400">{signalLine(item)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/unidades/${item.unit.id}`}
                        className="inline-flex rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/18 hover:bg-white/[0.08]"
                      >
                        Abrir unidade
                      </Link>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </DenseTable>
          </TableShell>
        ) : (
          <EmptyState
            title="Sem unidades em atenção"
            description="Nenhum host deste recorte está pressionando a operação neste momento."
          />
        )}
      </div>
    </Surface>
  );
}
