import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get("summary")
  getSummary() {
    return this.monitoringService.getSummary();
  }

  @Get("command-center")
  getCommandCenter() {
    return this.monitoringService.getCommandCenter();
  }

  @Get("unit-hosts")
  getUnitHostTelemetry() {
    return this.monitoringService.getUnitHostTelemetry();
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
    return this.monitoringService.getPrtgStyleReport(query);
  }

  @Post("reports/export")
  async exportPrtgStyleReport(
    @Body() body: ExportMonitoringReportDto,
    @Res() response: Response,
  ) {
    const artifact = await this.monitoringService.exportPrtgStyleReports(body);

    response.setHeader("Content-Type", artifact.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
    response.setHeader("Cache-Control", "no-store");
    response.send(artifact.buffer);
  }
}
