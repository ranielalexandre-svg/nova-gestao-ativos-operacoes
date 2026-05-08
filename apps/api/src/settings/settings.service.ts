import { Injectable } from '@nestjs/common';
import { readCsvEnv } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationsSettings() {
    const [integrations, activeAutomationRules, enabledReportTemplates] =
      await Promise.all([
        this.prisma.integration.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: {
            code: true,
            name: true,
            type: true,
            baseUrl: true,
            apiPath: true,
          },
        }),
        this.prisma.automationRule.count({ where: { enabled: true } }),
        this.prisma.monitoringReportTemplate.count({ where: { enabled: true } }),
      ]);

    const zabbix = integrations.find(
      (item) =>
        item.type.toLowerCase().includes('zabbix') ||
        item.code.toLowerCase().includes('zabbix'),
    );
    const grafana = integrations.find(
      (item) =>
        item.type.toLowerCase().includes('grafana') ||
        item.code.toLowerCase().includes('grafana'),
    );
    const allowedHosts = readCsvEnv('INTEGRATION_ALLOWED_HOSTS');
    const allowDestructiveActions = this.readBooleanEnv(
      'NOVA_ALLOW_DESTRUCTIVE_ACTIONS',
      false,
    );
    const enableAutomation = this.readBooleanEnv('NOVA_ENABLE_AUTOMATION', true);
    const enableZabbixSync =
      this.readBooleanEnv('NOVA_ENABLE_ZABBIX_SYNC', true) && Boolean(zabbix);
    const enableReports = this.readBooleanEnv('NOVA_ENABLE_REPORTS', true);
    const enableCsvImport = this.readBooleanEnv('NOVA_ENABLE_CSV_IMPORT', true);

    return {
      apiBaseUrl: process.env.API_BASE_URL || '',
      environment:
        process.env.NOVA_ENVIRONMENT || process.env.NODE_ENV || 'development',
      allowDestructiveActions,
      enableAutomation,
      enableZabbixSync,
      enableReports,
      enableCsvImport,
      zabbixBaseUrl: zabbix?.baseUrl || '',
      zabbixHostTemplate: zabbix?.apiPath || '',
      grafanaBaseUrl: grafana?.baseUrl || '',
      grafanaUnitTemplate: grafana?.apiPath || '',
      grafanaEquipmentTemplate: grafana?.apiPath || '',
      monitoringRefreshSeconds: 60,
      runtime: {
        uploadDir: process.env.NOVA_UPLOAD_DIR || 'uploads',
        importedDataPathConfigured: Boolean(process.env.NOVA_LEGACY_IMPORT_PATH),
        integrationAllowedHosts: allowedHosts,
        integrationRequestTimeoutMs: this.readNumberEnv(
          'INTEGRATION_REQUEST_TIMEOUT_MS',
          30000,
          1000,
          60000,
        ),
        zabbixTelemetryCacheMs: this.readNumberEnv(
          'NOVA_ZABBIX_TELEMETRY_CACHE_MS',
          45000,
          0,
          600000,
        ),
        zabbixReportCacheMs: this.readNumberEnv(
          'NOVA_ZABBIX_REPORT_CACHE_MS',
          180000,
          0,
          1800000,
        ),
      },
      secrets: {
        jwtSecret: this.secretStatus('JWT_SECRET'),
        integrationSecretKey: this.secretStatus('INTEGRATION_SECRET_KEY'),
      },
      counts: {
        activeIntegrations: integrations.length,
        zabbixIntegrations: zabbix ? 1 : 0,
        grafanaIntegrations: grafana ? 1 : 0,
        activeAutomationRules,
        enabledReportTemplates,
      },
      flags: [
        {
          key: 'allowDestructiveActions',
          label: 'Ações destrutivas',
          enabled: allowDestructiveActions,
          source: this.envSource('NOVA_ALLOW_DESTRUCTIVE_ACTIONS'),
          description: 'operações que podem apagar ou sobrescrever dados',
        },
        {
          key: 'enableAutomation',
          label: 'Automação',
          enabled: enableAutomation,
          source: this.envSource('NOVA_ENABLE_AUTOMATION'),
          description: 'detectores, regras e abertura automática de casos',
        },
        {
          key: 'enableZabbixSync',
          label: 'Sync Zabbix',
          enabled: enableZabbixSync,
          source: zabbix
            ? this.envSource('NOVA_ENABLE_ZABBIX_SYNC')
            : 'sem conector Zabbix ativo',
          description: 'escrita controlada em hosts reconciliados',
        },
        {
          key: 'enableReports',
          label: 'Relatórios',
          enabled: enableReports,
          source: this.envSource('NOVA_ENABLE_REPORTS'),
          description: 'exportação operacional e relatórios de consumo',
        },
        {
          key: 'enableCsvImport',
          label: 'Importação CSV',
          enabled: enableCsvImport,
          source: this.envSource('NOVA_ENABLE_CSV_IMPORT'),
          description: 'preview e upsert controlado por CSV',
        },
      ],
      integrations,
    };
  }

  private readBooleanEnv(name: string, fallback: boolean) {
    const raw = process.env[name];
    if (raw === undefined) return fallback;

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;

    return fallback;
  }

  private readNumberEnv(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(process.env[name]);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(parsed, max));
  }

  private envSource(name: string) {
    return process.env[name] === undefined ? 'padrão do sistema' : `env:${name}`;
  }

  private secretStatus(name: string) {
    const value = String(process.env[name] || '').trim();

    if (!value) return 'missing';
    if (value.length < 32) return 'weak';
    return 'configured';
  }
}
