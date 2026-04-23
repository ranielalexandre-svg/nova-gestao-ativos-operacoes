import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { CreateReportTemplateDto } from "./dto/create-report-template.dto";
import { ExportMonitoringReportDto } from "./dto/export-monitoring-report.dto";
import { ListReportTemplateRunsQueryDto } from "./dto/list-report-template-runs-query.dto";
import { PrtgStyleReportQueryDto } from "./dto/prtg-style-report-query.dto";
import { ZabbixReportGroupPreviewQueryDto } from "./dto/zabbix-report-group-preview-query.dto";
import { ZabbixReportGroupsQueryDto } from "./dto/zabbix-report-groups-query.dto";
import { MonitoringReportExportService } from "./report-export.service";
import { MonitoringPrtgStyleReport } from "./report.types";

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly reportExportService: MonitoringReportExportService,
  ) {}

  private bucketCount(input: unknown, key: string): number {
    if (!input || typeof input !== "object") return 0;

    const record = input as Record<string, unknown>;
    const value = record[key];

    return typeof value === "number" ? value : 0;
  }

  async getSummary() {
    const [
      usersTotal,
      usersActive,
      partnersTotal,
      partnersActive,
      unitsTotal,
      unitsActive,
      equipmentsTotal,
      equipmentsActive,
      integrationsTotal,
      integrationsActive,
      activeIntegrations,
      activeZabbixIntegrations,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.partner.count(),
      this.prisma.partner.count({ where: { isActive: true } }),
      this.prisma.unit.count(),
      this.prisma.unit.count({ where: { isActive: true } }),
      this.prisma.equipment.count(),
      this.prisma.equipment.count({ where: { isActive: true } }),
      this.prisma.integration.count(),
      this.prisma.integration.count({ where: { isActive: true } }),
      this.prisma.integration.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.integration.findMany({
        where: { isActive: true, type: "zabbix" },
        orderBy: { code: "asc" },
      }),
    ]);

    const integrationChecks = await Promise.all(
      activeIntegrations.map(async (integration) => {
        const result = await this.integrationsService.testConnectionByEntity(integration);

        return {
          id: integration.id,
          code: integration.code,
          name: integration.name,
          type: integration.type,
          isActive: integration.isActive,
          ...result,
        };
      }),
    );

    const zabbixSnapshots = await Promise.all(
      activeZabbixIntegrations.map(async (integration) => {
        const snapshot = await this.integrationsService.getZabbixSnapshotByEntity(integration);

        return {
          id: integration.id,
          code: integration.code,
          name: integration.name,
          type: integration.type,
          isActive: integration.isActive,
          ...snapshot,
        };
      }),
    );

    const integrationsHealthy = integrationChecks.filter((item) => item.ok).length;
    const integrationsFailing = integrationChecks.length - integrationsHealthy;

    return {
      checkedAt: new Date().toISOString(),
      counts: {
        usersTotal,
        usersActive,
        partnersTotal,
        partnersActive,
        unitsTotal,
        unitsActive,
        equipmentsTotal,
        equipmentsActive,
        integrationsTotal,
        integrationsActive,
        integrationsHealthy,
        integrationsFailing,
      },
      integrationChecks,
      zabbixSnapshots,
    };
  }

  async getCommandCenter() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const openOccurrenceStatuses = ["open", "investigating"];
    const activeMaintenanceStatuses = ["planned", "in_progress"];

    const [
      openOccurrences,
      criticalOpenOccurrences,
      overdueMaintenances,
      dueTodayMaintenances,
      occurrenceBySeverity,
      occurrenceByStatus,
      maintenanceByStatus,
      maintenanceByType,
      recentOccurrences,
      recentMaintenances,
    ] = await this.prisma.$transaction([
      this.prisma.occurrence.count({
        where: {
          status: { in: openOccurrenceStatuses },
        },
      }),
      this.prisma.occurrence.count({
        where: {
          status: { in: openOccurrenceStatuses },
          severity: "critical",
        },
      }),
      this.prisma.maintenance.count({
        where: {
          status: { in: activeMaintenanceStatuses },
          scheduledAt: { lt: now },
        },
      }),
      this.prisma.maintenance.count({
        where: {
          status: { in: activeMaintenanceStatuses },
          scheduledAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      }),
      this.prisma.occurrence.groupBy({
        by: ["severity"],
        where: {
          status: { in: openOccurrenceStatuses },
        },
        _count: { severity: true },
        orderBy: { severity: "asc" },
      }),
      this.prisma.occurrence.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { status: "asc" },
      }),
      this.prisma.maintenance.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { status: "asc" },
      }),
      this.prisma.maintenance.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { type: "asc" },
      }),
      this.prisma.occurrence.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          code: true,
          title: true,
          severity: true,
          status: true,
          source: true,
          createdAt: true,
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          _count: { select: { maintenances: true } },
        },
      }),
      this.prisma.maintenance.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          code: true,
          title: true,
          type: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          createdAt: true,
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          occurrence: { select: { id: true, code: true, title: true } },
        },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      metrics: {
        openOccurrences,
        criticalOpenOccurrences,
        overdueMaintenances,
        dueTodayMaintenances,
      },
      buckets: {
        occurrenceBySeverity: occurrenceBySeverity.map((item) => ({
          key: item.severity,
          count: this.bucketCount(item._count, "severity"),
        })),
        occurrenceByStatus: occurrenceByStatus.map((item) => ({
          key: item.status,
          count: this.bucketCount(item._count, "status"),
        })),
        maintenanceByStatus: maintenanceByStatus.map((item) => ({
          key: item.status,
          count: this.bucketCount(item._count, "status"),
        })),
        maintenanceByType: maintenanceByType.map((item) => ({
          key: item.type,
          count: this.bucketCount(item._count, "type"),
        })),
      },
      recentOccurrences,
      recentMaintenances,
    };
  }

  async getUnitHostTelemetry() {
    const units = await this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
      take: 300,
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

    return this.integrationsService.getZabbixUnitHostTelemetry(units);
  }

  async getReportUnits() {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.unit.count({
        where: { isActive: true },
      }),
      this.prisma.unit.findMany({
        where: { isActive: true },
        orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
        take: 500,
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
      }),
    ]);

    return {
      total,
      items,
    };
  }

  private parseReportDate(value: string | undefined, fallback: Date) {
    if (!value) return fallback;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Data inválida: ${value}`);
    }

    return parsed;
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

  private resolveReportRange(fromInput?: string, toInput?: string) {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const from = this.parseReportDate(fromInput, defaultFrom);
    const to = this.parseReportDate(toInput, now);

    if (from >= to) {
      throw new BadRequestException("A data inicial precisa ser menor que a data final.");
    }

    return { from, to };
  }

  private csv(values: string[]) {
    const unique = [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
    return unique.length ? unique.join(",") : null;
  }

  private parseCsv(value?: string | null) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async readPrtgStyleReportForUnit(unitId: string, from: Date, to: Date): Promise<MonitoringPrtgStyleReport> {
    if (!unitId) {
      throw new BadRequestException("Informe unitId para gerar o relatório.");
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
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

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada.");
    }

    return this.integrationsService.getZabbixPrtgStyleReport(unit, { from, to }) as Promise<MonitoringPrtgStyleReport>;
  }

  async getPrtgStyleReport(query: PrtgStyleReportQueryDto) {
    const { from, to } = this.resolveReportRange(query.from, query.to);
    return this.readPrtgStyleReportForUnit(query.unitId || "", from, to);
  }

  async getReportGroupSources() {
    return this.prisma.integration.findMany({
      where: { isActive: true, type: "zabbix" },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
  }

  async listReportTemplates() {
    return this.prisma.monitoringReportTemplate.findMany({
      orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        sourceType: true,
        periodPreset: true,
        outputFormat: true,
        includeCharts: true,
        title: true,
        interestedParty: true,
        contractLabel: true,
        addressLine: true,
        contractedBandwidth: true,
        enabled: true,
        groupIds: true,
        unitIds: true,
        integration: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        automations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            code: true,
            name: true,
            cadence: true,
            enabled: true,
            lastRunAt: true,
            nextRunAt: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    }).then((items) =>
      items.map((item) => ({
        ...item,
        groupIds: this.parseCsv(item.groupIds),
        unitIds: this.parseCsv(item.unitIds),
      })),
    );
  }

  async listReportTemplateRuns(query: ListReportTemplateRunsQueryDto) {
    const runs = await this.prisma.automationRun.findMany({
      where: {
        rule: {
          detector: "monitoring_report_export",
          reportTemplateId: query.templateId ? query.templateId : { not: null },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
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
            cadence: true,
            reportTemplate: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const attachments = await this.prisma.documentAttachment.findMany({
      where: {
        entityType: "automation_run",
        entityId: { in: runs.map((item) => item.id) },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        entityId: true,
        name: true,
        mimeType: true,
        size: true,
        source: true,
        createdAt: true,
      },
    });

    const attachmentsByRun = new Map<string, typeof attachments>();
    for (const item of attachments) {
      attachmentsByRun.set(item.entityId, [...(attachmentsByRun.get(item.entityId) || []), item]);
    }

    return runs.map((run) => ({
      ...run,
      attachments: (attachmentsByRun.get(run.id) || []).map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        source: item.source,
        createdAt: item.createdAt,
        url: `/api/attachments/${item.id}/download`,
      })),
    }));
  }

  async createReportTemplate(payload: CreateReportTemplateDto) {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const sourceType = payload.sourceType;
    const periodPreset = payload.periodPreset;
    const outputFormat = payload.outputFormat;
    const unitIds = [...new Set((payload.unitIds || []).map((item) => String(item || "").trim()).filter(Boolean))];
    const groupIds = [...new Set((payload.groupIds || []).map((item) => String(item || "").trim()).filter(Boolean))];
    const integrationId = String(payload.integrationId || "").trim() || null;

    if (sourceType === "manual" && !unitIds.length) {
      throw new BadRequestException("Selecione ao menos uma unidade para um template manual.");
    }

    if (sourceType === "zabbix_group") {
      if (!integrationId) {
        throw new BadRequestException("Informe a integração Zabbix do template por grupos.");
      }
      if (!groupIds.length) {
        throw new BadRequestException("Selecione ao menos um host group para o template.");
      }
    }

    const existing = await this.prisma.monitoringReportTemplate.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Código de template já existe.");
    }

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId },
        select: { id: true, type: true },
      });

      if (!integration || integration.type !== "zabbix") {
        throw new BadRequestException("Integração do template é inválida.");
      }
    }

    return this.prisma.monitoringReportTemplate.create({
      data: {
        code,
        name,
        integrationId,
        sourceType,
        periodPreset,
        groupIds: this.csv(groupIds),
        unitIds: this.csv(unitIds),
        outputFormat,
        includeCharts: payload.includeCharts,
        title: payload.title?.trim() || null,
        interestedParty: payload.interestedParty?.trim() || null,
        contractLabel: payload.contractLabel?.trim() || null,
        addressLine: payload.addressLine?.trim() || null,
        contractedBandwidth: payload.contractedBandwidth?.trim() || null,
        enabled: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        sourceType: true,
        periodPreset: true,
        outputFormat: true,
        includeCharts: true,
        createdAt: true,
      },
    });
  }

  async getZabbixReportGroups(query: ZabbixReportGroupsQueryDto) {
    if (!query.integrationId) {
      throw new BadRequestException("Informe integrationId para listar os grupos.");
    }

    return this.integrationsService.getZabbixReportGroupCatalog(query.integrationId);
  }

  async previewZabbixReportGroups(query: ZabbixReportGroupPreviewQueryDto) {
    if (!query.integrationId) {
      throw new BadRequestException("Informe integrationId para revisar os grupos.");
    }

    if (!query.groupIds?.length) {
      throw new BadRequestException("Selecione ao menos um grupo do Zabbix.");
    }

    const units = await this.readActiveUnitsForMatching(500);
    return this.integrationsService.previewZabbixReportGroupSelection(
      query.integrationId,
      query.groupIds,
      units,
    );
  }

  async exportPrtgStyleReports(payload: ExportMonitoringReportDto) {
    const { from, to } = this.resolveReportRange(payload.from, payload.to);
    const unitIds = [...new Set((payload.unitIds || []).map((item) => String(item || "").trim()).filter(Boolean))];

    if (!unitIds.length) {
      throw new BadRequestException("Selecione ao menos uma unidade para exportar.");
    }

    const reports: MonitoringPrtgStyleReport[] = [];
    for (const unitId of unitIds) {
      reports.push(await this.readPrtgStyleReportForUnit(unitId, from, to));
    }

    return this.reportExportService.exportReports(reports, {
      format: payload.format,
      includeCharts: payload.includeCharts,
      title: payload.title,
      interestedParty: payload.interestedParty,
      contractLabel: payload.contractLabel,
      addressLine: payload.addressLine,
      contractedBandwidth: payload.contractedBandwidth,
    });
  }
}
