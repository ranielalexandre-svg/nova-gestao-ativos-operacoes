import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartCard, EmptyState, RightPanel, StatCard, Surface, TableCell, TonePill } from "@/components/ops-ui";
import {
  buildWatchlist,
  formatMs,
  formatPercent,
  healthLabel,
  healthTone,
  readUnitHostTelemetry,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

function cityKey(city: string | null, state: string | null) {
  return [city || "Sem cidade", state || ""].filter(Boolean).join("/");
}

function markerPosition(index: number) {
  const positions = [
    [18, 28],
    [30, 46],
    [44, 34],
    [56, 58],
    [68, 42],
    [76, 66],
    [38, 70],
    [62, 24],
  ];
  return positions[index % positions.length];
}

export default async function MapasPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/mapas");

  const telemetry = await readUnitHostTelemetry({ timeoutMs: 1200 });
  const watchlist = buildWatchlist(telemetry, 6);
  const cityMap = new Map<string, { total: number; degraded: number; down: number }>();

  for (const item of telemetry.items) {
    const key = cityKey(item.unit.city, item.unit.state);
    const current = cityMap.get(key) || { total: 0, degraded: 0, down: 0 };
    current.total += 1;
    if (item.health === "degraded" || item.health === "ambiguous") current.degraded += 1;
    if (item.health === "down") current.down += 1;
    cityMap.set(key, current);
  }

  const cities = Array.from(cityMap.entries()).slice(0, 8);

  return (
    <AppShell title="Mapas" subtitle="Mapa operacional de unidades, camadas e alertas por localidade.">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Unidades" value={telemetry.counts.units} detail="na visão de monitoramento" tone="info" />
            <StatCard label="Online" value={telemetry.counts.online} detail="hosts com leitura saudável" tone="success" />
            <StatCard label="Atenção" value={telemetry.counts.degraded + telemetry.counts.ambiguous} detail="degradado ou ambíguo" tone="attention" />
            <StatCard label="Offline" value={telemetry.counts.down} detail="hosts indisponíveis" tone="critical" />
          </div>

          <Surface className="min-h-[380px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Mapa técnico</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Cobertura por cidade</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <TonePill tone="success">online</TonePill>
                <TonePill tone="attention">atenção</TonePill>
                <TonePill tone="critical">offline</TonePill>
              </div>
            </div>

            <div className="relative mt-3 min-h-[300px] overflow-hidden rounded-[8px] border border-white/[0.08] bg-[radial-gradient(circle_at_52%_45%,rgba(249,115,22,0.14),transparent_10rem),linear-gradient(135deg,#0b121b,#070b10)]">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div className="absolute left-[10%] top-[18%] h-[62%] w-[78%] rounded-[48%] border border-orange-300/20 bg-orange-500/[0.025]" />
              {cities.length ? (
                cities.map(([label, data], index) => {
                  const [left, top] = markerPosition(index);
                  const tone = data.down ? "critical" : data.degraded ? "attention" : "success";
                  const color = tone === "critical" ? "bg-rose-400" : tone === "attention" ? "bg-amber-400" : "bg-emerald-400";
                  return (
                    <Link
                      key={label}
                      href={`/unidades?q=${encodeURIComponent(label.split("/")[0])}`}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded border border-white/10 bg-[#121923] px-2 py-1.5 text-[10px] font-bold text-white shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:border-orange-300/40"
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${color}`} />
                      {label} · {data.total}
                    </Link>
                  );
                })
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate-500">
                  Nenhuma localidade disponível na telemetria atual.
                </div>
              )}
            </div>
          </Surface>
        </div>

        <RightPanel title="Camadas" description="Controles operacionais do mapa.">
          <div className="grid gap-2">
            {["Unidades monitoradas", "Alertas ativos", "Parceiros", "Starlinks", "Chamados em campo"].map((layer, index) => (
              <label key={layer} className="flex items-center justify-between gap-3 rounded-[12px] border border-white/[0.08] bg-[#070b10] px-3 py-3 text-sm text-slate-200">
                <span>{layer}</span>
                <input type="checkbox" defaultChecked={index < 3} />
              </label>
            ))}
          </div>
          <ChartCard title="Densidade de ocorrências" subtitle="placeholder até integrar mapa GIS" tone="attention" />
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-3">
            <div className="text-sm font-black text-white">Unidades críticas</div>
            <div className="mt-3 grid gap-2">
              {watchlist.length ? watchlist.map((item) => (
                <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 text-sm hover:border-orange-300/30">
                  <div className="font-bold text-white">{item.unit.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{cityKey(item.unit.city, item.unit.state)} · {item.partner.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                    <TonePill tone="neutral">{formatMs(item.metrics.latencyMs)}</TonePill>
                    <TonePill tone="neutral">loss {formatPercent(item.metrics.lossPct)}</TonePill>
                  </div>
                </Link>
              )) : <EmptyState title="Sem alertas" description="Nenhuma unidade crítica no momento." />}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
