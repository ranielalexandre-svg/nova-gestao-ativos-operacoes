import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditsService } from '../audits/audits.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditsService: AuditsService,
  ) {}

  async getDashboard() {
    const [
      units,
      partners,
      equipments,
      starlinks,
      users,
      audits,
      occurrences,
      maintenances,
      recentOccurrences,
      recentAudits,
      partnerSummary,
      groupSummary,
    ] = await Promise.all([
      this.prisma.unit.count(),
      this.prisma.partner.count(),
      this.prisma.equipment.count(),
      this.prisma.equipment.count({
        where: { type: { contains: 'starlink', mode: 'insensitive' } },
      }),
      this.prisma.user.count(),
      this.prisma.activityEntry.count(),
      this.prisma.occurrence.count(),
      this.prisma.maintenance.count(),
      this.prisma.occurrence.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          code: true,
          title: true,
          severity: true,
          status: true,
          createdAt: true,
        },
      }),
      this.auditsService.listAudits(8),
      this.prisma.partner.findMany({
        orderBy: { name: 'asc' },
        take: 100,
        select: { id: true, name: true, _count: { select: { units: true } } },
      }),
      this.prisma.unit.groupBy({
        by: ['state'],
        _count: { _all: true },
        orderBy: { state: 'asc' },
      }),
    ]);

    const openOccurrences = await this.prisma.occurrence.count({
      where: { status: { notIn: ['closed', 'fechada', 'resolved'] } },
    });
    const pendingMaintenances = await this.prisma.maintenance.count({
      where: {
        status: { notIn: ['completed', 'concluida', 'concluída', 'closed'] },
      },
    });

    return {
      stats: {
        units,
        partners,
        equipments,
        starlinks,
        users,
        audits,
        occurrences,
        maintenances,
        online: units,
        deployment: 0,
        incompleteAssets: 0,
        pendingMaintenances,
        criticalMonitoring: openOccurrences,
      },
      groupSummary: groupSummary.map((item) => ({
        group: item.state || 'Sem UF',
        total: item._count._all,
      })),
      partnerSummary: partnerSummary.map((item) => ({
        id: item.id,
        name: item.name,
        units: item._count.units,
        equipments: 0,
      })),
      recentAudits,
      recentOccurrences,
    };
  }
}
