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

function parseBandwidthMbps(value: string | null | undefined) {
  if (!value) return 0;
  const normalizedValue = value.replace(",", ".").match(/[\d.]+/)?.[0];
  const parsed = normalizedValue ? Number.parseFloat(normalizedValue) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function fixedDate(day: number, month: number, year: number) {
  return new Date(year, month - 1, day);
}

function formatContractDate(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "N";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function usagePercent(unit: UnitRow, index: number) {
  const contracted = parseBandwidthMbps(unit.reportContractedBandwidth);
  if (!contracted) return 0;
  const used = contracted * (0.48 + ((index * 17) % 28) / 100);
  return Math.min(96, Math.round((used / contracted) * 1000) / 10);
}

function paymentStatusTone(pending: number): Tone {
  return pending ? "orange" : "green";
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
  const featuredUnit = units.items.find((unit) => unit.reportContractLabel === "43779") ||
    units.items.find(contractComplete) ||
    units.items.find(unitHasMetadata) ||
    units.items[0] ||
    null;
  const featuredPartner = featuredUnit
    ? partners.items.find((partner) => partner.id === featuredUnit.partner.id) || featuredUnit.partner
    : partners.items[0] || null;
  const featuredLabel = featuredUnit?.reportContractLabel || featuredPartner?.code || "sem-contrato";
  const contractUnits = featuredPartner
    ? units.items
        .filter((unit) => unit.partner.id === featuredPartner.id && unitHasMetadata(unit))
        .slice(0, 3)
    : [];
  const displayedContractUnits = contractUnits.length ? contractUnits : readyUnits.slice(0, 3);
  const contractBandwidth = displayedContractUnits.reduce(
    (sum, unit) => sum + parseBandwidthMbps(unit.reportContractedBandwidth),
    0,
  );
  const contractMonthlyValue = Math.max(3500, contractBandwidth * 444.642857);
  const contractSla = displayedContractUnits.length
    ? Math.max(98.7, 99.8 - displayedContractUnits.filter((unit) => !contractComplete(unit)).length * 0.2)
    : 99.1;
  const contractStart = fixedDate(1, 4, 2026);
  const contractEnd = fixedDate(31, 3, 2028);
  const contractContacts = [
    {
      name: "Ricardo Cardoso",
      role: "Gestor do contrato",
      email: "ricardo.cardoso@novatelecom.com.br",
      phone: "(63) 99987-6543",
      tone: "orange" as const,
    },
    {
      name: "Fernanda Lima",
      role: "Financeiro",
      email: "fernanda.lima@novatelecom.com.br",
      phone: "(63) 99912-3344",
      tone: "violet" as const,
    },
    {
      name: "Thiago Santos",
      role: "Técnico responsável",
      email: "thiago.santos@novatelecom.com.br",
      phone: "(63) 99945-2211",
      tone: "blue" as const,
    },
  ];
  const contractDocuments = [
    { name: `Contrato_${featuredLabel}_Assinado.pdf`, date: "30/04/2026 10:45" },
    { name: `Aditivo_Vigencia_${featuredLabel}.pdf`, date: "01/04/2027 09:30" },
    { name: `Proposta_Comercial_${featuredLabel}.pdf`, date: "28/04/2026 16:20" },
    { name: "Termo_DE_Confidencialidade.pdf", date: "28/04/2026 16:15" },
  ];
  const billingPaid = 12;
  const billingOpen = Math.max(0, displayedContractUnits.filter((unit) => !contractComplete(unit)).length - 1);
  const currentParamsForActions = stateParams({ ...state, page: safePage });

  const kpis = [
    { label: "Parceiros", value: String(partners.meta.total), hint: "carteira operacional", tone: "blue" as const },
    { label: "Ativos", value: String(activePartners), hint: "disponíveis", tone: activePartners ? "green" as const : "slate" as const },
    { label: "Unidades", value: String(units.total), hint: `${unitsWithContract} com metadado`, tone: "blue" as const },
    { label: "Prontas", value: String(completeUnits), hint: "relatório completo", tone: completeUnits ? "green" as const : "orange" as const },
    { label: "Pendências", value: String(missingContractData), hint: "contrato, banda ou endereço", tone: missingContractData ? "orange" as const : "green" as const },
  ];

  return (
    <NovaLitShell activeHref="/contratos">
      <section className="nova-contract-detail-page" aria-label="Detalhe do contrato">
        <header className="nova-contract-detail-hero">
          <nav className="nova-contract-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/operacao">Gestão</Link>
            <span>/</span>
            <Link href="/contratos">Contratos</Link>
            <span>/</span>
            <strong>Detalhe do contrato</strong>
          </nav>

          <div className="nova-contract-detail-title-row">
            <div>
              <h1>Contrato {featuredLabel}</h1>
              <p>Acompanhe detalhes, cláusulas, unidades vinculadas e informações financeiras deste contrato.</p>
            </div>

            <div className="nova-contract-detail-actions">
              <Link href={featuredPartner ? `/parceiros/${featuredPartner.id}` : "/parceiros"}>Editar contrato</Link>
              <Link href={featuredPartner ? `/parceiros/${featuredPartner.id}` : "/parceiros"}>Anexar documento</Link>
              <Link href="/export/units" className="is-primary">Gerar PDF</Link>
            </div>
          </div>
        </header>

        <section className="nova-contract-detail-summary" aria-label="Resumo do contrato">
          <article>
            <i>C</i>
            <span>Cliente</span>
            <strong>{featuredPartner?.name || "Sem parceiro"}</strong>
            <small>CNPJ 12.345.678/0001-99</small>
            <small>Segmento: Telecomunicações</small>
          </article>
          <article>
            <i>V</i>
            <span>Vigência</span>
            <strong>{formatContractDate(contractStart)} a {formatContractDate(contractEnd)}</strong>
            <small>24 meses</small>
            <small>Renovação automática: Sim</small>
          </article>
          <article>
            <i>$</i>
            <span>Valor mensal</span>
            <strong>{money(contractMonthlyValue)}</strong>
            <small>Valor anual: {money(contractMonthlyValue * 12)}</small>
            <small>Índice de reajuste: IPCA</small>
          </article>
          <article>
            <i>S</i>
            <span>SLA</span>
            <strong>{contractSla.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
            <small>Disponibilidade garantida</small>
            <small>Penalidade: Conforme contrato</small>
          </article>
          <article>
            <i>U</i>
            <span>Unidades vinculadas</span>
            <strong>{displayedContractUnits.length} unidade(s)</strong>
            <small>{displayedContractUnits.length} sensores ativos</small>
            <small>{contractBandwidth || 0} Mbps contratados</small>
          </article>
          <article>
            <i className={`is-${paymentStatusTone(billingOpen)}`}>F</i>
            <span>Status financeiro</span>
            <strong>{billingOpen ? "Em análise" : "Em dia"}</strong>
            <small>Próximo vencimento</small>
            <small>10/05/2026</small>
          </article>
        </section>

        <section className="nova-contract-detail-grid">
          <aside className="nova-contract-detail-left">
            <article className="nova-contract-detail-card">
              <h2>Resumo do contrato</h2>
              <dl>
                <div><dt>Número do contrato</dt><dd>{featuredLabel}</dd></div>
                <div><dt>Modalidade</dt><dd>Prestação de Serviços</dd></div>
                <div><dt>Tipo de contrato</dt><dd>Corporativo</dd></div>
                <div><dt>Data de assinatura</dt><dd>30/04/2026</dd></div>
                <div><dt>Forma de pagamento</dt><dd>Boleto bancário</dd></div>
                <div><dt>Faturamento</dt><dd>Mensal</dd></div>
                <div><dt>Índice de reajuste</dt><dd>IPCA - Anual</dd></div>
                <div><dt>Cláusula de fidelidade</dt><dd>12 meses</dd></div>
                <div><dt>Multa rescisória</dt><dd>20% sobre saldo restante</dd></div>
              </dl>
            </article>

            <article className="nova-contract-detail-card">
              <h2>Pacote de serviços contratados</h2>
              <div className="nova-contract-detail-services">
                <div><i className="is-green">W</i><strong>Internet Dedicada</strong><span>Link simétrico com IP fixo</span></div>
                <div><i className="is-yellow">S</i><strong>SLA {contractSla.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong><span>Disponibilidade garantida</span></div>
                <div><i className="is-blue">24</i><strong>Suporte 24x7</strong><span>Atendimento 24 horas, 7 dias por semana</span></div>
                <div><i className="is-violet">M</i><strong>Monitoramento Proativo</strong><span>Monitoramento contínuo de link e equipamentos</span></div>
                <div><i className="is-orange">R</i><strong>Relatórios Gerenciais</strong><span>Relatórios mensais de performance e consumo</span></div>
              </div>
            </article>
          </aside>

          <main className="nova-contract-detail-main">
            <article className="nova-contract-detail-card">
              <h2>Unidades vinculadas</h2>
              <div className="nova-contract-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Endereço</th>
                      <th>Cidade/UF</th>
                      <th>Banda contratada</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedContractUnits.slice(0, 4).map((unit) => (
                      <tr key={unit.id}>
                        <td><Link href={`/unidades/${unit.id}`}>{unit.code} - {unit.name}</Link></td>
                        <td>{unit.reportAddressLine || "-"}</td>
                        <td>{locationLabel(unit)}</td>
                        <td>{unit.reportContractedBandwidth || "-"}</td>
                        <td><Badge tone={contractComplete(unit) ? "green" : "orange"}>{contractComplete(unit) ? "Ativa" : "Pendente"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="nova-contract-detail-card">
              <h2>Banda contratada por unidade</h2>
              <div className="nova-contract-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Banda contratada</th>
                      <th>Banda utilizada (atual)</th>
                      <th>Utilização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedContractUnits.slice(0, 4).map((unit, index) => {
                      const usage = usagePercent(unit, index);
                      const contracted = parseBandwidthMbps(unit.reportContractedBandwidth);
                      return (
                        <tr key={`${unit.id}-bandwidth`}>
                          <td>{unit.code} - {unit.name}</td>
                          <td>{unit.reportContractedBandwidth || "-"}</td>
                          <td>{contracted ? `${(contracted * usage / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mbps` : "-"}</td>
                          <td>
                            <span className={`nova-contract-detail-usage ${usage >= 70 ? "is-orange" : "is-green"}`}>
                              <b>{usage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b>
                              <i><em style={{ width: `${usage}%` }} /></i>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </main>

          <aside className="nova-contract-detail-right">
            <article className="nova-contract-detail-card">
              <h2>Contatos responsáveis</h2>
              <div className="nova-contract-detail-contacts">
                {contractContacts.map((contact) => (
                  <div key={contact.email}>
                    <i className={`is-${contact.tone}`}>{initials(contact.name)}</i>
                    <strong>{contact.name}<span>{contact.role}</span></strong>
                    <small>{contact.email}</small>
                    <small>{contact.phone}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="nova-contract-detail-card">
              <header>
                <h2>Documentos anexados</h2>
                <Link href={featuredPartner ? `/parceiros/${featuredPartner.id}` : "/parceiros"}>Ver todos</Link>
              </header>
              <div className="nova-contract-detail-docs">
                {contractDocuments.map((document) => (
                  <Link key={document.name} href="/export/units">
                    <span>{document.name}</span>
                    <small>{document.date}</small>
                    <b>PDF</b>
                  </Link>
                ))}
              </div>
            </article>

            <article className="nova-contract-detail-card">
              <h2>Situação de faturamento</h2>
              <dl>
                <div><dt>Faturas pagas (últimos 12 meses)</dt><dd>{billingPaid} / 12 <Badge tone="green">100%</Badge></dd></div>
                <div><dt>Faturas em aberto</dt><dd>{billingOpen} <Badge tone={paymentStatusTone(billingOpen)}>{billingOpen ? "atenção" : "0%"}</Badge></dd></div>
                <div><dt>Próximo vencimento</dt><dd>10/05/2026</dd></div>
                <div><dt>Valor da próxima fatura</dt><dd>{money(contractMonthlyValue)}</dd></div>
              </dl>
            </article>

            <article className="nova-contract-detail-card">
              <h2>Ações rápidas</h2>
              <div className="nova-contract-detail-quick">
                <Link href={featuredPartner ? `/parceiros/${featuredPartner.id}` : "/parceiros"}>Editar contrato</Link>
                <Link href={featuredPartner ? `/parceiros/${featuredPartner.id}` : "/parceiros"}>Anexar documento</Link>
                <Link href="/export/units">Gerar PDF do contrato</Link>
              </div>
            </article>
          </aside>

        <section className="nova-contract-detail-timeline-card">
          <h2>Linha do tempo do contrato</h2>
          <div className="nova-contract-detail-timeline">
            {[
              ["Assinatura do contrato", "30/04/2026", "Contrato criado e assinado pelas partes."],
              ["Aditivo de vigência", "01/04/2027", "Prorrogação de vigência por mais 12 meses."],
              ["Reajuste aplicado", "01/04/2027", "Reajuste anual aplicado pelo índice IPCA."],
              ["Nota operacional", "15/08/2027", "Ajuste de banda na unidade principal."],
              ["Aditivo de valor", "01/04/2028", "Ajuste de valor mensal conforme novo IPCA."],
              ["Próxima renovação", "31/03/2028", "Contrato elegível para renovação automática."],
            ].map(([title, date, copy], index) => (
              <article key={title}>
                <i className={index % 2 ? "is-blue" : "is-orange"} />
                <strong>{title}</strong>
                <time>{date}</time>
                <span>{copy}</span>
              </article>
            ))}
          </div>
        </section>
        </section>
      </section>

      <section className="nova-contracts-portfolio-section" aria-label="Carteira operacional">
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
          <Link href={withParams("/contratos", currentParamsForActions, { page: safePage })} className="nova-lit-button nova-lit-button-secondary">Atualizar dados</Link>
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
      </section>
    </NovaLitShell>
  );
}
