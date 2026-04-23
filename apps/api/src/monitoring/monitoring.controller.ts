import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MonitoringService } from "./monitoring.service";
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
}
