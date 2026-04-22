import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditsService } from './audits.service';

@Controller('audits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.auditsService.listAudits(limit);
  }
}
