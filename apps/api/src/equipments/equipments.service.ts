import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { ListEquipmentsQueryDto } from "./dto/list-equipments-query.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";

@Injectable()
export class EquipmentsService {
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
    return this.prisma.unit.findUnique({
      where: { id },
      select: this.zabbixSyncUnitSelect(),
    });
  }

  private queueZabbixSyncForUnit(id: string | null | undefined) {
    if (!id) return;

    void this.getUnitForZabbixSync(id)
      .then((unit) => {
        if (unit) return this.integrationsService.syncUnitToZabbix(unit);
        return undefined;
      })
      .catch(() => undefined);
  }

  async listEquipments(query: ListEquipmentsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.EquipmentWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { tag: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { unit: { is: { code: { contains: q, mode: "insensitive" } } } },
        { unit: { is: { name: { contains: q, mode: "insensitive" } } } },
        {
          unit: {
            is: {
              partner: { is: { code: { contains: q, mode: "insensitive" } } },
            },
          },
        },
        {
          unit: {
            is: {
              partner: { is: { name: { contains: q, mode: "insensitive" } } },
            },
          },
        },
      ];
    }

    if (query.unitId?.trim()) {
      where.unitId = query.unitId.trim();
    }

    if (query.status?.trim()) {
      where.status = query.status.trim().toLowerCase();
    }

    if (query.active === "true") {
      where.isActive = true;
    } else if (query.active === "false") {
      where.isActive = false;
    }

    let orderBy: Prisma.EquipmentOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "tag":
        orderBy = { tag: sortDir };
        break;
      case "name":
        orderBy = { name: sortDir };
        break;
      case "type":
        orderBy = { type: sortDir };
        break;
      case "status":
        orderBy = { status: sortDir };
        break;
      default:
        orderBy = { createdAt: sortDir };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
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
              partner: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.equipment.count({ where }),
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

  async getEquipmentById(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            partner: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
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
            occurrences: true,
            maintenances: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException("Equipamento não encontrado");
    }

    return equipment;
  }

  async createEquipment(payload: CreateEquipmentDto) {
    const tag = payload.tag.trim().toUpperCase();
    const name = payload.name.trim();
    const type = payload.type.trim().toLowerCase();
    const serialNumber = payload.serialNumber?.trim() || "";
    const status = (payload.status || "active").trim().toLowerCase();
    const unitId = payload.unitId.trim();

    const existing = await this.prisma.equipment.findUnique({
      where: { tag },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Tag de equipamento já existe");
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      throw new BadRequestException("unitId inválido");
    }

    const created = await this.prisma.equipment.create({
      data: {
        tag,
        name,
        type,
        serialNumber: serialNumber || null,
        status,
        isActive: true,
        unitId,
      },
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        unitId: true,
      },
    });

    this.queueZabbixSyncForUnit(created.unitId);

    return created;
  }

  async updateEquipment(id: string, payload: UpdateEquipmentDto) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { id: true, unitId: true },
    });

    if (!equipment) {
      throw new NotFoundException("Equipamento não encontrado");
    }

    const data: Record<string, unknown> = {};

    if (payload.tag !== undefined) {
      const tag = payload.tag.trim().toUpperCase();
      if (!tag) throw new BadRequestException("Tag inválida");
      data.tag = tag;
    }

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new BadRequestException("Name inválido");
      data.name = name;
    }

    if (payload.type !== undefined) {
      const type = payload.type.trim().toLowerCase();
      if (!type) throw new BadRequestException("Type inválido");
      data.type = type;
    }

    if (payload.serialNumber !== undefined) {
      data.serialNumber = payload.serialNumber.trim() || null;
    }

    if (payload.status !== undefined) {
      const status = payload.status.trim().toLowerCase();
      if (!status) throw new BadRequestException("Status inválido");
      data.status = status;
    }

    if (payload.unitId !== undefined) {
      const unitId = payload.unitId.trim();
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true },
      });
      if (!unit) throw new BadRequestException("unitId inválido");
      data.unitId = unitId;
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    const updated = await this.prisma.equipment.update({
      where: { id },
      data,
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        unitId: true,
      },
    });

    this.queueZabbixSyncForUnit(equipment.unitId);
    if (updated.unitId !== equipment.unitId) {
      this.queueZabbixSyncForUnit(updated.unitId);
    }

    return updated;
  }
}
