import { Injectable, NotFoundException } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  LegacyBundle,
  LegacyStarlink,
  LegacyUnit,
} from "./legacy.types";
import { PrismaService } from "../prisma/prisma.service";

type BundleState =
  | { available: true; path: string; bundle: LegacyBundle }
  | { available: false; path: string | null; message: string };

@Injectable()
export class LegacyService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(value: string | null | undefined) {
    return (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  private candidatePaths() {
    const cwd = process.cwd();
    const paths = [
      process.env.NOVA_LEGACY_IMPORT_PATH,
      resolve(cwd, "tmp/legacy-import.json"),
      resolve(cwd, "tmp/legacy/legacy-import.json"),
      resolve(cwd, "../../.run-logs/legacy-import.json"),
      resolve(cwd, ".run-logs/legacy-import.json"),
    ];

    return paths.filter((item): item is string => Boolean(item));
  }

  private async loadBundle(): Promise<BundleState> {
    const candidates = this.candidatePaths();

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
      message:
        "Arquivo legado não encontrado. Gere com apps/api/scripts/export-legacy-sqlite.py.",
    };
  }

  private bestUnitMatch(bundle: LegacyBundle, unit: { code: string; name: string; city: string | null }) {
    const unitCode = this.normalize(unit.code);
    const unitName = this.normalize(unit.name);
    const unitCity = this.normalize(unit.city);

    const matches = bundle.normalized.units
      .map((legacyUnit) => {
        const legacyCode = this.normalize(legacyUnit.code);
        const legacyName = this.normalize(legacyUnit.name);
        const legacyCity = this.normalize(legacyUnit.city);
        const score =
          (legacyCode === unitCode ? 100 : 0) +
          (legacyName === unitName ? 80 : 0) +
          (legacyName.includes(unitName) || unitName.includes(legacyName) ? 35 : 0) +
          (unitCity && legacyCity === unitCity ? 20 : 0);

        return { legacyUnit, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return matches[0]?.legacyUnit || null;
  }

  private partnerMatch(bundle: LegacyBundle, partner: { code: string; name: string }) {
    const partnerCode = this.normalize(partner.code);
    const partnerName = this.normalize(partner.name);

    return (
      bundle.normalized.partners.find((legacyPartner) => this.normalize(legacyPartner.code) === partnerCode) ||
      bundle.normalized.partners.find((legacyPartner) => this.normalize(legacyPartner.name) === partnerName) ||
      null
    );
  }

  private starlinksForUnit(bundle: LegacyBundle, legacyUnit: LegacyUnit | null, unit: { name: string }) {
    const unitName = this.normalize(unit.name);

    return bundle.normalized.starlinks.filter((starlink) => {
      if (legacyUnit && starlink.unitKey === legacyUnit.key) return true;
      const localName = this.normalize(starlink.localName);
      return Boolean(localName && (localName.includes(unitName) || unitName.includes(localName)));
    });
  }

  private historyForStarlinks(bundle: LegacyBundle, starlinks: LegacyStarlink[]) {
    const ids = new Set(starlinks.map((item) => item.legacyId));
    return bundle.normalized.starlinkHistory.filter((item) => ids.has(item.starlinkLegacyId));
  }

  private equipmentsForUnit(bundle: LegacyBundle, legacyUnit: LegacyUnit | null, starlinks: LegacyStarlink[]) {
    const starlinkIds = new Set(starlinks.map((item) => item.legacyId));

    return bundle.normalized.equipments.filter((equipment) => {
      if (legacyUnit && equipment.unitKey === legacyUnit.key) return true;
      return equipment.source === "starlinks" && starlinkIds.has(equipment.legacyId);
    });
  }

  private scoreLegacyUnitAgainstCurrent(
    legacyUnit: LegacyUnit,
    unit: {
      code: string;
      name: string;
      city: string | null;
      state: string | null;
      partner: { code: string; name: string };
    },
  ) {
    const legacyCode = this.normalize(legacyUnit.code);
    const legacyName = this.normalize(legacyUnit.name);
    const legacyCity = this.normalize(legacyUnit.city);
    const legacyState = this.normalize(legacyUnit.state);
    const legacyPartner = this.normalize(legacyUnit.partnerCode);

    const unitCode = this.normalize(unit.code);
    const unitName = this.normalize(unit.name);
    const unitCity = this.normalize(unit.city);
    const unitState = this.normalize(unit.state);
    const unitPartnerCode = this.normalize(unit.partner.code);
    const unitPartnerName = this.normalize(unit.partner.name);

    return (
      (legacyCode && legacyCode === unitCode ? 100 : 0) +
      (legacyName && legacyName === unitName ? 80 : 0) +
      (legacyName && unitName && (legacyName.includes(unitName) || unitName.includes(legacyName)) ? 42 : 0) +
      (legacyCity && legacyCity === unitCity ? 18 : 0) +
      (legacyState && legacyState === unitState ? 8 : 0) +
      (legacyPartner && (legacyPartner === unitPartnerCode || legacyPartner === unitPartnerName) ? 12 : 0)
    );
  }

  private bestCurrentUnitMatch(
    legacyUnit: LegacyUnit,
    units: Array<{
      id: string;
      code: string;
      name: string;
      city: string | null;
      state: string | null;
      partner: { code: string; name: string };
    }>,
  ) {
    return (
      units
      .map((unit) => ({
        unit,
        score: this.scoreLegacyUnitAgainstCurrent(legacyUnit, unit),
      }))
      .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0] || null
    );
  }

  private legacyUnitSignal(bundle: LegacyBundle, legacyUnit: LegacyUnit) {
    const starlinks = this.starlinksForUnit(bundle, legacyUnit, { name: legacyUnit.name });
    const equipments = this.equipmentsForUnit(bundle, legacyUnit, starlinks);

    return {
      backupLinks: legacyUnit.backupLinks.length,
      links: legacyUnit.links.length,
      phones: legacyUnit.phones.length,
      contracts: legacyUnit.contracts.length,
      starlinks: starlinks.length,
      equipments: equipments.length,
      hasMacOnu: legacyUnit.links.some((link) => Boolean(link.macOnu)) ||
        legacyUnit.backupLinks.some((link) => Boolean(link.macOnu)),
    };
  }

  async getSummary() {
    const state = await this.loadBundle();

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

  async getReconciliation() {
    const state = await this.loadBundle();

    if (!state.available) {
      return {
        sourceAvailable: false,
        message: state.message,
        expectedPath: state.path,
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

    const [units, partners, equipments] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          partner: { select: { code: true, name: true } },
        },
      }),
      this.prisma.partner.findMany({
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.equipment.findMany({
        orderBy: { tag: "asc" },
        select: {
          id: true,
          tag: true,
          name: true,
          serialNumber: true,
          unit: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    const unitMatches = state.bundle.normalized.units.map((legacyUnit) => ({
      legacyUnit,
      match: this.bestCurrentUnitMatch(legacyUnit, units),
      signal: this.legacyUnitSignal(state.bundle, legacyUnit),
    }));
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
      const code = this.normalize(legacyPartner.code);
      const name = this.normalize(legacyPartner.name);
      const match =
        partners.find((partner) => this.normalize(partner.code) === code) ||
        partners.find((partner) => this.normalize(partner.name) === name) ||
        null;

      return { legacyPartner, match };
    });
    const matchedPartnerIds = new Set(
      partnerMatches.map((item) => item.match?.id).filter((id): id is string => Boolean(id)),
    );

    const currentEquipmentKeys = new Map<string, typeof equipments[number]>();
    for (const equipment of equipments) {
      const serial = this.normalize(equipment.serialNumber);
      const tag = this.normalize(equipment.tag);
      if (serial) currentEquipmentKeys.set(`serial:${serial}`, equipment);
      if (tag) currentEquipmentKeys.set(`tag:${tag}`, equipment);
    }

    const equipmentMatches = state.bundle.normalized.equipments.map((legacyEquipment) => {
      const serial = this.normalize(legacyEquipment.serialNumber);
      const tag = this.normalize(legacyEquipment.tag);
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
        currentUnits: units.length,
        matchedUnits: matchedUnitIds.size,
        weakUnitMatches: weakUnitMatches.length,
        unmatchedLegacyUnits: unmatchedLegacyUnits.length,
        unmatchedCurrentUnits: units.filter((unit) => !matchedUnitIds.has(unit.id)).length,
        legacyPartners: state.bundle.normalized.partners.length,
        currentPartners: partners.length,
        matchedPartners: matchedPartnerIds.size,
        legacyEquipments: state.bundle.normalized.equipments.length,
        currentEquipments: equipments.length,
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
                id: item.match.unit.id,
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
              id: item.match.unit.id,
              code: item.match.unit.code,
              name: item.match.unit.name,
            }
          : null,
        signal: item.signal,
      })),
      unmatchedCurrentUnits: units
        .filter((unit) => !matchedUnitIds.has(unit.id))
        .slice(0, 20)
        .map((unit) => ({
          id: unit.id,
          code: unit.code,
          name: unit.name,
          city: unit.city,
          state: unit.state,
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

  async getUnitProfile(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        partner: { select: { code: true, name: true } },
        equipments: { select: { tag: true, serialNumber: true } },
      },
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    const state = await this.loadBundle();
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

    const legacyUnit = this.bestUnitMatch(state.bundle, unit);
    const partner = this.partnerMatch(state.bundle, unit.partner);
    const starlinks = this.starlinksForUnit(state.bundle, legacyUnit, unit);
    const starlinkHistory = this.historyForStarlinks(state.bundle, starlinks);
    const equipments = this.equipmentsForUnit(state.bundle, legacyUnit, starlinks);

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

  async getPartnerProfile(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, code: true, name: true },
    });

    if (!partner) {
      throw new NotFoundException("Parceiro não encontrado");
    }

    const state = await this.loadBundle();
    if (!state.available) {
      return {
        sourceAvailable: false,
        message: state.message,
        partner: null,
        contacts: [],
        units: [],
      };
    }

    const legacyPartner = this.partnerMatch(state.bundle, partner);
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

  async getEquipmentProfile(equipmentId: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: {
        id: true,
        tag: true,
        serialNumber: true,
        unit: { select: { id: true, code: true, name: true, city: true } },
      },
    });

    if (!equipment) {
      throw new NotFoundException("Equipamento não encontrado");
    }

    const state = await this.loadBundle();
    if (!state.available) {
      return {
        sourceAvailable: false,
        message: state.message,
        equipment: null,
        starlinks: [],
        starlinkHistory: [],
      };
    }

    const serial = this.normalize(equipment.serialNumber);
    const tag = this.normalize(equipment.tag);
    const legacyEquipment =
      state.bundle.normalized.equipments.find((item) => serial && this.normalize(item.serialNumber) === serial) ||
      state.bundle.normalized.equipments.find((item) => this.normalize(item.tag) === tag) ||
      null;
    const starlinks = state.bundle.normalized.starlinks.filter((item) => {
      if (!serial) return false;
      return [item.kitSerial, item.antennaSerial].some((value) => this.normalize(value) === serial);
    });

    return {
      sourceAvailable: true,
      generatedAt: state.bundle.generatedAt,
      redactedSecrets: state.bundle.redactedSecrets,
      equipment: legacyEquipment,
      starlinks,
      starlinkHistory: this.historyForStarlinks(state.bundle, starlinks),
    };
  }
}
