import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateOccurrenceDto } from "./dto/create-occurrence.dto";
import { ListOccurrencesQueryDto } from "./dto/list-occurrences-query.dto";
import { UpdateOccurrenceDto } from "./dto/update-occurrence.dto";
import { OccurrencesService } from "./occurrences.service";

@Controller("occurrences")
export class OccurrencesController {
  constructor(private readonly occurrencesService: OccurrencesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listOccurrences(@Query() query: ListOccurrencesQueryDto) {
    return this.occurrencesService.listOccurrences(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getOccurrenceById(@Param("id") id: string) {
    return this.occurrencesService.getOccurrenceById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createOccurrence(@Body() body: CreateOccurrenceDto) {
    return this.occurrencesService.createOccurrence(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateOccurrence(@Param("id") id: string, @Body() body: UpdateOccurrenceDto) {
    return this.occurrencesService.updateOccurrence(id, body);
  }
}
