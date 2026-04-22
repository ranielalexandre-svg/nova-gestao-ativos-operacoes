import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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

  @Get("partners/:id")
  getPartnerProfile(@Param("id") id: string) {
    return this.legacyService.getPartnerProfile(id);
  }

  @Get("equipments/:id")
  getEquipmentProfile(@Param("id") id: string) {
    return this.legacyService.getEquipmentProfile(id);
  }
}
