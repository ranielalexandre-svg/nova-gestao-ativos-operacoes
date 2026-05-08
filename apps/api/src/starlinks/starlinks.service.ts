import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { encryptSecret, decryptSecret } from "../common/secrets";
import { PrismaService } from "../prisma/prisma.service";

type LegacyStarlinkPayload = Record<string, unknown>;

type StarlinkEquipmentMatch = {
  id: string;
  tag: string | null;
  serialNumber: string | null;
};

@Injectable()
export class StarlinksService {
  constructor(private readonly prisma: PrismaService) {}

  async listStarlinks() {
    const items = await this.prisma.equipment.findMany({
      where: {
        OR: [
          { type: { contains: "starlink", mode: "insensitive" } },
          { name: { contains: "starlink", mode: "insensitive" } },
          { tag: { contains: "starlink", mode: "insensitive" } },
        ],
      },
      orderBy: { tag: "asc" },
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            partner: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    const equipmentIds = items.map((item) => item.id);

    const [attachmentCounts, operationalInfos] = await Promise.all([
      equipmentIds.length
        ? this.prisma.documentAttachment.groupBy({
            by: ["entityId"],
            where: {
              entityType: "equipment",
              entityId: { in: equipmentIds },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      equipmentIds.length
        ? this.prisma.starlinkOperationalInfo.findMany({
            where: { equipmentId: { in: equipmentIds } },
            select: {
              equipmentId: true,
              emailEnc: true,
              passwordEnc: true,
              cardEnc: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const attachmentsByEquipmentId = new Map(
      attachmentCounts.map((item) => [item.entityId, item._count._all]),
    );

    const operationalCountsByEquipmentId = new Map<string, { rows: number; secrets: number }>();

    for (const info of operationalInfos) {
      const current = operationalCountsByEquipmentId.get(info.equipmentId) || { rows: 0, secrets: 0 };

      current.rows += 1;
      current.secrets += [info.emailEnc, info.passwordEnc, info.cardEnc].filter(Boolean).length;

      operationalCountsByEquipmentId.set(info.equipmentId, current);
    }

    return items.map((item) => {
      const operationalCounts = operationalCountsByEquipmentId.get(item.id) || { rows: 0, secrets: 0 };

      return {
        id: item.id,
        type: item.type,
        manufacturer: item.name.toLowerCase().includes("starlink") ? "Starlink" : null,
        model: item.name,
        technology: item.type,
        assetTag: item.tag,
        serial: item.serialNumber,
        unitId: item.unit.id,
        unitCode: item.unit.code,
        partnerId: item.unit.partner.id,
        partnerCode: item.unit.partner.code,
        status: item.isActive ? item.status : "retired",
        inventoryStatus: item.isActive ? "active" : "inactive",
        createdAt: item.createdAt,
        city: item.unit.city,
        state: item.unit.state,
        unitName: item.unit.name,
        partnerName: item.unit.partner.name,
        documentsCount: attachmentsByEquipmentId.get(item.id) || 0,
        operationalDataCount: operationalCounts.rows,
        operationalSecretsCount: operationalCounts.secrets,
      };
    });
  }

  async getOperationalStarlinkData(equipmentId: string, revealSecrets: boolean) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            partner: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException("Starlink não encontrado");
    }

    const items = await this.prisma.starlinkOperationalInfo.findMany({
      where: { equipmentId },
      orderBy: [{ antennaId: "asc" }, { legacyId: "asc" }],
    });

    if (revealSecrets && items.some((item) => item.emailEnc || item.passwordEnc || item.cardEnc)) {
      void this.prisma.activityEntry
        .create({
          data: {
            kind: "security",
            source: "starlinks",
            title: "Dados sensíveis Starlink revelados",
            description: `${equipment.tag} teve credenciais operacionais reveladas na interface.`,
            severity: "warning",
            equipmentId: equipment.id,
          },
        })
        .catch(() => undefined);
    }

    return {
      equipment,
      revealSecrets,
      total: items.length,
      items: items.map((item) => this.formatOperationalInfo(item, revealSecrets)),
    };
  }

  async getLegacyStarlinkData(equipmentId: string, revealSecrets: boolean) {
    return this.getOperationalStarlinkData(equipmentId, revealSecrets);
  }

  async updateOperationalStarlinkData(
    equipmentId: string,
    infoId: string,
    payload: Record<string, unknown>,
  ) {
    const existing = await this.prisma.starlinkOperationalInfo.findFirst({
      where: { id: infoId, equipmentId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Dados operacionais do Starlink não encontrados");
    }

    const data: Prisma.StarlinkOperationalInfoUpdateInput = {};

    this.copyString(payload, data, "antennaId");
    this.copyString(payload, data, "localName");
    this.copyString(payload, data, "kitSerial");
    this.copyString(payload, data, "antennaSerial");
    this.copyString(payload, data, "ipvpn");
    this.copyString(payload, data, "plan");
    this.copyString(payload, data, "installer");
    this.copyString(payload, data, "installedAt");
    this.copyString(payload, data, "notes");

    const email = this.clean(payload.email);
    const password = this.clean(payload.password);
    const card = this.clean(payload.card);

    if (email) data.emailEnc = encryptSecret(email);
    if (password) data.passwordEnc = encryptSecret(password);
    if (card) data.cardEnc = encryptSecret(card);

    const updated = await this.prisma.starlinkOperationalInfo.update({
      where: { id: infoId },
      data,
    });

    return this.formatOperationalInfo(updated, false);
  }

  async updateLegacyStarlinkData(
    equipmentId: string,
    infoId: string,
    payload: Record<string, unknown>,
  ) {
    return this.updateOperationalStarlinkData(equipmentId, infoId, payload);
  }

  async importOperationalStarlinkData(payload: unknown) {
    const bundle = this.asRecord(payload);
    const normalized = this.asRecord(bundle.normalized);
    const legacyStarlinks = Array.isArray(normalized.starlinks)
      ? (normalized.starlinks as LegacyStarlinkPayload[])
      : [];

    const equipments = await this.prisma.equipment.findMany({
      where: {
        OR: [
          { type: { contains: "starlink", mode: "insensitive" } },
          { name: { contains: "starlink", mode: "insensitive" } },
          { tag: { contains: "starlink", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        tag: true,
        serialNumber: true,
      },
    });

    const maps = this.buildEquipmentMaps(equipments);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of legacyStarlinks) {
      const legacyId = this.clean(item.legacyId);
      const equipment = this.matchEquipmentForLegacy(item, maps);

      if (!legacyId || !equipment) {
        skipped += 1;
        continue;
      }

      const data = this.toStarlinkOperationalData(item, equipment.id);

      const existing = await this.prisma.starlinkOperationalInfo.findUnique({
        where: { legacyId },
        select: { id: true },
      });

      await this.prisma.starlinkOperationalInfo.upsert({
        where: { legacyId },
        update: data,
        create: {
          ...data,
          legacyId,
        },
      });

      if (existing) updated += 1;
      else imported += 1;
    }

    return {
      imported,
      updated,
      skipped,
      total: legacyStarlinks.length,
    };
  }

  async importLegacyStarlinkData(payload: unknown) {
    return this.importOperationalStarlinkData(payload);
  }

  private formatOperationalInfo(
    item: Prisma.StarlinkOperationalInfoGetPayload<Record<string, never>>,
    revealSecrets: boolean,
  ) {
    return {
      id: item.id,
      equipmentId: item.equipmentId,
      source: item.source,
      legacyId: item.legacyId,
      antennaId: item.antennaId,
      localName: item.localName,
      kitSerial: item.kitSerial,
      antennaSerial: item.antennaSerial,
      ipvpn: item.ipvpn,
      plan: item.plan,
      installer: item.installer,
      installedAt: item.installedAt,
      notes: item.notes,
      hasEmail: Boolean(item.emailEnc),
      hasPassword: Boolean(item.passwordEnc),
      hasCard: Boolean(item.cardEnc),
      email: revealSecrets ? this.decryptValue(item.emailEnc) : null,
      password: revealSecrets ? this.decryptValue(item.passwordEnc) : null,
      card: revealSecrets ? this.decryptValue(item.cardEnc) : null,
      revealed: revealSecrets,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toStarlinkOperationalData(item: LegacyStarlinkPayload, equipmentId: string) {
    return {
      equipmentId,
      source: "legacy_sqlite",
      antennaId: this.nullable(item.antennaId),
      localName: this.nullable(item.localName),
      kitSerial: this.nullable(item.kitSerial),
      antennaSerial: this.nullable(item.antennaSerial),
      ipvpn: this.nullable(item.ipvpn),
      plan: this.nullable(item.plan),
      installer: this.nullable(item.installer),
      installedAt: this.nullable(item.installedAt),
      notes: this.nullable(item.notes),
      emailEnc: this.encryptNullable(item.email),
      passwordEnc: this.encryptNullable(item.password),
      cardEnc: this.encryptNullable(item.card),
    };
  }

  private copyString(
    payload: Record<string, unknown>,
    data: Prisma.StarlinkOperationalInfoUpdateInput,
    key: keyof Prisma.StarlinkOperationalInfoUpdateInput,
  ) {
    if (!(key in payload)) return;

    data[key] = this.nullable(payload[key as string]) as never;
  }

  private decryptValue(value?: string | null) {
    if (!value) return null;

    try {
      return decryptSecret(value);
    } catch {
      return null;
    }
  }

  private encryptNullable(value: unknown) {
    const cleaned = this.clean(value);

    return cleaned && cleaned !== "<redacted>" ? encryptSecret(cleaned) : null;
  }

  private nullable(value: unknown) {
    const cleaned = this.clean(value);

    return cleaned || null;
  }

  private clean(value: unknown) {
    return String(value ?? "").trim();
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private norm(value: unknown) {
    return this.clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  private numberToken(value: unknown) {
    const match = this.clean(value).match(/(\d+)/);

    return match ? String(Number.parseInt(match[1], 10)) : "";
  }

  private buildEquipmentMaps(equipments: StarlinkEquipmentMatch[]) {
    const bySerial = new Map<string, StarlinkEquipmentMatch[]>();
    const byTagNumber = new Map<string, StarlinkEquipmentMatch[]>();

    for (const equipment of equipments) {
      for (const key of [equipment.serialNumber, equipment.tag]) {
        const normalized = this.norm(key);
        if (!normalized) continue;

        bySerial.set(normalized, [...(bySerial.get(normalized) || []), equipment]);
      }

      const tagNumber = this.numberToken(equipment.tag);
      if (tagNumber) {
        byTagNumber.set(tagNumber, [...(byTagNumber.get(tagNumber) || []), equipment]);
      }
    }

    return { bySerial, byTagNumber };
  }

  private matchEquipmentForLegacy(
    item: LegacyStarlinkPayload,
    maps: {
      bySerial: Map<string, StarlinkEquipmentMatch[]>;
      byTagNumber: Map<string, StarlinkEquipmentMatch[]>;
    },
  ) {
    const candidates: StarlinkEquipmentMatch[] = [];

    for (const field of ["kitSerial", "antennaSerial"]) {
      const normalized = this.norm(item[field]);
      if (!normalized) continue;

      candidates.push(...(maps.bySerial.get(normalized) || []));
    }

    for (const field of ["antennaId", "legacyId"]) {
      const token = this.numberToken(item[field]);
      if (!token) continue;

      candidates.push(...(maps.byTagNumber.get(token) || []));
    }

    const seen = new Set<string>();

    return candidates.find((equipment) => {
      if (seen.has(equipment.id)) return false;
      seen.add(equipment.id);
      return true;
    });
  }
}
