jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MaintenancesService } from './maintenances.service';

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
      findUnique: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
    },
    maintenance: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'maintenance-new',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'maintenance-1',
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
    service: new MaintenancesService(prisma as never),
    prisma,
  };
}

describe('MaintenancesService', () => {
  it('lists maintenances with filters, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listMaintenances({
      q: ' preventiva ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
      type: 'preventive',
      status: 'planned',
      sortBy: 'code',
      sortDir: 'asc',
      page: 2,
      pageSize: 20,
    });

    expect(prisma.maintenance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId: 'unit-1',
          equipmentId: 'equipment-1',
          type: 'preventive',
          status: 'planned',
          OR: expect.any(Array),
        }),
        orderBy: { code: 'asc' },
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

  it('throws not found when a maintenance detail does not exist', async () => {
    const { service } = buildService();

    await expect(service.getMaintenanceById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicated codes when creating maintenance', async () => {
    const { service, prisma } = buildService({
      maintenance: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'maintenance-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createMaintenance({
        code: ' man-001 ',
        title: 'Troca preventiva',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.maintenance.create).not.toHaveBeenCalled();
  });

  it('normalizes payload fields and parses dates when creating maintenance', async () => {
    const { service, prisma } = buildService();

    const result = await service.createMaintenance({
      code: ' man-001 ',
      title: ' Troca preventiva ',
      description: ' Observação ',
      type: ' PREVENTIVE ',
      status: ' PLANNED ',
      partnerId: ' partner-1 ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
      occurrenceId: ' occurrence-1 ',
      scheduledAt: '2026-01-01T12:00:00.000Z',
      completedAt: '2026-01-02T12:00:00.000Z',
    });

    expect(prisma.maintenance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'MAN-001',
        title: 'Troca preventiva',
        description: 'Observação',
        type: 'preventive',
        status: 'planned',
        partnerId: 'partner-1',
        unitId: 'unit-1',
        equipmentId: 'equipment-1',
        occurrenceId: 'occurrence-1',
        scheduledAt: new Date('2026-01-01T12:00:00.000Z'),
        completedAt: new Date('2026-01-02T12:00:00.000Z'),
      }),
    });
    expect(result).toEqual(expect.objectContaining({ code: 'MAN-001' }));
  });

  it('rejects invalid dates when creating maintenance', async () => {
    const { service } = buildService();

    await expect(
      service.createMaintenance({
        code: 'MAN-001',
        title: 'Troca preventiva',
        scheduledAt: 'data-invalida',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes update fields and connects related records', async () => {
    const { service, prisma } = buildService({
      maintenance: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
      },
    });

    await service.updateMaintenance('maintenance-1', {
      code: ' man-002 ',
      title: ' Manutenção atualizada ',
      description: ' ',
      type: ' corrective ',
      status: ' completed ',
      partnerId: ' partner-1 ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
      occurrenceId: ' occurrence-1 ',
      completedAt: '2026-01-02T12:00:00.000Z',
    });

    expect(prisma.maintenance.update).toHaveBeenCalledWith({
      where: { id: 'maintenance-1' },
      data: expect.objectContaining({
        code: 'MAN-002',
        title: 'Manutenção atualizada',
        description: null,
        type: 'corrective',
        status: 'completed',
        partner: { connect: { id: 'partner-1' } },
        unit: { connect: { id: 'unit-1' } },
        equipment: { connect: { id: 'equipment-1' } },
        occurrence: { connect: { id: 'occurrence-1' } },
        completedAt: new Date('2026-01-02T12:00:00.000Z'),
      }),
    });
  });
});
