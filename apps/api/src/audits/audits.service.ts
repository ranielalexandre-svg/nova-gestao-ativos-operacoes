import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function targetFrom(item: {
  partner?: { id: string; name: string; code: string } | null;
  unit?: { id: string; name: string; code: string } | null;
  equipment?: { id: string; name: string; tag: string } | null;
  integration?: { id: string; name: string; code: string } | null;
  occurrence?: { id: string; title: string; code: string } | null;
  maintenance?: { id: string; title: string; code: string } | null;
  exceptionCase?: { id: string; title: string; code: string } | null;
  automation?: { id: string; name: string; code: string } | null;
}) {
  if (item.partner)
    return {
      targetType: 'partner',
      targetId: item.partner.id,
      targetLabel: item.partner.name || item.partner.code,
    };
  if (item.unit)
    return {
      targetType: 'unit',
      targetId: item.unit.id,
      targetLabel: item.unit.name || item.unit.code,
    };
  if (item.equipment)
    return {
      targetType: 'equipment',
      targetId: item.equipment.id,
      targetLabel: item.equipment.name || item.equipment.tag,
    };
  if (item.integration)
    return {
      targetType: 'integration',
      targetId: item.integration.id,
      targetLabel: item.integration.name || item.integration.code,
    };
  if (item.occurrence)
    return {
      targetType: 'occurrence',
      targetId: item.occurrence.id,
      targetLabel: item.occurrence.title || item.occurrence.code,
    };
  if (item.maintenance)
    return {
      targetType: 'maintenance',
      targetId: item.maintenance.id,
      targetLabel: item.maintenance.title || item.maintenance.code,
    };
  if (item.exceptionCase)
    return {
      targetType: 'exception',
      targetId: item.exceptionCase.id,
      targetLabel: item.exceptionCase.title || item.exceptionCase.code,
    };
  if (item.automation)
    return {
      targetType: 'automation',
      targetId: item.automation.id,
      targetLabel: item.automation.name || item.automation.code,
    };
  return { targetType: 'system', targetId: null, targetLabel: 'NOVA' };
}

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAudits(limitInput?: string | number) {
    const limit = Math.min(Math.max(Number(limitInput || 100) || 100, 1), 500);
    const items = await this.prisma.activityEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        kind: true,
        source: true,
        title: true,
        description: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        partner: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
        equipment: { select: { id: true, tag: true, name: true } },
        integration: { select: { id: true, code: true, name: true } },
        occurrence: { select: { id: true, code: true, title: true } },
        maintenance: { select: { id: true, code: true, title: true } },
        exceptionCase: { select: { id: true, code: true, title: true } },
        automation: { select: { id: true, code: true, name: true } },
      },
    });

    return items.map((item) => ({
      id: item.id,
      at: item.createdAt,
      actorUserId: item.actor?.id || null,
      actorName: item.actor?.name || item.actor?.email || 'Sistema',
      action: item.title || item.kind,
      ...targetFrom(item),
      details: item.description || `${item.kind} via ${item.source}`,
    }));
  }
}
