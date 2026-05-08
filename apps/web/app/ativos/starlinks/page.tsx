import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type StatusFilter = "all" | "active" | "stock" | "repair" | "retired";

type StarlinkRow = {
  id: string;
  type: string;
  manufacturer: string | null;
  model: string;
  technology: string;
  assetTag: string;
  serial: string | null;
  unitId: string;
  unitCode: string;
  partnerId: string;
  partnerCode: string;
  status: string;
  inventoryStatus: string;
  createdAt: string;
  city: string | null;
  state: string | null;
  unitName: string;
  partnerName: string;
  documentsCount: number;
  operationalDataCount?: number;
  operationalSecretsCount?: number;
};

type StarlinksState = {
  q: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
};

const statusOptions = ["all", "active", "stock", "repair", "retired"] as const;
const pageSizeOptions = [12, 24, 48] as const;

function isStatus(value: string): value is StatusFilter {
  return statusOptions.includes(value as StatusFilter);
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 12;
}

function statusOption(value: string): StatusFilter {
  return isStatus(value) ? value : "all";
}

function norm(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function statusTone(value: string): Tone {
  const normalized = norm(value);
  if (normalized === "active" || normalized === "ativo") return "green";
  if (normalized === "stock" || normalized === "estoque") return "blue";
  if (normalized === "repair" || normalized === "reparo" || normalized === "manutencao") return "orange";
  if (normalized === "retired" || normalized === "inativo" || normalized === "inactive") return "slate";
  return "blue";
}

function statusLabel(value: string) {
  const normalized = norm(value);
  if (normalized === "active") return "Ativo";
  if (normalized === "stock") return "Estoque";
  if (normalized === "repair") return "Reparo";
  if (normalized === "retired") return "Retirado";
  return value || "Sem status";
}

function locationLabel(item: StarlinkRow) {
  if (item.city && item.state) return `${item.city}/${item.state}`;
  if (item.city) return item.city;
  if (item.state) return item.state;
  return "Sem cidade/UF";
}

function operationalDataCount(item: StarlinkRow) {
  return item.operationalDataCount ?? 0;
}

function operationalSecretsCount(item: StarlinkRow) {
  return item.operationalSecretsCount ?? 0;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function itemMatches(item: StarlinkRow, state: StarlinksState) {
  const statusOk = state.status === "all" || norm(item.status) === state.status || norm(item.inventoryStatus) === state.status;

  if (!statusOk) return false;
  if (!state.q) return true;

  const haystack = [
    item.assetTag,
    item.serial,
    item.model,
    item.type,
    item.technology,
    item.unitCode,
    item.unitName,
    item.partnerCode,
    item.partnerName,
    item.city,
    item.state,
    item.status,
    item.inventoryStatus,
  ].join(" ");

  return norm(haystack).includes(norm(state.q));
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: StarlinksState): RawSearchParams {
  return {
    q: state.q || undefined,
    status: state.status,
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
    <article className="nova-lit-card nova-starlinks-kpi">
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
  return <span className={`nova-starlinks-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-starlinks-progress">
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
    <div className="nova-starlinks-empty">
      <div>N</div>
      <strong>Nenhum Starlink encontrado</strong>
      <span>Ajuste os filtros ou limpe a busca para voltar ao inventário satelital.</span>
    </div>
  );
}

export default async function StarlinksPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/ativos/starlinks");

  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const params = await resolveSearchParams(searchParams);

  const state: StarlinksState = {
    q: readStringParam(params, "q", ""),
    status: statusOption(readStringParam(params, "status", "all")),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 12)),
  };

  let items: StarlinkRow[] = [];
  let error = "";

  try {
    items = await apiJson<StarlinkRow[]>("/starlinks");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar Starlinks.";
  }

  const filtered = items.filter((item) => itemMatches(item, state));
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * state.pageSize, safePage * state.pageSize);

  const active = filtered.filter((item) => statusTone(item.status) === "green").length;
  const stock = filtered.filter((item) => statusTone(item.status) === "blue").length;
  const repair = filtered.filter((item) => statusTone(item.status) === "orange").length;
  const retired = filtered.filter((item) => statusTone(item.status) === "slate").length;
  const withSerial = filtered.filter((item) => item.serial).length;
  const withDocs = filtered.filter((item) => item.documentsCount > 0).length;
  const withOperationalData = filtered.filter((item) => operationalDataCount(item) > 0).length;
  const withOperationalSecrets = filtered.filter((item) => operationalSecretsCount(item) > 0).length;
  const cities = new Set(filtered.map((item) => locationLabel(item)).filter((item) => item !== "Sem cidade/UF")).size;
  const partners = new Set(filtered.map((item) => item.partnerCode).filter(Boolean)).size;
  const currentParams = stateParams({ ...state, page: safePage });

  const kpis = [
    { label: "Starlinks", value: String(filtered.length), hint: `${items.length} no total`, tone: "orange" as const },
    { label: "Ativos", value: String(active), hint: "em operação", tone: active ? "green" as const : "slate" as const },
    { label: "Estoque", value: String(stock), hint: "reserva técnica", tone: stock ? "blue" as const : "slate" as const },
    { label: "Com serial", value: String(withSerial), hint: `${percent(withSerial, filtered.length)}% rastreado`, tone: withSerial ? "green" as const : "orange" as const },
    { label: "Dados operacionais", value: String(withOperationalData), hint: `${withOperationalSecrets} com credenciais`, tone: withOperationalData ? "green" as const : "slate" as const },
    { label: "Cidades", value: String(cities), hint: `${partners} parceiro(s)`, tone: cities ? "blue" as const : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/ativos/starlinks">
      <nav className="nova-assets-breadcrumb" aria-label="Breadcrumb">
        <Link href="/operacao">Operação</Link>
        <span>/</span>
        <Link href="/ativos">Ativos</Link>
        <span>/</span>
        <strong>Starlinks</strong>
      </nav>

      <div className="nova-lit-page-heading nova-starlinks-heading">
        <div>
          <h1>Starlinks</h1>
          <p className="nova-lit-page-subtitle">Terminais satelitais, status, serial, unidade e parceiro vinculados ao inventário.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/ativos" className="nova-lit-button nova-lit-button-secondary">Ver ativos</Link>
          <Link href={withParams("/ativos/starlinks", currentParams, { page: safePage })} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
          {isAdmin ? <Link href="/importacao?resource=starlinks" className="nova-lit-button nova-lit-button-primary">Importar Starlinks</Link> : null}
        </div>
      </div>

      <section className="nova-assets-flow nova-assets-flow--satellite" aria-label="Fluxo operacional Starlink">
        <article className="is-active">
          <span>01</span>
          <strong>Terminal</strong>
          <small>Serial, kit, antena, status e localização garantem rastreabilidade.</small>
        </article>
        <i>→</i>
        <article>
          <span>02</span>
          <strong>Credenciais</strong>
          <small>Dados operacionais ficam mascarados e auditados por padrão.</small>
        </article>
        <i>→</i>
        <article>
          <span>03</span>
          <strong>Atendimento</strong>
          <small>Unidade, parceiro, chamados e documentos sustentam o suporte.</small>
        </article>
      </section>

      <section className="nova-starlinks-kpi-grid" aria-label="Indicadores de Starlinks">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/ativos/starlinks" className="nova-lit-card nova-starlinks-filters">
        <label className="nova-starlinks-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Terminal, serial, unidade, parceiro ou cidade" />
        </label>

        <label className="nova-starlinks-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="stock">Estoque</option>
            <option value="repair">Reparo</option>
            <option value="retired">Retirados</option>
          </select>
        </label>

        <label className="nova-starlinks-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/ativos/starlinks">Limpar</Link>
      </form>

      <section className="nova-starlinks-main-grid">
        <div className="nova-lit-card nova-starlinks-table-card">
          <div className="nova-starlinks-section-title">
            <div>
              <span>Inventário satelital</span>
              <h2>Terminais Starlink</h2>
            </div>
            <div>
              <small>{pageItems.length} linhas</small>
              <Link href="/export/starlinks">CSV</Link>
            </div>
          </div>

          <div className="nova-starlinks-table">
            <div className="nova-starlinks-table-head">
              <span>Terminal</span>
              <span>Unidade</span>
              <span>Parceiro</span>
              <span>Serial</span>
              <span>Status</span>
              <span>Dados</span>
              <span>Ações</span>
            </div>

            {pageItems.length ? pageItems.map((item) => (
              <div className={`nova-starlinks-row is-${statusTone(item.status)}`} key={item.id}>
                <div>
                  <strong>{item.assetTag}</strong>
                  <small>{item.model || item.type} · {item.technology}</small>
                </div>

                <div>
                  <Link href={`/unidades/${item.unitId}`} className="nova-starlinks-target-link">{item.unitCode}</Link>
                  <small>{item.unitName} · {locationLabel(item)}</small>
                </div>

                <div>
                  <b>{item.partnerCode}</b>
                  <small>{item.partnerName}</small>
                </div>

                <div>
                  <b>{item.serial || "-"}</b>
                  <small>{item.manufacturer || "Starlink"}</small>
                </div>

                <div>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  <small>{item.inventoryStatus || "inventário atual"}</small>
                </div>

                <div>
                  <Badge tone={item.documentsCount ? "green" : "slate"}>{`${item.documentsCount} docs`}</Badge>
                  {(operationalDataCount(item) > 0) ? (
                    <Badge tone="orange">{`${operationalDataCount(item)} operacional`}</Badge>
                  ) : null}
                  {(operationalSecretsCount(item) > 0) ? (
                    <small>{operationalSecretsCount(item)} credencial(is)</small>
                  ) : (
                    <small>{formatDate(item.createdAt)}</small>
                  )}
                </div>

                <div>
                  <Link href={`/ativos/${item.id}`}>Abrir</Link>
                </div>
              </div>
            )) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-starlinks-right-col">
          <section className="nova-lit-card nova-starlinks-life">
            <div className="nova-lit-title-row">
              <h2>Qualidade</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{filtered.length}</span>
            </div>
            <div className="nova-starlinks-progress-list">
              <ProgressLine label="Em operação" value={percent(active, filtered.length)} tone="green" />
              <ProgressLine label="Serial preenchido" value={percent(withSerial, filtered.length)} tone="blue" />
              <ProgressLine label="Com documentos" value={percent(withDocs, filtered.length)} tone="green" />
              <ProgressLine label="Credenciais operacionais" value={percent(withOperationalSecrets, filtered.length)} tone="orange" />
              <ProgressLine label="Em estoque" value={percent(stock, filtered.length)} tone="orange" />
            </div>
          </section>

          <section className="nova-lit-card nova-starlinks-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/ativos/starlinks", currentParams, { status: "active", page: 1 })}>Ativos <b>{active}</b></Link>
            <Link href={withParams("/ativos/starlinks", currentParams, { status: "stock", page: 1 })}>Estoque <b>{stock}</b></Link>
            <Link href={withParams("/ativos/starlinks", currentParams, { status: "repair", page: 1 })}>Reparo <b>{repair}</b></Link>
          </section>

          <section className="nova-lit-card nova-starlinks-status">
            <div className="nova-lit-title-row">
              <h2>Recorte atual</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{cities} cidades</span>
            </div>
            <div className="nova-starlinks-status-list">
              <article>
                <Dot tone="green" />
                <strong>Ativos</strong>
                <b>{active}</b>
              </article>
              <article>
                <Dot tone="blue" />
                <strong>Estoque</strong>
                <b>{stock}</b>
              </article>
              <article>
                <Dot tone="orange" />
                <strong>Reparo</strong>
                <b>{repair}</b>
              </article>
              <article>
                <Dot tone="slate" />
                <strong>Retirados</strong>
                <b>{retired}</b>
              </article>
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-starlinks-pagination">
        <span>
          Página {safePage} de {totalPages} · {filtered.length} Starlink(s)
        </span>
        <div>
          <Link
            href={withParams("/ativos/starlinks", currentParams, { page: Math.max(1, safePage - 1) })}
            className={safePage <= 1 ? "is-disabled" : ""}
            aria-disabled={safePage <= 1}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/ativos/starlinks", currentParams, { page: Math.min(totalPages, safePage + 1) })}
            className={safePage >= totalPages ? "is-disabled" : ""}
            aria-disabled={safePage >= totalPages}
          >
            Próxima
          </Link>
        </div>
      </section>

      {error ? <div className="nova-starlinks-hidden-error">{error}</div> : null}
    </NovaLitShell>
  );
}
