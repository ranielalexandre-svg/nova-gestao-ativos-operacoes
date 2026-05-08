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

type OccurrenceDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  partner: PartnerOption | null;
  unit: UnitOption | null;
  equipment: EquipmentOption | null;
};

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function updateAlerta(id: string, formData: FormData) {
  "use server";

  const payload = {
    code: asString(formData, "code"),
    title: asString(formData, "title"),
    description: asString(formData, "description"),
    severity: asString(formData, "severity") || "medium",
    status: asString(formData, "status") || "open",
    source: asString(formData, "source"),
    partnerId: asString(formData, "partnerId"),
    unitId: asString(formData, "unitId"),
    equipmentId: asString(formData, "equipmentId"),
  };

  await apiJson(`/occurrences/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  revalidatePath("/alertas");
  revalidatePath(`/alertas/${id}`);
  revalidatePath(`/ocorrencias/${id}`);
  redirect(`/alertas/${id}`);
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
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="nova-tickets-field">
      <span>{label}</span>
      <input name={name} required={required} defaultValue={defaultValue || ""} placeholder={placeholder} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default async function EditarAlertaPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/alertas");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/alertas");
  }

  const resolved = await params;

  const [alerta, partners, units, equipments] = await Promise.all([
    apiJson<OccurrenceDetail>(`/occurrences/${resolved.id}`),
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=200"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=300"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=300"),
  ]);

  const action = updateAlerta.bind(null, alerta.id);

  return (
    <NovaLitShell activeHref="/alertas">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Editar alerta</h1>
          <p className="nova-lit-page-subtitle">
            Atualize severidade, status e vínculo operacional do alerta.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href={`/alertas/${alerta.id}`} className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/alertas" className="nova-lit-button nova-lit-button-primary">Lista</Link>
        </div>
      </div>

      <section className="nova-tickets-main-grid">
        <Surface>
          <SectionIntro
            eyebrow="Edição"
            title={alerta.code}
            description="O alerta continua como ocorrência operacional, mas agora pode ser ajustado em tela dedicada."
            compact
          />

          <form action={action} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Código" name="code" required defaultValue={alerta.code} />
              <TextField label="Título" name="title" required defaultValue={alerta.title} />
            </div>

            <label className="nova-tickets-field">
              <span>Descrição</span>
              <textarea name="description" rows={5} defaultValue={alerta.description || ""} />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Severidade" name="severity" defaultValue={alerta.severity}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </SelectField>

              <SelectField label="Status" name="status" defaultValue={alerta.status}>
                <option value="open">Aberto</option>
                <option value="investigating">Em investigação</option>
                <option value="resolved">Resolvido</option>
                <option value="cancelled">Cancelado</option>
              </SelectField>

              <TextField label="Origem" name="source" defaultValue={alerta.source} placeholder="NOC, Zabbix, campo..." />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Parceiro" name="partnerId" defaultValue={alerta.partner?.id} hint={`${partners.items.length} parceiro(s) carregado(s)`}>
                <option value="">Sem parceiro direto</option>
                {partners.items.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Unidade" name="unitId" defaultValue={alerta.unit?.id} hint={`${units.items.length} unidade(s) carregada(s)`}>
                <option value="">Sem unidade direta</option>
                {units.items.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </SelectField>

              <SelectField label="Ativo" name="equipmentId" defaultValue={alerta.equipment?.id} hint={`${equipments.items.length} ativo(s) carregado(s)`}>
                <option value="">Sem ativo direto</option>
                {equipments.items.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.tag} - {equipment.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="submit" className="nova-lit-button nova-lit-button-primary">
                Salvar alerta
              </button>
              <Link href={`/alertas/${alerta.id}`} className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Estado atual</h2>
              <TonePill tone="info">alerta</TonePill>
            </div>
            <div className="nova-tickets-status-list">
              <article>
                <strong>Severidade</strong>
                <b>{alerta.severity}</b>
              </article>
              <article>
                <strong>Status</strong>
                <b>{alerta.status}</b>
              </article>
              <article>
                <strong>Origem</strong>
                <b>{alerta.source || "-"}</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Vínculos</span>
            <Link href={alerta.unit ? `/unidades/${alerta.unit.id}` : "/unidades"}>Unidade <b>{alerta.unit?.code || "-"}</b></Link>
            <Link href={alerta.equipment ? `/ativos/${alerta.equipment.id}` : "/ativos"}>Ativo <b>{alerta.equipment?.tag || "-"}</b></Link>
            <Link href="/chamados">Chamados <b>agenda</b></Link>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
