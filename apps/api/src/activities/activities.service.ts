import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ListActivitiesQueryDto } from "./dto/list-activities-query.dto";

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUser(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.user.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("userId inválido");
    return normalized;
  }

  private async ensureException(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.exceptionCase.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("exceptionId inválido");
    return normalized;
  }

  private async ensureAutomation(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.automationRule.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("automationId inválido");
    return normalized;
  }

  private async ensureAutomationRun(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.automationRun.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("automationRunId inválido");
    return normalized;
  }

  private async ensurePartner(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.partner.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("partnerId inválido");
    return normalized;
  }

  private async ensureUnit(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.unit.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("unitId inválido");
    return normalized;
  }

  private async ensureEquipment(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.equipment.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("equipmentId inválido");
    return normalized;
  }

  private async ensureIntegration(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.integration.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("integrationId inválido");
    return normalized;
  }

  private async ensureOccurrence(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.occurrence.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("occurrenceId inválido");
    return normalized;
  }

  private async ensureMaintenance(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.maintenance.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("maintenanceId inválido");
    return normalized;
  }

  async listActivities(query: ListActivitiesQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";
    const sortBy = query.sortBy || "createdAt";

    const where: Prisma.ActivityEntryWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { actor: { is: { name: { contains: q, mode: "insensitive" } } } },
        { exceptionCase: { is: { code: { contains: q, mode: "insensitive" } } } },
        { automation: { is: { code: { contains: q, mode: "insensitive" } } } },
        { occurrence: { is: { code: { contains: q, mode: "insensitive" } } } },
        { maintenance: { is: { code: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (query.kind && query.kind !== "all") where.kind = query.kind;
    if (query.source && query.source !== "all") where.source = query.source;
    if (query.severity && query.severity !== "all") where.severity = query.severity;

    let orderBy: Prisma.ActivityEntryOrderByWithRelationInput = { createdAt: sortDir };
    if (sortBy === "updatedAt") orderBy = { updatedAt: sortDir };
    if (sortBy === "severity") orderBy = { severity: sortDir };
    if (sortBy === "kind") orderBy = { kind: sortDir };
    if (sortBy === "source") orderBy = { source: sortDir };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityEntry.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          kind: true,
          source: true,
          title: true,
          description: true,
          severity: true,
          createdAt: true,
          updatedAt: true,
          actor: { select: { id: true, name: true, email: true, role: true } },
          exceptionCase: { select: { id: true, code: true, title: true, status: true } },
          automation: { select: { id: true, code: true, name: true, detector: true } },
          automationRun: { select: { id: true, status: true, startedAt: true, finishedAt: true } },
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          integration: { select: { id: true, code: true, name: true } },
          occurrence: { select: { id: true, code: true, title: true } },
          maintenance: { select: { id: true, code: true, title: true } },
        },
      }),
      this.prisma.activityEntry.count({ where }),
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

  async createActivity(payload: CreateActivityDto) {
    const title = payload.title.trim();
    const description = payload.description?.trim() || null;
    const kind = (payload.kind || "note").trim().toLowerCase();
    const source = (payload.source || "manual").trim().toLowerCase();
    const severity = payload.severity?.trim().toLowerCase() || null;

    const userId = await this.ensureUser(payload.userId);
    const exceptionId = await this.ensureException(payload.exceptionId);
    const automationId = await this.ensureAutomation(payload.automationId);
    const automationRunId = await this.ensureAutomationRun(payload.automationRunId);
    const partnerId = await this.ensurePartner(payload.partnerId);
    const unitId = await this.ensureUnit(payload.unitId);
    const equipmentId = await this.ensureEquipment(payload.equipmentId);
    const integrationId = await this.ensureIntegration(payload.integrationId);
    const occurrenceId = await this.ensureOccurrence(payload.occurrenceId);
    const maintenanceId = await this.ensureMaintenance(payload.maintenanceId);

    const activity = await this.prisma.activityEntry.create({
      data: {
        title,
        description,
        kind,
        source,
        severity,
        userId,
        exceptionId,
        automationId,
        automationRunId,
        partnerId,
        unitId,
        equipmentId,
        integrationId,
        occurrenceId,
        maintenanceId,
      },
    });

    if (exceptionId) {
      await this.prisma.exceptionCase.update({
        where: { id: exceptionId },
        data: { lastActivityAt: new Date() },
      });
    }

    return activity;
  }
}
