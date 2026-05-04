import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  FieldLabel,
  SectionIntro,
  Surface,
  TableActionAnchor,
  TableActionCell,
  TableActionHeader,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  RegistryHero,
  RegistrySummaryStrip,
} from "@/components/registry-shell";
import {
  OperationsGuidanceGrid,
  OperationsLinkGrid,
} from "@/components/operations-workspace";
import { apiJson } from "@/lib/server-api";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime, optionLabel } from "@/lib/formatters";
import { occurrenceSeverityTone as severityTone } from "@/lib/status-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type RuleRow = {
  id: string;
  code: string;
  name: string;
  detector: string;
  severity: string;
  cadence: string;
  thresholdMinutes: number | null;
  enabled: boolean;
  createExceptions: boolean;
  createActivities: boolean;
  resolveOnRecovery: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    runs: number;
    exceptionCases: number;
  };
};

type RunRow = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  hitsCount: number;
  createdCount: number;
  updatedCount: number;
  summary: string | null;
  errorMessage: string | null;
  rule: {
    id: string;
    code: string;
    name: string;
    detector: string;
  };
};

const detectorOptions = [
  { value: "maintenance_overdue", label: "Chamado vencido" },
  { value: "critical_open_occurrence", label: "Alerta crítico aberto" },
  { value: "integration_failure", label: "Falha de integração" },
  { value: "aged_open_occurrence", label: "Alerta antigo aberto" },
  { value: "monitoring_report_export", label: "Exportação de relatório" },
];

const severityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const cadenceOptions = [
  { value: "every_minute", label: "A cada minuto" },
  { value: "every_5_minutes", label: "A cada 5 minutos" },
  { value: "hourly", label: "Por hora" },
];

function runTone(value: string) {
  if (value === "success") return "success";
  if (value === "error") return "critical";
  return "attention";
}

function routineProgress(item: RuleRow) {
  if (!item.enabled) return 0;
  const base = item._count.runs ? 56 : 28;
  const effects = (item.createExceptions ? 18 : 0) + (item.createActivities ? 14 : 0) + (item.resolveOnRecovery ? 8 : 0);
  const severityPenalty = item.severity === "critical" ? 0 : item.severity === "high" ? 4 : 10;
  return Math.min(100, base + effects + severityPenalty);
}

function RoutineCard({ item }: { item: RuleRow }) {
  const progress = routineProgress(item);
  const statusTone = item.enabled ? (item.severity === "critical" ? "critical" : "success") : "subtle";

  return (
    <article className="nova-automation-routine">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-black text-white">{item.code}</span>
          <TonePill tone={statusTone}>{item.enabled ? "ativa" : "pausada"}</TonePill>
          <TonePill tone={severityTone(item.severity)}>{optionLabel(severityOptions, item.severity)}</TonePill>
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--nova-text-muted)]">{item.name}</div>
        <div className="mt-2 text-[10px] text-slate-500">{optionLabel(detectorOptions, item.detector)}</div>
      </div>

      <div className="nova-automation-routine-center">
        <div className="grid gap-1 text-[10px] text-[var(--nova-text-muted)] sm:grid-cols-2">
          <div>
            <span className="nds-label">Última execução</span>
            <div className="mt-1 truncate text-slate-300">{formatDateTime(item.lastRunAt)}</div>
          </div>
          <div>
            <span className="nds-label">Próxima</span>
            <div className="mt-1 truncate text-slate-300">{formatDateTime(item.nextRunAt)}</div>
          </div>
        </div>
        <div className="nova-automation-progress" aria-label={`Saúde ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="nova-automation-routine-side">
        <div className="grid grid-cols-2 gap-2">
          <div className="nova-automation-mini-stat">
            <span>Runs</span>
            <strong>{item._count.runs}</strong>
          </div>
          <div className="nova-automation-mini-stat">
            <span>Casos</span>
            <strong>{item._count.exceptionCases}</strong>
          </div>
        </div>
        <TableActionAnchor href={`#rule-${item.id}`}>
          Ajustar
        </TableActionAnchor>
      </div>
    </article>
  );
}

