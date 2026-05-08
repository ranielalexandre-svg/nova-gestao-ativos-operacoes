import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  LegacyBundle,
  LegacyStarlink,
  LegacyUnit,
} from "./legacy.types";
import { decryptSecret, encryptSecret } from "../common/secrets";
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
        "Pacote de dados importados não encontrado. Gere com apps/api/scripts/export-legacy-sqlite.py.",
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

  async getOperationalReconciliation() {
    const reconciliation = await this.getReconciliation();
    return this.toOperationalReconciliation(reconciliation as Record<string, unknown>);
  }

  private toOperationalReconciliation(reconciliation: Record<string, unknown>) {
    const counts = this.objectRecord(reconciliation.counts);

    return {
      ...reconciliation,
      counts: counts
        ? {
            ...counts,
            importedUnits: this.valueOrAlias(counts, "importedUnits", "legacyUnits"),
            importedPartners: this.valueOrAlias(counts, "importedPartners", "legacyPartners"),
            importedEquipments: this.valueOrAlias(counts, "importedEquipments", "legacyEquipments"),
            unmatchedImportedUnits: this.valueOrAlias(counts, "unmatchedImportedUnits", "unmatchedLegacyUnits"),
          }
        : counts,
      unmatchedImportedUnits: this.valueOrAlias(
        reconciliation,
        "unmatchedImportedUnits",
        "unmatchedLegacyUnits",
      ),
      unmatchedImportedPartners: this.valueOrAlias(
        reconciliation,
        "unmatchedImportedPartners",
        "unmatchedLegacyPartners",
      ),
      unmatchedImportedEquipments: this.valueOrAlias(
        reconciliation,
        "unmatchedImportedEquipments",
        "unmatchedLegacyEquipments",
      ),
    };
  }

  private objectRecord(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private valueOrAlias(source: Record<string, unknown>, preferred: string, fallback: string) {
    return source[preferred] ?? source[fallback];
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

  private prismaOperational() {
    return this.prisma as unknown as {
      unit: {
        findUnique(args: unknown): Promise<any>;
        findMany(args: unknown): Promise<any[]>;
      };
      unitOperationalInfo: {
        findMany(args: unknown): Promise<any[]>;
        findFirst(args: unknown): Promise<any | null>;
        upsert(args: unknown): Promise<any>;
        update(args: unknown): Promise<any>;
      };
      unitOperationalSecret: {
        deleteMany(args: unknown): Promise<any>;
        create(args: unknown): Promise<any>;
      };
      activityEntry: {
        create(args: unknown): Promise<any>;
      };
    };
  }

  private trimString(value: unknown) {
    return String(value ?? "").trim();
  }

  private sourceHash(parts: Array<string | number>) {
    return createHash("sha256").update(parts.map((part) => String(part)).join("|")).digest("hex");
  }

  private secretMask(value?: string | null) {
    return value ? "••••••••" : "";
  }

  private extractConnectionCredential(value: string) {
    const original = this.trimString(value);
    if (!original) {
      return { connectionType: "", username: "", secret: "" };
    }

    const loginMatch = original.match(/login\s*[:=]\s*([^\n\r;|-]+)/i);
    const passwordMatch = original.match(/senha\s*[:=]\s*([^\n\r;|-]+)/i);
    const username = this.trimString(loginMatch?.[1]);
    const secret = this.trimString(passwordMatch?.[1]);

    let connectionType = original
      .replace(/login\s*[:=]\s*[^\n\r;|-]+/gi, "")
      .replace(/senha\s*[:=]\s*[^\n\r;|-]+/gi, "")
      .replace(/\s*[-|;]\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    connectionType = connectionType.replace(/[→>-]\s*$/g, "").trim();

    return { connectionType, username, secret };
  }

  private operationalSelect(revealSecrets: boolean) {
    return {
      id: true,
      source: true,
      sourceLegacyId: true,
      sourceUnitKey: true,
      linkRole: true,
      sortOrder: true,
      group: true,
      legacyCode: true,
      legacyName: true,
      city: true,
      state: true,
      partnerCode: true,
      serviceType: true,
      connectionType: true,
      routerPort: true,
      technology: true,
      latency: true,
      macOnu: true,
      phone: true,
      contractIxc: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      secrets: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          label: true,
          usernameEnc: revealSecrets,
          secretEnc: revealSecrets,
          noteEnc: revealSecrets,
          hasValue: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };
  }

  private serializeOperationalInfo(item: any, revealSecrets: boolean) {
    return {
      ...item,
      secrets: (item.secrets || []).map((secret: any) => {
        const username = revealSecrets ? decryptSecret(secret.usernameEnc) : null;
        const value = revealSecrets ? decryptSecret(secret.secretEnc) : null;
        const note = revealSecrets ? decryptSecret(secret.noteEnc) : null;
        const maskedValue = secret.hasValue ? "••••••••" : "";

        return {
          id: secret.id,
          kind: secret.kind,
          label: secret.label,
          hasValue: secret.hasValue,
          username: revealSecrets ? username : maskedValue,
          value: revealSecrets ? value : maskedValue,
          note: revealSecrets ? note : maskedValue,
          revealed: revealSecrets,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
        };
      }),
    };
  }

  private async writeOperationalActivity(input: {
    actorUserId?: string | null;
    unitId?: string | null;
    title: string;
    description?: string;
  }) {
    const prisma = this.prismaOperational();

    try {
      await prisma.activityEntry.create({
        data: {
          kind: "system",
          source: "legacy",
          title: input.title,
          description: input.description || null,
          severity: "info",
          userId: input.actorUserId || null,
          unitId: input.unitId || null,
        },
      });
    } catch {}
  }

  async getUnitOperationalData(id: string, revealSecrets = false, actorUserId?: string | null) {
    const prisma = this.prismaOperational();

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        partner: { select: { id: true, code: true, name: true } },
      },
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    const items = await prisma.unitOperationalInfo.findMany({
      where: { unitId: id },
      orderBy: [{ linkRole: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: this.operationalSelect(revealSecrets),
    });

    if (revealSecrets) {
      await this.writeOperationalActivity({
        actorUserId,
        unitId: id,
        title: "Dados operacionais sensíveis revelados",
        description: `Consulta com revelação de credenciais da unidade ${unit.code}.`,
      });
    }

    return {
      unit,
      revealSecrets,
      total: items.length,
      items: items.map((item) => this.serializeOperationalInfo(item, revealSecrets)),
    };
  }

  async updateUnitOperationalData(
    unitId: string,
    infoId: string,
    payload: Record<string, unknown>,
    actorUserId?: string | null,
  ) {
    const prisma = this.prismaOperational();

    const current = await prisma.unitOperationalInfo.findFirst({
      where: { id: infoId, unitId },
      select: { id: true, unitId: true },
    });

    if (!current) {
      throw new NotFoundException("Dado operacional não encontrado para a unidade");
    }

    const allowedFields = [
      "serviceType",
      "connectionType",
      "routerPort",
      "technology",
      "latency",
      "macOnu",
      "phone",
      "contractIxc",
      "notes",
      "partnerCode",
    ];

    const data: Record<string, string | null> = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        const value = this.trimString(payload[field]);
        data[field] = value || null;
      }
    }

    const updated = await prisma.unitOperationalInfo.update({
      where: { id: infoId },
      data,
      select: this.operationalSelect(false),
    });

    const username = this.trimString(payload.username);
    const secret = this.trimString(payload.secret);
    const note = this.trimString(payload.secretNote);

    if (username || secret || note) {
      await prisma.unitOperationalSecret.deleteMany({
        where: { operationalInfoId: infoId },
      });

      await prisma.unitOperationalSecret.create({
        data: {
          operationalInfoId: infoId,
          kind: "credential",
          label: this.trimString(payload.secretLabel) || "Credencial operacional",
          usernameEnc: username ? encryptSecret(username) : null,
          secretEnc: secret ? encryptSecret(secret) : null,
          noteEnc: note ? encryptSecret(note) : null,
          hasValue: Boolean(username || secret || note),
        },
      });
    }

    await this.writeOperationalActivity({
      actorUserId,
      unitId,
      title: "Dados operacionais atualizados",
      description: `Registro operacional ${infoId} atualizado manualmente.`,
    });

    return this.getUnitOperationalData(unitId, false);
  }

  async importUnitOperationalData(actorUserId?: string | null) {
    const state = await this.loadBundle();

    if (!state.available) {
      throw new BadRequestException(state.message);
    }

    const prisma = this.prismaOperational();
    const currentUnits = await prisma.unit.findMany({
      orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        partner: { select: { code: true, name: true } },
      },
    });

    let matchedUnits = 0;
    let importedLinks = 0;
    let importedSecrets = 0;
    let skippedUnits = 0;

    for (const legacyUnit of state.bundle.normalized.units) {
      const match = this.bestCurrentUnitMatch(legacyUnit, currentUnits);

      if (!match?.unit || match.score < 35) {
        skippedUnits += 1;
        continue;
      }

      matchedUnits += 1;

      const allLinks = [
        ...legacyUnit.links.map((link, index) => ({ link, linkRole: "primary", sortOrder: index })),
        ...legacyUnit.backupLinks.map((link, index) => ({ link, linkRole: "backup", sortOrder: index })),
      ];

      for (const item of allLinks) {
        const credential = this.extractConnectionCredential(item.link.connectionType);
        const sourceHash = this.sourceHash([
          match.unit.id,
          legacyUnit.key,
          item.link.legacyId || item.sortOrder,
          item.linkRole,
          item.sortOrder,
        ]);

        const info = await prisma.unitOperationalInfo.upsert({
          where: { sourceHash },
          create: {
            unitId: match.unit.id,
            source: "legacy",
            sourceLegacyId: item.link.legacyId || null,
            sourceUnitKey: legacyUnit.key,
            sourceHash,
            linkRole: item.linkRole,
            sortOrder: item.sortOrder,
            group: legacyUnit.group || null,
            legacyCode: legacyUnit.code || null,
            legacyName: legacyUnit.name || null,
            city: legacyUnit.city || null,
            state: legacyUnit.state || null,
            partnerCode: item.link.partnerCode || legacyUnit.partnerCode || null,
            serviceType: item.link.serviceType || null,
            connectionType: credential.connectionType || item.link.connectionType || null,
            routerPort: item.link.routerPort || null,
            technology: item.link.technology || null,
            latency: item.link.latency || null,
            macOnu: item.link.macOnu || null,
            phone: item.link.phone || null,
            contractIxc: item.link.contractIxc || null,
            notes: item.link.notes || null,
          },
          update: {
            sourceLegacyId: item.link.legacyId || null,
            sourceUnitKey: legacyUnit.key,
            linkRole: item.linkRole,
            sortOrder: item.sortOrder,
            group: legacyUnit.group || null,
            legacyCode: legacyUnit.code || null,
            legacyName: legacyUnit.name || null,
            city: legacyUnit.city || null,
            state: legacyUnit.state || null,
            partnerCode: item.link.partnerCode || legacyUnit.partnerCode || null,
            serviceType: item.link.serviceType || null,
            connectionType: credential.connectionType || item.link.connectionType || null,
            routerPort: item.link.routerPort || null,
            technology: item.link.technology || null,
            latency: item.link.latency || null,
            macOnu: item.link.macOnu || null,
            phone: item.link.phone || null,
            contractIxc: item.link.contractIxc || null,
            notes: item.link.notes || null,
          },
          select: { id: true },
        });

        await prisma.unitOperationalSecret.deleteMany({
          where: { operationalInfoId: info.id },
        });

        if (credential.username || credential.secret) {
          await prisma.unitOperationalSecret.create({
            data: {
              operationalInfoId: info.id,
              kind: "pppoe",
              label: "Credencial PPPoE importada",
              usernameEnc: credential.username ? encryptSecret(credential.username) : null,
              secretEnc: credential.secret ? encryptSecret(credential.secret) : null,
              hasValue: Boolean(credential.username || credential.secret),
            },
          });
          importedSecrets += 1;
        }

        importedLinks += 1;
      }
    }

    await this.writeOperationalActivity({
      actorUserId,
      title: "Importação de dados operacionais",
      description: `${importedLinks} link(s), ${importedSecrets} credencial(is), ${matchedUnits} unidade(s) casada(s), ${skippedUnits} unidade(s) ignorada(s).`,
    });

    return {
      sourceAvailable: true,
      generatedAt: state.bundle.generatedAt,
      redactedSecrets: state.bundle.redactedSecrets,
      matchedUnits,
      skippedUnits,
      importedLinks,
      importedSecrets,
      summary: state.bundle.summary,
    };
  }

}
