jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  const prisma = {
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    equipment: {
      findUnique: jest.fn().mockResolvedValue({ id: 'equipment-1' }),
    },
    partner: {
      findUnique: jest.fn().mockResolvedValue({ id: 'partner-1' }),
    },
    occurrence: {
      findUnique: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
    },
    automationRun: {
      findUnique: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    monitoringReportTemplate: {
      findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
    },
    documentAttachment: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'attachment-1',
          name: 'documento.pdf',
          mimeType: 'application/pdf',
          size: 123,
          source: 'upload',
          createdAt,
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'attachment-1',
        name: 'documento.pdf',
        mimeType: 'application/pdf',
        size: 123,
        storagePath: 'document-attachments/documento.pdf',
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'attachment-1',
        storagePath: 'document-attachments/documento.pdf',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'attachment-1' }),
      create: jest.fn(),
    },
    ...overrides,
  };

  return {
    service: new AttachmentsService(prisma as never),
    prisma,
    createdAt,
  };
}

describe('AttachmentsService', () => {
  it('normalizes supported entity aliases', () => {
    const { service } = buildService();

    expect(service.normalizeEntityType(' units ')).toBe('unit');
    expect(service.normalizeEntityType('equipment')).toBe('equipment');
    expect(service.normalizeEntityType('automationRun')).toBe('automation_run');
    expect(service.normalizeEntityType('report_template')).toBe('report_template');
  });

  it('rejects unsupported entity types', () => {
    const { service } = buildService();

    expect(() => service.normalizeEntityType('invalid')).toThrow(BadRequestException);
  });

  it('lists public attachments for an existing entity', async () => {
    const { service, prisma, createdAt } = buildService();

    const result = await service.list('units', ' unit-1 ');

    expect(prisma.unit.findUnique).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      select: { id: true },
    });
    expect(prisma.documentAttachment.findMany).toHaveBeenCalledWith({
      where: { entityType: 'unit', entityId: 'unit-1' },
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
    expect(result).toEqual([
      {
        id: 'attachment-1',
        name: 'documento.pdf',
        url: '/api/attachments/attachment-1/download',
        mimeType: 'application/pdf',
        size: 123,
        source: 'upload',
        uploadedAt: createdAt,
        createdAt,
      },
    ]);
  });

  it('throws not found when the linked entity does not exist', async () => {
    const { service } = buildService({
      unit: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(service.list('units', 'missing-unit')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws not found when a download attachment is missing', async () => {
    const { service } = buildService({
      documentAttachment: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
    });

    await expect(service.getDownload('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an existing attachment and ignores missing files on disk', async () => {
    const { service, prisma } = buildService();

    const result = await service.remove('units', 'unit-1', 'attachment-1');

    expect(prisma.documentAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'attachment-1', entityType: 'unit', entityId: 'unit-1' },
      select: { id: true, storagePath: true },
    });
    expect(prisma.documentAttachment.delete).toHaveBeenCalledWith({
      where: { id: 'attachment-1' },
    });
    expect(result).toEqual({ ok: true });
  });
});
