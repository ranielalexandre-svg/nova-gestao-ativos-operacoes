import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type LegacyLink = {
  legacyId: string;
  partnerCode: string;
  serviceType: string;
  connectionType: string;
  routerPort: string;
  technology: string;
  latency: string;
  macOnu: string;
  phone: string;
  notes: string;
  contractIxc: string;
};

export type LegacyPartnerContact = {
  legacyId: string;
  city: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
};

export type LegacyPartner = {
  code: string;
  name: string;
  contacts: LegacyPartnerContact[];
  legacyContactIds: string[];
  primaryUnitCount: number;
  backupUnitCount: number;
};

export type LegacyUnit = {
  key: string;
  code: string;
  name: string;
  group: string;
  city: string;
  state: string;
  partnerCode: string;
  legacyContactIds: string[];
  links: LegacyLink[];
  backupLinks: LegacyLink[];
  phones: string[];
  contracts: string[];
  notes: string[];
};

export type LegacyEquipment = {
  tag: string;
  name: string;
  type: string;
  serialNumber: string;
  status: string;
  unitKey: string;
  unitCode: string;
  partnerCode: string;
  source: string;
  legacyId: string;
};

export type LegacyStarlink = {
  legacyId: string;
  antennaId: string;
  email: string;
  password?: string;
  plan: string;
  card: string;
  localRaw?: string;
  localLegacyContactId?: string;
  localName: string;
  unitKey: string;
  kitSerial: string;
  antennaSerial: string;
  ipvpn: string;
  installer: string;
  installedAt: string;
  notes: string;
};

export type LegacyStarlinkHistory = {
  legacyId: string;
  starlinkLegacyId: string;
  action: string;
  details: string;
  user: string;
  datetime: string;
};

export type LegacyBundle = {
  version: number;
  generatedAt: string;
  redactedSecrets: boolean;
  sources: Record<string, string>;
  summary: {
    raw: Record<string, number>;
    normalized: Record<string, number>;
  };
  normalized: {
    partners: LegacyPartner[];
    units: LegacyUnit[];
    equipments: LegacyEquipment[];
    starlinks: LegacyStarlink[];
    starlinkHistory: LegacyStarlinkHistory[];
  };
};

export type LegacySignal = {
  backupLinks: number;
  links: number;
  phones: number;
  contracts: number;
  starlinks: number;
  equipments: number;
  hasMacOnu: boolean;
};

type BundleState =
  | { available: true; path: string; bundle: LegacyBundle }
  | { available: false; path: string | null; message: string };

type CurrentUnit = {
  id?: string;
  code: string;
  name: string;
  city: string | null;
  state?: string | null;
  partner: { code: string; name: string };
};

type CurrentPartner = {
  id?: string;
  code: string;
  name: string;
};

type CurrentEquipment = {
  id?: string;
  tag: string;
  name?: string;
  serialNumber: string | null;
  unit?: { id?: string; code: string; name: string };
};

export type LegacyMonitorContextItem = {
  unitId: string;
  unitCode: string;
  unitName: string;
  matched: boolean;
  partnerCode: string | null;
  phones: string[];
  contracts: string[];
  technologies: string[];
  latencies: string[];
  hasBackup: boolean;
  backupCount: number;
  starlinks: number;
  equipments: number;
  hasMacOnu: boolean;
  macOnuCount: number;
  notes: string[];
};

export type LegacyMonitorContextResult = {
  sourceAvailable: boolean;
  generatedAt?: string;
  redactedSecrets?: boolean;
  expectedPath?: string | null;
  message?: string;
  counts: {
    matchedUnits: number;
    withPhones: number;
    withBackup: number;
    withStarlink: number;
    withMacOnu: number;
    withoutContext: number;
  };
  items: Record<string, LegacyMonitorContextItem>;
};

export type LegacyPartnerDeskItem = {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  matched: boolean;
  cityBase: string | null;
  contactName: string | null;
  contactRole: string | null;
  phones: string[];
  coverage: string | null;
  primaryUnitCount: number;
  backupUnitCount: number;
  unitCount: number;
};

