jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../integrations/integrations.service', () => ({
  IntegrationsService: class IntegrationsService {},
}));

jest.mock('../attachments/attachments.service', () => ({
  AttachmentsService: class AttachmentsService {},
}));

jest.mock('./report-export.service', () => ({
  MonitoringReportExportService: class MonitoringReportExportService {},
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

function activeUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    code: 'U001',
    name: 'Matriz',
    city: 'Araguaína',
    state: 'TO',
    reportContractLabel: 'Contrato 1',
    reportAddressLine: 'Rua 1',
    reportContractedBandwidth: '200 Mbps',
    reportNotes: 'Observação',
    zabbixHost: 'host-u001',
    zabbixVisibleName: 'Unidade U001',
    isActive: true,
    partner: {
      id: 'partner-1',
      code: 'IXC',
      name: 'IXC Soft',
    },
    equipments: [
      {
        id: 'equipment-1',
        tag: 'SW-01',
        name: 'Switch 01',
        type: 'switch',
        serialNumber: 'SN123',
        status: 'active',
        isActive: true,
      },
    ],
    ...overrides,
  };
}

function prtgReport() {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    unit: {
      id: 'unit-1',
      code: 'U001',
      name: 'Matriz',
    },
    period: {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    },
    series: [],
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      count: jest.fn().mockResolvedValue(0),
    },
    partner: {
      count: jest.fn().mockResolvedValue(0),
    },
    unit: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([activeUnit()]),
      findUnique: jest.fn().mockResolvedValue(activeUnit()),
    },
    equipment: {
      count: jest.fn().mockResolvedValue(1),
    },
    integration: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'integration-1', type: 'zabbix' }),
    },
    occurrence: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    maintenance: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    monitoringReportTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'template-1',
          ...data,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    },
    automationRun: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({ id: 'run-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    documentAttachment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    automationRule: {
      upsert: jest.fn().mockResolvedValue({ id: 'rule-1' }),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    ...overrides,
  };

  const integrationsService = {
    testConnectionByEntity: jest.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      targetUrl: 'https://zabbix.example.com',
      latencyMs: 10,
    }),
    getZabbixSnapshotByEntity: jest.fn().mockResolvedValue({
      ok: true,
      targetUrl: 'https://zabbix.example.com',
      recentProblems: [],
      message: 'ok',
    }),
    getZabbixUnitHostTelemetry: jest.fn().mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00.000Z',
      sources: [],
      counts: {
        units: 1,
        matched: 1,
        ambiguous: 0,
        unmapped: 0,
        online: 1,
        degraded: 0,
        down: 0,
        withProblems: 0,
        syncReady: 1,
        avgLatencyMs: 10,
        avgLossPct: 0,
        maxTemperatureC: null,
      },
      items: [],
    }),
    getZabbixPrtgStyleReport: jest.fn().mockResolvedValue(prtgReport()),
    getZabbixReportGroupCatalog: jest.fn().mockResolvedValue([{ groupid: '1' }]),
    previewZabbixReportGroupSelection: jest.fn().mockResolvedValue({
      matchedUnits: [{ unit: activeUnit() }],
    }),
  };

  const reportExportService = {
    exportReports: jest.fn().mockResolvedValue({
      fileName: 'relatorio.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf'),
    }),
  };

  const attachmentsService = {
    create: jest.fn().mockResolvedValue({ id: 'attachment-1' }),
  };

  return {
    service: new MonitoringService(
      prisma as never,
      integrationsService as never,
      reportExportService as never,
      attachmentsService as never,
    ),
    prisma,
    integrationsService,
    reportExportService,
    attachmentsService,
  };
}

