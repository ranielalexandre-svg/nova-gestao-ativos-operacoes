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

import { IntegrationsController } from './integrations.controller';

function buildController() {
  const service = {
    listIntegrations: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    createIntegration: jest.fn().mockResolvedValue({ id: 'integration-new' }),
    updateIntegration: jest.fn().mockResolvedValue({ id: 'integration-1' }),
    testConnection: jest.fn().mockResolvedValue({ ok: true }),
  };

  return {
    controller: new IntegrationsController(service as never),
    service,
  };
}

describe('IntegrationsController', () => {
  it('delegates list and create requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 10 };
    const payload = {
      code: 'zbx',
      name: 'Zabbix',
      type: 'zabbix',
      baseUrl: 'https://zabbix.example.com',
    };

    await controller.listIntegrations(query as never);
    await controller.createIntegration(payload as never);

    expect(service.listIntegrations).toHaveBeenCalledWith(query);
    expect(service.createIntegration).toHaveBeenCalledWith(payload);
  });

  it('delegates update and test requests to the service', async () => {
    const { controller, service } = buildController();
    const payload = {
      name: 'Zabbix atualizado',
      isActive: false,
    };

    await controller.updateIntegration('integration-1', payload as never);
    await controller.testConnection('integration-1');

    expect(service.updateIntegration).toHaveBeenCalledWith('integration-1', payload);
    expect(service.testConnection).toHaveBeenCalledWith('integration-1');
  });
});
