import Link from "next/link";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  withParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { safeApiJson } from "@/lib/noc-overview";
import {
  contractCompleteness,
  contractStatusLabel,
  contractStatusTone,
  formatContractDate,
  formatMoneyCents,
  isContractStatusFilter,
  locationLabel,
  type ContractRow,
  type ContractStatusFilter,
} from "@/lib/contracts";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

type ContratosState = {
  q: string;
  status: ContractStatusFilter;
  page: number;
  pageSize: number;
};

const pageSizeOptions = [10, 20, 50] as const;

function pageSizeOption(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : 10;
}

function emptyContracts(page = 1, pageSize = 10): PaginatedResponse<ContractRow> {
  return {
    items: [],
    meta: { total: 0, page, pageSize, totalPages: 1, hasPrev: false, hasNext: false },
  };
}

function stateParams(state: ContratosState): RawSearchParams {
  return {
    q: state.q || undefined,
    status: state.status,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statusHref(state: ContratosState, status: ContractStatusFilter) {
  return withParams("/contratos", stateParams(state), { status, page: 1 });
}

function missingReason(contract: ContractRow) {
  const missing = [];
  if (!contract.unitCount) missing.push("unidade");
  if (!contract.serviceCount) missing.push("serviço");
  if (contract.slaPercent === null || contract.slaPercent === undefined) missing.push("SLA");
  if (contract.monthlyValueCents === null || contract.monthlyValueCents === undefined) missing.push("faturamento");
  return missing.length ? `falta ${missing.join(", ")}` : "cadastro completo";
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-contracts-badge is-${tone}`}>{children}</span>;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  href: string;
}) {
  return (
    <Link href={href} className="nova-lit-card nova-contracts-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </Link>
  );
}

function ProgressLine({ label, value, tone, href }: { label: string; value: number; tone: Tone; href: string }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <Link href={href} className="nova-contracts-progress">
      <div>
        <span>{label}</span>
        <b>{safe}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safe}%` }} />
      </i>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="nova-contracts-empty">
      <div>N</div>
      <strong>Nenhum contrato no recorte</strong>
      <span>Ajuste os filtros ou crie um contrato real para alimentar a carteira.</span>
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
    status: isContractStatusFilter(rawStatus) ? rawStatus : "all",
    page: readPositiveIntParam(params, "page", 1),
    pageSize: pageSizeOption(readPositiveIntParam(params, "pageSize", 10)),
  };

  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const q = state.q || undefined;
  const query = buildApiQuery({
    q,
    status: state.status,
    page: state.page,
    pageSize: state.pageSize,
    sortBy: "code",
    sortDir: "asc",
  });
  const countQuery = (status: ContractStatusFilter) =>
    buildApiQuery({ q, status, page: 1, pageSize: 1 });

  const [contracts, allContracts, activeContracts, draftContracts, expiredContracts, cancelledContracts] =
    await Promise.all([
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${query}`, emptyContracts(state.page, state.pageSize)),
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${countQuery("all")}`, emptyContracts(1, 1)),
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${countQuery("active")}`, emptyContracts(1, 1)),
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${countQuery("draft")}`, emptyContracts(1, 1)),
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${countQuery("expired")}`, emptyContracts(1, 1)),
      safeApiJson<PaginatedResponse<ContractRow>>(`/contracts${countQuery("cancelled")}`, emptyContracts(1, 1)),
    ]);

  const safePage = contracts.meta.page || state.page;
  const totalPages = Math.max(1, contracts.meta.totalPages || 1);
  const currentParams = stateParams({ ...state, page: safePage });
  const featuredContract =
    contracts.items.find((contract) => contract.code === "43779") ||
    contracts.items.find((contract) => contract.status === "active") ||
    contracts.items[0] ||
    null;
  const pageUnitCount = contracts.items.reduce((total, contract) => total + contract.unitCount, 0);
  const pageBandwidth = contracts.items.reduce((total, contract) => total + contract.totalBandwidthMbps, 0);
  const pendingContracts = contracts.items
    .filter((contract) => contractCompleteness(contract) < 100)
    .slice(0, 7);
  const readyContracts = contracts.items
    .filter((contract) => contractCompleteness(contract) === 100 && contract.status === "active")
    .slice(0, 6);

  const kpis = [
    {
      label: "Contratos",
      value: String(allContracts.meta.total),
      hint: state.q ? "resultado da busca" : "carteira total",
      tone: "blue" as const,
      href: statusHref(state, "all"),
    },
    {
      label: "Ativos",
      value: String(activeContracts.meta.total),
      hint: "em operação",
      tone: activeContracts.meta.total ? ("green" as const) : ("slate" as const),
      href: statusHref(state, "active"),
    },
    {
      label: "Rascunhos",
      value: String(draftContracts.meta.total),
      hint: "pendentes de fechamento",
      tone: draftContracts.meta.total ? ("orange" as const) : ("slate" as const),
      href: statusHref(state, "draft"),
    },
    {
      label: "Vencidos",
      value: String(expiredContracts.meta.total),
      hint: "precisam revisão",
      tone: expiredContracts.meta.total ? ("red" as const) : ("green" as const),
      href: statusHref(state, "expired"),
    },
    {
      label: "Cancelados",
      value: String(cancelledContracts.meta.total),
      hint: "fora da carteira ativa",
      tone: cancelledContracts.meta.total ? ("slate" as const) : ("green" as const),
      href: statusHref(state, "cancelled"),
    },
  ];

  return (
    <NovaLitShell activeHref="/contratos">
      <section className="nova-contract-detail-page" aria-label="Contratos">
        <header className="nova-contract-detail-hero">
          <nav className="nova-contract-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <strong>Contratos</strong>
          </nav>

          <div className="nova-contract-detail-title-row">
            <div>
              <h1>Contratos</h1>
              <p>Contratos do recorte ligada a parceiros, unidades, serviços, SLA e faturamento.</p>
            </div>

            <div className="nova-contract-detail-actions">
              <Link href="/parceiros">Parceiros</Link>
              <Link href="/unidades">Unidades</Link>
              {isAdmin ? <Link href="/contratos/cadastro" className="is-primary">Cadastrar contrato</Link> : null}
            </div>
          </div>
        </header>

        <section className="nova-contract-detail-summary" aria-label="Resumo da carteira">
          <article>
            <i>C</i>
            <span>Contratos no recorte</span>
            <strong>{contracts.meta.total}</strong>
            <small>
              <Link href={withParams("/contratos", currentParams, { page: 1 })}>ver lista filtrada</Link>
            </small>
            <small>{state.q || state.status !== "all" ? "com filtros aplicados" : "sem filtro"}</small>
          </article>
          <article>
            <i className="is-green">A</i>
            <span>Ativos rastreáveis</span>
            <strong>{activeContracts.meta.total}</strong>
            <small>
              <Link href={statusHref(state, "active")}>abrir contratos ativos</Link>
            </small>
            <small>fonte: /contracts?status=active</small>
          </article>
          <article>
            <i>U</i>
            <span>Unidades nesta página</span>
            <strong>{pageUnitCount}</strong>
            <small>{contracts.items.length} contrato(s) exibidos</small>
            <small>{pageBandwidth.toLocaleString("pt-BR")} Mbps somados</small>
          </article>
          <article>
            <i className="is-orange">P</i>
            <span>Pendências</span>
            <strong>{pendingContracts.length}</strong>
            <small>cadastros incompletos na página atual</small>
            <small>unidade, serviço, SLA ou faturamento</small>
          </article>
          <article>
            <i>S</i>
            <span>Contrato em foco</span>
            <strong>{featuredContract ? featuredContract.code : "sem dados"}</strong>
            <small>{featuredContract?.partner.name || "crie um contrato"}</small>
            <small>{featuredContract ? contractStatusLabel(featuredContract.status) : "sem origem"}</small>
          </article>
        </section>

        {featuredContract ? (
          <section className="nova-contract-detail-grid">
            <aside className="nova-contract-detail-left">
              <article className="nova-contract-detail-card">
                <h2>Resumo do contrato</h2>
                <dl>
                  <div><dt>Número</dt><dd>{featuredContract.code}</dd></div>
                  <div><dt>Parceiro</dt><dd>{featuredContract.partner.name}</dd></div>
                  <div><dt>Status</dt><dd>{contractStatusLabel(featuredContract.status)}</dd></div>
                  <div><dt>Tipo</dt><dd>{featuredContract.type || "não informado"}</dd></div>
                  <div><dt>Vigência</dt><dd>{formatContractDate(featuredContract.startsAt)} a {formatContractDate(featuredContract.endsAt)}</dd></div>
                  <div><dt>Valor mensal</dt><dd>{formatMoneyCents(featuredContract.monthlyValueCents)}</dd></div>
                  <div><dt>SLA</dt><dd>{featuredContract.slaPercent ? `${featuredContract.slaPercent.toLocaleString("pt-BR")}%` : "não informado"}</dd></div>
                  <div><dt>Completude</dt><dd>{contractCompleteness(featuredContract)}%</dd></div>
                </dl>
              </article>
            </aside>

            <main className="nova-contract-detail-main">
              <article className="nova-contract-detail-card">
                <header>
                  <h2>Unidades cobertas</h2>
                  <Link href={`/contratos/${featuredContract.id}`}>Abrir detalhes</Link>
                </header>
                <div className="nova-contract-detail-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Local</th>
                        <th>Banda</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featuredContract.units.length ? featuredContract.units.slice(0, 5).map((item) => (
                        <tr key={item.id}>
                          <td><Link href={`/unidades/${item.unit.id}`}>{item.unit.code} - {item.unit.name}</Link></td>
                          <td>{item.addressLine || locationLabel(item.unit)}</td>
                          <td>{item.bandwidthLabel || (item.bandwidthMbps ? `${item.bandwidthMbps} Mbps` : "-")}</td>
                          <td><Badge tone={item.status === "active" ? "green" : "slate"}>{item.status === "active" ? "Ativa" : "Inativa"}</Badge></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>Nenhuma unidade vinculada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </main>

            <aside className="nova-contract-detail-right">
              <article className="nova-contract-detail-card">
                <h2>Contatos responsáveis</h2>
                <div className="nova-contract-detail-contacts">
                  {featuredContract.contacts.length ? featuredContract.contacts.map((contact) => (
                    <div key={contact.id}>
                      <i>{contact.name.slice(0, 2).toUpperCase()}</i>
                      <strong>{contact.name}<span>{contact.role || "Contato"}</span></strong>
                      <small>{contact.email || "sem e-mail"}</small>
                      <small>{contact.phone || "sem telefone"}</small>
                    </div>
                  )) : (
                    <div>
                      <strong>Sem contato cadastrado<span>Inclua no editor do contrato</span></strong>
                    </div>
                  )}
                </div>
              </article>

              <article className="nova-contract-detail-card">
                <h2>Ações</h2>
                <div className="nova-contract-detail-quick">
                  <Link href={`/contratos/${featuredContract.id}`}>Abrir contrato</Link>
                  {isAdmin ? <Link href={`/contratos/${featuredContract.id}/editar`}>Editar contrato</Link> : null}
                  <Link href={`/parceiros/${featuredContract.partner.id}`}>Abrir parceiro</Link>
                </div>
              </article>
            </aside>
          </section>
        ) : null}
      </section>

      <section className="nova-contracts-portfolio-section" aria-label="Contratos do recorte">
        <nav className="nova-admin-breadcrumb" aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span>/</span>
          <strong>Contratos</strong>
        </nav>

        <section className="nova-admin-flow nova-admin-flow--contracts" aria-label="Fluxo contratual">
          <article className="is-active">
            <span>01</span>
            <strong>Contrato</strong>
            <small>Parceiro, vigência, serviços, valor e SLA.</small>
          </article>
          <i>→</i>
          <article>
            <span>02</span>
            <strong>Unidades</strong>
            <small>Locais cobertos e banda contratada.</small>
          </article>
          <i>→</i>
          <article>
            <span>03</span>
            <strong>Operação</strong>
            <small>Serviços, contatos, faturamento e relatórios.</small>
          </article>
        </section>

        <div className="nova-lit-page-heading nova-contracts-heading">
          <div>
            <h1>Carteira de contratos</h1>
            <p className="nova-lit-page-subtitle">Lista rastreável dos contratos reais cadastrados no backend.</p>
          </div>

          <div className="nova-lit-page-actions">
            <Link href={withParams("/contratos", currentParams, { page: safePage })} className="nova-lit-button nova-lit-button-secondary">Atualizar</Link>
            {isAdmin ? <Link href="/contratos/cadastro" className="nova-lit-button nova-lit-button-primary">Cadastrar contrato</Link> : null}
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
            <input name="q" defaultValue={state.q} placeholder="Buscar contrato, parceiro, unidade ou cidade" />
          </label>

          <label className="nova-contracts-field">
            <span>Status</span>
            <select name="status" defaultValue={state.status}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="draft">Rascunhos</option>
              <option value="expired">Vencidos</option>
              <option value="cancelled">Cancelados</option>
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
                <h2>Contratos do recorte</h2>
              </div>
              <div>
                <small>{contracts.items.length} linhas</small>
                <Link href="/parceiros">Parceiros</Link>
              </div>
            </div>

            <div className="nova-contracts-table">
              <div className="nova-contracts-table-head">
                <span>Contrato</span>
                <span>Parceiro</span>
                <span>Cobertura</span>
                <span>Banda</span>
                <span>Completude</span>
                <span>Status</span>
                <span>Ações</span>
              </div>

              {contracts.items.length ? contracts.items.map((contract) => (
                <div className={`nova-contracts-row is-${contractStatusTone(contract.status)}`} key={contract.id}>
                  <div>
                    <strong>{contract.code}</strong>
                    <small>{contract.title || contract.sourceContractLabel || contract.type || "sem título"}</small>
                  </div>

                  <div>
                    <Link href={`/parceiros/${contract.partner.id}`} className="nova-contracts-target-link">{contract.partner.name}</Link>
                    <small>{contract.partner.code}</small>
                  </div>

                  <div>
                    <b>{contract.unitCount} unidade(s)</b>
                    <small>{contract.units[0] ? locationLabel(contract.units[0].unit) : "sem unidade vinculada"}</small>
                  </div>

                  <div>
                    <b>{contract.totalBandwidthMbps ? `${contract.totalBandwidthMbps.toLocaleString("pt-BR")} Mbps` : "não informada"}</b>
                    <small>{formatMoneyCents(contract.monthlyValueCents)}</small>
                  </div>

                  <div>
                    <b>{contractCompleteness(contract)}%</b>
                    <small>{missingReason(contract)}</small>
                  </div>

                  <div>
                    <Badge tone={contractStatusTone(contract.status)}>{contractStatusLabel(contract.status)}</Badge>
                  </div>

                  <div>
                    <Link href={`/contratos/${contract.id}`}>Abrir</Link>
                    {isAdmin ? <Link href={`/contratos/${contract.id}/editar`}>Editar</Link> : null}
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
                <h2>Qualidade contratual</h2>
                <span className="nova-lit-pill nova-lit-pill-orange">{pendingContracts.length} pendências</span>
              </div>
              <div className="nova-contracts-progress-list">
                <ProgressLine label="Ativos" value={percent(activeContracts.meta.total, allContracts.meta.total)} tone="green" href={statusHref(state, "active")} />
                <ProgressLine label="Rascunhos" value={percent(draftContracts.meta.total, allContracts.meta.total)} tone="orange" href={statusHref(state, "draft")} />
                <ProgressLine label="Vencidos" value={percent(expiredContracts.meta.total, allContracts.meta.total)} tone="red" href={statusHref(state, "expired")} />
                <ProgressLine label="Cancelados" value={percent(cancelledContracts.meta.total, allContracts.meta.total)} tone="slate" href={statusHref(state, "cancelled")} />
              </div>
            </section>

            <section className="nova-lit-card nova-contracts-quick">
              <span>Atalhos da carteira</span>
              <Link href={statusHref(state, "active")}>Ativos <b>{activeContracts.meta.total}</b></Link>
              <Link href={statusHref(state, "draft")}>Rascunhos <b>{draftContracts.meta.total}</b></Link>
              <Link href={statusHref(state, "expired")}>Vencidos <b>{expiredContracts.meta.total}</b></Link>
            </section>

            <section className="nova-lit-card nova-contracts-pending">
              <div className="nova-lit-title-row">
                <h2>Contratos pendentes</h2>
                <span className="nova-lit-pill nova-lit-pill-orange">{pendingContracts.length}</span>
              </div>
              <div className="nova-contracts-unit-list">
                {pendingContracts.length ? pendingContracts.map((contract) => (
                  <Link key={contract.id} href={`/contratos/${contract.id}/editar`}>
                    <Dot tone="orange" />
                    <div>
                      <strong>{contract.code}</strong>
                      <span>{contract.partner.name} · {missingReason(contract)}</span>
                    </div>
                  </Link>
                )) : (
                  <div className="nova-contracts-list-empty">Nenhuma pendência na página atual.</div>
                )}
              </div>
            </section>

            <section className="nova-lit-card nova-contracts-ready">
              <div className="nova-lit-title-row">
                <h2>Contratos prontos</h2>
                <span className="nova-lit-pill nova-lit-pill-green">{readyContracts.length}</span>
              </div>
              <div className="nova-contracts-unit-list">
                {readyContracts.length ? readyContracts.map((contract) => (
                  <Link key={contract.id} href={`/contratos/${contract.id}`}>
                    <Dot tone="green" />
                    <div>
                      <strong>{contract.code}</strong>
                      <span>{contract.partner.name} · {contract.unitCount} unidade(s)</span>
                    </div>
                  </Link>
                )) : (
                  <div className="nova-contracts-list-empty">Complete unidade, serviço, SLA e faturamento.</div>
                )}
              </div>
            </section>
          </aside>
        </section>

        <section className="nova-lit-card nova-contracts-pagination">
          <span>
            Página {safePage} de {totalPages} · {contracts.meta.total} contrato(s)
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
      </section>
    </NovaLitShell>
  );
}
