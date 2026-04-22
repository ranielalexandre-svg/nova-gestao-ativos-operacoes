import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PartnersModule } from "./partners/partners.module";
import { UnitsModule } from "./units/units.module";
import { EquipmentsModule } from "./equipments/equipments.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { MonitoringModule } from "./monitoring/monitoring.module";
import { OccurrencesModule } from "./occurrences/occurrences.module";
import { MaintenancesModule } from "./maintenances/maintenances.module";
import { ActivitiesModule } from "./activities/activities.module";
import { ExceptionsModule } from "./exceptions/exceptions.module";
import { AutomationsModule } from "./automations/automations.module";
import { LegacyModule } from "./legacy/legacy.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    PartnersModule,
    UnitsModule,
    EquipmentsModule,
    IntegrationsModule,
    MonitoringModule,
    OccurrencesModule,
    MaintenancesModule,
    ActivitiesModule,
    ExceptionsModule,
    AutomationsModule,
    LegacyModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
