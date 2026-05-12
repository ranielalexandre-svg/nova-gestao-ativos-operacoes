jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../integrations/integrations.service', () => ({
  IntegrationsService: class IntegrationsService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentsService } from './equipments.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    equipment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'equipment-new',
          tag: data.tag,
          name: data.name,
          type: data.type,
          serialNumber: data.serialNumber,
          status: data.status,
          isActive: data.isActive,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          unitId: data.unitId,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'equipment-1',
          tag: data.tag ?? 'SW-01',
          name: data.name ?? 'Switch 01',
          type: data.type ?? 'switch',
          serialNumber: data.serialNumber ?? null,
          status: data.status ?? 'active',
          isActive: data.isActive ?? true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          unitId: data.unitId ?? 'unit-1',
        }),
      ),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'unit-1',
        code: 'U001',
        name: 'Unidade 1',
        city: 'Araguaína',
        state: 'TO',
        isActive: true,
        partner: {
          id: 'partner-1',
          code: 'IXC',
          name: 'IXC Soft',
        },
        equipments: [],
      }),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  const integrationsService = {
    syncUnitToZabbix: jest.fn().mockResolvedValue({ ok: true }),
  };

  const service = new EquipmentsService(
    prisma as never,
    integrationsService as never,
  );

  return {
    service,
    prisma,
    integrationsService,
  };
}

describe('EquipmentsService', () => {
  it('lists equipments with filters, other type grouping, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listEquipments({
      q: ' switch ',
      unitId: ' unit-1 ',
      status: ' ACTIVE ',
      type: 'outros',
      active: 'false',
      sortBy: 'tag',
      sortDir: 'asc',
      page: 2,
      pageSize: 20,
    });

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId: 'unit-1',
          status: 'active',
          isActive: false,
          OR: expect.any(Array),
          NOT: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
        orderBy: { tag: 'asc' },
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

  it('throws not found when an equipment detail does not exist', async () => {
    const { service } = buildService();

    await expect(service.getEquipmentById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicated tags when creating equipment', async () => {
    const { service, prisma } = buildService({
      equipment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'equipment-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createEquipment({
        tag: ' sw-01 ',
        name: 'Switch 01',
        type: 'switch',
        unitId: 'unit-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.equipment.create).not.toHaveBeenCalled();
  });

  it('rejects missing units when creating equipment', async () => {
    const { service } = buildService({
      unit: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.createEquipment({
        tag: ' sw-01 ',
        name: 'Switch 01',
        type: 'switch',
        unitId: 'missing-unit',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes payload fields when creating equipment', async () => {
    const { service, prisma } = buildService();

    const result = await service.createEquipment({
      tag: ' sw-01 ',
      name: ' Switch 01 ',
      type: ' SWITCH ',
      serialNumber: ' SN123 ',
      status: ' ACTIVE ',
      unitId: ' unit-1 ',
    });

    expect(prisma.equipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tag: 'SW-01',
          name: 'Switch 01',
          type: 'switch',
          serialNumber: 'SN123',
          status: 'active',
          unitId: 'unit-1',
          isActive: true,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'equipment-new',
        tag: 'SW-01',
        type: 'switch',
      }),
    );
  });

  it('throws not found when updating a missing equipment', async () => {
    const { service } = buildService();

    await expect(
      service.updateEquipment('missing', {
        name: 'Switch Atualizado',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes update fields and validates a changed unit', async () => {
    const { service, prisma } = buildService({
      equipment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({
          id: 'equipment-1',
          unitId: 'unit-old',
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'equipment-1',
          tag: 'SW-02',
          name: 'Switch 02',
          type: 'switch',
          serialNumber: null,
          status: 'inactive',
          isActive: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          unitId: 'unit-new',
        }),
      },
    });

    const result = await service.updateEquipment('equipment-1', {
      tag: ' sw-02 ',
      name: ' Switch 02 ',
      type: ' SWITCH ',
      serialNumber: ' ',
      status: ' INACTIVE ',
      unitId: ' unit-new ',
      isActive: false,
    });

    expect(prisma.unit.findUnique).toHaveBeenCalledWith({
      where: { id: 'unit-new' },
      select: { id: true },
    });
    expect(prisma.equipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'equipment-1' },
        data: expect.objectContaining({
          tag: 'SW-02',
          name: 'Switch 02',
          type: 'switch',
          serialNumber: null,
          status: 'inactive',
          unitId: 'unit-new',
          isActive: false,
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ tag: 'SW-02' }));
  });
});
