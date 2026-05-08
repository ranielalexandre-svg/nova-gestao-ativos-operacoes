import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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

type PartnerOption = { id: string; code: string; name: string };
type UnitOption = { id: string; code: string; name: string };
type EquipmentOption = { id: string; tag: string; name: string };
type OccurrenceOption = { id: string; code: string; title: string };

type MaintenanceDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
  occurrence: (OccurrenceOption & { severity?: string; status?: string }) | null;
};

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function toInputDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

async function updateChamado(id: string, formData: FormData) {
  "use server";

  const payload = {
    code: asString(formData, "code"),
    title: asString(formData, "title"),
    description: asString(formData, "description"),
    type: asString(formData, "type") || "corrective",
    status: asString(formData, "status") || "planned",
    scheduledAt: asString(formData, "scheduledAt"),
    completedAt: asString(formData, "completedAt"),
    partnerId: asString(formData, "partnerId"),
    unitId: asString(formData, "unitId"),
    equipmentId: asString(formData, "equipmentId"),
    occurrenceId: asString(formData, "occurrenceId"),
  };

  await apiJson(`/maintenances/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  revalidatePath("/chamados");
  revalidatePath(`/chamados/${id}`);
  revalidatePath(`/manutencoes/${id}`);
  redirect(`/chamados/${id}`);
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: ReactNode;
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
  defaultValue,
  required,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="nova-tickets-field">
      <span>{label}</span>
      <input name={name} required={required} defaultValue={defaultValue || ""} placeholder={placeholder} type={type} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default async function EditarChamadoPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/chamados");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/chamados");
  }

  const resolved = await params;

  const [chamado, partners, units, equipments, occurrences] = await Promise.all([
    apiJson<MaintenanceDetail>(`/maintenances/${resolved.id}`),
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=200"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=300"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=300"),
    apiJson<PaginatedResponse<OccurrenceOption>>("/occurrences?page=1&pageSize=200"),
  ]);

  const action = updateChamado.bind(null, chamado.id);

  return (
    <NovaLitShell activeHref="/chamados">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Editar chamado</h1>
          <p className="nova-lit-page-subtitle">
            Atualize agenda, status e vínculo operacional do chamado.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href={`/chamados/${chamado.id}`} className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/chamados" className="nova-lit-button nova-lit-button-primary">Lista</Link>
        </div>
      </div>

      <section className="nova-tickets-main-grid">
        <Surface>
          <SectionIntro
            eyebrow="Edição"
            title={chamado.code}
            description="O chamado continua na agenda técnica, mas agora pode ser ajustado em tela dedicada."
            compact
          />

          <form action={action} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Código" name="code" required defaultValue={chamado.code} />
              <TextField label="Título" name="title" required defaultValue={chamado.title} />
            </div>

            <label className="nova-tickets-field">
              <span>Descrição</span>
              <textarea name="description" rows={5} defaultValue={chamado.description || ""} />
            </label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Tipo" name="type" defaultValue={chamado.type}>
                <option value="corrective">Corretiva</option>
                <option value="preventive">Preventiva</option>
                <option value="inspection">Inspeção</option>
              </SelectField>

              <SelectField label="Status" name="status" defaultValue={chamado.status}>
                <option value="planned">Planejado</option>
                <option value="in_progress">Em execução</option>
                <option value="done">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </SelectField>

              <TextField label="Agendada para" name="scheduledAt" type="datetime-local" defaultValue={toInputDateTime(chamado.scheduledAt)} />
              <TextField label="Concluída em" name="completedAt" type="datetime-local" defaultValue={toInputDateTime(chamado.completedAt)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Parceiro" name="partnerId" defaultValue={chamado.partner?.id} hint={`${partners.items.length} parceiro(s) carregado(s)`}>
                <option value="">Sem parceiro direto</option>
                {partners.items.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Unidade" name="unitId" defaultValue={chamado.unit?.id} hint={`${units.items.length} unidade(s) carregada(s)`}>
                <option value="">Sem unidade direta</option>
                {units.items.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Ativo" name="equipmentId" defaultValue={chamado.equipment?.id} hint={`${equipments.items.length} ativo(s) carregado(s)`}>
                <option value="">Sem ativo direto</option>
                {equipments.items.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.tag} - {equipment.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Alerta originador" name="occurrenceId" defaultValue={chamado.occurrence?.id} hint={`${occurrences.items.length} alerta(s) carregado(s)`}>
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
                Salvar chamado
              </button>
              <Link href={`/chamados/${chamado.id}`} className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Estado atual</h2>
              <TonePill tone="info">chamado</TonePill>
            </div>
            <div className="nova-tickets-status-list">
              <article>
                <strong>Tipo</strong>
                <b>{chamado.type}</b>
              </article>
              <article>
                <strong>Status</strong>
                <b>{chamado.status}</b>
              </article>
              <article>
                <strong>Alerta</strong>
                <b>{chamado.occurrence?.code || "-"}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Vínculos</span>
            <Link href={chamado.unit ? `/unidades/${chamado.unit.id}` : "/unidades"}>Unidade <b>{chamado.unit?.code || "-"}</b></Link>
            <Link href={chamado.equipment ? `/ativos/${chamado.equipment.id}` : "/ativos"}>Ativo <b>{chamado.equipment?.tag || "-"}</b></Link>
            <Link href={chamado.occurrence ? `/alertas/${chamado.occurrence.id}` : "/alertas"}>Alerta <b>{chamado.occurrence?.code || "-"}</b></Link>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
