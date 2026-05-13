import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { isAdminRole } from "@/lib/role-policy";
import {
  exceptionQueueLabel,
  exceptionStatusLabel,
  occurrenceSeverityLabel,
} from "@/lib/status-ui";
import { getServerWebSession } from "@/lib/web-session";

type PaginatedResponse<T> = {
  items: T[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type RawSearchParams = Record<string, string | string[] | undefined>;

type PartnerOption = { id: string; code: string; name: string };
type UnitOption = { id: string; code: string; name: string };
type EquipmentOption = { id: string; tag: string; name: string };
type IntegrationOption = { id: string; code: string; name: string; type: string };
type OccurrenceOption = { id: string; code: string; title: string };
type MaintenanceOption = { id: string; code: string; title: string };
type UserOption = { id: string; name: string; email: string; role: string };
type ExceptionSummary = {
  counts: {
    openCount: number;
    criticalCount: number;
    breachedCount: number;
    dueSoonCount: number;
    unassignedCount: number;
    pendingTriageCount: number;
  };
};
type QueueSummary = {
  views: {
    all: number;
    pendingTriage: number;
    breached: number;
    dueSoon: number;
    unassigned: number;
  };
  queues: { queueKey: string; total: number }[];
};

function readParam(params: RawSearchParams, key: string, fallback = "") {
  const value = params[key];
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = asString(formData, key);
  return value || undefined;
}

function defaultQueueKey(kind: string) {
  if (kind === "integration") return "ops-integracoes";
  if (kind === "occurrence") return "ops-ocorrencias";
  if (kind === "maintenance") return "ops-manutencao";
  if (kind === "sla") return "ops-sla";
  if (kind === "automation") return "ops-automacoes";
  return "ops-general";
}

function impactLabel(severity: string) {
  if (severity === "critical") return "Impacto critico";
  if (severity === "high") return "Impacto alto";
  if (severity === "medium") return "Impacto medio";
  return "Impacto baixo";
}

function responseLabel(severity: string) {
  if (severity === "critical") return "5 min resposta / 60 min resolucao";
  if (severity === "high") return "15 min resposta / 120 min resolucao";
  if (severity === "medium") return "30 min resposta / 240 min resolucao";
  return "120 min resposta / 1440 min resolucao";
}

function codeSuggestion() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `EXC-${date}-${time}`;
}

async function createExceptionCase(formData: FormData) {
  "use server";

  const payload = {
    code: optionalString(formData, "code"),
    title: asString(formData, "title"),
    description: optionalString(formData, "description"),
    kind: asString(formData, "kind") || "generic",
    severity: asString(formData, "severity") || "medium",
    status: asString(formData, "status") || "open",
    source: asString(formData, "source") || "manual",
    assigneeUserId: optionalString(formData, "assigneeUserId"),
    silencedUntil: optionalString(formData, "silencedUntil"),
    partnerId: optionalString(formData, "partnerId"),
    unitId: optionalString(formData, "unitId"),
    equipmentId: optionalString(formData, "equipmentId"),
    integrationId: optionalString(formData, "integrationId"),
    occurrenceId: optionalString(formData, "occurrenceId"),
    maintenanceId: optionalString(formData, "maintenanceId"),
  };

  const created = await apiJson<{ id: string }>("/exceptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  revalidatePath("/operacao/excecoes");
  revalidatePath("/operacao");
  revalidatePath("/operacao/fila");
  redirect(`/operacao/excecoes/${created.id}`);
}

function SelectField({
  label,
  name,
  children,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="nova-exception-create-field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue || ""}>
        {children}
      </select>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function TextField({
  label,
  name,
  required,
  defaultValue,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="nova-exception-create-field">
      <span>{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        type={type}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default async function CadastroExcecaoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/operacao/excecoes/cadastro");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/operacao/excecoes");
  }

  const params = searchParams ? await searchParams : {};
  const defaultKind = readParam(params, "kind", "generic");
  const defaultSeverity = readParam(params, "severity", "medium");
  const defaultStatus = readParam(params, "status", "open");
  const defaultSource = readParam(params, "source", "manual");
  const defaultTitle = readParam(params, "title");
  const defaultDescription = readParam(params, "description");
  const defaultPartnerId = readParam(params, "partnerId");
  const defaultUnitId = readParam(params, "unitId");
  const defaultEquipmentId = readParam(params, "equipmentId");
  const defaultIntegrationId = readParam(params, "integrationId");
  const defaultOccurrenceId = readParam(params, "occurrenceId");
  const defaultMaintenanceId = readParam(params, "maintenanceId");

  const [
    partners,
    units,
    equipments,
    integrations,
    occurrences,
    maintenances,
    users,
    summary,
    queueSummary,
  ] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100"),
    apiJson<PaginatedResponse<IntegrationOption>>("/integrations?page=1&pageSize=100"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=100"),
    apiJson<PaginatedResponse<MaintenanceOption>>("/maintenances?page=1&pageSize=100"),
    apiJson<PaginatedResponse<UserOption>>("/users?page=1&pageSize=100"),
    apiJson<ExceptionSummary>("/exceptions/summary"),
    apiJson<QueueSummary>("/exceptions/queue/summary"),
  ]);

  const predictedQueue = defaultQueueKey(defaultKind);
  const activeQueues = queueSummary.queues.filter((item) => item.total > 0).slice(0, 4);
  const loadedLinks =
    Number(Boolean(defaultPartnerId)) +
    Number(Boolean(defaultUnitId)) +
    Number(Boolean(defaultEquipmentId)) +
    Number(Boolean(defaultIntegrationId)) +
    Number(Boolean(defaultOccurrenceId)) +
    Number(Boolean(defaultMaintenanceId));

  return (
    <NovaLitShell activeHref="/operacao/excecoes">
      <div className="nova-lit-page-heading nova-exception-create-heading">
        <div>
          <div className="nova-exception-create-breadcrumb">Operação / Exceções / Cadastro</div>
          <h1>Cadastro de exceção operacional</h1>
          <p className="nova-lit-page-subtitle">
            Registre o desvio, vincule a origem real e envie para a fila com SLA e prioridade calculados.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/operacao/excecoes" className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-primary">Abrir fila</Link>
        </div>
      </div>

      <section className="nova-exception-create-flow" aria-label="Fluxo de criacao da excecao">
        <article>
          <span>1</span>
          <div>
            <strong>Detecção</strong>
            <small>Origem manual, alerta, chamado, integracao ou automacao.</small>
          </div>
        </article>
        <article>
          <span>2</span>
          <div>
            <strong>Análise</strong>
            <small>Classificação, severidade, vínculos e responsável inicial.</small>
          </div>
        </article>
        <article>
          <span>3</span>
          <div>
            <strong>Despacho</strong>
            <small>Entrada na fila, SLA calculado e atividade registrada.</small>
          </div>
        </article>
      </section>

      <section className="nova-exception-create-kpis" aria-label="Indicadores de excecoes">
        <article><span>Abertas</span><strong>{summary.counts.openCount}</strong><small>em tratamento</small></article>
        <article><span>Críticas</span><strong>{summary.counts.criticalCount}</strong><small>prioridade máxima</small></article>
        <article><span>SLA</span><strong>{summary.counts.breachedCount}</strong><small>estouradas</small></article>
        <article><span>Sem dono</span><strong>{summary.counts.unassignedCount}</strong><small>pendentes de atribuição</small></article>
      </section>

      <section className="nova-exception-create-grid">
        <Surface className="nova-exception-create-form-card">
          <SectionIntro
            eyebrow="Cadastro operacional"
            title="Triagem e vínculos"
            description="O backend calcula fila, SLA, impacto, urgência e prioridade usando tipo, severidade, responsável e status."
            compact
          />

          <form action={createExceptionCase} className="nova-exception-create-form">
            <div className="nova-exception-create-fieldset">
              <div>
                <span>Identificação</span>
                <strong>Código, título e evidência</strong>
              </div>
              <small>Código vem sugerido, mas a API também gera automaticamente se vier vazio.</small>
            </div>

            <div className="nova-exception-create-two">
              <TextField
                label="Código"
                name="code"
                defaultValue={codeSuggestion()}
                placeholder={codeSuggestion()}
                hint="Único por exceção."
              />
              <TextField
                label="Título"
                name="title"
                required
                defaultValue={defaultTitle}
                placeholder="SLA pressionando, alerta crítico, chamado sem dono..."
              />
            </div>

            <label className="nova-exception-create-field">
              <span>Descrição</span>
              <textarea
                name="description"
                rows={4}
                defaultValue={defaultDescription}
                placeholder="Registre motivo, hipótese, impacto, evidência e próximo passo."
              />
            </label>

            <div className="nova-exception-create-fieldset">
              <div>
                <span>Decisão inicial</span>
                <strong>Tipo, severidade e SLA</strong>
              </div>
              <small>{exceptionQueueLabel(predictedQueue)} · {responseLabel(defaultSeverity)}</small>
            </div>

            <div className="nova-exception-create-four">
              <SelectField label="Tipo" name="kind" defaultValue={defaultKind}>
                <option value="generic">Geral</option>
                <option value="sla">SLA</option>
                <option value="integration">Integração</option>
                <option value="occurrence">Alerta</option>
                <option value="maintenance">Chamado</option>
                <option value="automation">Automação</option>
              </SelectField>

              <SelectField label="Severidade" name="severity" defaultValue={defaultSeverity}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </SelectField>

              <SelectField label="Status" name="status" defaultValue={defaultStatus}>
                <option value="open">Aberta</option>
                <option value="acknowledged">Reconhecida</option>
                <option value="resolved">Resolvida</option>
                <option value="silenced">Silenciada</option>
              </SelectField>

              <TextField
                label="Origem"
                name="source"
                defaultValue={defaultSource}
                placeholder="manual, automation, noc..."
              />
            </div>

            <div className="nova-exception-create-two">
              <SelectField label="Responsável" name="assigneeUserId" hint={`${users.items.length} usuario(s)`}>
                <option value="">Sem responsável</option>
                {users.items.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </SelectField>

              <TextField label="Silenciar até" name="silencedUntil" type="datetime-local" />
            </div>

            <div className="nova-exception-create-fieldset">
              <div>
                <span>Vínculos</span>
                <strong>Origem e contexto do caso</strong>
              </div>
              <small>{loadedLinks ? `${loadedLinks} vínculo(s) pré-carregado(s)` : "sem vínculo pré-carregado"}</small>
            </div>

            <div className="nova-exception-create-three">
              <SelectField label="Parceiro" name="partnerId" defaultValue={defaultPartnerId} hint={`${partners.items.length} parceiro(s)`}>
                <option value="">Sem parceiro direto</option>
                {partners.items.map((partner) => (
                  <option key={partner.id} value={partner.id}>{partner.code} - {partner.name}</option>
                ))}
              </SelectField>

              <SelectField label="Unidade" name="unitId" defaultValue={defaultUnitId} hint={`${units.items.length} unidade(s)`}>
                <option value="">Sem unidade direta</option>
                {units.items.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
                ))}
              </SelectField>

              <SelectField label="Ativo" name="equipmentId" defaultValue={defaultEquipmentId} hint={`${equipments.items.length} ativo(s)`}>
                <option value="">Sem ativo direto</option>
                {equipments.items.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>{equipment.tag} - {equipment.name}</option>
                ))}
              </SelectField>

              <SelectField label="Integração" name="integrationId" defaultValue={defaultIntegrationId} hint={`${integrations.items.length} integração(ões)`}>
                <option value="">Sem integração</option>
                {integrations.items.map((integration) => (
                  <option key={integration.id} value={integration.id}>{integration.code} - {integration.name}</option>
                ))}
              </SelectField>

              <SelectField label="Alerta" name="occurrenceId" defaultValue={defaultOccurrenceId} hint={`${occurrences.items.length} alerta(s)`}>
                <option value="">Sem alerta</option>
                {occurrences.items.map((occurrence) => (
                  <option key={occurrence.id} value={occurrence.id}>{occurrence.code} - {occurrence.title}</option>
                ))}
              </SelectField>

              <SelectField label="Chamado" name="maintenanceId" defaultValue={defaultMaintenanceId} hint={`${maintenances.items.length} chamado(s)`}>
                <option value="">Sem chamado</option>
                {maintenances.items.map((maintenance) => (
                  <option key={maintenance.id} value={maintenance.id}>{maintenance.code} - {maintenance.title}</option>
                ))}
              </SelectField>
            </div>

            <div className="nova-exception-create-actions">
              <button type="submit" className="nova-lit-button nova-lit-button-primary">
                Cadastrar exceção
              </button>
              <Link href="/operacao/excecoes" className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-exception-create-side">
          <section className="nova-lit-card nova-exception-create-queue-card">
            <div className="nova-lit-title-row">
              <h2>Entrada na fila</h2>
              <TonePill tone="attention">triagem</TonePill>
            </div>
            <div className="nova-exception-create-flow-list">
              <article><span>Fila prevista</span><strong>{exceptionQueueLabel(predictedQueue)}</strong></article>
              <article><span>Status inicial</span><strong>{exceptionStatusLabel(defaultStatus)}</strong></article>
              <article><span>Severidade</span><strong>{occurrenceSeverityLabel(defaultSeverity)}</strong></article>
              <article><span>Impacto</span><strong>{impactLabel(defaultSeverity)}</strong></article>
            </div>
          </section>

          <section className="nova-lit-card nova-exception-create-quick">
            <span>Continuidade</span>
            <Link href="/operacao/fila">Fila <b>{queueSummary.views.all}</b></Link>
            <Link href="/alertas">Alertas <b>{occurrences.items.length}</b></Link>
            <Link href="/chamados">Chamados <b>{maintenances.items.length}</b></Link>
            <Link href="/integracoes">Integrações <b>{integrations.items.length}</b></Link>
          </section>

          <section className="nova-lit-card nova-exception-create-queues">
            <div className="nova-lit-title-row">
              <h2>Filas ativas</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">{queueSummary.queues.length}</span>
            </div>
            <div className="nova-exception-create-queue-list">
              {activeQueues.length ? activeQueues.map((queue) => (
                <Link key={queue.queueKey} href={`/operacao/fila?queueKey=${encodeURIComponent(queue.queueKey)}`}>
                  <strong>{exceptionQueueLabel(queue.queueKey)}</strong>
                  <b>{queue.total}</b>
                </Link>
              )) : (
                <div>Nenhuma fila ativa agora.</div>
              )}
            </div>
          </section>

          <section className="nova-lit-card nova-exception-create-practice">
            <div className="nova-lit-title-row">
              <h2>Critério de abertura</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">NOC</span>
            </div>
            <p>
              Use exceção quando o caso precisa entrar na fila de triagem,
              ganhar SLA, responsável e prioridade visível para o turno.
            </p>
            <div>
              <span>{summary.counts.pendingTriageCount}</span>
              <small>aguardando triagem</small>
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
