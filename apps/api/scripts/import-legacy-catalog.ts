import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { LegacyBundle } from "../src/legacy/legacy.types";

type ImportStats = {
  partnersCreated: number;
  partnersSkipped: number;
  unitsCreated: number;
  unitsSkipped: number;
  duplicateUnitCodesResolved: number;
  unitsWithoutPartner: number;
  equipmentsCreated: number;
  equipmentsSkipped: number;
  equipmentsWithoutUnit: number;
  stockUnitCreated: boolean;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return process.argv[index + 1] || "";
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

function cleanText(value: string, fallback: string) {
  return (value || "").trim() || fallback;
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

async function readBundle() {
  const input =
    argValue("--input") ||
    process.env.NOVA_LEGACY_IMPORT_PATH ||
    "../../.run-logs/legacy-import.json";
  const path = resolve(process.cwd(), input);
  const raw = await readFile(path, "utf-8");
  return { path, bundle: JSON.parse(raw) as LegacyBundle };
}

async function main() {
  const connectionString = process.env.DATABASE_URL || "";
  if (!connectionString) {
    throw new Error("DATABASE_URL ausente para importar o legado.");
  }

  const dryRun = process.argv.includes("--dry-run");
  const { path, bundle } = await readBundle();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const stats: ImportStats = {
    partnersCreated: 0,
    partnersSkipped: 0,
    unitsCreated: 0,
    unitsSkipped: 0,
    unitsWithoutPartner: 0,
    equipmentsCreated: 0,
    equipmentsSkipped: 0,
    duplicateUnitCodesResolved: 0,
    equipmentsWithoutUnit: 0,
    stockUnitCreated: false,
  };

  try {
    const partnersByCode = new Map<string, { id: string; code: string }>();
    const unitsByCode = new Map<string, { id: string; code: string }>();
    const equipmentsByTag = new Map<string, { id: string; tag: string }>();

    for (const partner of await prisma.partner.findMany({ select: { id: true, code: true } })) {
      partnersByCode.set(cleanCode(partner.code, partner.id), partner);
    }

    for (const unit of await prisma.unit.findMany({ select: { id: true, code: true } })) {
      unitsByCode.set(cleanCode(unit.code, unit.id), unit);
    }

    for (const equipment of await prisma.equipment.findMany({ select: { id: true, tag: true } })) {
      equipmentsByTag.set(cleanCode(equipment.tag, equipment.id), equipment);
    }

    const legacyUnitCodes = buildLegacyUnitCodeMap(bundle);
    let duplicateUnitCodesResolved = 0;
    for (const legacyUnit of bundle.normalized.units) {
      const base = cleanCode(legacyUnit.code, `LEGACY-UNIT-${legacyUnit.key}`);
      const resolved = legacyUnitCodes.get(legacyUnit.key) || base;
      if (base !== resolved) duplicateUnitCodesResolved += 1;
    }
    stats.duplicateUnitCodesResolved = duplicateUnitCodesResolved;

    const unitByLegacyKey = new Map<string, { id: string; code: string }>();

    async function ensurePartner(codeInput: string, nameInput: string) {
      const code = cleanCode(codeInput, "LEGACY-SEM-PARCEIRO");
      const existing = partnersByCode.get(code);
      if (existing) return existing;

      if (dryRun) {
        const partner = { id: `dry-run-partner-${code}`, code };
        partnersByCode.set(code, partner);
        stats.partnersCreated += 1;
        return partner;
      }

      const created = await prisma.partner.create({
        data: {
          code,
          name: cleanText(nameInput, code),
          isActive: true,
        },
        select: { id: true, code: true },
      });
      partnersByCode.set(code, created);
      stats.partnersCreated += 1;
      return created;
    }

    for (const legacyPartner of bundle.normalized.partners) {
      const code = cleanCode(legacyPartner.code, `LEGACY-PARTNER-${legacyPartner.legacyContactIds[0] || "SEM-CODIGO"}`);
      if (partnersByCode.has(code)) {
        stats.partnersSkipped += 1;
        continue;
      }

      await ensurePartner(code, legacyPartner.name);
    }

    let fallbackPartner = partnersByCode.get("LEGACY-SEM-PARCEIRO") || null;
    async function ensureFallbackPartner() {
      if (fallbackPartner) return fallbackPartner;
      if (dryRun) {
        fallbackPartner = { id: "dry-run-fallback-partner", code: "LEGACY-SEM-PARCEIRO" };
        partnersByCode.set(fallbackPartner.code, fallbackPartner);
        stats.partnersCreated += 1;
        return fallbackPartner;
      }
      fallbackPartner = await prisma.partner.create({
        data: {
          code: "LEGACY-SEM-PARCEIRO",
          name: "Legado sem parceiro identificado",
          isActive: true,
        },
        select: { id: true, code: true },
      });
      partnersByCode.set(fallbackPartner.code, fallbackPartner);
      stats.partnersCreated += 1;
      return fallbackPartner;
    }

    for (const legacyUnit of bundle.normalized.units) {
      const code = legacyUnitCodes.get(legacyUnit.key) || cleanCode(legacyUnit.code, `LEGACY-UNIT-${legacyUnit.key}`);
      if (unitsByCode.has(code)) {
        unitByLegacyKey.set(legacyUnit.key, unitsByCode.get(code)!);
        stats.unitsSkipped += 1;
        continue;
      }

      const partnerCode = cleanCode(legacyUnit.partnerCode, "LEGACY-SEM-PARCEIRO");
      const partner = partnersByCode.get(partnerCode) || (await ensureFallbackPartner());
      if (partner.code === "LEGACY-SEM-PARCEIRO") {
        stats.unitsWithoutPartner += 1;
      }

      if (dryRun) {
        const unit = { id: `dry-run-unit-${code}`, code };
        unitsByCode.set(code, unit);
        unitByLegacyKey.set(legacyUnit.key, unit);
        stats.unitsCreated += 1;
        continue;
      }

      const created = await prisma.unit.create({
        data: {
          code,
          name: cleanText(legacyUnit.name, code),
          city: cleanText(legacyUnit.city, "") || null,
          state: cleanText(legacyUnit.state, "") || null,
          partnerId: partner.id,
          isActive: true,
        },
        select: { id: true, code: true },
      });
      unitsByCode.set(code, created);
      unitByLegacyKey.set(legacyUnit.key, created);
      stats.unitsCreated += 1;
    }

    async function ensureStockUnit() {
      const partner = await ensurePartner("STARLINK", "Starlink");
      const code = "LEGACY-ESTOQUE-STARLINK";
      const existing = unitsByCode.get(code);
      if (existing) return existing;

      stats.stockUnitCreated = true;
      if (dryRun) {
        const unit = { id: `dry-run-unit-${code}`, code };
        unitsByCode.set(code, unit);
        stats.unitsCreated += 1;
        return unit;
      }

      const created = await prisma.unit.create({
        data: {
          code,
          name: "Estoque legado de Starlinks",
          city: null,
          state: null,
          partnerId: partner.id,
          isActive: true,
        },
        select: { id: true, code: true },
      });
      unitsByCode.set(code, created);
      stats.unitsCreated += 1;
      return created;
    }

    for (const legacyEquipment of bundle.normalized.equipments) {
      const tag = cleanCode(legacyEquipment.tag, `LEGACY-EQ-${legacyEquipment.legacyId}`);
      if (equipmentsByTag.has(tag)) {
        stats.equipmentsSkipped += 1;
        continue;
      }

      const unitCode = cleanCode(legacyEquipment.unitCode, "");
      let unit =
        (legacyEquipment.unitKey ? unitByLegacyKey.get(legacyEquipment.unitKey) : null) ||
        (unitCode ? unitsByCode.get(unitCode) : null) ||
        null;

      if (!unit && legacyEquipment.source === "starlinks") {
        unit = await ensureStockUnit();
      }

      if (!unit) {
        stats.equipmentsWithoutUnit += 1;
        continue;
      }

      if (dryRun) {
        equipmentsByTag.set(tag, { id: `dry-run-equipment-${tag}`, tag });
        stats.equipmentsCreated += 1;
        continue;
      }

      const created = await prisma.equipment.create({
        data: {
          tag,
          name: cleanText(legacyEquipment.name, tag),
          type: cleanText(legacyEquipment.type, "legacy").toLowerCase(),
          serialNumber: cleanText(legacyEquipment.serialNumber, "") || null,
          status: cleanText(legacyEquipment.status, "active").toLowerCase(),
          isActive: true,
          unitId: unit.id,
        },
        select: { id: true, tag: true },
      });
      equipmentsByTag.set(tag, created);
      stats.equipmentsCreated += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          source: path,
          legacy: bundle.summary.normalized,
          stats,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
