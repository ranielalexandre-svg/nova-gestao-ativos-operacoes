import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import {
  readUnitHostTelemetry,
  type UnitHostTelemetryItem,
} from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type StatusFilter = "all" | "active" | "stock" | "repair" | "retired";
type ActiveFilter = "all" | "true" | "false";
type TypeFilter = "all" | "starlink" | "onu" | "switch" | "outros";
type SortBy = "createdAt" | "tag" | "name" | "type" | "status";
type SortDir = "asc" | "desc";

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  partner: { id: string; code: string; name: string };
  _count: { equipments: number };
};

type EquipmentRow = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  unit: {
    id: string;
    code: string;
    name: string;
    partner: { id: string; code: string; name: string };
  };
};

type AtivosState = {
  q: string;
  unitId: string;
  status: StatusFilter;
  active: ActiveFilter;
  type: TypeFilter;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const statusOptions = ["all", "active", "stock", "repair", "retired"] as const;
const activeOptions = ["all", "true", "false"] as const;
const typeOptions = ["all", "starlink", "onu", "switch", "outros"] as const;
const sortByOptions = ["createdAt", "tag", "name", "type", "status"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const pageSizeOptions = [10, 20, 50] as const;

function stringOption<T extends readonly string[]>(options: T, value: string, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function statusLabel(value: string) {
  if (value === "active") return "Ativo";
  if (value === "stock") return "Estoque";
  if (value === "repair") return "Reparo";
  if (value === "retired") return "Retirado";
  return value || "Sem status";
}

function assetTypeLabel(value: string) {
  if (value === "starlink") return "Starlinks";
  if (value === "onu") return "ONUs";
  if (value === "switch") return "Switches";
  if (value === "outros") return "Outros / SAD";
  return "Inventário completo";
}

function statusTone(value: string, isActive: boolean): Tone {
  if (!isActive || value === "retired") return "slate";
  if (value === "active") return "green";
  if (value === "stock") return "blue";
  if (value === "repair") return "orange";
  return "blue";
}

function typeLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("starlink")) return "Starlink";
  if (normalized.includes("onu")) return "ONU";
  if (normalized.includes("router") || normalized.includes("roteador")) return "Roteador";
  if (normalized.includes("switch")) return "Switch";
  if (normalized.includes("radio") || normalized.includes("rádio")) return "Rádio";
  return value || "Ativo";
}

function typeTone(value: string): Tone {
  const normalized = value.toLowerCase();
  if (normalized.includes("starlink")) return "orange";
  if (normalized.includes("onu")) return "blue";
  if (normalized.includes("switch") || normalized.includes("router") || normalized.includes("roteador")) return "green";
  return "slate";
}

function monitorByUnit(telemetry: UnitHostTelemetryItem[] | null, unitId: string) {
  return telemetry?.find((item) => item.unit.id === unitId) || null;
}

function monitorTone(item: UnitHostTelemetryItem | null): Tone {
  if (!item) return "slate";
  if (item.health === "online") return "green";
  if (item.health === "down") return "red";
  if (item.health === "degraded" || item.health === "ambiguous") return "orange";
  return "slate";
}

function monitorLabel(item: UnitHostTelemetryItem | null) {
  if (!item) return "Vinculado à unidade";
  if (item.health === "online") return "Online";
  if (item.health === "degraded") return "Atenção";
  if (item.health === "down") return "Offline";
  if (item.health === "ambiguous") return "Ambíguo";
  if (item.health === "unmapped") return "Sem vínculo";
  return "Sem item";
}

function locationFromUnit(unit?: UnitOption | null) {
  if (!unit) return "";
  if (unit.city && unit.state) return `${unit.city}/${unit.state}`;
  return unit.city || unit.state || "";
}

function isStarlink(item: EquipmentRow) {
  const text = `${item.tag} ${item.name} ${item.type}`.toLowerCase();
  return text.includes("starlink");
}

function hasTrace(item: EquipmentRow) {
  return Boolean(item.serialNumber?.trim() || item.tag?.trim());
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: AtivosState): RawSearchParams {
  return {
    q: state.q || undefined,
    unitId: state.unitId || undefined,
    status: state.status,
    active: state.active,
    type: state.type !== "all" ? state.type : undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <article className="nova-lit-card nova-assets-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-assets-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-assets-progress">
      <div>
        <span>{label}</span>
        <b>{safe}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safe}%` }} />
      </i>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="nova-assets-empty">
      <div>N</div>
      <strong>Nenhum ativo encontrado</strong>
      <span>Ajuste os filtros ou limpe a busca para voltar ao inventário completo.</span>
    </div>
  );
}

export default async function AtivosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/ativos");

  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const params = await resolveSearchParams(searchParams);

  const state: AtivosState = {
    q: readStringParam(params, "q", ""),
    unitId: readStringParam(params, "unitId", ""),
    status: stringOption(statusOptions, readStringParam(params, "status", "all"), "all"),
    active: stringOption(activeOptions, readStringParam(params, "active", "true"), "true"),
    type: stringOption(typeOptions, readStringParam(params, "type", "all"), "all"),
    sortBy: stringOption(sortByOptions, readStringParam(params, "sortBy", "createdAt"), "createdAt"),
    sortDir: stringOption(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  let unitsResponse: PaginatedResponse<UnitOption> = {
    items: [],
    meta: { page: 1, pageSize: 100, total: 0, totalPages: 1, hasPrev: false, hasNext: false },
  };
  let response: PaginatedResponse<EquipmentRow> = {
    items: [],
    meta: { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1, hasPrev: false, hasNext: false },
  };
  let telemetry: UnitHostTelemetryItem[] | null = null;
  let error = "";

  try {
    [unitsResponse, response] = await Promise.all([
      apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
      apiJson<PaginatedResponse<EquipmentRow>>(
        `/equipments${buildApiQuery({
          q: state.q,
          unitId: state.unitId || undefined,
          status: state.status !== "all" ? state.status : undefined,
          active: state.active !== "all" ? state.active : undefined,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          page: state.page,
          pageSize: state.pageSize,
        })}`,
      ),
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar o inventário.";
  }

  try {
    telemetry = (await readUnitHostTelemetry({ timeoutMs: 1200, fast: true })).items;
  } catch {
    telemetry = null;
  }

  const unitById = new Map(unitsResponse.items.map((unit) => [unit.id, unit]));
  const rows = response.items;
  const activeOnPage = rows.filter((item) => item.isActive).length;
  const traceOnPage = rows.filter(hasTrace).length;
  const starlinksOnPage = rows.filter(isStarlink).length;
  const monitoredOnPage = rows.filter((item) => monitorByUnit(telemetry, item.unit.id)?.match.status === "matched").length;
  const attentionOnPage = rows.filter((item) => {
    const monitor = monitorByUnit(telemetry, item.unit.id);
    return Boolean(monitor && (monitor.health === "down" || monitor.health === "degraded" || monitor.health === "ambiguous" || monitor.problems.length));
  }).length;

  const currentParams = stateParams(state);
  const kpis = [
    { label: "Ativos", value: String(response.meta.total), hint: "resultado filtrado", tone: "blue" as const },
    { label: "Operando", value: String(activeOnPage), hint: `${percent(activeOnPage, rows.length)}% nesta página`, tone: activeOnPage ? "green" as const : "slate" as const },
    { label: "Rastreio", value: String(traceOnPage), hint: "tag ou serial", tone: traceOnPage ? "green" as const : "orange" as const },
    { label: "Starlinks", value: String(starlinksOnPage), hint: "recorte satelital", tone: starlinksOnPage ? "orange" as const : "slate" as const },
    { label: "Monitorados", value: String(monitoredOnPage), hint: attentionOnPage ? `${attentionOnPage} em atenção` : "host da unidade", tone: attentionOnPage ? "orange" as const : monitoredOnPage ? "green" as const : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/ativos">
      <div className="nova-lit-page-heading nova-assets-heading">
        <div>
          <h1>Ativos</h1>
          <p className="nova-lit-page-subtitle">Inventário técnico por unidade, com Starlinks, rastreabilidade e status operacional.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/ativos/onus" className="nova-lit-button nova-lit-button-secondary">ONUs</Link>
          <Link href="/ativos/starlinks" className="nova-lit-button nova-lit-button-secondary">Starlinks</Link>
          {isAdmin ? <Link href="/ativos/nova" className="nova-lit-button nova-lit-button-primary">Novo ativo</Link> : null}
        </div>
      </div>

      <section className="nova-assets-kpi-grid" aria-label="Indicadores de ativos">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/ativos" className="nova-lit-card nova-assets-filters">
        <label className="nova-assets-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Buscar ativo, serial, MAC, unidade ou parceiro" />
        </label>

        <label className="nova-assets-field">
          <span>Unidade</span>
          <select name="unitId" defaultValue={state.unitId}>
            <option value="">Todas</option>
            {unitsResponse.items.map((unit) => (
              <option value={unit.id} key={unit.id}>
                {unit.code} - {unit.name}
              </option>
            ))}
          </select>
        </label>

        <label className="nova-assets-field">
          <span>Tipo</span>
          <select name="type" defaultValue={state.type}>
            <option value="all">Todos</option>
            <option value="starlink">Starlinks</option>
            <option value="onu">ONUs</option>
            <option value="switch">Switches</option>
            <option value="outros">Outros / SAD</option>
          </select>
        </label>

        <label className="nova-assets-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="stock">Estoque</option>
            <option value="repair">Reparo</option>
            <option value="retired">Retirado</option>
          </select>
        </label>

        <label className="nova-assets-field">
          <span>Cadastro</span>
          <select name="active" defaultValue={state.active}>
            <option value="true">Ativos</option>
            <option value="all">Todos</option>
            <option value="false">Excluídos</option>
          </select>
        </label>

        <label className="nova-assets-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="sortBy" value={state.sortBy} />
        <input type="hidden" name="sortDir" value={state.sortDir} />
        <input type="hidden" name="page" value="1" />

        <button type="submit">Filtrar</button>
        <Link href="/ativos">Limpar</Link>
      </form>

      <section className="nova-assets-main-grid">
        <div className="nova-lit-card nova-assets-table-card">
          <div className="nova-assets-section-title">
            <div>
              <span>Inventário</span>
              <h2>{assetTypeLabel(state.type)}</h2>
            </div>
            <div>
              <small>{rows.length} linhas</small>
              <Link href="/export/equipments">CSV</Link>
            </div>
          </div>

          <div className="nova-assets-table">
            <div className="nova-assets-table-head">
              <span>Ativo</span>
              <span>Unidade</span>
              <span>Parceiro</span>
              <span>Serial / origem</span>
              <span>Monitoramento</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((equipment) => {
              const monitor = monitorByUnit(telemetry, equipment.unit.id);
              const unit = unitById.get(equipment.unit.id);
              const location = locationFromUnit(unit);

              return (
                <div className={`nova-assets-row is-${statusTone(equipment.status, equipment.isActive)}`} key={equipment.id}>
                  <div>
                    <strong>{equipment.tag}</strong>
                    <small>{equipment.name} · {typeLabel(equipment.type)}</small>
                  </div>

                  <div>
                    <Link href={`/unidades/${equipment.unit.id}`} className="nova-assets-target-link">{equipment.unit.code}</Link>
                    <small>{equipment.unit.name}{location ? ` · ${location}` : ""}</small>
                  </div>

                  <div>
                    <b>{equipment.unit.partner.code}</b>
                    <small>{equipment.unit.partner.name}</small>
                  </div>

                  <div>
                    <b>{equipment.serialNumber || "-"}</b>
                    <small>{isStarlink(equipment) ? "terminal Starlink" : "cadastro atual"}</small>
                  </div>

                  <div>
                    <Badge tone={monitorTone(monitor)}>{monitorLabel(monitor)}</Badge>
                    <small>{monitor ? `${monitor.match.status} · ${monitor.problems.length} alerta(s)` : "use a unidade para telemetria"}</small>
                  </div>

                  <div>
                    <Badge tone={statusTone(equipment.status, equipment.isActive)}>{statusLabel(equipment.status)}</Badge>
                    <Badge tone={typeTone(equipment.type)}>{typeLabel(equipment.type)}</Badge>
                  </div>

                  <div>
                    <Link href={`/ativos/${equipment.id}`}>Abrir</Link>
                  </div>
                </div>
              );
            }) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-assets-right-col">
          <section className="nova-lit-card nova-assets-life">
            <div className="nova-lit-title-row">
              <h2>Status do inventário</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{rows.length}</span>
            </div>
            <div className="nova-assets-progress-list">
              <ProgressLine label="Ativos operando" value={percent(activeOnPage, rows.length)} tone="green" />
              <ProgressLine label="Rastreabilidade" value={percent(traceOnPage, rows.length)} tone="blue" />
              <ProgressLine label="Monitoramento" value={percent(monitoredOnPage, rows.length)} tone="green" />
              <ProgressLine label="Starlinks" value={percent(starlinksOnPage, rows.length)} tone="orange" />
            </div>
          </section>

          <section className="nova-lit-card nova-assets-quick">
            <span>Atalhos do inventário</span>
            <Link href="/ativos/starlinks">Starlinks <b>{starlinksOnPage}</b></Link>
            <Link href="/ativos/onus">ONUs <b>{rows.filter((item) => item.type.toLowerCase().includes("onu")).length}</b></Link>
            <Link href="/ativos/switches">Switches <b>{rows.filter((item) => item.type.toLowerCase().includes("switch")).length}</b></Link>
            <Link href="/ativos/outros">Outros / SAD <b>{rows.filter((item) => !["starlink", "onu", "switch"].some((kind) => item.type.toLowerCase().includes(kind))).length}</b></Link>
            <Link href="/monitoramento/sensores">Sensores <b>{monitoredOnPage}</b></Link>
            <Link href="/administracao/importacao?resource=equipments">Importar <b>CSV</b></Link>
          </section>

          <section className="nova-lit-card nova-assets-status">
            <div className="nova-lit-title-row">
              <h2>Resumo do recorte</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{attentionOnPage} atenção</span>
            </div>
            <div className="nova-assets-status-list">
              <Link href={withParams("/ativos", currentParams, { status: "active", page: 1 })}>
                <Dot tone="green" />
                <strong>Ativos</strong>
                <b>{rows.filter((item) => item.status === "active").length}</b>
              </Link>
              <Link href={withParams("/ativos", currentParams, { status: "stock", page: 1 })}>
                <Dot tone="blue" />
                <strong>Estoque</strong>
                <b>{rows.filter((item) => item.status === "stock").length}</b>
              </Link>
              <Link href={withParams("/ativos", currentParams, { status: "repair", page: 1 })}>
                <Dot tone="orange" />
                <strong>Reparo</strong>
                <b>{rows.filter((item) => item.status === "repair").length}</b>
              </Link>
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-assets-pagination">
        <span>
          Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} ativo(s)
        </span>
        <div>
          <Link
            href={withParams("/ativos", currentParams, { page: Math.max(1, response.meta.page - 1) })}
            className={!response.meta.hasPrev ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasPrev}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/ativos", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })}
            className={!response.meta.hasNext ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasNext}
          >
            Próxima
          </Link>
        </div>
      </section>

      {error ? <div className="nova-assets-hidden-error">{error}</div> : null}
    </NovaLitShell>
  );
}
