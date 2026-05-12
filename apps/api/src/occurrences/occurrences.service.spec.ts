jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OccurrencesService } from './occurrences.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    partner: {
      findUnique: jest.fn().mockResolvedValue({ id: 'partner-1' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    equipment: {
      findUnique: jest.fn().mockResolvedValue({ id: 'equipment-1' }),
    },
    occurrence: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'occurrence-new',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'occurrence-1',
          ...data,
        }),
      ),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  return {
    service: new OccurrencesService(prisma as never),
    prisma,
  };
}

describe('OccurrencesService', () => {
  it('lists occurrences with filters, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listOccurrences({
      q: ' alarme ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
      severity: 'critical',
      status: 'open',
      sortBy: 'severity',
      sortDir: 'asc',
      page: 2,
      pageSize: 20,
    });

    expect(prisma.occurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId: 'unit-1',
          equipmentId: 'equipment-1',
          severity: 'critical',
          status: 'open',
          OR: expect.any(Array),
        }),
        orderBy: { severity: 'asc' },
        skip: 20,
        take: 20,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('throws not found when an occurrence detail does not exist', async () => {
    const { service } = buildService();

    await expect(service.getOccurrenceById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicated codes when creating occurrence', async () => {
    const { service, prisma } = buildService({
      occurrence: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'occurrence-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createOccurrence({
        code: ' occ-001 ',
        title: 'Alarme crítico',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.occurrence.create).not.toHaveBeenCalled();
  });

  it('normalizes payload fields when creating occurrence', async () => {
    const { service, prisma } = buildService();

    const result = await service.createOccurrence({
      code: ' occ-001 ',
      title: ' Alarme crítico ',
      description: ' Observação ',
      severity: ' HIGH ',
      status: ' OPEN ',
      source: ' Zabbix ',
      partnerId: ' partner-1 ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
    });

    expect(prisma.occurrence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'OCC-001',
        title: 'Alarme crítico',
        description: 'Observação',
        severity: 'high',
        status: 'open',
        source: 'Zabbix',
        partnerId: 'partner-1',
        unitId: 'unit-1',
        equipmentId: 'equipment-1',
      }),
    });
    expect(result).toEqual(expect.objectContaining({ code: 'OCC-001' }));
  });

  it('rejects unknown related units when creating occurrence', async () => {
    const { service } = buildService({
      unit: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.createOccurrence({
        code: 'OCC-001',
        title: 'Alarme crítico',
        unitId: 'missing-unit',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes update fields and disconnects empty relations', async () => {
    const { service, prisma } = buildService({
      occurrence: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
      },
    });

    await service.updateOccurrence('occurrence-1', {
      code: ' occ-002 ',
      title: ' Ocorrência atualizada ',
      description: ' ',
      severity: ' LOW ',
      status: ' CLOSED ',
      source: ' ',
      partnerId: '',
      unitId: '',
      equipmentId: '',
    });

    expect(prisma.occurrence.update).toHaveBeenCalledWith({
      where: { id: 'occurrence-1' },
      data: expect.objectContaining({
        code: 'OCC-002',
        title: 'Ocorrência atualizada',
        description: null,
        severity: 'low',
        status: 'closed',
        source: null,
        partner: { disconnect: true },
        unit: { disconnect: true },
        equipment: { disconnect: true },
      }),
    });
  });
});
