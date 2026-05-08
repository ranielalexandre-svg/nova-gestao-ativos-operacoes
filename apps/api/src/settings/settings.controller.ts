import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('integrations')
  getIntegrationsSettings() {
    return this.settingsService.getIntegrationsSettings();
  }
}
