import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { ListPagination } from "@/components/list-pagination";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
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
import { apiJson } from "@/lib/server-api";
import {
  getActionErrorMessage,
  type ActionFeedbackState,
} from "@/lib/action-state";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime } from "@/lib/formatters";
import { isAdminRole, ROLE_OPTIONS, roleLabel, roleTone } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/usuarios");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/dashboard?denied=usuarios");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const role = readStringParam(params, "role", "all");
  const active = readStringParam(params, "active", "true");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);

  async function updateUser(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      if (!isAdminRole((await getServerWebSession()).user?.role || "")) {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");

      await apiJson(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          role: String(formData.get("role") || ""),
          isActive: formData.get("isActive") === "on",
        }),
      });

      revalidatePath("/usuarios");
      return { status: "success", message: "Usuário atualizado com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function resetPassword(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    try {
      if (!isAdminRole((await getServerWebSession()).user?.role || "")) {
        return { status: "error", message: "Acesso negado." };
      }

      const id = String(formData.get("id") || "");

      await apiJson(`/users/${id}/password`, {
        method: "PATCH",
        body: JSON.stringify({
          password: String(formData.get("password") || ""),
        }),
      });

      revalidatePath("/usuarios");
      return { status: "success", message: "Senha redefinida com sucesso." };
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }
  }

  async function deleteUser(
    _prevState: ActionFeedbackState,
    formData: FormData,
  ): Promise<ActionFeedbackState> {
    "use server";

    const id = String(formData.get("id") || "");

    try {
      const actionSession = await getServerWebSession();
      if (!isAdminRole(actionSession.user?.role || "")) {
        return { status: "error", message: "Acesso negado." };
      }

      if (id === actionSession.user?.id) {
        return { status: "error", message: "Você não pode excluir o próprio usuário logado." };
      }
      if (formData.get("confirmDelete") !== "yes") {
        return { status: "error", message: "Confirme a exclusão para continuar." };
      }

      await apiJson(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      revalidatePath("/usuarios");
    } catch (error) {
      return { status: "error", message: getActionErrorMessage(error) };
    }

    redirect("/usuarios?active=true");
  }

  const response = await apiJson<PaginatedResponse<UserRow>>(
    `/users${buildApiQuery({
      q,
      role: role !== "all" ? role : undefined,
      active: active !== "all" ? active : undefined,
      sortBy,
      sortDir,
      page,
      pageSize,
    })}`,
  );

  const activeOnPage = response.items.filter((user) => user.isActive).length;
  const currentUserId = session.user?.id || "";
  const adminOnPage = response.items.filter((user) => user.role === "admin").length;
  const editorOnPage = response.items.filter((user) => user.role === "editor").length;
  const operatorOnPage = response.items.filter((user) => user.role === "operator").length;
  const viewerOnPage = response.items.filter((user) => user.role === "viewer").length;

  return (
    <AppShell
      title="Usuários"
      subtitle="Gestão administrativa de acesso."
    ><RegistryHero
        eyebrow="Access Control"
        title="Usuários, papéis e status sem ocupar a operação"
        description="Usuários, acessos e permissões."
      /><RegistrySummaryStrip
        items={[
          {
            label: "Usuários",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Ativos",
            value: activeOnPage,
            meta: "nesta página",
            tone: activeOnPage ? "success" : "neutral",
          },
          {
            label: "Admins",
            value: adminOnPage,
            meta: `${editorOnPage} editor(es), ${operatorOnPage} operador(es)`,
            tone: adminOnPage ? "success" : "attention",
          },
          {
            label: "Leitores",
            value: viewerOnPage,
            meta: "acesso somente leitura",
            tone: viewerOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Menos formulário aberto"
        noteCopy="A lista é o centro da tela; criação, edição e senha ficam no mesmo contexto para não disputar atenção com a revisão dos usuários."
      /><Surface><SectionIntro
          eyebrow="Filtros"
          title="Refine pessoa, papel e estado"
          description="Busca por nome ou e-mail, com role, status e ordenação preservados na URL."
          actions={
            <Link
              href="/usuarios"
              className="nds-button"
              data-variant="secondary"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="nova-filter-grid nova-filter-grid--users mt-2"><div className="grid gap-1.5"><FieldLabel htmlFor="users-q" label="Busca" /><input
              id="users-q"
              name="q"
              defaultValue={q}
              placeholder="Nome ou e-mail"
            /></div><div className="grid gap-1.5"><FieldLabel htmlFor="users-role" label="Papel" /><select
              id="users-role"
              name="role"
              defaultValue={role}
            ><option value="all">Todos os papéis</option>
                    {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select></div><div className="grid gap-1.5"><FieldLabel htmlFor="users-active" label="Status" /><select
              id="users-active"
              name="active"
              defaultValue={active}
            ><option value="all">Todos</option><option value="true">Ativos</option><option value="false">Excluídos</option></select></div><div className="grid gap-1.5"><FieldLabel htmlFor="users-sort-by" label="Ordenar por" /><select
              id="users-sort-by"
              name="sortBy"
              defaultValue={sortBy}
            ><option value="createdAt">Cadastro</option><option value="name">Nome</option><option value="email">E-mail</option><option value="role">Papel</option></select></div><div className="grid gap-1.5"><FieldLabel htmlFor="users-sort-dir" label="Direção" /><select
              id="users-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
            ><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div><div className="grid gap-1.5"><FieldLabel htmlFor="users-page-size" label="Página" /><select
              id="users-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
            ><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select></div><button className="nds-button xl:self-end" data-variant="primary">
            Aplicar filtros
          </button></form></Surface><Surface><SectionIntro
          eyebrow="Acessos"
          title="Usuários cadastrados"
          description={`${response.meta.total} usuário(s) encontrados nesta visão.`}
          actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
          compact
        /><div className="mt-2">
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Papel</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Criado em</th><TableActionHeader>Ajuste</TableActionHeader></tr></TableHead><tbody>
                  {response.items.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    ><TableCell><div className="font-medium text-white">{user.name}</div><div className="mt-1 text-[10px] text-slate-500">{user.email}</div></TableCell><TableCell><TonePill tone={roleTone(user.role)}>{roleLabel(user.role)}</TonePill></TableCell><TableCell><TonePill tone={user.isActive ? "success" : "critical"}>
                          {user.isActive ? "ativo" : "inativo"}
                        </TonePill></TableCell><TableCell className="text-slate-400">{formatDateTime(user.createdAt)}</TableCell><TableActionCell><TableActionAnchor href={`#user-${user.id}`}>
                          Ajustar acesso
                        </TableActionAnchor></TableActionCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Ajuste a busca ou limpe os filtros para voltar à base completa."
              action={
                <Link
                  href="/usuarios"
                  className="nds-button"
                  data-variant="secondary"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div></Surface><ListPagination pathname="/usuarios" searchParams={params} meta={response.meta} />

      {response.items.length ? (
        <Surface><SectionIntro
            eyebrow="Administração"
            title="Editar acesso e senha"
            description="Edição e revisão de acesso."
            compact
          /><div className="mt-2 grid gap-2">
            {response.items.map((user) => (
              <details
                key={user.id}
                id={`user-${user.id}`}
                className="nds-card nova-user-admin-card"
              ><summary className="flex cursor-pointer list-none flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><div className="text-[13px] font-black text-white">{user.name}</div><div className="mt-1 text-[11px] text-slate-400">{user.email}</div></div><div className="flex flex-wrap gap-2"><TonePill tone={roleTone(user.role)}>{roleLabel(user.role)}</TonePill><TonePill tone={user.isActive ? "success" : "critical"}>
                      {user.isActive ? "ativo" : "inativo"}
                    </TonePill><TonePill tone="neutral">editar</TonePill></div></summary><div className="mt-2 flex justify-end border-t border-white/[0.08] pt-2"><OperationalDeletePanel
                      action={deleteUser}
                      entityId={user.id}
                      entityLabel="usuário"
                      entityName={`${user.name} - ${user.email}`}
                      blockedReason={
                        user.id === currentUserId
                          ? "Você não pode excluir o próprio usuário logado."
                          : !user.isActive
                            ? "Este usuário já está inativo."
                            : undefined
                      }
                    /></div><div className="mt-2 grid gap-2 xl:grid-cols-2"><ActionForm
                    action={updateUser}
                    className="nds-card grid gap-2"
                    submitLabel="Salvar usuário"
                    pendingLabel="Salvando..."
                    variant="secondary"
                  ><div className="text-[12px] font-black text-white">Dados de acesso</div><input type="hidden" name="id" value={user.id} /><div className="grid gap-1.5"><FieldLabel htmlFor={`edit-name-${user.id}`} label="Nome" /><input
                        id={`edit-name-${user.id}`}
                        name="name"
                        defaultValue={user.name}
                      /></div><div className="grid gap-1.5"><FieldLabel htmlFor={`edit-role-${user.id}`} label="Papel" /><select
                        id={`edit-role-${user.id}`}
                        name="role"
                        defaultValue={user.role}
                      >
                              {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select></div><label className="flex items-center gap-2 text-[11px] text-slate-300"><input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={user.isActive}
                        className="h-4 w-4 rounded border-white/20 bg-[var(--nova-surface-3)]"
                      />
                      Usuário ativo
                    </label></ActionForm><ActionForm
                    action={resetPassword}
                    className="nds-card grid gap-2"
                    submitLabel="Redefinir senha"
                    pendingLabel="Salvando..."
                    variant="secondary"
                  ><div className="text-[12px] font-black text-white">Senha</div><input type="hidden" name="id" value={user.id} /><div className="grid gap-1.5"><FieldLabel htmlFor={`reset-password-${user.id}`} label="Nova senha" /><input
                        id={`reset-password-${user.id}`}
                        name="password"
                        type="password"
                        placeholder="Nova senha"
                      /></div><div className="text-[10px] text-slate-500">
                      Criado em {formatDateTime(user.createdAt)}
                    </div></ActionForm></div></details>
            ))}
          </div></Surface>
      ) : null}
    </AppShell>
  );
}
