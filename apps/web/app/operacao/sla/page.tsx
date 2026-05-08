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
import {
  OperationsGuidanceGrid,
  OperationsLinkGrid,
} from "@/components/operations-workspace";
import { RegistryHero, RegistrySummaryStrip } from "@/components/registry-shell";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { apiJson } from "@/lib/server-api";
import {
  exceptionKindLabel as kindLabel,
  exceptionQueueLabel as queueLabel,
  occurrenceSeverityLabel as severityLabel,
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

const inputClass = "mt-2";
const selectClass = inputClass;

function minutesLabel(value: number) {
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

async function assertAdmin() {
  if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
    return false;
  }
  return true;
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
      return { status: "success", message: "Política SLA atualizada." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const response = await apiJson<{ items: PolicyRow[] }>("/exceptions/sla-policies");
  const items = response.items;
  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;
  const queueCount = new Set(items.map((item) => item.queueKey)).size;
  const avgFirstResponse = items.length ? Math.round(items.reduce((sum, item) => sum + item.firstResponseMinutes, 0) / items.length) : 0;
  const avgResolve = items.length ? Math.round(items.reduce((sum, item) => sum + item.resolveMinutes, 0) / items.length) : 0;
  const caseCount = items.reduce((sum, item) => sum + item._count.exceptionCases, 0);

  return (
    <NovaLitShell activeHref="/operacao/sla">
      <div className="nova-operation-sla-lit-page">
        <nav className="nova-operations-breadcrumb nova-operation-sla-breadcrumb" aria-label="Breadcrumb">
          <Link href="/operacao">Operação</Link>
          <span>/</span>
          <strong>SLA</strong>
        </nav>

        <div className="nova-operations-inline-actions" aria-label="Ações rápidas de SLA">
          <Link href="/excecoes">Exceções</Link>
          <Link href="/operacao/fila">Fila</Link>
          <Link href="/operacao/atividade">Atividade</Link>
        </div>

        <RegistryHero
        eyebrow="Policy Desk"
        title="SLA como contrato visível, não como formulário escondido"
        description="Severidade, fila e impacto no backlog."
      />

      <section className="nova-operations-flow nova-operation-sla-flow" aria-label="Fluxo de contrato SLA">
        <article className="is-active">
          <span>01</span>
          <strong>Política</strong>
          <small>Tipo, severidade, fila e contrato ativo.</small>
        </article>
        <i>→</i>
        <article>
          <span>02</span>
          <strong>Prazo</strong>
          <small>Primeira resposta e resolução como metas visíveis.</small>
        </article>
        <i>→</i>
        <article>
          <span>03</span>
          <strong>Backlog</strong>
          <small>Casos vinculados pressionam a fila operacional.</small>
        </article>
      </section>

      <RegistrySummaryStrip
        items={[
          { label: "Políticas", value: items.length, meta: `${activeCount} ativa(s)`, tone: activeCount ? "success" : "neutral" },
          { label: "Filas", value: queueCount, meta: "com regra SLA", tone: "info" },
          { label: "Casos", value: caseCount, meta: "vinculados", tone: caseCount ? "attention" : "neutral" },
          { label: "Inativas", value: inactiveCount, meta: "fora de uso", tone: inactiveCount ? "attention" : "success" },
        ]}
        noteTitle="SLA deve orientar a fila"
        noteCopy={`Médias atuais: primeira resposta em ${minutesLabel(avgFirstResponse)} e resolução em ${minutesLabel(avgResolve)}. A edição permanece no mesmo trilho da consulta para a revisão continuar direta.`}
      /><OperationsLinkGrid
        title="Áreas impactadas pelo contrato"
        description="Prazo, severidade, backlog, fila e regra."
        links={[
          {
            href: "/excecoes",
            title: "Exceções",
            description: "Casos que herdam fila, prazo e severidade definidos nas políticas.",
            badge: <TonePill tone={caseCount ? "attention" : "neutral"}>{caseCount} caso(s)</TonePill>,
          },
          {
            href: "/operacao/fila",
            title: "Fila",
            description: "Onde o prazo vira pressão real de despacho durante o turno.",
            badge: <TonePill tone="info">{queueCount} fila(s)</TonePill>,
          },
          {
            href: "/operacao/atividade",
            title: "Atividade",
            description: "Registro do que foi feito quando o relógio apertou ou estourou.",
            badge: <TonePill tone="success">histórico do caso</TonePill>,
          },
          {
            href: "/automacao",
            title: "Automações",
            description: "Regras que podem abrir casos usando esse contrato como suporte.",
            badge: <TonePill tone="violet">motor de regra</TonePill>,
          },
        ]}
      /><OperationsGuidanceGrid
        title="O que revisar quando a política parece ruim"
        description="Política, prazo e roteamento."
        items={[
          {
            label: "Fila",
            title: "Cheque se o roteamento bate com a operação",
            description: "Se o caso nasce na fila errada, a equipe perde tempo antes mesmo de reconhecer o backlog.",
            tone: "attention",
          },
          {
            label: "Prazo",
            title: "Compare meta com realidade do turno",
            description: "Primeira resposta e resolução precisam refletir a rotina real, não um ideal bonito que ninguém consegue cumprir.",
            tone: "info",
          },
          {
            label: "Impacto",
            title: "Use casos vinculados como prova",
            description: "Quando uma política já sustentou muitos casos, ela deixa rastro suficiente para revisão objetiva e não só intuitiva.",
            tone: "success",
          },
        ]}
      /><Surface><SectionIntro
          eyebrow="Cadastro"
          title="Políticas cadastradas"
          description="Lista administrativa densa para verificar cobertura, prazo e fila sem abrir todos os formulários."
          compact
        /><div className="mt-2">
          {items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Política</th><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">1ª resposta</th><th className="px-3 py-2">Resolução</th><th className="px-3 py-2">Casos</th><th className="px-3 py-2">Status</th></tr></TableHead><tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]"><TableCell><div className="font-semibold text-slate-50">{item.code}</div><div className="mt-1 text-[10px] text-slate-500">{item.name}</div></TableCell><TableCell>{queueLabel(item.queueKey)}</TableCell><TableCell><TonePill tone="neutral">{kindLabel(item.kind)}</TonePill></TableCell><TableCell><TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill></TableCell><TableCell>{minutesLabel(item.firstResponseMinutes)}</TableCell><TableCell>{minutesLabel(item.resolveMinutes)}</TableCell><TableCell>{item._count.exceptionCases}</TableCell><TableCell><TonePill tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Ativa" : "Inativa"}</TonePill></TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Sem políticas cadastradas" description="Crie a primeira política de SLA para sustentar prioridade, prazo e fila padrão com consistência." />
          )}
        </div></Surface><Surface><SectionIntro
          eyebrow="Administração"
          title="Nova política"
          description="Cadastro de política."
          compact
        /><ActionForm action={createPolicy} className="grid gap-2" submitLabel="Criar política" pendingLabel="Criando..."><div className="mt-2 grid gap-2 lg:grid-cols-4"><div><FieldLabel>Código</FieldLabel><input name="code" placeholder="SLA-OPS-GERAL-ALTA" className={inputClass} /></div><div className="lg:col-span-2"><FieldLabel>Nome</FieldLabel><input name="name" placeholder="Operação geral alta" className={inputClass} /></div><div><FieldLabel>Status</FieldLabel><label className="nds-card mt-2 flex min-h-[34px] items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-white/12" />
                Ativa
              </label></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue="generic" className={selectClass}><option value="generic">Geral</option><option value="sla">SLA</option><option value="integration">Integração</option><option value="occurrence">Alerta</option><option value="maintenance">Chamado</option><option value="automation">Automação</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue="medium" className={selectClass}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><FieldLabel>Fila</FieldLabel><select name="queueKey" defaultValue="ops-general" className={selectClass}><option value="ops-general">Geral</option><option value="ops-integracoes">Integrações</option><option value="ops-ocorrencias">Alertas</option><option value="ops-manutencao">Chamado</option><option value="ops-sla">SLA</option><option value="ops-automacoes">Automações</option></select></div><div><FieldLabel>1ª resposta</FieldLabel><input name="firstResponseMinutes" type="number" min="1" defaultValue="30" className={inputClass} /></div><div><FieldLabel>Resolução</FieldLabel><input name="resolveMinutes" type="number" min="1" defaultValue="240" className={inputClass} /></div></div></ActionForm></Surface>

      {items.length ? (
        <Surface><SectionIntro
            eyebrow="Administração"
            title="Editar políticas"
            description="Contrato, prazo e roteamento."
            compact
          /><div className="mt-2 grid gap-2">
            {items.map((item) => (
              <ActionForm
                key={item.id}
                action={updatePolicy}
                className="nds-card"
                submitLabel="Salvar política"
                pendingLabel="Salvando..."
                variant="secondary"
              ><input type="hidden" name="id" value={item.id} /><div className="mb-2 flex flex-wrap items-center gap-2"><TonePill tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Ativa" : "Inativa"}</TonePill><TonePill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</TonePill><TonePill tone="neutral">{queueLabel(item.queueKey)}</TonePill><span className="text-[10px] text-slate-500">{item._count.exceptionCases} caso(s)</span></div><div className="grid gap-2 lg:grid-cols-4"><div><FieldLabel>Código</FieldLabel><input name="code" defaultValue={item.code} className={inputClass} /></div><div className="lg:col-span-2"><FieldLabel>Nome</FieldLabel><input name="name" defaultValue={item.name} className={inputClass} /></div><div><FieldLabel>Status</FieldLabel><label className="nds-card mt-2 flex min-h-[34px] items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="isActive" defaultChecked={item.isActive} className="h-4 w-4 rounded border-white/12" />
                      Ativa
                    </label></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue={item.kind} className={selectClass}><option value="generic">Geral</option><option value="sla">SLA</option><option value="integration">Integração</option><option value="occurrence">Alerta</option><option value="maintenance">Chamado</option><option value="automation">Automação</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue={item.severity} className={selectClass}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><FieldLabel>Fila</FieldLabel><select name="queueKey" defaultValue={item.queueKey} className={selectClass}><option value="ops-general">Geral</option><option value="ops-integracoes">Integrações</option><option value="ops-ocorrencias">Alertas</option><option value="ops-manutencao">Chamado</option><option value="ops-sla">SLA</option><option value="ops-automacoes">Automações</option></select></div><div><FieldLabel>1ª resposta</FieldLabel><input name="firstResponseMinutes" type="number" min="1" defaultValue={item.firstResponseMinutes} className={inputClass} /></div><div><FieldLabel>Resolução</FieldLabel><input name="resolveMinutes" type="number" min="1" defaultValue={item.resolveMinutes} className={inputClass} /></div></div></ActionForm>
            ))}
          </div></Surface>
      ) : null}
          </div>
    </NovaLitShell>
  );
}
