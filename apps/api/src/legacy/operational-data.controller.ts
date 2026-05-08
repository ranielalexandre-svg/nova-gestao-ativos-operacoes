import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { LegacyService } from "./legacy.service";

type ActorRequest = { user?: { id?: string } };

@UseGuards(JwtAuthGuard)
@Controller("operational-data")
export class OperationalDataController {
  constructor(private readonly legacyService: LegacyService) {}

  @Get("summary")
  getOperationalSummary() {
    return this.legacyService.getSummary();
  }

  @Get("reconciliation")
  getOperationalReconciliation() {
    return this.legacyService.getReconciliation();
  }

  @Get("units/:id")
  getUnitOperationalData(@Param("id") id: string) {
    return this.legacyService.getUnitOperationalData(id, false);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("units/:id/reveal")
  revealUnitOperationalData(
    @Param("id") id: string,
    @Req() request: ActorRequest,
  ) {
    return this.legacyService.getUnitOperationalData(id, true, request.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("units/:id/:infoId")
  updateUnitOperationalData(
    @Param("id") id: string,
    @Param("infoId") infoId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: ActorRequest,
  ) {
    return this.legacyService.updateUnitOperationalData(id, infoId, body, request.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("units/import")
  importUnitOperationalData(@Req() request: ActorRequest) {
    return this.legacyService.importUnitOperationalData(request.user?.id);
  }
}
