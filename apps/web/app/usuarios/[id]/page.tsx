import type { ReactNode } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { OperationalDeletePanel } from "@/components/operational-delete-panel";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import { apiJson } from "@/lib/server-api";
import { isAdminRole, ROLE_OPTIONS, roleLabel } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { UserAccessIcon } from "../user-access-shell";

type UserDetail = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Tone = "green" | "orange" | "blue" | "red" | "slate";

function roleTone(role: string): Tone {
  if (role === "admin") return "green";
  if (role === "editor") return "blue";
  if (role === "operator") return "orange";
  return "slate";
}

function statusTone(isActive: boolean): Tone {
  return isActive ? "green" : "red";
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-user-editor-badge is-${tone}`}>{children}</span>;
}

async function updateUser(
  _prevState: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const id = String(formData.get("id") || "");

  try {
    if (!isAdminRole((await getServerWebSession()).user?.role || "")) {
      return { status: "error", message: "Acesso negado." };
    }

    await apiJson(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: String(formData.get("name") || ""),
        role: String(formData.get("role") || ""),
        isActive: formData.get("isActive") === "on",
      }),
    });

    revalidatePath("/usuarios");
    revalidatePath(`/usuarios/${id}`);
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

  const id = String(formData.get("id") || "");

  try {
    if (!isAdminRole((await getServerWebSession()).user?.role || "")) {
      return { status: "error", message: "Acesso negado." };
    }

    await apiJson(`/users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({
        password: String(formData.get("password") || ""),
      }),
    });

    revalidatePath(`/usuarios/${id}`);
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
    revalidatePath(`/usuarios/${id}`);
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }

  redirect("/usuarios?active=true");
}

export default async function UsuarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/usuarios");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/dashboard?denied=usuarios");
  }

  const { id } = await params;
  const user = await apiJson<UserDetail>(`/users/${id}`);
  const currentUserId = session.user?.id || "";

  return (
    <NovaLitShell activeHref="/usuarios" hidePageHeader>
      <main className="nova-user-editor-page">
        <header className="nova-user-editor-heading">
          <div>
            <nav aria-label="Breadcrumb">
              <Link href="/configuracoes">Configurações</Link>
              <span>/</span>
              <Link href="/usuarios">Usuários</Link>
              <span>/</span>
              <strong>Detalhe</strong>
            </nav>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
          <div>
            <Link href="/usuarios" className="nova-user-editor-button">
              <UserAccessIcon name="chevron" />
              <span>Voltar</span>
            </Link>
            <Link href="/usuarios/cadastro" className="nova-user-editor-button is-primary">
              <UserAccessIcon name="plus-user" />
              <span>Cadastrar usuário</span>
            </Link>
          </div>
        </header>

        <section className="nova-user-editor-kpis" aria-label="Resumo do usuário">
          <article className="nova-user-editor-kpi is-blue">
            <div>
              <UserAccessIcon name="users" />
            </div>
            <span>Papel</span>
            <strong>{roleLabel(user.role)}</strong>
            <small>nível de acesso atual</small>
          </article>
          <article className={`nova-user-editor-kpi ${user.isActive ? "is-green" : "is-red"}`}>
            <div>
              <UserAccessIcon name="shield" />
            </div>
            <span>Status</span>
            <strong>{user.isActive ? "Ativo" : "Inativo"}</strong>
            <small>controle lógico de acesso</small>
          </article>
          <article className="nova-user-editor-kpi is-orange">
            <div>
              <UserAccessIcon name="lock" />
            </div>
            <span>Criado em</span>
            <strong>{formatDateTime(user.createdAt)}</strong>
            <small>última atualização: {formatDateTime(user.updatedAt)}</small>
          </article>
        </section>

        <section className="nova-user-editor-layout">
          <div className="nova-user-editor-main">
            <section className="nova-user-editor-card nova-user-editor-form-card">
              <div className="nova-user-editor-card-head">
                <div>
                  <span>
                    <UserAccessIcon name="users" /> Cadastro
                  </span>
                  <h2>Editar acesso</h2>
                  <p>Atualize nome, papel e status ativo do usuário.</p>
                </div>
                <div className="nova-user-editor-badges">
                  <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                  <Badge tone={statusTone(user.isActive)}>{user.isActive ? "ativo" : "inativo"}</Badge>
                </div>
              </div>

              <ActionForm
                action={updateUser}
                className="nova-user-editor-form"
                noticeClassName="nova-user-editor-form-wide"
                submitClassName="nova-user-editor-form-wide"
                submitLabel="Salvar usuário"
                pendingLabel="Salvando..."
                variant="primary"
              >
                <input type="hidden" name="id" value={user.id} />

                <label>
                  <span>Nome</span>
                  <input name="name" defaultValue={user.name} />
                </label>

                <label>
                  <span>E-mail</span>
                  <input value={user.email} readOnly aria-readonly="true" />
                </label>

                <label>
                  <span>Papel</span>
                  <select name="role" defaultValue={user.role}>
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="nova-user-editor-check">
                  <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
                  <span>Usuário ativo</span>
                </label>
              </ActionForm>
            </section>

            <section className="nova-user-editor-card nova-user-editor-form-card">
              <div className="nova-user-editor-card-head">
                <div>
                  <span>
                    <UserAccessIcon name="lock" /> Senha
                  </span>
                  <h2>Redefinir senha</h2>
                  <p>Gere uma senha provisória com no mínimo 8 caracteres.</p>
                </div>
              </div>

              <ActionForm
                action={resetPassword}
                className="nova-user-editor-form is-compact"
                noticeClassName="nova-user-editor-form-wide"
                submitClassName="nova-user-editor-form-wide"
                submitLabel="Redefinir senha"
                pendingLabel="Salvando..."
                variant="secondary"
              >
                <input type="hidden" name="id" value={user.id} />

                <label className="nova-user-editor-form-wide">
                  <span>Nova senha</span>
                  <input
                    name="password"
                    type="password"
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                  />
                </label>
              </ActionForm>
            </section>
          </div>

          <aside className="nova-user-editor-side">
            <section className="nova-user-editor-card">
              <div className="nova-user-editor-side-title is-orange">
                <UserAccessIcon name="trash" />
                <div>
                  <h2>Remover acesso</h2>
                  <p>O usuário é inativado, preservando histórico e auditoria.</p>
                </div>
              </div>

              <div className="nova-user-editor-delete">
                <OperationalDeletePanel
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
                />
                {user.id === currentUserId ? (
                  <p>Você não pode inativar o próprio usuário logado.</p>
                ) : !user.isActive ? (
                  <p>Este usuário já está inativo.</p>
                ) : null}
              </div>
            </section>

            <section className="nova-user-editor-card">
              <div className="nova-user-editor-side-title">
                <UserAccessIcon name="shield" />
                <div>
                  <h2>Controle de acesso</h2>
                  <p>Resumo dos perfis aceitos pela API.</p>
                </div>
              </div>

              <div className="nova-user-editor-rules">
                <div>
                  <strong>Admin</strong>
                  <span>gerencia usuários, perfis e configurações</span>
                </div>
                <div>
                  <strong>Editor</strong>
                  <span>mantém cadastros e registros operacionais</span>
                </div>
                <div>
                  <strong>Operator</strong>
                  <span>atua na rotina e filas técnicas</span>
                </div>
                <div>
                  <strong>Viewer</strong>
                  <span>somente consulta e relatórios</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
