import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOccurrenceDto } from "./dto/create-occurrence.dto";
import { ListOccurrencesQueryDto } from "./dto/list-occurrences-query.dto";
import { UpdateOccurrenceDto } from "./dto/update-occurrence.dto";

@Injectable()
export class OccurrencesService {
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

  async listOccurrences(query: ListOccurrencesQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.OccurrenceWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { source: { contains: q, mode: "insensitive" } },
        { partner: { is: { code: { contains: q, mode: "insensitive" } } } },
        { partner: { is: { name: { contains: q, mode: "insensitive" } } } },
        { unit: { is: { code: { contains: q, mode: "insensitive" } } } },
        { unit: { is: { name: { contains: q, mode: "insensitive" } } } },
        { equipment: { is: { tag: { contains: q, mode: "insensitive" } } } },
        { equipment: { is: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (query.unitId?.trim()) where.unitId = query.unitId.trim();
    if (query.equipmentId?.trim()) where.equipmentId = query.equipmentId.trim();
    if (query.severity && query.severity !== "all") where.severity = query.severity;
    if (query.status && query.status !== "all") where.status = query.status;

    let orderBy: Prisma.OccurrenceOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "code":
        orderBy = { code: sortDir };
        break;
      case "title":
        orderBy = { title: sortDir };
        break;
      case "severity":
        orderBy = { severity: sortDir };
        break;
      case "status":
        orderBy = { status: sortDir };
        break;
      default:
        orderBy = { createdAt: sortDir };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.occurrence.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          _count: { select: { maintenances: true } },
        },
      }),
      this.prisma.occurrence.count({ where }),
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

  async getOccurrenceById(id: string) {
    const occurrence = await this.prisma.occurrence.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        partner: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
        equipment: { select: { id: true, tag: true, name: true } },
        maintenances: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            code: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            completedAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            maintenances: true,
          },
        },
      },
    });

    if (!occurrence) {
      throw new NotFoundException("Ocorrência não encontrada");
    }

    return occurrence;
  }

  async createOccurrence(payload: CreateOccurrenceDto) {
    const code = payload.code.trim().toUpperCase();
    const title = payload.title.trim();
    const description = payload.description?.trim() || null;
    const severity = (payload.severity || "medium").trim().toLowerCase();
    const status = (payload.status || "open").trim().toLowerCase();
    const source = payload.source?.trim() || null;

    const existing = await this.prisma.occurrence.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Código de ocorrência já existe");
    }

    const partnerId = await this.ensurePartner(payload.partnerId);
    const unitId = await this.ensureUnit(payload.unitId);
    const equipmentId = await this.ensureEquipment(payload.equipmentId);

    return this.prisma.occurrence.create({
      data: {
        code,
        title,
        description,
        severity,
        status,
        source,
        partnerId,
        unitId,
        equipmentId,
      },
    });
  }

  async updateOccurrence(id: string, payload: UpdateOccurrenceDto) {
    const existing = await this.prisma.occurrence.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Ocorrência não encontrada");
    }

    const data: Prisma.OccurrenceUpdateInput = {};

    if (payload.code !== undefined) data.code = payload.code.trim().toUpperCase();
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.description !== undefined) data.description = payload.description.trim() || null;
    if (payload.severity !== undefined) data.severity = payload.severity.trim().toLowerCase();
    if (payload.status !== undefined) data.status = payload.status.trim().toLowerCase();
    if (payload.source !== undefined) data.source = payload.source.trim() || null;

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

    return this.prisma.occurrence.update({
      where: { id },
      data,
    });
  }
}