export type LegacyEquipmentDeskItem = {
  equipmentId: string;
  tag: string;
  matched: boolean;
  source: string | null;
  serialOrMac: string | null;
  legacyUnitCode: string | null;
  partnerCode: string | null;
  starlinkCount: number;
  installedAt: string | null;
  ipvpn: string | null;
  antennaId: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanCode(value: string, fallback: string) {
  const code = (value || fallback)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return code || fallback;
}

function candidatePaths() {
  const cwd = process.cwd();

  return [
    process.env.NOVA_LEGACY_IMPORT_PATH,
    resolve(cwd, "tmp/legacy-import.json"),
    resolve(cwd, "tmp/legacy/legacy-import.json"),
    resolve(cwd, ".run-logs/legacy-import.json"),
    resolve(cwd, "../.run-logs/legacy-import.json"),
    resolve(cwd, "../../.run-logs/legacy-import.json"),
  ].filter((item): item is string => Boolean(item));
}

async function loadLegacyBundle(): Promise<BundleState> {
  const candidates = candidatePaths();

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf-8");
      return {
        available: true,
        path: candidate,
        bundle: JSON.parse(raw) as LegacyBundle,
      };
    } catch {}
  }

  return {
    available: false,
    path: candidates[0] || null,
    message: "Pacote legado não encontrado. Gere ou copie .run-logs/legacy-import.json.",
  };
}

function buildLegacyUnitCodeMap(bundle: LegacyBundle) {
  const baseCounts = new Map<string, number>();
  const used = new Set<string>();
  const codeByKey = new Map<string, string>();

  for (const unit of bundle.normalized.units) {
    const base = cleanCode(unit.code, `LEGACY-UNIT-${unit.key}`);
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  }

  for (const unit of bundle.normalized.units) {
    const base = cleanCode(unit.code, `LEGACY-UNIT-${unit.key}`);
    const duplicated = (baseCounts.get(base) || 0) > 1;
    const suffix = cleanCode(unit.city || unit.group || unit.key, "ITEM");
    const root = duplicated ? `${base}-${suffix}` : base;
    let candidate = root;
    let counter = 2;

    while (used.has(candidate)) {
      candidate = `${root}-${counter}`;
      counter += 1;
    }

    used.add(candidate);
    codeByKey.set(unit.key, candidate);
  }

  return codeByKey;
}

function partnerMatch(bundle: LegacyBundle, partner: { code: string; name: string }) {
  const partnerCode = normalize(partner.code);
  const partnerName = normalize(partner.name);

  return (
    bundle.normalized.partners.find((legacyPartner) => normalize(legacyPartner.code) === partnerCode) ||
    bundle.normalized.partners.find((legacyPartner) => normalize(legacyPartner.name) === partnerName) ||
    null
  );
}

function scoreLegacyUnit(legacyUnit: LegacyUnit, unit: CurrentUnit, resolvedCode: string) {
  const legacyCode = normalize(legacyUnit.code);
  const importedCode = normalize(resolvedCode);
  const legacyName = normalize(legacyUnit.name);
  const legacyCity = normalize(legacyUnit.city);
  const legacyState = normalize(legacyUnit.state);
  const legacyPartner = normalize(legacyUnit.partnerCode);

  const unitCode = normalize(unit.code);
  const unitName = normalize(unit.name);
  const unitCity = normalize(unit.city);
  const unitState = normalize(unit.state);
  const unitPartnerCode = normalize(unit.partner.code);
  const unitPartnerName = normalize(unit.partner.name);

  return (
    (importedCode && importedCode === unitCode ? 140 : 0) +
    (legacyCode && legacyCode === unitCode ? 100 : 0) +
    (legacyName && legacyName === unitName ? 80 : 0) +
    (legacyName && unitName && (legacyName.includes(unitName) || unitName.includes(legacyName)) ? 42 : 0) +
    (legacyCity && legacyCity === unitCity ? 18 : 0) +
    (legacyState && legacyState === unitState ? 8 : 0) +
    (legacyPartner && (legacyPartner === unitPartnerCode || legacyPartner === unitPartnerName) ? 12 : 0)
  );
}

