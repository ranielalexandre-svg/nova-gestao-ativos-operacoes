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
  label = "Unidade em foco",
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

  const selectedUnit = units.find((unit) => unit.id === selectedId) || null;
  const filteredUnits = useMemo(() => {
    const found = units.filter((unit) => matches(unit, search));
    return found.slice(0, 8);
  }, [search, units]);

  return (
    <div className="grid gap-2 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {helpText ? <span className="text-xs font-normal text-slate-400">{helpText}</span> : null}
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={selectedUnit ? unitLabel(selectedUnit) : "Buscar unidade"}
      />
      {selectedUnit ? (
        <div className="rounded-[14px] border border-sky-500/20 bg-sky-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-sky-50">{unitLabel(selectedUnit)}</div>
          <div className="mt-1 text-xs text-sky-100/80">{unitMeta(selectedUnit) || "Sem parceiro/localidade"}</div>
        </div>
      ) : null}
      <div className="rounded-[16px] border border-white/10 bg-black/10 p-2">
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {filteredUnits.length ? (
            filteredUnits.map((unit) => {
              const active = unit.id === selectedId;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedId(unit.id)}
                  className={`w-full rounded-[12px] border px-3 py-3 text-left transition ${
                    active
                      ? "border-sky-500/28 bg-sky-500/14 text-sky-50"
                      : "border-white/8 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="text-sm font-semibold">{unitLabel(unit)}</div>
                  <div className="mt-1 text-xs text-slate-400">{unitMeta(unit) || "Sem parceiro/localidade"}</div>
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
  title = "Lote atual",
  description = "Busque, adicione ou remova unidades sem precisar usar Ctrl/Cmd.",
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

  const selectedUnits = useMemo(
    () => selectedIds.map((id) => units.find((unit) => unit.id === id)).filter((unit): unit is UnitOption => Boolean(unit)),
    [selectedIds, units],
  );

  const filteredUnits = useMemo(() => {
    const selected = new Set(selectedIds);
    return units.filter((unit) => !selected.has(unit.id) && matches(unit, search)).slice(0, 10);
  }, [search, selectedIds, units]);

  function addUnit(unitId: string) {
    setSelectedIds((current) => (current.includes(unitId) ? current : [...current, unitId]));
  }

  function removeUnit(unitId: string) {
    setSelectedIds((current) => current.filter((id) => id !== unitId));
  }

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

      <div className="mt-4 flex flex-wrap gap-2">
        {selectedUnits.length ? (
          selectedUnits.map((unit) => (
            <button
              key={`selected-${unit.id}`}
              type="button"
              onClick={() => removeUnit(unit.id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs text-slate-200 transition hover:bg-black/25"
            >
              <span>{unitLabel(unit)}</span>
              <span className="text-slate-500">×</span>
            </button>
          ))
        ) : (
          <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            Nenhuma unidade no lote. Use a busca abaixo para montar a exportação.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Buscar unidade
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, código, parceiro ou cidade"
          />
        </label>

        <div className="rounded-[16px] border border-white/10 bg-black/10 p-2">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {filteredUnits.length ? (
              filteredUnits.map((unit) => (
                <button
                  key={`available-${unit.id}`}
                  type="button"
                  onClick={() => addUnit(unit.id)}
                  className="w-full rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-3 text-left text-slate-200 transition hover:bg-white/[0.06]"
                >
                  <div className="text-sm font-semibold">{unitLabel(unit)}</div>
                  <div className="mt-1 text-xs text-slate-400">{unitMeta(unit) || "Sem parceiro/localidade"}</div>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-slate-500">Nenhuma unidade encontrada para adicionar.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
