import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

@Module({
  imports: [PrismaModule, AuthModule, SettingsModule],
  controllers: [ImportExportController],
  providers: [ImportExportService],
})
export class ImportExportModule {}
