/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-new-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@nova.local',
        name: 'Admin NOVA',
        role: 'admin',
        passwordHash: 'old-hash',
        isActive: true,
      }),
      update: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({ token: 'reset-token' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'token-1',
        token: 'reset-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'admin@nova.local',
          isActive: true,
        },
      }),
      update: jest.fn().mockResolvedValue({ id: 'token-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    activityEntry: {
      create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
    },
    $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
      Promise.resolve(callback(prisma)),
    ),
    ...overrides,
  };

  return {
    service: new AuthService(
      prisma as never,
      new JwtService({ secret: 'test' }),
    ),
    prisma,
  };
}

describe('AuthService password recovery', () => {
  it('issues a 30 day JWT when remember is enabled', async () => {
    const { service } = buildService();

    const result = await service.login('admin@nova.local', 'Nova123456', true);
    const payload = JSON.parse(
      Buffer.from(result.accessToken.split('.')[1], 'base64url').toString(
        'utf8',
      ),
    ) as { iat: number; exp: number };

    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 30);
  });

  it('creates a 30 minute reset token for an active user without exposing the token in the response', async () => {
    const { service, prisma } = buildService();

    const result = await service.forgotPassword('Admin@NOVA.Local');

    expect(result).toEqual({ ok: true });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@nova.local' },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns ok without creating a token when the email is unknown', async () => {
    const { service, prisma } = buildService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    });

    await expect(service.forgotPassword('missing@nova.local')).resolves.toEqual(
      {
        ok: true,
      },
    );
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('hashes the new password and marks the reset token as used', async () => {
    const { service, prisma } = buildService();

    const result = await service.resetPassword('reset-token', 'Nova123456');

    expect(result).toEqual({ ok: true });
    expect(bcrypt.hash).toHaveBeenCalledWith('Nova123456', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'hashed-new-password' },
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('rejects expired tokens', async () => {
    const { service } = buildService({
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'token-1',
          token: 'reset-token',
          userId: 'user-1',
          expiresAt: new Date(Date.now() - 1),
          usedAt: null,
          user: {
            id: 'user-1',
            email: 'admin@nova.local',
            isActive: true,
          },
        }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    });

    await expect(
      service.resetPassword('reset-token', 'Nova123456'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