describe('MonitoringService', () => {
  it('builds monitoring summary with integration checks and zabbix snapshots', async () => {
    const activeIntegration = {
      id: 'integration-1',
      code: 'ZBX',
      name: 'Zabbix',
      type: 'zabbix',
      isActive: true,
    };
    const { service, prisma, integrationsService } = buildService({
      user: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4),
      },
      partner: {
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2),
      },
      unit: {
        count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(9),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      equipment: {
        count: jest.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(18),
      },
      integration: {
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([activeIntegration])
          .mockResolvedValueOnce([activeIntegration]),
        findUnique: jest.fn(),
      },
    });

    const result = await service.getSummary();

    expect(prisma.integration.findMany).toHaveBeenNthCalledWith(1, {
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    expect(integrationsService.testConnectionByEntity).toHaveBeenCalledWith(activeIntegration);
    expect(integrationsService.getZabbixSnapshotByEntity).toHaveBeenCalledWith(activeIntegration);
    expect(result.counts).toEqual(
      expect.objectContaining({
        usersTotal: 5,
        usersActive: 4,
        partnersTotal: 3,
        partnersActive: 2,
        unitsTotal: 10,
        unitsActive: 9,
        equipmentsTotal: 20,
        equipmentsActive: 18,
        integrationsTotal: 2,
        integrationsActive: 1,
        integrationsHealthy: 1,
        integrationsFailing: 0,
      }),
    );
    expect(result.integrationChecks).toHaveLength(1);
    expect(result.zabbixSnapshots).toHaveLength(1);
  });

  it('builds command center counters, buckets and recent lists', async () => {
    const recentOccurrence = {
      id: 'occurrence-1',
      code: 'OCC-1',
      title: 'Alarme',
      severity: 'critical',
      status: 'open',
      source: 'zabbix',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      partner: null,
      unit: null,
      equipment: null,
      _count: { maintenances: 0 },
    };
    const recentMaintenance = {
      id: 'maintenance-1',
      code: 'MAN-1',
      title: 'Preventiva',
      type: 'preventive',
      status: 'planned',
      scheduledAt: null,
      completedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      partner: null,
      unit: null,
      equipment: null,
      occurrence: null,
    };

    const { service, prisma } = buildService({
      occurrence: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(2),
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ severity: 'critical', _count: { severity: 2 } }])
          .mockResolvedValueOnce([{ status: 'open', _count: { status: 5 } }]),
        findMany: jest.fn().mockResolvedValue([recentOccurrence]),
      },
      maintenance: {
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1),
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ status: 'planned', _count: { status: 3 } }])
          .mockResolvedValueOnce([{ type: 'preventive', _count: { type: 1 } }]),
        findMany: jest.fn().mockResolvedValue([recentMaintenance]),
      },
    });

    const result = await service.getCommandCenter();

    expect(result.metrics).toEqual({
      openOccurrences: 5,
      criticalOpenOccurrences: 2,
      overdueMaintenances: 3,
      dueTodayMaintenances: 1,
    });
    expect(result.buckets.occurrenceBySeverity).toEqual([
      { key: 'critical', count: 2 },
    ]);
    expect(result.buckets.maintenanceByStatus).toEqual([
      { key: 'planned', count: 3 },
    ]);
    expect(result.recentOccurrences).toEqual([recentOccurrence]);
    expect(result.recentMaintenances).toEqual([recentMaintenance]);
    expect(prisma.occurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 8,
      }),
    );
  });

  it('loads unit host telemetry directly when cache is disabled', async () => {
    const previous = process.env.NOVA_ZABBIX_TELEMETRY_CACHE_MS;
    process.env.NOVA_ZABBIX_TELEMETRY_CACHE_MS = '0';

    try {
      const { service, integrationsService } = buildService();

      const result = await service.getUnitHostTelemetry();

      expect(integrationsService.getZabbixUnitHostTelemetry).toHaveBeenCalledWith([
        activeUnit(),
      ]);
      expect(result.counts.units).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.NOVA_ZABBIX_TELEMETRY_CACHE_MS;
      else process.env.NOVA_ZABBIX_TELEMETRY_CACHE_MS = previous;
    }
  });

  it('lists report units, sources, templates and template runs with attachment URLs', async () => {
    const template = {
      id: 'template-1',
      code: 'TPL-1',
      name: 'Template 1',
      sourceType: 'manual',
      periodPreset: 'last_7_days',
      outputFormat: 'pdf',
      includeCharts: true,
      title: 'Título',
      interestedParty: null,
      contractLabel: null,
      addressLine: null,
      contractedBandwidth: null,
      enabled: true,
      groupIds: '1,2',
      unitIds: 'unit-1,unit-2',
      integration: null,
      automations: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const run = {
      id: 'run-1',
      status: 'success',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: new Date('2026-01-01T00:01:00.000Z'),
      hitsCount: 1,
      createdCount: 1,
      updatedCount: 0,
      summary: 'ok',
      errorMessage: null,
      rule: {
        id: 'rule-1',
        code: 'RULE-1',
        name: 'Rule 1',
        cadence: 'manual',
        reportTemplate: {
          id: 'template-1',
          code: 'TPL-1',
          name: 'Template 1',
        },
      },
    };
    const { service, prisma } = buildService({
      unit: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([activeUnit()]),
        findUnique: jest.fn(),
      },
      integration: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'integration-1', code: 'ZBX', name: 'Zabbix' },
        ]),
        findUnique: jest.fn(),
      },
      monitoringReportTemplate: {
        findMany: jest.fn().mockResolvedValue([template]),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      automationRun: {
        findMany: jest.fn().mockResolvedValue([run]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      documentAttachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attachment-1',
            entityId: 'run-1',
            name: 'relatorio.pdf',
            mimeType: 'application/pdf',
            size: 123,
            source: 'upload',
            createdAt: new Date('2026-01-01T00:02:00.000Z'),
          },
        ]),
      },
    });

    await expect(service.getReportUnits()).resolves.toEqual({
      total: 1,
      items: [activeUnit()],
    });
    await expect(service.getReportGroupSources()).resolves.toEqual([
      { id: 'integration-1', code: 'ZBX', name: 'Zabbix' },
    ]);
    await expect(service.listReportTemplates()).resolves.toEqual([
      expect.objectContaining({
        id: 'template-1',
        groupIds: ['1', '2'],
        unitIds: ['unit-1', 'unit-2'],
      }),
    ]);

    const runs = await service.listReportTemplateRuns({ templateId: 'template-1' });

    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rule: {
            detector: 'monitoring_report_export',
            reportTemplateId: 'template-1',
          },
        },
        take: 20,
      }),
    );
    expect(runs[0].attachments).toEqual([
      expect.objectContaining({
        id: 'attachment-1',
        url: '/api/attachments/attachment-1/download',
      }),
    ]);
  });

  it('creates report templates with normalized fields and validates inputs', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.createReportTemplate({
        code: 'tpl-empty',
        name: 'Template vazio',
        sourceType: 'manual',
        unitIds: [],
        groupIds: [],
        periodPreset: 'last_7_days',
        outputFormat: 'pdf',
        includeCharts: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const result = await service.createReportTemplate({
      code: ' tpl-1 ',
      name: ' Template 1 ',
      integrationId: ' integration-1 ',
      sourceType: 'zabbix_group',
      unitIds: [],
      groupIds: [' 1 ', '1', '2'],
      periodPreset: 'current_month',
      outputFormat: 'docx',
      includeCharts: false,
      title: ' Título ',
      interestedParty: ' Cliente ',
      contractLabel: ' Contrato ',
      addressLine: ' Rua 1 ',
      contractedBandwidth: ' 200 Mbps ',
    });

    expect(prisma.integration.findUnique).toHaveBeenCalledWith({
      where: { id: 'integration-1' },
      select: { id: true, type: true },
    });
    expect(prisma.monitoringReportTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'TPL-1',
        name: 'Template 1',
        integrationId: 'integration-1',
        sourceType: 'zabbix_group',
        periodPreset: 'current_month',
        groupIds: '1,2',
        unitIds: null,
        outputFormat: 'docx',
        includeCharts: false,
        title: 'Título',
        interestedParty: 'Cliente',
        contractLabel: 'Contrato',
        addressLine: 'Rua 1',
        contractedBandwidth: '200 Mbps',
        enabled: true,
      }),
      select: expect.any(Object),
    });
    expect(result).toEqual(expect.objectContaining({ id: 'template-1' }));
  });

  it('validates zabbix group catalog and preview inputs', async () => {
    const { service, integrationsService } = buildService();

    await expect(service.getZabbixReportGroups({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.previewZabbixReportGroups({
        integrationId: 'integration-1',
        groupIds: [],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.getZabbixReportGroups({ integrationId: 'integration-1' });
    await service.previewZabbixReportGroups({
      integrationId: 'integration-1',
      groupIds: ['1'],
    });

    expect(integrationsService.getZabbixReportGroupCatalog).toHaveBeenCalledWith(
      'integration-1',
    );
    expect(integrationsService.previewZabbixReportGroupSelection).toHaveBeenCalledWith(
      'integration-1',
      ['1'],
      [activeUnit()],
    );
  });

  it('throws not found for missing report export runs and maps attachments for existing runs', async () => {
    const existingRun = {
      id: 'run-1',
      status: 'success',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: new Date('2026-01-01T00:01:00.000Z'),
      hitsCount: 1,
      createdCount: 1,
      updatedCount: 0,
      summary: 'ok',
      errorMessage: null,
      rule: {
        id: 'rule-1',
        code: 'RULE-1',
        name: 'Rule 1',
        reportTemplate: null,
      },
    };
    const { service } = buildService();

    await expect(service.getReportExportRun('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const { service: existingService } = buildService({
      automationRun: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(existingRun),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      documentAttachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attachment-1',
            name: 'relatorio.pdf',
            mimeType: 'application/pdf',
            size: 123,
            source: 'upload',
            createdAt: new Date('2026-01-01T00:02:00.000Z'),
          },
        ]),
      },
    });

    await expect(existingService.getReportExportRun('run-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'run-1',
        attachments: [
          expect.objectContaining({
            id: 'attachment-1',
            url: '/api/attachments/attachment-1/download',
          }),
        ],
      }),
    );
  });

  it('exports PRTG style reports through the export service', async () => {
    const { service, integrationsService, reportExportService } = buildService();

    await expect(
      service.exportPrtgStyleReports({
        unitIds: [],
        format: 'pdf',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    const artifact = await service.exportPrtgStyleReports({
      unitIds: [' unit-1 ', 'unit-1'],
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      format: 'pdf',
      includeCharts: false,
      reportStyle: 'technical',
      title: 'Relatório',
    });

    expect(integrationsService.getZabbixPrtgStyleReport).toHaveBeenCalledWith(
      activeUnit(),
      {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-01-02T00:00:00.000Z'),
      },
    );
    expect(reportExportService.exportReports).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          unit: expect.objectContaining({
            id: 'unit-1',
            reportContractLabel: 'Contrato 1',
            reportAddressLine: 'Rua 1',
            reportContractedBandwidth: '200 Mbps',
            reportNotes: 'Observação',
          }),
        }),
      ],
      expect.objectContaining({
        format: 'pdf',
        includeCharts: false,
        reportStyle: 'technical',
        title: 'Relatório',
      }),
    );
    expect(artifact).toEqual(
      expect.objectContaining({
        fileName: 'relatorio.pdf',
        mimeType: 'application/pdf',
      }),
    );
  });
});
