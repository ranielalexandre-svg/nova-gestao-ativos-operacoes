import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ListPagination } from "@/components/list-pagination";
import { NovaLitShell } from "@/components/nova-lit/nova-lit-shell";
import { apiJson } from "@/lib/server-api";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDateTime } from "@/lib/formatters";
import { isAdminRole, ROLE_OPTIONS, roleLabel } from "@/lib/role-policy";
import { getServerWebSession } from "@/lib/web-session";

type Tone = "green" | "orange" | "blue" | "red" | "slate";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

function roleToneLocal(role: string): Tone {
  if (role === "admin") return "green";
  if (role === "editor") return "blue";
  if (role === "operator") return "orange";
  if (role === "viewer") return "slate";
  return "slate";
}

function statusTone(isActive: boolean): Tone {
  return isActive ? "green" : "red";
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`nova-users-badge is-${tone}`}>{children}</span>;
}

function Dot({ tone }: { tone: Tone }) {
  return <span className={`nova-users-dot is-${tone}`} />;
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className="nova-users-metric">
      <div className="nova-users-metric__head">
        <span>{label}</span>
        <Dot tone={tone} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
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
  const inactiveOnPage = response.items.filter((user) => !user.isActive).length;
  const adminOnPage = response.items.filter((user) => user.role === "admin").length;
  const editorOnPage = response.items.filter((user) => user.role === "editor").length;
  const operatorOnPage = response.items.filter((user) => user.role === "operator").length;
  const viewerOnPage = response.items.filter((user) => user.role === "viewer").length;

  return (
    <NovaLitShell activeHref="/usuarios">
      <main className="nova-users-page">
        <section className="nova-users-hero">
          <div>
            <span>Configurações / Usuários</span>
            <h1>Usuários</h1>
            <p>Gestão administrativa de acesso, papéis, status e senhas do ambiente operacional.</p>
          </div>
          <div className="nova-users-hero__actions">
            <Link href="/perfis" className="nova-users-button is-secondary">Perfis</Link>
            <Link href="/usuarios/nova" className="nova-users-button is-primary">Novo usuário</Link>
          </div>
        </section>

        <section className="nova-users-metrics">
          <MetricCard
            label="Usuários"
            value={response.meta.total}
            detail="resultado filtrado"
            tone="blue"
          />
          <MetricCard
            label="Ativos"
            value={activeOnPage}
            detail={`${inactiveOnPage} inativo(s) nesta página`}
            tone={activeOnPage ? "green" : "slate"}
          />
          <MetricCard
            label="Admins"
            value={adminOnPage}
            detail={`${editorOnPage} editor(es)`}
            tone={adminOnPage ? "green" : "orange"}
          />
          <MetricCard
            label="Operadores"
            value={operatorOnPage}
            detail="execução operacional"
            tone={operatorOnPage ? "orange" : "slate"}
          />
          <MetricCard
            label="Leitores"
            value={viewerOnPage}
            detail="acesso somente leitura"
            tone={viewerOnPage ? "blue" : "slate"}
          />
        </section>

        <section className="nova-users-layout">
          <div className="nova-users-main">
            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Filtros</span>
                  <h2>Refine pessoa, papel e estado</h2>
                  <p>Busca por nome ou e-mail, com papel, status e ordenação preservados na URL.</p>
                </div>
                <Link href="/usuarios" className="nova-users-button is-secondary">Limpar</Link>
              </div>

              <form method="GET" className="nova-users-filter-grid">
                <label className="is-wide">
                  <span>Busca</span>
                  <input name="q" defaultValue={q} placeholder="Nome ou e-mail" />
                </label>

                <label>
                  <span>Papel</span>
                  <select name="role" defaultValue={role}>
                    <option value="all">Todos os papéis</option>
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select name="active" defaultValue={active}>
                    <option value="all">Todos</option>
                    <option value="true">Ativos</option>
                    <option value="false">Excluídos</option>
                  </select>
                </label>

                <label>
                  <span>Ordem</span>
                  <select name="sortBy" defaultValue={sortBy}>
                    <option value="createdAt">Cadastro</option>
                    <option value="name">Nome</option>
                    <option value="email">E-mail</option>
                    <option value="role">Papel</option>
                  </select>
                </label>

                <label>
                  <span>Direção</span>
                  <select name="sortDir" defaultValue={sortDir}>
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </label>

                <label>
                  <span>Linhas</span>
                  <select name="pageSize" defaultValue={String(pageSize)}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </label>

                <button className="nova-users-button is-primary">Aplicar filtros</button>
              </form>
            </section>

            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Acessos</span>
                  <h2>Usuários cadastrados</h2>
                  <p>{response.meta.total} usuário(s) encontrado(s) nesta visão.</p>
                </div>
                <Badge tone="blue">{response.items.length} linhas</Badge>
              </div>

              <div className="nova-users-table-wrap">
                <table className="nova-users-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Papel</th>
                      <th>Status</th>
                      <th>Criado em</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.items.length ? response.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </td>
                        <td>
                          <Badge tone={roleToneLocal(user.role)}>{roleLabel(user.role)}</Badge>
                        </td>
                        <td>
                          <Badge tone={statusTone(user.isActive)}>{user.isActive ? "ativo" : "inativo"}</Badge>
                        </td>
                        <td>{formatDateTime(user.createdAt)}</td>
                        <td>
                          <Link className="nova-users-row-action" href={`/usuarios/${user.id}`}>Abrir</Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5}>
                          <div className="nova-users-empty">
                            <strong>Nenhum usuário encontrado</strong>
                            <span>Ajuste a busca ou limpe os filtros para voltar à base completa.</span>
                            <Link href="/usuarios" className="nova-users-button is-secondary">Limpar filtros</Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="nova-users-pagination">
                <ListPagination pathname="/usuarios" searchParams={params} meta={response.meta} />
              </div>
            </section>

          </div>

          <aside className="nova-users-side">
            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Novo acesso</span>
                  <h2>Criar usuário</h2>
                  <p>Criação de usuário agora acontece em página dedicada, separada da listagem.</p>
                </div>
              </div>

              <Link href="/usuarios/nova" className="nova-users-button is-primary">
                Criar novo usuário
              </Link>
            </section>

            <section className="nova-users-card">
              <div className="nova-users-section-head">
                <div>
                  <span>Governança</span>
                  <h2>Distribuição de papéis</h2>
                </div>
              </div>

              <div className="nova-users-role-list">
                <div><span>Administradores</span><strong>{adminOnPage}</strong></div>
                <div><span>Editores</span><strong>{editorOnPage}</strong></div>
                <div><span>Operadores</span><strong>{operatorOnPage}</strong></div>
                <div><span>Leitores</span><strong>{viewerOnPage}</strong></div>
              </div>
            </section>

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
