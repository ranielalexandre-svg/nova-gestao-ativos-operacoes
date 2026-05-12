jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { DashboardService } from './dashboard.service';

function buildService() {
  const auditsService = {
    listAudits: jest.fn().mockResolvedValue([
      {
        id: 'audit-1',
        action: 'created',
      },
    ]),
  };

  const prisma = {
    unit: {
      count: jest.fn().mockResolvedValue(10),
      groupBy: jest.fn().mockResolvedValue([
        {
          state: 'TO',
          _count: { _all: 7 },
        },
        {
          state: null,
          _count: { _all: 3 },
        },
      ]),
    },
    partner: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'partner-1',
          name: 'Parceiro A',
          _count: { units: 4 },
        },
      ]),
    },
    equipment: {
      count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(5),
    },
    user: {
      count: jest.fn().mockResolvedValue(3),
    },
    activityEntry: {
      count: jest.fn().mockResolvedValue(8),
    },
    occurrence: {
      count: jest.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'occurrence-1',
          code: 'O-1',
          title: 'Ocorrência',
          severity: 'high',
          status: 'open',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    },
    maintenance: {
      count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
    },
  };

  return {
    service: new DashboardService(prisma as never, auditsService as never),
    prisma,
    auditsService,
  };
}

describe('DashboardService', () => {
  it('builds dashboard counters, summaries and recent activity lists', async () => {
    const { service, prisma, auditsService } = buildService();

    const result = await service.getDashboard();

    expect(prisma.equipment.count).toHaveBeenNthCalledWith(2, {
      where: { type: { contains: 'starlink', mode: 'insensitive' } },
    });
    expect(prisma.occurrence.count).toHaveBeenNthCalledWith(2, {
      where: { status: { notIn: ['closed', 'fechada', 'resolved'] } },
    });
    expect(prisma.maintenance.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: { notIn: ['completed', 'concluida', 'concluída', 'closed'] },
      },
    });
    expect(auditsService.listAudits).toHaveBeenCalledWith(8);

    expect(result.stats).toEqual(
      expect.objectContaining({
        units: 10,
        partners: 2,
        equipments: 12,
        starlinks: 5,
        users: 3,
        audits: 8,
        occurrences: 6,
        maintenances: 4,
        online: 10,
        deployment: 0,
        incompleteAssets: 0,
        pendingMaintenances: 1,
        criticalMonitoring: 2,
      }),
    );
    expect(result.groupSummary).toEqual([
      { group: 'TO', total: 7 },
      { group: 'Sem UF', total: 3 },
    ]);
    expect(result.partnerSummary).toEqual([
      {
        id: 'partner-1',
        name: 'Parceiro A',
        units: 4,
        equipments: 0,
      },
    ]);
    expect(result.recentAudits).toHaveLength(1);
    expect(result.recentOccurrences).toHaveLength(1);
  });
});
