import Link from "next/link";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { formatDateTime } from "@/lib/formatters";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";
import {
  activityLink,
  activityRefs,
  createSuiteActivity,
  dueLabel,
  formatNumber,
  readSuiteSnapshot,
  severityTone,
  sourceLabel,
  suiteMeta,
  toneClass,
  type EvidenceItem,
  type SuiteKind,
  type Tone,
} from "./data";

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-suite-pill ${toneClass(tone)}`}>{children}</span>;
}

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: Tone;
}) {
  return (
    <article className={`nova-suite-kpi ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function statusTone(status: EvidenceItem["status"]): Tone {
  if (status === "ausente") return "critical";
  if (status === "pendente") return "attention";
  return "success";
}

function evidenceLabel(status: EvidenceItem["status"]) {
  if (status === "suficiente") return "suficiente";
  if (status === "pendente") return "pendente";
  return "ausente";
}

function pageActionCopy(kind: SuiteKind) {
  if (kind === "evidencias") return "Registrar evidência";
  if (kind === "pos-incidente") return "Registrar pós-incidente";
  if (kind === "auditoria-operacional") return "Registrar auditoria";
  return "Registrar comunicação";
}

function pageActionTitle(kind: SuiteKind) {
  if (kind === "evidencias") return "Evidência operacional";
  if (kind === "pos-incidente") return "Fechamento pós-incidente";
  if (kind === "auditoria-operacional") return "Auditoria operacional";
  return "Comunicação do turno";
}

