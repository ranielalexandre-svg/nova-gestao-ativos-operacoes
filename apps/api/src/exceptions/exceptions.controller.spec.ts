jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../activities/activities.service', () => ({
  ActivitiesService: class ActivitiesService {},
}));

import { ExceptionsController } from './exceptions.controller';

function buildController() {
  const service = {
    listExceptions: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getSummary: jest.fn().mockResolvedValue({ counts: {} }),
    getQueueSummary: jest.fn().mockResolvedValue({ queues: [] }),
    listSlaPolicies: jest.fn().mockResolvedValue({ items: [] }),
    createSlaPolicy: jest.fn().mockResolvedValue({ id: 'sla-new' }),
    updateSlaPolicy: jest.fn().mockResolvedValue({ id: 'sla-1' }),
    recalculateSlaPolicies: jest.fn().mockResolvedValue({ recalculated: 0 }),
    bulkUpdateExceptions: jest.fn().mockResolvedValue({ updated: 0 }),
    getException: jest.fn().mockResolvedValue({ id: 'exception-1' }),
    createException: jest.fn().mockResolvedValue({ id: 'exception-new' }),
    addComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    updateException: jest.fn().mockResolvedValue({ id: 'exception-1' }),
  };

  return {
    controller: new ExceptionsController(service as never),
    service,
  };
}

describe('ExceptionsController', () => {
  it('delegates read endpoints to the service', async () => {
    const { controller, service } = buildController();
    const query = { page: 2, pageSize: 10, status: 'open' };

    await controller.listExceptions(query as never);
    await controller.getSummary();
    await controller.getQueueSummary();
    await controller.listSlaPolicies();
    await controller.getException('exception-1');

    expect(service.listExceptions).toHaveBeenCalledWith(query);
    expect(service.getSummary).toHaveBeenCalledTimes(1);
    expect(service.getQueueSummary).toHaveBeenCalledTimes(1);
    expect(service.listSlaPolicies).toHaveBeenCalledTimes(1);
    expect(service.getException).toHaveBeenCalledWith('exception-1');
  });

  it('delegates SLA policy admin endpoints to the service', async () => {
    const { controller, service } = buildController();
    const createPayload = {
      code: 'sla-1',
      name: 'SLA 1',
    };
    const updatePayload = {
      name: 'SLA atualizada',
    };

    await controller.createSlaPolicy(createPayload as never);
    await controller.updateSlaPolicy('sla-1', updatePayload as never);
    await controller.recalculateSlaPolicies();

    expect(service.createSlaPolicy).toHaveBeenCalledWith(createPayload);
    expect(service.updateSlaPolicy).toHaveBeenCalledWith('sla-1', updatePayload);
    expect(service.recalculateSlaPolicies).toHaveBeenCalledTimes(1);
  });

  it('delegates exception write endpoints to the service', async () => {
    const { controller, service } = buildController();
    const createPayload = {
      title: 'Falha crítica',
      severity: 'critical',
    };
    const updatePayload = {
      status: 'acknowledged',
    };
    const bulkPayload = {
      ids: ['exception-1'],
      action: 'ack',
    };

    await controller.createException(createPayload as never);
    await controller.updateException('exception-1', updatePayload as never);
    await controller.bulkUpdate(bulkPayload as never);

    expect(service.createException).toHaveBeenCalledWith(createPayload);
    expect(service.updateException).toHaveBeenCalledWith('exception-1', updatePayload);
    expect(service.bulkUpdateExceptions).toHaveBeenCalledWith(bulkPayload);
  });

  it('delegates comments using the authenticated subject as actor id', async () => {
    const { controller, service } = buildController();
    const payload = {
      body: 'Comentário operacional',
      isInternal: true,
    };
    const request = {
      user: {
        sub: 'user-1',
      },
    };

    await controller.addComment('exception-1', payload as never, request);

    expect(service.addComment).toHaveBeenCalledWith('exception-1', 'user-1', payload);
  });
});
