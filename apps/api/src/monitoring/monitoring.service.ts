import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { AttachmentsService } from "../attachments/attachments.service";
import { CreateReportTemplateDto } from "./dto/create-report-template.dto";
import { ExportMonitoringReportDto } from "./dto/export-monitoring-report.dto";
import { ListReportTemplateRunsQueryDto } from "./dto/list-report-template-runs-query.dto";
import { PrtgStyleReportQueryDto } from "./dto/prtg-style-report-query.dto";
import { ZabbixReportGroupPreviewQueryDto } from "./dto/zabbix-report-group-preview-query.dto";
import { ZabbixReportGroupsQueryDto } from "./dto/zabbix-report-groups-query.dto";
import { MonitoringReportExportService } from "./report-export.service";
import { MonitoringPrtgStyleReport } from "./report.types";

type UnitHostTelemetryResult = Awaited<ReturnType<IntegrationsService["getZabbixUnitHostTelemetry"]>>;

type UnitHostTelemetryOptions = {
  fast?: boolean;
};

@Injectable()
export class MonitoringService {
  private unitHostTelemetryCache: { key: string; expiresAt: number; value: UnitHostTelemetryResult } | null = null;
  private readonly unitHostTelemetryInflight = new Map<string, Promise<UnitHostTelemetryResult>>();
  private readonly prtgStyleReportCache = new Map<
    string,
    { expiresAt: number; value: MonitoringPrtgStyleReport }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly reportExportService: MonitoringReportExportService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private bucketCount(input: unknown, key: string): number {
    if (!input || typeof input !== "object") return 0;

    const record = input as Record<string, unknown>;
    const value = record[key];

    return typeof value === "number" ? value : 0;
  }

  private getUnitHostTelemetryCacheTtlMs() {
    const configured = Number(process.env.NOVA_ZABBIX_TELEMETRY_CACHE_MS);
    return Number.isFinite(configured) && configured >= 0 ? configured : 45_000;
  }

  private getPrtgStyleReportCacheTtlMs() {
    const configured = Number(process.env.NOVA_ZABBIX_REPORT_CACHE_MS);
    return Number.isFinite(configured) && configured >= 0 ? configured : 180_000;
  }

  private prunePrtgStyleReportCache(maxEntries = 80) {
    if (this.prtgStyleReportCache.size <= maxEntries) return;

    const now = Date.now();
    for (const [key, entry] of this.prtgStyleReportCache) {
      if (entry.expiresAt <= now) this.prtgStyleReportCache.delete(key);
    }

    while (this.prtgStyleReportCache.size > maxEntries) {
      const first = this.prtgStyleReportCache.keys().next().value;
      if (!first) break;
      this.prtgStyleReportCache.delete(first);
    }
  }

  private buildUnitHostTelemetryCacheKey(
    units: Array<{
      id: string;
      code: string;
      zabbixHost: string | null;
      zabbixVisibleName: string | null;
      equipments: Array<{
        id: string;
        tag: string | null;
        serialNumber: string | null;
        status: string;
        isActive: boolean;
      }>;
    }>,
    integrations: Array<{ id: string; code: string; updatedAt: Date }>,
  ) {
    return JSON.stringify({
      integrations: integrations.map((integration) => [
        integration.id,
        integration.code,
        integration.updatedAt.toISOString(),
      ]),
      units: units.map((unit) => [
        unit.id,
        unit.code,
        unit.zabbixHost ?? "",
        unit.zabbixVisibleName ?? "",
        unit.equipments.map((equipment) => [
          equipment.id,
          equipment.tag ?? "",
          equipment.serialNumber ?? "",
          equipment.status,
          equipment.isActive ? "1" : "0",
        ]),
      ]),
    });
  }

  private refreshUnitHostTelemetryCache(
    cacheKey: string,
    cacheTtlMs: number,
    units: Parameters<IntegrationsService["getZabbixUnitHostTelemetry"]>[0],
  ) {
    const inflight = this.unitHostTelemetryInflight.get(cacheKey);
    if (inflight) return inflight;

    const request = this.integrationsService
      .getZabbixUnitHostTelemetry(units)
      .then((value) => {
        this.unitHostTelemetryCache = {
          key: cacheKey,
          expiresAt: Date.now() + cacheTtlMs,
          value,
        };

        return value;
      })
      .finally(() => {
        this.unitHostTelemetryInflight.delete(cacheKey);
      });

    this.unitHostTelemetryInflight.set(cacheKey, request);
    return request;
  }

