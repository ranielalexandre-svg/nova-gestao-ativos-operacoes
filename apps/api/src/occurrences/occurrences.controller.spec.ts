jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { OccurrencesController } from './occurrences.controller';

function buildController() {
  const service = {
    listOccurrences: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getOccurrenceById: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
    createOccurrence: jest.fn().mockResolvedValue({ id: 'occurrence-new' }),
    updateOccurrence: jest.fn().mockResolvedValue({ id: 'occurrence-1' }),
  };

  return {
    controller: new OccurrencesController(service as never),
    service,
  };
}

describe('OccurrencesController', () => {
  it('delegates list and detail requests to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 10 };

    await controller.listOccurrences(query as never);
    await controller.getOccurrenceById('occurrence-1');

    expect(service.listOccurrences).toHaveBeenCalledWith(query);
    expect(service.getOccurrenceById).toHaveBeenCalledWith('occurrence-1');
  });

  it('delegates create and update requests to the service', async () => {
    const { controller, service } = buildController();
    const createPayload = {
      code: 'occ-001',
      title: 'Alarme crítico',
    };
    const updatePayload = {
      status: 'closed',
    };

    await controller.createOccurrence(createPayload as never);
    await controller.updateOccurrence('occurrence-1', updatePayload as never);

    expect(service.createOccurrence).toHaveBeenCalledWith(createPayload);
    expect(service.updateOccurrence).toHaveBeenCalledWith('occurrence-1', updatePayload);
  });
});