function bestUnitMatch(bundle: LegacyBundle, unit: CurrentUnit) {
  const codeByKey = buildLegacyUnitCodeMap(bundle);
  const unitCode = normalize(unit.code);

  const exactByImportedCode = bundle.normalized.units.find((legacyUnit) => {
    const importedCode = codeByKey.get(legacyUnit.key) || legacyUnit.code;
    return normalize(importedCode) === unitCode;
  });
  if (exactByImportedCode) return exactByImportedCode;

  const matches = bundle.normalized.units
    .map((legacyUnit) => ({
      legacyUnit,
      score: scoreLegacyUnit(legacyUnit, unit, codeByKey.get(legacyUnit.key) || legacyUnit.code),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.legacyUnit || null;
}

function starlinksForUnit(bundle: LegacyBundle, legacyUnit: LegacyUnit | null, unit: { name: string }) {
  const unitName = normalize(unit.name);

  return bundle.normalized.starlinks.filter((starlink) => {
    if (legacyUnit && starlink.unitKey === legacyUnit.key) return true;
    const localName = normalize(starlink.localName);
    return Boolean(localName && unitName && (localName.includes(unitName) || unitName.includes(localName)));
  });
}

function historyForStarlinks(bundle: LegacyBundle, starlinks: LegacyStarlink[]) {
  const ids = new Set(starlinks.map((item) => item.legacyId));
  return bundle.normalized.starlinkHistory.filter((item) => ids.has(item.starlinkLegacyId));
}

function equipmentsForUnit(bundle: LegacyBundle, legacyUnit: LegacyUnit | null, starlinks: LegacyStarlink[]) {
  const starlinkIds = new Set(starlinks.map((item) => item.legacyId));

  return bundle.normalized.equipments.filter((equipment) => {
    if (legacyUnit && equipment.unitKey === legacyUnit.key) return true;
    return equipment.source === "starlinks" && starlinkIds.has(equipment.legacyId);
  });
}

function legacyUnitSignal(bundle: LegacyBundle, legacyUnit: LegacyUnit) {
  const starlinks = starlinksForUnit(bundle, legacyUnit, { name: legacyUnit.name });
  const equipments = equipmentsForUnit(bundle, legacyUnit, starlinks);

  return {
    backupLinks: legacyUnit.backupLinks.length,
    links: legacyUnit.links.length,
    phones: legacyUnit.phones.length,
    contracts: legacyUnit.contracts.length,
    starlinks: starlinks.length,
    equipments: equipments.length,
    hasMacOnu:
      legacyUnit.links.some((link) => Boolean(link.macOnu)) ||
      legacyUnit.backupLinks.some((link) => Boolean(link.macOnu)),
  } satisfies LegacySignal;
}

function emptyReconciliation(message: string, expectedPath: string | null = null) {
  return {
    sourceAvailable: false,
    message,
    expectedPath,
    generatedAt: null,
    redactedSecrets: true,
    counts: {
      legacyUnits: 0,
      currentUnits: 0,
      matchedUnits: 0,
      weakUnitMatches: 0,
      unmatchedLegacyUnits: 0,
      unmatchedCurrentUnits: 0,
      legacyPartners: 0,
      currentPartners: 0,
      matchedPartners: 0,
      legacyEquipments: 0,
      currentEquipments: 0,
      matchedEquipments: 0,
      starlinks: 0,
    },
    unmatchedLegacyUnits: [],
    weakUnitMatches: [],
    unmatchedCurrentUnits: [],
    unmatchedLegacyPartners: [],
    unmatchedLegacyEquipments: [],
  };
}

export async function getLegacySummary() {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      message: state.message,
      expectedPath: state.path,
    };
  }

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    summary: state.bundle.summary,
    sources: state.bundle.sources,
  };
}

