jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../activities/activities.service', () => ({
  ActivitiesService: class ActivitiesService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';

function slaPolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sla-1',
    code: 'SLA-GENERIC-HIGH',
    name: 'Genérico high',
    kind: 'generic',
    severity: 'high',
    queueKey: 'ops-general',
    firstResponseMinutes: 15,
    resolveMinutes: 120,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function exceptionCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exception-1',
    code: 'EXC-001',
    title: 'Falha crítica',
    description: 'Descrição',
    kind: 'integration',
    severity: 'high',
    status: 'open',
    source: 'manual',
    queueKey: 'ops-integracoes',
    classification: 'integration',
    impact: 'high',
    urgency: 'high',
    priorityScore: 88,
    triageStatus: 'pending',
    silencedUntil: null,
    acknowledgedAt: null,
    resolvedAt: null,
    firstResponseDueAt: new Date('2026-01-01T00:15:00.000Z'),
    resolveDueAt: new Date('2026-01-01T02:00:00.000Z'),
    breachedAt: null,
    lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    assigneeUserId: null,
    partnerId: 'partner-1',
    unitId: 'unit-1',
    equipmentId: 'equipment-1',
    integrationId: 'integration-1',
    occurrenceId: null,
    maintenanceId: null,
    ...overrides,
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
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
    slaPolicy: {
      upsert: jest.fn().mockResolvedValue({ id: 'sla-default' }),
      findFirst: jest.fn().mockResolvedValue(slaPolicy()),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'sla-new',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'sla-1',
          ...data,
        }),
      ),
    },
    exceptionCase: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'exception-new',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'exception-1',
          code: 'EXC-001',
          title: data.title ?? 'Falha crítica',
          status: data.status ?? 'open',
          severity: data.severity ?? 'high',
          ...data,
        }),
      ),
    },
    exceptionComment: {
      create: jest.fn().mockResolvedValue({
        id: 'comment-1',
        body: 'Comentário operacional',
        isInternal: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        author: {
          id: 'user-1',
          name: 'Admin',
          email: 'admin@example.com',
          role: 'admin',
        },
      }),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  const activitiesService = {
    createActivity: jest.fn().mockResolvedValue({ id: 'activity-1' }),
  };

  return {
    service: new ExceptionsService(prisma as never, activitiesService as never),
    prisma,
    activitiesService,
  };
}

