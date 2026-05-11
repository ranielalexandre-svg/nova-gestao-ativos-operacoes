import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertContractBillingDto } from './dto/contract-billing.dto';
import { CreateContractContactDto } from './dto/contract-contact.dto';
import { CreateContractServiceDto } from './dto/contract-service.dto';
import { CreateContractUnitDto } from './dto/contract-unit.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const contractListSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  type: true,
  source: true,
  sourceContractLabel: true,
  startsAt: true,
  endsAt: true,
  signedAt: true,
  monthlyValueCents: true,
  paymentMethod: true,
  billingCycle: true,
  adjustmentIndex: true,
  renewalMode: true,
  loyaltyMonths: true,
  terminationPenalty: true,
  slaPercent: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  partner: {
    select: { id: true, code: true, name: true },
  },
  units: {
    orderBy: [{ status: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }],
    take: 10,
    select: {
      id: true,
      role: true,
      status: true,
      addressLine: true,
      bandwidthLabel: true,
      bandwidthMbps: true,
      notes: true,
      unit: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          isActive: true,
        },
      },
    },
  },
  services: {
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 8,
    select: {
      id: true,
      name: true,
      description: true,
      serviceType: true,
      status: true,
      sortOrder: true,
    },
  },
  billings: {
    orderBy: [{ referenceMonth: 'desc' }],
    take: 3,
    select: {
      id: true,
      referenceMonth: true,
      amountCents: true,
      status: true,
      dueDate: true,
      paidAt: true,
      notes: true,
    },
  },
  contacts: {
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    take: 5,
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      phone: true,
      isPrimary: true,
    },
  },
  _count: {
    select: {
      units: true,
      services: true,
      billings: true,
      contacts: true,
    },
  },
} satisfies Prisma.ContractSelect;

