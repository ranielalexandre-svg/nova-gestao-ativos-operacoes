jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { ActivitiesController } from './activities.controller';

function buildController() {
  const service = {
    listActivities: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    createActivity: jest.fn().mockResolvedValue({ id: 'activity-new' }),
  };

  return {
    controller: new ActivitiesController(service as never),
    service,
  };
}

describe('ActivitiesController', () => {
  it('delegates list requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 20, q: 'alarme' };

    await controller.listActivities(query as never);

    expect(service.listActivities).toHaveBeenCalledWith(query);
  });

  it('delegates create requests to the service', async () => {
    const { controller, service } = buildController();
    const payload = {
      title: 'Registro manual',
      kind: 'note',
      source: 'manual',
    };

    await controller.createActivity(payload as never);

    expect(service.createActivity).toHaveBeenCalledWith(payload);
  });
});
