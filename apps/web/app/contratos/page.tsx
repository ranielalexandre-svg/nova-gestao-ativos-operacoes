import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { safeApiJson } from "@/lib/noc-overview";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";
type StatusFilter = "all" | "ready" | "pending" | "inactive";

type PartnerRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count?: { units: number };
};

type UnitRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportContractLabel: string | null;
  reportAddressLine: string | null;
  reportContractedBandwidth: string | null;
  reportNotes: string | null;
  partner: { id: string; code: string; name: string };
};

type ReportUnitsResponse = {
  total: number;
  items: UnitRow[];
};

type ContractPortfolioRow = {
  partner: PartnerRow;
  units: UnitRow[];
  contractLabels: string[];
  bandwidths: string[];
  cities: string[];
  completeUnits: number;
  unitsWithMetadata: number;
  pendingUnits: number;
};

type ContratosState = {
  q: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
};

const statusOptions = ["all", "ready", "pending", "inactive"] as const;
const pageSizeOptions = [10, 20, 50] as const;

function isStatus(value: string): value is StatusFilter {
  return statusOptions.includes(value as StatusFilter);
}

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function contractComplete(unit: UnitRow) {
  return hasText(unit.reportContractLabel) && hasText(unit.reportContractedBandwidth) && hasText(unit.reportAddressLine);
}

