"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import type { ActionFeedbackState } from "@/lib/action-state";
import type { UnitHostTelemetry, UnitHostTelemetryItem } from "@/lib/noc-overview";

type OperationalDataSummary = {
  sourceAvailable: boolean;
  message?: string;
  expectedPath?: string | null;
  generatedAt?: string;
  redactedSecrets?: boolean;
  summary?: {
    raw: Record<string, number>;
    normalized: Record<string, number>;
  };
  sources?: Record<string, string>;
};

type OperationalSignal = {
  backupLinks: number;
  links: number;
  phones: number;
  contracts: number;
  starlinks: number;
  equipments: number;
  hasMacOnu: boolean;
};

type OperationalReconciliation = {
  sourceAvailable: boolean;
  message?: string;
  expectedPath?: string | null;
  generatedAt?: string | null;
  redactedSecrets?: boolean;
  counts: {
    importedUnits: number;
    currentUnits: number;
    matchedUnits: number;
    weakUnitMatches: number;
    unmatchedImportedUnits: number;
    unmatchedCurrentUnits: number;
    importedPartners: number;
    currentPartners: number;
    matchedPartners: number;
    importedEquipments: number;
    currentEquipments: number;
    matchedEquipments: number;
    starlinks: number;
  };
  unmatchedImportedUnits: Array<{
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    bestScore: number;
    bestCurrentUnit: { id: string; code: string; name: string } | null;
    signal: OperationalSignal;
  }>;
  weakUnitMatches: Array<{
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    score: number;
    currentUnit: { id: string; code: string; name: string } | null;
    signal: OperationalSignal;
  }>;
  unmatchedCurrentUnits: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    partnerCode: string;
    partnerName: string;
  }>;
  unmatchedImportedPartners: Array<{
    code: string;
    name: string;
    contacts: number;
    primaryUnitCount: number;
    backupUnitCount: number;
  }>;
  unmatchedImportedEquipments: Array<{
    tag: string;
    name: string;
    type: string;
    serialNumber: string | null;
    unitCode: string;
    partnerCode: string;
    source: string;
  }>;
};

type Filters = {
  origin: string;
  type: string;
  status: string;
};

type DivergenceRow = {
  id: string;
  origin: "Base importada" | "Cadastro atual" | "Zabbix";
  type: "Unidade" | "Parceiro" | "Ativo" | "Host";
  status: "divergente" | "nao_encontrado" | "pendente" | "conciliado";
  systemA: string;
  systemB: string;
  difference: string;
  date: string;
  href: string;
  score: number;
};

type ReconciliationWorkspaceProps = {
  isAdmin: boolean;
  telemetry: UnitHostTelemetry;
  summary: OperationalDataSummary;
  reconciliation: OperationalReconciliation;
  syncAction: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
};

const DEFAULT_FILTERS: Filters = {
  origin: "Todas",
  type: "Todos",
  status: "Todos",
};

