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
          _count: {
            select: { units: true },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.partner.count({ where }),
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

    return this.prisma.partner.create({
      data: { code, name, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
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

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    return this.prisma.partner.update({
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
  }
}
