import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartnerDto } from "./dto/create-partner.dto";
import { ListPartnersQueryDto } from "./dto/list-partners-query.dto";
import { UpdatePartnerDto } from "./dto/update-partner.dto";

type PartnerMatch = {
  id: string;
  code: string;
  name: string;
};

type LegacyPartnerContactPayload = Record<string, unknown>;

type PartnerContactPayloadFields = {
  cityBase?: unknown;
  contactName?: unknown;
  contactRole?: unknown;
  contactPhone?: unknown;
  coverage?: unknown;
};

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPartners(query: ListPartnersQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.PartnerWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { operationalContacts: { some: { name: { contains: q, mode: "insensitive" } } } },
        { operationalContacts: { some: { city: { contains: q, mode: "insensitive" } } } },
        { operationalContacts: { some: { phone: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (query.active === "true") {
      where.isActive = true;
    } else if (query.active === "false") {
      where.isActive = false;
    }

    let orderBy: Prisma.PartnerOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "code":
        orderBy = { code: sortDir };
        break;
      case "name":
        orderBy = { name: sortDir };
        break;
      default:
        orderBy = { createdAt: sortDir };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          createdAt: true,
          operationalContacts: {
            orderBy: [{ isPrimary: "desc" }, { sourceLegacyId: "asc" }, { createdAt: "asc" }],
            take: 1,
            select: {
              id: true,
              city: true,
              name: true,
              role: true,
              phone: true,
              notes: true,
              isPrimary: true,
              source: true,
              sourceLegacyId: true,
            },
          },
          _count: {
            select: { units: true, operationalContacts: true },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        primaryContact: item.operationalContacts[0] || null,
        operationalContactCount: item._count.operationalContacts,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasPrev: page > 1,
        hasNext: skip + items.length < total,
      },
    };
  }

  async getPartnerById(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        operationalContacts: {
          orderBy: [{ isPrimary: "desc" }, { sourceLegacyId: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            source: true,
            sourceLegacyId: true,
            city: true,
            name: true,
            role: true,
            phone: true,
            notes: true,
            isPrimary: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        units: {
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            isActive: true,
            _count: {
              select: {
                equipments: true,
                occurrences: true,
                maintenances: true,
              },
            },
          },
        },
        occurrences: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            code: true,
            title: true,
            severity: true,
            status: true,
            createdAt: true,
          },
        },
        maintenances: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            code: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            units: true,
            occurrences: true,
            maintenances: true,
            operationalContacts: true,
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException("Parceiro não encontrado");
    }

    return partner;
  }

  async createPartner(payload: CreatePartnerDto) {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();

    const existing = await this.prisma.partner.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Código de parceiro já existe");
    }

    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: { code, name, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (this.hasContactPayload(payload)) {
        await tx.partnerOperationalContact.create({
          data: {
            partnerId: partner.id,
            source: "manual",
            city: this.nullable(payload.cityBase),
            name: this.nullable(payload.contactName),
            role: this.nullable(payload.contactRole),
            phone: this.nullable(payload.contactPhone),
            notes: this.nullable(payload.coverage),
            isPrimary: true,
          },
        });
      }

      return partner;
    });
  }

  async updatePartner(id: string, payload: UpdatePartnerDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!partner) {
      throw new NotFoundException("Parceiro não encontrado");
    }

    const data: Prisma.PartnerUpdateInput = {};

    if (payload.code !== undefined) {
      const code = payload.code.trim().toUpperCase();
      if (!code) throw new BadRequestException("Code inválido");
      data.code = code;
    }

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new BadRequestException("Name inválido");
      data.name = name;
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partner.update({
        where: { id },
        data,
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (this.hasContactPayload(payload)) {
        const primary = await tx.partnerOperationalContact.findFirst({
          where: { partnerId: id, isPrimary: true },
          select: { id: true },
        });

        const contactData = {
          city: this.nullable(payload.cityBase),
          name: this.nullable(payload.contactName),
          role: this.nullable(payload.contactRole),
          phone: this.nullable(payload.contactPhone),
          notes: this.nullable(payload.coverage),
        };

        if (primary) {
          await tx.partnerOperationalContact.update({
            where: { id: primary.id },
            data: contactData,
          });
        } else {
          await tx.partnerOperationalContact.create({
            data: {
              partnerId: id,
              source: "manual",
              ...contactData,
              isPrimary: true,
            },
          });
        }
      }

      return updated;
    });
  }

  async createPartnerContact(id: string, payload: Record<string, unknown>) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!partner) {
      throw new NotFoundException("Parceiro não encontrado");
    }

    return this.prisma.$transaction(async (tx) => {
      const existingPrimary = await tx.partnerOperationalContact.findFirst({
        where: { partnerId: id, isPrimary: true },
        select: { id: true },
      });
      const isPrimary = this.booleanValue(payload.isPrimary) || !existingPrimary;

      if (isPrimary) {
        await tx.partnerOperationalContact.updateMany({
          where: { partnerId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.partnerOperationalContact.create({
        data: {
          partnerId: id,
          source: this.clean(payload.source) || "manual",
          sourceLegacyId: this.nullable(payload.sourceLegacyId),
          city: this.nullable(payload.city),
          name: this.nullable(payload.name),
          role: this.nullable(payload.role),
          phone: this.nullable(payload.phone),
          notes: this.nullable(payload.notes),
          isPrimary,
        },
      });
    });
  }

  async updatePartnerContact(id: string, contactId: string, payload: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.partnerOperationalContact.findFirst({
        where: { id: contactId, partnerId: id },
        select: { id: true },
      });

      if (!contact) {
        throw new NotFoundException("Contato de parceiro não encontrado");
      }

      const isPrimary = this.booleanValue(payload.isPrimary);

      if (isPrimary) {
        await tx.partnerOperationalContact.updateMany({
          where: { partnerId: id, id: { not: contactId }, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.partnerOperationalContact.update({
        where: { id: contactId },
        data: {
          city: this.nullable(payload.city),
          name: this.nullable(payload.name),
          role: this.nullable(payload.role),
          phone: this.nullable(payload.phone),
          notes: this.nullable(payload.notes),
          isPrimary,
        },
      });
    });
  }

  async importLegacyContacts(payload: unknown) {
    return this.importOperationalContacts(payload);
  }

  async importOperationalContacts(payload: unknown) {
    const bundle = this.asRecord(payload);
    const raw = this.asRecord(bundle.raw);
    const rows = Array.isArray(raw.parceiros) ? (raw.parceiros as LegacyPartnerContactPayload[]) : [];

    const partners = await this.prisma.partner.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    const maps = this.buildPartnerMaps(partners);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const legacyId = this.clean(row.id);
      const partnerName = this.clean(row.parceiro);
      const partner = this.matchPartner(partnerName, maps);

      if (!legacyId || !partner) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.partnerOperationalContact.findUnique({
        where: {
          source_sourceLegacyId: {
            source: "legacy_sqlite",
            sourceLegacyId: legacyId,
          },
        },
        select: { id: true },
      });

      const existingPrimary = await this.prisma.partnerOperationalContact.findFirst({
        where: { partnerId: partner.id, isPrimary: true },
        select: { id: true },
      });

      await this.prisma.partnerOperationalContact.upsert({
        where: {
          source_sourceLegacyId: {
            source: "legacy_sqlite",
            sourceLegacyId: legacyId,
          },
        },
        update: {
          partnerId: partner.id,
          city: this.nullable(row.cidade),
          name: this.nullable(row.nome_contato),
          role: this.nullable(row.cargo),
          phone: this.nullable(row.numero),
          notes: this.nullable(row.observacoes),
        },
        create: {
          partnerId: partner.id,
          source: "legacy_sqlite",
          sourceLegacyId: legacyId,
          city: this.nullable(row.cidade),
          name: this.nullable(row.nome_contato),
          role: this.nullable(row.cargo),
          phone: this.nullable(row.numero),
          notes: this.nullable(row.observacoes),
          isPrimary: !existingPrimary,
        },
      });

      if (existing) updated += 1;
      else imported += 1;
    }

    return {
      imported,
      updated,
      skipped,
      total: rows.length,
    };
  }

  private hasContactPayload(payload: PartnerContactPayloadFields) {
    return [
      payload.cityBase,
      payload.contactName,
      payload.contactRole,
      payload.contactPhone,
      payload.coverage,
    ].some((value) => Boolean(this.clean(value)));
  }

  private booleanValue(value: unknown) {
    return value === true || value === "true" || value === "on" || value === "1";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private clean(value: unknown) {
    return String(value ?? "").trim();
  }

  private nullable(value: unknown) {
    const cleaned = this.clean(value);

    return cleaned || null;
  }

  private normalize(value: unknown) {
    return this.clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  private legacyPartnerCode(value: unknown) {
    const raw = this.clean(value) || "SEM-PARCEIRO";
    const folded = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return folded || "SEM-PARCEIRO";
  }

  private buildPartnerMaps(partners: PartnerMatch[]) {
    const byCode = new Map<string, PartnerMatch>();
    const byName = new Map<string, PartnerMatch>();

    for (const partner of partners) {
      byCode.set(this.normalize(partner.code), partner);
      byName.set(this.normalize(partner.name), partner);
    }

    return { byCode, byName };
  }

  private matchPartner(
    partnerName: string,
    maps: {
      byCode: Map<string, PartnerMatch>;
      byName: Map<string, PartnerMatch>;
    },
  ) {
    const code = this.legacyPartnerCode(partnerName);

    return (
      maps.byCode.get(this.normalize(code)) ||
      maps.byName.get(this.normalize(partnerName)) ||
      null
    );
  }
}
