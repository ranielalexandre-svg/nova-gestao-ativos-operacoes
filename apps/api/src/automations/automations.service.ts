import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { ActivitiesService } from "../activities/activities.service";
import { ExceptionsService } from "../exceptions/exceptions.service";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { ListAutomationRulesQueryDto } from "./dto/list-automation-rules-query.dto";
import { ListAutomationRunsQueryDto } from "./dto/list-automation-runs-query.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";


type AutomationHit = {
  fingerprint: string;
  title: string;
  description: string | null;
  kind: "integration" | "occurrence" | "maintenance" | "automation" | "sla";
  severity: string;
  integrationId?: string | null;
  partnerId?: string | null;
  unitId?: string | null;
  equipmentId?: string | null;
  occurrenceId?: string | null;
  maintenanceId?: string | null;
};


@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly activitiesService: ActivitiesService,
    private readonly exceptionsService: ExceptionsService,
  ) {}

  private nextRunAt(cadence: string, from = new Date()) {
    const now = new Date(from);
    if (cadence === "every_minute") return new Date(now.getTime() + 60 * 1000);
    if (cadence === "every_5_minutes") return new Date(now.getTime() + 5 * 60 * 1000);
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  async listAutomationRules(query: ListAutomationRulesQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.AutomationRuleWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { detector: { contains: q, mode: "insensitive" } },
      ];
    }

    if (query.detector && query.detector !== "all") where.detector = query.detector;
    if (query.enabled === "true") where.enabled = true;
    if (query.enabled === "false") where.enabled = false;

    let orderBy: Prisma.AutomationRuleOrderByWithRelationInput = { createdAt: "desc" };
    if (query.sortBy === "code") orderBy = { code: sortDir };
    if (query.sortBy === "detector") orderBy = { detector: sortDir };
    if (query.sortBy === "cadence") orderBy = { cadence: sortDir };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationRule.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          name: true,
          detector: true,
          severity: true,
          cadence: true,
          thresholdMinutes: true,
          enabled: true,
          createExceptions: true,
          createActivities: true,
          resolveOnRecovery: true,
          lastRunAt: true,
          nextRunAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              runs: true,
              exceptionCases: true,
            },
          },
        },
      }),
      this.prisma.automationRule.count({ where }),
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

  async listAutomationRuns(query: ListAutomationRunsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AutomationRunWhereInput = {};
    if (query.status && query.status !== "all") where.status = query.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationRun.findMany({
        where,
        orderBy: { startedAt: query.sortDir === "asc" ? "asc" : "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          hitsCount: true,
          createdCount: true,
          updatedCount: true,
          summary: true,
          errorMessage: true,
          rule: {
            select: {
              id: true,
              code: true,
              name: true,
              detector: true,
            },
          },
        },
      }),
      this.prisma.automationRun.count({ where }),
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

  async getSummary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [enabledRules, failedRuns24h, dueRules] = await this.prisma.$transaction([
      this.prisma.automationRule.count({ where: { enabled: true } }),
      this.prisma.automationRun.count({
        where: {
          status: "error",
          startedAt: { gte: since },
        },
      }),
      this.prisma.automationRule.count({
        where: {
          enabled: true,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
        },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        enabledRules,
        failedRuns24h,
        dueRules,
      },
    };
  }

  async createAutomationRule(payload: CreateAutomationRuleDto) {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const detector = payload.detector.trim().toLowerCase();
    const severity = (payload.severity || "high").trim().toLowerCase();
    const cadence = (payload.cadence || "every_5_minutes").trim().toLowerCase();
    const thresholdMinutes = payload.thresholdMinutes ?? null;
    const enabled = payload.enabled ?? true;
    const createExceptions = payload.createExceptions ?? true;
    const createActivities = payload.createActivities ?? true;
    const resolveOnRecovery = payload.resolveOnRecovery ?? true;

    const existing = await this.prisma.automationRule.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) throw new ConflictException("Código de automação já existe");

    return this.prisma.automationRule.create({
      data: {
        code,
        name,
        detector,
        severity,
        cadence,
        thresholdMinutes,
        enabled,
        createExceptions,
        createActivities,
        resolveOnRecovery,
        nextRunAt: enabled ? new Date() : null,
      },
    });
  }

  async updateAutomationRule(id: string, payload: UpdateAutomationRuleDto) {
    const existing = await this.prisma.automationRule.findUnique({
      where: { id },
      select: { id: true, cadence: true, enabled: true },
    });

    if (!existing) throw new NotFoundException("Automação não encontrada");

    const data: Prisma.AutomationRuleUpdateInput = {};

    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.detector !== undefined) data.detector = payload.detector.trim().toLowerCase();
    if (payload.severity !== undefined) data.severity = payload.severity.trim().toLowerCase();
    if (payload.cadence !== undefined) data.cadence = payload.cadence.trim().toLowerCase();
    if (payload.thresholdMinutes !== undefined) data.thresholdMinutes = payload.thresholdMinutes;
    if (payload.createExceptions !== undefined) data.createExceptions = payload.createExceptions;
    if (payload.createActivities !== undefined) data.createActivities = payload.createActivities;
    if (payload.resolveOnRecovery !== undefined) data.resolveOnRecovery = payload.resolveOnRecovery;

    if (payload.enabled !== undefined) {
      data.enabled = payload.enabled;
      data.nextRunAt = payload.enabled ? new Date() : null;
    } else if (payload.cadence !== undefined && existing.enabled) {
      data.nextRunAt = new Date();
    }

    return this.prisma.automationRule.update({
      where: { id },
      data,
    });
  }

  private async detectorMaintenanceOverdue(rule: any): Promise<AutomationHit[]> {
    const now = new Date();
    const items = await this.prisma.maintenance.findMany({
      where: {
        status: { in: ["planned", "in_progress"] },
        scheduledAt: { lt: now },
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        partnerId: true,
        unitId: true,
        equipmentId: true,
      },
    });

    return items.map((item) => ({
      fingerprint: `${rule.code}:maintenance_overdue:${item.id}`,
      title: `Manutenção vencida: ${item.code} · ${item.title}`,
      description: item.description || "Há manutenção planejada/em andamento com data vencida.",
      kind: "maintenance" as const,
      severity: rule.severity,
      partnerId: item.partnerId,
      unitId: item.unitId,
      equipmentId: item.equipmentId,
      maintenanceId: item.id,
    }));
  }

  private async detectorCriticalOpenOccurrence(rule: any): Promise<AutomationHit[]> {
    const items = await this.prisma.occurrence.findMany({
      where: {
        status: { in: ["open", "investigating"] },
        severity: "critical",
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        partnerId: true,
        unitId: true,
        equipmentId: true,
      },
    });

    return items.map((item) => ({
      fingerprint: `${rule.code}:critical_open_occurrence:${item.id}`,
      title: `Ocorrência crítica aberta: ${item.code} · ${item.title}`,
      description: item.description || "Ocorrência crítica aberta ou em investigação.",
      kind: "occurrence" as const,
      severity: "critical",
      partnerId: item.partnerId,
      unitId: item.unitId,
      equipmentId: item.equipmentId,
      occurrenceId: item.id,
    }));
  }

  private async detectorAgedOpenOccurrence(rule: any): Promise<AutomationHit[]> {
    const threshold = rule.thresholdMinutes || 120;
    const cutoff = new Date(Date.now() - threshold * 60 * 1000);

    const items = await this.prisma.occurrence.findMany({
      where: {
        status: { in: ["open", "investigating"] },
        createdAt: { lte: cutoff },
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        partnerId: true,
        unitId: true,
        equipmentId: true,
      },
    });

    return items.map((item) => ({
      fingerprint: `${rule.code}:aged_open_occurrence:${item.id}`,
      title: `Ocorrência envelhecida: ${item.code} · ${item.title}`,
      description: item.description || `Ocorrência aberta há mais de ${threshold} minuto(s).`,
      kind: "sla" as const,
      severity: rule.severity,
      partnerId: item.partnerId,
      unitId: item.unitId,
      equipmentId: item.equipmentId,
      occurrenceId: item.id,
    }));
  }

  private async detectorIntegrationFailure(rule: any): Promise<AutomationHit[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    const hits: AutomationHit[] = [];

    for (const integration of integrations) {
      const entity = await this.prisma.integration.findUnique({ where: { id: integration.id } });
      if (!entity) continue;

      const test = await this.integrationsService.testConnectionByEntity(entity);
      if (!test.ok) {
        hits.push({
          fingerprint: `${rule.code}:integration_failure:${integration.id}`,
          title: `Integração com falha: ${integration.code} · ${integration.name}`,
          description: test.message,
          kind: "integration",
          severity: rule.severity,
          integrationId: integration.id,
        });
      }
    }

    return hits;
  }

  private async resolveHits(rule: any): Promise<AutomationHit[]> {
    if (rule.detector === "maintenance_overdue") return this.detectorMaintenanceOverdue(rule);
    if (rule.detector === "critical_open_occurrence") return this.detectorCriticalOpenOccurrence(rule);
    if (rule.detector === "integration_failure") return this.detectorIntegrationFailure(rule);
    return this.detectorAgedOpenOccurrence(rule);
  }

  private async executeRule(rule: any) {
    const run = await this.prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        status: "running",
        startedAt: new Date(),
      },
    });

    try {
      const hits = await this.resolveHits(rule);

      let createdCount = 0;
      let updatedCount = 0;

      for (const hit of hits) {
        if (rule.createExceptions) {
          const result = await this.exceptionsService.upsertFromAutomation(rule, run, hit);
          createdCount += result.created;
          updatedCount += result.updated;
        } else if (rule.createActivities) {
          await this.activitiesService.createActivity({
            title: `Automação detectou evento: ${hit.title}`,
            description: hit.description || undefined,
            kind: "automation",
            source: "automation",
            severity: hit.severity,
            automationId: rule.id,
            automationRunId: run.id,
            partnerId: hit.partnerId || undefined,
            unitId: hit.unitId || undefined,
            equipmentId: hit.equipmentId || undefined,
            integrationId: hit.integrationId || undefined,
            occurrenceId: hit.occurrenceId || undefined,
            maintenanceId: hit.maintenanceId || undefined,
          });
        }
      }

      const resolvedCount = await this.exceptionsService.resolveRecovered(
        rule,
        run,
        hits.map((item) => item.fingerprint),
      );

      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          hitsCount: hits.length,
          createdCount,
          updatedCount: updatedCount + resolvedCount,
          summary: `hits=${hits.length} created=${createdCount} updated=${updatedCount} resolved=${resolvedCount}`,
        },
      });

      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: this.nextRunAt(rule.cadence),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida na automação";

      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "error",
          finishedAt: new Date(),
          errorMessage: message,
          summary: "run com erro",
        },
      });

      if (rule.createActivities) {
        await this.activitiesService.createActivity({
          title: `Automação com erro: ${rule.code}`,
          description: message,
          kind: "automation",
          source: "automation",
          severity: "high",
          automationId: rule.id,
          automationRunId: run.id,
        });
      }

      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: this.nextRunAt(rule.cadence),
        },
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "ops-automation-tick",
    waitForCompletion: true,
  })
  async tick() {
    const dueRules = await this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
    });

    for (const rule of dueRules) {
      await this.executeRule(rule);
    }
  }
}
