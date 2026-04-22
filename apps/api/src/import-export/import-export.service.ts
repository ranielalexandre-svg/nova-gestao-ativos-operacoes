import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv, toCsv } from './csv';

type Resource = 'partners' | 'units' | 'equipments' | 'starlinks';

const TEMPLATES: Record<Resource, string[]> = {
  partners: ['code', 'name', 'isActive'],
  units: ['code', 'name', 'city', 'state', 'partnerCode', 'isActive'],
  equipments: [
    'tag',
    'name',
    'type',
    'serialNumber',
    'status',
    'unitCode',
    'isActive',
  ],
  starlinks: ['tag', 'name', 'serialNumber', 'status', 'unitCode', 'isActive'],
};

@Injectable()
export class ImportExportService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeResource(input: string): Resource {
    const resource = String(input || '')
      .trim()
      .toLowerCase();
    if (
      resource === 'partners' ||
      resource === 'units' ||
      resource === 'equipments' ||
      resource === 'starlinks'
    )
      return resource;
    throw new BadRequestException('Recurso de importação/exportação inválido.');
  }

  private bool(value: string, fallback = true) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (!normalized) return fallback;
    return ['1', 'true', 'sim', 'yes', 'ativo', 'ativa'].includes(normalized);
  }

  private required(row: Record<string, string>, field: string, line: number) {
    const value = String(row[field] || '').trim();
    if (!value)
      throw new BadRequestException(
        `Linha ${line}: campo ${field} é obrigatório.`,
      );
    return value;
  }

  template(resourceInput: string) {
    const resource = this.normalizeResource(resourceInput);
    return { resource, csv: `${TEMPLATES[resource].join(',')}\n` };
  }

  preview(resourceInput: string, csv: string) {
    const resource = this.normalizeResource(resourceInput);
    const rows = parseCsv(csv);
    const headers = TEMPLATES[resource];
    const errors: Array<{ line: number; message: string }> = [];

    const requiredByResource: Record<Resource, string[]> = {
      partners: ['code', 'name'],
      units: ['code', 'name', 'partnerCode'],
      equipments: ['tag', 'name', 'type', 'unitCode'],
      starlinks: ['tag', 'name', 'unitCode'],
    };

    rows.forEach((row, index) => {
      const line = index + 2;
      for (const header of requiredByResource[resource]) {
        if (!String(row[header] || '').trim())
          errors.push({ line, message: `Campo ${header} ausente.` });
      }
    });

    return {
      resource,
      totalRows: rows.length,
      validRows: Math.max(
        0,
        rows.length - new Set(errors.map((item) => item.line)).size,
      ),
      invalidRows: new Set(errors.map((item) => item.line)).size,
      headers,
      errors: errors.slice(0, 50),
    };
  }

  async execute(resourceInput: string, csv: string) {
    const resource = this.normalizeResource(resourceInput);
    const rows = parseCsv(csv);
    let created = 0;
    let updated = 0;

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      if (resource === 'partners') {
        const code = this.required(row, 'code', line).toUpperCase();
        const name = this.required(row, 'name', line);
        const existing = await this.prisma.partner.findUnique({
          where: { code },
          select: { id: true },
        });
        await this.prisma.partner.upsert({
          where: { code },
          create: { code, name, isActive: this.bool(row.isActive) },
          update: { name, isActive: this.bool(row.isActive) },
        });
        if (existing) updated += 1;
        else created += 1;
      }

      if (resource === 'units') {
        const code = this.required(row, 'code', line).toUpperCase();
        const name = this.required(row, 'name', line);
        const partnerCode = this.required(
          row,
          'partnerCode',
          line,
        ).toUpperCase();
        const partner = await this.prisma.partner.findUnique({
          where: { code: partnerCode },
          select: { id: true },
        });
        if (!partner)
          throw new BadRequestException(
            `Linha ${line}: partnerCode não encontrado.`,
          );
        const existing = await this.prisma.unit.findUnique({
          where: { code },
          select: { id: true },
        });
        await this.prisma.unit.upsert({
          where: { code },
          create: {
            code,
            name,
            city: row.city || null,
            state: row.state?.toUpperCase() || null,
            partnerId: partner.id,
            isActive: this.bool(row.isActive),
          },
          update: {
            name,
            city: row.city || null,
            state: row.state?.toUpperCase() || null,
            partnerId: partner.id,
            isActive: this.bool(row.isActive),
          },
        });
        if (existing) updated += 1;
        else created += 1;
      }

      if (resource === 'equipments' || resource === 'starlinks') {
        const tag = this.required(row, 'tag', line).toUpperCase();
        const name = this.required(row, 'name', line);
        const unitCode = this.required(row, 'unitCode', line).toUpperCase();
        const unit = await this.prisma.unit.findUnique({
          where: { code: unitCode },
          select: { id: true },
        });
        if (!unit)
          throw new BadRequestException(
            `Linha ${line}: unitCode não encontrado.`,
          );
        const existing = await this.prisma.equipment.findUnique({
          where: { tag },
          select: { id: true },
        });
        const type =
          resource === 'starlinks'
            ? 'starlink'
            : String(row.type || 'asset')
                .trim()
                .toLowerCase();
        const status = String(row.status || 'active')
          .trim()
          .toLowerCase();
        await this.prisma.equipment.upsert({
          where: { tag },
          create: {
            tag,
            name,
            type,
            serialNumber: row.serialNumber || null,
            status,
            unitId: unit.id,
            isActive: this.bool(row.isActive),
          },
          update: {
            name,
            type,
            serialNumber: row.serialNumber || null,
            status,
            unitId: unit.id,
            isActive: this.bool(row.isActive),
          },
        });
        if (existing) updated += 1;
        else created += 1;
      }
    }

    return { resource, totalRows: rows.length, created, updated };
  }

  async export(resourceInput: string) {
    const resource = this.normalizeResource(resourceInput);

    if (resource === 'partners') {
      const rows = await this.prisma.partner.findMany({
        orderBy: { code: 'asc' },
        select: { code: true, name: true, isActive: true },
      });
      return toCsv(rows, TEMPLATES.partners);
    }

    if (resource === 'units') {
      const rows = await this.prisma.unit.findMany({
        orderBy: { code: 'asc' },
        select: {
          code: true,
          name: true,
          city: true,
          state: true,
          isActive: true,
          partner: { select: { code: true } },
        },
      });
      return toCsv(
        rows.map((row) => ({ ...row, partnerCode: row.partner.code })),
        TEMPLATES.units,
      );
    }

    const where: Prisma.EquipmentWhereInput =
      resource === 'starlinks'
        ? { type: { contains: 'starlink', mode: 'insensitive' } }
        : {};
    const rows = await this.prisma.equipment.findMany({
      orderBy: { tag: 'asc' },
      where,
      select: {
        tag: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        isActive: true,
        unit: { select: { code: true } },
      },
    });
    const headers =
      resource === 'starlinks' ? TEMPLATES.starlinks : TEMPLATES.equipments;
    return toCsv(
      rows.map((row) => ({ ...row, unitCode: row.unit.code })),
      headers,
    );
  }
}
