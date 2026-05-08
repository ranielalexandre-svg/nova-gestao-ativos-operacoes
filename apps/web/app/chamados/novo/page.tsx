import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { SectionIntro, Surface, TonePill } from "@/components/ops-ui";
import { apiJson } from "@/lib/server-api";
import { getServerWebSession } from "@/lib/web-session";
import { isAdminRole } from "@/lib/role-policy";

type PaginatedResponse<T> = {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type PartnerOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

type EquipmentOption = {
  id: string;
  tag: string;
  name: string;
};

type OccurrenceOption = {
  id: string;
  code: string;
  title: string;
};

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = asString(formData, key);
  return value || undefined;
}

async function createChamado(formData: FormData) {
  "use server";

  const payload = {
    code: asString(formData, "code"),
    title: asString(formData, "title"),
    description: optionalString(formData, "description"),
    type: asString(formData, "type") || "corrective",
    status: asString(formData, "status") || "planned",
    scheduledAt: optionalString(formData, "scheduledAt"),
    completedAt: optionalString(formData, "completedAt"),
    partnerId: optionalString(formData, "partnerId"),
    unitId: optionalString(formData, "unitId"),
    equipmentId: optionalString(formData, "equipmentId"),
    occurrenceId: optionalString(formData, "occurrenceId"),
  };

  await apiJson("/maintenances", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  revalidatePath("/chamados");
  revalidatePath("/manutencoes");
  redirect("/chamados");
}

function SelectField({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="nova-tickets-field">
      <span>{label}</span>
      <select name={name}>
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
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="nova-tickets-field">
      <span>{label}</span>
      <input name={name} required={required} placeholder={placeholder} type={type} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default async function NovoChamadoPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/chamados/novo");
  }

  const isAdmin = isAdminRole(session.user?.role || "");

  if (!isAdmin) {
    redirect("/chamados");
  }

  const [partners, units, equipments, occurrences] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=200"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=300"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=300"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=200"),
  ]);

  const today = new Date();
  const codeSuggestion = `CH-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  return (
    <NovaLitShell activeHref="/chamados">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Novo chamado</h1>
          <p className="nova-lit-page-subtitle">
            Cadastre uma ação técnica vinculada a parceiro, unidade, ativo ou alerta.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/chamados" className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/operacao/fila?view=dueSoon" className="nova-lit-button nova-lit-button-primary">Ver fila</Link>
        </div>
      </div>

      <section className="nova-tickets-main-grid">
        <Surface>
          <SectionIntro
            eyebrow="Cadastro"
            title="Dados do chamado"
            description="Use código único, tipo, status e vínculo operacional para colocar a demanda na agenda técnica."
            compact
          />

          <form action={createChamado} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Código"
                name="code"
                required
                placeholder={`${codeSuggestion}-001`}
                hint="Deve ser único. Ex.: CH-20260507-001"
              />
              <TextField
                label="Título"
                name="title"
                required
                placeholder="Troca de ONU, vistoria, recuperação de link..."
              />
            </div>

            <label className="nova-tickets-field">
              <span>Descrição</span>
              <textarea
                name="description"
                rows={5}
                placeholder="Descreva o contexto, sintoma, evidência, SLA ou instrução de campo."
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Tipo" name="type">
                <option value="corrective">Corretiva</option>
                <option value="preventive">Preventiva</option>
                <option value="inspection">Inspeção</option>
              </SelectField>

              <SelectField label="Status" name="status">
                <option value="planned">Planejado</option>
                <option value="in_progress">Em execução</option>
                <option value="done">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </SelectField>

              <TextField label="Agendada para" name="scheduledAt" type="datetime-local" />
              <TextField label="Concluída em" name="completedAt" type="datetime-local" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Parceiro" name="partnerId" hint={`${partners.items.length} parceiro(s) carregado(s)`}>
                <option value="">Sem parceiro direto</option>
                {partners.items.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Unidade" name="unitId" hint={`${units.items.length} unidade(s) carregada(s)`}>
                <option value="">Sem unidade direta</option>
                {units.items.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Ativo" name="equipmentId" hint={`${equipments.items.length} ativo(s) carregado(s)`}>
                <option value="">Sem ativo direto</option>
                {equipments.items.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.tag} - {equipment.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Alerta originador" name="occurrenceId" hint={`${occurrences.items.length} alerta(s) carregado(s)`}>
                <option value="">Sem alerta originador</option>
                {occurrences.items.map((occurrence) => (
                  <option key={occurrence.id} value={occurrence.id}>
                    {occurrence.code} - {occurrence.title}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="submit" className="nova-lit-button nova-lit-button-primary">
                Criar chamado
              </button>
              <Link href="/chamados" className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Como usar</h2>
              <TonePill tone="info">agenda</TonePill>
            </div>
            <div className="nova-tickets-status-list">
              <article>
                <strong>Corretiva</strong>
                <b>incidente</b>
              </article>
              <article>
                <strong>Preventiva</strong>
                <b>rotina</b>
              </article>
              <article>
                <strong>Inspeção</strong>
                <b>vistoria</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Continuidade</span>
            <Link href="/alertas">Alertas <b>{occurrences.items.length}</b></Link>
            <Link href="/unidades">Unidades <b>{units.items.length}</b></Link>
            <Link href="/ativos">Ativos <b>{equipments.items.length}</b></Link>
          </section>

          <section className="nova-lit-card nova-tickets-priority">
            <div className="nova-lit-title-row">
              <h2>Boas práticas</h2>
              <span className="nova-lit-pill nova-lit-pill-blue">NOC</span>
            </div>
            <div className="nova-tickets-priority-list">
              <div className="nova-tickets-list-empty">
                Vincule unidade ou ativo sempre que possível. Isso permite abrir o histórico pelo detalhe e cruzar com fila, host monitorado e alertas.
              </div>
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
