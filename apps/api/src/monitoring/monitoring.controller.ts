import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MonitoringService } from "./monitoring.service";
import { ExportMonitoringReportDto } from "./dto/export-monitoring-report.dto";
import { PrtgStyleReportQueryDto } from "./dto/prtg-style-report-query.dto";

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
