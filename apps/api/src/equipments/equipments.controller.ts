import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { ListEquipmentsQueryDto } from "./dto/list-equipments-query.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";
import { EquipmentsService } from "./equipments.service";

@Controller("equipments")
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listEquipments(@Query() query: ListEquipmentsQueryDto) {
    return this.equipmentsService.listEquipments(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getEquipmentById(@Param("id") id: string) {
    return this.equipmentsService.getEquipmentById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createEquipment(@Body() body: CreateEquipmentDto) {
    return this.equipmentsService.createEquipment(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateEquipment(@Param("id") id: string, @Body() body: UpdateEquipmentDto) {
    return this.equipmentsService.updateEquipment(id, body);
  }
}
