import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MaintenancesController } from "./maintenances.controller";
import { MaintenancesService } from "./maintenances.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MaintenancesController],
  providers: [MaintenancesService],
})
export class MaintenancesModule {}
