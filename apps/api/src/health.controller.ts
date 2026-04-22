import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    return {
      ok: true,
      service: 'nova-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        service: 'nova-api',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'nova-api',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
