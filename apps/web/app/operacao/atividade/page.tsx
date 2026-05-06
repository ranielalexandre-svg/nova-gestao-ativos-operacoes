import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
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
type ExceptionOption = { id: string; code: string; title: string; status: string };
type AutomationOption = { id: string; code: string; name: string };
type AutomationRunOption = { id: string; status: string; startedAt: string; rule: { code: string; name: string } };

type ActivityRow = {
  id: string;
  kind: string;
  source: string;
  title: string;
  description: string | null;
  severity: string | null;
  createdAt: string;
  updatedAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
  exceptionCase: { id: string; code: string; title: string; status: string } | null;
  automation: { id: string; code: string; name: string; detector: string } | null;
  automationRun: { id: string; status: string; startedAt: string; finishedAt: string | null } | null;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  integration: IntegrationOption | null;
  occurrence: OccurrenceOption | null;
  maintenance: MaintenanceOption | null;
};

const inputClass = "mt-2";
const selectClass = inputClass;

function refs(item: ActivityRow) {
  const parts: string[] = [];
  if (item.exceptionCase) parts.push(`exceção ${item.exceptionCase.code}`);
  if (item.automation) parts.push(`regra ${item.automation.code}`);
  if (item.integration) parts.push(`integração ${item.integration.code}`);
  if (item.occurrence) parts.push(`alerta ${item.occurrence.code}`);
  if (item.maintenance) parts.push(`chamado ${item.maintenance.code}`);
  if (item.equipment) parts.push(`ativo ${item.equipment.tag}`);
  if (item.unit) parts.push(`unidade ${item.unit.code}`);
  if (item.partner) parts.push(`parceiro ${item.partner.code}`);
  return parts.length ? parts.join(" - ") : "sem vínculo";
}

function tone(value?: string | null) {
  if (!value) return "neutral";
  if (["critical", "error"].includes(value)) return "critical";
  if (["high", "warning"].includes(value)) return "attention";
  if (["medium", "info", "automation"].includes(value)) return "info";
  if (["success", "resolved"].includes(value)) return "success";
  return "neutral";
}

