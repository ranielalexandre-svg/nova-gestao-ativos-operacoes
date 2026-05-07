import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { getActionErrorMessage, type ActionFeedbackState } from "@/lib/action-state";
import { apiJson } from "@/lib/server-api";
import { isAdminRole, ROLE_OPTIONS } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

async function createUser(
  _prevState: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

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

    revalidatePath("/usuarios");
    redirect(`/usuarios/${created.id}`);
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
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
    <NovaLitShell activeHref="/usuarios">
      <main className="nova-users-page">
        <section className="nova-users-hero">
          <div>
            <span>Configurações / Usuários / Novo</span>
            <h1>Novo usuário</h1>
            <p>Crie o acesso em uma etapa dedicada, com papel, e-mail e senha inicial provisória.</p>
          </div>
          <div className="nova-users-hero__actions">
            <Link href="/usuarios" className="nova-users-button is-secondary">Voltar para usuários</Link>
          </div>
        </section>

        <section className="nova-users-layout">
          <div className="nova-users-main">
            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Cadastro</span>
                  <h2>Dados do acesso</h2>
                  <p>Use e-mail real, papel correto e senha inicial com no mínimo 8 caracteres.</p>
                </div>
              </div>

              <ActionForm
                action={createUser}
                className="nova-users-create-form"
                submitLabel="Criar usuário"
                pendingLabel="Criando..."
                variant="secondary"
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
              </ActionForm>
            </section>
          </div>

          <aside className="nova-users-side">
            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Regras rápidas</span>
                  <h2>Controle de acesso</h2>
                </div>
              </div>

              <div className="nova-users-rules">
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
