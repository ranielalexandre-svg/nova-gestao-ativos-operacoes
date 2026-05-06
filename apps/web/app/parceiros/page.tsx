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
  getLegacyPartnerDeskForPartners,
  type LegacyPartnerDeskItem,
} from "@/lib/legacy-catalog";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type ActiveFilter = "all" | "true" | "false";
type SortBy = "createdAt" | "code" | "name";
type SortDir = "asc" | "desc";

type PartnerRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count: { units: number };
};

type ParceirosState = {
  q: string;
  active: ActiveFilter;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  pageSize: number;
};

const activeOptions = ["all", "true", "false"] as const;
const sortByOptions = ["createdAt", "code", "name"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const pageSizeOptions = [10, 20, 50] as const;

function option<T extends readonly string[]>(options: T, value: string, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function firstPhones(item?: LegacyPartnerDeskItem) {
  if (!item?.phones.length) return "Sem telefone legado";
  return item.phones.slice(0, 2).join(" · ");
}

function contactCaption(item?: LegacyPartnerDeskItem) {
  if (!item?.contactName) return "Contato principal não encontrado";
  return [item.contactName, item.contactRole].filter(Boolean).join(" · ");
}

function coverageLabel(item?: LegacyPartnerDeskItem) {
  return item?.coverage || "Cobertura não importada";
}

function cityBase(item?: LegacyPartnerDeskItem) {
  return item?.cityBase || "Sem cidade base";
}

function statusTone(isActive: boolean): Tone {
  return isActive ? "green" : "slate";
}

function statusLabel(isActive: boolean) {
  return isActive ? "Ativo" : "Excluído";
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: ParceirosState): RawSearchParams {
  return {
    q: state.q || undefined,
    active: state.active,
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
    <article className="nova-lit-card nova-partners-kpi">
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
  return <span className={`nova-partners-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-partners-progress">
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
    <div className="nova-partners-empty">
      <div>N</div>
      <strong>Nenhum parceiro encontrado</strong>
      <span>Ajuste os filtros ou limpe a busca para voltar à base completa.</span>
    </div>
  );
}

export default async function ParceirosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/parceiros");

  const params = await resolveSearchParams(searchParams);
  const state: ParceirosState = {
    q: readStringParam(params, "q", ""),
    active: option(activeOptions, readStringParam(params, "active", "true"), "true"),
    sortBy: option(sortByOptions, readStringParam(params, "sortBy", "createdAt"), "createdAt"),
    sortDir: option(sortDirOptions, readStringParam(params, "sortDir", "desc"), "desc"),
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  let response: PaginatedResponse<PartnerRow> = {
    items: [],
    meta: {
      page: state.page,
      pageSize: state.pageSize,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    },
  };
  let error = "";

  try {
    response = await apiJson<PaginatedResponse<PartnerRow>>(
      `/partners${buildApiQuery({
        q: state.q,
        active: state.active !== "all" ? state.active : undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      })}`,
    );
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar os parceiros.";
  }

  const legacyDesk = await getLegacyPartnerDeskForPartners(
    response.items.map((partner) => ({
      id: partner.id,
      code: partner.code,
      name: partner.name,
    })),
  ).catch(() => ({ items: {} as Record<string, LegacyPartnerDeskItem> }));

  const legacyByPartnerId = legacyDesk.items;
  const rows = response.items;
  const activeOnPage = rows.filter((partner) => partner.isActive).length;
  const withContactOnPage = rows.filter((partner) => legacyByPartnerId[partner.id]?.phones.length).length;
  const withCoverageOnPage = rows.filter((partner) => legacyByPartnerId[partner.id]?.coverage).length;
  const backupCoverageOnPage = rows.reduce(
    (sum, partner) => sum + (legacyByPartnerId[partner.id]?.backupUnitCount || 0),
    0,
  );
  const totalUnitsOnPage = rows.reduce((sum, partner) => sum + partner._count.units, 0);
  const currentParams = stateParams(state);

  const kpis = [
    { label: "Parceiros", value: String(response.meta.total), hint: "resultado filtrado", tone: "blue" as const },
    { label: "Ativos", value: String(activeOnPage), hint: `${percent(activeOnPage, rows.length)}% nesta página`, tone: activeOnPage ? "green" as const : "slate" as const },
    { label: "Com contato", value: String(withContactOnPage), hint: "telefone legado", tone: withContactOnPage ? "green" as const : "orange" as const },
    { label: "Cobertura", value: String(withCoverageOnPage), hint: `${backupCoverageOnPage} contingência(s)`, tone: withCoverageOnPage ? "blue" as const : "slate" as const },
    { label: "Unidades", value: String(totalUnitsOnPage), hint: "locais vinculados", tone: totalUnitsOnPage ? "blue" as const : "slate" as const },
  ];

  return (
    <NovaLitShell activeHref="/parceiros">
      <div className="nova-lit-page-heading nova-partners-heading">
        <div>
          <h1>Parceiros</h1>
          <p className="nova-lit-page-subtitle">Cadastro, contatos legados, cobertura e unidades vinculadas.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/contratos" className="nova-lit-button nova-lit-button-secondary">Contratos</Link>
          {isAdmin ? <Link href="/parceiros/nova" className="nova-lit-button nova-lit-button-primary">Novo parceiro</Link> : null}
        </div>
      </div>

      <section className="nova-partners-kpi-grid" aria-label="Indicadores de parceiros">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/parceiros" className="nova-lit-card nova-partners-filters">
        <label className="nova-partners-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Nome, código, cidade base ou contato" />
        </label>

        <label className="nova-partners-field">
          <span>Status</span>
          <select name="active" defaultValue={state.active}>
            <option value="true">Ativos</option>
            <option value="all">Todos</option>
            <option value="false">Excluídos</option>
          </select>
        </label>

        <label className="nova-partners-field">
          <span>Ordem</span>
          <select name="sortBy" defaultValue={state.sortBy}>
            <option value="createdAt">Cadastro</option>
            <option value="code">Código</option>
            <option value="name">Nome</option>
          </select>
        </label>

        <label className="nova-partners-field">
          <span>Direção</span>
          <select name="sortDir" defaultValue={state.sortDir}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>

        <label className="nova-partners-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/parceiros">Limpar</Link>
      </form>

      <section className="nova-partners-main-grid">
        <div className="nova-lit-card nova-partners-table-card">
          <div className="nova-partners-section-title">
            <div>
              <span>Partner Desk</span>
              <h2>Contatos e cobertura</h2>
            </div>
            <div>
              <small>{rows.length} linhas</small>
              <Link href="/export/partners">CSV</Link>
            </div>
          </div>

          <div className="nova-partners-table">
            <div className="nova-partners-table-head">
              <span>Parceiro</span>
              <span>Cidade base</span>
              <span>Contato</span>
              <span>Cobertura</span>
              <span>Locais</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((partner) => {
              const legacy = legacyByPartnerId[partner.id];

              return (
                <div className={`nova-partners-row is-${statusTone(partner.isActive)}`} key={partner.id}>
                  <div>
                    <strong>{partner.name}</strong>
                    <small>{partner.code} · cadastrado em {formatDate(partner.createdAt)}</small>
                  </div>

                  <div>
                    <b>{cityBase(legacy)}</b>
                    <small>{legacy?.matched ? "base legada vinculada" : "sem match legado"}</small>
                  </div>

                  <div>
                    <b>{contactCaption(legacy)}</b>
                    <small>{firstPhones(legacy)}</small>
                  </div>

                  <div>
                    <b>{coverageLabel(legacy)}</b>
                    <small>
                      {legacy?.backupUnitCount ? `${legacy.backupUnitCount} unidade(s) em contingência` : "sem contingência registrada"}
                    </small>
                  </div>

                  <div>
                    <b>{partner._count.units}</b>
                    <small>unidade(s) vinculada(s)</small>
                  </div>

                  <div>
                    <Badge tone={statusTone(partner.isActive)}>{statusLabel(partner.isActive)}</Badge>
                  </div>

                  <div>
                    <Link href={`/parceiros/${partner.id}`}>Abrir</Link>
                  </div>
                </div>
              );
            }) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-partners-right-col">
          <section className="nova-lit-card nova-partners-quality">
            <div className="nova-lit-title-row">
              <h2>Qualidade</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{rows.length}</span>
            </div>
            <div className="nova-partners-progress-list">
              <ProgressLine label="Ativos" value={percent(activeOnPage, rows.length)} tone="green" />
              <ProgressLine label="Com contato" value={percent(withContactOnPage, rows.length)} tone="blue" />
              <ProgressLine label="Cobertura" value={percent(withCoverageOnPage, rows.length)} tone="green" />
              <ProgressLine label="Contingência" value={backupCoverageOnPage ? 100 : 0} tone="orange" />
            </div>
          </section>

          <section className="nova-lit-card nova-partners-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/parceiros", currentParams, { active: "true", page: 1 })}>Ativos <b>{activeOnPage}</b></Link>
            <Link href="/unidades">Unidades <b>{totalUnitsOnPage}</b></Link>
            <Link href="/contratos">Contratos <b>ver</b></Link>
          </section>

          <section className="nova-lit-card nova-partners-coverage">
            <div className="nova-lit-title-row">
              <h2>Recorte atual</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{backupCoverageOnPage} contingência</span>
            </div>
            <div className="nova-partners-status-list">
              <article>
                <Dot tone="green" />
                <strong>Ativos</strong>
                <b>{activeOnPage}</b>
              </article>
              <article>
                <Dot tone="blue" />
                <strong>Com contato</strong>
                <b>{withContactOnPage}</b>
              </article>
              <article>
                <Dot tone="orange" />
                <strong>Cobertura</strong>
                <b>{withCoverageOnPage}</b>
              </article>
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-partners-pagination">
        <span>
          Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} parceiro(s)
        </span>
        <div>
          <Link
            href={withParams("/parceiros", currentParams, { page: Math.max(1, response.meta.page - 1) })}
            className={!response.meta.hasPrev ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasPrev}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/parceiros", currentParams, { page: Math.min(response.meta.totalPages, response.meta.page + 1) })}
            className={!response.meta.hasNext ? "is-disabled" : ""}
            aria-disabled={!response.meta.hasNext}
          >
            Próxima
          </Link>
        </div>
      </section>

      {error ? <div className="nova-partners-hidden-error">{error}</div> : null}
    </NovaLitShell>
  );
}