const contractDetailSelect = {
  ...contractListSelect,
  units: {
    orderBy: [{ status: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      status: true,
      addressLine: true,
      bandwidthLabel: true,
      bandwidthMbps: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      unit: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          isActive: true,
          partnerId: true,
        },
      },
    },
  },
  services: {
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      serviceType: true,
      status: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  billings: {
    orderBy: [{ referenceMonth: 'desc' }],
    select: {
      id: true,
      referenceMonth: true,
      amountCents: true,
      status: true,
      dueDate: true,
      paidAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  contacts: {
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      phone: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ContractSelect;

type ContractListRecord = Prisma.ContractGetPayload<{
  select: typeof contractListSelect;
}>;
type ContractDetailRecord = Prisma.ContractGetPayload<{
  select: typeof contractDetailSelect;
}>;
type ContractRecord = ContractListRecord | ContractDetailRecord;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async listContracts(query: ListContractsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sortBy, sortDir);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        select: contractListSelect,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapContract(item)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasPrev: page > 1,
        hasNext: skip + items.length < total,
      },
    };
  }

  async getContractById(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: contractDetailSelect,
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    return this.mapContract(contract);
  }

  async createContract(payload: CreateContractDto) {
    const partnerId = payload.partnerId.trim();
    await this.assertPartnerExists(partnerId);

    const code = payload.code.trim();
    const existing = await this.prisma.contract.findUnique({
      where: { partnerId_code: { partnerId, code } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Contrato já existe para este parceiro');
    }

    const units = this.normalizeUnitPayloads(payload.units || []);
    if (units.length) {
      await this.assertUnitsBelongToPartner(partnerId, units);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: this.toCreateData({ ...payload, partnerId, code }),
        select: { id: true },
      });

      if (units.length) {
        await tx.contractUnit.createMany({
          data: units.map((unit) => this.toContractUnitData(contract.id, unit)),
          skipDuplicates: true,
        });
      }

      return contract;
    });

    return this.getContractById(created.id);
  }

  async updateContract(id: string, payload: UpdateContractDto) {
    await this.assertContractExists(id);

    const updated = await this.prisma.contract.update({
      where: { id },
      data: this.toUpdateData(payload),
      select: { id: true },
    });

    return this.getContractById(updated.id);
  }

  async addContractUnits(id: string, payload: CreateContractUnitDto[]) {
    const contract = await this.getContractHeader(id);
    const units = this.normalizeUnitPayloads(payload);

    if (!units.length) {
      throw new BadRequestException('Informe ao menos uma unidade');
    }

    await this.assertUnitsBelongToPartner(contract.partnerId, units);

    await this.prisma.contractUnit.createMany({
      data: units.map((unit) => this.toContractUnitData(id, unit)),
      skipDuplicates: true,
    });

    return this.getContractById(id);
  }

  async removeContractUnit(id: string, unitId: string) {
    await this.assertContractExists(id);

    await this.prisma.contractUnit.deleteMany({
      where: { contractId: id, unitId },
    });

    return this.getContractById(id);
  }

  async createContractService(id: string, payload: CreateContractServiceDto) {
    await this.assertContractExists(id);

    await this.prisma.contractService.create({
      data: {
        contractId: id,
        name: payload.name.trim(),
        description: this.nullable(payload.description),
        serviceType: this.nullable(payload.serviceType),
        status: payload.status || 'active',
        sortOrder: payload.sortOrder ?? 0,
      },
    });

    return this.getContractById(id);
  }

  async upsertContractBilling(id: string, payload: UpsertContractBillingDto) {
    await this.assertContractExists(id);

    await this.prisma.contractBilling.upsert({
      where: {
        contractId_referenceMonth: {
          contractId: id,
          referenceMonth: payload.referenceMonth,
        },
      },
      create: {
        contractId: id,
        referenceMonth: payload.referenceMonth,
        amountCents: payload.amountCents,
        status: payload.status || 'open',
        dueDate: this.toDate(payload.dueDate),
        paidAt: this.toDate(payload.paidAt),
        notes: this.nullable(payload.notes),
      },
      update: {
        amountCents: payload.amountCents,
        status: payload.status,
        dueDate: this.toDate(payload.dueDate),
        paidAt: this.toDate(payload.paidAt),
        notes: this.nullable(payload.notes),
      },
    });

    return this.getContractById(id);
  }

  async createContractContact(id: string, payload: CreateContractContactDto) {
    await this.assertContractExists(id);

    await this.prisma.$transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx.contractContact.updateMany({
          where: { contractId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.contractContact.create({
        data: {
          contractId: id,
          name: payload.name.trim(),
          role: this.nullable(payload.role),
          email: this.nullable(payload.email),
          phone: this.nullable(payload.phone),
          isPrimary: payload.isPrimary ?? false,
        },
      });
    });

    return this.getContractById(id);
  }

  private buildWhere(query: ListContractsQueryDto): Prisma.ContractWhereInput {
    const where: Prisma.ContractWhereInput = {};

    if (query.partnerId?.trim()) {
      where.partnerId = query.partnerId.trim();
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { sourceContractLabel: { contains: q, mode: 'insensitive' } },
        { partner: { is: { code: { contains: q, mode: 'insensitive' } } } },
        { partner: { is: { name: { contains: q, mode: 'insensitive' } } } },
        {
          units: {
            some: { unit: { code: { contains: q, mode: 'insensitive' } } },
          },
        },
        {
          units: {
            some: { unit: { name: { contains: q, mode: 'insensitive' } } },
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sortBy: ListContractsQueryDto['sortBy'],
    sortDir: Prisma.SortOrder,
  ): Prisma.ContractOrderByWithRelationInput {
    switch (sortBy) {
      case 'code':
        return { code: sortDir };
      case 'startsAt':
        return { startsAt: sortDir };
      case 'endsAt':
        return { endsAt: sortDir };
      case 'status':
        return { status: sortDir };
      default:
        return { createdAt: sortDir };
    }
  }

  private mapContract(contract: ContractRecord) {
    let totalBandwidthMbps = 0;
    for (const item of contract.units) {
      totalBandwidthMbps += item.bandwidthMbps || 0;
    }

    return {
      ...contract,
      unitCount: contract._count.units,
      serviceCount: contract._count.services,
      billingCount: contract._count.billings,
      contactCount: contract._count.contacts,
      totalBandwidthMbps,
      primaryContact:
        contract.contacts.find((contact) => contact.isPrimary) ||
        contract.contacts[0] ||
        null,
      latestBilling: contract.billings[0] || null,
    };
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });

    if (!partner) {
      throw new NotFoundException('Parceiro não encontrado');
    }
  }

  private async assertContractExists(id: string) {
    await this.getContractHeader(id);
  }

  private async getContractHeader(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true, partnerId: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    return contract;
  }

  private async assertUnitsBelongToPartner(
    partnerId: string,
    units: CreateContractUnitDto[],
  ) {
    const unitIds = [...new Set(units.map((unit) => unit.unitId.trim()))];
    const existingUnits = await this.prisma.unit.findMany({
      where: { id: { in: unitIds }, partnerId },
      select: { id: true, partnerId: true },
    });

    if (existingUnits.length !== unitIds.length) {
      throw new BadRequestException(
        'Todas as unidades do contrato devem pertencer ao parceiro',
      );
    }
  }

  private normalizeUnitPayloads(units: CreateContractUnitDto[]) {
    const byUnitId = new Map<string, CreateContractUnitDto>();

    for (const unit of units) {
      const unitId = unit.unitId?.trim();
      if (!unitId) {
        throw new BadRequestException('Unidade inválida');
      }
      byUnitId.set(unitId, { ...unit, unitId });
    }

    return [...byUnitId.values()];
  }

  private toCreateData(
    payload: CreateContractDto,
  ): Prisma.ContractUncheckedCreateInput {
    return {
      code: payload.code.trim(),
      partnerId: payload.partnerId.trim(),
      title: this.nullable(payload.title),
      status: payload.status || 'active',
      type: this.nullable(payload.type) || 'corporate',
      startsAt: this.toDate(payload.startsAt),
      endsAt: this.toDate(payload.endsAt),
      signedAt: this.toDate(payload.signedAt),
      monthlyValueCents: payload.monthlyValueCents,
      paymentMethod: this.nullable(payload.paymentMethod),
      billingCycle: this.nullable(payload.billingCycle),
      adjustmentIndex: this.nullable(payload.adjustmentIndex),
      renewalMode: this.nullable(payload.renewalMode),
      loyaltyMonths: payload.loyaltyMonths,
      terminationPenalty: this.nullable(payload.terminationPenalty),
      slaPercent: payload.slaPercent,
      notes: this.nullable(payload.notes),
    };
  }

  private toUpdateData(
    payload: UpdateContractDto,
  ): Prisma.ContractUncheckedUpdateInput {
    return {
      code: payload.code?.trim(),
      title: this.nullable(payload.title),
      status: payload.status,
      type: this.clean(payload.type),
      startsAt: this.toDate(payload.startsAt),
      endsAt: this.toDate(payload.endsAt),
      signedAt: this.toDate(payload.signedAt),
      monthlyValueCents: payload.monthlyValueCents,
      paymentMethod: this.nullable(payload.paymentMethod),
      billingCycle: this.nullable(payload.billingCycle),
      adjustmentIndex: this.nullable(payload.adjustmentIndex),
      renewalMode: this.nullable(payload.renewalMode),
      loyaltyMonths: payload.loyaltyMonths,
      terminationPenalty: this.nullable(payload.terminationPenalty),
      slaPercent: payload.slaPercent,
      notes: this.nullable(payload.notes),
    };
  }

  private toContractUnitData(
    contractId: string,
    payload: CreateContractUnitDto,
  ) {
    return {
      contractId,
      unitId: payload.unitId.trim(),
      role: payload.role || 'covered',
      status: payload.status || 'active',
      addressLine: this.nullable(payload.addressLine),
      bandwidthLabel: this.nullable(payload.bandwidthLabel),
      bandwidthMbps: payload.bandwidthMbps,
      notes: this.nullable(payload.notes),
    };
  }

  private nullable(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private clean(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }
}