describe('ExceptionsService', () => {
  it('lists exceptions with filters, due flags, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listExceptions({
      q: ' falha ',
      kind: 'integration',
      severity: 'high',
      status: 'open',
      source: 'manual',
      triageStatus: 'pending',
      queueKey: ' ops-integracoes ',
      onlyUnassigned: 'true',
      sortBy: 'priorityScore',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    });

    expect(prisma.exceptionCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'integration',
          severity: 'high',
          status: 'open',
          source: 'manual',
          triageStatus: 'pending',
          queueKey: 'ops-integracoes',
          assigneeUserId: null,
          OR: expect.any(Array),
        }),
        orderBy: [{ priorityScore: 'asc' }, { createdAt: 'desc' }],
        skip: 25,
        take: 25,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('builds global and queue summaries', async () => {
    const { service, prisma } = buildService({
      exceptionCase: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5),
        groupBy: jest.fn().mockResolvedValue([
          {
            queueKey: 'ops-integracoes',
            _count: { _all: 7 },
          },
        ]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const summary = await service.getSummary();
    const queueSummary = await service.getQueueSummary();

    expect(summary.counts).toEqual({
      openCount: 10,
      criticalCount: 2,
      silencedCount: 1,
      breachedCount: 3,
      dueSoonCount: 4,
      unassignedCount: 5,
      pendingTriageCount: 6,
    });
    expect(queueSummary.views).toEqual({
      all: 10,
      pendingTriage: 6,
      breached: 3,
      dueSoon: 4,
      unassigned: 5,
    });
    expect(queueSummary.queues).toEqual([
      {
        queueKey: 'ops-integracoes',
        total: 7,
      },
    ]);
    expect(prisma.exceptionCase.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['queueKey'],
        orderBy: { queueKey: 'asc' },
      }),
    );
  });

  it('creates SLA policies with normalized fields', async () => {
    const { service, prisma } = buildService();

    const result = await service.createSlaPolicy({
      code: ' sla-custom ',
      name: ' SLA Custom ',
      kind: ' INTEGRATION ',
      severity: ' HIGH ',
      queueKey: ' ops-integracoes ',
      firstResponseMinutes: 10,
      resolveMinutes: 60,
      isActive: false,
    });

    expect(prisma.slaPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          code: 'SLA-CUSTOM',
          name: 'SLA Custom',
          kind: 'integration',
          severity: 'high',
          queueKey: 'ops-integracoes',
          firstResponseMinutes: 10,
          resolveMinutes: 60,
          isActive: false,
        },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'sla-new' }));
  });

  it('rejects duplicated SLA policy codes and invalid SLA intervals', async () => {
    const { service } = buildService({
      slaPolicy: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'sla-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createSlaPolicy({
        code: 'sla-custom',
        name: 'SLA Custom',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const { service: serviceWithInvalidInterval } = buildService();

    await expect(
      serviceWithInvalidInterval.createSlaPolicy({
        code: 'sla-invalid',
        name: 'SLA Invalid',
        firstResponseMinutes: 60,
        resolveMinutes: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when an exception detail does not exist', async () => {
    const { service } = buildService();

    await expect(service.getException('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates exceptions with normalized fields and activity log', async () => {
    const { service, prisma, activitiesService } = buildService();

    const result = await service.createException({
      code: ' exc-001 ',
      title: ' Falha crítica ',
      description: ' Descrição ',
      kind: ' INTEGRATION ',
      severity: ' HIGH ',
      status: ' ACKNOWLEDGED ',
      source: ' MANUAL ',
      assigneeUserId: ' user-1 ',
      partnerId: ' partner-1 ',
      unitId: ' unit-1 ',
      equipmentId: ' equipment-1 ',
      integrationId: ' integration-1 ',
      silencedUntil: '2026-01-01T01:00:00.000Z',
    });

    expect(prisma.exceptionCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'EXC-001',
        title: 'Falha crítica',
        description: 'Descrição',
        kind: 'integration',
        severity: 'high',
        status: 'acknowledged',
        source: 'manual',
        assigneeUserId: 'user-1',
        partnerId: 'partner-1',
        unitId: 'unit-1',
        equipmentId: 'equipment-1',
        integrationId: 'integration-1',
        silencedUntil: new Date('2026-01-01T01:00:00.000Z'),
        acknowledgedAt: expect.any(Date),
        resolvedAt: null,
        queueKey: expect.any(String),
        priorityScore: expect.any(Number),
      }),
    });
    expect(activitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Exceção manual criada: EXC-001',
        kind: 'exception',
        source: 'exception',
        severity: 'high',
        exceptionId: 'exception-new',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'exception-new' }));
  });

  it('rejects duplicated exception codes and invalid related users', async () => {
    const { service } = buildService({
      exceptionCase: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'exception-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createException({
        code: 'EXC-001',
        title: 'Falha crítica',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const { service: serviceWithMissingUser } = buildService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      serviceWithMissingUser.createException({
        title: 'Falha crítica',
        assigneeUserId: 'missing-user',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates exceptions and recalculates operational fields', async () => {
    const existing = exceptionCase();
    const { service, prisma, activitiesService } = buildService({
      exceptionCase: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'exception-1',
          code: 'EXC-001',
          title: 'Falha atualizada',
          status: 'resolved',
          severity: 'critical',
        }),
      },
    });

    const result = await service.updateException('exception-1', {
      title: ' Falha atualizada ',
      description: ' ',
      kind: ' SLA ',
      severity: ' CRITICAL ',
      status: ' RESOLVED ',
      assigneeUserId: '',
    });

    expect(prisma.exceptionCase.update).toHaveBeenCalledWith({
      where: { id: 'exception-1' },
      data: expect.objectContaining({
        title: 'Falha atualizada',
        description: null,
        kind: 'sla',
        severity: 'critical',
        status: 'resolved',
        assignee: { disconnect: true },
        resolvedAt: expect.any(Date),
        queueKey: expect.any(String),
        priorityScore: expect.any(Number),
        lastActivityAt: expect.any(Date),
      }),
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        severity: true,
      },
    });
    expect(activitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Exceção atualizada: EXC-001',
        severity: 'critical',
        exceptionId: 'exception-1',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'resolved' }));
  });

  it('adds comments with actor validation and activity log', async () => {
    const { service, prisma, activitiesService } = buildService({
      exceptionCase: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(exceptionCase()),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'exception-1' }),
      },
    });

    const result = await service.addComment('exception-1', 'user-1', {
      body: ' Comentário operacional ',
      isInternal: false,
    });

    expect(prisma.exceptionComment.create).toHaveBeenCalledWith({
      data: {
        exceptionId: 'exception-1',
        userId: 'user-1',
        body: 'Comentário operacional',
        isInternal: false,
      },
      select: expect.any(Object),
    });
    expect(prisma.exceptionCase.update).toHaveBeenCalledWith({
      where: { id: 'exception-1' },
      data: { lastActivityAt: expect.any(Date) },
    });
    expect(activitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Comentário em EXC-001',
        description: 'Comentário operacional',
        userId: 'user-1',
        exceptionId: 'exception-1',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'comment-1' }));
  });
});
