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

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';

function automationRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    code: 'AUTO-1',
    name: 'Automação 1',
    detector: 'maintenance_overdue',
    severity: 'high',
    cadence: 'every_5_minutes',
    thresholdMinutes: 60,
    enabled: true,
    createExceptions: true,
    createActivities: true,
    resolveOnRecovery: true,
    reportTemplateId: null,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    automationRule: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'rule-new',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'rule-1',
          ...data,
        }),
      ),
    },
    automationRun: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    monitoringReportTemplate: {
      findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
    },
    unit: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    maintenance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    occurrence: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    integration: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  const integrationsService = {
    testConnectionByEntity: jest.fn().mockResolvedValue({ ok: true }),
    previewZabbixReportGroupSelection: jest.fn().mockResolvedValue({ matchedUnits: [] }),
  };
  const activitiesService = {
    createActivity: jest.fn().mockResolvedValue({ id: 'activity-1' }),
  };
  const attachmentsService = {
    create: jest.fn().mockResolvedValue({ id: 'attachment-1' }),
  };
  const exceptionsService = {
    upsertFromAutomation: jest.fn().mockResolvedValue({ created: 0, updated: 0 }),
    resolveRecovered: jest.fn().mockResolvedValue(0),
  };
  const monitoringService = {
    exportPrtgStyleReports: jest.fn().mockResolvedValue({
      fileName: 'relatorio.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf'),
    }),
  };

  return {
    service: new AutomationsService(
      prisma as never,
      integrationsService as never,
      activitiesService as never,
      attachmentsService as never,
      exceptionsService as never,
      monitoringService as never,
    ),
    prisma,
    integrationsService,
    activitiesService,
    attachmentsService,
    exceptionsService,
    monitoringService,
  };
}

describe('AutomationsService', () => {
  it('lists automation rules with filters, sorting and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listAutomationRules({
      q: ' atraso ',
      detector: 'maintenance_overdue',
      enabled: 'true',
      sortBy: 'code',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    });

    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          detector: 'maintenance_overdue',
          enabled: true,
          OR: expect.any(Array),
        }),
        orderBy: { code: 'asc' },
        skip: 25,
        take: 25,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('lists automation runs with status filter and pagination', async () => {
    const { service, prisma } = buildService();

    const result = await service.listAutomationRuns({
      status: 'error',
      sortDir: 'asc',
      page: 3,
      pageSize: 10,
    });

    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'error' },
        orderBy: { startedAt: 'asc' },
        skip: 20,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      page: 3,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('builds automation summary counters', async () => {
    const { service, prisma } = buildService({
      automationRule: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      automationRun: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const result = await service.getSummary();

    expect(prisma.automationRule.count).toHaveBeenNthCalledWith(1, {
      where: { enabled: true },
    });
    expect(prisma.automationRun.count).toHaveBeenCalledWith({
      where: {
        status: 'error',
        startedAt: { gte: expect.any(Date) },
      },
    });
    expect(prisma.automationRule.count).toHaveBeenNthCalledWith(2, {
      where: {
        enabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: expect.any(Date) } }],
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        counts: {
          enabledRules: 4,
          failedRuns24h: 1,
          dueRules: 2,
        },
      }),
    );
  });

  it('rejects duplicated automation codes when creating a rule', async () => {
    const { service, prisma } = buildService({
      automationRule: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'rule-existing' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.createAutomationRule({
        code: ' auto-1 ',
        name: 'Automação 1',
        detector: 'maintenance_overdue',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.automationRule.create).not.toHaveBeenCalled();
  });

  it('requires report template for monitoring report automations', async () => {
    const { service } = buildService();

    await expect(
      service.createAutomationRule({
        code: 'report-1',
        name: 'Relatório automático',
        detector: 'monitoring_report_export',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes payload fields when creating a rule', async () => {
    const { service, prisma } = buildService();

    const result = await service.createAutomationRule({
      code: ' auto-1 ',
      name: ' Automação 1 ',
      detector: ' MAINTENANCE_OVERDUE ',
      severity: ' CRITICAL ',
      cadence: ' HOURLY ',
      thresholdMinutes: 30,
      enabled: true,
      createExceptions: false,
      createActivities: true,
      resolveOnRecovery: false,
    });

    expect(prisma.automationRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'AUTO-1',
        name: 'Automação 1',
        detector: 'maintenance_overdue',
        severity: 'critical',
        cadence: 'hourly',
        thresholdMinutes: 30,
        enabled: true,
        createExceptions: false,
        createActivities: true,
        resolveOnRecovery: false,
        nextRunAt: expect.any(Date),
      }),
    });
    expect(result).toEqual(expect.objectContaining({ id: 'rule-new' }));
  });

  it('throws not found when updating a missing rule', async () => {
    const { service } = buildService();

    await expect(
      service.updateAutomationRule('missing', {
        name: 'Automação',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes update fields and connects a report template', async () => {
    const { service, prisma } = buildService({
      automationRule: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(
          automationRule({
            detector: 'maintenance_overdue',
            reportTemplateId: null,
            enabled: true,
          }),
        ),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      },
    });

    await service.updateAutomationRule('rule-1', {
      name: ' Automação atualizada ',
      detector: ' monitoring_report_export ',
      reportTemplateId: ' template-1 ',
      severity: ' low ',
      cadence: ' every_minute ',
      thresholdMinutes: 15,
      enabled: true,
      createExceptions: false,
      createActivities: false,
      resolveOnRecovery: false,
    });

    expect(prisma.monitoringReportTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      select: { id: true },
    });
    expect(prisma.automationRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: expect.objectContaining({
        name: 'Automação atualizada',
        detector: 'monitoring_report_export',
        severity: 'low',
        cadence: 'every_minute',
        thresholdMinutes: 15,
        enabled: true,
        createExceptions: false,
        createActivities: false,
        resolveOnRecovery: false,
        nextRunAt: expect.any(Date),
        reportTemplate: { connect: { id: 'template-1' } },
      }),
    });
  });

  it('throws not found when manually running a missing rule', async () => {
    const { service } = buildService();

    await expect(service.runAutomationRuleNow('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
