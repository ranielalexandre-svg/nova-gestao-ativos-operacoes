jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../integrations/integrations.service', () => ({
  IntegrationsService: class IntegrationsService {},
}));

jest.mock('../activities/activities.service', () => ({
  ActivitiesService: class ActivitiesService {},
}));

jest.mock('../attachments/attachments.service', () => ({
  AttachmentsService: class AttachmentsService {},
}));

jest.mock('../exceptions/exceptions.service', () => ({
  ExceptionsService: class ExceptionsService {},
}));

jest.mock('../monitoring/monitoring.service', () => ({
  MonitoringService: class MonitoringService {},
}));

import { ForbiddenException } from '@nestjs/common';
import { AutomationsController } from './automations.controller';

function buildController(automationEnabled = true) {
  const automationsService = {
    listAutomationRules: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    listAutomationRuns: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getSummary: jest.fn().mockResolvedValue({ counts: {} }),
    createAutomationRule: jest.fn().mockResolvedValue({ id: 'rule-new' }),
    updateAutomationRule: jest.fn().mockResolvedValue({ id: 'rule-1' }),
    runAutomationRuleNow: jest.fn().mockResolvedValue({ ok: true }),
  };

  const settingsService = {
    isAutomationEnabled: jest.fn(() => automationEnabled),
  };

  return {
    controller: new AutomationsController(
      automationsService as never,
      settingsService as never,
    ),
    automationsService,
    settingsService,
  };
}

describe('AutomationsController', () => {
  it('delegates read endpoints to the service', async () => {
    const { controller, automationsService } = buildController();
    const rulesQuery = { page: 2, pageSize: 10, detector: 'maintenance_overdue' };
    const runsQuery = { page: 1, pageSize: 5, status: 'success' };

    await controller.listAutomationRules(rulesQuery as never);
    await controller.listAutomationRuns(runsQuery as never);
    await controller.getSummary();

    expect(automationsService.listAutomationRules).toHaveBeenCalledWith(rulesQuery);
    expect(automationsService.listAutomationRuns).toHaveBeenCalledWith(runsQuery);
    expect(automationsService.getSummary).toHaveBeenCalledTimes(1);
  });

  it('delegates admin write/run endpoints when automation is enabled', async () => {
    const { controller, automationsService, settingsService } = buildController();
    const createPayload = {
      code: 'auto-1',
      name: 'Automação 1',
      detector: 'maintenance_overdue',
    };
    const updatePayload = {
      name: 'Automação atualizada',
      enabled: false,
    };

    await controller.createAutomationRule(createPayload as never);
    await controller.updateAutomationRule('rule-1', updatePayload as never);
    await controller.runAutomationRuleNow('rule-1');

    expect(settingsService.isAutomationEnabled).toHaveBeenCalledTimes(3);
    expect(automationsService.createAutomationRule).toHaveBeenCalledWith(createPayload);
    expect(automationsService.updateAutomationRule).toHaveBeenCalledWith('rule-1', updatePayload);
    expect(automationsService.runAutomationRuleNow).toHaveBeenCalledWith('rule-1');
  });

  it('blocks write/run endpoints when automation is disabled', () => {
    const { controller } = buildController(false);

    expect(() =>
      controller.createAutomationRule({
        code: 'auto-1',
        name: 'Automação 1',
        detector: 'maintenance_overdue',
      } as never),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.updateAutomationRule('rule-1', {
        enabled: false,
      } as never),
    ).toThrow(ForbiddenException);

    expect(() => controller.runAutomationRuleNow('rule-1')).toThrow(ForbiddenException);
  });
});
