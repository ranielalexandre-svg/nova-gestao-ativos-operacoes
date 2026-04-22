import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
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
}
