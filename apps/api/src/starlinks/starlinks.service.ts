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

    return items.map((item) => ({
      id: item.id,
      type: item.type,
      manufacturer: 'Starlink',
      model: item.name,
      technology: 'satellite',
      assetTag: item.tag,
      serial: item.serialNumber,
      unitId: item.unit.id,
      partnerId: item.unit.partner.id,
      status: item.isActive ? item.status : 'retired',
      criticality: 'Média',
      installedAt: null,
      createdAt: item.createdAt,
      city: item.unit.city,
      unitName: item.unit.name,
      partnerName: item.unit.partner.name,
      documents: [],
    }));
  }
}
