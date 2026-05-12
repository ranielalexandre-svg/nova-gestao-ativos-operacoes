jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    join: jest.fn((values: unknown[]) => values),
  },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../integrations/integrations.service', () => ({
  IntegrationsService: class IntegrationsService {},
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { UnitsService } from './units.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    unit: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'unit-new',
          code: data.code,
          name: data.name,
          city: data.city,
          state: data.state,
          reportContractLabel: data.reportContractLabel,
          reportAddressLine: data.reportAddressLine,
          reportContractedBandwidth: data.reportContractedBandwidth,
          reportNotes: data.reportNotes,
          isActive: data.isActive,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
      update: jest.fn(),
    },
    partner: {
      findUnique: jest.fn().mockResolvedValue({ id: 'partner-1' }),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  const integrationsService = {
    syncUnitToZabbix: jest.fn().mockResolvedValue({ ok: true }),
    getZabbixUnitHostTelemetry: jest.fn().mockResolvedValue({ items: [] }),
  };

  const service = new UnitsService(prisma as never, integrationsService as never);

  return {
    service,
    prisma,
    integrationsService,
  };
}

describe('UnitsService', () => {
  it('lists units with default pagination and empty operational summary', async () => {
    const { service, prisma } = buildService();

    const result = await service.listUnits({});

    expect(prisma.unit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.unit.count).toHaveBeenCalledWith({ where: {} });
    expect(result).toEqual({
      items: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    });
  });

  it('applies search, partner, active and sorting filters when listing units', async () => {
    const { service, prisma } = buildService();

    await service.listUnits({
      q: ' matriz ',
      partnerId: ' partner-1 ',
      active: 'true',
      sortBy: 'code',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    });

    expect(prisma.unit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          partnerId: 'partner-1',
          isActive: true,
          OR: expect.any(Array),
        }),
        orderBy: { code: 'asc' },
        skip: 25,
        take: 25,
      }),
    );
  });

  it('throws not found when a unit detail does not exist', async () => {
    const { service } = buildService();

    await expect(service.getUnitById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicated unit codes when creating a unit', async () => {
    const { service, prisma } = buildService({
      unit: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'unit-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createUnit({
        code: ' u001 ',
        name: 'Unidade 1',
        partnerId: 'partner-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.unit.create).not.toHaveBeenCalled();
  });

  it('normalizes payload fields when creating a unit', async () => {
    const { service, prisma } = buildService();
    const syncSpy = jest
      .spyOn(service, 'syncUnitToZabbix')
      .mockResolvedValue({ ok: true } as never);

    const result = await service.createUnit({
      code: ' u001 ',
      name: ' Unidade 1 ',
      city: ' Araguaína ',
      state: ' to ',
      partnerId: ' partner-1 ',
      reportContractLabel: ' Contrato ',
      reportAddressLine: ' Rua 1 ',
      reportContractedBandwidth: ' 200 Mbps ',
      reportNotes: ' Observação ',
    });

    expect(prisma.partner.findUnique).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      select: { id: true },
    });
    expect(prisma.unit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'U001',
          name: 'Unidade 1',
          city: 'Araguaína',
          state: 'TO',
          partnerId: 'partner-1',
          reportContractLabel: 'Contrato',
          reportAddressLine: 'Rua 1',
          reportContractedBandwidth: '200 Mbps',
          reportNotes: 'Observação',
          isActive: true,
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ code: 'U001' }));
    expect(syncSpy).toHaveBeenCalledWith('unit-new');
  });
});
