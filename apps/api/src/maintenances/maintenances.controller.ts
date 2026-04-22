import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import { ListMaintenancesQueryDto } from "./dto/list-maintenances-query.dto";
import { UpdateMaintenanceDto } from "./dto/update-maintenance.dto";
import { MaintenancesService } from "./maintenances.service";

@Controller("maintenances")
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listMaintenances(@Query() query: ListMaintenancesQueryDto) {
    return this.maintenancesService.listMaintenances(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getMaintenanceById(@Param("id") id: string) {
    return this.maintenancesService.getMaintenanceById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createMaintenance(@Body() body: CreateMaintenanceDto) {
    return this.maintenancesService.createMaintenance(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateMaintenance(@Param("id") id: string, @Body() body: UpdateMaintenanceDto) {
    return this.maintenancesService.updateMaintenance(id, body);
  }
}
