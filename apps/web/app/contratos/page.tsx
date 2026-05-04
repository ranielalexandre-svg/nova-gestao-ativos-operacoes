import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarList, DenseTable, RightPanel, StatCard, Surface, TableActionCell, TableActionHeader, TableActionLink, TableCell, TableHead, TableShell, TonePill } from "@/components/ops-ui";
import { safeApiJson } from "@/lib/noc-overview";
import type { PaginatedResponse } from "@/lib/list-query";
import { getServerWebSession } from "@/lib/web-session";

type PartnerRow = { id: string; code: string; name: string; isActive: boolean; _count?: { units: number } };
type UnitRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  reportContractLabel: string | null;
  reportAddressLine: string | null;
  reportContractedBandwidth: string | null;
  reportNotes: string | null;
  partner: { id: string; code: string; name: string };
};
type ReportUnitsResponse = { total: number; items: UnitRow[] };

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function contractComplete(unit: UnitRow) {
  return hasText(unit.reportContractLabel) && hasText(unit.reportContractedBandwidth) && hasText(unit.reportAddressLine);
}

function unitHasMetadata(unit: UnitRow) {
  return hasText(unit.reportContractLabel) || hasText(unit.reportContractedBandwidth) || hasText(unit.reportAddressLine);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function compactValues(values: string[], fallback: string) {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  return `${values[0]} +${values.length - 1}`;
}

function locationLabel(unit: UnitRow) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "sem cidade";
}

