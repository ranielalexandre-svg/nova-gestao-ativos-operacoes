import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { ActionForm } from "@/components/action-form";
import {
  EmptyState,
  FieldLabel,
  InlineStat,
  SectionIntro,
  Surface,
  TonePill,
} from "@/components/ops-ui";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import { apiJson } from "@/lib/server-api";
import {
  exceptionLabel,
  exceptionQueueLabel as queueLabel,
  exceptionTone as tone,
} from "@/lib/status-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UserOption = { id: string; name: string; email: string; role: string; isActive: boolean };

type ExceptionDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: string;
  severity: string;
  status: string;
  source: string;
  queueKey: string;
  classification: string;
  impact: string;
  urgency: string;
  priorityScore: number;
  triageStatus: string;
  silencedUntil: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  breachedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  assignee: { id: string; name: string; email: string; role: string } | null;
  automation: { id: string; code: string; name: string; detector: string } | null;
  slaPolicy: {
    id: string;
    code: string;
    name: string;
    firstResponseMinutes: number;
    resolveMinutes: number;
  } | null;
  partner: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  equipment: { id: string; tag: string; name: string } | null;
  integration: { id: string; code: string; name: string } | null;
  occurrence: { id: string; code: string; title: string } | null;
  maintenance: { id: string; code: string; title: string } | null;
  comments: Array<{ id: string; body: string; createdAt: string; author: { id: string; name: string } }>;
  activities: Array<{
    id: string;
    kind: string;
    source: string;
    title: string;
    description: string | null;
    createdAt: string;
    actor: { id: string; name: string } | null;
    automation: { id: string; code: string; name: string } | null;
  }>;
};

type ContextualLink = {
  href: string;
  label: string;
  title: string;
  description: string;
  tone: string;
};

function revalidateExceptionWorkspace(id: string) {
  revalidatePath(`/excecoes/${id}`);
  revalidatePath(`/operacao/excecoes/${id}`);
  revalidatePath("/excecoes");
  revalidatePath("/operacao/fila");
  revalidatePath("/operacao");
  revalidatePath("/operacao/atividade");
}

function buildContextualLinks(item: ExceptionDetail): ContextualLink[] {
  const links: ContextualLink[] = [];

  if (item.occurrence) {
    links.push({
      href: `/alertas/${item.occurrence.id}`,
      label: "Alerta",
      title: item.occurrence.code,
      description: item.occurrence.title,
      tone: "attention",
    });
  }

  if (item.maintenance) {
    links.push({
      href: `/chamados/${item.maintenance.id}`,
      label: "Chamado",
      title: item.maintenance.code,
      description: item.maintenance.title,
      tone: "success",
    });
  }

  if (item.unit) {
    links.push({
      href: `/unidades/${item.unit.id}`,
      label: "Unidade",
      title: item.unit.code,
      description: item.unit.name,
      tone: "info",
    });
  }

  if (item.equipment) {
    links.push({
      href: `/ativos/${item.equipment.id}`,
      label: "Ativo",
      title: item.equipment.tag,
      description: item.equipment.name,
      tone: "neutral",
    });
  }

  if (item.partner) {
    links.push({
      href: `/parceiros/${item.partner.id}`,
      label: "Parceiro",
      title: item.partner.code,
      description: item.partner.name,
      tone: "neutral",
    });
  }

  if (item.integration) {
    links.push({
      href: `/integracoes?q=${encodeURIComponent(item.integration.code)}`,
      label: "Integração",
      title: item.integration.code,
      description: item.integration.name,
      tone: "violet",
    });
  }

  if (item.automation) {
    links.push({
      href: `/automacao?q=${encodeURIComponent(item.automation.code)}`,
      label: "Automação",
      title: item.automation.code,
      description: item.automation.name,
      tone: "violet",
    });
  }

  return links;
}

