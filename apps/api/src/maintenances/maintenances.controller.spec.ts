jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { MaintenancesController } from './maintenances.controller';

function buildController() {
  const service = {
    listMaintenances: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getMaintenanceById: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
    createMaintenance: jest.fn().mockResolvedValue({ id: 'maintenance-new' }),
    updateMaintenance: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
  };

  return {
    controller: new MaintenancesController(service as never),
    service,
  };
}

describe('MaintenancesController', () => {
  it('delegates list and detail requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 10 };

    await controller.listMaintenances(query as never);
    await controller.getMaintenanceById('maintenance-1');

    expect(service.listMaintenances).toHaveBeenCalledWith(query);
    expect(service.getMaintenanceById).toHaveBeenCalledWith('maintenance-1');
  });

  it('delegates create and update requests to the service', async () => {
    const { controller, service } = buildController();
    const createPayload = {
      code: 'man-001',
      title: 'Troca preventiva',
    };
    const updatePayload = {
      status: 'completed',
    };

    await controller.createMaintenance(createPayload as never);
    await controller.updateMaintenance('maintenance-1', updatePayload as never);

    expect(service.createMaintenance).toHaveBeenCalledWith(createPayload);
    expect(service.updateMaintenance).toHaveBeenCalledWith('maintenance-1', updatePayload);
  });
});
