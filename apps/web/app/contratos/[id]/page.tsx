import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  contractCompleteness,
  contractStatusLabel,
  contractStatusTone,
  formatContractDate,
  formatMoneyCents,
  initials,
  locationLabel,
  type ContractRow,
} from "@/lib/contracts";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type Params = {
  id: string;
};

type Tone = "green" | "orange" | "blue" | "red" | "slate";

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`nova-contracts-badge is-${tone}`}>{children}</span>;
}

function formatSla(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toLocaleString("pt-BR")}%` : "não informado";
}

async function readContract(id: string) {
  try {
    return await apiJson<ContractRow>(`/contracts/${id}`);
  } catch {
    notFound();
  }
}

export default async function ContratoDetalhePage({ params }: { params: Promise<Params> | Params }) {
  const session = await getServerWebSession();
  const resolved = await Promise.resolve(params);

  if (!session.authenticated) {
    redirect(`/login?next=/contratos/${resolved.id}`);
  }

  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";
  const contract = await readContract(resolved.id);

  return (
    <NovaLitShell activeHref="/contratos">
      <section className="nova-contract-detail-page" aria-label="Detalhe do contrato">
        <header className="nova-contract-detail-hero">
          <nav className="nova-contract-detail-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link href="/contratos">Contratos</Link>
            <span>/</span>
            <strong>{contract.code}</strong>
          </nav>

          <div className="nova-contract-detail-title-row">
            <div>
              <h1>Contrato {contract.code}</h1>
              <p>{contract.title || `Contrato de ${contract.partner.name} com ${contract.unitCount} unidade(s) coberta(s).`}</p>
            </div>

            <div className="nova-contract-detail-actions">
              <Link href="/contratos">Voltar</Link>
              <Link href={`/parceiros/${contract.partner.id}`}>Parceiro</Link>
              {isAdmin ? <Link href={`/contratos/${contract.id}/editar`} className="is-primary">Editar</Link> : null}
            </div>
          </div>
        </header>

        <section className="nova-contract-detail-summary" aria-label="Resumo do contrato">
          <article>
            <i>C</i>
            <span>Parceiro</span>
            <strong>{contract.partner.name}</strong>
            <small>{contract.partner.code}</small>
            <small><Link href={`/parceiros/${contract.partner.id}`}>abrir parceiro</Link></small>
          </article>
          <article>
            <i className={`is-${contractStatusTone(contract.status)}`}>S</i>
            <span>Status</span>
            <strong>{contractStatusLabel(contract.status)}</strong>
            <small>Completude {contractCompleteness(contract)}%</small>
            <small>Fonte: /contracts/{contract.id}</small>
          </article>
          <article>
            <i>V</i>
            <span>Vigência</span>
            <strong>{formatContractDate(contract.startsAt)}</strong>
            <small>até {formatContractDate(contract.endsAt)}</small>
            <small>assinado em {formatContractDate(contract.signedAt)}</small>
          </article>
          <article>
            <i>$</i>
            <span>Valor mensal</span>
            <strong>{formatMoneyCents(contract.monthlyValueCents)}</strong>
            <small>{contract.billingCycle || "ciclo não informado"}</small>
            <small>{contract.paymentMethod || "pagamento não informado"}</small>
          </article>
          <article>
            <i>U</i>
            <span>Unidades cobertas</span>
            <strong>{contract.unitCount}</strong>
            <small>{contract.totalBandwidthMbps.toLocaleString("pt-BR")} Mbps contratados</small>
            <small><Link href="#unidades">ver unidades</Link></small>
          </article>
          <article>
            <i>A</i>
            <span>SLA</span>
            <strong>{formatSla(contract.slaPercent)}</strong>
            <small>{contract.renewalMode || "renovação não informada"}</small>
            <small>{contract.terminationPenalty || "penalidade não informada"}</small>
          </article>
        </section>

        <section className="nova-contract-detail-grid">
          <aside className="nova-contract-detail-left">
            <article className="nova-contract-detail-card">
              <h2>Resumo do contrato</h2>
              <dl>
                <div><dt>Número</dt><dd>{contract.code}</dd></div>
                <div><dt>Título</dt><dd>{contract.title || "não informado"}</dd></div>
                <div><dt>Tipo</dt><dd>{contract.type || "não informado"}</dd></div>
                <div><dt>Origem</dt><dd>{contract.source}</dd></div>
                <div><dt>Índice de reajuste</dt><dd>{contract.adjustmentIndex || "não informado"}</dd></div>
                <div><dt>Fidelidade</dt><dd>{contract.loyaltyMonths ? `${contract.loyaltyMonths} meses` : "não informado"}</dd></div>
                <div><dt>Observações</dt><dd>{contract.notes || "sem observações"}</dd></div>
              </dl>
            </article>

            <article className="nova-contract-detail-card">
              <header>
                <h2>Serviços contratados</h2>
                {isAdmin ? <Link href={`/contratos/${contract.id}/editar#servicos`}>Adicionar</Link> : null}
              </header>
              <div className="nova-contract-detail-services">
                {contract.services.length ? contract.services.map((service) => (
                  <div key={service.id}>
                    <i className={service.status === "active" ? "is-green" : "is-yellow"}>{service.name.slice(0, 2).toUpperCase()}</i>
                    <strong>{service.name}</strong>
                    <span>{service.description || service.serviceType || "sem descrição"}</span>
                  </div>
                )) : (
                  <div>
                    <i className="is-yellow">S</i>
                    <strong>Sem serviço cadastrado</strong>
                    <span>Inclua os serviços reais no editor do contrato.</span>
                  </div>
                )}
              </div>
            </article>
          </aside>

          <main className="nova-contract-detail-main">
            <article className="nova-contract-detail-card" id="unidades">
              <header>
                <h2>Unidades vinculadas</h2>
                {isAdmin ? <Link href={`/contratos/${contract.id}/editar#unidades`}>Vincular unidade</Link> : null}
              </header>
              <div className="nova-contract-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Endereço</th>
                      <th>Cidade/UF</th>
                      <th>Banda</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.units.length ? contract.units.map((item) => (
                      <tr key={item.id}>
                        <td><Link href={`/unidades/${item.unit.id}`}>{item.unit.code} - {item.unit.name}</Link></td>
                        <td>{item.addressLine || "-"}</td>
                        <td>{locationLabel(item.unit)}</td>
                        <td>{item.bandwidthLabel || (item.bandwidthMbps ? `${item.bandwidthMbps} Mbps` : "-")}</td>
                        <td><Badge tone={item.status === "active" ? "green" : "slate"}>{item.status === "active" ? "Ativa" : "Inativa"}</Badge></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5}>Nenhuma unidade vinculada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="nova-contract-detail-card">
              <header>
                <h2>Faturamento</h2>
                {isAdmin ? <Link href={`/contratos/${contract.id}/editar#faturamento`}>Atualizar</Link> : null}
              </header>
              <div className="nova-contract-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.billings.length ? contract.billings.map((billing) => (
                      <tr key={billing.id}>
                        <td>{billing.referenceMonth}</td>
                        <td>{formatMoneyCents(billing.amountCents)}</td>
                        <td>{billing.status}</td>
                        <td>{formatContractDate(billing.dueDate)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>Nenhum faturamento registrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </main>

          <aside className="nova-contract-detail-right">
            <article className="nova-contract-detail-card">
              <header>
                <h2>Contatos responsáveis</h2>
                {isAdmin ? <Link href={`/contratos/${contract.id}/editar#contatos`}>Adicionar</Link> : null}
              </header>
              <div className="nova-contract-detail-contacts">
                {contract.contacts.length ? contract.contacts.map((contact) => (
                  <div key={contact.id}>
                    <i>{initials(contact.name)}</i>
                    <strong>{contact.name}<span>{contact.role || "Contato"}</span></strong>
                    <small>{contact.email || "sem e-mail"}</small>
                    <small>{contact.phone || "sem telefone"}</small>
                  </div>
                )) : (
                  <div>
                    <strong>Sem contato<span>Cadastre ao menos um responsável.</span></strong>
                  </div>
                )}
              </div>
            </article>

            <article className="nova-contract-detail-card">
              <h2>Ações rápidas</h2>
              <div className="nova-contract-detail-quick">
                {isAdmin ? <Link href={`/contratos/${contract.id}/editar`}>Editar contrato</Link> : null}
                <Link href={`/parceiros/${contract.partner.id}`}>Abrir parceiro</Link>
                <Link href="/operacao/relatorios">Relatórios</Link>
              </div>
            </article>
          </aside>
        </section>
      </section>
    </NovaLitShell>
  );
}
