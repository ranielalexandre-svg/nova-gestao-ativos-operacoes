import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  SectionIntro,
  Surface,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import { apiJson } from "@/lib/server-api";
import {
  exceptionKindLabel as kindLabel,
  exceptionKindOptions,
  exceptionQueueLabel as queueLabel,
  exceptionQueueOptions,
  occurrenceSeverityLabel as severityLabel,
  occurrenceSeverityOptions,
  occurrenceSeverityTone as severityTone,
} from "@/lib/status-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PolicyRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  severity: string;
  queueKey: string;
  firstResponseMinutes: number;
  resolveMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { exceptionCases: number };
};

type ExceptionSummary = {
  generatedAt: string;
  counts: {
    openCount: number;
    criticalCount: number;
    silencedCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};

type QueueSummary = {
  generatedAt: string;
  views: {
    all: number;
    pendingTriage: number;
    breached: number;
    dueSoon: number;
    unassigned: number;
  };
  queues: Array<{ queueKey: string; total: number }>;
};

type RecalculateResult = {
  generatedAt: string;
  recalculated: number;
  changedPolicy: number;
  changedQueue: number;
  changedTriage: number;
  changedDeadlines: number;
  counts: {
    openCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
  };
  queues: Array<{ queueKey: string; total: number }>;
};

const inputClass = "mt-2";
const selectClass = inputClass;

function minutesLabel(value: number) {
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

async function assertAdmin() {
  return normalizeRole((await getServerWebSession()).user?.role || "") === "admin";
}

export default async function OperacaoSlaPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/sla");
  if (normalizeRole(session.user?.role || "") !== "admin") redirect("/operacao");

  async function createPolicy(_prevState: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (!(await assertAdmin())) return { status: "error", message: "Acesso negado." };

      await apiJson("/exceptions/sla-policies", {
        method: "POST",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          kind: String(formData.get("kind") || "generic"),
          severity: String(formData.get("severity") || "medium"),
          queueKey: String(formData.get("queueKey") || "ops-general"),
          firstResponseMinutes: Number(formData.get("firstResponseMinutes") || 30),
          resolveMinutes: Number(formData.get("resolveMinutes") || 240),
          isActive: formData.get("isActive") === "on",
        }),
      });
      revalidatePath("/operacao/sla");
      revalidatePath("/operacao");
      revalidatePath("/operacao/fila");
      return { status: "success", message: "Política SLA criada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function updatePolicy(_prevState: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (!(await assertAdmin())) return { status: "error", message: "Acesso negado." };

      const id = String(formData.get("id") || "");
      await apiJson(`/exceptions/sla-policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          name: String(formData.get("name") || ""),
          kind: String(formData.get("kind") || "generic"),
          severity: String(formData.get("severity") || "medium"),
          queueKey: String(formData.get("queueKey") || "ops-general"),
          firstResponseMinutes: Number(formData.get("firstResponseMinutes") || 30),
          resolveMinutes: Number(formData.get("resolveMinutes") || 240),
          isActive: formData.get("isActive") === "on",
        }),
      });
      revalidatePath("/operacao/sla");
      revalidatePath("/operacao");
      revalidatePath("/operacao/fila");
      revalidatePath("/excecoes");
      return { status: "success", message: "Política SLA atualizada." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function recalculatePolicies(
    _prevState: ActionFeedbackState,
    _formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    void _prevState;
    void _formData;

    try {
      if (!(await assertAdmin())) return { status: "error", message: "Acesso negado." };

      const result = await apiJson<RecalculateResult>("/exceptions/sla-policies/recalculate", {
        method: "POST",
      });
      revalidatePath("/operacao/sla");
      revalidatePath("/operacao");
      revalidatePath("/operacao/fila");
      revalidatePath("/excecoes");
      return {
        status: "success",
        message: `${formatNumber(result.recalculated)} caso(s) recalculado(s). ${formatNumber(result.changedDeadlines)} prazo(s) ajustado(s).`,
      };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [policyResponse, summary, queueSummary] = await Promise.all([
    apiJson<{ items: PolicyRow[] }>("/exceptions/sla-policies"),
    apiJson<ExceptionSummary>("/exceptions/summary"),
    apiJson<QueueSummary>("/exceptions/queue/summary"),
  ]);

  const items = policyResponse.items;
  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;
  const queueCount = new Set(items.map((item) => item.queueKey)).size;
  const avgFirstResponse = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.firstResponseMinutes, 0) / items.length)
    : 0;
  const avgResolve = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.resolveMinutes, 0) / items.length)
    : 0;
  const caseCount = items.reduce((sum, item) => sum + item._count.exceptionCases, 0);
  const queueRows = [...queueSummary.queues].sort((a, b) => b.total - a.total);
  const maxQueueTotal = Math.max(1, ...queueRows.map((item) => item.total));
  const busiestQueue = queueRows[0];

  const kpis = [
    {
      label: "Abertas",
      value: summary.counts.openCount,
      detail: `${summary.counts.pendingTriageCount} pendente(s)`,
      tone: "success",
    },
    {
      label: "SLA vencido",
      value: summary.counts.breachedCount,
      detail: `${percent(summary.counts.breachedCount, summary.counts.openCount)} da fila aberta`,
      tone: summary.counts.breachedCount ? "critical" : "success",
    },
    {
      label: "Vence em breve",
      value: summary.counts.dueSoonCount,
      detail: "janela de 30 min",
      tone: summary.counts.dueSoonCount ? "attention" : "success",
    },
    {
      label: "Políticas ativas",
      value: activeCount,
      detail: `${inactiveCount} inativa(s)`,
      tone: activeCount ? "info" : "attention",
    },
  ];

  return (
    <NovaLitShell activeHref="/administracao/sla">
      <div className="nova-operation-sla-lit-page">
        <Surface className="nova-sla-command-hero">
          <div className="nova-sla-command-bar">
            <div className="min-w-0">
              <div className="nds-label">Operação / SLA</div>
              <h1>Políticas de SLA</h1>
              <p>
                Configure prazos, filas e prioridade para manter a resposta operacional consistente.
              </p>
            </div>
            <div className="nova-sla-hero-actions">
              <Link href="/operacao/fila" className="nds-button" data-variant="secondary">
                Abrir fila
              </Link>
              <ActionForm
                action={recalculatePolicies}
                className="nova-sla-recalc-form"
                submitLabel="Recalcular casos"
                pendingLabel="Recalculando..."
              >
                <input type="hidden" name="scope" value="all" />
              </ActionForm>
            </div>
          </div>

          <div className="nova-sla-stage-row">
            <div className="nova-sla-stage-card" data-tone="orange">
              <span>01</span>
              <div>
                <strong>Regra</strong>
                <p>Tipo, severidade e prazo.</p>
              </div>
            </div>
            <div className="nova-sla-stage-line" />
            <div className="nova-sla-stage-card" data-tone="violet">
              <span>02</span>
              <div>
                <strong>Fila</strong>
                <p>Roteamento e triagem.</p>
              </div>
            </div>
            <div className="nova-sla-stage-line" />
            <div className="nova-sla-stage-card" data-tone="green">
              <span>03</span>
              <div>
                <strong>Recálculo</strong>
                <p>Casos atualizados.</p>
              </div>
            </div>
          </div>
        </Surface>

        <section className="nova-sla-kpi-grid">
          {kpis.map((item) => (
            <article key={item.label} className="nova-sla-kpi-card">
              <div className="nova-sla-kpi-top">
                <span>{item.label}</span>
                <i className="nova-sla-kpi-dot" data-tone={item.tone} aria-label={item.tone} />
              </div>
              <strong>{formatNumber(item.value)}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </section>

        <div className="nova-sla-main-grid">
          <Surface className="nova-sla-policies-panel">
            <SectionIntro
              eyebrow="Mesa de políticas"
              title="Políticas de SLA cadastradas"
              description={`Médias atuais: primeira resposta em ${minutesLabel(avgFirstResponse)} e resolução em ${minutesLabel(avgResolve)}.`}
              actions={<TonePill tone="info">{formatNumber(caseCount)} caso(s) vinculados</TonePill>}
              compact
            />

            <div className="nova-sla-table-toolbar">
              <div>
                <span>Filas cobertas</span>
                <strong>{formatNumber(queueCount)}</strong>
              </div>
              <div>
                <span>Maior fila aberta</span>
                <strong>{busiestQueue ? queueLabel(busiestQueue.queueKey) : "-"}</strong>
              </div>
              <div>
                <span>Atualizado</span>
                <strong>{formatDateTime(summary.generatedAt)}</strong>
              </div>
            </div>

            {items.length ? (
              <TableShell>
                <DenseTable>
                  <TableHead>
                    <tr>
                      <th className="px-3 py-2">Política</th>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Sev.</th>
                      <th className="px-3 py-2">1ª resposta</th>
                      <th className="px-3 py-2">Resolução</th>
                      <th className="px-3 py-2">Casos</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-50">{item.code}</div>
                          <div className="mt-1 text-[10px] text-slate-500">{item.name}</div>
                        </TableCell>
                        <TableCell>{queueLabel(item.queueKey)}</TableCell>
                        <TableCell>
                          <TonePill tone="neutral">{kindLabel(item.kind)}</TonePill>
                        </TableCell>
                        <TableCell>
                          <TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill>
                        </TableCell>
                        <TableCell>{minutesLabel(item.firstResponseMinutes)}</TableCell>
                        <TableCell>{minutesLabel(item.resolveMinutes)}</TableCell>
                        <TableCell>{formatNumber(item._count.exceptionCases)}</TableCell>
                        <TableCell>
                          <TonePill tone={item.isActive ? "success" : "neutral"}>
                            {item.isActive ? "Ativa" : "Inativa"}
                          </TonePill>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            ) : (
              <EmptyState
                title="Sem políticas cadastradas"
                description="Crie a primeira política para padronizar prioridade, prazo e fila de atendimento."
              />
            )}
          </Surface>

          <aside className="nova-sla-side-stack">
            <Surface className="nova-sla-side-panel">
              <SectionIntro
                eyebrow="Fila do turno"
                title="Pressão atual"
                description={`${formatNumber(queueSummary.views.all)} caso(s) aberto(s), ${formatNumber(queueSummary.views.unassigned)} sem responsável.`}
                compact
              />
              <div className="nova-sla-queue-list">
                {queueRows.length ? (
                  queueRows.map((item) => (
                    <Link
                      key={item.queueKey}
                      href={`/operacao/fila?queueKey=${encodeURIComponent(item.queueKey)}`}
                      className="nova-sla-queue-row"
                    >
                      <span>{queueLabel(item.queueKey)}</span>
                      <strong>{formatNumber(item.total)}</strong>
                      <i style={{ width: `${Math.max(6, (item.total / maxQueueTotal) * 100)}%` }} />
                    </Link>
                  ))
                ) : (
                  <div className="nova-sla-empty-mini">Sem fila aberta.</div>
                )}
              </div>
            </Surface>

            <Surface className="nova-sla-side-panel">
              <SectionIntro
                eyebrow="Ações rápidas"
                title="Recalcular e conferir"
                description="Aplique as regras atuais nos casos abertos e confira exceções impactadas."
                compact
              />
              <div className="nova-sla-action-list">
                <ActionForm
                  action={recalculatePolicies}
                  className="nova-sla-side-action-form"
                  submitLabel="Recalcular agora"
                  pendingLabel="Recalculando..."
                >
                  <input type="hidden" name="scope" value="all" />
                </ActionForm>
                <Link href="/operacao/excecoes" className="nds-button" data-variant="secondary">
                  Ver exceções
                </Link>
                <Link href="/operacao/atividade" className="nds-button" data-variant="secondary">
                  Histórico operacional
                </Link>
              </div>
            </Surface>
          </aside>
        </div>

        <div className="nova-sla-admin-grid">
          <Surface className="nova-sla-form-panel">
            <SectionIntro
              eyebrow="Administração"
              title="Nova política"
              description="Defina fila, severidade e prazos de primeira resposta e resolução."
              compact
            />
            <ActionForm action={createPolicy} className="nova-sla-create-form" submitLabel="Criar política" pendingLabel="Criando...">
              <div className="nova-sla-form-grid">
                <div>
                  <FieldLabel>Código</FieldLabel>
                  <input name="code" placeholder="SLA-OPS-GERAL-ALTA" className={inputClass} />
                </div>
                <div className="nova-sla-form-span-2">
                  <FieldLabel>Nome</FieldLabel>
                  <input name="name" placeholder="Operação geral alta" className={inputClass} />
                </div>
                <label className="nova-sla-check">
                  <input type="checkbox" name="isActive" defaultChecked />
                  <span>Ativa</span>
                </label>
                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <select name="kind" defaultValue="generic" className={selectClass}>
                    {exceptionKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Severidade</FieldLabel>
                  <select name="severity" defaultValue="medium" className={selectClass}>
                    {occurrenceSeverityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Fila</FieldLabel>
                  <select name="queueKey" defaultValue="ops-general" className={selectClass}>
                    {exceptionQueueOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>1ª resposta</FieldLabel>
                  <input name="firstResponseMinutes" type="number" min="1" defaultValue="30" className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Resolução</FieldLabel>
                  <input name="resolveMinutes" type="number" min="1" defaultValue="240" className={inputClass} />
                </div>
              </div>
            </ActionForm>
          </Surface>

          <Surface className="nova-sla-edit-panel">
            <SectionIntro
              eyebrow="Administração"
              title="Editar políticas"
              description="Ao salvar, use o recálculo para refletir a regra nos casos existentes."
              compact
            />
            {items.length ? (
              <div className="nova-sla-edit-list">
                {items.map((item) => (
                  <ActionForm
                    key={item.id}
                    action={updatePolicy}
                    className="nova-sla-edit-form"
                    submitLabel="Salvar"
                    pendingLabel="Salvando..."
                    variant="secondary"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <div className="nova-sla-edit-head">
                      <strong>{item.code}</strong>
                      <span>{formatNumber(item._count.exceptionCases)} caso(s)</span>
                      <TonePill tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Ativa" : "Inativa"}</TonePill>
                      <TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill>
                    </div>
                    <div className="nova-sla-form-grid nova-sla-form-grid--edit">
                      <div>
                        <FieldLabel>Código</FieldLabel>
                        <input name="code" defaultValue={item.code} className={inputClass} />
                      </div>
                      <div className="nova-sla-form-span-2">
                        <FieldLabel>Nome</FieldLabel>
                        <input name="name" defaultValue={item.name} className={inputClass} />
                      </div>
                      <label className="nova-sla-check">
                        <input type="checkbox" name="isActive" defaultChecked={item.isActive} />
                        <span>Ativa</span>
                      </label>
                      <div>
                        <FieldLabel>Tipo</FieldLabel>
                        <select name="kind" defaultValue={item.kind} className={selectClass}>
                          {exceptionKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Severidade</FieldLabel>
                        <select name="severity" defaultValue={item.severity} className={selectClass}>
                          {occurrenceSeverityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Fila</FieldLabel>
                        <select name="queueKey" defaultValue={item.queueKey} className={selectClass}>
                          {exceptionQueueOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>1ª resposta</FieldLabel>
                        <input name="firstResponseMinutes" type="number" min="1" defaultValue={item.firstResponseMinutes} className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel>Resolução</FieldLabel>
                        <input name="resolveMinutes" type="number" min="1" defaultValue={item.resolveMinutes} className={inputClass} />
                      </div>
                    </div>
                  </ActionForm>
                ))}
              </div>
            ) : (
              <EmptyState title="Nada para editar" description="As políticas cadastradas aparecem aqui." />
            )}
          </Surface>
        </div>
      </div>
    </NovaLitShell>
  );
}
