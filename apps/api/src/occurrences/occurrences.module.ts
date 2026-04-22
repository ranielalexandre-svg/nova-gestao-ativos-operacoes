import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OccurrencesController } from "./occurrences.controller";
import { OccurrencesService } from "./occurrences.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OccurrencesController],
  providers: [OccurrencesService],
})
export class OccurrencesModule {}