export default async function ContratosPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/contratos");

  const [partners, units] = await Promise.all([
    safeApiJson<PaginatedResponse<PartnerRow>>("/partners?page=1&pageSize=100&sortBy=code&sortDir=asc", { items: [], meta: { total: 0, page: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false } }),
    safeApiJson<ReportUnitsResponse>("/monitoring/reports/units", { total: 0, items: [] }),
  ]);

  const activePartners = partners.items.filter((item) => item.isActive).length;
  const unitsWithContract = units.items.filter(unitHasMetadata).length;
  const completeUnits = units.items.filter(contractComplete).length;
  const missingContractData = units.items.filter((unit) => !contractComplete(unit)).length;
  const unitsByPartner = new Map<string, UnitRow[]>();

  for (const unit of units.items) {
    const current = unitsByPartner.get(unit.partner.id) || [];
    current.push(unit);
    unitsByPartner.set(unit.partner.id, current);
  }

  const metadataBars = [
    { label: "Contrato", value: units.items.filter((unit) => hasText(unit.reportContractLabel)).length, tone: "info" },
    { label: "Banda", value: units.items.filter((unit) => hasText(unit.reportContractedBandwidth)).length, tone: "success" },
    { label: "Endereço", value: units.items.filter((unit) => hasText(unit.reportAddressLine)).length, tone: "attention" },
  ];
  const pendingUnits = units.items.filter((unit) => !contractComplete(unit)).slice(0, 7);
  const readyUnits = units.items.filter(contractComplete).slice(0, 6);

  return (
    <AppShell title="Contratos" subtitle="Visão comercial e operacional de parceiros, bandas, metadados de relatório e cobertura.">
      <section className="nova-side-grid nova-side-grid--360">
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-4">
            <StatCard label="Parceiros" value={partners.meta.total} detail="contratos operacionais" tone="info" />
            <StatCard label="Ativos" value={activePartners} detail="disponíveis para novas unidades" tone="success" />
            <StatCard label="Unidades" value={units.total} detail={`${unitsWithContract} com metadado de contrato`} tone="neutral" />
            <StatCard label="Pendências" value={missingContractData} detail={`${completeUnits} prontas para relatório`} tone={missingContractData ? "attention" : "success"} />
          </div>

          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="nds-label">Contratos</div>
                <h2 className="mt-1 text-[15px] font-black text-white">Carteira operacional</h2>
              </div>
              <Link href="/parceiros/nova" className="nds-button" data-variant="primary">Novo parceiro</Link>
            </div>
            <div className="mt-2">
              <TableShell>
                <DenseTable>
                  <TableHead><tr><th className="px-3 py-2">Contrato</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Cobertura</th><th className="px-3 py-2">Banda</th><th className="px-3 py-2">Status</th><TableActionHeader /></tr></TableHead>
                  <tbody>
                    {partners.items.map((partner) => {
                      const partnerUnits = unitsByPartner.get(partner.id) || [];
                      const contractLabels = uniqueValues(partnerUnits.map((unit) => unit.reportContractLabel));
                      const bandwidths = uniqueValues(partnerUnits.map((unit) => unit.reportContractedBandwidth));
                      const partnerMissing = partnerUnits.filter((unit) => !contractComplete(unit)).length;

                      return (
                        <tr key={partner.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
                          <TableCell>
                            <div className="font-bold text-white">{compactValues(contractLabels, "Sem contrato cadastrado")}</div>
                            <div className="mt-1 text-[10px] text-slate-500">{contractLabels.length ? "metadado de relatório" : "preencher na unidade"}</div>
                          </TableCell>
                          <TableCell><Link href={`/parceiros/${partner.id}`} className="font-bold text-white hover:text-white">{partner.name}</Link><div className="mt-1 text-[10px] text-slate-500">{partner.code}</div></TableCell>
                          <TableCell>
                            <div className="text-slate-300">{partner._count?.units ?? partnerUnits.length} unidade(s)</div>
                            {partnerUnits.length ? <div className="mt-1 text-[10px] text-slate-500">{partnerUnits.length} ativa(s) no relatório</div> : null}
                          </TableCell>
                          <TableCell className="text-slate-300">{compactValues(bandwidths, "não informada")}</TableCell>
                          <TableCell><TonePill tone={!partner.isActive ? "subtle" : partnerMissing ? "attention" : "success"}>{!partner.isActive ? "inativo" : partnerMissing ? "incompleto" : "pronto"}</TonePill></TableCell>
                          <TableActionCell><TableActionLink href={`/parceiros/${partner.id}`}>Abrir</TableActionLink></TableActionCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </DenseTable>
              </TableShell>
            </div>
          </Surface>
        </div>

        <RightPanel title="Governança" description="Metadados usados na emissão dos relatórios.">
          <div className="nds-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-black text-white">Cobertura de metadados</div>
                <div className="mt-1 text-[11px] text-slate-500">{completeUnits}/{units.total} unidade(s) completas</div>
              </div>
              <TonePill tone={missingContractData ? "attention" : "success"}>{missingContractData ? "atenção" : "ok"}</TonePill>
            </div>
            <div className="mt-2">
              <BarList data={metadataBars} max={Math.max(1, units.total)} emptyLabel="Nenhuma unidade ativa para relatório." />
            </div>
          </div>
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Pendências</div>
            <div className="mt-2 grid gap-2">
              {pendingUnits.length ? pendingUnits.map((unit) => (
                <Link key={unit.id} href={`/unidades/${unit.id}`} className="nova-micro-link text-[11px]">
                  <div className="font-bold text-white">{unit.name}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{unit.partner.name} · {locationLabel(unit)}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {!hasText(unit.reportContractLabel) ? <TonePill tone="attention">contrato</TonePill> : null}
                    {!hasText(unit.reportContractedBandwidth) ? <TonePill tone="attention">banda</TonePill> : null}
                    {!hasText(unit.reportAddressLine) ? <TonePill tone="attention">endereço</TonePill> : null}
                  </div>
                </Link>
              )) : <div className="text-[11px] text-slate-500">Nenhuma pendência de metadado encontrada.</div>}
            </div>
          </div>
          <div className="nds-card">
            <div className="text-[12px] font-black text-white">Unidades prontas</div>
            <div className="mt-2 grid gap-2">
              {readyUnits.length ? readyUnits.map((unit) => (
                <Link key={unit.id} href={`/unidades/${unit.id}`} className="nova-micro-link text-[11px]">
                  <div className="font-bold text-white">{unit.name}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{unit.reportContractLabel} · {unit.reportContractedBandwidth}</div>
                </Link>
              )) : <div className="text-[11px] text-slate-500">Complete contrato, banda e endereço nas unidades.</div>}
            </div>
          </div>
        </RightPanel>
      </section>
    </AppShell>
  );
}
