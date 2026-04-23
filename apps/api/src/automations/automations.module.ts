import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ActivitiesModule } from "../activities/activities.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { ExceptionsModule } from "../exceptions/exceptions.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MonitoringModule } from "../monitoring/monitoring.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";

@Module({
  imports: [PrismaModule, AuthModule, IntegrationsModule, ActivitiesModule, ExceptionsModule, AttachmentsModule, MonitoringModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
