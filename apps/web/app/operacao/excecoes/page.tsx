import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
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
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UserOption = { id: string; name: string; email: string; role: string; isActive: boolean };
type PartnerOption = { id: string; code: string; name: string };
type UnitOption = { id: string; code: string; name: string };
type EquipmentOption = { id: string; tag: string; name: string };
type IntegrationOption = { id: string; code: string; name: string };
type OccurrenceOption = { id: string; code: string; title: string };
type MaintenanceOption = { id: string; code: string; title: string };

type ExceptionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: string;
  severity: string;
  status: string;
  source: string;
  queueKey: string;
  priorityScore: number;
  triageStatus: string;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  breachedAt: string | null;
  assignee: { id: string; name: string; email: string; role: string } | null;
  automation: { id: string; code: string; name: string; detector: string } | null;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  integration: IntegrationOption | null;
  occurrence: OccurrenceOption | null;
  maintenance: MaintenanceOption | null;
  _count: { comments: number; activities: number };
};

const inputClass = "mt-2 w-full rounded-[12px] border border-white/10 bg-[#0b0f14] px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-400/50 focus:ring-4 focus:ring-sky-500/10";
const selectClass = inputClass;

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

function label(value: string) {
  const map: Record<string, string> = {
    generic: "Geral",
    sla: "SLA",
    integration: "Integração",
    occurrence: "Ocorrência",
    maintenance: "Manutenção",
    automation: "Automação",
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
    open: "Aberta",
    acknowledged: "Reconhecida",
    resolved: "Resolvida",
    silenced: "Silenciada",
    pending: "Pendente",
    triaged: "Triada",
    closed: "Fechada",
  };
  return map[value] || value;
}

function tone(value: string) {
  if (value === "critical") return "critical";
  if (["high", "open", "pending"].includes(value)) return "attention";
  if (["medium", "acknowledged", "triaged"].includes(value)) return "info";
  if (["resolved", "closed"].includes(value)) return "success";
  if (value === "silenced") return "violet";
  return "neutral";
}

function linkSummary(item: ExceptionRow) {
  const parts: string[] = [];
  if (item.integration) parts.push(`integração ${item.integration.code}`);
  if (item.occurrence) parts.push(`ocorrência ${item.occurrence.code}`);
  if (item.maintenance) parts.push(`manutenção ${item.maintenance.code}`);
  if (item.equipment) parts.push(`equipamento ${item.equipment.tag}`);
  if (item.unit) parts.push(`unidade ${item.unit.code}`);
  if (item.partner) parts.push(`parceiro ${item.partner.code}`);
  return parts.length ? parts.join(" - ") : "sem vínculo";
}

function slaLabel(item: ExceptionRow) {
  if (item.breachedAt) return "estourado";
  if (item.resolveDueAt) return new Date(item.resolveDueAt).toLocaleString("pt-BR");
  if (item.firstResponseDueAt) return new Date(item.firstResponseDueAt).toLocaleString("pt-BR");
  return "sem prazo";
}