export async function getLegacyUnitProfileForUnit(unit: CurrentUnit) {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      message: state.message,
      unit: null,
      partner: null,
      links: [],
      backupLinks: [],
      partnerContacts: [],
      starlinks: [],
      starlinkHistory: [],
      equipments: [],
    };
  }

  const legacyUnit = bestUnitMatch(state.bundle, unit);
  const partner = partnerMatch(state.bundle, unit.partner);
  const starlinks = starlinksForUnit(state.bundle, legacyUnit, unit);
  const starlinkHistory = historyForStarlinks(state.bundle, starlinks);
  const equipments = equipmentsForUnit(state.bundle, legacyUnit, starlinks);

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    unit: legacyUnit,
    partner,
    links: legacyUnit?.links || [],
    backupLinks: legacyUnit?.backupLinks || [],
    partnerContacts: partner?.contacts || [],
    starlinks,
    starlinkHistory,
    equipments,
  };
}

export async function getLegacyPartnerProfileForPartner(partner: CurrentPartner) {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      message: state.message,
      partner: null,
      contacts: [],
      units: [],
    };
  }

  const legacyPartner = partnerMatch(state.bundle, partner);
  const units = legacyPartner
    ? state.bundle.normalized.units.filter((unit) => unit.partnerCode === legacyPartner.code)
    : [];

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    partner: legacyPartner,
    contacts: legacyPartner?.contacts || [],
    units,
  };
}

export async function getLegacyPartnerDeskForPartners(
  partners: CurrentPartner[],
): Promise<{
  sourceAvailable: boolean;
  generatedAt?: string;
  redactedSecrets?: boolean;
  expectedPath?: string | null;
  message?: string;
  items: Record<string, LegacyPartnerDeskItem>;
}> {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      expectedPath: state.path,
      message: state.message,
      items: {},
    };
  }

  const items: Record<string, LegacyPartnerDeskItem> = {};

  for (const partner of partners) {
    const legacyPartner = partnerMatch(state.bundle, partner);
    const units = legacyPartner
      ? state.bundle.normalized.units.filter((unit) => unit.partnerCode === legacyPartner.code)
      : [];
    const cities = Array.from(new Set(units.map((unit) => unit.city).filter(Boolean)));
    const phones = Array.from(
      new Set(
        [
          ...(legacyPartner?.contacts.map((contact) => contact.phone) || []),
          ...units.flatMap((unit) => unit.phones),
          ...units.flatMap((unit) => unit.links.map((link) => link.phone)),
          ...units.flatMap((unit) => unit.backupLinks.map((link) => link.phone)),
        ].filter(Boolean),
      ),
    );
    const firstContact = legacyPartner?.contacts[0] || null;
    const coverage =
      cities.length > 2
        ? `${cities.slice(0, 2).join(" · ")} +${cities.length - 2}`
        : cities.join(" · ") || null;

    items[partner.id || partner.code] = {
      partnerId: partner.id || partner.code,
      partnerCode: partner.code,
      partnerName: partner.name,
      matched: Boolean(legacyPartner),
      cityBase: firstContact?.city || units[0]?.city || null,
      contactName: firstContact?.name || null,
      contactRole: firstContact?.role || null,
      phones,
      coverage,
      primaryUnitCount: legacyPartner?.primaryUnitCount || 0,
      backupUnitCount: legacyPartner?.backupUnitCount || 0,
      unitCount: units.length,
    };
  }

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    items,
  };
}

export async function getLegacyEquipmentProfileForEquipment(equipment: CurrentEquipment) {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      message: state.message,
      equipment: null,
      starlinks: [],
      starlinkHistory: [],
    };
  }

  const serial = normalize(equipment.serialNumber);
  const tag = normalize(equipment.tag);
  const legacyEquipment =
    state.bundle.normalized.equipments.find((item) => serial && normalize(item.serialNumber) === serial) ||
    state.bundle.normalized.equipments.find((item) => tag && normalize(item.tag) === tag) ||
    null;
  const starlinks = state.bundle.normalized.starlinks.filter((item) => {
    if (legacyEquipment?.source === "starlinks" && legacyEquipment.legacyId === item.legacyId) return true;
    if (!serial) return false;
    return [item.kitSerial, item.antennaSerial].some((value) => normalize(value) === serial);
  });

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    equipment: legacyEquipment,
    starlinks,
    starlinkHistory: historyForStarlinks(state.bundle, starlinks),
  };
}

