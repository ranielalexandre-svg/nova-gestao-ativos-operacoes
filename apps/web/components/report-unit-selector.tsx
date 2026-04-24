"use client";

import { useMemo, useState } from "react";

type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  partner: {
    id: string;
    code: string;
    name: string;
  };
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function unitLabel(unit: UnitOption) {
  return `${unit.code} - ${unit.name}`;
}

function unitMeta(unit: UnitOption) {
  const locality = [unit.city, unit.state].filter(Boolean).join("/");
  return [unit.partner.code, locality].filter(Boolean).join(" · ");
}

function matches(unit: UnitOption, search: string) {
  if (!search) return true;
  const haystack = normalize([
    unit.code,
    unit.name,
    unit.partner.code,
    unit.partner.name,
    unit.city || "",
    unit.state || "",
  ].join(" "));
  return haystack.includes(normalize(search));
}

export function ReportFocusUnitField({
  name,
  units,
  initialSelectedId,
  label = "Unidade",
  helpText,
}: {
  name: string;
  units: UnitOption[];
  initialSelectedId?: string;
  label?: string;
  helpText?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialSelectedId || units[0]?.id || "");

  const filteredUnits = useMemo(() => units.filter((unit) => matches(unit, search)).slice(0, 10), [search, units]);

  return (
    <div className="grid gap-2 text-sm font-semibold text-slate-200 self-start">
      <span>{label}</span>
      {helpText ? <span className="text-xs font-normal text-slate-400">{helpText}</span> : null}
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar unidade"
      />
      <div className="overflow-hidden rounded-[14px] border border-white/10 bg-black/10">
        <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Unidade</span>
          <span>Parceiro / local</span>
        </div>
        <div className="max-h-44 overflow-y-auto divide-y divide-white/5">
          {filteredUnits.length ? (
            filteredUnits.map((unit) => {
              const active = unit.id === selectedId;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedId(unit.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_140px] gap-3 px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-sky-500/10 text-sky-50"
                      : "text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="truncate font-medium">{unitLabel(unit)}</span>
                  <span className="truncate text-xs text-slate-400">{unitMeta(unit) || "-"}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-xs text-slate-500">Nenhuma unidade encontrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReportUnitBatchSelector({
  name,
  units,
  initialSelectedIds,
  title = "Lote",
  description = "Marque as unidades que devem sair no relatório.",
}: {
  name: string;
  units: UnitOption[];
  initialSelectedIds: string[];
  title?: string;
  description?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const seen = new Set<string>();
    return initialSelectedIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

  const filteredUnits = useMemo(() => units.filter((unit) => matches(unit, search)).slice(0, 120), [search, units]);

  function toggleUnit(unitId: string) {
    setSelectedIds((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }

  const selectedUnits = selectedIds
    .map((id) => units.find((unit) => unit.id === id))
    .filter((unit): unit is UnitOption => Boolean(unit));

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
      {selectedIds.map((unitId) => (
        <input key={`hidden-${unitId}`} type="hidden" name={name} value={unitId} />
      ))}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{description}</div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedIds.length ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-50" : "border-amber-500/20 bg-amber-500/10 text-amber-50"}`}>
          {selectedIds.length} unidade(s)
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-semibold text-slate-200 self-start">
          Buscar unidade
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, código, parceiro ou cidade"
          />
          <div className="rounded-[14px] border border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-400">
            {selectedUnits.length
              ? `Selecionadas: ${selectedUnits
                  .slice(0, 4)
                  .map((unit) => unit.code)
                  .join(", ")}${selectedUnits.length > 4 ? ` +${selectedUnits.length - 4}` : ""}`
              : "Nenhuma unidade marcada no lote."}
          </div>
        </label>

        <div className="overflow-hidden rounded-[14px] border border-white/10 bg-black/10">
          <div className="grid grid-cols-[42px_minmax(0,1.1fr)_180px] gap-3 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>OK</span>
            <span>Unidade</span>
            <span>Parceiro / local</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {filteredUnits.length ? (
              filteredUnits.map((unit) => {
                const checked = selectedIds.includes(unit.id);
                return (
                  <label
                    key={unit.id}
                    className={`grid cursor-pointer grid-cols-[42px_minmax(0,1.1fr)_180px] gap-3 px-3 py-2 text-sm transition ${
                      checked ? "bg-emerald-500/8 text-emerald-50" : "text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="flex items-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnit(unit.id)}
                        className="h-4 w-4"
                      />
                    </span>
                    <span className="truncate font-medium">{unitLabel(unit)}</span>
                    <span className="truncate text-xs text-slate-400">{unitMeta(unit) || "-"}</span>
                  </label>
                );
              })
            ) : (
              <div className="px-3 py-3 text-xs text-slate-500">Nenhuma unidade encontrada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
