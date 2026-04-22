import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import { ListMaintenancesQueryDto } from "./dto/list-maintenances-query.dto";
import { UpdateMaintenanceDto } from "./dto/update-maintenance.dto";

@Injectable()
export class MaintenancesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePartner(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;

    const item = await this.prisma.partner.findUnique({
      where: { id: normalized },
      select: { id: true },
    });

    if (!item) throw new BadRequestException("partnerId inválido");
    return normalized;
  }

  private async ensureUnit(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;

    const item = await this.prisma.unit.findUnique({
      where: { id: normalized },
      select: { id: true },
    });

    if (!item) throw new BadRequestException("unitId inválido");
    return normalized;
  }

  private async ensureEquipment(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;

    const item = await this.prisma.equipment.findUnique({
      where: { id: normalized },
      select: { id: true },
    });

    if (!item) throw new BadRequestException("equipmentId inválido");
    return normalized;
  }

  private async ensureOccurrence(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;

    const item = await this.prisma.occurrence.findUnique({
      where: { id: normalized },
      select: { id: true },
    });

    if (!item) throw new BadRequestException("occurrenceId inválido");
    return normalized;
  }

  private parseDate(value?: string | null) {
    const normalized = String(value || "").trim();
    if (!normalized) return null;

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Data inválida");
    }

    return parsed;
  }

  async listMaintenances(query: ListMaintenancesQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.MaintenanceWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { equipment: { is: { tag: { contains: q, mode: "insensitive" } } } },
        { equipment: { is: { name: { contains: q, mode: "insensitive" } } } },
        { occurrence: { is: { code: { contains: q, mode: "insensitive" } } } },
        { occurrence: { is: { title: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (query.unitId?.trim()) where.unitId = query.unitId.trim();
    if (query.equipmentId?.trim()) where.equipmentId = query.equipmentId.trim();
    if (query.type && query.type !== "all") where.type = query.type;
    if (query.status && query.status !== "all") where.status = query.status;

    let orderBy: Prisma.MaintenanceOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "code":
        orderBy = { code: sortDir };
        break;
      case "title":
        orderBy = { title: sortDir };
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
      this.prisma.maintenance.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          type: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          occurrence: { select: { id: true, code: true, title: true } },
        },
      }),
      this.prisma.maintenance.count({ where }),
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

  async getMaintenanceById(id: string) {
    const maintenance = await this.prisma.maintenance.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        type: true,
        status: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        partner: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
        equipment: { select: { id: true, tag: true, name: true, type: true, status: true } },
        occurrence: { select: { id: true, code: true, title: true, severity: true, status: true } },
      },
    });

    if (!maintenance) {
      throw new NotFoundException("Manutenção não encontrada");
    }

    return maintenance;
  }

  async createMaintenance(payload: CreateMaintenanceDto) {
    const code = payload.code.trim().toUpperCase();
    const title = payload.title.trim();
    const description = payload.description?.trim() || null;
    const type = (payload.type || "preventive").trim().toLowerCase();
    const status = (payload.status || "planned").trim().toLowerCase();

    const existing = await this.prisma.maintenance.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Código de manutenção já existe");
    }

    const partnerId = await this.ensurePartner(payload.partnerId);
    const unitId = await this.ensureUnit(payload.unitId);
    const equipmentId = await this.ensureEquipment(payload.equipmentId);
    const occurrenceId = await this.ensureOccurrence(payload.occurrenceId);
    const scheduledAt = this.parseDate(payload.scheduledAt);
    const completedAt = this.parseDate(payload.completedAt);

    return this.prisma.maintenance.create({
      data: {
        code,
        title,
        description,
        type,
        status,
        scheduledAt,
        completedAt,
        partnerId,
        unitId,
        equipmentId,
        occurrenceId,
      },
    });
  }

  async updateMaintenance(id: string, payload: UpdateMaintenanceDto) {
    const existing = await this.prisma.maintenance.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Manutenção não encontrada");
    }

    const data: Prisma.MaintenanceUpdateInput = {};

    if (payload.code !== undefined) data.code = payload.code.trim().toUpperCase();
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.description !== undefined) data.description = payload.description.trim() || null;
    if (payload.type !== undefined) data.type = payload.type.trim().toLowerCase();
    if (payload.status !== undefined) data.status = payload.status.trim().toLowerCase();

    if (payload.partnerId !== undefined) {
      const partnerId = await this.ensurePartner(payload.partnerId);
      data.partner = partnerId ? { connect: { id: partnerId } } : { disconnect: true };
    }

    if (payload.unitId !== undefined) {
      const unitId = await this.ensureUnit(payload.unitId);
      data.unit = unitId ? { connect: { id: unitId } } : { disconnect: true };
    }

    if (payload.equipmentId !== undefined) {
      const equipmentId = await this.ensureEquipment(payload.equipmentId);
      data.equipment = equipmentId ? { connect: { id: equipmentId } } : { disconnect: true };
    }

    if (payload.occurrenceId !== undefined) {
      const occurrenceId = await this.ensureOccurrence(payload.occurrenceId);
      data.occurrence = occurrenceId ? { connect: { id: occurrenceId } } : { disconnect: true };
    }

    if (payload.scheduledAt !== undefined) data.scheduledAt = this.parseDate(payload.scheduledAt);
    if (payload.completedAt !== undefined) data.completedAt = this.parseDate(payload.completedAt);

    return this.prisma.maintenance.update({
      where: { id },
      data,
    });
  }
}