const STATUS_LABEL: Record<DivergenceRow["status"], string> = {
  divergente: "Divergente",
  nao_encontrado: "Não encontrado",
  pendente: "Pendente",
  conciliado: "Conciliado",
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summaryCount(summary: OperationalDataSummary, section: "raw" | "normalized", key: string) {
  return numberValue(summary.summary?.[section]?.[key]);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100).toLocaleString("pt-BR")}%`;
}

function matchLabel(item: UnitHostTelemetryItem) {
  if (item.match.status === "ambiguous") return `${item.match.candidates} candidatos`;
  if (item.match.status === "unmatched") return "host não encontrado";
  if (!item.match.syncReady) return "tag explícita ausente";
  return "pronto";
}

function buildRows(
  reconciliation: OperationalReconciliation,
  telemetry: UnitHostTelemetry,
) {
  const date = reconciliation.generatedAt || telemetry.generatedAt || new Date().toISOString();
  const rows: DivergenceRow[] = [];

  for (const unit of reconciliation.unmatchedImportedUnits || []) {
    rows.push({
      id: `imported-unit-${unit.partnerCode}-${unit.code}-${unit.name}`,
      origin: "Base importada",
      type: "Unidade",
      status: "nao_encontrado",
      systemA: `${unit.code || "sem código"} · ${unit.name}`,
      systemB: unit.bestCurrentUnit ? `${unit.bestCurrentUnit.code} · ${unit.bestCurrentUnit.name}` : "Sem cadastro atual",
      difference: unit.bestCurrentUnit ? `score ${unit.bestScore}` : "Não localizado",
      date,
      href: `/unidades/cadastro?from=imported&code=${encodeURIComponent(unit.code || "")}&name=${encodeURIComponent(unit.name || "")}&partnerCode=${encodeURIComponent(unit.partnerCode || "")}`,
      score: 90,
    });
  }

  for (const unit of reconciliation.weakUnitMatches || []) {
    rows.push({
      id: `weak-unit-${unit.partnerCode}-${unit.code}-${unit.score}`,
      origin: "Base importada",
      type: "Unidade",
      status: "divergente",
      systemA: `${unit.code || "sem código"} · ${unit.name}`,
      systemB: unit.currentUnit ? `${unit.currentUnit.code} · ${unit.currentUnit.name}` : "Sem candidato atual",
      difference: `match fraco: ${unit.score}`,
      date,
      href: unit.currentUnit ? `/unidades/${unit.currentUnit.id}` : "/unidades",
      score: 70,
    });
  }

  for (const partner of reconciliation.unmatchedImportedPartners || []) {
    rows.push({
      id: `partner-${partner.code}-${partner.name}`,
      origin: "Base importada",
      type: "Parceiro",
      status: "nao_encontrado",
      systemA: `${partner.code || "sem código"} · ${partner.name}`,
      systemB: "Sem parceiro atual",
      difference: `${partner.contacts} contato(s), ${partner.primaryUnitCount + partner.backupUnitCount} vínculo(s)`,
      date,
      href: "/parceiros/cadastro",
      score: 58,
    });
  }

  for (const equipment of reconciliation.unmatchedImportedEquipments || []) {
    rows.push({
      id: `equipment-${equipment.source}-${equipment.tag}-${equipment.serialNumber || ""}`,
      origin: "Base importada",
      type: "Ativo",
      status: "divergente",
      systemA: `${equipment.tag || "sem tag"} · ${equipment.name}`,
      systemB: equipment.unitCode || "Sem unidade vinculada",
      difference: equipment.serialNumber ? `serial ${equipment.serialNumber}` : "Sem serial para bater",
      date,
      href: "/ativos/cadastro",
      score: 52,
    });
  }

  for (const unit of reconciliation.unmatchedCurrentUnits || []) {
    rows.push({
      id: `current-unit-${unit.id}`,
      origin: "Cadastro atual",
      type: "Unidade",
      status: "pendente",
      systemA: `${unit.code} · ${unit.name}`,
      systemB: "Sem rastro na base importada",
      difference: `${unit.partnerCode} · ${unit.partnerName}`,
      date,
      href: `/unidades/${unit.id}`,
      score: 32,
    });
  }

  for (const item of telemetry.items || []) {
    if (item.match.status === "matched" && item.match.syncReady) continue;
    rows.push({
      id: `zabbix-${item.unit.id}-${item.match.status}-${item.match.hostId || item.match.host || ""}`,
      origin: "Zabbix",
      type: "Host",
      status: item.match.status === "ambiguous" ? "divergente" : "pendente",
      systemA: `${item.unit.code} · ${item.unit.name}`,
      systemB: item.match.hostName || item.match.host || "Sem host único",
      difference: matchLabel(item),
      date: telemetry.generatedAt,
      href: `/unidades/${item.unit.id}`,
      score: item.match.status === "ambiguous" ? 64 : 44,
    });
  }

  return rows.sort((a, b) => b.score - a.score || a.systemA.localeCompare(b.systemA));
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  if (!/[",\n\r;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: DivergenceRow[]) {
  const headers = ["origem", "tipo", "status", "sistema_a", "sistema_b", "diferenca", "data"];
  return [
    headers.join(";"),
    ...rows.map((row) =>
      [row.origin, row.type, STATUS_LABEL[row.status], row.systemA, row.systemB, row.difference, formatDateTime(row.date)]
        .map(csvEscape)
        .join(";"),
    ),
  ].join("\n");
}

function KpiCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string | number;
  meta: string;
  tone: "blue" | "green" | "orange" | "violet";
}) {
  return (
    <article className={`nova-recon-kpi is-${tone}`}>
      <div className="nova-recon-kpi-icon" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

export function ReconciliationWorkspace({
  isAdmin,
  telemetry,
  summary,
  reconciliation,
  syncAction,
}: ReconciliationWorkspaceProps) {
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => buildRows(reconciliation, telemetry), [reconciliation, telemetry]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.origin !== "Todas" && row.origin !== filters.origin) return false;
      if (filters.type !== "Todos" && row.type !== filters.type) return false;
      if (filters.status !== "Todos" && STATUS_LABEL[row.status] !== filters.status) return false;
      if (!query) return true;
      return [row.origin, row.type, row.systemA, row.systemB, row.difference, STATUS_LABEL[row.status]]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filters, rows, search]);

  const visibleRows = filteredRows.slice(0, 8);
  const notFound = rows.filter((row) => row.status === "nao_encontrado").length;
  const totalRecords =
    summaryCount(summary, "normalized", "units") +
    summaryCount(summary, "normalized", "partners") +
    summaryCount(summary, "normalized", "equipments") +
    summaryCount(summary, "normalized", "starlinksInstalled") +
    telemetry.counts.units;
  const reconciled =
    reconciliation.counts.matchedUnits +
    reconciliation.counts.matchedPartners +
    reconciliation.counts.matchedEquipments +
    telemetry.counts.syncReady;
  const groups = ["Unidade", "Host", "Ativo", "Parceiro"].map((type) => ({
    type,
    count: rows.filter((row) => row.type === type).length,
  }));
  const groupTotal = Math.max(1, groups.reduce((total, item) => total + item.count, 0));
  let start = 0;
  const colors = ["#4f8cff", "#52d273", "#ff9f1c", "#9b6cff"];
  const gradient = groups
    .map((item, index) => {
      const size = (item.count / groupTotal) * 100;
      const segment = `${colors[index]} ${start}% ${start + size}%`;
      start += size;
      return segment;
    })
    .join(", ");

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  }

  function exportCsv() {
    downloadFile("nova-divergencias-reconciliacao.csv", rowsToCsv(filteredRows), "text/csv;charset=utf-8");
  }

  function exportJson() {
    downloadFile("nova-divergencias-reconciliacao.json", JSON.stringify(filteredRows, null, 2), "application/json;charset=utf-8");
  }

  function exportExcel() {
    const table = `<table><thead><tr><th>Origem</th><th>Tipo</th><th>Status</th><th>Sistema A</th><th>Sistema B</th><th>Diferenca</th><th>Data</th></tr></thead><tbody>${filteredRows
      .map(
        (row) =>
          `<tr><td>${row.origin}</td><td>${row.type}</td><td>${STATUS_LABEL[row.status]}</td><td>${row.systemA}</td><td>${row.systemB}</td><td>${row.difference}</td><td>${formatDateTime(row.date)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
    downloadFile("nova-divergencias-reconciliacao.xls", table, "application/vnd.ms-excel;charset=utf-8");
  }

  return (
    <div className="nova-recon-workspace">
      <header className="nova-recon-hero">
        <div>
          <div className="nova-recon-breadcrumb">Configurações / Reconciliação</div>
          <h1>Reconciliação</h1>
          <p>Cruze bases, identifique divergências e trate pendências operacionais.</p>
        </div>
        <div className="nova-recon-actions">
          <button type="button" onClick={() => window.location.reload()}>Atualizar dados</button>
          <button type="button" className="is-primary" onClick={resetFilters}>Nova análise</button>
        </div>
      </header>

      <section className="nova-recon-kpi-grid">
        <KpiCard label="Total de registros" value={totalRecords.toLocaleString("pt-BR")} meta="cadastro, importado e Zabbix" tone="blue" />
        <KpiCard label="Conciliados" value={reconciled.toLocaleString("pt-BR")} meta={`${formatPercent(reconciled, totalRecords)} dos registros`} tone="green" />
        <KpiCard label="Divergências" value={rows.length.toLocaleString("pt-BR")} meta={`${filteredRows.length} no filtro atual`} tone="orange" />
        <KpiCard label="Não encontrados" value={notFound.toLocaleString("pt-BR")} meta="sem vínculo seguro" tone="violet" />
      </section>

      <section className="nova-recon-filters">
        <div className="nova-recon-section-title">
          <span>Filtros</span>
          <strong>Controle a fila de divergências</strong>
        </div>
        <label>
          Origem
          <select value={draftFilters.origin} onChange={(event) => setDraftFilters((current) => ({ ...current, origin: event.target.value }))}>
            {["Todas", "Base importada", "Cadastro atual", "Zabbix"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select value={draftFilters.type} onChange={(event) => setDraftFilters((current) => ({ ...current, type: event.target.value }))}>
            {["Todos", "Unidade", "Host", "Ativo", "Parceiro"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}>
            {["Todos", "Divergente", "Não encontrado", "Pendente", "Conciliado"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Período
          <input value={formatDateTime(reconciliation.generatedAt || telemetry.generatedAt)} readOnly />
        </label>
        <div className="nova-recon-filter-actions">
          <button type="button" onClick={resetFilters}>Limpar filtros</button>
          <button type="button" className="is-primary" onClick={() => setFilters(draftFilters)}>Aplicar filtros</button>
        </div>
      </section>

      <section className="nova-recon-content-grid">
        <div className="nova-recon-table-card">
          <div className="nova-recon-table-head">
            <div>
              <span>Divergências</span>
              <strong>Total {filteredRows.length.toLocaleString("pt-BR")} divergência(s)</strong>
            </div>
            <div className="nova-recon-table-tools">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar divergência..."
              />
              <button type="button" onClick={() => setFilters(draftFilters)}>Filtrar</button>
              <button type="button" onClick={resetFilters}>•••</button>
            </div>
          </div>
          <div className="nova-recon-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Tipo</th>
                  <th>Sistema A</th>
                  <th>Sistema B</th>
                  <th>Diferença</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.origin}</td>
                    <td>{row.type}</td>
                    <td>{row.systemA}</td>
                    <td>{row.systemB}</td>
                    <td><span className={`nova-recon-status is-${row.status}`}>{row.difference}</span></td>
                    <td>{formatDateTime(row.date)}</td>
                    <td>
                      <Link href={row.href}>Abrir</Link>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>Nenhuma divergência encontrada com os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="nova-recon-pagination">
            <span>Mostrando {visibleRows.length ? `1 a ${visibleRows.length}` : "0"} de {filteredRows.length.toLocaleString("pt-BR")} resultado(s)</span>
            <div>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
            </div>
          </div>
        </div>

        <aside className="nova-recon-side">
          <div className="nova-recon-side-card">
            <div className="nova-recon-section-title">
              <span>Exportar divergências</span>
              <strong>Baixe os dados filtrados</strong>
            </div>
            <button type="button" onClick={exportCsv}>Exportar CSV</button>
            <button type="button" onClick={exportExcel}>Exportar Excel</button>
            <button type="button" onClick={() => window.print()}>Exportar PDF</button>
            <button type="button" onClick={exportJson}>Exportar JSON</button>
          </div>

          <div className="nova-recon-side-card">
            <div className="nova-recon-section-title">
              <span>Resumo</span>
              <strong>{rows.length.toLocaleString("pt-BR")} total</strong>
            </div>
            <div className="nova-recon-donut-row">
              <div className="nova-recon-donut" style={{ background: `conic-gradient(${gradient || "#1f2937 0 100%"})` }}>
                <span>{rows.length}</span>
                <small>total</small>
              </div>
              <div className="nova-recon-legend">
                {groups.map((item, index) => (
                  <div key={item.type}>
                    <i style={{ background: colors[index] }} />
                    <span>{item.type}</span>
                    <strong>{item.count} ({Math.round((item.count / groupTotal) * 100)}%)</strong>
                  </div>
                ))}
              </div>
            </div>
            {isAdmin && telemetry.counts.syncReady > 0 ? (
              <ActionForm
                action={syncAction}
                submitLabel="Sincronizar prontos"
                pendingLabel="Sincronizando..."
                variant="secondary"
                className="nova-recon-sync-form"
              >
                <p>{telemetry.counts.syncReady} host(s) com tag explícita podem ser sincronizados com segurança.</p>
              </ActionForm>
            ) : (
              <button type="button" onClick={() => window.print()}>Ver relatório completo</button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
