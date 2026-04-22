import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { EquipmentsController } from "./equipments.controller";
import { EquipmentsService } from "./equipments.service";

@Module({
  imports: [PrismaModule, AuthModule, IntegrationsModule],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
})
export class EquipmentsModule {}