export async function SuitePosIncidentePage({ kind }: { kind: SuiteKind }) {
  const session = await getServerWebSession();
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";
  const meta = suiteMeta[kind];
  const snapshot = await readSuiteSnapshot();

  const evidencePending = snapshot.evidenceItems.filter((item) => item.status !== "suficiente").length;
  const manualActivities = snapshot.activities.items.filter((item) => item.source === "manual").length;
  const criticalActivities = snapshot.activities.items.filter((item) => ["high", "critical"].includes(item.severity || "")).length;
  const topEvidence = snapshot.evidenceItems.find((item) => item.status !== "suficiente") || snapshot.evidenceItems[0];

  return (
    <NovaLitShell activeHref={meta.activeHref}>
      <main className="nova-suite-page">
        <header className="nova-suite-hero">
          <div>
            <span>{meta.label}</span>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="nova-suite-hero-actions">
            <Link href={meta.exportHref} className="nova-lit-button nova-lit-button-primary">
              Exportar CSV
            </Link>
            <Link href={meta.nextHref} className="nova-lit-button nova-lit-button-secondary">
              {meta.nextLabel}
            </Link>
            <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
              Relatório
            </Link>
            <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-secondary">
              War Room
            </Link>
            <Link href="/operacao/playbooks" className="nova-lit-button nova-lit-button-secondary">
              Playbooks
            </Link>
          </div>
        </header>

        <section className="nova-suite-kpi-grid" aria-label="Resumo da suíte pós-incidente">
          <Kpi
            label="Risco operacional"
            value={snapshot.operationalRisk}
            detail="SLA, NOC, automações, reconciliação e fila"
            tone={snapshot.operationalRisk > 35 ? "critical" : snapshot.operationalRisk > 0 ? "attention" : "success"}
          />
          <Kpi
            label="Evidência pendente"
            value={evidencePending}
            detail={`${snapshot.evidenceItems.length} áreas auditadas`}
            tone={evidencePending ? "attention" : "success"}
          />
          <Kpi
            label="Pós-incidente"
            value={snapshot.postIncidentItems.length}
            detail={snapshot.topCase ? `caso principal ${snapshot.topCase.code}` : "sem caso crítico principal"}
            tone={snapshot.topCase ? severityTone(snapshot.topCase.severity) : "success"}
          />
          <Kpi
            label="Rastro manual"
            value={manualActivities}
            detail={`${criticalActivities} evento(s) alta atenção`}
            tone={criticalActivities ? "critical" : manualActivities ? "success" : "attention"}
          />
        </section>

        <section className="nova-suite-layout">
          <div className="nova-suite-main">
            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head">
                <div>
                  <span>Matriz</span>
                  <h2>Evidência suficiente, pendente ou ausente</h2>
                  <p>Mapa objetivo de provas e lacunas antes de comunicação, auditoria ou pós-incidente.</p>
                </div>
                <Link href="/operacao/relatorio-turno" className="nova-lit-button nova-lit-button-secondary">
                  Abrir evidências
                </Link>
              </div>

              <div className="nova-suite-evidence-grid">
                {snapshot.evidenceItems.map((item) => (
                  <Link key={item.key} href={item.href} className={`nova-suite-evidence ${toneClass(item.tone)}`}>
                    <div>
                      <span>{item.area}</span>
                      <Pill tone={statusTone(item.status)}>{evidenceLabel(item.status)}</Pill>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <dl>
                      <div>
                        <dt>Responsável</dt>
                        <dd>{item.owner}</dd>
                      </div>
                      <div>
                        <dt>Próximo passo</dt>
                        <dd>{item.nextStep}</dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head">
                <div>
                  <span>Pós-incidente</span>
                  <h2>Causa, impacto e prevenção</h2>
                  <p>Estrutura pronta para revisão de incidente com detecção, resposta, contenção e prevenção.</p>
                </div>
                <Link href="/operacao/war-room" className="nova-lit-button nova-lit-button-secondary">
                  Revisar pós-incidente
                </Link>
              </div>

              <div className="nova-suite-post-grid">
                {snapshot.postIncidentItems.map((item) => (
                  <Link key={item.key} href={item.href} className={`nova-suite-post ${toneClass(item.tone)}`}>
                    <span>{item.title}</span>
                    <strong>{item.detail}</strong>
                    <small>{item.owner}</small>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head">
                <div>
                  <span>Auditoria</span>
                  <h2>Rastreabilidade e decisões</h2>
                  <p>Indicadores para validar se o turno tem responsáveis, vínculos, rastro e evidência suficiente.</p>
                </div>
                <Link href="/operacao/atividade" className="nova-lit-button nova-lit-button-secondary">
                  Abrir auditoria
                </Link>
              </div>

              <div className="nova-suite-audit-grid">
                {snapshot.auditItems.map((item) => (
                  <Link key={item.key} href={item.href} className={`nova-suite-audit ${toneClass(item.tone)}`}>
                    <span>{item.label}</span>
                    <strong>{typeof item.value === "number" ? formatNumber(item.value) : item.value}</strong>
                    <p>{item.detail}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head">
                <div>
                  <span>Comunicação</span>
                  <h2>Mensagens prontas do turno</h2>
                  <p>Textos objetivos para gestor, NOC, backoffice e próximo operador.</p>
                </div>
                <Link href="/operacao/handoff" className="nova-lit-button nova-lit-button-secondary">
                  Comunicação
                </Link>
              </div>

              <div className="nova-suite-communication-list">
                {snapshot.communicationItems.map((item) => (
                  <article key={`${item.audience}-${item.channel}`} className={`nova-suite-message ${toneClass(item.tone)}`}>
                    <div>
                      <Pill tone={item.tone}>{item.audience}</Pill>
                      <span>{item.channel}</span>
                    </div>
                    <strong>{item.subject}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head">
                <div>
                  <span>Casos</span>
                  <h2>Linha de evidências por prioridade</h2>
                  <p>Casos combinados de SLA estourado, vencendo, sem dono e triagem pendente.</p>
                </div>
                <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-secondary">
                  Abrir fila
                </Link>
              </div>

              {snapshot.priorityCases.length ? (
                <div className="nova-suite-case-list">
                  {snapshot.priorityCases.slice(0, 12).map((item) => (
                    <article key={item.id} className="nova-suite-case">
                      <div>
                        <Link href={`/operacao/excecoes/${item.id}`}>{item.code}</Link>
                        <strong>{item.title}</strong>
                        <small>{sourceLabel(item)} · prioridade {item.priorityScore}</small>
                      </div>
                      <div className="nova-suite-case-tags">
                        <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        <Pill tone={item.breachedAt ? "critical" : item.resolveDueAt ? "attention" : "neutral"}>{dueLabel(item)}</Pill>
                        <Pill tone={item.assignee ? "success" : "attention"}>{item.assignee?.name || "sem dono"}</Pill>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nova-suite-empty">
                  <strong>Nenhum caso prioritário no recorte.</strong>
                  <p>Mantenha o painel em monitoramento e registre evidência manual se houver contexto externo.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="nova-suite-side">
            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head is-compact">
                <div>
                  <span>Registro manual</span>
                  <h2>{pageActionCopy(kind)}</h2>
                  <p>Cria evento no rastro operacional e revalida toda a suíte.</p>
                </div>
              </div>

              {isAdmin ? (
                <ActionForm
                  action={createSuiteActivity}
                  className="nova-suite-form"
                  submitLabel={pageActionCopy(kind)}
                  pendingLabel="Registrando..."
                >
                  <label>
                    <span>Resumo</span>
                    <input
                      name="title"
                      defaultValue={`${pageActionTitle(kind)} - ${new Date().toLocaleDateString("pt-BR")}`}
                      placeholder="Resumo do registro"
                    />
                  </label>
                  <label>
                    <span>Severidade</span>
                    <select name="severity" defaultValue={snapshot.operationalRisk > 35 ? "high" : snapshot.operationalRisk > 0 ? "medium" : "info"}>
                      <option value="info">Info</option>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </label>
                  <label>
                    <span>Descrição</span>
                    <textarea
                      name="description"
                      rows={11}
                      defaultValue={[
                        `${meta.title}`,
                        `Risco operacional: ${snapshot.operationalRisk}`,
                        `Score do turno: ${snapshot.reportScore}`,
                        `Evidência prioritária: ${topEvidence?.title || "sem evidência"}`,
                        `Status: ${topEvidence ? evidenceLabel(topEvidence.status) : "sem status"}`,
                        `Próximo passo: ${topEvidence?.nextStep || "monitorar"}`,
                        snapshot.topCase ? `Caso principal: ${snapshot.topCase.code} - ${snapshot.topCase.title}` : "Sem caso principal crítico",
                      ].join("\n")}
                    />
                  </label>
                  <input type="hidden" name="userId" value={session.user?.id || ""} />
                  <input type="hidden" name="exceptionId" value={snapshot.topCase?.id || ""} />
                </ActionForm>
              ) : (
                <div className="nova-suite-empty">
                  <strong>Registro restrito a administradores.</strong>
                  <p>Usuários não administradores podem consultar e exportar a suíte.</p>
                </div>
              )}
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head is-compact">
                <div>
                  <span>Rastro recente</span>
                  <h2>Atividades</h2>
                </div>
              </div>

              {snapshot.activities.items.length ? (
                <div className="nova-suite-timeline">
                  {snapshot.activities.items.slice(0, 8).map((item) => (
                    <Link key={item.id} href={activityLink(item)}>
                      <Pill tone={severityTone(item.severity)}>{item.severity || item.kind}</Pill>
                      <strong>{item.title}</strong>
                      <span>{item.description || activityRefs(item)}</span>
                      <small>{formatDateTime(item.createdAt)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="nova-suite-empty">
                  <strong>Sem rastro recente.</strong>
                  <p>Registre uma decisão para documentar o encerramento operacional.</p>
                </div>
              )}
            </section>

            <section className="nova-suite-panel">
              <div className="nova-suite-panel-head is-compact">
                <div>
                  <span>Dados usados</span>
                  <h2>Atualizações</h2>
                </div>
              </div>
              <div className="nova-suite-context">
                <div><span>Comando NOC</span><strong>{formatDateTime(snapshot.commandCenter.generatedAt)}</strong></div>
                <div><span>Telemetria</span><strong>{formatDateTime(snapshot.telemetry.generatedAt)}</strong></div>
                <div><span>Reconciliação</span><strong>{formatDateTime(snapshot.reconciliation.generatedAt || null)}</strong></div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
