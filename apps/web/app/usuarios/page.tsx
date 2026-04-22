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
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const roleOptions = [
  { value: "admin", label: "Administrador" },
  { value: "operator", label: "Operador" },
  { value: "viewer", label: "Leitor" },
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

function roleLabel(role: string) {
  return roleOptions.find((option) => option.value === role)?.label || role;
}

function roleTone(role: string) {
  if (role === "admin") return "success";
  if (role === "operator") return "info";
  return "attention";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/usuarios");
  }

  if (normalizeRole(session.user?.role || "") !== "admin") {
    redirect("/dashboard?denied=usuarios");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const role = readStringParam(params, "role", "all");
  const active = readStringParam(params, "active", "all");
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
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
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
      if (normalizeRole((await getServerWebSession()).user?.role || "") !== "admin") {
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
  const adminOnPage = response.items.filter((user) => user.role === "admin").length;
  const operatorOnPage = response.items.filter((user) => user.role === "operator").length;
  const viewerOnPage = response.items.filter((user) => user.role === "viewer").length;

  return (
    <AppShell
      title="Usuários"
      subtitle="Gestão administrativa de acesso com lista principal e ajustes na mesma mesa."
    >
      <RegistryHero
        eyebrow="Access Control"
        title="Usuários, papéis e status sem ocupar a operação"
        description="A tela funciona como uma mesa administrativa: primeiro você localiza quem precisa de ajuste, depois atua no mesmo fluxo para editar acesso ou senha."
      />

      <RegistrySummaryStrip
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
            meta: `${operatorOnPage} operador(es)`,
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
      />

      <Surface className="p-5 sm:p-6">
        <SectionIntro
          eyebrow="Filtros"
          title="Refine pessoa, papel e estado"
          description="Busca por nome ou e-mail, com role, status e ordenação preservados na URL."
          actions={
            <Link
              href="/usuarios"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        />

        <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2 xl:col-span-2">
            <FieldLabel htmlFor="users-q" label="Busca" />
            <input
              id="users-q"
              name="q"
              defaultValue={q}
              placeholder="Nome ou e-mail"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="users-role" label="Papel" />
            <select
              id="users-role"
              name="role"
              defaultValue={role}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos os papéis</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="users-active" label="Status" />
            <select
              id="users-active"
              name="active"
              defaultValue={active}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="all">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="users-sort-by" label="Ordenar por" />
            <select
              id="users-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="createdAt">Cadastro</option>
              <option value="name">Nome</option>
              <option value="email">E-mail</option>
              <option value="role">Papel</option>
            </select>
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="users-sort-dir" label="Direção" />
            <select
              id="users-sort-dir"
              name="sortDir"
              defaultValue={sortDir}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2 xl:col-span-2">
            <FieldLabel htmlFor="users-page-size" label="Página" />
            <select
              id="users-page-size"
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
          eyebrow="Acessos"
          title="Usuários cadastrados"
          description={`${response.meta.total} usuário(s) encontrados nesta visão.`}
          actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
          compact
        />

        <div className="mt-5">
          {response.items.length ? (
            <TableShell>
              <DenseTable>
                <TableHead>
                  <tr>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Papel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Criado em</th>
                    <th className="px-4 py-3 text-right">Ajuste</th>
                  </tr>
                </TableHead>
                <tbody>
                  {response.items.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                    >
                      <TableCell>
                        <div className="font-medium text-white">{user.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <TonePill tone={roleTone(user.role)}>{roleLabel(user.role)}</TonePill>
                      </TableCell>
                      <TableCell>
                        <TonePill tone={user.isActive ? "success" : "critical"}>
                          {user.isActive ? "ativo" : "inativo"}
                        </TonePill>
                      </TableCell>
                      <TableCell className="text-slate-400">{formatDateTime(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`#user-${user.id}`}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          Ajustar acesso
                        </a>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </DenseTable>
            </TableShell>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Ajuste a busca ou limpe os filtros para voltar à base completa."
              action={
                <Link
                  href="/usuarios"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div>
      </Surface>

      <ListPagination pathname="/usuarios" searchParams={params} meta={response.meta} />

      {response.items.length ? (
        <Surface className="p-5 sm:p-6">
          <SectionIntro
            eyebrow="Administração"
            title="Editar acesso e senha"
            description="Ajustes aparecem como blocos reais da tela, mantendo edição e revisão no mesmo fluxo."
            compact
          />

          <div className="mt-5 grid gap-4">
            {response.items.map((user) => (
              <article
                key={user.id}
                id={`user-${user.id}`}
                className="rounded-[18px] border border-white/[0.08] bg-[#0a0f15] p-4"
              >
                <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">{user.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{user.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TonePill tone={roleTone(user.role)}>{roleLabel(user.role)}</TonePill>
                    <TonePill tone={user.isActive ? "success" : "critical"}>
                      {user.isActive ? "ativo" : "inativo"}
                    </TonePill>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <ActionForm
                    action={updateUser}
                    className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-black/20 p-4"
                    submitLabel="Salvar usuário"
                    pendingLabel="Salvando..."
                    variant="secondary"
                  >
                    <div className="text-sm font-semibold text-white">Dados de acesso</div>
                    <input type="hidden" name="id" value={user.id} />

                    <div className="grid gap-2">
                      <FieldLabel htmlFor={`edit-name-${user.id}`} label="Nome" />
                      <input
                        id={`edit-name-${user.id}`}
                        name="name"
                        defaultValue={user.name}
                        className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                      />
                    </div>

                    <div className="grid gap-2">
                      <FieldLabel htmlFor={`edit-role-${user.id}`} label="Papel" />
                      <select
                        id={`edit-role-${user.id}`}
                        name="role"
                        defaultValue={user.role}
                        className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={user.isActive}
                        className="h-4 w-4 rounded border-white/20 bg-[#111318]"
                      />
                      Usuário ativo
                    </label>
                  </ActionForm>

                  <ActionForm
                    action={resetPassword}
                    className="grid gap-3 rounded-[16px] border border-white/[0.08] bg-black/20 p-4"
                    submitLabel="Redefinir senha"
                    pendingLabel="Salvando..."
                    variant="secondary"
                  >
                    <div className="text-sm font-semibold text-white">Senha</div>
                    <input type="hidden" name="id" value={user.id} />

                    <div className="grid gap-2">
                      <FieldLabel htmlFor={`reset-password-${user.id}`} label="Nova senha" />
                      <input
                        id={`reset-password-${user.id}`}
                        name="password"
                        type="password"
                        placeholder="Nova senha"
                        className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      Criado em {formatDateTime(user.createdAt)}
                    </div>
                  </ActionForm>
                </div>
              </article>
            ))}
          </div>
        </Surface>
      ) : null}
    </AppShell>
  );
}