export default async function ExcecoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/excecoes");

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const kind = readStringParam(params, "kind", "all");
  const severity = readStringParam(params, "severity", "all");
  const status = readStringParam(params, "status", "all");
  const triageStatus = readStringParam(params, "triageStatus", "all");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 12);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createException(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      await apiJson("/exceptions", {
        method: "POST",
        body: JSON.stringify({
          code: String(formData.get("code") || ""),
          title: String(formData.get("title") || ""),
          description: String(formData.get("description") || ""),
          kind: String(formData.get("kind") || ""),
          severity: String(formData.get("severity") || ""),
          status: String(formData.get("status") || ""),
          source: "manual",
          assigneeUserId: String(formData.get("assigneeUserId") || ""),
          silencedUntil: String(formData.get("silencedUntil") || ""),
          partnerId: String(formData.get("partnerId") || ""),
          unitId: String(formData.get("unitId") || ""),
          equipmentId: String(formData.get("equipmentId") || ""),
          integrationId: String(formData.get("integrationId") || ""),
          occurrenceId: String(formData.get("occurrenceId") || ""),
          maintenanceId: String(formData.get("maintenanceId") || ""),
        }),
      });

      revalidatePath("/operacao/excecoes");
      revalidatePath("/operacao/fila");
      revalidatePath("/operacao");
      return { status: "success", message: "Exceção criada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [
    usersResponse,
    partnersResponse,
    unitsResponse,
    equipmentsResponse,
    integrationsResponse,
    occurrencesResponse,
    maintenancesResponse,
    response,
  ] = await Promise.all([
    apiJson<PaginatedResponse<UserOption>>("/users?page=1&pageSize=100"),
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100&sortBy=tag&sortDir=asc"),
    apiJson<PaginatedResponse<IntegrationOption>>("/integrations?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<MaintenanceOption>>("/maintenances?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<ExceptionRow>>(
      `/exceptions${buildApiQuery({
        q,
        kind: kind !== "all" ? kind : undefined,
        severity: severity !== "all" ? severity : undefined,
        status: status !== "all" ? status : undefined,
        triageStatus: triageStatus !== "all" ? triageStatus : undefined,
        page,
        pageSize,
        sortBy: "priorityScore",
        sortDir: "desc",
      })}`,
    ),
  ]);

  const openCount = response.items.filter((item) => item.status === "open").length;
  const criticalCount = response.items.filter((item) => item.severity === "critical").length;
  const breachedCount = response.items.filter((item) => Boolean(item.breachedAt)).length;
  const unassignedCount = response.items.filter((item) => !item.assignee).length;

  return (
    <AppShell
      title="Exceções"
      subtitle="Backlog qualificado para refino, triagem e encaminhamento."
    ><RegistryHero
        eyebrow="Exception Desk"
        title="Backlog"
        description="Consulta e abertura manual."
      /><RegistrySummaryStrip
        items={[
          { label: "Casos", value: response.meta.total, meta: "resultado filtrado", tone: "info" },
          { label: "Abertos", value: openCount, meta: "nesta página", tone: openCount ? "attention" : "success" },
          { label: "Críticos", value: criticalCount, meta: "nesta página", tone: criticalCount ? "critical" : "success" },
          { label: "Sem responsável", value: unassignedCount, meta: breachedCount ? `${breachedCount} SLA estourado(s)` : "sem estouro na página", tone: unassignedCount ? "attention" : "success" },
        ]}
        noteTitle="Fila de despacho"
        noteCopy="Exceções fica para consultar e abrir caso manual. A execução diária continua em Fila, com o mínimo de atalhos redundantes."
      /><OperationsLinkGrid
        title="Áreas relacionadas"
        description="Fila, histórico, SLA e automação."
        links={[
          {
            href: "/operacao/fila",
            title: "Fila",
            description: "Despacho, seleção em lote e atribuição.",
            badge: <TonePill tone={openCount ? "attention" : "success"}>{openCount} aberto(s)</TonePill>,
          },
          {
            href: "/operacao/atividade",
            title: "Atividade",
            description: "Notas, decisões e histórico.",
            badge: <TonePill tone="info">{response.meta.total} no recorte</TonePill>,
          },
          {
            href: "/operacao/sla",
            title: "Políticas SLA",
            description: "Prazos, severidade e fila.",
            badge: <TonePill tone={breachedCount ? "critical" : "neutral"}>{breachedCount} estourado(s)</TonePill>,
          },
          {
            href: "/operacao/automacoes",
            title: "Automações",
            description: "Regras e geração de casos.",
            badge: <TonePill tone="violet">motor de origem</TonePill>,
          },
        ]}
      /><OperationsGuidanceGrid
        title="Uso"
        description="Qualificação e despacho."
        items={[
          {
            label: "Ler",
            title: "Qualificação",
            description: "Parceiro, unidade, equipamento, prioridade e prazo.",
            tone: "info",
          },
          {
            label: "Despachar",
            title: "Despacho",
            description: "Fila de exceções.",
            tone: "attention",
          },
          {
            label: "Fechar ciclo",
            title: "Atividade",
            description: "Ações, contatos e evidências.",
            tone: "success",
          },
        ]}
      /><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Consulta"
          title="Filtros"
          description="Tipo, severidade, status e triagem."
          actions={
            <div className="flex flex-wrap gap-2"><Link href="/operacao/fila" className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100">Ir para fila</Link><Link href="/operacao/excecoes" className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100">Limpar</Link></div>
          }
          compact
        /><form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,180px))]"><div className="md:col-span-2 xl:col-span-1"><FieldLabel>Busca</FieldLabel><input name="q" defaultValue={q} placeholder="Código, título, vínculo ou responsável" className={inputClass} /></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue={kind} className={selectClass}><option value="all">Todos</option><option value="generic">Geral</option><option value="sla">SLA</option><option value="integration">Integração</option><option value="occurrence">Ocorrência</option><option value="maintenance">Manutenção</option><option value="automation">Automação</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue={severity} className={selectClass}><option value="all">Todas</option><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><FieldLabel>Status</FieldLabel><select name="status" defaultValue={status} className={selectClass}><option value="all">Todos</option><option value="open">Aberta</option><option value="acknowledged">Reconhecida</option><option value="resolved">Resolvida</option><option value="silenced">Silenciada</option></select></div><div><FieldLabel>Triagem</FieldLabel><select name="triageStatus" defaultValue={triageStatus} className={selectClass}><option value="all">Toda</option><option value="pending">Pendente</option><option value="triaged">Triada</option><option value="closed">Fechada</option></select></div><div><FieldLabel>Página</FieldLabel><select name="pageSize" defaultValue={String(pageSize)} className={selectClass}><option value="12">12 por página</option><option value="25">25 por página</option><option value="50">50 por página</option></select></div><button className="rounded-[12px] border border-blue-400/30 bg-[#17213a] px-4 py-2.5 text-sm font-semibold text-white md:col-span-2 xl:col-span-2 xl:self-end">
            Aplicar filtros
          </button></form></Surface><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Backlog"
          title="Casos encontrados"
          description={`${response.meta.total} caso(s) no recorte atual.`}
          compact
        /><div className="mt-5">
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Caso</th><th className="px-4 py-3">Fila</th><th className="px-4 py-3">Sev.</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Triagem</th><th className="px-4 py-3">SLA</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Ação</th></tr></TableHead><tbody>
                  {response.items.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]"><TableCell><Link href={`/operacao/excecoes/${item.id}`} className="font-semibold text-slate-50 transition hover:text-sky-100">
                          {item.code}
                        </Link><div className="mt-1 text-sm text-slate-300">{item.title}</div><div className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                          {linkSummary(item)} - prioridade {item.priorityScore} - {item._count.comments} comentário(s)
                        </div></TableCell><TableCell>{queueLabel(item.queueKey)}</TableCell><TableCell><TonePill tone={tone(item.severity)}>{label(item.severity)}</TonePill></TableCell><TableCell><TonePill tone={tone(item.status)}>{label(item.status)}</TonePill></TableCell><TableCell><TonePill tone={tone(item.triageStatus)}>{label(item.triageStatus)}</TonePill></TableCell><TableCell className={item.breachedAt ? "text-rose-200" : "text-slate-300"}>{slaLabel(item)}</TableCell><TableCell><div className="text-slate-200">{item.assignee?.name || "-"}</div><div className="mt-1 text-xs text-slate-500">{item.assignee?.email || ""}</div></TableCell><TableCell><Link href={`/operacao/excecoes/${item.id}`} className="inline-flex rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/18 hover:bg-white/[0.08]">
                          Abrir
                        </Link></TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Nenhuma exceção encontrada" description="A busca atual não retornou casos. Ajuste os filtros ou volte para a fila operacional." />
          )}
        </div></Surface><ListPagination pathname="/operacao/excecoes" searchParams={params} meta={response.meta} />

      {isAdmin ? (
        <Surface className="p-5 sm:p-6"><SectionIntro
            eyebrow="Cadastro manual"
            title="Nova exceção"
            description="Abertura manual e fila operacional."
            compact
          /><ActionForm action={createException} className="grid gap-4" submitLabel="Criar exceção" pendingLabel="Criando..."><div className="mt-5 grid gap-3 lg:grid-cols-4"><div><FieldLabel>Código</FieldLabel><input name="code" placeholder="EXC-OPS-001" className={inputClass} /></div><div className="lg:col-span-2"><FieldLabel>Título</FieldLabel><input name="title" placeholder="Falha crítica de integração" className={inputClass} /></div><div><FieldLabel>Responsável</FieldLabel><select name="assigneeUserId" defaultValue="" className={selectClass}><option value="">Sem responsável</option>
                  {usersResponse.items.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
                  ))}
                </select></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue="generic" className={selectClass}><option value="generic">Geral</option><option value="sla">SLA</option><option value="integration">Integração</option><option value="occurrence">Ocorrência</option><option value="maintenance">Manutenção</option><option value="automation">Automação</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue="medium" className={selectClass}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><FieldLabel>Status</FieldLabel><select name="status" defaultValue="open" className={selectClass}><option value="open">Aberta</option><option value="acknowledged">Reconhecida</option><option value="silenced">Silenciada</option></select></div><div><FieldLabel>Silenciar até</FieldLabel><input name="silencedUntil" type="datetime-local" className={inputClass} /></div><div><FieldLabel>Parceiro</FieldLabel><select name="partnerId" defaultValue="" className={selectClass}><option value="">Sem parceiro</option>
                  {partnersResponse.items.map((item) =><option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </select></div><div><FieldLabel>Unidade</FieldLabel><select name="unitId" defaultValue="" className={selectClass}><option value="">Sem unidade</option>
                  {unitsResponse.items.map((item) =><option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </select></div><div><FieldLabel>Equipamento</FieldLabel><select name="equipmentId" defaultValue="" className={selectClass}><option value="">Sem equipamento</option>
                  {equipmentsResponse.items.map((item) =><option key={item.id} value={item.id}>{item.tag} - {item.name}</option>)}
                </select></div><div><FieldLabel>Integração</FieldLabel><select name="integrationId" defaultValue="" className={selectClass}><option value="">Sem integração</option>
                  {integrationsResponse.items.map((item) =><option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </select></div><div><FieldLabel>Ocorrência</FieldLabel><select name="occurrenceId" defaultValue="" className={selectClass}><option value="">Sem ocorrência</option>
                  {occurrencesResponse.items.map((item) =><option key={item.id} value={item.id}>{item.code} - {item.title}</option>)}
                </select></div><div><FieldLabel>Manutenção</FieldLabel><select name="maintenanceId" defaultValue="" className={selectClass}><option value="">Sem manutenção</option>
                  {maintenancesResponse.items.map((item) =><option key={item.id} value={item.id}>{item.code} - {item.title}</option>)}
                </select></div><div className="lg:col-span-4"><FieldLabel>Descrição</FieldLabel><textarea name="description" placeholder="Contexto operacional do caso" className={`${inputClass} min-h-28`} /></div></div></ActionForm></Surface>
      ) : null}
    </AppShell>
  );
}
