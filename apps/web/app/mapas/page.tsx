import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarList, EmptyState, RightPanel, Surface, TonePill } from "@/components/ops-ui";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  buildWatchlist,
  emptyCommandCenter,
  formatMs,
  formatPercent,
  healthLabel,
  healthTone,
  readUnitHostTelemetry,
  safeApiJson,
  type CommandCenter,
} from "@/lib/noc-overview";
import { getServerWebSession } from "@/lib/web-session";

function cityKey(city: string | null, state: string | null) {
  return [city || "Sem cidade", state || ""].filter(Boolean).join("/");
}

// TODO: substituir por latitude/longitude reais da API de unidades quando esses campos existirem.
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "agua fria de goias|go": { lat: -14.9846, lon: -47.7823 },
  "agua fria de goiás|go": { lat: -14.9846, lon: -47.7823 },
  "agua fria de goias|to": { lat: -14.9846, lon: -47.7823 },
  "araguaina|to": { lat: -7.1911, lon: -48.2072 },
  "araguatins|to": { lat: -5.6539, lon: -48.1233 },
  "aragominas|to": { lat: -7.1603, lon: -48.5294 },
  "araguana|to": { lat: -6.5850, lon: -48.6469 },
  "araguanã|to": { lat: -6.5850, lon: -48.6469 },
  "araguaçu|to": { lat: -12.9299, lon: -49.8268 },
  "araguacu|to": { lat: -12.9299, lon: -49.8268 },
  "arraias|to": { lat: -12.9287, lon: -46.9359 },
  "augustinopolis|to": { lat: -5.4686, lon: -47.8866 },
  "augustinópolis|to": { lat: -5.4686, lon: -47.8866 },
  "alvorada|to": { lat: -12.4785, lon: -49.1249 },
  "almas|to": { lat: -11.5706, lon: -47.1795 },
  "ananás|to": { lat: -6.3640, lon: -48.0737 },
  "ananas|to": { lat: -6.3640, lon: -48.0737 },
  "aparecida do rio negro|to": { lat: -9.9414, lon: -47.9690 },
  "axixa do tocantins|to": { lat: -5.6122, lon: -47.7717 },
  "axixá do tocantins|to": { lat: -5.6122, lon: -47.7717 },
  "babaculandia|to": { lat: -7.2047, lon: -47.7596 },
  "babaçulandia|to": { lat: -7.2047, lon: -47.7596 },
  "babaçulândia|to": { lat: -7.2047, lon: -47.7596 },
  "bandeirantes do tocantins|to": { lat: -7.7561, lon: -48.5832 },
  "brasilandia do tocantins|to": { lat: -8.3895, lon: -48.4820 },
  "brasilândia do tocantins|to": { lat: -8.3895, lon: -48.4820 },
  "buriti do tocantins|to": { lat: -5.3145, lon: -48.2270 },
  "campos lindos|to": { lat: -7.9896, lon: -46.8648 },
  "carrasco bonito|to": { lat: -5.3206, lon: -48.0359 },
  "carmolândia|to": { lat: -7.0335, lon: -48.3977 },
  "carmolandia|to": { lat: -7.0335, lon: -48.3977 },
  "colméia|to": { lat: -8.7246, lon: -48.7637 },
  "colmeia|to": { lat: -8.7246, lon: -48.7637 },
  "colinas do tocantins|to": { lat: -8.0576, lon: -48.4757 },
  "darcinopolis|to": { lat: -6.7159, lon: -47.7597 },
  "darcinópolis|to": { lat: -6.7159, lon: -47.7597 },
  "dianópolis|to": { lat: -11.6240, lon: -46.8197 },
  "dianopolis|to": { lat: -11.6240, lon: -46.8197 },
  "esperantina|to": { lat: -5.3661, lon: -48.5370 },
  "filadélfia|to": { lat: -7.3350, lon: -47.4954 },
  "filadelfia|to": { lat: -7.3350, lon: -47.4954 },
  "formoso do araguaia|to": { lat: -11.7976, lon: -49.5316 },
  "fortaleza do tabocao|to": { lat: -9.0561, lon: -48.5206 },
  "fortaleza do tabocão|to": { lat: -9.0561, lon: -48.5206 },
  "goiatins|to": { lat: -7.7148, lon: -47.3216 },
  "gurupi|to": { lat: -11.7292, lon: -49.0686 },
  "guaraí|to": { lat: -8.8354, lon: -48.5114 },
  "guarai|to": { lat: -8.8354, lon: -48.5114 },
  "itacajá|to": { lat: -8.3929, lon: -47.7738 },
  "itacaja|to": { lat: -8.3929, lon: -47.7738 },
  "itaguatins|to": { lat: -5.7712, lon: -47.4867 },
  "lagoa da confusao|to": { lat: -10.7906, lon: -49.6199 },
  "lagoa da confusão|to": { lat: -10.7906, lon: -49.6199 },
  "lizarda|to": { lat: -9.5894, lon: -46.6734 },
  "mateiros|to": { lat: -10.5444, lon: -46.4160 },
  "maurilandia do tocantins|to": { lat: -5.9515, lon: -47.5124 },
  "maurilândia do tocantins|to": { lat: -5.9515, lon: -47.5124 },
  "miracema do tocantins|to": { lat: -9.5656, lon: -48.3962 },
  "miranorte|to": { lat: -9.5291, lon: -48.5922 },
  "muricilandia|to": { lat: -7.1460, lon: -48.6091 },
  "muricilândia|to": { lat: -7.1460, lon: -48.6091 },
  "natividade|to": { lat: -11.7034, lon: -47.7223 },
  "nazare|to": { lat: -6.3722, lon: -47.6649 },
  "nazaré|to": { lat: -6.3722, lon: -47.6649 },
  "novo acordo|to": { lat: -9.9706, lon: -47.6785 },
  "palmas|to": { lat: -10.2491, lon: -48.3243 },
  "paraíso do tocantins|to": { lat: -10.1753, lon: -48.8823 },
  "paraiso do tocantins|to": { lat: -10.1753, lon: -48.8823 },
  "pau d'arco|to": { lat: -7.5406, lon: -49.3733 },
  "pau darco|to": { lat: -7.5406, lon: -49.3733 },
  "pedro afonso|to": { lat: -8.9703, lon: -48.1729 },
  "peixe|to": { lat: -12.0256, lon: -48.5393 },
  "porto nacional|to": { lat: -10.7070, lon: -48.4170 },
  "praia norte|to": { lat: -5.3927, lon: -47.8119 },
  "presidente kennedy|to": { lat: -8.5406, lon: -48.5068 },
  "riachinho|to": { lat: -6.4328, lon: -48.1370 },
  "rio sono|to": { lat: -9.3454, lon: -47.9006 },
  "sampaio|to": { lat: -5.3475, lon: -47.8787 },
  "santa terezinha do tocantins|to": { lat: -6.4383, lon: -47.6684 },
  "sao bento do tocantins|to": { lat: -6.0267, lon: -47.9022 },
  "são bento do tocantins|to": { lat: -6.0267, lon: -47.9022 },
  "sitio novo do tocantins|to": { lat: -5.6019, lon: -47.6381 },
  "sítio novo do tocantins|to": { lat: -5.6019, lon: -47.6381 },
  "taguatinga|to": { lat: -12.4026, lon: -46.4366 },
  "talismã|to": { lat: -12.7949, lon: -49.0896 },
  "talisma|to": { lat: -12.7949, lon: -49.0896 },
  "tocantinópolis|to": { lat: -6.3256, lon: -47.4223 },
  "tocantinopolis|to": { lat: -6.3256, lon: -47.4223 },
  "tupirama|to": { lat: -8.9710, lon: -48.1883 },
  "tupiratins|to": { lat: -8.3931, lon: -48.1270 },
  "wanderlandia|to": { lat: -6.8527, lon: -47.9606 },
  "wanderlândia|to": { lat: -6.8527, lon: -47.9606 },
  "xambioa|to": { lat: -6.4141, lon: -48.5320 },
  "xambioá|to": { lat: -6.4141, lon: -48.5320 },
};

