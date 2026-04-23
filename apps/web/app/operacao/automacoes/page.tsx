import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  SectionIntro,
  Surface,
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
  { value: "maintenance_overdue", label: "Manutenção vencida" },
  { value: "critical_open_occurrence", label: "Ocorrência crítica aberta" },
  { value: "integration_failure", label: "Falha de integração" },
  { value: "aged_open_occurrence", label: "Ocorrência antiga aberta" },
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

function FieldLabel({
  htmlFor,
  label,
}: {
  htmlFor: string;
  label: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
      {label}
    </label>
  );
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function severityTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "neutral";
}

function runTone(value: string) {
  if (value === "success") return "success";
  if (value === "error") return "critical";
  return "attention";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RuleFields({
  prefix,
  defaults,
}: {
  prefix: string;
  defaults?: Partial<RuleRow>;
}) {
  return (
    <>
      <div className="grid gap-2 xl:col-span-2">
        <FieldLabel htmlFor={`${prefix}-name`} label="Nome" />
        <input
          id={`${prefix}-name`}
          name="name"
          defaultValue={defaults?.name || ""}
          placeholder="Regra operacional"
          className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
        />
      </div>

      <div className="grid gap-2 xl:col-span-2">
        <FieldLabel htmlFor={`${prefix}-detector`} label="Detector" />
        <select
          id={`${prefix}-detector`}
          name="detector"
          defaultValue={defaults?.detector || "maintenance_overdue"}
          className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
        >
          {detectorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor={`${prefix}-severity`} label="Severidade" />
        <select
          id={`${prefix}-severity`}
          name="severity"
          defaultValue={defaults?.severity || "high"}
          className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
        >
          {severityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor={`${prefix}-cadence`} label="Cadência" />
        <select
          id={`${prefix}-cadence`}
          name="cadence"
          defaultValue={defaults?.cadence || "every_5_minutes"}
          className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
        >
          {cadenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor={`${prefix}-threshold`} label="Limite min." />
        <input
          id={`${prefix}-threshold`}
          name="thresholdMinutes"
          type="number"
          min="1"
          defaultValue={defaults?.thresholdMinutes ?? ""}
          placeholder="30"
          className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
        />
      </div>

      <div className="grid gap-2 md:col-span-2 xl:col-span-8">
        <FieldLabel htmlFor={`${prefix}-flags`} label="Efeitos" />
        <div id={`${prefix}-flags`} className="grid gap-3 rounded-[14px] border border-white/10 bg-black/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="enabled" defaultChecked={defaults?.enabled ?? true} className="h-4 w-4 rounded border-white/20 bg-[#111318]" />
            Regra ativa
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="createExceptions" defaultChecked={defaults?.createExceptions ?? true} className="h-4 w-4 rounded border-white/20 bg-[#111318]" />
            Criar exceções
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="createActivities" defaultChecked={defaults?.createActivities ?? true} className="h-4 w-4 rounded border-white/20 bg-[#111318]" />
            Criar atividades
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="resolveOnRecovery" defaultChecked={defaults?.resolveOnRecovery ?? true} className="h-4 w-4 rounded border-white/20 bg-[#111318]" />
            Resolver na recuperação
          </label>
        </div>
      </div>
    </>
  );
}

export default async function AutomacoesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/operacao/automacoes");
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

      revalidatePath("/operacao/automacoes");
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
    >
      <RegistryHero
        eyebrow="Automation Desk"
        title="Regras operacionais com histórico separado"
        description="A mesa principal mostra o que está ativo e quando roda. Criação e edição aparecem no mesmo fluxo para reduzir ruído e manter a leitura previsível."
      />

      <RegistrySummaryStrip
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
      />

      <OperationsLinkGrid
        title="Trilho operacional das regras"
        description="Automações não vivem sozinhas: elas alimentam backlog, atividade, monitoramento e integrações. O atalho útil é o que explica efeito, não o que duplica tela."
        links={[
          {
            href: "/operacao/excecoes",
            title: "Exceções",
            description: "Veja os casos criados ou influenciados por regra e detector.",
            badge: <TonePill tone={creatingExceptions ? "attention" : "neutral"}>{creatingExceptions} geram caso</TonePill>,
          },
          {
            href: "/operacao/atividade",
            title: "Atividade",
            description: "Runs, notas e ações humanas amarradas à trilha do turno.",
            badge: <TonePill tone="info">{hits} hits</TonePill>,
          },
          {
            href: "/monitoramento",
            title: "Monitoramento",
            description: "Host, sensor e unidade para decidir se a regra faz sentido no contexto real.",
            badge: <TonePill tone="success">host e sensor</TonePill>,
          },
          {
            href: "/integracoes",
            title: "Integrações",
            description: "Conectores e testes quando a origem do sinal não está saudável.",
            badge: <TonePill tone={failedRuns ? "critical" : "neutral"}>{failedRuns} falha(s)</TonePill>,
          },
        ]}
      />

      <OperationsGuidanceGrid
        title="Como revisar regra sem perder o contexto"
        description="A mesa de automações fica administrativa, mas o ajuste bom nasce da leitura do efeito real sobre o turno."
        items={[
          {
            label: "Detectar",
            title: "Leia detector, severidade e cadência juntos",
            description: "A combinação entre detector, janela de execução e limiar define se a regra ajuda ou vira ruído operacional.",
            tone: "info",
          },
          {
            label: "Observar",
            title: "Use os últimos runs como prova",
            description: "Antes de mexer, olhe hits, erros e criação de casos para saber se o comportamento real bate com a intenção da regra.",
            tone: "attention",
          },
          {
            label: "Amarrar",
            title: "A regra precisa conversar com backlog e trilha",
            description: "Se ela abre exceção ou atividade, a navegação para Exceções e Atividade deve continuar curta e previsível.",
            tone: "success",
          },
        ]}
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Refine detector e estado"
          description="Busca por código, nome ou detector. A URL guarda o recorte para voltar rapidamente à mesma visão."
          actions={
            <Link
              href="/operacao/automacoes"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="automation-q" label="Busca" />
            <input
              id="automation-q"
              name="q"
              defaultValue={q}
              placeholder="Código, nome ou detector"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="automation-detector" label="Detector" />
            <select
              id="automation-detector"
              name="detector"
              defaultValue={detector}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos os detectores</option>
              {detectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="automation-enabled" label="Estado" />
            <select
              id="automation-enabled"
              name="enabled"
              defaultValue={enabled}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos</option>
              <option value="true">Ativas</option>
              <option value="false">Pausadas</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="automation-sort-by" label="Ordenar por" />
            <select
              id="automation-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="code">Código</option>
              <option value="name">Nome</option>
              <option value="detector">Detector</option>
              <option value="severity">Severidade</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="automation-sort-dir" label="Direção" />
            <select
              id="automation-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2 xl:col-span-2">
            <FieldLabel htmlFor="automation-page-size" label="Página" />
            <select
              id="automation-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="10">10 por página</option>
              <option value="20">20 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>

          <button className="rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-95 md:col-span-2 xl:col-span-4">
            Aplicar filtros
          </button>
        </form>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Regras"
          title="Automações cadastradas"
          description={`${rulesResponse.meta.total} regra(s) encontradas nesta visão.`}
          actions={<TonePill tone="neutral">{rulesResponse.items.length} linhas</TonePill>}
          compact
        />

        <div className="mt-5">
          {rulesResponse.items.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Regra</th>
                    <th className="px-4 py-3">Detector</th>
                    <th className="px-4 py-3">Sev.</th>
                    <th className="px-4 py-3">Cadência</th>
                    <th className="px-4 py-3">Efeitos</th>
                    <th className="px-4 py-3">Próxima</th>
                    <th className="px-4 py-3 text-right">Ajuste</th>
                  </tr>
                </TableHead>
                <tbody>
                  {rulesResponse.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    >
                      <TableCell>
                        <div className="font-medium text-white">{item.code} · {item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item._count.runs} runs · {item._count.exceptionCases} exceções
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {optionLabel(detectorOptions, item.detector)}
                      </TableCell>
                      <TableCell>
                        <TonePill tone={severityTone(item.severity)}>
                          {optionLabel(severityOptions, item.severity)}
                        </TonePill>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {optionLabel(cadenceOptions, item.cadence)}
                        <div className="mt-1 text-xs text-slate-500">
                          limite {item.thresholdMinutes ?? "-"} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <TonePill tone={item.enabled ? "success" : "subtle"}>
                            {item.enabled ? "ativa" : "pausada"}
                          </TonePill>
                          {item.createExceptions ? <TonePill tone="attention">exceções</TonePill> : null}
                          {item.createActivities ? <TonePill tone="info">atividades</TonePill> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-slate-300">{formatDateTime(item.nextRunAt)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          última {formatDateTime(item.lastRunAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`#rule-${item.id}`}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          Ajustar regra
                        </a>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </DenseTable>
            </TableShell>
          ) : (
            <EmptyState
              title="Nenhuma regra encontrada"
              description="Ajuste os filtros ou limpe a busca para voltar à base completa."
              action={
                <Link
                  href="/operacao/automacoes"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div>
      </Surface>

      <ListPagination
        pathname="/operacao/automacoes"
        searchParams={params}
        meta={rulesResponse.meta}
      />

      {isAdmin && rulesResponse.items.length ? (
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Administração"
            title="Editar regras"
            description="As regras ficam expostas como blocos reais para manutenção direta, sem atalhos secundários."
            compact
          />

          <div className="mt-5 grid gap-4">
            {rulesResponse.items.map((item) => (
              <article
                key={item.id}
                id={`rule-${item.id}`}
                className="rounded-[18px] border border-white/[0.08] bg-[#0a0f15] p-4"
              >
                <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">{item.code} · {item.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {optionLabel(detectorOptions, item.detector)} · {optionLabel(cadenceOptions, item.cadence)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TonePill tone={item.enabled ? "success" : "subtle"}>
                      {item.enabled ? "ativa" : "pausada"}
                    </TonePill>
                    <TonePill tone={severityTone(item.severity)}>
                      {optionLabel(severityOptions, item.severity)}
                    </TonePill>
                  </div>
                </div>

                <ActionForm
                  action={updateRule}
                  className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8"
                  noticeClassName="md:col-span-2 xl:col-span-8"
                  submitClassName="md:col-span-2 xl:col-span-8"
                  submitLabel="Salvar regra"
                  pendingLabel="Salvando..."
                  variant="secondary"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <RuleFields prefix={`rule-${item.id}`} defaults={item} />
                </ActionForm>
              </article>
            ))}
          </div>
        </Surface>
      ) : null}

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Execuções"
          title="Últimos runs"
          description="Histórico curto para confirmar se as regras estão encontrando casos e criando efeito operacional."
          actions={<TonePill tone={failedRuns ? "critical" : "success"}>{failedRuns ? "falhas" : "ok"}</TonePill>}
          compact
        />

        <div className="mt-5 grid gap-3">
          {runsResponse.items.length ? (
            runsResponse.items.map((run) => (
              <div key={run.id} className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{run.rule.code} · {run.rule.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatDateTime(run.startedAt)} · hits {run.hitsCount} · criadas {run.createdCount} · atualizadas {run.updatedCount}
                    </div>
                  </div>
                  <TonePill tone={runTone(run.status)}>{run.status}</TonePill>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  {run.summary || run.errorMessage || "Sem resumo registrado."}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="Nenhum run encontrado"
              description="As próximas execuções das regras aparecerão aqui."
            />
          )}
        </div>
      </Surface>
    </AppShell>
  );
}