function ContextualLinks({ links }: { links: ContextualLink[] }) {
  if (!links.length) {
    return (
      <EmptyState
        title="Sem vínculos navegáveis"
        description="Este caso ainda não está conectado a alerta, chamado, unidade, ativo, parceiro, integração ou automação."
      />
    );
  }

  return (
    <div className="mt-2 grid gap-2">
      {links.map((link) => (
        <Link key={`${link.label}-${link.href}`} href={link.href} className="nds-card block transition">
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel>{link.label}</FieldLabel>
            <TonePill tone={link.tone}>{link.title}</TonePill>
          </div>
          <div className="text-[11px] leading-5 text-slate-300">{link.description}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function ExceptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/excecoes");

  const resolvedParams = await params;
  const id = resolvedParams.id;
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function updateStatus(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const status = String(formData.get("status") || "").trim();
      if (!["open", "acknowledged", "resolved", "silenced"].includes(status)) {
        return { status: "error", message: "Status inválido." };
      }

      const body: Record<string, unknown> = { status };
      if (status === "silenced") {
        body.silencedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }

      await apiJson(`/exceptions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      revalidateExceptionWorkspace(id);
      return { status: "success", message: "Status atualizado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function updateAssignee(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const assigneeUserId = String(formData.get("assigneeUserId") || "").trim();
      await apiJson(`/exceptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeUserId }),
      });
      revalidateExceptionWorkspace(id);
      return { status: "success", message: "Responsável atualizado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function addComment(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      await apiJson(`/exceptions/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: String(formData.get("body") || "") }),
      });
      revalidateExceptionWorkspace(id);
      return { status: "success", message: "Comentário registrado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [item, usersResponse] = await Promise.all([
    apiJson<ExceptionDetail>(`/exceptions/${id}`),
    isAdmin
      ? apiJson<{ items: UserOption[] }>("/users?page=1&pageSize=100")
      : Promise.resolve({ items: [] as UserOption[] }),
  ]);
  const contextualLinks = buildContextualLinks(item);

  return (
    <NovaLitShell activeHref="/excecoes">
      <div className="nova-exception-detail-lit-page">

        <nav className="nova-detail-crumbs" aria-label="Breadcrumb">
          <Link href="/operacao">Operação</Link>
          <span>/</span>
          <Link href="/operacao/excecoes">Exceções</Link>
          <span>/</span>
          <strong>{item.code}</strong>
        </nav>

        <Surface>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <TonePill tone={tone(item.severity)}>{exceptionLabel(item.severity)}</TonePill>
                <TonePill tone={tone(item.status)}>{exceptionLabel(item.status)}</TonePill>
                <TonePill tone={tone(item.triageStatus)}>{exceptionLabel(item.triageStatus)}</TonePill>
                <TonePill tone="neutral">{queueLabel(item.queueKey)}</TonePill>
              </div>
              <h1 className="mt-3 text-[18px] font-semibold text-white">{item.code} · {item.title}</h1>
              <div className="mt-2 max-w-4xl text-[11px] leading-5 text-slate-400">
                {item.description || "Sem descrição adicional."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/operacao/fila" className="nds-button" data-variant="primary">
                Fila
              </Link>
              <Link href="/operacao/excecoes" className="nds-button" data-variant="secondary">
                Exceções
              </Link>
              <Link href="/operacao/sla" className="nds-button" data-variant="secondary">
                SLA
              </Link>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <InlineStat
              label="Responsável"
              value={item.assignee ? item.assignee.name : "Não atribuído"}
              tone={item.assignee ? "info" : "attention"}
            />
            <InlineStat
              label="Prioridade"
              value={item.priorityScore}
              tone={item.priorityScore >= 80 ? "critical" : item.priorityScore >= 50 ? "attention" : "info"}
            />
            <InlineStat
              label="Prazo"
              value={item.breachedAt ? "Estourado" : "No prazo"}
              tone={item.breachedAt ? "critical" : "success"}
            />
            <InlineStat
              label="Última atividade"
              value={formatDateTime(item.lastActivityAt)}
              tone="neutral"
            />
          </div>
        </Surface>

        <section className="nova-side-grid nova-side-grid--340 nova-side-grid--wide-main">
          <div className="grid gap-2">
            <Surface>
              <SectionIntro
                eyebrow="Execução"
                title="Comentários"
                description="O centro do caso fica com o que move a decisão para frente: hipótese, encaminhamento e registro operacional."
                compact
              />
              <ActionForm
                action={addComment}
                className="mt-2 grid gap-2"
                submitLabel="Registrar comentário"
                pendingLabel="Registrando..."
              >
                <textarea
                  name="body"
                  placeholder="Escreva o próximo passo, hipótese, contexto da análise ou decisão operacional..."
                  className="min-h-28"
                />
              </ActionForm>
              <div className="mt-2 grid gap-2">
                {item.comments.length ? (
                  item.comments.map((comment) => (
                    <article key={comment.id} className="nds-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] font-medium text-white">{comment.author.name}</div>
                        <div className="text-[10px] text-slate-500">{formatDateTime(comment.createdAt)}</div>
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-slate-300">{comment.body}</div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="Sem comentários ainda"
                    description="A discussão operacional deste caso ainda não começou."
                  />
                )}
              </div>
            </Surface>

            <Surface>
              <SectionIntro
                eyebrow="Histórico"
                title="Atividade recente"
                description="Rastro do sistema, das automações e dos operadores em leitura mais limpa e sequencial."
                compact
              />
              <div className="mt-2 grid gap-2">
                {item.activities.length ? (
                  item.activities.map((activity) => (
                    <article key={activity.id} className="nds-card">
                      <div className="flex flex-wrap items-center gap-2">
                        <TonePill tone="neutral">{activity.kind}</TonePill>
                        <TonePill tone="subtle">{activity.source}</TonePill>
                        {activity.automation ? <TonePill tone="violet">{activity.automation.code}</TonePill> : null}
                      </div>
                      <div className="mt-2 text-[12px] font-medium text-white">{activity.title}</div>
                      {activity.description ? (
                        <div className="mt-2 text-[11px] leading-5 text-slate-400">{activity.description}</div>
                      ) : null}
                      <div className="mt-2 text-[10px] text-slate-500">
                        {activity.actor ? activity.actor.name : "Sistema"} · {formatDateTime(activity.createdAt)}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="Sem atividade registrada"
                    description="Nenhuma atividade recente foi associada a este caso."
                  />
                )}
              </div>
            </Surface>
          </div>

          <div className="grid gap-2">
            {isAdmin ? (
              <Surface>
                <SectionIntro
                  eyebrow="Ações"
                  title="Despacho do caso"
                  description="Atualize status e responsável separadamente para evitar troca acidental no turno."
                  compact
                />
                <ActionForm
                  action={updateStatus}
                  className="mt-2 grid gap-2"
                  submitLabel="Aplicar"
                  pendingLabel="Aplicando..."
                  hideSubmit
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="submit" name="status" value="acknowledged" className="nds-button" data-variant="secondary">
                      Reconhecer
                    </button>
                    <button type="submit" name="status" value="resolved" className="nds-button" data-variant="secondary">
                      Resolver
                    </button>
                    <button type="submit" name="status" value="silenced" className="nds-button" data-variant="secondary">
                      Silenciar 1h
                    </button>
                    <button type="submit" name="status" value="open" className="nds-button" data-variant="secondary">
                      Reabrir
                    </button>
                  </div>
                </ActionForm>

                <ActionForm
                  action={updateAssignee}
                  className="mt-3 grid gap-2"
                  submitLabel="Salvar responsável"
                  pendingLabel="Salvando..."
                  variant="secondary"
                >
                  <select name="assigneeUserId" defaultValue={item.assignee?.id || ""}>
                    <option value="">Sem responsável atribuído</option>
                    {usersResponse.items.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {user.email}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              </Surface>
            ) : null}

            <Surface>
              <SectionIntro
                eyebrow="Continuidade"
                title="Contexto vinculado"
                description="Abra unidade, alerta, chamado ou automação sem voltar para a busca."
                compact
              />
              <ContextualLinks links={contextualLinks} />
            </Surface>

            <Surface>
              <SectionIntro
                eyebrow="Contexto"
                title="Roteamento e SLA"
                description="Classificação, origem, política, automação e janelas do caso."
                compact
              />
              <div className="mt-2 grid gap-2 text-[11px] leading-5 text-slate-300">
                <div className="nds-card">
                  <FieldLabel>Classificação</FieldLabel>
                  <div className="mt-2">
                    {item.classification} · impacto {item.impact} · urgência {item.urgency}
                  </div>
                </div>
                <div className="nds-card">
                  <FieldLabel>Roteamento</FieldLabel>
                  <div className="mt-2">{queueLabel(item.queueKey)} · origem {item.source}</div>
                </div>
                <div className="nds-card">
                  <FieldLabel>Política SLA</FieldLabel>
                  <div className="mt-2">
                    {item.slaPolicy
                      ? `${item.slaPolicy.code} · ${item.slaPolicy.firstResponseMinutes}/${item.slaPolicy.resolveMinutes} min`
                      : "-"}
                  </div>
                </div>
                <div className="nds-card">
                  <FieldLabel>Janelas</FieldLabel>
                  <div className="mt-2 grid gap-1 text-slate-300">
                    <div>Primeira resposta: {formatDateTime(item.firstResponseDueAt, "-")}</div>
                    <div>Resolução: {formatDateTime(item.resolveDueAt, "-")}</div>
                    <div>Silenciada até: {formatDateTime(item.silencedUntil, "-")}</div>
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </section>
      </div>
    </NovaLitShell>
  );
}
