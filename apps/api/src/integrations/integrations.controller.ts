import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateIntegrationDto } from "./dto/create-integration.dto";
import { ListIntegrationsQueryDto } from "./dto/list-integrations-query.dto";
import { UpdateIntegrationDto } from "./dto/update-integration.dto";
import { IntegrationsService } from "./integrations.service";

@Controller("integrations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  listIntegrations(@Query() query: ListIntegrationsQueryDto) {
    return this.integrationsService.listIntegrations(query);
  }

  @Post()
  createIntegration(@Body() body: CreateIntegrationDto) {
    return this.integrationsService.createIntegration(body);
  }

  @Patch(":id")
  updateIntegration(@Param("id") id: string, @Body() body: UpdateIntegrationDto) {
    return this.integrationsService.updateIntegration(id, body);
  }

  @Post(":id/test")
  testConnection(@Param("id") id: string) {
    return this.integrationsService.testConnection(id);
  }
}
