import { Module } from "@nestjs/common";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";
import { MonitoringReportExportService } from "./report-export.service";
import { MonitoringReportPresentationService } from "./report-presentation.service";
import { PrismaModule } from "../prisma/prisma.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, IntegrationsModule, AuthModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MonitoringReportExportService,
    MonitoringReportPresentationService,
  ],
  exports: [
    MonitoringService,
    MonitoringReportExportService,
    MonitoringReportPresentationService,
  ],
})
export class MonitoringModule {}
