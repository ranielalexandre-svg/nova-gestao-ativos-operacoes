import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { ListUnitsQueryDto } from "./dto/list-units-query.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  private zabbixSyncUnitSelect() {
    return {
      id: true,
      code: true,
      name: true,
      city: true,
      state: true,
      reportContractLabel: true,
      reportAddressLine: true,
      reportContractedBandwidth: true,
      reportNotes: true,
      zabbixHost: true,
      zabbixVisibleName: true,
      isActive: true,
      partner: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      equipments: {
        orderBy: { tag: "asc" },
        select: {
          id: true,
          tag: true,
          name: true,
          type: true,
          serialNumber: true,
          status: true,
          isActive: true,
        },
      },
    } satisfies Prisma.UnitSelect;
  }

  private async getUnitForZabbixSync(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: this.zabbixSyncUnitSelect(),
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    return unit;
  }

  private async listUnitsForZabbixSync() {
    return this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
      take: 300,
      select: this.zabbixSyncUnitSelect(),
    });
  }

  private queueZabbixSync(id: string) {
    void this.syncUnitToZabbix(id).catch(() => undefined);
  }

  async listUnits(query: ListUnitsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.UnitWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { state: { contains: q, mode: "insensitive" } },
        { partner: { is: { code: { contains: q, mode: "insensitive" } } } },
        { partner: { is: { name: { contains: q, mode: "insensitive" } } } },
        { equipments: { some: { tag: { contains: q, mode: "insensitive" } } } },
        { equipments: { some: { name: { contains: q, mode: "insensitive" } } } },
        { equipments: { some: { type: { contains: q, mode: "insensitive" } } } },
        {
          equipments: {
            some: { serialNumber: { contains: q, mode: "insensitive" } },
          },
        },
      ];
    }

    if (query.partnerId?.trim()) {
      where.partnerId = query.partnerId.trim();
    }

    if (query.active === "true") {
      where.isActive = true;
    } else if (query.active === "false") {
      where.isActive = false;
    }

    let orderBy: Prisma.UnitOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "code":
        orderBy = { code: sortDir };
        break;
      case "name":
        orderBy = { name: sortDir };
        break;
      case "city":
        orderBy = { city: sortDir };
        break;
      case "state":
        orderBy = { state: sortDir };
        break;
      default:
        orderBy = { createdAt: sortDir };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          reportContractLabel: true,
          reportAddressLine: true,
          reportContractedBandwidth: true,
          reportNotes: true,
          isActive: true,
          createdAt: true,
          partner: {
            select: { id: true, code: true, name: true },
          },
          equipments: {
            orderBy: { tag: "asc" },
            take: 3,
            select: {
              id: true,
              tag: true,
              name: true,
              type: true,
              serialNumber: true,
              status: true,
              isActive: true,
            },
          },
          _count: {
            select: { equipments: true },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.unit.count({ where }),
    ]);

    return {
      items,
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

  async getUnitById(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        reportContractLabel: true,
        reportAddressLine: true,
        reportContractedBandwidth: true,
        reportNotes: true,
        zabbixHost: true,
        zabbixVisibleName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        partner: {
          select: { id: true, code: true, name: true, isActive: true },
        },
        equipments: {
          orderBy: { tag: "asc" },
          select: {
            id: true,
            tag: true,
            name: true,
            type: true,
            serialNumber: true,
            status: true,
            isActive: true,
          },
        },
        occurrences: {
          orderBy: { createdAt: "desc" },
          take: 10,
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
          take: 10,
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
            equipments: true,
            occurrences: true,
            maintenances: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    return unit;
  }

  async createUnit(payload: CreateUnitDto) {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const city = payload.city?.trim() || "";
    const state = payload.state?.trim().toUpperCase() || "";
    const partnerId = payload.partnerId.trim();
    const reportContractLabel = payload.reportContractLabel?.trim() || null;
    const reportAddressLine = payload.reportAddressLine?.trim() || null;
    const reportContractedBandwidth = payload.reportContractedBandwidth?.trim() || null;
    const reportNotes = payload.reportNotes?.trim() || null;

    const existing = await this.prisma.unit.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Código de unidade já existe");
    }

    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });

    if (!partner) {
      throw new BadRequestException("partnerId inválido");
    }

    const created = await this.prisma.unit.create({
      data: {
        code,
        name,
        city: city || null,
        state: state || null,
        reportContractLabel,
        reportAddressLine,
        reportContractedBandwidth,
        reportNotes,
        isActive: true,
        partnerId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        reportContractLabel: true,
        reportAddressLine: true,
        reportContractedBandwidth: true,
        reportNotes: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.queueZabbixSync(created.id);

    return created;
  }

  async updateUnit(id: string, payload: UpdateUnitDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    const data: Record<string, unknown> = {};

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

    if (payload.city !== undefined) {
      data.city = payload.city.trim() || null;
    }

    if (payload.state !== undefined) {
      data.state = payload.state.trim().toUpperCase() || null;
    }

    if (payload.zabbixHost !== undefined) {
      data.zabbixHost = payload.zabbixHost.trim() || null;
    }

    if (payload.zabbixVisibleName !== undefined) {
      data.zabbixVisibleName = payload.zabbixVisibleName.trim() || null;
    }

    if (payload.partnerId !== undefined) {
      const partnerId = payload.partnerId.trim();
      const partner = await this.prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });
      if (!partner) throw new BadRequestException("partnerId inválido");
      data.partnerId = partnerId;
    }


    if (payload.reportContractLabel !== undefined) {
      data.reportContractLabel = payload.reportContractLabel.trim() || null;
    }

    if (payload.reportAddressLine !== undefined) {
      data.reportAddressLine = payload.reportAddressLine.trim() || null;
    }

    if (payload.reportContractedBandwidth !== undefined) {
      data.reportContractedBandwidth = payload.reportContractedBandwidth.trim() || null;
    }

    if (payload.reportNotes !== undefined) {
      data.reportNotes = payload.reportNotes.trim() || null;
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    const updated = await this.prisma.unit.update({
      where: { id },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        reportContractLabel: true,
        reportAddressLine: true,
        reportContractedBandwidth: true,
        reportNotes: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.queueZabbixSync(updated.id);

    return updated;
  }

  async syncUnitToZabbix(id: string) {
    const unit = await this.getUnitForZabbixSync(id);
    return this.integrationsService.syncUnitToZabbix(unit);
  }

  async syncReadyUnitsToZabbix() {
    const units = await this.listUnitsForZabbixSync();
    const telemetry = await this.integrationsService.getZabbixUnitHostTelemetry(units);
    const readyIds = new Set(
      telemetry.items
        .filter((item) => item.match.status === "matched" && item.match.syncReady)
        .map((item) => item.unit.id),
    );
    const readyUnits = units.filter((unit) => readyIds.has(unit.id));

    const results: Array<{
      unit: {
        id: string;
        code: string;
        name: string;
        partnerCode: string;
        partnerName: string;
      };
      ok: boolean;
      status: "synced" | "skipped" | "failed";
      message: string;
      integrationCode?: string;
      hostId?: string;
      hostName?: string;
      updatedTags?: number;
      updatedInventoryFields?: string[];
    }> = [];

    for (const unit of readyUnits) {
      const result = await this.integrationsService.syncUnitToZabbix(unit);
      results.push({
        unit: {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          partnerCode: unit.partner.code,
          partnerName: unit.partner.name,
        },
        ...result,
      });
    }

    const synced = results.filter((item) => item.status === "synced").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    const failed = results.filter((item) => item.status === "failed").length;

    return {
      ok: failed === 0,
      generatedAt: new Date().toISOString(),
      limit: 300,
      totalUnits: units.length,
      readyUnits: readyUnits.length,
      synced,
      skipped,
      failed,
      pending: {
        unmapped: telemetry.counts.unmapped,
        ambiguous: telemetry.counts.ambiguous,
        withoutExplicitTag: telemetry.counts.matched - telemetry.counts.syncReady,
      },
      sources: telemetry.sources.map((source) => ({
        id: source.id,
        code: source.code,
        name: source.name,
        ok: source.ok,
        message: source.message,
      })),
      results,
    };
  }
}
