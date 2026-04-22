import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { EmptyState, FieldLabel, InlineStat, SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
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
  slaPolicy: { id: string; code: string; name: string; firstResponseMinutes: number; resolveMinutes: number } | null;
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

function queueLabel(value: string) {
  const map: Record<string, string> = {
    "ops-general": "Geral",
    "ops-integracoes": "Integrações",
    "ops-ocorrencias": "Ocorrências",
    "ops-manutencao": "Manutenção",
    "ops-sla": "SLA",
    "ops-automacoes": "Automações",
  };
  return map[value] || value;
}

function tone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  if (value === "resolved" || value === "closed") return "success";
  if (value === "acknowledged" || value === "triaged") return "info";
  if (value === "silenced") return "violet";
  return "attention";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export default async function ExceptionDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/excecoes");

  const resolvedParams = await params;
  const id = resolvedParams.id;
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function quickAction(_prevState: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const action = String(formData.get("action") || "");
      const assigneeUserId = String(formData.get("assigneeUserId") || "");
      const body: Record<string, unknown> = {};
      if (action === "ack") body.status = "acknowledged";
      if (action === "resolve") body.status = "resolved";
      if (action === "reopen") body.status = "open";
      if (action === "silence") {
        body.status = "silenced";
        body.silencedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }
      body.assigneeUserId = assigneeUserId || null;

      await apiJson(`/exceptions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      revalidatePath(`/operacao/excecoes/${id}`);
      revalidatePath("/operacao/excecoes");
      revalidatePath("/operacao/fila");
      revalidatePath("/operacao");
      return { status: "success", message: "Caso atualizado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function addComment(_prevState: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
    "use server";
    try {
      await apiJson(`/exceptions/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: String(formData.get("body") || "") }),
      });
      revalidatePath(`/operacao/excecoes/${id}`);
      revalidatePath("/operacao/atividade");
      return { status: "success", message: "Comentário registrado." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [item, usersResponse] = await Promise.all([
    apiJson<ExceptionDetail>(`/exceptions/${id}`),
    isAdmin ? apiJson<{ items: UserOption[] }>("/users?page=1&pageSize=100") : Promise.resolve({ items: [] as UserOption[] }),
  ]);

  return (
    <AppShell title={`${item.code} · ${item.title}`} subtitle="Detalhe executivo do caso. A primeira dobra decide, o centro executa e a lateral sustenta contexto sem poluir o fluxo.">
      <Surface className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <TonePill tone={tone(item.severity)}>{item.severity}</TonePill>
              <TonePill tone={tone(item.status)}>{item.status}</TonePill>
              <TonePill tone={tone(item.triageStatus)}>{item.triageStatus}</TonePill>
              <TonePill tone="neutral">{queueLabel(item.queueKey)}</TonePill>
            </div>
            <div className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{item.description || "Sem descrição adicional."}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/operacao/fila" className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black">Fila</Link>
            <Link href="/operacao/excecoes" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white">Exceções</Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InlineStat label="Responsável" value={item.assignee ? item.assignee.name : "Não atribuído"} tone={item.assignee ? "info" : "attention"} />
          <InlineStat label="Prioridade" value={item.priorityScore} tone={item.priorityScore >= 80 ? "critical" : item.priorityScore >= 50 ? "attention" : "info"} />
          <InlineStat label="Prazo" value={item.breachedAt ? "Estourado" : "No prazo"} tone={item.breachedAt ? "critical" : "success"} />
          <InlineStat label="Última atividade" value={formatDate(item.lastActivityAt)} tone="neutral" />
        </div>
      </Surface>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <div className="grid gap-5">
          <Surface className="p-5">
            <SectionIntro eyebrow="Execução" title="Comentários" description="O centro do caso fica com o que move a decisão para frente: hipótese, encaminhamento e registro operacional." compact />
            <ActionForm action={addComment} className="mt-4 grid gap-3" submitLabel="Registrar comentário" pendingLabel="Registrando...">
              <textarea name="body" placeholder="Escreva o próximo passo, hipótese, contexto da análise ou decisão operacional..." className="min-h-28 rounded-[12px] border border-white/10 bg-[#0b0f14] px-4 py-3 text-white outline-none" />
            </ActionForm>
            <div className="mt-5 grid gap-3">
              {item.comments.length ? item.comments.map((comment) => (
                <article key={comment.id} className="rounded-[14px] border border-white/7 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{comment.author.name}</div>
                    <div className="text-xs text-slate-500">{formatDate(comment.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{comment.body}</div>
                </article>
              )) : <EmptyState title="Sem comentários ainda" description="A discussão operacional deste caso ainda não começou." />}
            </div>
          </Surface>

          <Surface className="p-5">
            <SectionIntro eyebrow="Histórico" title="Atividade recente" description="Rastro do sistema, das automações e dos operadores em leitura mais limpa e sequencial." compact />
            <div className="mt-4 grid gap-3">
              {item.activities.length ? item.activities.map((activity) => (
                <article key={activity.id} className="rounded-[14px] border border-white/7 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <TonePill tone="neutral">{activity.kind}</TonePill>
                    <TonePill tone="subtle">{activity.source}</TonePill>
                    {activity.automation ? <TonePill tone="violet">{activity.automation.code}</TonePill> : null}
                  </div>
                  <div className="mt-3 text-sm font-medium text-white">{activity.title}</div>
                  {activity.description ? <div className="mt-2 text-sm leading-6 text-slate-400">{activity.description}</div> : null}
                  <div className="mt-3 text-xs text-slate-500">{activity.actor ? activity.actor.name : "Sistema"} · {formatDate(activity.createdAt)}</div>
                </article>
              )) : <EmptyState title="Sem atividade registrada" description="Nenhuma atividade recente foi associada a este caso." />}
            </div>
          </Surface>
        </div>

        <div className="grid gap-5">
          {isAdmin ? (
            <Surface className="p-5">
              <SectionIntro eyebrow="Ações" title="Despacho rápido" description="Atribuição e mudança de estado permanecem na lateral, curtas e previsíveis." compact />
              <ActionForm action={quickAction} className="mt-4 grid gap-3" submitLabel="Aplicar" pendingLabel="Aplicando..." variant="secondary">
                <select name="action" defaultValue="ack" className="rounded-[12px] border border-white/10 bg-[#0b0f14] px-4 py-3 text-white outline-none">
                  <option value="ack">Reconhecer</option>
                  <option value="resolve">Resolver</option>
                  <option value="reopen">Reabrir</option>
                  <option value="silence">Silenciar 1h</option>
                </select>
                <select name="assigneeUserId" defaultValue={item.assignee?.id || ""} className="rounded-[12px] border border-white/10 bg-[#0b0f14] px-4 py-3 text-white outline-none">
                  <option value="">Sem responsável</option>
                  {usersResponse.items.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                </select>
              </ActionForm>
            </Surface>
          ) : null}

          <Surface className="p-5">
            <SectionIntro eyebrow="Contexto" title="Metadados do caso" description="Origem, política, automação e vínculos ficam compactados na lateral para sustentar decisão sem roubar a primeira dobra." compact />
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="rounded-[14px] border border-white/7 bg-black/20 p-4"><FieldLabel>Classificação</FieldLabel><div className="mt-2">{item.classification} · impacto {item.impact} · urgência {item.urgency}</div></div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 p-4"><FieldLabel>Roteamento</FieldLabel><div className="mt-2">{queueLabel(item.queueKey)} · origem {item.source}</div></div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 p-4"><FieldLabel>Política SLA</FieldLabel><div className="mt-2">{item.slaPolicy ? `${item.slaPolicy.code} · ${item.slaPolicy.firstResponseMinutes}/${item.slaPolicy.resolveMinutes} min` : "—"}</div></div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 p-4"><FieldLabel>Automação</FieldLabel><div className="mt-2">{item.automation ? `${item.automation.code} · ${item.automation.detector}` : "—"}</div></div>
              <div className="rounded-[14px] border border-white/7 bg-black/20 p-4">
                <FieldLabel>Vínculos</FieldLabel>
                <div className="mt-2 grid gap-1 text-slate-300">
                  <div>Parceiro: {item.partner ? `${item.partner.code} · ${item.partner.name}` : "—"}</div>
                  <div>Unidade: {item.unit ? `${item.unit.code} · ${item.unit.name}` : "—"}</div>
                  <div>Equipamento: {item.equipment ? `${item.equipment.tag} · ${item.equipment.name}` : "—"}</div>
                  <div>Integração: {item.integration ? `${item.integration.code} · ${item.integration.name}` : "—"}</div>
                  <div>Ocorrência: {item.occurrence ? `${item.occurrence.code} · ${item.occurrence.title}` : "—"}</div>
                  <div>Manutenção: {item.maintenance ? `${item.maintenance.code} · ${item.maintenance.title}` : "—"}</div>
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
