jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../common/secrets', () => ({
  encryptSecret: jest.fn((value: unknown) => `enc:${String(value)}`),
  decryptSecret: jest.fn((value: unknown) => `dec:${String(value)}`),
}));

import { ForbiddenException } from '@nestjs/common';
import { StarlinksController } from './starlinks.controller';

function buildController() {
  const service = {
    listStarlinks: jest.fn().mockResolvedValue([]),
    importLegacyStarlinkData: jest.fn().mockResolvedValue({ imported: 1 }),
    importOperationalStarlinkData: jest.fn().mockResolvedValue({ imported: 1 }),
    getOperationalStarlinkData: jest.fn().mockResolvedValue({ items: [] }),
    getLegacyStarlinkData: jest.fn().mockResolvedValue({ items: [] }),
    updateOperationalStarlinkData: jest.fn().mockResolvedValue({ id: 'info-1' }),
    updateLegacyStarlinkData: jest.fn().mockResolvedValue({ id: 'info-1' }),
  };

  return {
    controller: new StarlinksController(service as never),
    service,
    adminReq: { user: { role: 'admin' } },
    viewerReq: { user: { role: 'viewer' } },
  };
}

describe('StarlinksController', () => {
  it('delegates public authenticated reads to the service', async () => {
    const { controller, service } = buildController();

    await controller.listStarlinks();
    await controller.getOperationalStarlinkData('equipment-1');
    await controller.getLegacyStarlinkData('equipment-1');

    expect(service.listStarlinks).toHaveBeenCalledTimes(1);
    expect(service.getOperationalStarlinkData).toHaveBeenCalledWith('equipment-1', false);
    expect(service.getLegacyStarlinkData).toHaveBeenCalledWith('equipment-1', false);
  });

  it('allows admins to reveal and update sensitive data', async () => {
    const { controller, service, adminReq } = buildController();
    const payload = { email: 'admin@example.com' };

    await controller.revealOperationalStarlinkData('equipment-1', adminReq);
    await controller.revealLegacyStarlinkData('equipment-1', adminReq);
    await controller.updateOperationalStarlinkData('equipment-1', 'info-1', adminReq, payload);
    await controller.updateLegacyStarlinkData('equipment-1', 'info-1', adminReq, payload);

    expect(service.getOperationalStarlinkData).toHaveBeenCalledWith('equipment-1', true);
    expect(service.getLegacyStarlinkData).toHaveBeenCalledWith('equipment-1', true);
    expect(service.updateOperationalStarlinkData).toHaveBeenCalledWith(
      'equipment-1',
      'info-1',
      payload,
    );
    expect(service.updateLegacyStarlinkData).toHaveBeenCalledWith(
      'equipment-1',
      'info-1',
      payload,
    );
  });

  it('allows admins to import legacy and operational data', async () => {
    const { controller, service, adminReq } = buildController();
    const payload = { normalized: { starlinks: [] } };

    await controller.importLegacyStarlinkData(adminReq, payload);
    await controller.importOperationalStarlinkData(adminReq, payload);

    expect(service.importLegacyStarlinkData).toHaveBeenCalledWith(payload);
    expect(service.importOperationalStarlinkData).toHaveBeenCalledWith(payload);
  });

  it('blocks non-admin access to sensitive operations', () => {
    const { controller, viewerReq } = buildController();

    expect(() =>
      controller.revealOperationalStarlinkData('equipment-1', viewerReq),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.importLegacyStarlinkData(viewerReq, {}),
    ).toThrow(ForbiddenException);
  });
});
