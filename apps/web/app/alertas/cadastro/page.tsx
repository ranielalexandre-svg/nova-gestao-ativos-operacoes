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

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = asString(formData, key);
  return value || undefined;
}

async function createAlerta(formData: FormData) {
  "use server";

  const payload = {
    code: asString(formData, "code"),
    title: asString(formData, "title"),
    description: optionalString(formData, "description"),
    severity: asString(formData, "severity") || "medium",
    status: asString(formData, "status") || "open",
    source: optionalString(formData, "source"),
    partnerId: optionalString(formData, "partnerId"),
    unitId: optionalString(formData, "unitId"),
    equipmentId: optionalString(formData, "equipmentId"),
  };

  await apiJson("/occurrences", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  revalidatePath("/alertas");
  revalidatePath("/ocorrencias");
  redirect("/alertas");
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

export default async function CadastroAlertaPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/alertas/cadastro");
  }

  const isAdmin = isAdminRole(session.user?.role || "");

  if (!isAdmin) {
    redirect("/alertas");
  }

  const [partners, units, equipments] = await Promise.all([
    apiJson<PaginatedResponse<PartnerOption>>("/partners?page=1&pageSize=100"),
    apiJson<PaginatedResponse<UnitOption>>("/units?page=1&pageSize=100"),
    apiJson<PaginatedResponse<EquipmentOption>>("/equipments?page=1&pageSize=100"),
  ]);

  const today = new Date();
  const codeSuggestion = `AL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  return (
    <NovaLitShell activeHref="/alertas">
      <div className="nova-lit-page-heading nova-tickets-heading">
        <div>
          <h1>Cadastro de alerta</h1>
          <p className="nova-lit-page-subtitle">
            Registre uma ocorrência operacional vinculada a parceiro, unidade ou ativo.
          </p>
        </div>

        <div className="nova-lit-page-actions">
          <Link href="/alertas" className="nova-lit-button nova-lit-button-secondary">Voltar</Link>
          <Link href="/operacao/fila?view=pending" className="nova-lit-button nova-lit-button-primary">Ver fila</Link>
        </div>
      </div>

      <section className="nova-tickets-main-grid">
        <Surface>
          <SectionIntro
            eyebrow="Cadastro"
            title="Dados do alerta"
            description="Use código único, severidade, status e vínculo operacional para colocar o caso na fila."
            compact
          />

          <form action={createAlerta} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Código"
                name="code"
                required
                placeholder={`${codeSuggestion}-001`}
                hint="Deve ser único. Ex.: AL-20260507-001"
              />
              <TextField
                label="Título"
                name="title"
                required
                placeholder="Link indisponível, perda de gerência, alerta NOC..."
              />
            </div>

            <label className="nova-tickets-field">
              <span>Descrição</span>
              <textarea
                name="description"
                rows={5}
                placeholder="Descreva sintoma, impacto, origem, evidência ou instrução de triagem."
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Severidade" name="severity">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </SelectField>

              <SelectField label="Status" name="status">
                <option value="open">Aberto</option>
                <option value="investigating">Em investigação</option>
                <option value="resolved">Resolvido</option>
                <option value="cancelled">Cancelado</option>
              </SelectField>

              <TextField
                label="Origem"
                name="source"
                placeholder="NOC, Zabbix, campo, parceiro..."
              />
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
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="submit" className="nova-lit-button nova-lit-button-primary">
                Cadastrar alerta
              </button>
              <Link href="/alertas" className="nova-lit-button nova-lit-button-secondary">
                Cancelar
              </Link>
            </div>
          </form>
        </Surface>

        <aside className="nova-tickets-right-col">
          <section className="nova-lit-card nova-tickets-shift">
            <div className="nova-lit-title-row">
              <h2>Severidade</h2>
              <TonePill tone="attention">triagem</TonePill>
            </div>
            <div className="nova-tickets-status-list">
              <article>
                <strong>Crítica</strong>
                <b>impacto alto</b>
              </article>
              <article>
                <strong>Alta</strong>
                <b>atenção</b>
              </article>
              <article>
                <strong>Média/Baixa</strong>
                <b>acompanhar</b>
              </article>
            </div>
          </section>

          <section className="nova-lit-card nova-tickets-quick">
            <span>Continuidade</span>
            <Link href="/chamados">Chamados <b>agenda</b></Link>
            <Link href="/unidades">Unidades <b>{units.items.length}</b></Link>
            <Link href="/ativos">Ativos <b>{equipments.items.length}</b></Link>
          </section>

          <section className="nova-lit-card nova-tickets-priority">
            <div className="nova-lit-title-row">
              <h2>Boas práticas</h2>
              <span className="nova-lit-pill nova-lit-pill-orange">NOC</span>
            </div>
            <div className="nova-tickets-priority-list">
              <div className="nova-tickets-list-empty">
                Vincule unidade ou ativo sempre que possível. Isso permite abrir o histórico, cruzar com monitoramento e gerar chamado técnico depois.
              </div>
            </div>
          </section>
        </aside>
      </section>
    </NovaLitShell>
  );
}
