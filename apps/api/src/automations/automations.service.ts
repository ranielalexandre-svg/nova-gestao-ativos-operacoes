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
import { AttachmentsService } from "../attachments/attachments.service";
import { ExceptionsService } from "../exceptions/exceptions.service";
import { MonitoringService } from "../monitoring/monitoring.service";
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
    private readonly attachmentsService: AttachmentsService,
    private readonly exceptionsService: ExceptionsService,
    private readonly monitoringService: MonitoringService,
  ) {}

  private nextRunAt(cadence: string, from = new Date()) {
    const now = new Date(from);
    if (cadence === "every_minute") return new Date(now.getTime() + 60 * 1000);
    if (cadence === "every_5_minutes") return new Date(now.getTime() + 5 * 60 * 1000);
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  private parseCsv(value?: string | null) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private resolveTemplatePeriod(periodPreset: string) {
    const now = new Date();

    if (periodPreset === "current_month") {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
      };
    }

    if (periodPreset === "previous_month") {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    }

    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from, to: now };
  }

  private async readActiveUnitsForMatching(limit = 500) {
    return this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
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
      },
    });
  }

  private async resolveReportTemplateUnitIds(template: {
    integrationId: string | null;
    sourceType: string;
    groupIds: string | null;
    unitIds: string | null;
  }) {
    if (template.sourceType === "zabbix_group") {
      const groupIds = this.parseCsv(template.groupIds);
      if (!template.integrationId || !groupIds.length) {
        return [];
      }

      const units = await this.readActiveUnitsForMatching(500);
      const preview = await this.integrationsService.previewZabbixReportGroupSelection(
        template.integrationId,
        groupIds,
        units,
      );

      return preview.matchedUnits.map((item) => item.unit.id);
    }

    return this.parseCsv(template.unitIds);
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
        { reportTemplate: { is: { code: { contains: q, mode: "insensitive" } } } },
        { reportTemplate: { is: { name: { contains: q, mode: "insensitive" } } } },
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
          reportTemplate: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
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
    const reportTemplateId = String(payload.reportTemplateId || "").trim() || null;
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

    if (detector === "monitoring_report_export" && !reportTemplateId) {
      throw new BadRequestException("reportTemplateId é obrigatório para a automação de relatório.");
    }

    if (reportTemplateId) {
      const template = await this.prisma.monitoringReportTemplate.findUnique({
        where: { id: reportTemplateId },
        select: { id: true },
      });

      if (!template) {
        throw new BadRequestException("Template de relatório inválido.");
      }
    }

    return this.prisma.automationRule.create({
      data: {
        code,
        name,
        detector,
        reportTemplateId,
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
      select: { id: true, cadence: true, enabled: true, detector: true, reportTemplateId: true },
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

    const requestedTemplateId =
      payload.reportTemplateId !== undefined ? String(payload.reportTemplateId || "").trim() || null : undefined;
    const nextDetector = String(data.detector || existing.detector).trim().toLowerCase();
    const nextTemplateId = requestedTemplateId !== undefined ? requestedTemplateId : existing.reportTemplateId;

    if (nextDetector === "monitoring_report_export" && !nextTemplateId) {
      throw new BadRequestException("reportTemplateId é obrigatório para a automação de relatório.");
    }

    if (nextTemplateId) {
      const template = await this.prisma.monitoringReportTemplate.findUnique({
        where: { id: nextTemplateId },
        select: { id: true },
      });

      if (!template) {
        throw new BadRequestException("Template de relatório inválido.");
      }
    }

    if (requestedTemplateId !== undefined) {
      data.reportTemplate = requestedTemplateId
        ? { connect: { id: requestedTemplateId } }
        : { disconnect: true };
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

  private async executeReportExportRule(rule: any, run: { id: string }) {
    const template = await this.prisma.monitoringReportTemplate.findUnique({
      where: { id: rule.reportTemplateId || "" },
      select: {
        id: true,
        code: true,
        name: true,
        integrationId: true,
        sourceType: true,
        periodPreset: true,
        groupIds: true,
        unitIds: true,
        outputFormat: true,
        includeCharts: true,
        title: true,
        interestedParty: true,
        contractLabel: true,
        addressLine: true,
        contractedBandwidth: true,
        enabled: true,
      },
    });

    if (!template || !template.enabled) {
      throw new NotFoundException("Template de relatório não está disponível para a automação.");
    }

    const unitIds = await this.resolveReportTemplateUnitIds(template);

    if (!unitIds.length) {
      throw new BadRequestException("O template não resolveu nenhuma unidade para exportação.");
    }

    const period = this.resolveTemplatePeriod(template.periodPreset);
    const artifact = await this.monitoringService.exportPrtgStyleReports({
      unitIds,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      format: template.outputFormat === "docx" ? "docx" : "pdf",
      includeCharts: template.includeCharts,
      title: template.title || undefined,
      interestedParty: template.interestedParty || undefined,
      contractLabel: template.contractLabel || undefined,
      addressLine: template.addressLine || undefined,
      contractedBandwidth: template.contractedBandwidth || undefined,
    });

    await this.attachmentsService.create("automation_run", run.id, {
      originalname: artifact.fileName,
      mimetype: artifact.mimeType,
      size: artifact.buffer.length,
      buffer: artifact.buffer,
    });

    if (rule.createActivities) {
      await this.activitiesService.createActivity({
        title: `Relatório automático gerado: ${template.code} · ${template.name}`,
        description: `${artifact.fileName} · ${unitIds.length} unidade(s) · período ${period.from.toISOString()} -> ${period.to.toISOString()}`,
        kind: "automation",
        source: "automation",
        severity: "info",
        automationId: rule.id,
        automationRunId: run.id,
      });
    }

    await this.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        hitsCount: unitIds.length,
        createdCount: 1,
        updatedCount: 0,
        summary: `artefato=${artifact.fileName} unidades=${unitIds.length} formato=${template.outputFormat}`,
      },
    });

    await this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: this.nextRunAt(rule.cadence),
      },
    });
  }

  private async resolveHits(rule: any): Promise<AutomationHit[]> {
    if (rule.detector === "monitoring_report_export") return [];
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
      if (rule.detector === "monitoring_report_export") {
        await this.executeReportExportRule(rule, run);
        return;
      }

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
