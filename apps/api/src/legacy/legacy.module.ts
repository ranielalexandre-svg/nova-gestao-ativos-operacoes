import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LegacyController } from "./legacy.controller";
import { LegacyService } from "./legacy.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LegacyController],
  providers: [LegacyService],
})
export class LegacyModule {}
