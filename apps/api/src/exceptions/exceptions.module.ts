import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ActivitiesModule } from "../activities/activities.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ExceptionsController } from "./exceptions.controller";
import { ExceptionsService } from "./exceptions.service";

@Module({
  imports: [PrismaModule, AuthModule, ActivitiesModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