const TILE_SIZE = 256;

const MAP_LAYERS = [
  { key: "units", label: "Unidades monitoradas" },
  { key: "alerts", label: "Alertas ativos" },
] as const;

type MapLayer = (typeof MAP_LAYERS)[number]["key"];

function readMapLayers(value: string) {
  const rawLayers = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!rawLayers.length) return new Set<MapLayer>(["units", "alerts"]);

  const layers = new Set<MapLayer>();
  for (const layer of rawLayers) {
    if (MAP_LAYERS.some((item) => item.key === layer)) {
      layers.add(layer as MapLayer);
    }
  }

  return layers;
}
const MAP_ASPECT = 1.45;

type CityAggregate = {
  label: string;
  city: string;
  state: string;
  total: number;
  degraded: number;
  down: number;
  lat?: number;
  lon?: number;
};

function normalizeLocationKey(city: string, state: string) {
  return `${city.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}|${state.trim().toLowerCase()}`;
}

function cityCoords(city: string, state: string) {
  const exact = `${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
  return CITY_COORDS[exact] || CITY_COORDS[normalizeLocationKey(city, state)];
}

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE_SIZE * 2 ** zoom;
}

function pointAt(lat: number, lon: number, zoom: number) {
  return { x: lonToTileX(lon, zoom), y: latToTileY(lat, zoom) };
}

function mapZoomFor(cities: CityAggregate[]) {
  if (cities.length <= 1) return 8;

  const lats = cities.map((item) => item.lat ?? 0);
  const lons = cities.map((item) => item.lon ?? 0);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  const span = Math.max(latSpan, lonSpan);

  if (span <= 1.2) return 9;
  if (span <= 2.6) return 8;
  if (span <= 5.2) return 7;
  return 6;
}

function buildMapView(cities: CityAggregate[]) {
  const located = cities.filter((city): city is CityAggregate & { lat: number; lon: number } => (
    typeof city.lat === "number" && typeof city.lon === "number"
  ));
  const zoom = mapZoomFor(located);
  const fallbackCenter = pointAt(-10.25, -48.32, zoom);
  const points = located.map((city) => ({ city, ...pointAt(city.lat, city.lon, zoom) }));
  const xs = points.length ? points.map((point) => point.x) : [fallbackCenter.x];
  const ys = points.length ? points.map((point) => point.y) : [fallbackCenter.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const spanX = Math.max(180, maxX - minX);
  const spanY = Math.max(130, maxY - minY);
  const width = Math.max(spanX * 1.42, spanY * MAP_ASPECT * 1.42, 640);
  const height = width / MAP_ASPECT;
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  const right = left + width;
  const bottom = top + height;
  const minTileX = Math.floor(left / TILE_SIZE);
  const maxTileX = Math.floor(right / TILE_SIZE);
  const minTileY = Math.floor(top / TILE_SIZE);
  const maxTileY = Math.floor(bottom / TILE_SIZE);
  const tiles: Array<{ key: string; src: string; left: number; top: number; width: number; height: number }> = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        left: ((x * TILE_SIZE - left) / width) * 100,
        top: ((y * TILE_SIZE - top) / height) * 100,
        width: (TILE_SIZE / width) * 100,
        height: (TILE_SIZE / height) * 100,
      });
    }
  }

  const markers = points.map(({ city, x, y }) => ({
    ...city,
    left: ((x - left) / width) * 100,
    top: ((y - top) / height) * 100,
  }));

  return { tiles, markers };
}

export default async function MapasPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/mapas");

  const params = await resolveSearchParams(searchParams);
  const activeLayers = readMapLayers(readStringParam(params, "layers", "units,alerts"));
  const showUnits = activeLayers.has("units");
  const showAlerts = activeLayers.has("alerts");
  const [telemetry, commandCenter] = await Promise.all([
    readUnitHostTelemetry({ timeoutMs: 1200 }),
    safeApiJson<CommandCenter>("/monitoring/command-center", emptyCommandCenter()),
  ]);
  const watchlist = buildWatchlist(telemetry, 6);
  const attention = telemetry.counts.degraded + telemetry.counts.ambiguous;
  const cityMap = new Map<string, CityAggregate>();
  const telemetryByUnitId = new Map(telemetry.items.map((item) => [item.unit.id, item]));
  const occurrenceCityMap = new Map<string, { total: number; critical: number; attention: number }>();

  for (const item of telemetry.items) {
    const key = cityKey(item.unit.city, item.unit.state);
    const city = item.unit.city || "Sem cidade";
    const state = item.unit.state || "";
    const coords = cityCoords(city, state);
    const current = cityMap.get(key) || {
      label: key,
      city,
      state,
      total: 0,
      degraded: 0,
      down: 0,
      lat: coords?.lat,
      lon: coords?.lon,
    };
    current.total += 1;
    if (item.health === "degraded" || item.health === "ambiguous") current.degraded += 1;
    if (item.health === "down") current.down += 1;
    cityMap.set(key, current);
  }

  for (const occurrence of commandCenter.recentOccurrences) {
    const unitTelemetry = occurrence.unit ? telemetryByUnitId.get(occurrence.unit.id) : null;
    const key = unitTelemetry ? cityKey(unitTelemetry.unit.city, unitTelemetry.unit.state) : "Sem localidade";
    const current = occurrenceCityMap.get(key) || { total: 0, critical: 0, attention: 0 };
    current.total += 1;
    if (occurrence.severity === "critical") current.critical += 1;
    if (occurrence.severity === "high" || occurrence.severity === "medium") current.attention += 1;
    occurrenceCityMap.set(key, current);
  }

  const cities = Array.from(cityMap.values())
    .sort((a, b) => b.down - a.down || b.degraded - a.degraded || b.total - a.total)
    .slice(0, 14);
  const locatedCities = cities.filter((city) => typeof city.lat === "number" && typeof city.lon === "number");
  const unlocatedCities = cities.filter((city) => typeof city.lat !== "number" || typeof city.lon !== "number");
  const visibleLocatedCities = showUnits ? locatedCities : [];
  const mapView = buildMapView(visibleLocatedCities);
  const occurrenceDensity = Array.from(occurrenceCityMap.entries())
    .sort((a, b) => b[1].critical - a[1].critical || b[1].attention - a[1].attention || b[1].total - a[1].total)
    .slice(0, 6)
    .map(([label, data]) => ({
      label,
      value: data.total,
      tone: data.critical ? "critical" : data.attention ? "attention" : "info",
      meta: data.critical ? `${data.critical} crítica(s)` : data.attention ? `${data.attention} em atenção` : "sem severidade alta",
      href: `/alertas?q=${encodeURIComponent(label.split("/")[0])}`,
    }));
  const visibleOccurrenceDensity = showAlerts ? occurrenceDensity : [];
  const layerHref = (layer: MapLayer) => {
    const next = new Set(activeLayers);
    if (next.has(layer)) {
      next.delete(layer);
    } else {
      next.add(layer);
    }
    const value = MAP_LAYERS.map((item) => item.key).filter((key) => next.has(key)).join(",");
    return value ? `/mapas?layers=${value}` : "/mapas?layers=none";
  };

  return (
    <AppShell title="Mapas" subtitle="Mapa operacional de unidades, camadas e alertas por localidade.">
      <section className="nova-map-page-grid">
        <div className="nova-map-main-column">
          <Surface className="nova-map-surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Mapa técnico</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Cobertura por cidade</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <TonePill tone="success">online</TonePill>
                <TonePill tone="attention">atenção</TonePill>
                <TonePill tone="critical">offline</TonePill>
              </div>
            </div>

            <div className="nova-map-canvas mt-2">
              <div className="nova-map-tile-layer" aria-hidden="true">
                {mapView.tiles.map((tile) => (
                  <img
                    key={tile.key}
                    src={tile.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="nova-map-tile"
                    style={{
                      left: `${tile.left}%`,
                      top: `${tile.top}%`,
                      width: `${tile.width}%`,
                      height: `${tile.height}%`,
                    }}
                  />
                ))}
              </div>
              <div className="nova-map-caption">
                <span>{visibleLocatedCities.length} cidade(s) no mapa</span>
                <TonePill tone={telemetry.counts.down ? "critical" : attention ? "attention" : "success"}>
                  {telemetry.counts.down ? "offline" : attention ? "atenção" : "normal"}
                </TonePill>
              </div>
              <a
                className="nova-map-attribution"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap
              </a>
              {showUnits && mapView.markers.length ? (
                mapView.markers.map((data, index) => {
                  const tone = data.down ? "critical" : data.degraded ? "attention" : "success";
                  return (
                    <Link
                      key={data.label}
                      href={`/unidades?q=${encodeURIComponent(data.city)}`}
                      className="nova-map-point"
                      data-priority={index < 3 ? "high" : "normal"}
                      data-tone={tone}
                      title={`${data.label} · ${data.total} unidade(s)`}
                      style={{ left: `${data.left}%`, top: `${data.top}%` }}
                    >
                      <span>{data.total}</span>
                    </Link>
                  );
                })
              ) : (
                <div className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] text-slate-500">
                  {showUnits ? "Nenhuma cidade com coordenada confiável na telemetria atual." : "Camada de unidades desativada."}
                </div>
              )}
            </div>
          </Surface>
        </div>

        <RightPanel title="Camadas" description="Controles operacionais do mapa.">
          <div className="nova-map-summary-grid">
            {[
              { label: "Unidades", value: telemetry.counts.units, tone: "info" },
              { label: "Online", value: telemetry.counts.online, tone: "success" },
              { label: "Atenção", value: telemetry.counts.degraded + telemetry.counts.ambiguous, tone: "attention" },
              { label: "Offline", value: telemetry.counts.down, tone: "critical" },
            ].map((item) => (
              <div key={item.label} className="nova-map-summary-item" data-tone={item.tone}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            {MAP_LAYERS.map((layer) => (
              <Link key={layer.key} href={layerHref(layer.key)} className="nds-card flex items-center justify-between gap-2 text-[11px] text-slate-200">
                <span>{layer.label}</span>
                <span className="nds-toggle" data-checked={activeLayers.has(layer.key) ? "true" : "false"} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {showUnits ? <div className="nds-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-black text-white">Cidades no mapa</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">nomes fora do tile para nao poluir o mapa</div>
              </div>
              <TonePill tone="info">{visibleLocatedCities.length}</TonePill>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 min-[1900px]:grid-cols-1">
              {visibleLocatedCities.map((city) => {
                const tone = city.down ? "critical" : city.degraded ? "attention" : "success";
                return (
                  <Link
                    key={city.label}
                    href={`/unidades?q=${encodeURIComponent(city.city)}`}
                    className="rounded-[6px] border border-white/[0.06] bg-black/10 px-2 py-2 text-[11px] transition hover:border-[var(--nova-primary)]/30"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="nova-map-city-dot" data-tone={tone} />
                        <span className="min-w-0 truncate font-bold text-white">{city.label}</span>
                      </span>
                      <span className="shrink-0 font-black text-white">{city.total}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div> : null}
          {showAlerts ? <div className="nds-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-black text-white">Densidade de alertas</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">recentes por cidade da unidade</div>
              </div>
              <TonePill tone={visibleOccurrenceDensity.length ? "attention" : "success"}>{commandCenter.recentOccurrences.length}</TonePill>
            </div>
            <div className="mt-2">
              <BarList data={visibleOccurrenceDensity} emptyLabel="Nenhum alerta recente com localidade mapeada." />
            </div>
          </div> : null}
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Unidades críticas</div>
            <div className="mt-2 grid gap-2">
              {watchlist.length ? watchlist.map((item) => (
                <Link key={item.unit.id} href={`/unidades/${item.unit.id}`} className="nova-micro-link text-[11px]">
                  <div className="font-bold text-white">{item.unit.name}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{cityKey(item.unit.city, item.unit.state)} · {item.partner.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <TonePill tone={healthTone(item.health)}>{healthLabel(item.health)}</TonePill>
                    <TonePill tone="neutral">{formatMs(item.metrics.latencyMs)}</TonePill>
                    <TonePill tone="neutral">loss {formatPercent(item.metrics.lossPct)}</TonePill>
                  </div>
                </Link>
              )) : <EmptyState title="Sem alertas" description="Nenhuma unidade crítica no momento." />}
            </div>
          </div>
          {unlocatedCities.length ? (
            <div className="nds-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[12px] font-black text-white">Sem coordenada</div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">Cidades fora do dicionário local.</div>
                </div>
                <TonePill tone="attention">{unlocatedCities.length}</TonePill>
              </div>
              <div className="mt-2 grid gap-2">
                {unlocatedCities.slice(0, 5).map((city) => (
                  <Link key={city.label} href={`/unidades?q=${encodeURIComponent(city.city)}`} className="nds-card block text-[11px] hover:border-[var(--nova-primary)]/30">
                    <div className="font-bold text-white">{city.label}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{city.total} unidade(s)</div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </RightPanel>
      </section>
    </AppShell>
  );
}
