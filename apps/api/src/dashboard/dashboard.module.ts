import { Module } from '@nestjs/common';
import { AuditsModule } from '../audits/audits.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
