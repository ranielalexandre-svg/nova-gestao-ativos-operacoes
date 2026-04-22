import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AttachmentsService,
  type UploadedFile as NovaUploadedFile,
} from './attachments.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':entityType/:entityId/attachments')
  list(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.attachmentsService.list(entityType, entityId);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'editor')
  @Post(':entityType/:entityId/attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  create(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @UploadedFile() file?: NovaUploadedFile,
  ) {
    return this.attachmentsService.create(entityType, entityId, file);
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'editor')
  @Delete(':entityType/:entityId/attachments/:attachmentId')
  remove(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentsService.remove(entityType, entityId, attachmentId);
  }

  @Get('attachments/:id/download')
  @Header('Cache-Control', 'private, max-age=60')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const item = await this.attachmentsService.getDownload(id);
    response.setHeader(
      'Content-Type',
      item.mimeType || 'application/octet-stream',
    );
    response.setHeader('Content-Length', String(item.size));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(item.name)}"`,
    );
    return new StreamableFile(item.stream);
  }
}
