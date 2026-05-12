jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../common/env', () => ({
  readCsvEnv: jest.fn(() => []),
}));

jest.mock('../common/secrets', () => ({
  encryptSecret: jest.fn((value: unknown) => `enc:${String(value)}`),
  decryptSecret: jest.fn((value: unknown) => `dec:${String(value)}`),
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

function existingIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'integration-1',
    code: 'ZBX',
    name: 'Zabbix',
    type: 'zabbix',
    baseUrl: 'https://zabbix.example.com',
    apiPath: '/api_jsonrpc.php',
    authMode: 'none',
    apiTokenEnc: null,
    usernameEnc: null,
    passwordEnc: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    integration: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve(existingIntegration({
          id: 'integration-new',
          ...data,
        })),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve(existingIntegration({
          id: 'integration-1',
          ...data,
        })),
      ),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  return {
    service: new IntegrationsService(prisma as never),
    prisma,
  };
}

describe('IntegrationsService', () => {
  it('lists integrations with filters, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listIntegrations({
      q: ' zabbix ',
      active: 'true',
      type: 'zabbix',
      sortBy: 'code',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    });

    expect(prisma.integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          type: 'zabbix',
          OR: expect.any(Array),
        }),
        orderBy: { code: 'asc' },
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

  it('rejects duplicated integration codes', async () => {
    const { service, prisma } = buildService({
      integration: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'integration-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createIntegration({
        code: ' zbx ',
        name: 'Zabbix',
        type: 'zabbix',
        baseUrl: 'https://zabbix.example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.integration.create).not.toHaveBeenCalled();
  });

  it('requires token credentials when authMode is token', async () => {
    const { service } = buildService();

    await expect(
      service.createIntegration({
        code: 'zbx',
        name: 'Zabbix',
        type: 'zabbix',
        baseUrl: 'https://zabbix.example.com',
        authMode: 'token',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes and encrypts token credentials when creating an integration', async () => {
    const { service, prisma } = buildService();

    const result = await service.createIntegration({
      code: ' zbx ',
      name: ' Zabbix ',
      type: ' ZABBIX ',
      baseUrl: ' https://zabbix.example.com ',
      apiPath: ' /api_jsonrpc.php ',
      authMode: ' token ',
      apiToken: ' secret-token ',
    });

    expect(prisma.integration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'ZBX',
          name: 'Zabbix',
          type: 'zabbix',
          baseUrl: 'https://zabbix.example.com',
          apiPath: '/api_jsonrpc.php',
          authMode: 'token',
          apiTokenEnc: 'enc: secret-token ',
          usernameEnc: null,
          passwordEnc: null,
          isActive: true,
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'integration-new' }));
  });

  it('throws not found when updating a missing integration', async () => {
    const { service } = buildService();

    await expect(
      service.updateIntegration('missing', {
        name: 'Zabbix',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes update fields and clears credentials for authMode none', async () => {
    const { service, prisma } = buildService({
      integration: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(
          existingIntegration({
            authMode: 'token',
            apiTokenEnc: 'enc:old-token',
          }),
        ),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(existingIntegration()),
      },
    });

    await service.updateIntegration('integration-1', {
      code: ' zbx2 ',
      name: ' Zabbix 2 ',
      type: ' ZABBIX ',
      baseUrl: ' https://zabbix2.example.com ',
      apiPath: ' ',
      authMode: ' none ',
      isActive: false,
    });

    expect(prisma.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'integration-1' },
        data: expect.objectContaining({
          code: 'ZBX2',
          name: 'Zabbix 2',
          type: 'zabbix',
          baseUrl: 'https://zabbix2.example.com',
          apiPath: null,
          authMode: 'none',
          apiTokenEnc: null,
          usernameEnc: null,
          passwordEnc: null,
          isActive: false,
        }),
      }),
    );
  });
});