export async function getLegacyEquipmentDeskForEquipments(
  equipments: CurrentEquipment[],
): Promise<{
  sourceAvailable: boolean;
  generatedAt?: string;
  redactedSecrets?: boolean;
  expectedPath?: string | null;
  message?: string;
  items: Record<string, LegacyEquipmentDeskItem>;
}> {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      expectedPath: state.path,
      message: state.message,
      items: {},
    };
  }

  const items: Record<string, LegacyEquipmentDeskItem> = {};

  for (const equipment of equipments) {
    const serial = normalize(equipment.serialNumber);
    const tag = normalize(equipment.tag);
    const legacyEquipment =
      state.bundle.normalized.equipments.find(
        (item) => serial && normalize(item.serialNumber) === serial,
      ) ||
      state.bundle.normalized.equipments.find((item) => tag && normalize(item.tag) === tag) ||
      null;

    const starlinks = state.bundle.normalized.starlinks.filter((item) => {
      if (
        legacyEquipment?.source === "starlinks" &&
        legacyEquipment.legacyId === item.legacyId
      ) {
        return true;
      }

      if (!serial) return false;
      return [item.kitSerial, item.antennaSerial].some(
        (value) => normalize(value) === serial,
      );
    });

    items[equipment.id || equipment.tag] = {
      equipmentId: equipment.id || equipment.tag,
      tag: equipment.tag,
      matched: Boolean(legacyEquipment || starlinks.length),
      source: legacyEquipment?.source || (starlinks.length ? "starlinks" : null),
      serialOrMac:
        legacyEquipment?.serialNumber ||
        equipment.serialNumber ||
        starlinks[0]?.kitSerial ||
        starlinks[0]?.antennaSerial ||
        null,
      legacyUnitCode: legacyEquipment?.unitCode || null,
      partnerCode: legacyEquipment?.partnerCode || null,
      starlinkCount: starlinks.length,
      installedAt: starlinks[0]?.installedAt || null,
      ipvpn: starlinks[0]?.ipvpn || null,
      antennaId: starlinks[0]?.antennaId || null,
    };
  }

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    items,
  };
}

