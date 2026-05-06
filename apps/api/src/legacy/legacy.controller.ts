import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { LegacyService } from "./legacy.service";

@UseGuards(JwtAuthGuard)
@Controller("legacy")
export class LegacyController {
  constructor(private readonly legacyService: LegacyService) {}

  @Get("summary")
  getSummary() {
    return this.legacyService.getSummary();
  }

  @Get("reconciliation")
  getReconciliation() {
    return this.legacyService.getReconciliation();
  }

  @Get("units/:id")
  getUnitProfile(@Param("id") id: string) {
    return this.legacyService.getUnitProfile(id);
  }


  @Get("units/:id/operational-data")
  getUnitOperationalData(@Param("id") id: string) {
    return this.legacyService.getUnitOperationalData(id, false);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("units/:id/operational-data/reveal")
  revealUnitOperationalData(
    @Param("id") id: string,
    @Req() request: { user?: { id?: string } },
  ) {
    return this.legacyService.getUnitOperationalData(id, true, request.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("units/:id/operational-data/:infoId")
  updateUnitOperationalData(
    @Param("id") id: string,
    @Param("infoId") infoId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: { user?: { id?: string } },
  ) {
    return this.legacyService.updateUnitOperationalData(id, infoId, body, request.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("import-operational-data")
  importOperationalData(@Req() request: { user?: { id?: string } }) {
    return this.legacyService.importUnitOperationalData(request.user?.id);
  }

  @Get("partners/:id")
  getPartnerProfile(@Param("id") id: string) {
    return this.legacyService.getPartnerProfile(id);
  }

  @Get("equipments/:id")
  getEquipmentProfile(@Param("id") id: string) {
    return this.legacyService.getEquipmentProfile(id);
  }
}
