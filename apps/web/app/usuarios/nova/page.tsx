import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { apiJson } from "@/lib/server-api";
import { isAdminRole, ROLE_OPTIONS } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { UserAccessIcon } from "../user-access-shell";

async function createUser(
  _prevState: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  let createdId = "";

  try {
    if (!isAdminRole((await getServerWebSession()).user?.role || "")) {
      return { status: "error", message: "Acesso negado." };
    }

    const created = await apiJson<{ id: string }>("/users", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        role: String(formData.get("role") || ""),
        password: String(formData.get("password") || ""),
      }),
    });

    createdId = created.id;
    revalidatePath("/usuarios");
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }

  redirect(`/usuarios/${createdId}`);
}

export default async function NovoUsuarioPage() {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/usuarios/nova");
  }

  if (!isAdminRole(session.user?.role || "")) {
    redirect("/dashboard?denied=usuarios");
  }

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
              <strong>Novo</strong>
            </nav>
            <h1>Novo usuário</h1>
            <p>Crie o acesso em uma etapa dedicada, com papel, e-mail e senha inicial provisória.</p>
          </div>
          <div>
            <Link href="/usuarios" className="nova-user-editor-button">
              <UserAccessIcon name="chevron" />
              <span>Voltar</span>
            </Link>
          </div>
        </header>

        <section className="nova-user-editor-layout">
          <div className="nova-user-editor-main">
            <section className="nova-user-editor-card nova-user-editor-form-card">
              <div className="nova-user-editor-card-head">
                <div>
                  <span><UserAccessIcon name="plus-user" /> Cadastro</span>
                  <h2>Dados do acesso</h2>
                  <p>Use e-mail real, papel correto e senha inicial com no mínimo 8 caracteres.</p>
                </div>
                <strong>01</strong>
              </div>

              <ActionForm
                action={createUser}
                className="nova-user-editor-form"
                noticeClassName="nova-user-editor-form-wide"
                submitClassName="nova-user-editor-form-wide"
                submitLabel="Criar usuário"
                pendingLabel="Criando..."
                variant="primary"
              >
                <label>
                  <span>Nome</span>
                  <input name="name" placeholder="Nome completo" autoComplete="name" />
                </label>

                <label>
                  <span>E-mail</span>
                  <input name="email" type="email" placeholder="usuario@nova.local" autoComplete="email" />
                </label>

                <label>
                  <span>Papel</span>
                  <select name="role" defaultValue="viewer">
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Senha inicial</span>
                  <input
                    name="password"
                    type="password"
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                  />
                </label>

                <div className="nova-user-editor-security-note nova-user-editor-form-wide">
                  <UserAccessIcon name="shield" />
                  <span>O usuário será criado ativo e poderá trocar a senha após o primeiro acesso.</span>
                </div>
              </ActionForm>
            </section>
          </div>

          <aside className="nova-user-editor-side">
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

            <section className="nova-user-editor-card">
              <div className="nova-user-editor-side-title is-orange">
                <UserAccessIcon name="lock" />
                <div>
                  <h2>Política inicial</h2>
                  <p>Campos obrigatórios para liberar o acesso.</p>
                </div>
              </div>
              <div className="nova-user-editor-checklist">
                <span>Nome completo</span>
                <span>E-mail válido</span>
                <span>Perfil operacional</span>
                <span>Senha com 8+ caracteres</span>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </NovaLitShell>
  );
}
