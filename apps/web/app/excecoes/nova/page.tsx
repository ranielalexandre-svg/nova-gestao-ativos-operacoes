import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { isAdminRole } from "@/lib/role-policy";
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
type OccurrenceOption = { id: string; code: string; title: string };
type MaintenanceOption = { id: string; code: string; title: string };
type UserOption = { id: string; name: string; email: string; role: string };

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

async function createExceptionCase(formData: FormData) {
  "use server";

  const payload = {
    code: asString(formData, "code"),
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
    occurrenceId: optionalString(formData, "occurrenceId"),
    maintenanceId: optionalString(formData, "maintenanceId"),
  };

  const created = await apiJson<{ id: string }>("/exceptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  revalidatePath("/excecoes");
  revalidatePath("/operacao");
  revalidatePath("/operacao/fila");
  redirect(`/excecoes/${created.id}`);
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
    <label className="nova-tickets-field">
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
    <label className="nova-tickets-field">
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

export default async function NovaExcecaoPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/excecoes/nova");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/excecoes");
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
  const defaultOccurrenceId = readParam(params, "occurrenceId");
  const defaultMaintenanceId = readParam(params, "maintenanceId");

  const [partners, units, equipments, occurrences, maintenances, users] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=100"),
    apiJson<PaginatedResponse<MaintenanceOption>>("/maintenances?page=1&pageSize=100"),
    apiJson<PaginatedResponse<UserOption>>("/users?page=1&pageSize=100"),
  ]);

  const today = new Date();
  const codeSuggestion = `EXC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  return (
    <NovaLitShell activeHref="/excecoes">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Nova exceção</h1>
          <p className="nova-lit-page-subtitle">
            Envie alerta, chamado, integração ou caso manual para a fila operacional com SLA, prioridade e triagem.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/excecoes" className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/operacao/fila" className="nova-lit-button nova-lit-button-primary">Fila</Link>
        </div>
      </div>

      <section className="nova-tickets-main-grid">
        <Surface>
          <SectionIntro
            eyebrow="Cadastro"
            title="Dados da exceção"
            description="A exceção é o item que entra na fila. Ela pode nascer de alerta, chamado, automação, integração ou decisão manual."
            compact
          />

          <form action={createExceptionCase} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Código"
                name="code"
                required
                placeholder={`${codeSuggestion}-001`}
                hint="Deve ser único. Ex.: EXC-20260508-001"
              />
              <TextField
                label="Título"
                name="title"
                required
                defaultValue={defaultTitle}
                placeholder="SLA pressionando, alerta crítico, chamado sem dono..."
              />
            </div>

            <label className="nova-tickets-field">
              <span>Descrição</span>
              <textarea
                name="description"
                rows={5}
                defaultValue={defaultDescription}
                placeholder="Registre o motivo da exceção, hipótese, impacto, evidência ou próximo passo."
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Responsável" name="assigneeUserId" hint={`${users.items.length} usuário(s) carregado(s)`}>
                <option value="">Sem responsável</option>
                {users.items.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </SelectField>

              <TextField label="Silenciar até" name="silencedUntil" type="datetime-local" />

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

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="submit" className="nova-lit-button nova-lit-button-primary">
                Criar exceção
              </button>
              <Link href="/excecoes" className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Como entra na fila</h2>
              <TonePill tone="attention">triagem</TonePill>
            </div>
            <div className="nova-tickets-status-list">
              <article><strong>Alerta</strong><b>incidente</b></article>
              <article><strong>Chamado</strong><b>execução</b></article>
              <article><strong>SLA</strong><b>prazo</b></article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Continuidade</span>
            <Link href="/operacao/fila">Fila <b>despacho</b></Link>
            <Link href="/alertas">Alertas <b>{occurrences.items.length}</b></Link>
            <Link href="/chamados">Chamados <b>{maintenances.items.length}</b></Link>
          </section>

          <section className="nova-lit-card nova-tickets-priority">
            <div className="nova-lit-title-row">
              <h2>Boas práticas</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">NOC</span>
            </div>
            <div className="nova-tickets-priority-list">
              <div className="nova-tickets-list-empty">
                Use exceção quando o caso precisa entrar na fila de triagem, ganhar SLA, responsável e prioridade visível para o turno.
              </div>
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
