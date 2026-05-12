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

import { UnitsController } from './units.controller';

function buildController() {
  const service = {
    listUnits: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getUnitById: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    createUnit: jest.fn().mockResolvedValue({ id: 'unit-new' }),
    updateUnit: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    syncReadyUnitsToZabbix: jest.fn().mockResolvedValue({ total: 0 }),
    syncUnitToZabbix: jest.fn().mockResolvedValue({ ok: true }),
  };

  return {
    controller: new UnitsController(service as never),
    service,
  };
}

describe('UnitsController', () => {
  it('delegates list requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 20 };

    await controller.listUnits(query as never);

    expect(service.listUnits).toHaveBeenCalledWith(query);
  });

  it('delegates detail requests to the service', async () => {
    const { controller, service } = buildController();

    await controller.getUnitById('unit-1');

    expect(service.getUnitById).toHaveBeenCalledWith('unit-1');
  });

  it('delegates create and update requests to the service', async () => {
    const { controller, service } = buildController();

    const createPayload = {
      code: 'u001',
      name: 'Unidade 1',
      partnerId: 'partner-1',
    };
    const updatePayload = {
      name: 'Unidade Atualizada',
    };

    await controller.createUnit(createPayload as never);
    await controller.updateUnit('unit-1', updatePayload as never);

    expect(service.createUnit).toHaveBeenCalledWith(createPayload);
    expect(service.updateUnit).toHaveBeenCalledWith('unit-1', updatePayload);
  });

  it('delegates Zabbix sync requests to the service', async () => {
    const { controller, service } = buildController();

    await controller.syncReadyUnitsToZabbix();
    await controller.syncUnitToZabbix('unit-1');

    expect(service.syncReadyUnitsToZabbix).toHaveBeenCalledTimes(1);
    expect(service.syncUnitToZabbix).toHaveBeenCalledWith('unit-1');
  });
});
