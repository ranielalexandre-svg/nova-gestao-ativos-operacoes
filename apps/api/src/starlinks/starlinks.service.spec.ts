jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../common/secrets', () => ({
  encryptSecret: jest.fn((value: unknown) => `enc:${String(value)}`),
  decryptSecret: jest.fn((value: unknown) => `dec:${String(value)}`),
}));

import { NotFoundException } from '@nestjs/common';
import { StarlinksService } from './starlinks.service';

function starlinkEquipment() {
  return {
    id: 'equipment-1',
    tag: 'STARLINK-001',
    name: 'Starlink Matriz',
    type: 'starlink',
    serialNumber: 'KIT123',
    status: 'active',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    unit: {
      id: 'unit-1',
      code: 'U001',
      name: 'Matriz',
      city: 'Araguaína',
      state: 'TO',
      partner: {
        id: 'partner-1',
        code: 'IXC',
        name: 'IXC Soft',
      },
    },
  };
}

function operationalInfo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'info-1',
    equipmentId: 'equipment-1',
    source: 'legacy_sqlite',
    legacyId: 'legacy-1',
    antennaId: '1',
    localName: 'Matriz',
    kitSerial: 'KIT123',
    antennaSerial: 'ANT123',
    ipvpn: '10.0.0.1',
    plan: 'business',
    installer: 'Equipe',
    installedAt: '2026-01-01',
    notes: 'Observação',
    emailEnc: 'secret-email',
    passwordEnc: 'secret-password',
    cardEnc: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    equipment: {
      findMany: jest.fn().mockResolvedValue([starlinkEquipment()]),
      findUnique: jest.fn().mockResolvedValue(starlinkEquipment()),
    },
    documentAttachment: {
      groupBy: jest.fn().mockResolvedValue([
        {
          entityId: 'equipment-1',
          _count: { _all: 2 },
        },
      ]),
    },
    starlinkOperationalInfo: {
      findMany: jest.fn().mockResolvedValue([operationalInfo()]),
      findFirst: jest.fn().mockResolvedValue({ id: 'info-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve(operationalInfo(data)),
      ),
      upsert: jest.fn().mockResolvedValue({ id: 'info-1' }),
    },
    activityEntry: {
      create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
    },
    ...overrides,
  };

  return {
    service: new StarlinksService(prisma as never),
    prisma,
  };
}

describe('StarlinksService', () => {
  it('lists Starlink equipments with document and operational counters', async () => {
    const { service, prisma } = buildService();

    const result = await service.listStarlinks();

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        orderBy: { tag: 'asc' },
      }),
    );
    expect(prisma.documentAttachment.groupBy).toHaveBeenCalledWith({
      by: ['entityId'],
      where: {
        entityType: 'equipment',
        entityId: { in: ['equipment-1'] },
      },
      _count: { _all: true },
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'equipment-1',
        manufacturer: 'Starlink',
        assetTag: 'STARLINK-001',
        serial: 'KIT123',
        documentsCount: 2,
        operationalDataCount: 1,
        operationalSecretsCount: 2,
        unitCode: 'U001',
        partnerCode: 'IXC',
      }),
    );
  });

  it('throws not found when operational data is requested for a missing equipment', async () => {
    const { service } = buildService({
      equipment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.getOperationalStarlinkData('missing', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('formats operational data and reveals secrets when requested', async () => {
    const { service, prisma } = buildService();

    const result = await service.getOperationalStarlinkData('equipment-1', true);

    expect(prisma.activityEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'security',
          source: 'starlinks',
          severity: 'warning',
          equipmentId: 'equipment-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        revealSecrets: true,
        total: 1,
        items: [
          expect.objectContaining({
            id: 'info-1',
            hasEmail: true,
            hasPassword: true,
            hasCard: false,
            email: 'dec:secret-email',
            password: 'dec:secret-password',
            card: null,
            revealed: true,
          }),
        ],
      }),
    );
  });

  it('updates operational data and encrypts provided secrets', async () => {
    const { service, prisma } = buildService();

    const result = await service.updateOperationalStarlinkData(
      'equipment-1',
      'info-1',
      {
        antennaId: ' 2 ',
        localName: ' Filial ',
        email: ' user@example.com ',
        password: ' pass123 ',
        card: ' ',
      },
    );

    expect(prisma.starlinkOperationalInfo.findFirst).toHaveBeenCalledWith({
      where: { id: 'info-1', equipmentId: 'equipment-1' },
      select: { id: true },
    });
    expect(prisma.starlinkOperationalInfo.update).toHaveBeenCalledWith({
      where: { id: 'info-1' },
      data: expect.objectContaining({
        antennaId: '2',
        localName: 'Filial',
        emailEnc: 'enc:user@example.com',
        passwordEnc: 'enc:pass123',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'info-1',
        antennaId: '2',
        localName: 'Filial',
        revealed: false,
      }),
    );
  });

  it('imports operational legacy data by matching equipment serials', async () => {
    const { service, prisma } = buildService({
      equipment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'equipment-1',
            tag: 'STARLINK-001',
            serialNumber: 'KIT123',
          },
        ]),
        findUnique: jest.fn().mockResolvedValue(starlinkEquipment()),
      },
      starlinkOperationalInfo: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'info-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'info-1' }),
      },
    });

    const result = await service.importOperationalStarlinkData({
      normalized: {
        starlinks: [
          {
            legacyId: 'legacy-1',
            kitSerial: 'KIT123',
            email: 'user@example.com',
            password: 'secret',
          },
          {
            legacyId: '',
            kitSerial: '',
          },
        ],
      },
    });

    expect(prisma.starlinkOperationalInfo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { legacyId: 'legacy-1' },
        create: expect.objectContaining({
          legacyId: 'legacy-1',
          equipmentId: 'equipment-1',
          emailEnc: 'enc:user@example.com',
          passwordEnc: 'enc:secret',
        }),
      }),
    );
    expect(result).toEqual({
      imported: 1,
      updated: 0,
      skipped: 1,
      total: 2,
    });
  });
});
