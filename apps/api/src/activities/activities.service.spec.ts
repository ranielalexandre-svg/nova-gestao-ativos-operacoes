jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    exceptionCase: {
      findUnique: jest.fn().mockResolvedValue({ id: 'exception-1' }),
      update: jest.fn().mockResolvedValue({ id: 'exception-1' }),
    },
    automationRule: {
      findUnique: jest.fn().mockResolvedValue({ id: 'automation-1' }),
    },
    automationRun: {
      findUnique: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    partner: {
      findUnique: jest.fn().mockResolvedValue({ id: 'partner-1' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    equipment: {
      findUnique: jest.fn().mockResolvedValue({ id: 'equipment-1' }),
    },
    integration: {
      findUnique: jest.fn().mockResolvedValue({ id: 'integration-1' }),
    },
    occurrence: {
      findUnique: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
    },
    maintenance: {
      findUnique: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
    },
    activityEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'activity-new',
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
    service: new ActivitiesService(prisma as never),
    prisma,
  };
}

describe('ActivitiesService', () => {
  it('lists activities with filters, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listActivities({
      q: ' alarme ',
      kind: 'incident',
      source: 'zabbix',
      severity: 'critical',
      sortBy: 'severity',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    });

    expect(prisma.activityEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'incident',
          source: 'zabbix',
          severity: 'critical',
          OR: expect.any(Array),
        }),
        orderBy: { severity: 'asc' },
        skip: 25,
        take: 25,
      }),
    );
    expect(prisma.activityEntry.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        kind: 'incident',
        source: 'zabbix',
        severity: 'critical',
        OR: expect.any(Array),
      }),
    });
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('normalizes payload fields and updates exception activity timestamp', async () => {
    const { service, prisma } = buildService();

    const result = await service.createActivity({
      title: ' Registro manual ',
      description: ' Observação ',
      kind: ' NOTE ',
      source: ' MANUAL ',
      severity: ' HIGH ',
      userId: ' user-1 ',
      exceptionId: ' exception-1 ',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true },
    });
    expect(prisma.exceptionCase.findUnique).toHaveBeenCalledWith({
      where: { id: 'exception-1' },
      select: { id: true },
    });
    expect(prisma.activityEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Registro manual',
        description: 'Observação',
        kind: 'note',
        source: 'manual',
        severity: 'high',
        userId: 'user-1',
        exceptionId: 'exception-1',
      }),
    });
    expect(prisma.exceptionCase.update).toHaveBeenCalledWith({
      where: { id: 'exception-1' },
      data: { lastActivityAt: expect.any(Date) },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'activity-new',
        title: 'Registro manual',
        kind: 'note',
      }),
    );
  });

  it('rejects unknown related users', async () => {
    const { service } = buildService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.createActivity({
        title: 'Registro',
        userId: 'missing-user',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
