/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    partner: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'partner-1', code: 'IXC', name: 'IXC' }),
    },
    unit: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'unit-1', partnerId: 'partner-1' }]),
    },
    contract: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'contract-1',
          code: '43779',
          title: 'Contrato 43779',
          status: 'active',
          slaPercent: 99.8,
          partner: { id: 'partner-1', code: 'IXC', name: 'IXC' },
          units: [
            {
              id: 'contract-unit-1',
              bandwidthMbps: 200,
              unit: {
                id: 'unit-1',
                code: 'U001',
                name: 'Matriz',
                city: 'Araguaina',
                state: 'TO',
              },
            },
          ],
          services: [],
          billings: [],
          contacts: [],
          _count: { units: 1, services: 0, billings: 0, contacts: 0 },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'contract-new',
          code: data.code,
          partnerId: data.partnerId,
        }),
      ),
    },
    contractUnit: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return arg;
    }),
    ...overrides,
  };

  return {
    service: new ContractsService(prisma as never),
    prisma,
  };
}

describe('ContractsService', () => {
  it('lists contracts with partner filters and derived unit totals', async () => {
    const { service, prisma } = buildService();

    const result = await service.listContracts({
      partnerId: 'partner-1',
      status: 'active',
      page: 1,
      pageSize: 10,
    });

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { partnerId: 'partner-1', status: 'active' },
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'contract-1',
        code: '43779',
        unitCount: 1,
        totalBandwidthMbps: 200,
      }),
    );
  });

  it('rejects contract creation when a selected unit does not belong to the partner', async () => {
    const { service, prisma } = buildService({
      unit: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      service.createContract({
        code: '43779',
        partnerId: 'partner-1',
        units: [{ unitId: 'unit-1' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.contract.create).not.toHaveBeenCalled();
  });

  it('throws not found when opening a missing contract detail', async () => {
    const { service } = buildService();

    await expect(service.getContractById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
