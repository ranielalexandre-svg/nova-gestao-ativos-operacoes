import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SettingsService } from "../settings/settings.service";
import { MonitoringService } from "./monitoring.service";
import { CreateReportTemplateDto } from "./dto/create-report-template.dto";
import { ExportMonitoringReportDto } from "./dto/export-monitoring-report.dto";
import { ListReportTemplateRunsQueryDto } from "./dto/list-report-template-runs-query.dto";
import { PrtgStyleReportQueryDto } from "./dto/prtg-style-report-query.dto";
import { ZabbixReportGroupPreviewQueryDto } from "./dto/zabbix-report-group-preview-query.dto";
import { ZabbixReportGroupsQueryDto } from "./dto/zabbix-report-groups-query.dto";

@Controller("monitoring")
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get("summary")
  getSummary() {
    return this.monitoringService.getSummary();
  }

  @Get("command-center")
  getCommandCenter() {
    return this.monitoringService.getCommandCenter();
  }

  @Get("unit-hosts")
  getUnitHostTelemetry(@Query("mode") mode?: string) {
    return this.monitoringService.getUnitHostTelemetry({ fast: mode === "fast" });
  }

  @Get("reports/units")
  getReportUnits() {
    return this.monitoringService.getReportUnits();
  }

  @Get("reports/sources")
  getReportSources() {
    return this.monitoringService.getReportGroupSources();
  }

  @Get("report-templates")
  listReportTemplates() {
    return this.monitoringService.listReportTemplates();
  }

  @Get("report-template-runs")
  listReportTemplateRuns(@Query() query: ListReportTemplateRunsQueryDto) {
    return this.monitoringService.listReportTemplateRuns(query);
  }

  @Post("report-templates")
  createReportTemplate(@Body() body: CreateReportTemplateDto) {
    this.assertReportsEnabled();
    return this.monitoringService.createReportTemplate(body);
  }

  @Get("reports/groups/zabbix")
  getZabbixReportGroups(@Query() query: ZabbixReportGroupsQueryDto) {
    return this.monitoringService.getZabbixReportGroups(query);
  }

  @Get("reports/groups/zabbix/preview")
  previewZabbixReportGroups(@Query() query: ZabbixReportGroupPreviewQueryDto) {
    return this.monitoringService.previewZabbixReportGroups(query);
  }

  @Get("reports/prtg-style")
  getPrtgStyleReport(@Query() query: PrtgStyleReportQueryDto) {
    this.assertReportsEnabled();
    return this.monitoringService.getPrtgStyleReport(query);
  }

  @Post("reports/export")
  async exportPrtgStyleReport(
    @Body() body: ExportMonitoringReportDto,
    @Res() response: Response,
  ) {
    this.assertReportsEnabled();
    const artifact = await this.monitoringService.exportPrtgStyleReports(body);

    response.setHeader("Content-Type", artifact.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
    response.setHeader("Cache-Control", "no-store");
    response.send(artifact.buffer);
  }

  @Post("reports/export-jobs")
  enqueuePrtgStyleReportExport(@Body() body: ExportMonitoringReportDto) {
    this.assertReportsEnabled();
    return this.monitoringService.enqueuePrtgStyleReportExport(body);
  }

  @Get("reports/export-jobs/:id")
  getPrtgStyleReportExportJob(@Param("id") id: string) {
    return this.monitoringService.getReportExportRun(id);
  }

  private assertReportsEnabled() {
    if (!this.settingsService.areReportsEnabled()) {
      throw new ForbiddenException("Relatórios desativados nas configurações.");
    }
  }
}