function RuleFields({
  prefix,
  defaults,
}: {
  prefix: string;
  defaults?: Partial<RuleRow>;
}) {
  return (
    <><div className="grid gap-2 xl:col-span-2"><FieldLabel htmlFor={`${prefix}-name`} label="Nome" /><input
          id={`${prefix}-name`}
          name="name"
          defaultValue={defaults?.name || ""}
          placeholder="Regra operacional"
        /></div><div className="grid gap-2 xl:col-span-2"><FieldLabel htmlFor={`${prefix}-detector`} label="Detector" /><select
          id={`${prefix}-detector`}
          name="detector"
          defaultValue={defaults?.detector || "maintenance_overdue"}
        >
          {detectorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select></div><div className="grid gap-2"><FieldLabel htmlFor={`${prefix}-severity`} label="Severidade" /><select
          id={`${prefix}-severity`}
          name="severity"
          defaultValue={defaults?.severity || "high"}
        >
          {severityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select></div><div className="grid gap-2"><FieldLabel htmlFor={`${prefix}-cadence`} label="Cadência" /><select
          id={`${prefix}-cadence`}
          name="cadence"
          defaultValue={defaults?.cadence || "every_5_minutes"}
        >
          {cadenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select></div><div className="grid gap-2"><FieldLabel htmlFor={`${prefix}-threshold`} label="Limite min." /><input
          id={`${prefix}-threshold`}
          name="thresholdMinutes"
          type="number"
          min="1"
          defaultValue={defaults?.thresholdMinutes ?? ""}
          placeholder="30"
        /></div><div className="grid gap-2 md:col-span-2 xl:col-span-8"><FieldLabel htmlFor={`${prefix}-flags`} label="Efeitos" /><div id={`${prefix}-flags`} className="nds-card grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="enabled" defaultChecked={defaults?.enabled ?? true} className="h-4 w-4 rounded border-white/20 bg-[var(--nova-surface-3)]" />
            Regra ativa
          </label><label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="createExceptions" defaultChecked={defaults?.createExceptions ?? true} className="h-4 w-4 rounded border-white/20 bg-[var(--nova-surface-3)]" />
            Criar exceções
          </label><label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="createActivities" defaultChecked={defaults?.createActivities ?? true} className="h-4 w-4 rounded border-white/20 bg-[var(--nova-surface-3)]" />
            Criar atividades
          </label><label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" name="resolveOnRecovery" defaultChecked={defaults?.resolveOnRecovery ?? true} className="h-4 w-4 rounded border-white/20 bg-[var(--nova-surface-3)]" />
            Resolver na recuperação
          </label></div></div></>
  );
}

export default async function AutomacoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/automacao");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const detector = readStringParam(params, "detector", "all");
  const enabled = readStringParam(params, "enabled", "all");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  async function updateRule(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";
    try {
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");

      await apiJson(`/automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          detector: String(formData.get("detector") || ""),
          severity: String(formData.get("severity") || ""),
          cadence: String(formData.get("cadence") || ""),
          thresholdMinutes: formData.get("thresholdMinutes") ? Number(formData.get("thresholdMinutes")) : undefined,
          enabled: formData.get("enabled") === "on",
          createExceptions: formData.get("createExceptions") === "on",
          createActivities: formData.get("createActivities") === "on",
          resolveOnRecovery: formData.get("resolveOnRecovery") === "on",
        }),
      });

      revalidatePath("/automacao");
      revalidatePath("/operacao");
      return { status: "success", message: "Regra atualizada com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  const [rulesResponse, runsResponse] = await Promise.all([
    apiJson<PaginatedResponse<RuleRow>>(
      `/automations${buildApiQuery({
        q,
        detector: detector !== "all" ? detector : undefined,
        enabled: enabled !== "all" ? enabled : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })}`,
    ),
    apiJson<PaginatedResponse<RunRow>>("/automations/runs?page=1&pageSize=12&sortDir=desc"),
  ]);

  const enabledOnPage = rulesResponse.items.filter((item) => item.enabled).length;
  const creatingExceptions = rulesResponse.items.filter((item) => item.createExceptions).length;
  const failedRuns = runsResponse.items.filter((run) => run.status === "error").length;
  const hits = runsResponse.items.reduce((sum, run) => sum + run.hitsCount, 0);

  return (
    <AppShell
      title="Automações"
      subtitle="Regras recorrentes, histórico de execução e geração automática de exceções e atividades."
    ><RegistryHero
        eyebrow="Automation Desk"
        title="Regras operacionais"
        description="Automações e execuções."
      /><RegistrySummaryStrip
        items={[
          {
            label: "Regras",
            value: rulesResponse.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Ativas",
            value: enabledOnPage,
            meta: "nesta página",
            tone: enabledOnPage ? "success" : "attention",
          },
          {
            label: "Geram exceção",
            value: creatingExceptions,
            meta: "efeito operacional",
            tone: creatingExceptions ? "attention" : "neutral",
          },
          {
            label: "Últimos runs",
            value: hits,
            meta: failedRuns ? `${failedRuns} falha(s)` : "sem falhas recentes",
            tone: failedRuns ? "critical" : "success",
          },
        ]}
        noteTitle="Regra não é painel"
        noteCopy="A automação fica administrativa e auditável. O que impacta o turno aparece na fila, nas exceções e na atividade."
      /><OperationsLinkGrid
        title="Trilho operacional das regras"
        description="Backlog, atividade, monitoramento e integrações."
        links={[
          {
            href: "/excecoes",
            title: "Exceções",
            description: "Casos por regra e detector.",
            badge: <TonePill tone={creatingExceptions ? "attention" : "neutral"}>{creatingExceptions} geram caso</TonePill>,
          },
          {
            href: "/operacao/atividade",
            title: "Atividade",
            description: "Runs, notas e ações.",
            badge: <TonePill tone="info">{hits} hits</TonePill>,
          },
          {
            href: "/sensores",
            title: "Monitoramento",
            description: "Host, sensor e unidade.",
            badge: <TonePill tone="success">host e sensor</TonePill>,
          },
          {
            href: "/integracoes",
            title: "Integrações",
            description: "Conectores e testes.",
            badge: <TonePill tone={failedRuns ? "critical" : "neutral"}>{failedRuns} falha(s)</TonePill>,
          },
        ]}
      /><OperationsGuidanceGrid
        title="Revisão da regra"
        description="Critérios e efeitos."
        items={[
          {
            label: "Detectar",
            title: "Detector, severidade e cadência",
            description: "Detector, janela e limiar.",
            tone: "info",
          },
          {
            label: "Observar",
            title: "Últimos runs",
            description: "Hits, erros e criação de casos.",
            tone: "attention",
          },
          {
            label: "Amarrar",
            title: "Efeitos",
            description: "Exceções e atividades vinculadas.",
            tone: "success",
          },
        ]}
      /><Surface><SectionIntro
          eyebrow="Filtros"
          title="Refine detector e estado"
          description="Busca por código, nome ou detector. A URL guarda o recorte para voltar rapidamente à mesma visão."
          actions={
            <Link
              href="/automacao"
              className="nds-button"
              data-variant="secondary"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="nova-filter-grid nova-filter-grid--six mt-2"><div className="grid gap-2 xl:col-span-2"><FieldLabel htmlFor="automation-q" label="Busca" /><input
              id="automation-q"
              name="q"
              defaultValue={q}
              placeholder="Código, nome ou detector"
            /></div><div className="grid gap-2"><FieldLabel htmlFor="automation-detector" label="Detector" /><select
              id="automation-detector"
              name="detector"
              defaultValue={detector}
            ><option value="all">Todos os detectores</option>
              {detectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select></div><div className="grid gap-2"><FieldLabel htmlFor="automation-enabled" label="Estado" /><select
              id="automation-enabled"
              name="enabled"
              defaultValue={enabled}
            ><option value="all">Todos</option><option value="true">Ativas</option><option value="false">Pausadas</option></select></div><div className="grid gap-2"><FieldLabel htmlFor="automation-sort-by" label="Ordenar por" /><select
              id="automation-sort-by"
              name="sortBy"
              defaultValue={sortBy}
            ><option value="createdAt">Cadastro</option><option value="code">Código</option><option value="name">Nome</option><option value="detector">Detector</option><option value="severity">Severidade</option></select></div><div className="grid gap-2"><FieldLabel htmlFor="automation-sort-dir" label="Direção" /><select
              id="automation-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
            ><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div><div className="grid gap-2 md:col-span-2 xl:col-span-2"><FieldLabel htmlFor="automation-page-size" label="Página" /><select
              id="automation-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
            ><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select></div><button className="nds-button md:col-span-2 xl:col-span-4" data-variant="primary">
            Aplicar filtros
          </button></form></Surface><Surface><SectionIntro
          eyebrow="Rotinas"
          title="Saúde das automações"
          description="Cards horizontais com estado de execução, agenda e volume gerado."
          compact
        /><div className="mt-2 grid gap-2">
          {rulesResponse.items.length ? (
            rulesResponse.items.slice(0, 6).map((item) => (
              <RoutineCard key={item.id} item={item} />
            ))
          ) : (
            <EmptyState
              title="Nenhuma rotina no recorte"
              description="Ajuste os filtros para exibir as regras cadastradas."
            />
          )}
        </div></Surface><Surface><SectionIntro
          eyebrow="Regras"
          title="Automações cadastradas"
          description={`${rulesResponse.meta.total} regra(s) encontradas nesta visão.`}
          actions={<TonePill tone="neutral">{rulesResponse.items.length} linhas</TonePill>}
          compact
        /><div className="mt-2">
          {rulesResponse.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Regra</th><th className="px-3 py-2">Detector</th><th className="px-3 py-2">Sev.</th><th className="px-3 py-2">Cadência</th><th className="px-3 py-2">Efeitos</th><th className="px-3 py-2">Próxima</th><TableActionHeader>Ajuste</TableActionHeader></tr></TableHead><tbody>
                  {rulesResponse.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    ><TableCell><div className="font-medium text-white">{item.code} · {item.name}</div><div className="mt-1 text-[10px] text-slate-500">
                          {item._count.runs} runs · {item._count.exceptionCases} exceções
                        </div></TableCell><TableCell className="text-slate-300">
                        {optionLabel(detectorOptions, item.detector)}
                      </TableCell><TableCell><TonePill tone={severityTone(item.severity)}>
                          {optionLabel(severityOptions, item.severity)}
                        </TonePill></TableCell><TableCell className="text-slate-300">
                        {optionLabel(cadenceOptions, item.cadence)}
                        <div className="mt-1 text-[10px] text-slate-500">
                          limite {item.thresholdMinutes ?? "-"} min
                        </div></TableCell><TableCell><div className="flex flex-wrap gap-2"><TonePill tone={item.enabled ? "success" : "subtle"}>
                            {item.enabled ? "ativa" : "pausada"}
                          </TonePill>
                          {item.createExceptions ? <TonePill tone="attention">exceções</TonePill> : null}
                          {item.createActivities ? <TonePill tone="info">atividades</TonePill> : null}
                        </div></TableCell><TableCell><div className="text-slate-300">{formatDateTime(item.nextRunAt)}</div><div className="mt-1 text-[10px] text-slate-500">
                          última {formatDateTime(item.lastRunAt)}
                        </div></TableCell><TableActionCell><TableActionAnchor href={`#rule-${item.id}`}>
                          Ajustar regra
                        </TableActionAnchor></TableActionCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhuma regra encontrada"
              description="Ajuste os filtros ou limpe a busca para voltar à base completa."
              action={
                <Link
                  href="/automacao"
                  className="nds-button"
                  data-variant="primary"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div></Surface><ListPagination
        pathname="/automacao"
        searchParams={params}
        meta={rulesResponse.meta}
      />

      {isAdmin && rulesResponse.items.length ? (
        <Surface><SectionIntro
            eyebrow="Administração"
            title="Editar regras"
            compact
          /><div className="mt-2 grid gap-2">
            {rulesResponse.items.map((item) => (
              <article
                key={item.id}
                id={`rule-${item.id}`}
                className="nds-card"
              ><div className="flex flex-col gap-2 border-b border-white/[0.08] pb-2 md:flex-row md:items-start md:justify-between"><div><div className="text-[12px] font-semibold text-white">{item.code} · {item.name}</div><div className="mt-1 text-[11px] text-slate-400">
                      {optionLabel(detectorOptions, item.detector)} · {optionLabel(cadenceOptions, item.cadence)}
                    </div></div><div className="flex flex-wrap gap-2"><TonePill tone={item.enabled ? "success" : "subtle"}>
                      {item.enabled ? "ativa" : "pausada"}
                    </TonePill><TonePill tone={severityTone(item.severity)}>
                      {optionLabel(severityOptions, item.severity)}
                    </TonePill></div></div><ActionForm
                  action={updateRule}
                  className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-8"
                  noticeClassName="md:col-span-2 xl:col-span-8"
                  submitClassName="md:col-span-2 xl:col-span-8"
                  submitLabel="Salvar regra"
                  pendingLabel="Salvando..."
                  variant="secondary"
                ><input type="hidden" name="id" value={item.id} /><RuleFields prefix={`rule-${item.id}`} defaults={item} /></ActionForm></article>
            ))}
          </div></Surface>
      ) : null}

      <Surface><SectionIntro
          eyebrow="Execuções"
          title="Últimos runs"
          description="Histórico de execução."
          actions={<TonePill tone={failedRuns ? "critical" : "success"}>{failedRuns ? "falhas" : "ok"}</TonePill>}
          compact
        /><div className="mt-2 grid gap-2">
          {runsResponse.items.length ? (
            runsResponse.items.map((run) => (
              <div key={run.id} className="nds-card"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium text-white">{run.rule.code} · {run.rule.name}</div><div className="mt-1 text-[11px] text-slate-400">
                      {formatDateTime(run.startedAt)} · hits {run.hitsCount} · criadas {run.createdCount} · atualizadas {run.updatedCount}
                    </div></div><TonePill tone={runTone(run.status)}>{run.status}</TonePill></div><div className="mt-2 text-[11px] leading-5 text-slate-300">
                  {run.summary || run.errorMessage || "Sem resumo registrado."}
                </div></div>
            ))
          ) : (
            <EmptyState
              title="Nenhum run encontrado"
              description="As próximas execuções das regras aparecerão aqui."
            />
          )}
        </div></Surface></AppShell>
  );
}
