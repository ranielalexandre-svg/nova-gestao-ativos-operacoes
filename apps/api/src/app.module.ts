import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PartnersModule } from './partners/partners.module';
import { UnitsModule } from './units/units.module';
import { EquipmentsModule } from './equipments/equipments.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OccurrencesModule } from './occurrences/occurrences.module';
import { MaintenancesModule } from './maintenances/maintenances.module';
import { ActivitiesModule } from './activities/activities.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditsModule } from './audits/audits.module';
import { ExceptionsModule } from './exceptions/exceptions.module';
import { AutomationsModule } from './automations/automations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImportExportModule } from './import-export/import-export.module';
import { LegacyModule } from './legacy/legacy.module';
import { SettingsModule } from './settings/settings.module';
import { StarlinksModule } from './starlinks/starlinks.module';
import { HealthController } from './health.controller';

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
    AttachmentsModule,
    AuditsModule,
    ExceptionsModule,
    AutomationsModule,
    DashboardModule,
    ImportExportModule,
    LegacyModule,
    SettingsModule,
    StarlinksModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
