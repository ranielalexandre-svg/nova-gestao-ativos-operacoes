jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  it('delegates dashboard loading to the service', async () => {
    const dashboard = {
      stats: {
        units: 1,
        partners: 1,
        equipments: 2,
        starlinks: 1,
        users: 1,
        audits: 3,
        occurrences: 4,
        maintenances: 5,
      },
    };

    const service = {
      getDashboard: jest.fn().mockResolvedValue(dashboard),
    };

    const controller = new DashboardController(service as never);

    await expect(controller.getDashboard()).resolves.toBe(dashboard);
    expect(service.getDashboard).toHaveBeenCalledTimes(1);
  });
});
