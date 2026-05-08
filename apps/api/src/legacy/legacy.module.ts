import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LegacyController } from "./legacy.controller";
import { LegacyService } from "./legacy.service";
import { OperationalDataController } from "./operational-data.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LegacyController, OperationalDataController],
  providers: [LegacyService],
})
export class LegacyModule {}
