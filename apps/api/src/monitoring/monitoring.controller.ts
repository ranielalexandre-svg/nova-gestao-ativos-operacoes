import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MonitoringService } from "./monitoring.service";

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
}
