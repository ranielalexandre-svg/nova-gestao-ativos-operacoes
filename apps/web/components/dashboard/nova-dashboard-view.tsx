import Link from "next/link";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";

type Tone = "green" | "orange" | "blue" | "red" | "muted";

const kpis: Array<{ label: string; value: string; hint: string; tone: Tone; icon: string }> = [
  { label: "Unidades online", value: "0/0", hint: "cobertura 0%", tone: "green", icon: "M4 20V8l8-4 8 4v12M9 20v-7h6v7" },
  { label: "Críticas", value: "0", hint: "prioridade máxima", tone: "red", icon: "M12 3l9 16H3L12 3Z" },
  { label: "Chamados vencidos", value: "0", hint: "fora do prazo", tone: "orange", icon: "M5 7h14M5 12h14M5 17h10" },
  { label: "Pressão operacional", value: "0", hint: "índice do turno", tone: "blue", icon: "M4 12h4l2-7 4 14 2-7h4" },
];

const quickLinks = [
  { href: "/unidades", label: "Abrir unidades", meta: "cadastro e operação" },
  { href: "/sensores", label: "Ver sensores", meta: "telemetria e vínculos" },
  { href: "/alertas", label: "Fila de alertas", meta: "eventos e ocorrências" },
  { href: "/relatorios/monitoramento", label: "Gerar relatório", meta: "monitoramento NOVA" },
];

const tableColumns = ["Caso", "Alvo", "Severidade", "Status", "Criado", "Responsável"];

function Dot({ tone }: { tone: Tone }) {
  return <span className={`nova-lit-dot nova-lit-dot-${tone}`} />;
}

function LineIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {path.split("M").filter(Boolean).map((segment) => (
        <path key={segment} d={`M${segment}`} />
      ))}
    </svg>
  );
}

function KpiCard({ label, value, hint, tone, icon }: (typeof kpis)[number]) {
  return (
    <article className="nova-lit-card nova-lit-kpi">
      <div className="nova-lit-card-head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <div className="nova-lit-kpi-body">
        <strong>{value}</strong>
        <span className="nova-lit-kpi-icon">
          <LineIcon path={icon} />
        </span>
      </div>
      <p>{hint}</p>
    </article>
  );
}

function StatusStrip() {
  const items: Array<{ label: string; value: string; tone: Tone }> = [
    { label: "Backlog", value: "0", tone: "orange" },
    { label: "NOC", value: "0", tone: "blue" },
    { label: "Campo", value: "0", tone: "green" },
  ];

  return (
    <div className="nova-lit-status-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span><Dot tone={item.tone} />{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="nova-lit-empty-state">
      <div className="nova-lit-empty-mark">N</div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export default function NovaDashboardView() {
  return (
    <NovaLitShell activeHref="/dashboard">
      <div className="nova-lit-page-heading">
        <div>
          <div className="nova-lit-breadcrumb">
            <span>Nova</span>
            <b>/ Visão geral</b>
          </div>
          <h1>Visão geral</h1>
          <p className="nova-lit-page-subtitle">Resumo executivo da operação, alertas, chamados e cobertura monitorada.</p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/alertas" className="nova-lit-button nova-lit-button-secondary">Atualizar fila</Link>
          <Link href="/relatorios/monitoramento" className="nova-lit-button nova-lit-button-primary">Gerar relatório</Link>
        </div>
      </div>

      <section className="nova-lit-kpi-grid" aria-label="Indicadores principais">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="nova-lit-dashboard-grid">
        <div className="nova-lit-dashboard-left">
          <section className="nova-lit-card nova-lit-command-card">
            <div className="nova-lit-action-row">
              <div>
                <span>Operação em tempo real</span>
                <h2>Fila operacional</h2>
              </div>
              <Link href="/operacao/fila">Abrir fila</Link>
            </div>

            <div className="nova-lit-filter-row" aria-label="Filtros da fila operacional">
              <button type="button" className="is-active">Todos</button>
              <button type="button"><Dot tone="red" />Críticos</button>
              <button type="button"><Dot tone="orange" />Atenção</button>
              <button type="button"><Dot tone="blue" />Em análise</button>
              <button type="button"><Dot tone="green" />Resolvidos</button>
              <label>
                <span>Buscar</span>
                <input placeholder="Buscar alerta, unidade ou ativo..." />
              </label>
            </div>

            <div className="nova-lit-table">
              <div className="nova-lit-table-head">
                {tableColumns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
              <div className="nova-lit-table-empty">
                <EmptyState title="Nenhum alerta recente" description="Quando houver eventos da rede, eles aparecerão nesta fila." />
              </div>
            </div>
          </section>

          <section className="nova-lit-row-3">
            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Saúde da rede</h2>
                <span className="nova-lit-pill nova-lit-pill-green">0%</span>
              </div>
              <p>perda, latência e disponibilidade consolidada</p>
              <div className="nova-lit-mini-chart">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </article>

            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Backlog</h2>
                <span className="nova-lit-pill nova-lit-pill-orange">0</span>
              </div>
              <p>alertas abertos por severidade</p>
              <StatusStrip />
            </article>

            <article className="nova-lit-card nova-lit-mini-card">
              <div className="nova-lit-title-row">
                <h2>Chamados</h2>
                <span className="nova-lit-pill nova-lit-pill-blue">0 hoje</span>
              </div>
              <p>status dos chamados técnicos</p>
              <EmptyState title="Sem chamados recentes" description="Nenhum chamado cadastrado para o turno." />
            </article>
          </section>

          <section className="nova-lit-card nova-lit-events-card">
            <div className="nova-lit-action-row">
              <div>
                <span>Eventos recentes</span>
                <h2>Linha do turno</h2>
              </div>
              <Link href="/alertas">Ver todos</Link>
            </div>

            <div className="nova-lit-events-grid">
              {["Queda de link", "Alta latência", "Uso de banda elevado", "Serviço restabelecido"].map((event, index) => (
                <article key={event} className={`nova-lit-event-card nova-lit-event-${index + 1}`}>
                  <small>{index === 0 ? "Crítico" : index === 1 ? "Atenção" : index === 2 ? "Em análise" : "Resolvido"}</small>
                  <strong>{event}</strong>
                  <span>Nenhum registro ativo.</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="nova-lit-dashboard-right">
          <section className="nova-lit-card nova-lit-shortcuts">
            <h2>Atalhos</h2>
            <p>Ações principais do turno.</p>

            {quickLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                <span>{item.meta}</span>
              </Link>
            ))}
          </section>

          <section className="nova-lit-card nova-lit-severity-card">
            <div className="nova-lit-title-row">
              <h2>Severidades</h2>
              <span className="nova-lit-pill nova-lit-pill-green">0 ativas</span>
            </div>
            <div className="nova-lit-severity-bars">
              <span data-tone="red" />
              <span data-tone="orange" />
              <span data-tone="blue" />
              <span data-tone="green" />
            </div>
            <ul>
              <li><Dot tone="red" />Críticos <b>0</b></li>
              <li><Dot tone="orange" />Atenção <b>0</b></li>
              <li><Dot tone="blue" />Em análise <b>0</b></li>
              <li><Dot tone="green" />Resolvidos <b>0</b></li>
            </ul>
          </section>

          <section className="nova-lit-card nova-lit-coverage-card">
            <h2>Cobertura monitorada</h2>
            <div className="nova-lit-ring">
              <strong>0%</strong>
              <span>online</span>
            </div>
            <p>Sem telemetria carregada para calcular disponibilidade.</p>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
