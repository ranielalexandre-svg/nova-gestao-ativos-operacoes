import { Module } from "@nestjs/common";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";
import { MonitoringReportExportService } from "./report-export.service";
import { MonitoringReportPresentationService } from "./report-presentation.service";
import { PrismaModule } from "../prisma/prisma.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { AuthModule } from "../auth/auth.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [PrismaModule, IntegrationsModule, AuthModule, AttachmentsModule, SettingsModule],
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
