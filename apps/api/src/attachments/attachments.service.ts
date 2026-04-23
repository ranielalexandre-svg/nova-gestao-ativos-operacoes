import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const ENTITY_ALIASES: Record<string, string> = {
  unit: 'unit',
  units: 'unit',
  equipment: 'equipment',
  equipments: 'equipment',
  partner: 'partner',
  partners: 'partner',
  occurrence: 'occurrence',
  occurrences: 'occurrence',
  automation_run: 'automation_run',
  automationrun: 'automation_run',
  template: 'report_template',
  report_template: 'report_template',
  reporttemplate: 'report_template',
};

export type UploadedFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AttachmentsService {
  private readonly rootDir = resolve(
    process.cwd(),
    process.env.NOVA_UPLOAD_DIR || 'uploads',
  );

  private readonly attachmentDir = join(this.rootDir, 'document-attachments');

  constructor(private readonly prisma: PrismaService) {}

  normalizeEntityType(entityType: string) {
    const normalized = String(entityType || '')
      .trim()
      .toLowerCase();
    const mapped = ENTITY_ALIASES[normalized];

    if (!mapped) {
      throw new BadRequestException('Tipo de entidade inválido para anexo.');
    }

    return mapped;
  }

  private async ensureEntity(entityType: string, entityId: string) {
    const id = String(entityId || '').trim();
    if (!id) throw new BadRequestException('entityId inválido.');

    const exists = await this.exists(entityType, id);
    if (!exists)
      throw new NotFoundException('Registro vinculado não encontrado.');

    return id;
  }

  private async exists(entityType: string, id: string) {
    switch (entityType) {
      case 'unit':
        return Boolean(
          await this.prisma.unit.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      case 'equipment':
        return Boolean(
          await this.prisma.equipment.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      case 'partner':
        return Boolean(
          await this.prisma.partner.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      case 'occurrence':
        return Boolean(
          await this.prisma.occurrence.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      case 'automation_run':
        return Boolean(
          await this.prisma.automationRun.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      case 'report_template':
        return Boolean(
          await this.prisma.monitoringReportTemplate.findUnique({
            where: { id },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }

  private safeFileName(name: string) {
    return (
      basename(String(name || 'anexo').trim() || 'anexo')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'anexo'
    );
  }

  private toPublic(item: {
    id: string;
    name: string;
    mimeType: string | null;
    size: number;
    source: string;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      name: item.name,
      url: `/api/attachments/${item.id}/download`,
      mimeType: item.mimeType,
      size: item.size,
      source: item.source,
      uploadedAt: item.createdAt,
      createdAt: item.createdAt,
    };
  }

  async list(entityTypeInput: string, entityIdInput: string) {
    const entityType = this.normalizeEntityType(entityTypeInput);
    const entityId = await this.ensureEntity(entityType, entityIdInput);

    const items = await this.prisma.documentAttachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        source: true,
        createdAt: true,
      },
    });

    return items.map((item) => this.toPublic(item));
  }

  async create(
    entityTypeInput: string,
    entityIdInput: string,
    file?: UploadedFile,
  ) {
    const entityType = this.normalizeEntityType(entityTypeInput);
    const entityId = await this.ensureEntity(entityType, entityIdInput);

    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('Arquivo não enviado.');
    }

    await mkdir(this.attachmentDir, { recursive: true });

    const safeName = this.safeFileName(file.originalname);
    const storedName = `${entityType}-${entityId}-${Date.now()}-${randomUUID()}-${safeName}`;
    const relativePath = join('document-attachments', storedName);
    const absolutePath = join(this.rootDir, relativePath);

    await writeFile(absolutePath, file.buffer);

    const item = await this.prisma.documentAttachment.create({
      data: {
        entityType,
        entityId,
        name: safeName,
        storedName,
        mimeType: file.mimetype || null,
        size: file.size || file.buffer.byteLength,
        storagePath: relativePath,
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        source: true,
        createdAt: true,
      },
    });

    return this.toPublic(item);
  }

  async getDownload(id: string) {
    const item = await this.prisma.documentAttachment.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        storagePath: true,
      },
    });

    if (!item) throw new NotFoundException('Anexo não encontrado.');

    return {
      ...item,
      stream: createReadStream(join(this.rootDir, item.storagePath)),
    };
  }

  async remove(
    entityTypeInput: string,
    entityIdInput: string,
    attachmentId: string,
  ) {
    const entityType = this.normalizeEntityType(entityTypeInput);
    const entityId = await this.ensureEntity(entityType, entityIdInput);

    const item = await this.prisma.documentAttachment.findFirst({
      where: { id: attachmentId, entityType, entityId },
      select: { id: true, storagePath: true },
    });

    if (!item) throw new NotFoundException('Anexo não encontrado.');

    await this.prisma.documentAttachment.delete({ where: { id: item.id } });
    await unlink(join(this.rootDir, item.storagePath)).catch(() => undefined);

    return { ok: true };
  }
}
