import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { UnitsController } from "./units.controller";
import { UnitsService } from "./units.service";

@Module({
  imports: [PrismaModule, AuthModule, IntegrationsModule],
  controllers: [UnitsController],
  providers: [UnitsService],
})
export class UnitsModule {}
