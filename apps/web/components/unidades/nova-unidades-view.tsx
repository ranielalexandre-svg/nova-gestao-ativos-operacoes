import Link from "next/link";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { withParams, type PaginationMeta, type RawSearchParams } from "@/lib/list-query";

type Tone = "green" | "orange" | "blue" | "red" | "muted" | "slate";

type UnitOperationalSummary = {
  operationalRows: number;
  secretRows: number;
  backupRows: number;
  phones: number;
  primaryPhone: string | null;
  primaryPartnerCode: string | null;
  primaryServiceType: string | null;
  primaryTechnology: string | null;
};

type UnitEquipment = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
};

export type NovaUnitListItem = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportContractLabel: string | null;
  reportAddressLine: string | null;
  reportContractedBandwidth: string | null;
  reportNotes: string | null;
  isActive: boolean;
  createdAt: string;
  operational?: UnitOperationalSummary;
  partner: {
    id: string;
    code: string;
    name: string;
  };
  equipments: UnitEquipment[];
  _count: {
    equipments: number;
    operationalInfos?: number;
    operationalSecrets?: number;
  };
};

export type NovaUnitsListResponse = {
  items: NovaUnitListItem[];
  meta: PaginationMeta;
};

export type NovaUnitsSearchState = {
  q: string;
  active: "all" | "true" | "false";
  sortBy: "createdAt" | "code" | "name" | "city" | "state";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

type Kpi = {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
};

function searchParamsFromState(state: NovaUnitsSearchState): RawSearchParams {
  return {
    q: state.q || undefined,
    active: state.active,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: String(state.page),
    pageSize: String(state.pageSize),
  };
}

function locationOf(unit: NovaUnitListItem) {
  const city = unit.city?.trim();
  const state = unit.state?.trim();

  if (city && state) return `${city}/${state}`;
  if (city) return city;
  if (state) return state;
  return "Sem cidade/UF";
}

function contactOf(unit: NovaUnitListItem) {
  const phone = unit.operational?.primaryPhone?.trim();
  const service = unit.operational?.primaryServiceType?.trim();
  const technology = unit.operational?.primaryTechnology?.trim();

  if (phone) return phone;
  if (unit.operational?.phones) return `${unit.operational.phones} telefone(s) operacional(is)`;
  if (service || technology) return [service, technology].filter(Boolean).join(" · ");
  return "Sem telefone operacional";
}

function equipmentBadge(unit: NovaUnitListItem) {
  const count = unit._count.equipments || 0;
  const hasStarlink = unit.equipments.some((equipment) =>
    `${equipment.type} ${equipment.name} ${equipment.tag}`.toLowerCase().includes("starlink"),
  );

  if (!count) return "";
  if (hasStarlink) return `${count} STARLINK${count > 1 ? "S" : ""}`;
  return `${count} ATIVO${count > 1 ? "S" : ""}`;
}

function monitoringLabel(unit: NovaUnitListItem) {
  if (!unit.isActive) return "Inativa";
  if (!unit._count.equipments) return "Sem item";
  return "Com ativo";
}

function monitoringDetail(unit: NovaUnitListItem) {
  if (!unit.isActive) return "Unidade fora da operação ativa";
  if (!unit._count.equipments) return "Sem host confiável · sem sensores lidos";

  const firstEquipment = unit.equipments[0];
  if (!firstEquipment) return `${unit._count.equipments} ativo(s) vinculados`;

  return `${firstEquipment.tag || firstEquipment.name} · ${unit._count.equipments} ativo(s)`;
}

function qualityOf(unit: NovaUnitListItem) {
  if (!unit.isActive) return "inativa";
  if (!unit._count.equipments) return "sem-vinculo";
  return "parcial";
}

function Dot({ tone = "blue" }: { tone?: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function KpiCard({ label, value, hint, tone }: Kpi) {
  return (
    <article className="nova-lit-card nova-units-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function CompletionBar({
  label,
  value,
  tone = "green",
}: {
  label: string;
  value: number;
  tone?: "green" | "blue" | "orange";
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="nova-units-progress">
      <div>
        <span>{label}</span>
        <b>{safeValue}%</b>
      </div>
      <i>
        <em className={`is-${tone}`} style={{ width: `${safeValue}%` }} />
      </i>
    </div>
  );
}

function EmptyRows({ error }: { error: string }) {
  return (
    <div className="nova-units-empty">
      <div>N</div>
      <strong>{error ? "Unidades indisponíveis" : "Nenhuma unidade encontrada"}</strong>
      <span>{error || "Ajuste os filtros para ampliar o resultado."}</span>
    </div>
  );
}

export default function NovaUnidadesView({
  response,
  state,
  error,
}: {
  response: NovaUnitsListResponse;
  state: NovaUnitsSearchState;
  error?: string;
}) {
  const rows = response.items;
  const currentParams = searchParamsFromState(state);
  const activeRows = rows.filter((unit) => unit.isActive).length;
  const linkedRows = rows.filter((unit) => unit._count.equipments > 0).length;
  const contactRows = rows.filter((unit) => contactOf(unit) !== "Sem telefone operacional").length;
  const activeRatio = rows.length ? Math.round((activeRows / rows.length) * 100) : 0;
  const linkedRatio = rows.length ? Math.round((linkedRows / rows.length) * 100) : 0;
  const contactRatio = rows.length ? Math.round((contactRows / rows.length) * 100) : 0;
  const completeness = Math.round((activeRatio + linkedRatio + contactRatio) / 3);
  const totalAssetsOnPage = rows.reduce((sum, unit) => sum + unit._count.equipments, 0);
  const noLinkRows = rows.length - linkedRows;

  const kpis: Kpi[] = [
    { label: "Unidades", value: String(response.meta.total), hint: "resultado filtrado", tone: "blue" },
    { label: "Monitoradas", value: String(linkedRows), hint: `${linkedRatio}% nesta página`, tone: linkedRows ? "green" : "slate" },
    { label: "Com contato", value: String(contactRows), hint: "operacional gravado", tone: contactRows ? "green" : "slate" },
    { label: "Ativos", value: String(totalAssetsOnPage), hint: `${rows.length} linha(s)`, tone: totalAssetsOnPage ? "blue" : "slate" },
    { label: "Atenção", value: String(noLinkRows), hint: "sem ativo vinculado", tone: noLinkRows ? "orange" : "green" },
  ];

  return (
    <NovaLitShell activeHref="/unidades">
      <div className="nova-lit-page-heading nova-units-heading">
        <div>
          <h1>Unidades</h1>
          <p className="nova-lit-page-subtitle">Cadastro, vínculo e cobertura por unidade.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/administracao/importacao" className="nova-lit-button nova-lit-button-secondary">Importar CSV</Link>
          <Link href="/unidades/nova" className="nova-lit-button nova-lit-button-primary">Nova unidade</Link>
        </div>
      </div>

      <section className="nova-units-kpi-grid" aria-label="Indicadores de unidades">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <form className="nova-lit-card nova-units-filters" action="/unidades">
        <label className="nova-units-search">
          <span>Busca</span>
          <input
            name="q"
            defaultValue={state.q}
            placeholder="Unidade, cidade, parceiro, telefone ou serial"
          />
        </label>

        <label className="nova-units-field">
          <span>Status</span>
          <select name="active" defaultValue={state.active}>
            <option value="all">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>

        <label className="nova-units-field">
          <span>Ordem</span>
          <select name="sortBy" defaultValue={state.sortBy}>
            <option value="createdAt">Cadastro</option>
            <option value="name">Nome</option>
            <option value="code">Código</option>
            <option value="city">Cidade</option>
            <option value="state">UF</option>
          </select>
        </label>

        <label className="nova-units-field">
          <span>Direção</span>
          <select name="sortDir" defaultValue={state.sortDir}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>

        <label className="nova-units-field">
          <span>Linhas</span>
          <select name="pageSize" defaultValue={String(state.pageSize)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <input type="hidden" name="page" value="1" />

        <button type="submit">Filtrar</button>
        <Link href="/unidades?active=true&pageSize=10&sortBy=createdAt&sortDir=desc">Limpar</Link>
      </form>

      <section className="nova-units-main-grid">
        <div className="nova-lit-card nova-units-table-card">
          <div className="nova-units-table-title">
            <div>
              <span>Base técnica</span>
              <h2>Unidades cadastradas</h2>
            </div>

            <div>
              <small>{rows.length} linhas</small>
              <Link href="/relatorios/monitoramento">Relatório</Link>
            </div>
          </div>

          <div className="nova-units-table">
            <div className="nova-units-table-head">
              <span>Unidade</span>
              <span>Localização</span>
              <span>Parceiro</span>
              <span>Monitoramento</span>
              <span>Contato</span>
              <span>Ações</span>
            </div>

            {rows.length ? rows.map((unit) => {
              const badge = equipmentBadge(unit);

              return (
                <div className={`nova-units-row is-${qualityOf(unit)}`} key={unit.id}>
                  <div>
                    <strong>{unit.name}</strong>
                    <small>{unit.code || "Sem código"}</small>
                  </div>

                  <div>
                    <b>{locationOf(unit)}</b>
                  </div>

                  <div>
                    <b>{unit.partner?.name || "Sem parceiro"}</b>
                    <small>{unit.partner?.code || "Sem código"}</small>
                  </div>

                  <div>
                    <span className="nova-units-badge">{monitoringLabel(unit)}</span>
                    <small>{monitoringDetail(unit)}</small>
                  </div>

                  <div>
                    <b>{contactOf(unit)}</b>
                    {unit.operational?.operationalRows ? (
                      <small>
                        {unit.operational.operationalRows} dado(s) · {unit.operational.backupRows} backup(s)
                        {unit.operational.secretRows ? ` · ${unit.operational.secretRows} credencial(is)` : ""}
                      </small>
                    ) : null}
                    {badge ? <span className="nova-units-badge is-orange">{badge}</span> : null}
                  </div>

                  <div>
                    <Link href={`/unidades/${unit.id}`}>Abrir</Link>
                  </div>
                </div>
              );
            }) : (
              <EmptyRows error={error || ""} />
            )}
          </div>
        </div>

        <aside className="nova-units-right-col">
          <section className="nova-lit-card nova-units-completion">
            <div className="nova-lit-title-row">
              <h2>Completude</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">{completeness}%</span>
            </div>
            <p>Média técnica nesta página.</p>

            <div className="nova-units-completion-bars">
              <CompletionBar label="Unidades ativas" value={activeRatio} />
              <CompletionBar label="Contato" value={contactRatio} tone="blue" />
              <CompletionBar label="Ativos vinculados" value={linkedRatio} tone="orange" />
              <CompletionBar label="Cadastro completo" value={completeness} />
            </div>
          </section>

          <section className="nova-lit-card nova-units-quick">
            <span>Ação rápida</span>
            <Link href={withParams("/unidades", currentParams, { q: "", active: "true", page: 1 })}>
              Ativas <b>{activeRows}</b>
            </Link>
            <Link href={withParams("/unidades", currentParams, { q: state.q || "sem", page: 1 })}>
              Recorte atual <b>{rows.length}</b>
            </Link>
            <Link href="/relatorios/monitoramento">Gerar relatório</Link>
          </section>
        </aside>
      </section>

      <section className="nova-lit-card nova-units-pagination">
        <span>
          Página {response.meta.page} de {response.meta.totalPages} · {response.meta.total} registros
        </span>
        <div>
          <Link
            href={withParams("/unidades", currentParams, {
              page: Math.max(1, response.meta.page - 1),
            })}
            aria-disabled={!response.meta.hasPrev}
            className={!response.meta.hasPrev ? "is-disabled" : ""}
          >
            Anterior
          </Link>
          <Link
            href={withParams("/unidades", currentParams, {
              page: Math.min(response.meta.totalPages, response.meta.page + 1),
            })}
            aria-disabled={!response.meta.hasNext}
            className={!response.meta.hasNext ? "is-disabled" : ""}
          >
            Próxima
          </Link>
        </div>
      </section>
    </NovaLitShell>
  );
}
