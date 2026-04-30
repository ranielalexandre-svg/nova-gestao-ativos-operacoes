import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DenseTable, RightPanel, StatCard, Surface, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

const profiles = [
  { role: "Admin", users: "total", description: "Controle completo do ambiente", tone: "critical" },
  { role: "Operador NOC", users: "turno", description: "Monitoramento, chamados e relatórios", tone: "info" },
  { role: "Leitura", users: "auditoria", description: "Consulta sem alteração operacional", tone: "neutral" },
];

const permissions = [
  ["Unidades e ativos", "editar", "editar", "visualizar"],
  ["Monitoramento", "sincronizar", "operar", "visualizar"],
  ["Relatórios", "exportar", "exportar", "visualizar"],
  ["Usuários", "administrar", "sem acesso", "sem acesso"],
  ["Integrações", "administrar", "visualizar", "visualizar"],
  ["Auditoria", "visualizar", "visualizar", "visualizar"],
];

function permissionTone(value: string) {
  if (["administrar", "editar", "sincronizar", "exportar", "operar"].includes(value)) return "success";
  if (value === "visualizar") return "info";
  return "subtle";
}

export default async function PerfisPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/perfis");
  if (normalizeRole(session.user?.role || "") !== "admin") redirect("/dashboard");

  return (
    <AppShell title="Perfis" subtitle="Matriz de permissões para operação, relatório e administração.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-3">
            {profiles.map((profile) => (
              <StatCard key={profile.role} label={profile.role} value={profile.users} detail={profile.description} tone={profile.tone} />
            ))}
          </div>

          <Surface className="p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Permissões</div>
            <h2 className="mt-2 text-xl font-black text-white">Matriz de acesso</h2>
            <div className="mt-5">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Leitura</th></tr></TableHead>
                  <tbody>
                    {permissions.map(([module, admin, operator, reader]) => (
                      <tr key={module} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">{module}</div></TableCell>
                        {[admin, operator, reader].map((value, index) => (
                          <TableCell key={`${module}-${index}`}><TonePill tone={permissionTone(value)}>{value}</TonePill></TableCell>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>
        </div>

        <RightPanel title="Segurança" description="Regras para liberar acesso.">
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4 text-sm leading-6 text-slate-400">
            A tela define a matriz visual. A próxima etapa é persistir permissões granulares no backend e vincular cada usuário a um perfil.
          </div>
          <TonePill tone="critical">admin altera perfil</TonePill>
          <TonePill tone="info">operador exporta relatório</TonePill>
          <TonePill tone="neutral">leitura não edita cadastro</TonePill>
        </RightPanel>
      </section>
    </AppShell>
  );
}
