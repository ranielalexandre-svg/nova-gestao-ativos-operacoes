jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AuditsService } from './audits.service';

function buildService(items: Array<Record<string, unknown>> = []) {
  const prisma = {
    activityEntry: {
      findMany: jest.fn().mockResolvedValue(items),
    },
  };

  return {
    service: new AuditsService(prisma as never),
    prisma,
  };
}

describe('AuditsService', () => {
  it('clamps limit and maps partner audit targets', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const { service, prisma } = buildService([
      {
        id: 'audit-1',
        kind: 'create',
        source: 'manual',
        title: 'Parceiro criado',
        description: 'Criado pelo admin',
        createdAt,
        actor: {
          id: 'user-1',
          name: 'Admin',
          email: 'admin@example.com',
        },
        partner: {
          id: 'partner-1',
          code: 'IXC',
          name: 'IXC Soft',
        },
        unit: null,
        equipment: null,
        integration: null,
        occurrence: null,
        maintenance: null,
        exceptionCase: null,
        automation: null,
      },
    ]);

    const result = await service.listAudits(999);

    expect(prisma.activityEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
    expect(result).toEqual([
      {
        id: 'audit-1',
        at: createdAt,
        actorUserId: 'user-1',
        actorName: 'Admin',
        action: 'Parceiro criado',
        targetType: 'partner',
        targetId: 'partner-1',
        targetLabel: 'IXC Soft',
        details: 'Criado pelo admin',
      },
    ]);
  });

  it('uses defaults for system audit entries without actor or target', async () => {
    const createdAt = new Date('2026-01-02T00:00:00.000Z');
    const { service, prisma } = buildService([
      {
        id: 'audit-2',
        kind: 'sync',
        source: 'system',
        title: '',
        description: '',
        createdAt,
        actor: null,
        partner: null,
        unit: null,
        equipment: null,
        integration: null,
        occurrence: null,
        maintenance: null,
        exceptionCase: null,
        automation: null,
      },
    ]);

    const result = await service.listAudits('invalid');

    expect(prisma.activityEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        actorUserId: null,
        actorName: 'Sistema',
        action: 'sync',
        targetType: 'system',
        targetId: null,
        targetLabel: 'NOVA',
        details: 'sync via system',
      }),
    );
  });
});