function label(value?: string | null) {
  const map: Record<string, string> = {
    note: "Nota",
    event: "Evento",
    exception: "Exceção",
    automation: "Automação",
    system: "Sistema",
    manual: "Manual",
    info: "Info",
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return value ? map[value] || value : "-";
}

export default async function AtividadePage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/operacao/atividade");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const kind = readStringParam(params, "kind", "all");
  const source = readStringParam(params, "source", "all");
  const severity = readStringParam(params, "severity", "all");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function createActivity(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      await apiJson("/activities", {
        method: "POST",
        body: JSON.stringify({
          title: String(formData.get("title") || ""),
          description: String(formData.get("description") || ""),
          kind: String(formData.get("kind") || ""),
          source: "manual",
          severity: String(formData.get("severity") || ""),
          userId: String(formData.get("userId") || ""),
          exceptionId: String(formData.get("exceptionId") || ""),
          automationId: String(formData.get("automationId") || ""),
          automationRunId: String(formData.get("automationRunId") || ""),
          partnerId: String(formData.get("partnerId") || ""),
          unitId: String(formData.get("unitId") || ""),
          equipmentId: String(formData.get("equipmentId") || ""),
          integrationId: String(formData.get("integrationId") || ""),
          occurrenceId: String(formData.get("occurrenceId") || ""),
          maintenanceId: String(formData.get("maintenanceId") || ""),
        }),
      });

      revalidatePath("/operacao/atividade");
      return { status: "success", message: "Atividade criada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [
    usersResponse,
    exceptionsResponse,
    automationsResponse,
    runsResponse,
    partnersResponse,
    unitsResponse,
    equipmentsResponse,
    integrationsResponse,
    occurrencesResponse,
    maintenancesResponse,
    response,
  ] = await Promise.all([
    apiJson<PaginatedResponse<UserOption>>("/users?page=1&pageSize=100"),
    apiJson<PaginatedResponse<ExceptionOption>>("/exceptions?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<AutomationOption>>("/automations?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<AutomationRunOption>>("/automations/runs?page=1&pageSize=100&sortDir=desc"),
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100&sortBy=tag&sortDir=asc"),
    apiJson<PaginatedResponse<IntegrationOption>>("/integrations?page=1&pageSize=100&sortBy=code&sortDir=asc"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<MaintenanceOption>>("/maintenances?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    apiJson<PaginatedResponse<ActivityRow>>(
      `/activities${buildApiQuery({
        q,
        kind: kind !== "all" ? kind : undefined,
        source: source !== "all" ? source : undefined,
        severity: severity !== "all" ? severity : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
  ]);

  const manualCount = response.items.filter((item) => item.source === "manual").length;
  const automationCount = response.items.filter((item) => item.source === "automation").length;
  const criticalCount = response.items.filter((item) => ["high", "critical"].includes(item.severity || "")).length;

  return (
    <NovaLitShell activeHref="/operacao/atividade">
      <div className="nova-operation-activity-lit-page"><RegistryHero
        eyebrow="Activity Desk"
        title="Linha do tempo operacional"
        description="Decisões, automações, vínculos e registros manuais."
      /><RegistrySummaryStrip
        items={[
          { label: "Eventos", value: response.meta.total, meta: "resultado filtrado", tone: "info" },
          { label: "Manuais", value: manualCount, meta: "nesta página", tone: manualCount ? "attention" : "neutral" },
          { label: "Automações", value: automationCount, meta: "nesta página", tone: automationCount ? "violet" : "neutral" },
          { label: "Alta atenção", value: criticalCount, meta: "alta ou crítica", tone: criticalCount ? "critical" : "success" },
        ]}
        noteTitle="Auditoria operacional"
        noteCopy="Linha do tempo e registro manual."
      /><OperationsLinkGrid
        title="Áreas relacionadas"
        description="Contexto, despacho, regra e consulta."
        links={[
          {
            href: "/excecoes",
            title: "Exceções",
            description: "Casos qualificados, abertura manual e leitura de vínculo.",
            badge: <TonePill tone="attention">{manualCount} manual(is)</TonePill>,
          },
          {
            href: "/operacao/fila",
            title: "Fila",
            description: "Priorização, reconhecimento e ação em lote do turno.",
            badge: <TonePill tone={criticalCount ? "critical" : "success"}>{criticalCount} alta atenção</TonePill>,
          },
          {
            href: "/automacao",
            title: "Automações",
            description: "Regras e runs recentes.",
            badge: <TonePill tone="violet">{automationCount} auto</TonePill>,
          },
          {
            href: "/sensores",
            title: "Monitoramento",
            description: "Saúde do host, perda, latência e pressão por unidade vinculada.",
            badge: <TonePill tone="info">host e unidade</TonePill>,
          },
        ]}
      /><OperationsGuidanceGrid
        title="O que registrar aqui"
        description="Decisão, contexto e handoff."
        items={[
          {
            label: "Registrar",
            title: "Notas curtas e evidência útil",
            description: "Use atividade para contato feito, hipótese levantada, evidência recebida e próximo passo combinado.",
            tone: "info",
          },
          {
            label: "Evitar",
            title: "Registro objetivo",
            description: "Indicadores, despacho e política continuam nas telas próprias; aqui entra a narrativa operacional do que realmente aconteceu.",
            tone: "attention",
          },
          {
            label: "Cruzar",
            title: "Linke tudo que sustenta a leitura",
            description: "Sempre que possível, conecte exceção, unidade, ativo, integração, alerta ou chamado para a auditoria ficar navegável.",
            tone: "success",
          },
        ]}
      /><Surface><SectionIntro
          eyebrow="Consulta"
          title="Buscar atividade por vínculo real"
          description="Filtre por texto, tipo, origem e severidade sem sair da URL compartilhável."
          actions={<Link href="/operacao/atividade" className="nds-button" data-variant="secondary">Limpar</Link>}
          compact
        /><form method="GET" className="nova-filter-grid nova-filter-grid--activity mt-2"><div className="md:col-span-2 xl:col-span-1"><FieldLabel>Busca</FieldLabel><input name="q" defaultValue={q} placeholder="Título, descrição, unidade, parceiro ou vínculo" className={inputClass} /></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue={kind} className={selectClass}><option value="all">Todos</option><option value="note">Nota</option><option value="event">Evento</option><option value="exception">Exceção</option><option value="automation">Automação</option><option value="system">Sistema</option></select></div><div><FieldLabel>Origem</FieldLabel><select name="source" defaultValue={source} className={selectClass}><option value="all">Todas</option><option value="manual">Manual</option><option value="automation">Automação</option><option value="exception">Exceção</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue={severity} className={selectClass}><option value="all">Todas</option><option value="info">Info</option><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><FieldLabel>Ordenar por</FieldLabel><select name="sortBy" defaultValue={sortBy} className={selectClass}><option value="createdAt">Cadastro</option><option value="updatedAt">Atualização</option><option value="severity">Severidade</option><option value="kind">Tipo</option></select></div><div><FieldLabel>Direção</FieldLabel><select name="sortDir" defaultValue={sortDir} className={selectClass}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div><div><FieldLabel>Página</FieldLabel><select name="pageSize" defaultValue={String(pageSize)} className={selectClass}><option value="10">10 por página</option><option value="25">25 por página</option><option value="50">50 por página</option></select></div><button className="nds-button md:col-span-2 xl:col-span-2 xl:self-end" data-variant="primary">
            Aplicar filtros
          </button></form></Surface><Surface><SectionIntro
          eyebrow="Linha do tempo"
          title="Atividades registradas"
          description={`${response.meta.total} evento(s) no recorte atual.`}
          compact
        /><div className="mt-2">
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Atividade</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Ator</th><th className="px-3 py-2">Vínculos</th><th className="px-3 py-2">Criada</th></tr></TableHead><tbody>
                  {response.items.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]"><TableCell><div className="font-semibold text-slate-50">{item.title}</div><div className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">{item.description || "-"}</div></TableCell><TableCell><TonePill tone={tone(item.kind)}>{label(item.kind)}</TonePill></TableCell><TableCell><TonePill tone={tone(item.source)}>{label(item.source)}</TonePill></TableCell><TableCell><TonePill tone={tone(item.severity)}>{label(item.severity)}</TonePill></TableCell><TableCell><div className="text-slate-200">{item.actor?.name || "-"}</div><div className="mt-1 text-[10px] text-slate-500">{item.actor?.email || ""}</div></TableCell><TableCell className="max-w-md text-[10px] leading-5 text-slate-400">{refs(item)}</TableCell><TableCell className="whitespace-nowrap text-slate-300">{new Date(item.createdAt).toLocaleString("pt-BR")}</TableCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState title="Nenhuma atividade encontrada" description="Ajuste filtros ou registre uma nota manual quando houver contexto operacional que não veio de automação." />
          )}
        </div></Surface><ListPagination pathname="/operacao/atividade" searchParams={params} meta={response.meta} />

      {isAdmin ? (
        <Surface><SectionIntro
            eyebrow="Registro manual"
            title="Nova atividade"
            description="Decisão, contato, evidência ou próximo passo."
            compact
          /><ActionForm
            action={createActivity}
            className="mt-2 grid gap-2"
            submitLabel="Criar atividade"
            pendingLabel="Criando..."
          ><div className="grid gap-2 lg:grid-cols-4"><div className="lg:col-span-2"><FieldLabel>Título</FieldLabel><input name="title" placeholder="Resumo curto da atividade" className={inputClass} /></div><div><FieldLabel>Tipo</FieldLabel><select name="kind" defaultValue="note" className={selectClass}><option value="note">Nota</option><option value="event">Evento</option><option value="exception">Exceção</option><option value="automation">Automação</option><option value="system">Sistema</option></select></div><div><FieldLabel>Severidade</FieldLabel><select name="severity" defaultValue="info" className={selectClass}><option value="info">Info</option><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div className="lg:col-span-2"><FieldLabel>Ator</FieldLabel><select name="userId" className={selectClass}><option value="">Sem ator</option>
                  {usersResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} - {item.email}</option>
                  ))}
                </select></div><div><FieldLabel>Exceção</FieldLabel><select name="exceptionId" className={selectClass}><option value="">Sem exceção</option>
                  {exceptionsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                  ))}
                </select></div><div><FieldLabel>Regra</FieldLabel><select name="automationId" className={selectClass}><option value="">Sem regra</option>
                  {automationsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select></div><div><FieldLabel>Run</FieldLabel><select name="automationRunId" className={selectClass}><option value="">Sem run</option>
                  {runsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.rule.code} - {new Date(item.startedAt).toLocaleString("pt-BR")}</option>
                  ))}
                </select></div><div><FieldLabel>Parceiro</FieldLabel><select name="partnerId" className={selectClass}><option value="">Sem parceiro</option>
                  {partnersResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select></div><div><FieldLabel>Unidade</FieldLabel><select name="unitId" className={selectClass}><option value="">Sem unidade</option>
                  {unitsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select></div><div><FieldLabel>Ativo</FieldLabel><select name="equipmentId" className={selectClass}><option value="">Sem ativo</option>
                  {equipmentsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.tag} - {item.name}</option>
                  ))}
                </select></div><div><FieldLabel>Integração</FieldLabel><select name="integrationId" className={selectClass}><option value="">Sem integração</option>
                  {integrationsResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select></div><div><FieldLabel>Alerta</FieldLabel><select name="occurrenceId" className={selectClass}><option value="">Sem alerta</option>
                  {occurrencesResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                  ))}
                </select></div><div><FieldLabel>Chamado</FieldLabel><select name="maintenanceId" className={selectClass}><option value="">Sem chamado</option>
                  {maintenancesResponse.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                  ))}
                </select></div><div className="lg:col-span-4"><FieldLabel>Descrição</FieldLabel><textarea name="description" placeholder="Contexto, decisão, evidência ou próximo passo" className={`${inputClass} min-h-28`} /></div></div></ActionForm></Surface>
      ) : null}
          </div>
    </NovaLitShell>
  );
}
