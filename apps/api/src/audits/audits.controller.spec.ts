jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AuditsController } from './audits.controller';

describe('AuditsController', () => {
  it('delegates audit listing to the service with the raw limit query', async () => {
    const service = {
      listAudits: jest.fn().mockResolvedValue([]),
    };

    const controller = new AuditsController(service as never);

    await controller.list('25');

    expect(service.listAudits).toHaveBeenCalledWith('25');
  });
});