export async function getLegacyReconciliationForCurrent(current: {
  units: CurrentUnit[];
  partners: CurrentPartner[];
  equipments: CurrentEquipment[];
}) {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return emptyReconciliation(state.message, state.path);
  }

  const codeByKey = buildLegacyUnitCodeMap(state.bundle);
  const unitMatches = state.bundle.normalized.units.map((legacyUnit) => {
    const resolvedCode = codeByKey.get(legacyUnit.key) || legacyUnit.code;
    const match =
      current.units
        .map((unit) => ({
          unit,
          score: scoreLegacyUnit(legacyUnit, unit, resolvedCode),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0] || null;

    return {
      legacyUnit,
      match,
      signal: legacyUnitSignal(state.bundle, legacyUnit),
    };
  });
  const matchedUnitIds = new Set(
    unitMatches
      .filter((item) => (item.match?.score || 0) >= 70)
      .map((item) => item.match?.unit.id)
      .filter((id): id is string => Boolean(id)),
  );
  const weakUnitMatches = unitMatches.filter((item) => {
    const score = item.match?.score || 0;
    return score > 0 && score < 70;
  });
  const unmatchedLegacyUnits = unitMatches.filter((item) => !item.match || item.match.score < 70);

  const partnerMatches = state.bundle.normalized.partners.map((legacyPartner) => {
    const code = normalize(legacyPartner.code);
    const name = normalize(legacyPartner.name);
    const match =
      current.partners.find((partner) => normalize(partner.code) === code) ||
      current.partners.find((partner) => normalize(partner.name) === name) ||
      null;

    return { legacyPartner, match };
  });
  const matchedPartnerIds = new Set(
    partnerMatches.map((item) => item.match?.id).filter((id): id is string => Boolean(id)),
  );

  const currentEquipmentKeys = new Map<string, CurrentEquipment>();
  for (const equipment of current.equipments) {
    const serial = normalize(equipment.serialNumber);
    const tag = normalize(equipment.tag);
    if (serial) currentEquipmentKeys.set(`serial:${serial}`, equipment);
    if (tag) currentEquipmentKeys.set(`tag:${tag}`, equipment);
  }

  const equipmentMatches = state.bundle.normalized.equipments.map((legacyEquipment) => {
    const serial = normalize(legacyEquipment.serialNumber);
    const tag = normalize(legacyEquipment.tag);
    const match =
      (serial ? currentEquipmentKeys.get(`serial:${serial}`) : null) ||
      (tag ? currentEquipmentKeys.get(`tag:${tag}`) : null) ||
      null;

    return { legacyEquipment, match };
  });
  const matchedEquipmentIds = new Set(
    equipmentMatches.map((item) => item.match?.id).filter((id): id is string => Boolean(id)),
  );

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    counts: {
      legacyUnits: state.bundle.normalized.units.length,
      currentUnits: current.units.length,
      matchedUnits: matchedUnitIds.size,
      weakUnitMatches: weakUnitMatches.length,
      unmatchedLegacyUnits: unmatchedLegacyUnits.length,
      unmatchedCurrentUnits: current.units.filter((unit) => !unit.id || !matchedUnitIds.has(unit.id)).length,
      legacyPartners: state.bundle.normalized.partners.length,
      currentPartners: current.partners.length,
      matchedPartners: matchedPartnerIds.size,
      legacyEquipments: state.bundle.normalized.equipments.length,
      currentEquipments: current.equipments.length,
      matchedEquipments: matchedEquipmentIds.size,
      starlinks: state.bundle.normalized.starlinks.length,
    },
    unmatchedLegacyUnits: unmatchedLegacyUnits
      .sort((a, b) =>
        (b.signal.backupLinks + b.signal.starlinks + b.signal.equipments) -
          (a.signal.backupLinks + a.signal.starlinks + a.signal.equipments) ||
        a.legacyUnit.code.localeCompare(b.legacyUnit.code),
      )
      .slice(0, 20)
      .map((item) => ({
        code: item.legacyUnit.code,
        name: item.legacyUnit.name,
        city: item.legacyUnit.city,
        state: item.legacyUnit.state,
        partnerCode: item.legacyUnit.partnerCode,
        bestScore: item.match?.score || 0,
        bestCurrentUnit: item.match?.unit
          ? {
              id: item.match.unit.id || "",
              code: item.match.unit.code,
              name: item.match.unit.name,
            }
          : null,
        signal: item.signal,
      })),
    weakUnitMatches: weakUnitMatches.slice(0, 20).map((item) => ({
      code: item.legacyUnit.code,
      name: item.legacyUnit.name,
      city: item.legacyUnit.city,
      state: item.legacyUnit.state,
      partnerCode: item.legacyUnit.partnerCode,
      score: item.match?.score || 0,
      currentUnit: item.match?.unit
        ? {
            id: item.match.unit.id || "",
            code: item.match.unit.code,
            name: item.match.unit.name,
          }
        : null,
      signal: item.signal,
    })),
    unmatchedCurrentUnits: current.units
      .filter((unit) => !unit.id || !matchedUnitIds.has(unit.id))
      .slice(0, 20)
      .map((unit) => ({
        id: unit.id || "",
        code: unit.code,
        name: unit.name,
        city: unit.city,
        state: unit.state || null,
        partnerCode: unit.partner.code,
        partnerName: unit.partner.name,
      })),
    unmatchedLegacyPartners: partnerMatches
      .filter((item) => !item.match)
      .slice(0, 20)
      .map((item) => ({
        code: item.legacyPartner.code,
        name: item.legacyPartner.name,
        contacts: item.legacyPartner.contacts.length,
        primaryUnitCount: item.legacyPartner.primaryUnitCount,
        backupUnitCount: item.legacyPartner.backupUnitCount,
      })),
    unmatchedLegacyEquipments: equipmentMatches
      .filter((item) => !item.match)
      .slice(0, 20)
      .map((item) => ({
        tag: item.legacyEquipment.tag,
        name: item.legacyEquipment.name,
        type: item.legacyEquipment.type,
        serialNumber: item.legacyEquipment.serialNumber,
        unitCode: item.legacyEquipment.unitCode,
        partnerCode: item.legacyEquipment.partnerCode,
        source: item.legacyEquipment.source,
      })),
  };
}

