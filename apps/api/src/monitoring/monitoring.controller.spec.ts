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

import { ForbiddenException } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';

function buildController(reportsEnabled = true) {
  const monitoringService = {
    getSummary: jest.fn().mockResolvedValue({ counts: {} }),
    getCommandCenter: jest.fn().mockResolvedValue({ metrics: {} }),
    getUnitHostTelemetry: jest.fn().mockResolvedValue({ items: [] }),
    getReportUnits: jest.fn().mockResolvedValue({ items: [] }),
    getReportGroupSources: jest.fn().mockResolvedValue([]),
    listReportTemplates: jest.fn().mockResolvedValue([]),
    listReportTemplateRuns: jest.fn().mockResolvedValue([]),
    createReportTemplate: jest.fn().mockResolvedValue({ id: 'template-1' }),
    getZabbixReportGroups: jest.fn().mockResolvedValue([]),
    previewZabbixReportGroups: jest.fn().mockResolvedValue({ matchedUnits: [] }),
    getPrtgStyleReport: jest.fn().mockResolvedValue({ unit: { id: 'unit-1' } }),
    exportPrtgStyleReports: jest.fn().mockResolvedValue({
      fileName: 'relatorio.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf'),
    }),
    enqueuePrtgStyleReportExport: jest.fn().mockResolvedValue({ id: 'run-1' }),
    getReportExportRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
  };

  const settingsService = {
    areReportsEnabled: jest.fn(() => reportsEnabled),
  };

  const response = {
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  return {
    controller: new MonitoringController(
      monitoringService as never,
      settingsService as never,
    ),
    monitoringService,
    settingsService,
    response,
  };
}

describe('MonitoringController', () => {
  it('delegates read endpoints to the service', async () => {
    const { controller, monitoringService } = buildController();

    await controller.getSummary();
    await controller.getCommandCenter();
    await controller.getUnitHostTelemetry('fast');
    await controller.getReportUnits();
    await controller.getReportSources();
    await controller.listReportTemplates();
    await controller.listReportTemplateRuns({ templateId: 'template-1' });
    await controller.getZabbixReportGroups({ integrationId: 'integration-1' });
    await controller.previewZabbixReportGroups({
      integrationId: 'integration-1',
      groupIds: ['1'],
    });
    await controller.getPrtgStyleReport({ unitId: 'unit-1' });
    await controller.getPrtgStyleReportExportJob('run-1');

    expect(monitoringService.getSummary).toHaveBeenCalledTimes(1);
    expect(monitoringService.getCommandCenter).toHaveBeenCalledTimes(1);
    expect(monitoringService.getUnitHostTelemetry).toHaveBeenCalledWith({ fast: true });
    expect(monitoringService.getReportUnits).toHaveBeenCalledTimes(1);
    expect(monitoringService.getReportGroupSources).toHaveBeenCalledTimes(1);
    expect(monitoringService.listReportTemplates).toHaveBeenCalledTimes(1);
    expect(monitoringService.listReportTemplateRuns).toHaveBeenCalledWith({
      templateId: 'template-1',
    });
    expect(monitoringService.getZabbixReportGroups).toHaveBeenCalledWith({
      integrationId: 'integration-1',
    });
    expect(monitoringService.previewZabbixReportGroups).toHaveBeenCalledWith({
      integrationId: 'integration-1',
      groupIds: ['1'],
    });
    expect(monitoringService.getPrtgStyleReport).toHaveBeenCalledWith({
      unitId: 'unit-1',
    });
    expect(monitoringService.getReportExportRun).toHaveBeenCalledWith('run-1');
  });

  it('delegates report writes and sends exported artifact headers', async () => {
    const { controller, monitoringService, settingsService, response } = buildController();
    const payload = {
      unitIds: ['unit-1'],
      format: 'pdf',
      includeCharts: true,
    };

    await controller.createReportTemplate({
      code: 'tpl-1',
      name: 'Template 1',
      sourceType: 'manual',
      unitIds: ['unit-1'],
      periodPreset: 'last_7_days',
      outputFormat: 'pdf',
      includeCharts: true,
    } as never);
    await controller.exportPrtgStyleReport(payload as never, response as never);
    await controller.enqueuePrtgStyleReportExport(payload as never);

    expect(settingsService.areReportsEnabled).toHaveBeenCalledTimes(3);
    expect(monitoringService.createReportTemplate).toHaveBeenCalledTimes(1);
    expect(monitoringService.exportPrtgStyleReports).toHaveBeenCalledWith(payload);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="relatorio.pdf"',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.send).toHaveBeenCalledWith(Buffer.from('pdf'));
    expect(monitoringService.enqueuePrtgStyleReportExport).toHaveBeenCalledWith(payload);
  });

  it('blocks report write/export endpoints when reports are disabled', async () => {
    const { controller, response } = buildController(false);

    expect(() =>
      controller.createReportTemplate({
        code: 'tpl-1',
        name: 'Template 1',
        sourceType: 'manual',
        unitIds: ['unit-1'],
      } as never),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.getPrtgStyleReport({ unitId: 'unit-1' }),
    ).toThrow(ForbiddenException);

    await expect(
      controller.exportPrtgStyleReport(
        {
          unitIds: ['unit-1'],
          format: 'pdf',
        } as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(() =>
      controller.enqueuePrtgStyleReportExport({
        unitIds: ['unit-1'],
        format: 'pdf',
      } as never),
    ).toThrow(ForbiddenException);
  });
});
