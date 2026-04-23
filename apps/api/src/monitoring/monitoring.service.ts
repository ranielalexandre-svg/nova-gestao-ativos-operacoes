import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { ExportMonitoringReportDto } from "./dto/export-monitoring-report.dto";
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
