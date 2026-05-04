import { ServiceUnavailableException } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { HealthController } from './health.controller';

describe('HealthController', () => {
  const originalEnv = process.env;
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nova-health-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
      INTEGRATION_SECRET_KEY: 'y'.repeat(32),
      NOVA_UPLOAD_DIR: uploadDir,
    };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('returns structured readiness checks when dependencies are available', async () => {
    const controller = new HealthController({
      $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    } as never);

    const result = await controller.getReadiness();

    expect(result.ok).toBe(true);
    expect(result.database).toBe('ok');
    expect(result.checks.map((check) => check.name)).toEqual([
      'database',
      'uploadDir',
      'JWT_SECRET',
      'INTEGRATION_SECRET_KEY',
    ]);
    expect(result.summary.failed).toBe(0);
  });

  it('fails readiness when the database check fails', async () => {
    const controller = new HealthController({
      $queryRaw: jest.fn().mockRejectedValue(new Error('offline')),
    } as never);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
