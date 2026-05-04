import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StarlinksService {
  constructor(private readonly prisma: PrismaService) {}

  async listStarlinks() {
    const items = await this.prisma.equipment.findMany({
      where: {
        OR: [
          { type: { contains: 'starlink', mode: 'insensitive' } },
          { name: { contains: 'starlink', mode: 'insensitive' } },
          { tag: { contains: 'starlink', mode: 'insensitive' } },
        ],
      },
      orderBy: { tag: 'asc' },
      select: {
        id: true,
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            partner: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    const attachmentCounts = items.length
      ? await this.prisma.documentAttachment.groupBy({
          by: ['entityId'],
          where: {
            entityType: 'equipment',
            entityId: { in: items.map((item) => item.id) },
          },
          _count: { _all: true },
        })
      : [];
    const attachmentsByEquipmentId = new Map(
      attachmentCounts.map((item) => [item.entityId, item._count._all]),
    );

    return items.map((item) => ({
      id: item.id,
      type: item.type,
      manufacturer: item.name.toLowerCase().includes('starlink')
        ? 'Starlink'
        : null,
      model: item.name,
      technology: item.type,
      assetTag: item.tag,
      serial: item.serialNumber,
      unitId: item.unit.id,
      unitCode: item.unit.code,
      partnerId: item.unit.partner.id,
      partnerCode: item.unit.partner.code,
      status: item.isActive ? item.status : 'retired',
      inventoryStatus: item.isActive ? 'active' : 'inactive',
      createdAt: item.createdAt,
      city: item.unit.city,
      state: item.unit.state,
      unitName: item.unit.name,
      partnerName: item.unit.partner.name,
      documentsCount: attachmentsByEquipmentId.get(item.id) || 0,
    }));
  }
}