  private buildPendingUnitHostTelemetry(
    units: Parameters<IntegrationsService["getZabbixUnitHostTelemetry"]>[0],
    integrations: Array<{ id: string; code: string; name?: string }>,
  ): UnitHostTelemetryResult {
    const sources = integrations.length
      ? integrations.map((integration) => ({
          id: integration.id,
          code: integration.code,
          name: integration.name || integration.code,
          ok: false,
          message: "Telemetria Zabbix em atualização. Os dados locais já foram carregados.",
          targetUrl: "",
          totalHosts: 0,
          matchedUnits: 0,
        }))
      : [
          {
            id: "zabbix",
            code: "ZBX",
            name: "Zabbix",
            ok: false,
            message: "Nenhuma integração Zabbix ativa encontrada.",
            targetUrl: "",
            totalHosts: 0,
            matchedUnits: 0,
          },
        ];

    const items = units.map((unit) => ({
      unit: {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        city: unit.city,
        state: unit.state,
        zabbixHost: unit.zabbixHost,
        zabbixVisibleName: unit.zabbixVisibleName,
        isActive: unit.isActive,
      },
      partner: unit.partner,
      equipments: unit.equipments,
      match: {
        status: "unmatched" as const,
        score: 0,
        confidence: 0,
        matchedBy: [],
        candidates: 0,
        syncReady: false,
      },
      health: "unknown" as const,
      metrics: {
        ping: null,
        lossPct: null,
        latencyMs: null,
        temperatureC: null,
        sources: {
          ping: null,
          loss: null,
          latency: null,
          temperature: null,
        },
      },
      problems: [],
    }));

    return {
      generatedAt: new Date().toISOString(),
      sources,
      counts: {
        units: units.length,
        matched: 0,
        ambiguous: 0,
        unmapped: units.length,
        online: 0,
        degraded: 0,
        down: 0,
        withProblems: 0,
        syncReady: 0,
        avgLatencyMs: null,
        avgLossPct: null,
        maxTemperatureC: null,
      },
      items,
    };
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

  async getUnitHostTelemetry(options: UnitHostTelemetryOptions = {}) {
    const [units, integrationVersions] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where: { isActive: true },
        orderBy: [{ partner: { code: "asc" } }, { code: "asc" }],
        take: 300,
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          reportContractLabel: true,
          reportAddressLine: true,
          reportContractedBandwidth: true,
          reportNotes: true,
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
      }),
      this.prisma.integration.findMany({
        where: { isActive: true, type: "zabbix" },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          updatedAt: true,
        },
      }),
    ]);

    const cacheTtlMs = this.getUnitHostTelemetryCacheTtlMs();

    if (cacheTtlMs <= 0) {
      return this.integrationsService.getZabbixUnitHostTelemetry(units);
    }

    const cacheKey = this.buildUnitHostTelemetryCacheKey(units, integrationVersions);
    const now = Date.now();

    if (this.unitHostTelemetryCache?.key === cacheKey) {
      if (this.unitHostTelemetryCache.expiresAt > now) {
        return this.unitHostTelemetryCache.value;
      }

      if (!this.unitHostTelemetryInflight.has(cacheKey)) {
        void this.refreshUnitHostTelemetryCache(cacheKey, cacheTtlMs, units).catch(() => undefined);
      }

      return this.unitHostTelemetryCache.value;
    }

    const inflight = this.unitHostTelemetryInflight.get(cacheKey);

    if (inflight) {
      if (options.fast) {
        return this.buildPendingUnitHostTelemetry(units, integrationVersions);
      }

      return inflight;
    }

    if (options.fast) {
      void this.refreshUnitHostTelemetryCache(cacheKey, cacheTtlMs, units).catch(() => undefined);
      return this.buildPendingUnitHostTelemetry(units, integrationVersions);
    }

    return this.refreshUnitHostTelemetryCache(cacheKey, cacheTtlMs, units);
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
          reportContractLabel: true,
          reportAddressLine: true,
          reportContractedBandwidth: true,
          reportNotes: true,
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
        reportContractLabel: true,
        reportAddressLine: true,
        reportContractedBandwidth: true,
        reportNotes: true,
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
        reportContractLabel: true,
        reportAddressLine: true,
        reportContractedBandwidth: true,
        reportNotes: true,
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

    const report = (await this.integrationsService.getZabbixPrtgStyleReport(unit, {
      from,
      to,
    })) as MonitoringPrtgStyleReport;

    return {
      ...report,
      unit: {
        ...report.unit,
        reportContractLabel: unit.reportContractLabel,
        reportAddressLine: unit.reportAddressLine,
        reportContractedBandwidth: unit.reportContractedBandwidth,
        reportNotes: unit.reportNotes,
      },
    };
  }

  async getPrtgStyleReport(query: PrtgStyleReportQueryDto) {
    const { from, to } = this.resolveReportRange(query.from, query.to);
    const unitId = query.unitId || "";
    const ttlMs = this.getPrtgStyleReportCacheTtlMs();
    const cacheKey = `${unitId}:${from.toISOString()}:${to.toISOString()}`;
    const now = Date.now();
    const cached = this.prtgStyleReportCache.get(cacheKey);

    if (ttlMs > 0 && cached && cached.expiresAt > now) {
      return cached.value;
    }

    const report = await this.readPrtgStyleReportForUnit(unitId, from, to);

    if (ttlMs > 0) {
      this.prtgStyleReportCache.set(cacheKey, {
        expiresAt: now + ttlMs,
        value: report,
      });
      this.prunePrtgStyleReportCache();
    }

    return report;
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
    const ruleWhere: Prisma.AutomationRuleWhereInput = {
      detector: "monitoring_report_export",
    };

    if (query.templateId) {
      ruleWhere.reportTemplateId = query.templateId;
    }

    const runs = await this.prisma.automationRun.findMany({
      where: {
        rule: ruleWhere,
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
        url: this.attachmentUrl(item.id),
      })),
    }));
  }

  private attachmentUrl(id: string) {
    return `/api/attachments/${id}/download`;
  }

  private async ensureManualReportExportRule() {
    return this.prisma.automationRule.upsert({
      where: { code: "MANUAL_MONITORING_REPORT_EXPORT" },
      update: {
        name: "Exportação manual de relatório",
        detector: "monitoring_report_export",
        enabled: false,
        createExceptions: false,
        createActivities: false,
        resolveOnRecovery: false,
        nextRunAt: null,
      },
      create: {
        code: "MANUAL_MONITORING_REPORT_EXPORT",
        name: "Exportação manual de relatório",
        detector: "monitoring_report_export",
        severity: "medium",
        cadence: "manual",
        enabled: false,
        createExceptions: false,
        createActivities: false,
        resolveOnRecovery: false,
        nextRunAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  private normalizeExportPayload(payload: ExportMonitoringReportDto) {
    const { from, to } = this.resolveReportRange(payload.from, payload.to);
    const unitIds = [...new Set((payload.unitIds || []).map((item) => String(item || "").trim()).filter(Boolean))];

    if (!unitIds.length) {
      throw new BadRequestException("Selecione ao menos uma unidade para exportar.");
    }

    const format: "pdf" | "docx" = payload.format === "docx" ? "docx" : "pdf";
    const normalizedPayload: ExportMonitoringReportDto = {
      ...payload,
      unitIds,
      from: from.toISOString(),
      to: to.toISOString(),
      format,
      includeCharts: payload.includeCharts ?? true,
    };

    return {
      unitIds,
      payload: normalizedPayload,
    };
  }

  private encodeExportJobSummary(payload: ExportMonitoringReportDto, unitCount: number) {
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `queued unidades=${unitCount} formato=${payload.format} payload=${encodedPayload}`;
  }

  private decodeExportJobPayload(summary?: string | null) {
    const match = /(?:^|\s)payload=([a-zA-Z0-9_-]+)/.exec(summary || "");
    if (!match) {
      throw new BadRequestException("Payload do job de relatório não encontrado.");
    }

    const parsed = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")) as ExportMonitoringReportDto;
    return this.normalizeExportPayload(parsed);
  }

  async getReportExportRun(id: string) {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        id,
        rule: {
          detector: "monitoring_report_export",
        },
      },
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

    if (!run) {
      throw new NotFoundException("Execução de relatório não encontrada.");
    }

    const attachments = await this.prisma.documentAttachment.findMany({
      where: {
        entityType: "automation_run",
        entityId: run.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        source: true,
        createdAt: true,
      },
    });

    return {
      ...run,
      attachments: attachments.map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        source: item.source,
        createdAt: item.createdAt,
        url: this.attachmentUrl(item.id),
      })),
    };
  }

  async enqueuePrtgStyleReportExport(payload: ExportMonitoringReportDto) {
    const normalized = this.normalizeExportPayload(payload);
    const rule = await this.ensureManualReportExportRule();
    const run = await this.prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        status: "queued",
        startedAt: new Date(),
        hitsCount: normalized.unitIds.length,
        summary: this.encodeExportJobSummary(normalized.payload, normalized.unitIds.length),
      },
      select: {
        id: true,
      },
    });

    setImmediate(() => {
      void this.processReportExportRun(run.id, normalized.payload, normalized.unitIds.length);
    });

    return this.getReportExportRun(run.id);
  }

  private async processReportExportRun(runId: string, payload: ExportMonitoringReportDto, unitCount: number) {
    const claimed = await this.prisma.automationRun.updateMany({
      where: {
        id: runId,
        status: "queued",
      },
      data: {
        status: "running",
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    if (!claimed.count) return;

    try {
      const artifact = await this.exportPrtgStyleReports(payload);

      await this.attachmentsService.create("automation_run", runId, {
        originalname: artifact.fileName,
        mimetype: artifact.mimeType,
        size: artifact.buffer.length,
        buffer: artifact.buffer,
      });

      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: "success",
          finishedAt: new Date(),
          hitsCount: unitCount,
          createdCount: 1,
          updatedCount: 0,
          summary: `artefato=${artifact.fileName} unidades=${unitCount} formato=${payload.format}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar relatório.";

      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: "error",
          finishedAt: new Date(),
          errorMessage: message,
          summary: "exportação manual com erro",
        },
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "monitoring-report-export-queue",
    waitForCompletion: true,
  })
  async processQueuedReportExports() {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    await this.prisma.automationRun.updateMany({
      where: {
        status: "running",
        startedAt: { lt: staleBefore },
        rule: {
          code: "MANUAL_MONITORING_REPORT_EXPORT",
          detector: "monitoring_report_export",
        },
      },
      data: {
        status: "queued",
        errorMessage: "Job reaberto por timeout de processamento.",
      },
    });

    const queuedRuns = await this.prisma.automationRun.findMany({
      where: {
        status: "queued",
        rule: {
          code: "MANUAL_MONITORING_REPORT_EXPORT",
          detector: "monitoring_report_export",
        },
      },
      orderBy: { startedAt: "asc" },
      take: 3,
      select: {
        id: true,
        summary: true,
      },
    });

    for (const run of queuedRuns) {
      try {
        const normalized = this.decodeExportJobPayload(run.summary);
        await this.processReportExportRun(run.id, normalized.payload, normalized.unitIds.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao processar job de relatório.";
        await this.prisma.automationRun.update({
          where: { id: run.id },
          data: {
            status: "error",
            finishedAt: new Date(),
            errorMessage: message,
            summary: "exportação manual com payload inválido",
          },
        });
      }
    }
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
      reportStyle: payload.reportStyle === 'official' ? 'official' : payload.reportStyle === 'technical' ? 'technical' : 'complete',
      title: payload.title,
      interestedParty: payload.interestedParty,
      contractLabel: payload.contractLabel,
      addressLine: payload.addressLine,
      contractedBandwidth: payload.contractedBandwidth,
      unitMetadataJson: payload.unitMetadataJson,
      competenceLabel: payload.competenceLabel,
      issueDateLabel: payload.issueDateLabel,
    });
  }
}
