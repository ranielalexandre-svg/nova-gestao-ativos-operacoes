import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ImportExportService } from './import-export.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Get('import/templates/:resource')
  template(@Param('resource') resource: string) {
    return this.importExportService.template(resource);
  }

  @Post('import/preview/:resource')
  preview(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.importExportService.preview(resource, String(body.csv || ''));
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('import/execute/:resource')
  execute(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.importExportService.execute(resource, String(body.csv || ''));
  }

  @Get('export/:resource')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Param('resource') resource: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.importExportService.export(resource);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="nova-${resource}.csv"`,
    );
    return csv;
  }
}
