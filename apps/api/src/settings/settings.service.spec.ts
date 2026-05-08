jest.mock("../prisma/prisma.service", () => ({
  PrismaService: class PrismaService {},
}));

import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      JWT_SECRET: "j".repeat(32),
      INTEGRATION_SECRET_KEY: "i".repeat(32),
      INTEGRATION_ALLOWED_HOSTS: "zabbix.local,grafana.local",
      INTEGRATION_REQUEST_TIMEOUT_MS: "15000",
      NOVA_ENABLE_AUTOMATION: "false",
      NOVA_ENABLE_ZABBIX_SYNC: "true",
      NOVA_ENABLE_CSV_IMPORT: "true",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildService() {
    const prisma = {
      integration: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: "ZBX",
            name: "Zabbix principal",
            type: "zabbix",
            baseUrl: "https://zabbix.local",
            apiPath: "/api_jsonrpc.php",
          },
          {
            code: "GRAF",
            name: "Grafana",
            type: "grafana",
            baseUrl: "https://grafana.local",
            apiPath: "/d/unit",
          },
        ]),
      },
      automationRule: {
        count: jest.fn().mockResolvedValue(2),
      },
      monitoringReportTemplate: {
        count: jest.fn().mockResolvedValue(3),
      },
    };

    return {
      service: new SettingsService(prisma as never),
      prisma,
    };
  }

  it("returns a safe operational settings snapshot", async () => {
    const { service } = buildService();

    const result = await service.getIntegrationsSettings();

    expect(result.environment).toBe("production");
    expect(result.enableAutomation).toBe(false);
    expect(result.enableZabbixSync).toBe(true);
    expect(result.zabbixBaseUrl).toBe("https://zabbix.local");
    expect(result.grafanaBaseUrl).toBe("https://grafana.local");
    expect(result.runtime.integrationAllowedHosts).toEqual([
      "zabbix.local",
      "grafana.local",
    ]);
    expect(result.runtime.integrationRequestTimeoutMs).toBe(15000);
    expect(result.secrets).toEqual({
      jwtSecret: "configured",
      integrationSecretKey: "configured",
    });
    expect(result.counts).toMatchObject({
      activeIntegrations: 2,
      activeAutomationRules: 2,
      enabledReportTemplates: 3,
    });
    expect(result.flags.map((flag) => flag.key)).toEqual([
      "allowDestructiveActions",
      "enableAutomation",
      "enableZabbixSync",
      "enableReports",
      "enableCsvImport",
    ]);
  });

  it("marks Zabbix sync inactive when no active Zabbix connector exists", async () => {
    const { service, prisma } = buildService();
    prisma.integration.findMany.mockResolvedValueOnce([]);

    const result = await service.getIntegrationsSettings();

    expect(result.enableZabbixSync).toBe(false);
    expect(result.flags.find((flag) => flag.key === "enableZabbixSync")).toMatchObject({
      enabled: false,
      source: "sem conector Zabbix ativo",
    });
  });
});
