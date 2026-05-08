import { ForbiddenException } from "@nestjs/common";
import { AutomationsController } from "../automations/automations.controller";
import { ImportExportController } from "../import-export/import-export.controller";
import { MonitoringController } from "../monitoring/monitoring.controller";

jest.mock("../automations/automations.service", () => ({
  AutomationsService: class AutomationsService {},
}));
jest.mock("../import-export/import-export.service", () => ({
  ImportExportService: class ImportExportService {},
}));
jest.mock("../monitoring/monitoring.service", () => ({
  MonitoringService: class MonitoringService {},
}));
jest.mock("./settings.service", () => ({
  SettingsService: class SettingsService {},
}));

describe("feature flag enforcement", () => {
  it("blocks CSV preview and execution when CSV import is disabled", () => {
    const controller = new ImportExportController(
      {
        preview: jest.fn(),
        execute: jest.fn(),
        template: jest.fn(),
        export: jest.fn(),
      } as never,
      { isCsvImportEnabled: () => false } as never,
    );

    expect(() => controller.preview("units", { csv: "code,name\n" })).toThrow(
      ForbiddenException,
    );
    expect(() => controller.execute("units", { csv: "code,name\n" })).toThrow(
      ForbiddenException,
    );
  });

  it("blocks automation mutations when automation is disabled", () => {
    const controller = new AutomationsController(
      {
        createAutomationRule: jest.fn(),
        updateAutomationRule: jest.fn(),
      } as never,
      { isAutomationEnabled: () => false } as never,
    );

    expect(() => controller.createAutomationRule({} as never)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.updateAutomationRule("rule-1", {} as never)).toThrow(
      ForbiddenException,
    );
  });

  it("blocks report generation and template creation when reports are disabled", () => {
    const controller = new MonitoringController(
      {
        createReportTemplate: jest.fn(),
        getPrtgStyleReport: jest.fn(),
        exportPrtgStyleReports: jest.fn(),
        enqueuePrtgStyleReportExport: jest.fn(),
      } as never,
      { areReportsEnabled: () => false } as never,
    );

    expect(() => controller.createReportTemplate({} as never)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.getPrtgStyleReport({} as never)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.enqueuePrtgStyleReportExport({} as never)).toThrow(
      ForbiddenException,
    );
  });
});
