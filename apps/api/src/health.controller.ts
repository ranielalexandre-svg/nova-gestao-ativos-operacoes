import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isProduction } from './common/env';
import { PrismaService } from './prisma/prisma.service';

type ReadinessCheck = {
  name: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  required: boolean;
};

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
    const checks = [
      await this.getDatabaseCheck(),
      await this.getUploadDirectoryCheck(),
      this.getSecretCheck('JWT_SECRET'),
      this.getSecretCheck('INTEGRATION_SECRET_KEY'),
    ];
    const failed = checks.filter((check) => check.status === 'error');
    const warnings = checks.filter((check) => check.status === 'warning');
    const payload = {
      ok: failed.length === 0,
      service: 'nova-api',
      database: checks.find((check) => check.name === 'database')?.status === 'ok'
        ? 'ok'
        : 'unavailable',
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        passed: checks.filter((check) => check.status === 'ok').length,
        warnings: warnings.length,
        failed: failed.length,
      },
    };

    if (!payload.ok) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  private async getDatabaseCheck(): Promise<ReadinessCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'ok',
        detail: 'PostgreSQL respondeu ao ping.',
        required: true,
      };
    } catch {
      return {
        name: 'database',
        status: 'error',
        detail: 'PostgreSQL indisponível para a API.',
        required: true,
      };
    }
  }

  private async getUploadDirectoryCheck(): Promise<ReadinessCheck> {
    const uploadDir = resolve(process.cwd(), process.env.NOVA_UPLOAD_DIR || 'uploads');

    try {
      await mkdir(uploadDir, { recursive: true });
      await access(uploadDir, constants.W_OK);

      return {
        name: 'uploadDir',
        status: 'ok',
        detail: 'Diretório de anexos gravável.',
        required: true,
      };
    } catch {
      return {
        name: 'uploadDir',
        status: 'error',
        detail: 'Diretório de anexos sem permissão de escrita.',
        required: true,
      };
    }
  }

  private getSecretCheck(name: 'JWT_SECRET' | 'INTEGRATION_SECRET_KEY'): ReadinessCheck {
    const value = String(process.env[name] || '').trim();
    const production = isProduction();

    if (!value) {
      return {
        name,
        status: production ? 'error' : 'warning',
        detail: production
          ? 'Variável obrigatória ausente em produção.'
          : 'Usando fallback local de desenvolvimento.',
        required: production,
      };
    }

    if (value.length < 32) {
      return {
        name,
        status: production ? 'error' : 'warning',
        detail: 'Valor configurado com menos de 32 caracteres.',
        required: production,
      };
    }

    return {
      name,
      status: 'ok',
      detail: 'Configurado.',
      required: true,
    };
  }
}
