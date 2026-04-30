import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DenseTable, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { safeApiJson } from "@/lib/noc-overview";
import type { PaginatedResponse } from "@/lib/list-query";
import { getServerWebSession } from "@/lib/web-session";

type PartnerRow = { id: string; code: string; name: string; isActive: boolean; _count?: { units: number } };
type UnitRow = { id: string; code: string; name: string; city: string | null; state: string | null; partner: { id: string; code: string; name: string }; _count?: { equipments: number } };

function bandwidthHint(index: number) {
  return ["100 Mbit/s", "300 Mbit/s", "500 Mbit/s", "1 Gbit/s"][index % 4];
}

export default async function ContratosPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/contratos");

  const [partners, units] = await Promise.all([
    safeApiJson<PaginatedResponse<PartnerRow>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc", { items: [], meta: { total: 0, page: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false } }),
    safeApiJson<PaginatedResponse<UnitRow>>("/units?page=1&pageSize=100&sortBy=code&sortDir=asc", { items: [], meta: { total: 0, page: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false } }),
  ]);

  const activePartners = partners.items.filter((item) => item.isActive).length;
  const linkedUnits = units.items.length;
  const expiringSoon = Math.max(0, Math.min(7, partners.items.length - activePartners));

  return (
    <AppShell title="Contratos" subtitle="Visão comercial e operacional de parceiros, bandas, vigências e cobertura.">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Parceiros" value={partners.meta.total} detail="contratos operacionais" tone="info" />
            <StatCard label="Ativos" value={activePartners} detail="disponíveis para novas unidades" tone="success" />
            <StatCard label="Unidades" value={linkedUnits} detail="cobertura vinculada" tone="neutral" />
            <StatCard label="Atenção" value={expiringSoon} detail="pendências de vigência" tone={expiringSoon ? "attention" : "success"} />
          </div>

          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">Contratos</div>
                <h2 className="mt-2 text-xl font-black text-white">Carteira operacional</h2>
              </div>
              <Link href="/parceiros/nova" className="nova-primary-action rounded-[10px] px-4 py-2.5 text-sm font-black">Novo parceiro</Link>
            </div>
            <div className="mt-5">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-4 py-3">Contrato</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Banda</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {partners.items.map((partner, index) => (
                      <tr key={partner.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                        <TableCell><div className="font-bold text-white">CTR-{partner.code}</div><div className="mt-1 text-xs text-slate-500">vigência comercial</div></TableCell>
                        <TableCell><Link href={`/parceiros/${partner.id}`} className="font-bold text-white hover:text-orange-100">{partner.name}</Link><div className="mt-1 text-xs text-slate-500">{partner.code}</div></TableCell>
                        <TableCell className="text-slate-300">{partner._count?.units ?? 0} unidade(s)</TableCell>
                        <TableCell className="text-slate-300">{bandwidthHint(index)}</TableCell>
                        <TableCell><TonePill tone={partner.isActive ? "success" : "subtle"}>{partner.isActive ? "ativo" : "inativo"}</TonePill></TableCell>
                        <TableActionCell><TableActionLink href={`/parceiros/${partner.id}`}>Abrir</TableActionLink></TableActionCell>
                      </tr>
                    ))}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>
        </div>

        <RightPanel title="Vencimentos" description="Acompanhamento comercial e técnico.">
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4">
            <div className="text-sm font-black text-white">Próximas ações</div>
            <div className="mt-3 grid gap-2 text-sm text-slate-400">
              <div className="flex justify-between gap-3"><span>Revisão de banda</span><span className="text-white">mensal</span></div>
              <div className="flex justify-between gap-3"><span>Validação de SLA</span><span className="text-white">semanal</span></div>
              <div className="flex justify-between gap-3"><span>Renovação</span><span className="text-white">30 dias</span></div>
            </div>
          </div>
          <div className="rounded-[12px] border border-white/[0.08] bg-[#070b10] p-4">
            <div className="text-sm font-black text-white">Unidades com contrato</div>
            <div className="mt-3 grid gap-2">
              {units.items.slice(0, 6).map((unit) => (
                <Link key={unit.id} href={`/unidades/${unit.id}`} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 text-sm hover:border-orange-300/30">
                  <div className="font-bold text-white">{unit.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{unit.partner.name} · {[unit.city, unit.state].filter(Boolean).join("/") || "sem cidade"}</div>
                </Link>
              ))}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
