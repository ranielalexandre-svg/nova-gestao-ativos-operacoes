import { Body, Controller, ForbiddenException, Get, Patch, Post, Query, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { SettingsService } from "../settings/settings.service";
import { AutomationsService } from "./automations.service";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { ListAutomationRulesQueryDto } from "./dto/list-automation-rules-query.dto";
import { ListAutomationRunsQueryDto } from "./dto/list-automation-runs-query.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

@Controller("automations")
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly settingsService: SettingsService,
  ) {}

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
    this.assertAutomationEnabled();
    return this.automationsService.createAutomationRule(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateAutomationRule(@Param("id") id: string, @Body() body: UpdateAutomationRuleDto) {
    this.assertAutomationEnabled();
    return this.automationsService.updateAutomationRule(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post(":id/run")
  runAutomationRuleNow(@Param("id") id: string) {
    this.assertAutomationEnabled();
    return this.automationsService.runAutomationRuleNow(id);
  }

  private assertAutomationEnabled() {
    if (!this.settingsService.isAutomationEnabled()) {
      throw new ForbiddenException("Automação desativada nas configurações.");
    }
  }
}