export async function getLegacyMonitorContextForUnits(units: CurrentUnit[]): Promise<LegacyMonitorContextResult> {
  const state = await loadLegacyBundle();

  if (!state.available) {
    return {
      sourceAvailable: false,
      expectedPath: state.path,
      message: state.message,
      counts: {
        matchedUnits: 0,
        withPhones: 0,
        withBackup: 0,
        withStarlink: 0,
        withMacOnu: 0,
        withoutContext: units.length,
      },
      items: {},
    };
  }

  const items: Record<string, LegacyMonitorContextItem> = {};
  let matchedUnits = 0;
  let withPhones = 0;
  let withBackup = 0;
  let withStarlink = 0;
  let withMacOnu = 0;
  let withoutContext = 0;

  for (const unit of units) {
    const legacyUnit = bestUnitMatch(state.bundle, unit);
    const starlinks = starlinksForUnit(state.bundle, legacyUnit, unit);
    const equipments = equipmentsForUnit(state.bundle, legacyUnit, starlinks);
    const links = legacyUnit?.links || [];
    const backupLinks = legacyUnit?.backupLinks || [];
    const phones = Array.from(
      new Set([
        ...(legacyUnit?.phones || []),
        ...links.map((link) => link.phone),
        ...backupLinks.map((link) => link.phone),
      ].filter(Boolean)),
    );
    const contracts = Array.from(new Set((legacyUnit?.contracts || []).filter(Boolean)));
    const technologies = Array.from(
      new Set(
        [...links, ...backupLinks]
          .map((link) => link.technology)
          .filter(Boolean),
      ),
    );
    const latencies = Array.from(
      new Set(
        [...links, ...backupLinks]
          .map((link) => link.latency)
          .filter(Boolean),
      ),
    );
    const notes = Array.from(
      new Set([
        ...(legacyUnit?.notes || []),
        ...links.map((link) => link.notes),
        ...backupLinks.map((link) => link.notes),
        ...starlinks.map((item) => item.notes),
      ].filter(Boolean)),
    );
    const macOnuCount =
      links.filter((link) => Boolean(link.macOnu)).length +
      backupLinks.filter((link) => Boolean(link.macOnu)).length;
    const matched = Boolean(legacyUnit);

    if (matched) matchedUnits += 1;
    if (phones.length) withPhones += 1;
    if (backupLinks.length) withBackup += 1;
    if (starlinks.length) withStarlink += 1;
    if (macOnuCount) withMacOnu += 1;
    if (!phones.length && !backupLinks.length && !starlinks.length && !equipments.length) {
      withoutContext += 1;
    }

    items[unit.id || unit.code] = {
      unitId: unit.id || unit.code,
      unitCode: unit.code,
      unitName: unit.name,
      matched,
      partnerCode: legacyUnit?.partnerCode || null,
      phones,
      contracts,
      technologies,
      latencies,
      hasBackup: backupLinks.length > 0,
      backupCount: backupLinks.length,
      starlinks: starlinks.length,
      equipments: equipments.length,
      hasMacOnu: macOnuCount > 0,
      macOnuCount,
      notes,
    };
  }

  return {
    sourceAvailable: true,
    generatedAt: state.bundle.generatedAt,
    redactedSecrets: state.bundle.redactedSecrets,
    counts: {
      matchedUnits,
      withPhones,
      withBackup,
      withStarlink,
      withMacOnu,
      withoutContext,
    },
    items,
  };
}