function unitHasMetadata(unit: UnitRow) {
  return hasText(unit.reportContractLabel) || hasText(unit.reportContractedBandwidth) || hasText(unit.reportAddressLine);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function compactValues(values: string[], fallback: string) {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  return `${values[0]} +${values.length - 1}`;
}

function locationLabel(unit: UnitRow) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "sem cidade";
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function portfolioStatus(row: ContractPortfolioRow): StatusFilter {
  if (!row.partner.isActive) return "inactive";
  if (row.pendingUnits > 0 || row.completeUnits === 0) return "pending";
  return "ready";
}

function statusLabel(row: ContractPortfolioRow) {
  const status = portfolioStatus(row);
  if (status === "ready") return "Pronto";
  if (status === "pending") return "Incompleto";
  if (status === "inactive") return "Inativo";
  return "Todos";
}

function statusTone(row: ContractPortfolioRow): Tone {
  const status = portfolioStatus(row);
  if (status === "ready") return "green";
  if (status === "pending") return "orange";
  if (status === "inactive") return "slate";
  return "blue";
}

function rowMatches(row: ContractPortfolioRow, state: ContratosState) {
  const status = portfolioStatus(row);
  const statusOk = state.status === "all" || state.status === status;

  if (!statusOk) return false;
  if (!state.q) return true;

  const haystack = [
    row.partner.code,
    row.partner.name,
    row.contractLabels.join(" "),
    row.bandwidths.join(" "),
    row.cities.join(" "),
    row.units.map((unit) => `${unit.code} ${unit.name} ${unit.reportAddressLine || ""} ${unit.reportNotes || ""}`).join(" "),
  ].join(" ");

  return normalized(haystack).includes(normalized(state.q));
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function stateParams(state: ContratosState): RawSearchParams {
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
    <article className="nova-lit-card nova-contracts-kpi">
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
  return <span className={`nova-contracts-badge is-${tone}`}>{children}</span>;
}

function ProgressLine({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="nova-contracts-progress">
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
    <div className="nova-contracts-empty">
      <div>N</div>
      <strong>Nenhum contrato no recorte</strong>
      <span>Ajuste os filtros ou limpe a busca para voltar à carteira operacional.</span>
    </div>
  );
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/contratos");

  const params = await resolveSearchParams(searchParams);
  const rawStatus = readStringParam(params, "status", "all");
  const state: ContratosState = {
    q: readStringParam(params, "q", ""),
    status: isStatus(rawStatus) ? rawStatus : "all",
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";

  const [partners, units] = await Promise.all([
    safeApiJson<PaginatedResponse<PartnerRow>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc", {
      items: [],
      meta: { total: 0, page: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false },
    }),
    safeApiJson<ReportUnitsResponse>("/monitoring/reports/units", { total: 0, items: [] }),
  ]);

  const unitsByPartner = new Map<string, UnitRow[]>();

  for (const unit of units.items) {
    const current = unitsByPartner.get(unit.partner.id) || [];
    current.push(unit);
    unitsByPartner.set(unit.partner.id, current);
  }

  const portfolio: ContractPortfolioRow[] = partners.items.map((partner) => {
    const partnerUnits = unitsByPartner.get(partner.id) || [];
    const contractLabels = uniqueValues(partnerUnits.map((unit) => unit.reportContractLabel));
    const bandwidths = uniqueValues(partnerUnits.map((unit) => unit.reportContractedBandwidth));
    const cities = uniqueValues(partnerUnits.map((unit) => locationLabel(unit)));
    const completeUnits = partnerUnits.filter(contractComplete).length;
    const unitsWithMetadata = partnerUnits.filter(unitHasMetadata).length;
    const pendingUnits = partnerUnits.filter((unit) => !contractComplete(unit)).length;

    return {
      partner,
      units: partnerUnits,
      contractLabels,
      bandwidths,
      cities,
      completeUnits,
      unitsWithMetadata,
      pendingUnits,
    };
  });

  const filtered = portfolio.filter((row) => rowMatches(row, state));
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const pageRows = filtered.slice((safePage - 1) * state.pageSize, safePage * state.pageSize);
  const currentParams = stateParams({ ...state, page: safePage });

  const activePartners = partners.items.filter((item) => item.isActive).length;
  const unitsWithContract = units.items.filter(unitHasMetadata).length;
  const completeUnits = units.items.filter(contractComplete).length;
  const missingContractData = units.items.filter((unit) => !contractComplete(unit)).length;
  const readyRows = portfolio.filter((row) => portfolioStatus(row) === "ready").length;
  const pendingRows = portfolio.filter((row) => portfolioStatus(row) === "pending").length;
  const inactiveRows = portfolio.filter((row) => portfolioStatus(row) === "inactive").length;
  const withBandwidth = units.items.filter((unit) => hasText(unit.reportContractedBandwidth)).length;
  const withAddress = units.items.filter((unit) => hasText(unit.reportAddressLine)).length;
  const pendingUnits = units.items.filter((unit) => !contractComplete(unit)).slice(0, 7);
  const readyUnits = units.items.filter(contractComplete).slice(0, 6);

  const kpis = [
    { label: "Parceiros", value: String(partners.meta.total), hint: "carteira operacional", tone: "blue" as const },
    { label: "Ativos", value: String(activePartners), hint: "disponíveis", tone: activePartners ? "green" as const : "slate" as const },
    { label: "Unidades", value: String(units.total), hint: `${unitsWithContract} com metadado`, tone: "blue" as const },
    { label: "Prontas", value: String(completeUnits), hint: "relatório completo", tone: completeUnits ? "green" as const : "orange" as const },
    { label: "Pendências", value: String(missingContractData), hint: "contrato, banda ou endereço", tone: missingContractData ? "orange" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/contratos">
      <nav className="nova-admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/operacao">Operação</Link>
        <span>/</span>
        <strong>Contratos</strong>
      </nav>

      <section className="nova-admin-flow nova-admin-flow--contracts" aria-label="Fluxo de governança contratual">
        <article className="is-active">
          <span>01</span>
          <strong>Carteira</strong>
          <small>Parceiros, unidades, contratos e metadados de relatório.</small>
        </article>
        <i>→</i>
        <article>
          <span>02</span>
          <strong>Governança</strong>
          <small>Banda, endereço, contrato e pendências por unidade.</small>
        </article>
        <i>→</i>
        <article>
          <span>03</span>
          <strong>Relatório</strong>
          <small>Base pronta para exportação, SLA e atendimento operacional.</small>
        </article>
      </section>

      <div className="nova-lit-page-heading nova-contracts-heading">
        <div>
          <h1>Contratos</h1>
          <p className="nova-lit-page-subtitle">Carteira operacional de parceiros, bandas, metadados e cobertura por unidade.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/parceiros" className="nova-lit-button nova-lit-button-secondary">Parceiros</Link>
          <Link href={withParams("/contratos", currentParams, { page: safePage })} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
          {isAdmin ? <Link href="/parceiros/nova" className="nova-lit-button nova-lit-button-primary">Novo parceiro</Link> : null}
        </div>
      </div>

      <section className="nova-contracts-kpi-grid" aria-label="Indicadores de contratos">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form action="/contratos" className="nova-lit-card nova-contracts-filters">
        <label className="nova-contracts-search">
          <span>Busca</span>
          <input name="q" defaultValue={state.q} placeholder="Contrato, parceiro, cidade, unidade ou banda" />
        </label>

        <label className="nova-contracts-field">
          <span>Status</span>
          <select name="status" defaultValue={state.status}>
            <option value="all">Todos</option>
            <option value="ready">Prontos</option>
            <option value="pending">Incompletos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>

        <label className="nova-contracts-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />
        <button type="submit">Filtrar</button>
        <Link href="/contratos">Limpar</Link>
      </form>

      <section className="nova-contracts-main-grid">
        <div className="nova-lit-card nova-contracts-table-card">
          <div className="nova-contracts-section-title">
            <div>
              <span>Contratos</span>
              <h2>Carteira operacional</h2>
            </div>
            <div>
              <small>{pageRows.length} linhas</small>
              <Link href="/parceiros">Partner desk</Link>
            </div>
          </div>

          <div className="nova-contracts-table">
            <div className="nova-contracts-table-head">
              <span>Contrato</span>
              <span>Parceiro</span>
              <span>Cobertura</span>
              <span>Banda</span>
              <span>Metadados</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {pageRows.length ? pageRows.map((row) => (
              <div className={`nova-contracts-row is-${statusTone(row)}`} key={row.partner.id}>
                <div>
                  <strong>{compactValues(row.contractLabels, "Sem contrato cadastrado")}</strong>
                  <small>{row.contractLabels.length ? "metadado de relatório" : "preencher na unidade"}</small>
                </div>

                <div>
                  <Link href={`/parceiros/${row.partner.id}`} className="nova-contracts-target-link">{row.partner.name}</Link>
                  <small>{row.partner.code}</small>
                </div>

                <div>
                  <b>{row.partner._count?.units ?? row.units.length} unidade(s)</b>
                  <small>{compactValues(row.cities, "sem cidade informada")}</small>
                </div>

                <div>
                  <b>{compactValues(row.bandwidths, "não informada")}</b>
                  <small>{row.units.length ? `${row.units.length} ativa(s) no relatório` : "sem unidade no relatório"}</small>
                </div>

                <div>
                  <b>{row.completeUnits}/{row.units.length}</b>
                  <small>{row.pendingUnits ? `${row.pendingUnits} pendência(s)` : "metadados completos"}</small>
                </div>

                <div>
                  <Badge tone={statusTone(row)}>{statusLabel(row)}</Badge>
                </div>

                <div>
                  <Link href={`/parceiros/${row.partner.id}`}>Abrir</Link>
                </div>
              </div>
            )) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="nova-contracts-right-col">
          <section className="nova-lit-card nova-contracts-governance">
            <div className="nova-lit-title-row">
              <h2>Governança</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{missingContractData} pendências</span>
            </div>
            <div className="nova-contracts-progress-list">
              <ProgressLine label="Contrato" value={percent(unitsWithContract, units.total)} tone="blue" />
              <ProgressLine label="Banda" value={percent(withBandwidth, units.total)} tone="green" />
              <ProgressLine label="Endereço" value={percent(withAddress, units.total)} tone="orange" />
              <ProgressLine label="Completo" value={percent(completeUnits, units.total)} tone="green" />
            </div>
          </section>

          <section className="nova-lit-card nova-contracts-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/contratos", currentParams, { status: "ready", page: 1 })}>Prontos <b>{readyRows}</b></Link>
            <Link href={withParams("/contratos", currentParams, { status: "pending", page: 1 })}>Incompletos <b>{pendingRows}</b></Link>
            <Link href={withParams("/contratos", currentParams, { status: "inactive", page: 1 })}>Inativos <b>{inactiveRows}</b></Link>
          </section>

          <section className="nova-lit-card nova-contracts-pending">
            <div className="nova-lit-title-row">
              <h2>Pendências</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{pendingUnits.length}</span>
            </div>
            <div className="nova-contracts-unit-list">
              {pendingUnits.length ? pendingUnits.map((unit) => (
                <Link key={unit.id} href={`/unidades/${unit.id}`}>
                  <Dot tone="orange" />
                  <div>
                    <strong>{unit.name}</strong>
                    <span>{unit.partner.name} · {locationLabel(unit)}</span>
                  </div>
                </Link>
              )) : (
                <div className="nova-contracts-list-empty">Nenhuma pendência encontrada.</div>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-contracts-ready">
            <div className="nova-lit-title-row">
              <h2>Prontas</h2>
              <span className="nova-lit-pill nova-lit-pill-green">{readyUnits.length}</span>
            </div>
            <div className="nova-contracts-unit-list">
              {readyUnits.length ? readyUnits.map((unit) => (
                <Link key={unit.id} href={`/unidades/${unit.id}`}>
                  <Dot tone="green" />
                  <div>
                    <strong>{unit.name}</strong>
                    <span>{unit.reportContractLabel} · {unit.reportContractedBandwidth}</span>
                  </div>
                </Link>
              )) : (
                <div className="nova-contracts-list-empty">Complete contrato, banda e endereço nas unidades.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-contracts-pagination">
        <span>
          Página {safePage} de {totalPages} · {filtered.length} contrato(s)
        </span>
        <div>
          <Link
            href={withParams("/contratos", currentParams, { page: Math.max(1, safePage - 1) })}
            className={safePage <= 1 ? "is-disabled" : ""}
            aria-disabled={safePage <= 1}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/contratos", currentParams, { page: Math.min(totalPages, safePage + 1) })}
            className={safePage >= totalPages ? "is-disabled" : ""}
            aria-disabled={safePage >= totalPages}
          >
            Próxima
          </Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
