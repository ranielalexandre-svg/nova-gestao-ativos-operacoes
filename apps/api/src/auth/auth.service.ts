import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
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

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

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
    const id = String(user.sub || '');

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

  logout(user?: Record<string, unknown>) {
    const userId = String(user?.sub || '');

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
}
