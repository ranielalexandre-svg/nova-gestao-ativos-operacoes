import { Body, Controller, Get, Patch, Post, Query, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AutomationsService } from "./automations.service";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { ListAutomationRulesQueryDto } from "./dto/list-automation-rules-query.dto";
import { ListAutomationRunsQueryDto } from "./dto/list-automation-runs-query.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

@Controller("automations")
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listAutomationRules(@Query() query: ListAutomationRulesQueryDto) {
    return this.automationsService.listAutomationRules(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get("runs")
  listAutomationRuns(@Query() query: ListAutomationRunsQueryDto) {
    return this.automationsService.listAutomationRuns(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get("summary")
  getSummary() {
    return this.automationsService.getSummary();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createAutomationRule(@Body() body: CreateAutomationRuleDto) {
    return this.automationsService.createAutomationRule(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateAutomationRule(@Param("id") id: string, @Body() body: UpdateAutomationRuleDto) {
    return this.automationsService.updateAutomationRule(id, body);
  }
}
