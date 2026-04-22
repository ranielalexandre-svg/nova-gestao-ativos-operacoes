import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationsSettings() {
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        code: true,
        name: true,
        type: true,
        baseUrl: true,
        apiPath: true,
      },
    });

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

    return {
      zabbixBaseUrl: zabbix?.baseUrl || '',
      zabbixHostTemplate: zabbix?.apiPath || '',
      grafanaBaseUrl: grafana?.baseUrl || '',
      grafanaUnitTemplate: grafana?.apiPath || '',
      grafanaEquipmentTemplate: grafana?.apiPath || '',
      monitoringRefreshSeconds: 60,
      integrations,
    };
  }
}
