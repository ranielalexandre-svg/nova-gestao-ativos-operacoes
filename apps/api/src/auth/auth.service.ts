import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { appendFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';

const PASSWORD_RESET_TTL_MINUTES = 30;
const PASSWORD_RESET_GENERIC_RESPONSE = { ok: true };
const PASSWORD_RESET_INVALID_MESSAGE =
  'Link expirado ou inválido. Solicite um novo.';
const JWT_EXPIRES_NORMAL = '8h';
const JWT_EXPIRES_REMEMBER = '30d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string, remember = false) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      { expiresIn: remember ? JWT_EXPIRES_REMEMBER : JWT_EXPIRES_NORMAL },
    );

    void this.prisma.activityEntry
      .create({
        data: {
          kind: 'auth',
          source: 'session',
          title: 'Login',
          description: 'Usuário autenticado no ambiente NOVA.',
          severity: 'info',
          userId: user.id,
        },
      })
      .catch(() => undefined);

    return {
      accessToken,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async getSession(user: Record<string, unknown>) {
    const id = typeof user.sub === 'string' ? user.sub : '';

    const dbUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return {
      authenticated: true,
      user: dbUser,
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return PASSWORD_RESET_GENERIC_RESPONSE;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashPasswordResetToken(token);
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    void this.prisma.activityEntry
      .create({
        data: {
          kind: 'auth',
          source: 'password-reset',
          title: 'Recuperação de senha solicitada',
          description:
            'Um link de recuperação de senha foi gerado para o usuário.',
          severity: 'info',
          userId: user.id,
        },
      })
      .catch(() => undefined);

    void this.dispatchPasswordResetLink(user.email, token).catch(
      () => undefined,
    );

    return PASSWORD_RESET_GENERIC_RESPONSE;
  }

  async resetPassword(token: string, password: string) {
    const cleanToken = token.trim();

    if (!cleanToken) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    if (password.length < 8) {
      throw new BadRequestException('Mínimo de 8 caracteres.');
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashPasswordResetToken(cleanToken) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() < Date.now() ||
      !record.user?.isActive
    ) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.activityEntry.create({
        data: {
          kind: 'auth',
          source: 'password-reset',
          title: 'Senha redefinida',
          description: 'Usuário redefiniu a senha por token de recuperação.',
          severity: 'info',
          userId: record.userId,
        },
      });
    });

    return { ok: true };
  }

  logout(user?: Record<string, unknown>) {
    const userId = typeof user?.sub === 'string' ? user.sub : '';

    if (userId) {
      void this.prisma.activityEntry
        .create({
          data: {
            kind: 'auth',
            source: 'session',
            title: 'Logout',
            description: 'Usuário encerrou a sessão no ambiente NOVA.',
            severity: 'info',
            userId,
          },
        })
        .catch(() => undefined);
    }

    return { ok: true };
  }

  private hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async dispatchPasswordResetLink(email: string, token: string) {
    const link = `${this.passwordResetBaseUrl()}/redefinir-senha?token=${token}`;
    const outboxPath = String(
      process.env.PASSWORD_RESET_OUTBOX_PATH || '',
    ).trim();
    const webhookUrl = String(
      process.env.PASSWORD_RESET_WEBHOOK_URL || '',
    ).trim();

    if (outboxPath) {
      await appendFile(
        outboxPath,
        `${JSON.stringify({ email, link, createdAt: new Date().toISOString() })}\n`,
        'utf8',
      );
    }

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, link }),
      });
    }
  }

  private passwordResetBaseUrl() {
    return String(
      process.env.FRONT_URL ||
        process.env.WEB_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3010',
    ).replace(/\/+$/, '');
  }
}
