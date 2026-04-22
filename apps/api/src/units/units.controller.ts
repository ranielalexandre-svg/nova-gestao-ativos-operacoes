import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { ListUnitsQueryDto } from "./dto/list-units-query.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { UnitsService } from "./units.service";

@Controller("units")
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listUnits(@Query() query: ListUnitsQueryDto) {
    return this.unitsService.listUnits(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getUnitById(@Param("id") id: string) {
    return this.unitsService.getUnitById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createUnit(@Body() body: CreateUnitDto) {
    return this.unitsService.createUnit(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateUnit(@Param("id") id: string, @Body() body: UpdateUnitDto) {
    return this.unitsService.updateUnit(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("sync-zabbix-ready")
  syncReadyUnitsToZabbix() {
    return this.unitsService.syncReadyUnitsToZabbix();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post(":id/sync-zabbix")
  syncUnitToZabbix(@Param("id") id: string) {
    return this.unitsService.syncUnitToZabbix(id);
  }
}
