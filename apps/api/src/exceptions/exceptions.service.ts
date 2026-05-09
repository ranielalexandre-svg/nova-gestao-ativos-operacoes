import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, AutomationRule, AutomationRun, SlaPolicy } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { BulkUpdateExceptionsDto } from "./dto/bulk-update-exceptions.dto";
import { CreateExceptionCommentDto } from "./dto/create-exception-comment.dto";
import { CreateExceptionDto } from "./dto/create-exception.dto";
import { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import { ListExceptionsQueryDto } from "./dto/list-exceptions-query.dto";
import { UpdateExceptionDto } from "./dto/update-exception.dto";
import { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";

type AutomationHit = {
  fingerprint: string;
  title: string;
  description: string | null;
  kind: "integration" | "occurrence" | "maintenance" | "automation" | "sla";
  severity: string;
  integrationId?: string | null;
  partnerId?: string | null;
  unitId?: string | null;
  equipmentId?: string | null;
  occurrenceId?: string | null;
  maintenanceId?: string | null;
};

const OPEN_STATUSES = ["open", "acknowledged", "silenced"] as const;
const DUE_SOON_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  private code(prefix = "EXC") {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private parseDate(value?: string | null) {
    const normalized = String(value || "").trim();
    if (!normalized) return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException("Data inválida");
    return parsed;
  }

  private normalizeKind(value?: string | null) {
    return String(value || "generic").trim().toLowerCase() || "generic";
  }

  private normalizeSeverity(value?: string | null) {
    return String(value || "medium").trim().toLowerCase() || "medium";
  }

  private normalizeStatus(value?: string | null) {
    return String(value || "open").trim().toLowerCase() || "open";
  }

  private defaultQueueKey(kind: string) {
    if (kind === "integration") return "ops-integracoes";
    if (kind === "occurrence") return "ops-ocorrencias";
    if (kind === "maintenance") return "ops-manutencao";
    if (kind === "sla") return "ops-sla";
    if (kind === "automation") return "ops-automacoes";
    return "ops-general";
  }

  private severityWeight(severity: string) {
    if (severity === "critical") return 95;
    if (severity === "high") return 78;
    if (severity === "medium") return 55;
    return 25;
  }

  private defaultImpact(severity: string) {
    if (severity === "critical") return "critical";
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  private defaultUrgency(severity: string) {
    if (severity === "critical") return "critical";
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  private isOpenStatus(status: string) {
    return OPEN_STATUSES.includes(status as (typeof OPEN_STATUSES)[number]);
  }

  private computePriorityScore(input: {
    severity: string;
    triageStatus: string;
    assigneeUserId?: string | null;
    breachedAt?: Date | null;
  }) {
    let score = this.severityWeight(input.severity);
    if (input.triageStatus === "pending") score += 5;
    if (!input.assigneeUserId) score += 5;
    if (input.breachedAt) score += 10;
    return Math.max(0, Math.min(100, score));
  }

  private async ensureUser(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.user.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("assigneeUserId inválido");
    return normalized;
  }

  private async ensureActor(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) throw new BadRequestException("Usuário inválido");
    const item = await this.prisma.user.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("Usuário inválido");
    return normalized;
  }

  private async ensurePartner(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.partner.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("partnerId inválido");
    return normalized;
  }

  private async ensureUnit(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.unit.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("unitId inválido");
    return normalized;
  }

  private async ensureEquipment(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.equipment.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("equipmentId inválido");
    return normalized;
  }

  private async ensureIntegration(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.integration.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("integrationId inválido");
    return normalized;
  }

  private async ensureOccurrence(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.occurrence.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("occurrenceId inválido");
    return normalized;
  }

  private async ensureMaintenance(id?: string | null) {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const item = await this.prisma.maintenance.findUnique({ where: { id: normalized }, select: { id: true } });
    if (!item) throw new BadRequestException("maintenanceId inválido");
    return normalized;
  }

  private async ensureDefaultSlaPolicies() {
    const defaults = [
      {
        code: "SLA-GENERIC-LOW",
        name: "Genérico low",
        kind: "generic",
        severity: "low",
        queueKey: "ops-general",
        firstResponseMinutes: 120,
        resolveMinutes: 1440,
        isActive: true,
      },
      {
        code: "SLA-GENERIC-MEDIUM",
        name: "Genérico medium",
        kind: "generic",
        severity: "medium",
        queueKey: "ops-general",
        firstResponseMinutes: 30,
        resolveMinutes: 240,
        isActive: true,
      },
      {
        code: "SLA-GENERIC-HIGH",
        name: "Genérico high",
        kind: "generic",
        severity: "high",
        queueKey: "ops-general",
        firstResponseMinutes: 15,
        resolveMinutes: 120,
        isActive: true,
      },
      {
        code: "SLA-GENERIC-CRITICAL",
        name: "Genérico critical",
        kind: "generic",
        severity: "critical",
        queueKey: "ops-general",
        firstResponseMinutes: 5,
        resolveMinutes: 60,
        isActive: true,
      },
      {
        code: "SLA-INTEGRATION-CRITICAL",
        name: "Integração critical",
        kind: "integration",
        severity: "critical",
        queueKey: "ops-integracoes",
        firstResponseMinutes: 5,
        resolveMinutes: 30,
        isActive: true,
      },
      {
        code: "SLA-OCCURRENCE-CRITICAL",
        name: "Ocorrência critical",
        kind: "occurrence",
        severity: "critical",
        queueKey: "ops-ocorrencias",
        firstResponseMinutes: 5,
        resolveMinutes: 60,
        isActive: true,
      },
      {
        code: "SLA-MAINTENANCE-HIGH",
        name: "Manutenção high",
        kind: "maintenance",
        severity: "high",
        queueKey: "ops-manutencao",
        firstResponseMinutes: 30,
        resolveMinutes: 480,
        isActive: true,
      },
    ] as const;

    for (const item of defaults) {
      await this.prisma.slaPolicy.upsert({
        where: { code: item.code },
        update: {},
        create: item,
      });
    }
  }

  private async resolveSlaPolicy(kind: string, severity: string): Promise<SlaPolicy | null> {
    await this.ensureDefaultSlaPolicies();

    const exact = await this.prisma.slaPolicy.findFirst({
      where: { isActive: true, kind, severity },
      orderBy: { createdAt: "asc" },
    });
    if (exact) return exact;

    const genericSameSeverity = await this.prisma.slaPolicy.findFirst({
      where: { isActive: true, kind: "generic", severity },
      orderBy: { createdAt: "asc" },
    });
    if (genericSameSeverity) return genericSameSeverity;

    return this.prisma.slaPolicy.findFirst({
      where: { isActive: true, code: "SLA-GENERIC-MEDIUM" },
    });
  }

  private async buildOperationalState(input: {
    kind: string;
    severity: string;
    status: string;
    createdAt: Date;
    acknowledgedAt?: Date | null;
    resolvedAt?: Date | null;
    assigneeUserId?: string | null;
  }) {
    const kind = this.normalizeKind(input.kind);
    const severity = this.normalizeSeverity(input.severity);
    const status = this.normalizeStatus(input.status);
    const policy = await this.resolveSlaPolicy(kind, severity);
    const queueKey = policy?.queueKey || this.defaultQueueKey(kind);
    const triageStatus =
      status === "resolved"
        ? "closed"
        : input.acknowledgedAt || input.assigneeUserId
          ? "triaged"
          : "pending";

    const firstResponseMinutes = policy?.firstResponseMinutes ?? 30;
    const resolveMinutes = policy?.resolveMinutes ?? 240;
    const firstResponseDueAt = new Date(input.createdAt.getTime() + firstResponseMinutes * 60 * 1000);
    const resolveDueAt = new Date(input.createdAt.getTime() + resolveMinutes * 60 * 1000);

    const now = new Date();
    const breachedAt =
      this.isOpenStatus(status) && (
        resolveDueAt.getTime() <= now.getTime() ||
        (triageStatus === "pending" && firstResponseDueAt.getTime() <= now.getTime())
      )
        ? now
        : null;

    const priorityScore = this.computePriorityScore({
      severity,
      triageStatus,
      assigneeUserId: input.assigneeUserId || null,
      breachedAt,
    });

    return {
      slaPolicyId: policy?.id || null,
      queueKey,
      classification: kind,
      impact: this.defaultImpact(severity),
      urgency: status === "resolved" ? "low" : this.defaultUrgency(severity),
      priorityScore,
      triageStatus,
      firstResponseDueAt,
      resolveDueAt,
      breachedAt,
    };
  }

  private buildBaseWhere(query: ListExceptionsQueryDto): Prisma.ExceptionCaseWhereInput {
    const where: Prisma.ExceptionCaseWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { assignee: { is: { name: { contains: q, mode: "insensitive" } } } },
        { automation: { is: { code: { contains: q, mode: "insensitive" } } } },
        { integration: { is: { code: { contains: q, mode: "insensitive" } } } },
        { occurrence: { is: { code: { contains: q, mode: "insensitive" } } } },
        { maintenance: { is: { code: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (query.kind && query.kind !== "all") where.kind = query.kind;
    if (query.severity && query.severity !== "all") where.severity = query.severity;
    if (query.status && query.status !== "all") where.status = query.status;
    if (query.source && query.source !== "all") where.source = query.source;
    if (query.triageStatus && query.triageStatus !== "all") where.triageStatus = query.triageStatus;
    if (query.queueKey?.trim()) where.queueKey = query.queueKey.trim();
    if (query.onlyUnassigned === "true") where.assigneeUserId = null;

    const now = new Date();
    if (query.onlyBreached === "true") {
      where.status = { in: [...OPEN_STATUSES] };
      where.breachedAt = { not: null, lte: now };
    }

    if (query.onlyDueSoon === "true") {
      where.status = { in: [...OPEN_STATUSES] };
      where.resolveDueAt = {
        gte: now,
        lte: new Date(now.getTime() + DUE_SOON_WINDOW_MS),
      };
    }

    return where;
  }

  async listExceptions(query: ListExceptionsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";
    const where = this.buildBaseWhere(query);

    let orderBy: Prisma.ExceptionCaseOrderByWithRelationInput | Prisma.ExceptionCaseOrderByWithRelationInput[] = { createdAt: "desc" };
    if (query.sortBy === "severity") orderBy = { severity: sortDir };
    if (query.sortBy === "status") orderBy = { status: sortDir };
    if (query.sortBy === "priorityScore") orderBy = [{ priorityScore: sortDir }, { createdAt: "desc" }];
    if (query.sortBy === "resolveDueAt") orderBy = [{ resolveDueAt: sortDir }, { createdAt: "desc" }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.exceptionCase.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          kind: true,
          severity: true,
          status: true,
          source: true,
          queueKey: true,
          classification: true,
          impact: true,
          urgency: true,
          priorityScore: true,
          triageStatus: true,
          silencedUntil: true,
          acknowledgedAt: true,
          resolvedAt: true,
          firstResponseDueAt: true,
          resolveDueAt: true,
          breachedAt: true,
          lastActivityAt: true,
          createdAt: true,
          updatedAt: true,
          assignee: { select: { id: true, name: true, email: true, role: true } },
          automation: { select: { id: true, code: true, name: true, detector: true } },
          slaPolicy: { select: { id: true, code: true, name: true, firstResponseMinutes: true, resolveMinutes: true, queueKey: true } },
          partner: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
          equipment: { select: { id: true, tag: true, name: true } },
          integration: { select: { id: true, code: true, name: true } },
          occurrence: { select: { id: true, code: true, title: true } },
          maintenance: { select: { id: true, code: true, title: true } },
          _count: { select: { comments: true, activities: true } },
        },
      }),
      this.prisma.exceptionCase.count({ where }),
    ]);

    return {
      items,
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

  async getSummary() {
    const now = new Date();

    const [openCount, criticalCount, silencedCount, breachedCount, dueSoonCount, unassignedCount, pendingTriageCount] = await this.prisma.$transaction([
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, severity: "critical" } }),
      this.prisma.exceptionCase.count({ where: { status: "silenced", silencedUntil: { gte: now } } }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, breachedAt: { not: null, lte: now } } }),
      this.prisma.exceptionCase.count({
        where: {
          status: { in: [...OPEN_STATUSES] },
          resolveDueAt: { gte: now, lte: new Date(now.getTime() + DUE_SOON_WINDOW_MS) },
        },
      }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, assigneeUserId: null } }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, triageStatus: "pending" } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      counts: {
        openCount,
        criticalCount,
        silencedCount,
        breachedCount,
        dueSoonCount,
        unassignedCount,
        pendingTriageCount,
      },
    };
  }

  async getQueueSummary() {
    const now = new Date();

    const [queues, totalOpen, pendingTriage, breached, dueSoon, unassigned] = await this.prisma.$transaction([
      this.prisma.exceptionCase.groupBy({
        by: ["queueKey"],
        where: { status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
        orderBy: { queueKey: "asc" },
      }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, triageStatus: "pending" } }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, breachedAt: { not: null, lte: now } } }),
      this.prisma.exceptionCase.count({
        where: {
          status: { in: [...OPEN_STATUSES] },
          resolveDueAt: { gte: now, lte: new Date(now.getTime() + DUE_SOON_WINDOW_MS) },
        },
      }),
      this.prisma.exceptionCase.count({ where: { status: { in: [...OPEN_STATUSES] }, assigneeUserId: null } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      views: {
        all: totalOpen,
        pendingTriage: pendingTriage,
        breached,
        dueSoon,
        unassigned,
      },
      queues: queues.map((item) => ({
        queueKey: item.queueKey,
        total:
          item._count &&
          typeof item._count === "object" &&
          "_all" in item._count &&
          typeof item._count._all === "number"
            ? item._count._all
            : 0,
      })),
    };
  }

  async listSlaPolicies() {
    await this.ensureDefaultSlaPolicies();

    const items = await this.prisma.slaPolicy.findMany({
      orderBy: [{ queueKey: "asc" }, { kind: "asc" }, { severity: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        severity: true,
        queueKey: true,
        firstResponseMinutes: true,
        resolveMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { exceptionCases: true } },
      },
    });

    return { items };
  }

  async createSlaPolicy(payload: CreateSlaPolicyDto) {
    const code = String(payload.code || "").trim().toUpperCase();
    const name = String(payload.name || "").trim();
    const kind = this.normalizeKind(payload.kind);
    const severity = this.normalizeSeverity(payload.severity);
    const queueKey = String(payload.queueKey || "").trim() || this.defaultQueueKey(kind);
    const firstResponseMinutes = Number(payload.firstResponseMinutes ?? 30);
    const resolveMinutes = Number(payload.resolveMinutes ?? 240);
    const isActive = payload.isActive ?? true;

    if (!code || !name) throw new BadRequestException("Código e nome são obrigatórios");
    if (!Number.isInteger(firstResponseMinutes) || firstResponseMinutes < 1) {
      throw new BadRequestException("firstResponseMinutes inválido");
    }
    if (!Number.isInteger(resolveMinutes) || resolveMinutes < 1) {
      throw new BadRequestException("resolveMinutes inválido");
    }
    if (resolveMinutes < firstResponseMinutes) {
      throw new BadRequestException("resolveMinutes não pode ser menor que firstResponseMinutes");
    }

    const existing = await this.prisma.slaPolicy.findUnique({ where: { code }, select: { id: true } });
    if (existing) throw new ConflictException("Código de SLA já existe");

    return this.prisma.slaPolicy.create({
      data: {
        code,
        name,
        kind,
        severity,
        queueKey,
        firstResponseMinutes,
        resolveMinutes,
        isActive,
      },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        severity: true,
        queueKey: true,
        firstResponseMinutes: true,
        resolveMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateSlaPolicy(id: string, payload: UpdateSlaPolicyDto) {
    const existing = await this.prisma.slaPolicy.findUnique({
      where: { id },
      select: { id: true, code: true, kind: true },
    });

    if (!existing) throw new NotFoundException("Política SLA não encontrada");

    const data: Prisma.SlaPolicyUpdateInput = {};

    if (payload.code !== undefined) {
      const code = String(payload.code || "").trim().toUpperCase();
      if (!code) throw new BadRequestException("Código inválido");
      if (code !== existing.code) {
        const conflict = await this.prisma.slaPolicy.findUnique({ where: { code }, select: { id: true } });
        if (conflict) throw new ConflictException("Código de SLA já existe");
      }
      data.code = code;
    }

    if (payload.name !== undefined) {
      const name = String(payload.name || "").trim();
      if (!name) throw new BadRequestException("Nome inválido");
      data.name = name;
    }

    const nextKind = payload.kind !== undefined ? this.normalizeKind(payload.kind) : existing.kind;
    if (payload.kind !== undefined) data.kind = nextKind;
    if (payload.severity !== undefined) data.severity = this.normalizeSeverity(payload.severity);
    if (payload.queueKey !== undefined) data.queueKey = String(payload.queueKey || "").trim() || this.defaultQueueKey(nextKind);

    const nextFirstResponse = payload.firstResponseMinutes !== undefined ? Number(payload.firstResponseMinutes) : undefined;
    const nextResolve = payload.resolveMinutes !== undefined ? Number(payload.resolveMinutes) : undefined;

    if (nextFirstResponse !== undefined) {
      if (!Number.isInteger(nextFirstResponse) || nextFirstResponse < 1) {
        throw new BadRequestException("firstResponseMinutes inválido");
      }
      data.firstResponseMinutes = nextFirstResponse;
    }

    if (nextResolve !== undefined) {
      if (!Number.isInteger(nextResolve) || nextResolve < 1) {
        throw new BadRequestException("resolveMinutes inválido");
      }
      data.resolveMinutes = nextResolve;
    }

    if (payload.isActive !== undefined) data.isActive = payload.isActive;

    const current = await this.prisma.slaPolicy.findUnique({
      where: { id },
      select: { firstResponseMinutes: true, resolveMinutes: true },
    });
    if (!current) throw new NotFoundException("Política SLA não encontrada");

    const firstResponseMinutes = nextFirstResponse ?? current.firstResponseMinutes;
    const resolveMinutes = nextResolve ?? current.resolveMinutes;
    if (resolveMinutes < firstResponseMinutes) {
      throw new BadRequestException("resolveMinutes não pode ser menor que firstResponseMinutes");
    }

    return this.prisma.slaPolicy.update({
      where: { id },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        severity: true,
        queueKey: true,
        firstResponseMinutes: true,
        resolveMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async bulkUpdateExceptions(payload: BulkUpdateExceptionsDto) {
    const ids = [...new Set((payload.ids || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!ids.length) throw new BadRequestException("Selecione ao menos uma exceção");

    const found = await this.prisma.exceptionCase.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) throw new BadRequestException("Seleção contém exceções inválidas");

    if (payload.action === "assign" && !String(payload.assigneeUserId || "").trim()) {
      throw new BadRequestException("Informe o responsável para a ação assign");
    }

    let updated = 0;
    for (const id of ids) {
      if (payload.action === "ack") {
        await this.updateException(id, { status: "acknowledged" });
      } else if (payload.action === "resolve") {
        await this.updateException(id, { status: "resolved" });
      } else if (payload.action === "reopen") {
        await this.updateException(id, { status: "open" });
      } else if (payload.action === "silence_1h") {
        await this.updateException(id, {
          status: "silenced",
          silencedUntil: payload.silencedUntil || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      } else if (payload.action === "assign") {
        await this.updateException(id, { assigneeUserId: String(payload.assigneeUserId || "") });
      } else if (payload.action === "unassign") {
        await this.updateException(id, { assigneeUserId: "" });
      }
      updated += 1;
    }

    return {
      action: payload.action,
      updated,
      ids,
    };
  }

  async getException(id: string) {
    const item = await this.prisma.exceptionCase.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        kind: true,
        severity: true,
        status: true,
        source: true,
        queueKey: true,
        classification: true,
        impact: true,
        urgency: true,
        priorityScore: true,
        triageStatus: true,
        silencedUntil: true,
        acknowledgedAt: true,
        resolvedAt: true,
        firstResponseDueAt: true,
        resolveDueAt: true,
        breachedAt: true,
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
        assignee: { select: { id: true, name: true, email: true, role: true } },
        automation: { select: { id: true, code: true, name: true, detector: true } },
        slaPolicy: { select: { id: true, code: true, name: true, firstResponseMinutes: true, resolveMinutes: true, queueKey: true } },
        partner: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
        equipment: { select: { id: true, tag: true, name: true } },
        integration: { select: { id: true, code: true, name: true } },
        occurrence: { select: { id: true, code: true, title: true } },
        maintenance: { select: { id: true, code: true, title: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            body: true,
            isInternal: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            kind: true,
            source: true,
            title: true,
            description: true,
            severity: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true, role: true } },
            automation: { select: { id: true, code: true, name: true } },
            automationRun: { select: { id: true, status: true, startedAt: true, finishedAt: true } },
          },
        },
      },
    });

    if (!item) throw new NotFoundException("Exceção não encontrada");
    return item;
  }

  async createException(payload: CreateExceptionDto) {
    const code = String(payload.code || this.code()).trim().toUpperCase();
    const title = payload.title.trim();
    const description = payload.description?.trim() || null;
    const kind = this.normalizeKind(payload.kind);
    const severity = this.normalizeSeverity(payload.severity);
    const status = this.normalizeStatus(payload.status);
    const source = String(payload.source || "manual").trim().toLowerCase() || "manual";

    const existing = await this.prisma.exceptionCase.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) throw new ConflictException("Código de exceção já existe");

    const assigneeUserId = await this.ensureUser(payload.assigneeUserId);
    const partnerId = await this.ensurePartner(payload.partnerId);
    const unitId = await this.ensureUnit(payload.unitId);
    const equipmentId = await this.ensureEquipment(payload.equipmentId);
    const integrationId = await this.ensureIntegration(payload.integrationId);
    const occurrenceId = await this.ensureOccurrence(payload.occurrenceId);
    const maintenanceId = await this.ensureMaintenance(payload.maintenanceId);
    const silencedUntil = this.parseDate(payload.silencedUntil);

    const now = new Date();
    const acknowledgedAt = status === "acknowledged" ? now : null;
    const resolvedAt = status === "resolved" ? now : null;
    const operational = await this.buildOperationalState({
      kind,
      severity,
      status,
      createdAt: now,
      acknowledgedAt,
      resolvedAt,
      assigneeUserId,
    });

    const created = await this.prisma.exceptionCase.create({
      data: {
        code,
        title,
        description,
        kind,
        severity,
        status,
        source,
        silencedUntil,
        acknowledgedAt,
        resolvedAt,
        assigneeUserId,
        partnerId,
        unitId,
        equipmentId,
        integrationId,
        occurrenceId,
        maintenanceId,
        lastActivityAt: now,
        ...operational,
      },
    });

    await this.activitiesService.createActivity({
      title: `Exceção manual criada: ${created.code}`,
      description: created.title,
      kind: "exception",
      source: "exception",
      severity: created.severity,
      userId: assigneeUserId || undefined,
      exceptionId: created.id,
      partnerId: partnerId || undefined,
      unitId: unitId || undefined,
      equipmentId: equipmentId || undefined,
      integrationId: integrationId || undefined,
      occurrenceId: occurrenceId || undefined,
      maintenanceId: maintenanceId || undefined,
    });

    return created;
  }

  async updateException(id: string, payload: UpdateExceptionDto) {
    const existing = await this.prisma.exceptionCase.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        kind: true,
        severity: true,
        status: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
        assigneeUserId: true,
        partnerId: true,
        unitId: true,
        equipmentId: true,
        integrationId: true,
        occurrenceId: true,
        maintenanceId: true,
      },
    });

    if (!existing) throw new NotFoundException("Exceção não encontrada");

    const nextKind = payload.kind !== undefined ? this.normalizeKind(payload.kind) : existing.kind;
    const nextSeverity = payload.severity !== undefined ? this.normalizeSeverity(payload.severity) : existing.severity;
    const nextStatus = payload.status !== undefined ? this.normalizeStatus(payload.status) : existing.status;

    let acknowledgedAt = existing.acknowledgedAt;
    let resolvedAt = existing.resolvedAt;

    if (payload.status !== undefined) {
      if (nextStatus === "acknowledged" && !acknowledgedAt) acknowledgedAt = new Date();
      if (nextStatus === "resolved") resolvedAt = new Date();
      if (nextStatus === "open") {
        acknowledgedAt = null;
        resolvedAt = null;
      }
    }

    const assigneeUserId =
      payload.assigneeUserId !== undefined
        ? await this.ensureUser(payload.assigneeUserId)
        : existing.assigneeUserId;

    const data: Prisma.ExceptionCaseUpdateInput = {};

    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.description !== undefined) data.description = payload.description.trim() || null;
    if (payload.kind !== undefined) data.kind = nextKind;
    if (payload.severity !== undefined) data.severity = nextSeverity;
    if (payload.status !== undefined) data.status = nextStatus;

    if (payload.assigneeUserId !== undefined) {
      data.assignee = assigneeUserId ? { connect: { id: assigneeUserId } } : { disconnect: true };
    }

    if (payload.silencedUntil !== undefined) {
      data.silencedUntil = this.parseDate(payload.silencedUntil);
    }

    if (payload.status !== undefined) {
      data.acknowledgedAt = acknowledgedAt;
      data.resolvedAt = resolvedAt;
      if (nextStatus === "open") {
        data.silencedUntil = null;
      }
      if (nextStatus === "silenced" && payload.silencedUntil === undefined) {
        data.silencedUntil = new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    const operational = await this.buildOperationalState({
      kind: nextKind,
      severity: nextSeverity,
      status: nextStatus,
      createdAt: existing.createdAt,
      acknowledgedAt,
      resolvedAt,
      assigneeUserId,
    });

    data.slaPolicy = operational.slaPolicyId ? { connect: { id: operational.slaPolicyId } } : { disconnect: true };
    data.queueKey = operational.queueKey;
    data.classification = operational.classification;
    data.impact = operational.impact;
    data.urgency = operational.urgency;
    data.priorityScore = operational.priorityScore;
    data.triageStatus = operational.triageStatus;
    data.firstResponseDueAt = operational.firstResponseDueAt;
    data.resolveDueAt = operational.resolveDueAt;
    data.breachedAt = operational.breachedAt;
    data.lastActivityAt = new Date();

    const updated = await this.prisma.exceptionCase.update({
      where: { id },
      data,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        severity: true,
      },
    });

    await this.activitiesService.createActivity({
      title: `Exceção atualizada: ${updated.code}`,
      description: `${updated.title} · ${updated.status}`,
      kind: "exception",
      source: "exception",
      severity: updated.severity,
      exceptionId: updated.id,
      userId: assigneeUserId || undefined,
      partnerId: existing.partnerId || undefined,
      unitId: existing.unitId || undefined,
      equipmentId: existing.equipmentId || undefined,
      integrationId: existing.integrationId || undefined,
      occurrenceId: existing.occurrenceId || undefined,
      maintenanceId: existing.maintenanceId || undefined,
    });

    return updated;
  }

  async addComment(id: string, actorId: string, payload: CreateExceptionCommentDto) {
    const exceptionItem = await this.prisma.exceptionCase.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        severity: true,
        partnerId: true,
        unitId: true,
        equipmentId: true,
        integrationId: true,
        occurrenceId: true,
        maintenanceId: true,
      },
    });

    if (!exceptionItem) throw new NotFoundException("Exceção não encontrada");

    const userId = await this.ensureActor(actorId);
    const body = String(payload.body || "").trim();
    if (body.length < 2) throw new BadRequestException("Comentário inválido");

    const comment = await this.prisma.exceptionComment.create({
      data: {
        exceptionId: exceptionItem.id,
        userId,
        body,
        isInternal: payload.isInternal ?? true,
      },
      select: {
        id: true,
        body: true,
        isInternal: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await this.prisma.exceptionCase.update({
      where: { id: exceptionItem.id },
      data: { lastActivityAt: new Date() },
    });

    await this.activitiesService.createActivity({
      title: `Comentário em ${exceptionItem.code}`,
      description: body,
      kind: "event",
      source: "manual",
      severity: exceptionItem.severity,
      userId,
      exceptionId: exceptionItem.id,
      partnerId: exceptionItem.partnerId || undefined,
      unitId: exceptionItem.unitId || undefined,
      equipmentId: exceptionItem.equipmentId || undefined,
      integrationId: exceptionItem.integrationId || undefined,
      occurrenceId: exceptionItem.occurrenceId || undefined,
      maintenanceId: exceptionItem.maintenanceId || undefined,
    });

    return comment;
  }

  async upsertFromAutomation(rule: AutomationRule, run: AutomationRun, hit: AutomationHit) {
    const existing = await this.prisma.exceptionCase.findUnique({
      where: { fingerprint: hit.fingerprint },
      select: {
        id: true,
        code: true,
        status: true,
        title: true,
        createdAt: true,
        acknowledgedAt: true,
        assigneeUserId: true,
      },
    });

    if (!existing) {
      const now = new Date();
      const operational = await this.buildOperationalState({
        kind: hit.kind,
        severity: hit.severity,
        status: "open",
        createdAt: now,
        acknowledgedAt: null,
        resolvedAt: null,
        assigneeUserId: null,
      });

      const created = await this.prisma.exceptionCase.create({
        data: {
          code: this.code("AEX"),
          title: hit.title,
          description: hit.description,
          kind: hit.kind,
          severity: hit.severity,
          status: "open",
          source: "automation",
          fingerprint: hit.fingerprint,
          automationId: rule.id,
          partnerId: hit.partnerId || null,
          unitId: hit.unitId || null,
          equipmentId: hit.equipmentId || null,
          integrationId: hit.integrationId || null,
          occurrenceId: hit.occurrenceId || null,
          maintenanceId: hit.maintenanceId || null,
          lastActivityAt: now,
          ...operational,
        },
      });

      if (rule.createActivities) {
        await this.activitiesService.createActivity({
          title: `Automação abriu exceção: ${created.code}`,
          description: created.title,
          kind: "automation",
          source: "automation",
          severity: created.severity,
          exceptionId: created.id,
          automationId: rule.id,
          automationRunId: run.id,
          partnerId: hit.partnerId || undefined,
          unitId: hit.unitId || undefined,
          equipmentId: hit.equipmentId || undefined,
          integrationId: hit.integrationId || undefined,
          occurrenceId: hit.occurrenceId || undefined,
          maintenanceId: hit.maintenanceId || undefined,
        });
      }

      return { created: 1, updated: 0 };
    }

    const nextStatus = existing.status === "resolved" ? "open" : existing.status;
    const acknowledgedAt = nextStatus === "open" ? null : existing.acknowledgedAt;
    const operational = await this.buildOperationalState({
      kind: hit.kind,
      severity: hit.severity,
      status: nextStatus,
      createdAt: existing.createdAt,
      acknowledgedAt,
      resolvedAt: nextStatus === "open" ? null : null,
      assigneeUserId: existing.assigneeUserId || null,
    });

    const updated = await this.prisma.exceptionCase.update({
      where: { id: existing.id },
      data: {
        title: hit.title,
        description: hit.description,
        severity: hit.severity,
        kind: hit.kind,
        status: nextStatus,
        acknowledgedAt,
        resolvedAt: nextStatus === "open" ? null : undefined,
        silencedUntil: nextStatus === "open" ? null : undefined,
        lastActivityAt: new Date(),
        slaPolicy: operational.slaPolicyId ? { connect: { id: operational.slaPolicyId } } : { disconnect: true },
        queueKey: operational.queueKey,
        classification: operational.classification,
        impact: operational.impact,
        urgency: operational.urgency,
        priorityScore: operational.priorityScore,
        triageStatus: operational.triageStatus,
        firstResponseDueAt: operational.firstResponseDueAt,
        resolveDueAt: operational.resolveDueAt,
        breachedAt: operational.breachedAt,
      },
      select: { id: true, code: true, title: true, severity: true, status: true },
    });

    if (rule.createActivities) {
      await this.activitiesService.createActivity({
        title: `Automação confirmou exceção: ${updated.code}`,
        description: `${updated.title} · ${updated.status}`,
        kind: "automation",
        source: "automation",
        severity: updated.severity,
        exceptionId: updated.id,
        automationId: rule.id,
        automationRunId: run.id,
        partnerId: hit.partnerId || undefined,
        unitId: hit.unitId || undefined,
        equipmentId: hit.equipmentId || undefined,
        integrationId: hit.integrationId || undefined,
        occurrenceId: hit.occurrenceId || undefined,
        maintenanceId: hit.maintenanceId || undefined,
      });
    }

    return { created: 0, updated: 1 };
  }

  async resolveRecovered(rule: AutomationRule, run: AutomationRun, fingerprints: string[]) {
    if (!rule.resolveOnRecovery) return 0;

    const stale = await this.prisma.exceptionCase.findMany({
      where: {
        automationId: rule.id,
        source: "automation",
        status: { in: [...OPEN_STATUSES] },
        ...(fingerprints.length ? { fingerprint: { notIn: fingerprints } } : {}),
      },
      select: {
        id: true,
        code: true,
        title: true,
        severity: true,
      },
    });

    for (const item of stale) {
      const operational = await this.buildOperationalState({
        kind: "automation",
        severity: item.severity,
        status: "resolved",
        createdAt: new Date(),
        acknowledgedAt: null,
        resolvedAt: new Date(),
        assigneeUserId: null,
      });

      await this.prisma.exceptionCase.update({
        where: { id: item.id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          silencedUntil: null,
          triageStatus: operational.triageStatus,
          breachedAt: null,
          lastActivityAt: new Date(),
        },
      });

      if (rule.createActivities) {
        await this.activitiesService.createActivity({
          title: `Automação resolveu exceção: ${item.code}`,
          description: item.title,
          kind: "automation",
          source: "automation",
          severity: item.severity,
          exceptionId: item.id,
          automationId: rule.id,
          automationRunId: run.id,
        });
      }
    }

    return stale.length;
  }
}
