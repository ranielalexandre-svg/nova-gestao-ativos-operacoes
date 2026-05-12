jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../integrations/integrations.service', () => ({
  IntegrationsService: class IntegrationsService {},
}));

import { EquipmentsController } from './equipments.controller';

function buildController() {
  const service = {
    listEquipments: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getEquipmentById: jest.fn().mockResolvedValue({ id: 'equipment-1' }),
    createEquipment: jest.fn().mockResolvedValue({ id: 'equipment-new' }),
    updateEquipment: jest.fn().mockResolvedValue({ id: 'equipment-1' }),
  };

  return {
    controller: new EquipmentsController(service as never),
    service,
  };
}

describe('EquipmentsController', () => {
  it('delegates list and detail requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 10 };

    await controller.listEquipments(query as never);
    await controller.getEquipmentById('equipment-1');

    expect(service.listEquipments).toHaveBeenCalledWith(query);
    expect(service.getEquipmentById).toHaveBeenCalledWith('equipment-1');
  });

  it('delegates create and update requests to the service', async () => {
    const { controller, service } = buildController();

    const createPayload = {
      tag: 'sw-01',
      name: 'Switch 01',
      type: 'switch',
      unitId: 'unit-1',
    };
    const updatePayload = {
      status: 'inactive',
    };

    await controller.createEquipment(createPayload as never);
    await controller.updateEquipment('equipment-1', updatePayload as never);

    expect(service.createEquipment).toHaveBeenCalledWith(createPayload);
    expect(service.updateEquipment).toHaveBeenCalledWith('equipment-1', updatePayload);
  });
});
