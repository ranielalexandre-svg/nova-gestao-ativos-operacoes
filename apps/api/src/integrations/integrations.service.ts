import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Integration, Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { CreateIntegrationDto } from "./dto/create-integration.dto";
import { ListIntegrationsQueryDto } from "./dto/list-integrations-query.dto";
import { UpdateIntegrationDto } from "./dto/update-integration.dto";

type IntegrationSafe = {
  id: string;
  code: string;
  name: string;
  type: string;
  baseUrl: string;
  apiPath: string | null;
  authMode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type IntegrationTestResult = {
  ok: boolean;
  message: string;
  targetUrl: string;
  latencyMs: number;
  httpStatus?: number;
  version?: string;
  monitoredHosts?: number;
  openProblems?: number;
};

type ZabbixSnapshot = {
  ok: boolean;
  targetUrl: string;
  version?: string;
  monitoredHosts?: number;
  openProblems?: number;
  recentProblems: Array<{
    eventid: string;
    name: string;
    severity: string;
    acknowledged: string;
    clock: string;
  }>;
  message: string;
};

type UnitTelemetryEquipment = {
  id: string;
  tag: string;
  name: string;
  type: string;
  serialNumber: string | null;
  status: string;
  isActive: boolean;
};

type UnitTelemetryInput = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  zabbixHost: string | null;
  zabbixVisibleName: string | null;
  isActive: boolean;
  partner: {
    id: string;
    code: string;
    name: string;
  };
  equipments: UnitTelemetryEquipment[];
};

type ZabbixHostTag = {
  tag?: string;
  value?: string;
};

type ZabbixHostInterface = {
  ip?: string;
  dns?: string;
  main?: string;
  type?: string;
  useip?: string;
};

type ZabbixHostCandidate = {
  hostid: string;
  host: string;
  name: string;
  status?: string;
  tags?: ZabbixHostTag[];
  inheritedTags?: ZabbixHostTag[];
  inventory?: Record<string, unknown> | null;
  interfaces?: ZabbixHostInterface[];
};

type ZabbixTelemetryItem = {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue?: string;
  lastclock?: string;
  units?: string;
  value_type?: string;
  status?: string;
  state?: string;
  error?: string;
};

type ZabbixHistoryPoint = {
  itemid: string;
  clock: string;
  value: string;
};

type ReportSeriesKind = "trafficIn" | "trafficOut" | "ping" | "loss" | "uptime";

type ReportItemProfile = {
  kind: ReportSeriesKind;
  block: "traffic" | "ping" | "uptime";
  label: string;
  color: string;
  unit: "bps" | "ms" | "%" | "d";
  sensorType: string;
};

type ZabbixHostProblem = {
  eventid: string;
  name: string;
  severity: string;
  acknowledged: string;
  clock: string;
  objectid?: string;
};

type UnitHostMatch = {
  status: "matched" | "ambiguous" | "unmatched";
  score: number;
  confidence: number;
  integrationId?: string;
  integrationCode?: string;
  integrationName?: string;
  targetUrl?: string;
  hostId?: string;
  host?: string;
  hostName?: string;
  hostStatus?: string;
  matchedBy: string[];
  candidates: number;
  syncReady: boolean;
};

type UnitZabbixSyncResult = {
  ok: boolean;
  status: "synced" | "skipped" | "failed";
  message: string;
  integrationCode?: string;
  hostId?: string;
  hostName?: string;
  updatedTags?: number;
  updatedInventoryFields?: string[];
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  private safeSelect() {
    return {
      id: true,
      code: true,
      name: true,
      type: true,
      baseUrl: true,
      apiPath: true,
      authMode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.IntegrationSelect;
  }

  private async getIntegrationEntityByIdOrThrow(id: string) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });

    if (!integration) {
      throw new NotFoundException("Integração não encontrada");
    }

    return integration;
  }

  async listIntegrations(query: ListIntegrationsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const sortDir: Prisma.SortOrder = query.sortDir === "asc" ? "asc" : "desc";

    const where: Prisma.IntegrationWhereInput = {};

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { baseUrl: { contains: q, mode: "insensitive" } },
      ];
    }

    if (query.active === "true") {
      where.isActive = true;
    } else if (query.active === "false") {
      where.isActive = false;
    }

    if (query.type && query.type !== "all") {
      where.type = query.type;
    }

    let orderBy: Prisma.IntegrationOrderByWithRelationInput = { createdAt: "desc" };

    switch (query.sortBy) {
      case "code":
        orderBy = { code: sortDir };
        break;
      case "name":
        orderBy = { name: sortDir };
        break;
      case "type":
        orderBy = { type: sortDir };
        break;
      default:
        orderBy = { createdAt: sortDir };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.integration.findMany({
        where,
        select: this.safeSelect(),
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.integration.count({ where }),
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

  async createIntegration(payload: CreateIntegrationDto) {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const type = payload.type.trim().toLowerCase();
    const baseUrl = payload.baseUrl.trim();
    const apiPath = payload.apiPath?.trim() || null;
    const authMode = (payload.authMode || "none").trim().toLowerCase();

    const existing = await this.prisma.integration.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Código de integração já existe");
    }

    if (!["none", "token", "userpass"].includes(authMode)) {
      throw new BadRequestException("authMode inválido");
    }

    if (authMode === "token" && !String(payload.apiToken || "").trim()) {
      throw new BadRequestException("apiToken é obrigatório para authMode=token");
    }

    if (
      authMode === "userpass" &&
      (!String(payload.username || "").trim() || !String(payload.password || "").trim())
    ) {
      throw new BadRequestException("username e password são obrigatórios para authMode=userpass");
    }

    return this.prisma.integration.create({
      data: {
        code,
        name,
        type,
        baseUrl,
        apiPath,
        authMode,
        apiTokenEnc: authMode === "token" ? encryptSecret(payload.apiToken) : null,
        usernameEnc: authMode === "userpass" ? encryptSecret(payload.username) : null,
        passwordEnc: authMode === "userpass" ? encryptSecret(payload.password) : null,
        isActive: true,
      },
      select: this.safeSelect(),
    });
  }

  async updateIntegration(id: string, payload: UpdateIntegrationDto) {
    const integration = await this.getIntegrationEntityByIdOrThrow(id);

    const data: Prisma.IntegrationUpdateInput = {};

    if (payload.code !== undefined) data.code = payload.code.trim().toUpperCase();
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.type !== undefined) data.type = payload.type.trim().toLowerCase();
    if (payload.baseUrl !== undefined) data.baseUrl = payload.baseUrl.trim();
    if (payload.apiPath !== undefined) data.apiPath = payload.apiPath.trim() || null;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;

    const nextAuthMode = payload.authMode?.trim().toLowerCase() || integration.authMode;

    if (!["none", "token", "userpass"].includes(nextAuthMode)) {
      throw new BadRequestException("authMode inválido");
    }

    data.authMode = nextAuthMode;

    if (nextAuthMode === "none") {
      data.apiTokenEnc = null;
      data.usernameEnc = null;
      data.passwordEnc = null;
    }

    if (nextAuthMode === "token") {
      const newApiToken = String(payload.apiToken || "").trim();

      if (newApiToken) {
        data.apiTokenEnc = encryptSecret(newApiToken);
      } else if (!integration.apiTokenEnc) {
        throw new BadRequestException("apiToken é obrigatório para authMode=token");
      }

      data.usernameEnc = null;
      data.passwordEnc = null;
    }

    if (nextAuthMode === "userpass") {
      const newUsername = String(payload.username || "").trim();
      const newPassword = String(payload.password || "").trim();

      if (newUsername) {
        data.usernameEnc = encryptSecret(newUsername);
      } else if (!integration.usernameEnc) {
        throw new BadRequestException("username é obrigatório para authMode=userpass");
      }

      if (newPassword) {
        data.passwordEnc = encryptSecret(newPassword);
      } else if (!integration.passwordEnc) {
        throw new BadRequestException("password é obrigatório para authMode=userpass");
      }

      data.apiTokenEnc = null;
    }

    return this.prisma.integration.update({
      where: { id },
      data,
      select: this.safeSelect(),
    });
  }

  private resolveTargetUrl(integration: Integration) {
    const base = integration.baseUrl.trim();

    if (integration.type === "zabbix") {
      if (/api_jsonrpc\.php$/i.test(base)) {
        return base;
      }

      const suffix = integration.apiPath?.trim()
        ? integration.apiPath.trim()
        : "/api_jsonrpc.php";

      return `${base.replace(/\/+$/, "")}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
    }

    if (integration.apiPath?.trim()) {
      const suffix = integration.apiPath.trim();
      if (/^https?:\/\//i.test(suffix)) return suffix;
      return `${base.replace(/\/+$/, "")}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
    }

    return base;
  }

  private async zabbixRpc<T>(
    targetUrl: string,
    method: string,
    params: unknown,
    bearerToken?: string,
  ): Promise<T> {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-rpc",
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: 1,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao chamar ${method}`);
    }

    if (payload?.error) {
      throw new Error(String(payload.error?.data || payload.error?.message || `Erro em ${method}`));
    }

    return payload?.result as T;
  }

  private async getZabbixBearerToken(integration: Integration, targetUrl: string) {
    if (integration.authMode === "token") {
      const token = decryptSecret(integration.apiTokenEnc);
      if (!token) throw new Error("API token não configurado");
      return { bearerToken: token, logoutToken: null as string | null };
    }

    if (integration.authMode === "userpass") {
      const username = decryptSecret(integration.usernameEnc);
      const password = decryptSecret(integration.passwordEnc);

      if (!username || !password) {
        throw new Error("Username/password não configurados");
      }

      const loginToken = await this.zabbixRpc<string>(targetUrl, "user.login", {
        username,
        password,
      });

      return { bearerToken: loginToken, logoutToken: loginToken };
    }

    return { bearerToken: "", logoutToken: null as string | null };
  }

  private async safeZabbixLogout(targetUrl: string, token: string | null) {
    if (!token) return;

    try {
      await this.zabbixRpc<boolean>(targetUrl, "user.logout", [], token);
    } catch {
      // ignore
    }
  }

  private normalizeSearchText(value: unknown) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private compactToken(value: unknown) {
    return this.normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
  }

  private normalizeMac(value: unknown) {
    const compact = String(value ?? "").toLowerCase().replace(/[^a-f0-9]/g, "");
    return compact.length >= 8 ? compact : "";
  }

  private zabbixHostLookupParams(extra: Record<string, unknown> = {}) {
    return {
      output: ["hostid", "host", "name", "status"],
      monitored_hosts: true,
      selectTags: ["tag", "value"],
      selectInheritedTags: ["tag", "value"],
      selectInventory: [
        "name",
        "alias",
        "type",
        "vendor",
        "model",
        "serialno_a",
        "serialno_b",
        "tag",
        "asset_tag",
        "macaddress_a",
        "macaddress_b",
        "contact",
        "location",
        "location_lat",
        "location_lon",
        "notes",
        "site_address_a",
        "site_city",
        "site_state",
        "site_country",
      ],
      selectInterfaces: ["ip", "dns", "main", "type", "useip"],
      sortfield: "name",
      ...extra,
    };
  }

  private hostTags(host: ZabbixHostCandidate) {
    return [...(host.tags || []), ...(host.inheritedTags || [])];
  }

  private hostTagValue(host: ZabbixHostCandidate, names: string[]) {
    const expected = new Set(names.map((name) => this.compactToken(name)));

    return this.hostTags(host).find((tag) => expected.has(this.compactToken(tag.tag)))?.value || "";
  }

  private collectHostNeedle(host: ZabbixHostCandidate) {
    const parts: unknown[] = [host.host, host.name];

    for (const tag of this.hostTags(host)) {
      parts.push(tag.tag, tag.value);
    }

    if (host.inventory) {
      parts.push(...Object.values(host.inventory));
    }

    for (const item of host.interfaces || []) {
      parts.push(item.ip, item.dns);
    }

    const text = parts.filter((item) => item !== null && item !== undefined).join(" ");

    return {
      text: this.normalizeSearchText(text),
      compact: this.compactToken(text),
      macs: parts.map((item) => this.normalizeMac(item)).filter(Boolean),
    };
  }

  private scoreHostForUnit(unit: UnitTelemetryInput, host: ZabbixHostCandidate) {
    const needle = this.collectHostNeedle(host);
    const reasons: string[] = [];
    let score = 0;
    let syncReady = false;

    const unitId = this.compactToken(unit.id);
    const unitCode = this.compactToken(unit.code);
    const unitName = this.compactToken(unit.name);
    const city = this.compactToken(unit.city);
    const state = this.compactToken(unit.state);
    const manualHost = this.compactToken(unit.zabbixHost);
    const manualVisibleName = this.compactToken(unit.zabbixVisibleName);
    const partnerCode = this.compactToken(unit.partner.code);
    const partnerName = this.compactToken(unit.partner.name);
    const hostCode = this.compactToken(host.host);
    const hostVisibleName = this.compactToken(host.name);

    const tagUnitId = this.compactToken(this.hostTagValue(host, ["nova.unit_id", "unit_id", "unidade_id"]));
    const tagUnitCode = this.compactToken(
      this.hostTagValue(host, ["nova.unit_code", "unit_code", "unit", "unidade", "local"]),
    );
    const tagPartner = this.compactToken(
      this.hostTagValue(host, ["nova.partner_code", "partner_code", "partner", "parceiro"]),
    );

    if (manualHost && hostCode === manualHost) {
      score += 1000;
      syncReady = true;
      reasons.push("host manual");
    }

    if (manualVisibleName && hostVisibleName === manualVisibleName) {
      score += 1000;
      syncReady = true;
      reasons.push("nome visível manual");
    }

    if (unitId && tagUnitId === unitId) {
      score += 100;
      syncReady = true;
      reasons.push("tag nova.unit_id");
    }

    if (unitCode && tagUnitCode === unitCode) {
      score += 90;
      syncReady = true;
      reasons.push("tag nova.unit_code");
    }

    if (unitCode && needle.compact.includes(unitCode)) {
      score += 62;
      reasons.push("código da unidade");
    }

    if (unitName.length >= 5 && needle.compact.includes(unitName)) {
      score += 40;
      reasons.push("nome da unidade");
    }

    if (city.length >= 4 && needle.compact.includes(city)) {
      score += 8;
      reasons.push("cidade");
    }

    if (state.length >= 2 && needle.compact.includes(state)) {
      score += 4;
      reasons.push("UF");
    }

    if (partnerCode && (tagPartner === partnerCode || needle.compact.includes(partnerCode))) {
      score += 12;
      reasons.push("parceiro");
    } else if (partnerName.length >= 5 && needle.compact.includes(partnerName)) {
      score += 8;
      reasons.push("nome do parceiro");
    }

    const equipmentHits = new Set<string>();

    for (const equipment of unit.equipments) {
      const tag = this.compactToken(equipment.tag);
      const serial = this.compactToken(equipment.serialNumber);
      const mac = this.normalizeMac(equipment.serialNumber);

      if (tag.length >= 4 && needle.compact.includes(tag)) {
        equipmentHits.add(equipment.tag);
        score += 42;
      }

      if (serial.length >= 6 && needle.compact.includes(serial)) {
        equipmentHits.add(equipment.tag);
        score += 58;
      }

      if (mac && needle.macs.includes(mac)) {
        equipmentHits.add(equipment.tag);
        score += 70;
      }
    }

    if (equipmentHits.size) {
      reasons.push(`${equipmentHits.size} ativo(s)`);
    }

    if (host.status === "0") {
      score += 2;
    }

    return {
      score,
      reasons: Array.from(new Set(reasons)),
      syncReady,
    };
  }

  private selectHostMatch(
    unit: UnitTelemetryInput,
    hosts: ZabbixHostCandidate[],
    integration: Pick<Integration, "id" | "code" | "name">,
    targetUrl: string,
  ): UnitHostMatch {
    const ranked = hosts
      .map((host) => ({
        host,
        ...this.scoreHostForUnit(unit, host),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];

    if (!best || best.score < 55) {
      return {
        status: "unmatched",
        score: best?.score || 0,
        confidence: Math.min(100, best?.score || 0),
        matchedBy: best?.reasons || [],
        candidates: ranked.length,
        syncReady: false,
      };
    }

    const second = ranked[1];
    const ambiguous = Boolean(second && second.score >= 55 && best.score - second.score < 12);

    return {
      status: ambiguous ? "ambiguous" : "matched",
      score: best.score,
      confidence: Math.min(100, best.score),
      integrationId: integration.id,
      integrationCode: integration.code,
      integrationName: integration.name,
      targetUrl,
      hostId: best.host.hostid,
      host: best.host.host,
      hostName: best.host.name,
      hostStatus: best.host.status,
      matchedBy: best.reasons,
      candidates: ranked.filter((item) => item.score >= 55).length,
      syncReady: best.syncReady && !ambiguous,
    };
  }

  private parseNumber(value: unknown) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private reportItemProfile(item: ZabbixTelemetryItem): ReportItemProfile | null {
    const key = item.key_.toLowerCase();
    const name = this.normalizeSearchText(item.name);
    const units = (item.units || "").toLowerCase();
    const isTraffic =
      units.includes("bps") ||
      key.includes("net.if.") ||
      name.includes("traffic") ||
      name.includes("trafego") ||
      name.includes("bits received") ||
      name.includes("bits sent");

    if (key.includes("system.uptime") || name.includes("system uptime") || name.includes("uptime")) {
      return {
        kind: "uptime",
        block: "uptime",
        label: "Tempo de atividade do sistema",
        color: "#1f3b77",
        unit: "d",
        sensorType: "Tempo de atividade do sistema (SNMP)",
      };
    }

    if (
      key.startsWith("icmppingloss") ||
      name.includes("packet loss") ||
      name.includes("perda de pacote") ||
      name.includes("loss")
    ) {
      return {
        kind: "loss",
        block: "ping",
        label: "Perda de pacote",
        color: "#8a7b33",
        unit: "%",
        sensorType: "Ping (60 s Intervalo)",
      };
    }

    if (
      key.startsWith("icmppingsec") ||
      key.includes("latency") ||
      key.includes("response.time") ||
      name.includes("latencia") ||
      name.includes("latency") ||
      name.includes("response time") ||
      name.includes("tempo de resposta")
    ) {
      return {
        kind: "ping",
        block: "ping",
        label: "Tempo de ping",
        color: "#f06292",
        unit: "ms",
        sensorType: "Ping (60 s Intervalo)",
      };
    }

    if (isTraffic) {
      const outbound =
        key.includes(".out") ||
        key.includes("ifout") ||
        name.includes("bits sent") ||
        name.includes("outgoing") ||
        name.includes("upload") ||
        name.includes("saida");

      return {
        kind: outbound ? "trafficOut" : "trafficIn",
        block: "traffic",
        label: outbound ? "Tráfego enviado" : "Tráfego recebido",
        color: outbound ? "#ffb74d" : "#2fbf3a",
        unit: "bps",
        sensorType: "Tráfego (SNMP) 64bit",
      };
    }

    return null;
  }

  private reportHistoryType(item: ZabbixTelemetryItem) {
    return item.value_type === "3" ? 3 : item.value_type === "0" ? 0 : null;
  }

  private normalizeReportValue(item: ZabbixTelemetryItem, value: number, profile: ReportItemProfile) {
    const key = item.key_.toLowerCase();
    const units = (item.units || "").toLowerCase();

    if (profile.unit === "ms") {
      if (key.startsWith("icmppingsec") || ["s", "sec", "second", "seconds"].includes(units)) {
        return value * 1000;
      }
      return value;
    }

    if (profile.unit === "d") {
      return value / 86400;
    }

    return value;
  }

  private reportStats(values: number[]) {
    const clean = values.filter((item) => Number.isFinite(item));
    if (!clean.length) {
      return {
        last: null,
        min: null,
        avg: null,
        max: null,
        points: 0,
      };
    }

    const sum = clean.reduce((total, item) => total + item, 0);

    return {
      last: clean[clean.length - 1],
      min: Math.min(...clean),
      avg: sum / clean.length,
      max: Math.max(...clean),
      points: clean.length,
    };
  }

  private reportBlockTitle(block: "traffic" | "ping" | "uptime", unitName: string) {
    if (block === "traffic") return `${unitName}: Link Traffic`;
    if (block === "ping") return `${unitName}: Ping`;
    return `${unitName}: System Uptime`;
  }

  private reportBlockDescription(block: "traffic" | "ping" | "uptime") {
    if (block === "traffic") return "Consumo de banda renderizado no padrão visual de relatório PRTG, com dados coletados do Zabbix.";
    if (block === "ping") return "Latência e perda de pacote a partir dos itens de ICMP do Zabbix.";
    return "Tempo de atividade do host monitorado no Zabbix.";
  }

  private selectReportItems(items: ZabbixTelemetryItem[]) {
    const byKind = new Map<ReportSeriesKind, { item: ZabbixTelemetryItem; profile: ReportItemProfile }>();

    for (const item of items) {
      if (item.status !== "0") continue;

      const profile = this.reportItemProfile(item);
      if (!profile || this.reportHistoryType(item) === null) continue;

      const currentValue = this.parseNumber(item.lastvalue) ?? 0;
      const existing = byKind.get(profile.kind);
      const existingValue = this.parseNumber(existing?.item.lastvalue) ?? -Infinity;

      if (!existing || currentValue > existingValue) {
        byKind.set(profile.kind, { item, profile });
      }
    }

    return Array.from(byKind.values());
  }

  private async readReportHistory(
    targetUrl: string,
    bearerToken: string,
    selected: Array<{ item: ZabbixTelemetryItem; profile: ReportItemProfile }>,
    period: { from: Date; to: Date },
  ) {
    const byHistoryType = new Map<number, string[]>();

    for (const entry of selected) {
      const type = this.reportHistoryType(entry.item);
      if (type === null) continue;

      byHistoryType.set(type, [...(byHistoryType.get(type) || []), entry.item.itemid]);
    }

    const results = await Promise.all(
      Array.from(byHistoryType.entries()).map(([history, itemids]) =>
        this.zabbixRpc<ZabbixHistoryPoint[]>(
          targetUrl,
          "history.get",
          {
            output: ["itemid", "clock", "value"],
            history,
            itemids,
            time_from: Math.floor(period.from.getTime() / 1000),
            time_till: Math.floor(period.to.getTime() / 1000),
            sortfield: "clock",
            sortorder: "ASC",
            limit: Math.min(30000, Math.max(6000, itemids.length * 6000)),
          },
          bearerToken,
        ),
      ),
    );

    const pointsByItem = new Map<string, ZabbixHistoryPoint[]>();

    for (const point of results.flat()) {
      pointsByItem.set(point.itemid, [...(pointsByItem.get(point.itemid) || []), point]);
    }

    return pointsByItem;
  }

  private latestItem(
    items: ZabbixTelemetryItem[],
    predicate: (item: ZabbixTelemetryItem) => boolean,
  ) {
    return items
      .filter((item) => item.status === "0")
      .filter((item) => item.lastvalue !== undefined && item.lastvalue !== null)
      .filter(predicate)
      .sort((a, b) => Number(b.lastclock || 0) - Number(a.lastclock || 0))[0];
  }

  private itemLabel(item: ZabbixTelemetryItem | undefined) {
    if (!item) return null;
    return {
      itemid: item.itemid,
      name: item.name,
      key: item.key_,
      lastClock: item.lastclock || null,
      units: item.units || "",
    };
  }

  private tagValue(value: unknown) {
    return String(value ?? "").trim().slice(0, 255);
  }

  private managedUnitTags(unit: UnitTelemetryInput) {
    return [
      { tag: "nova.unit_id", value: this.tagValue(unit.id) },
      { tag: "nova.unit_code", value: this.tagValue(unit.code) },
      { tag: "nova.unit_name", value: this.tagValue(unit.name) },
      { tag: "nova.partner_code", value: this.tagValue(unit.partner.code) },
      { tag: "nova.partner_name", value: this.tagValue(unit.partner.name) },
      { tag: "nova.source", value: "portal" },
    ].filter((item) => item.value);
  }

  private mergeManagedUnitTags(existing: ZabbixHostTag[], managed: ZabbixHostTag[]) {
    const managedNames = new Set(managed.map((item) => item.tag));
    const preserved = existing
      .filter((item) => item.tag && !managedNames.has(item.tag))
      .map((item) => ({ tag: item.tag || "", value: item.value || "" }));

    return [...preserved, ...managed.map((item) => ({ tag: item.tag || "", value: item.value || "" }))];
  }

  private definedInventory(input: Record<string, string | undefined>) {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => typeof value === "string" && value.trim()),
    );
  }

  private inventoryForUnit(unit: UnitTelemetryInput) {
    const activeEquipments = unit.equipments.filter((equipment) => equipment.isActive);
    const first = activeEquipments[0];
    const second = activeEquipments[1];
    const firstMac = this.normalizeMac(first?.serialNumber);
    const secondMac = this.normalizeMac(second?.serialNumber);
    const location = [unit.city, unit.state].filter(Boolean).join(" / ");
    const equipmentLine = activeEquipments.length
      ? activeEquipments.map((equipment) => `${equipment.tag} (${equipment.type})`).join(", ")
      : "sem equipamentos vinculados";

    return this.definedInventory({
      name: unit.name,
      alias: unit.code,
      asset_tag: unit.code,
      location,
      site_city: unit.city || undefined,
      site_state: unit.state || undefined,
      contact: `Parceiro: ${unit.partner.code} - ${unit.partner.name}`,
      notes: `NOVA OPS: unidade ${unit.code}; parceiro ${unit.partner.code}; ativos: ${equipmentLine}`,
      serialno_a: first?.serialNumber || undefined,
      serialno_b: second?.serialNumber || undefined,
      macaddress_a: firstMac || undefined,
      macaddress_b: secondMac || undefined,
    });
  }

  private metricsFromItems(items: ZabbixTelemetryItem[]) {
    const ping = this.latestItem(items, (item) => {
      const key = item.key_.toLowerCase();
      return key.startsWith("icmpping") && !key.startsWith("icmppingloss") && !key.startsWith("icmppingsec");
    });

    const loss = this.latestItem(items, (item) => {
      const key = item.key_.toLowerCase();
      const name = this.normalizeSearchText(item.name);
      return (
        key.startsWith("icmppingloss") ||
        key.includes("packetloss") ||
        key.includes("loss") ||
        name.includes("perda") ||
        name.includes("packet loss") ||
        name.includes("loss")
      );
    });

    const latency = this.latestItem(items, (item) => {
      const key = item.key_.toLowerCase();
      const name = this.normalizeSearchText(item.name);
      return (
        key.startsWith("icmppingsec") ||
        key.includes("latency") ||
        key.includes("delay") ||
        key.includes("rtt") ||
        key.includes("response.time") ||
        name.includes("latencia") ||
        name.includes("latency") ||
        name.includes("response time") ||
        name.includes("tempo de resposta") ||
        name.includes("rtt")
      );
    });

    const temperature = this.latestItem(items, (item) => {
      const key = item.key_.toLowerCase();
      const name = this.normalizeSearchText(item.name);
      const units = (item.units || "").toLowerCase();
      return (
        key.includes("temp") ||
        key.includes("sensor.temperature") ||
        name.includes("temperatura") ||
        name.includes("temperature") ||
        name.includes("temp ") ||
        units === "c" ||
        units === "°c" ||
        units.includes("celsius")
      );
    });

    const lossValue = this.parseNumber(loss?.lastvalue);
    const latencyValue = this.parseNumber(latency?.lastvalue);
    const latencyMs =
      latencyValue === null
        ? null
        : latency?.key_.toLowerCase().startsWith("icmppingsec") ||
            ["s", "sec", "second", "seconds"].includes((latency?.units || "").toLowerCase())
          ? Math.round(latencyValue * 1000)
          : Math.round(latencyValue);
    const temperatureValue = this.parseNumber(temperature?.lastvalue);
    const pingValue = this.parseNumber(ping?.lastvalue);
    const pingLabel = this.itemLabel(ping);

    return {
      ping: ping && pingLabel
        ? {
            ok: pingValue === null ? null : pingValue > 0,
            value: pingValue,
            ...pingLabel,
          }
        : null,
      lossPct: lossValue,
      latencyMs,
      temperatureC: temperatureValue,
      sources: {
        ping: this.itemLabel(ping),
        loss: this.itemLabel(loss),
        latency: this.itemLabel(latency),
        temperature: this.itemLabel(temperature),
      },
    };
  }

  private healthFromTelemetry(
    match: UnitHostMatch,
    metrics: {
      ping: { ok: boolean | null } | null;
      lossPct: number | null;
      latencyMs: number | null;
      temperatureC: number | null;
    },
    problems: ZabbixHostProblem[],
  ) {
    if (match.status !== "matched") return match.status === "ambiguous" ? "ambiguous" : "unmapped";
    if (metrics.ping?.ok === false) return "down";
    if (problems.some((problem) => Number(problem.severity) >= 4)) return "degraded";
    if ((metrics.lossPct ?? 0) >= 5) return "degraded";
    if ((metrics.latencyMs ?? 0) >= 700) return "degraded";
    if ((metrics.temperatureC ?? 0) >= 70) return "degraded";
    if (metrics.ping || metrics.lossPct !== null || metrics.latencyMs !== null || metrics.temperatureC !== null) {
      return "online";
    }
    return "unknown";
  }

  async getZabbixUnitHostTelemetry(units: UnitTelemetryInput[]) {
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true, type: "zabbix" },
      orderBy: { code: "asc" },
    });

    const sources: Array<{
      id: string;
      code: string;
      name: string;
      ok: boolean;
      message: string;
      targetUrl: string;
      version?: string;
      totalHosts: number;
      matchedUnits: number;
    }> = [];
    const matchesByUnit = new Map<string, UnitHostMatch[]>();

    for (const integration of integrations) {
      const targetUrl = this.resolveTargetUrl(integration);

      try {
        const version = await this.zabbixRpc<string>(targetUrl, "apiinfo.version", []);
        const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

        if (!bearerToken) {
          sources.push({
            id: integration.id,
            code: integration.code,
            name: integration.name,
            ok: false,
            message:
              "Versão lida, mas faltam credenciais para consultar hosts. Configure o conector em /integracoes.",
            targetUrl,
            version,
            totalHosts: 0,
            matchedUnits: 0,
          });
          continue;
        }

        try {
          const hosts = await this.zabbixRpc<ZabbixHostCandidate[]>(
            targetUrl,
            "host.get",
            {
              ...this.zabbixHostLookupParams(),
            },
            bearerToken,
          );

          let matchedUnits = 0;

          for (const unit of units) {
            const match = this.selectHostMatch(unit, hosts, integration, targetUrl);
            if (match.status !== "unmatched") {
              matchedUnits += 1;
            }
            matchesByUnit.set(unit.id, [...(matchesByUnit.get(unit.id) || []), match]);
          }

          sources.push({
            id: integration.id,
            code: integration.code,
            name: integration.name,
            ok: true,
            message: `Zabbix ${version}: ${hosts.length} hosts monitorados lidos`,
            targetUrl,
            version,
            totalHosts: hosts.length,
            matchedUnits,
          });
        } finally {
          await this.safeZabbixLogout(targetUrl, logoutToken);
        }
      } catch (error) {
        sources.push({
          id: integration.id,
          code: integration.code,
          name: integration.name,
          ok: false,
          message: error instanceof Error ? error.message : "Falha ao consultar hosts no Zabbix",
          targetUrl,
          totalHosts: 0,
          matchedUnits: 0,
        });
      }
    }

    const selectedMatches = new Map<string, UnitHostMatch>();

    for (const unit of units) {
      const ranked = (matchesByUnit.get(unit.id) || [])
        .filter((match) => match.status !== "unmatched")
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];

      if (!best) {
        selectedMatches.set(unit.id, {
          status: "unmatched",
          score: 0,
          confidence: 0,
          matchedBy: [],
          candidates: 0,
          syncReady: false,
        });
        continue;
      }

      selectedMatches.set(unit.id, {
        ...best,
        status:
          best.status === "ambiguous" || (second && second.score >= 55 && best.score - second.score < 12)
            ? "ambiguous"
            : "matched",
        candidates: ranked.length,
        syncReady: best.syncReady && !(second && second.score >= 55 && best.score - second.score < 12),
      });
    }

    const matchedByIntegration = new Map<string, string[]>();

    for (const match of selectedMatches.values()) {
      if (match.status === "matched" && match.integrationId && match.hostId) {
        matchedByIntegration.set(match.integrationId, [
          ...(matchedByIntegration.get(match.integrationId) || []),
          match.hostId,
        ]);
      }
    }

    const itemsByHost = new Map<string, ZabbixTelemetryItem[]>();
    const problemsByHost = new Map<string, ZabbixHostProblem[]>();

    for (const integration of integrations) {
      const hostIds = Array.from(new Set(matchedByIntegration.get(integration.id) || []));
      if (!hostIds.length) continue;

      const targetUrl = this.resolveTargetUrl(integration);

      try {
        const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);
        if (!bearerToken) continue;

        try {
          const [items, problemLists] = await Promise.all([
            this.zabbixRpc<ZabbixTelemetryItem[]>(
              targetUrl,
              "item.get",
              {
                output: [
                  "itemid",
                  "hostid",
                  "name",
                  "key_",
                  "lastvalue",
                  "lastclock",
                  "units",
                  "value_type",
                  "status",
                  "state",
                  "error",
                ],
                hostids: hostIds,
                filter: { status: "0" },
                sortfield: "name",
              },
              bearerToken,
            ),
            Promise.all(
              hostIds.map(async (hostId) => ({
                hostId,
                problems: await this.zabbixRpc<ZabbixHostProblem[]>(
                  targetUrl,
                  "problem.get",
                  {
                    output: ["eventid", "name", "severity", "acknowledged", "clock", "objectid"],
                    hostids: [hostId],
                    sortfield: ["eventid"],
                    sortorder: "DESC",
                    limit: 20,
                  },
                  bearerToken,
                ),
              })),
            ),
          ]);

          for (const item of items) {
            itemsByHost.set(item.hostid, [...(itemsByHost.get(item.hostid) || []), item]);
          }

          for (const entry of problemLists) {
            problemsByHost.set(entry.hostId, entry.problems);
          }
        } finally {
          await this.safeZabbixLogout(targetUrl, logoutToken);
        }
      } catch {
        // The source health above already reports Zabbix failures; telemetry remains partial.
      }
    }

    const items = units.map((unit) => {
      const match = selectedMatches.get(unit.id) || {
        status: "unmatched" as const,
        score: 0,
        confidence: 0,
        matchedBy: [],
        candidates: 0,
        syncReady: false,
      };
      const hostItems = match.hostId ? itemsByHost.get(match.hostId) || [] : [];
      const hostProblems = match.hostId ? problemsByHost.get(match.hostId) || [] : [];
      const metrics = this.metricsFromItems(hostItems);

      return {
        unit: {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          city: unit.city,
          state: unit.state,
          zabbixHost: unit.zabbixHost,
          zabbixVisibleName: unit.zabbixVisibleName,
          isActive: unit.isActive,
        },
        partner: unit.partner,
        equipments: unit.equipments,
        match,
        health: this.healthFromTelemetry(match, metrics, hostProblems),
        metrics,
        problems: hostProblems.slice(0, 6),
      };
    });

    const matched = items.filter((item) => item.match.status === "matched").length;
    const ambiguous = items.filter((item) => item.match.status === "ambiguous").length;
    const unmapped = items.filter((item) => item.match.status === "unmatched").length;
    const down = items.filter((item) => item.health === "down").length;
    const degraded = items.filter((item) => item.health === "degraded").length;
    const online = items.filter((item) => item.health === "online").length;
    const withProblems = items.filter((item) => item.problems.length > 0).length;
    const latencies = items
      .map((item) => item.metrics.latencyMs)
      .filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    const losses = items
      .map((item) => item.metrics.lossPct)
      .filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    const temperatures = items
      .map((item) => item.metrics.temperatureC)
      .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

    return {
      generatedAt: new Date().toISOString(),
      sources,
      counts: {
        units: units.length,
        matched,
        ambiguous,
        unmapped,
        online,
        degraded,
        down,
        withProblems,
        syncReady: items.filter((item) => item.match.syncReady).length,
        avgLatencyMs: latencies.length
          ? Math.round(latencies.reduce((sum, item) => sum + item, 0) / latencies.length)
          : null,
        avgLossPct: losses.length
          ? Number((losses.reduce((sum, item) => sum + item, 0) / losses.length).toFixed(2))
          : null,
        maxTemperatureC: temperatures.length ? Math.max(...temperatures) : null,
      },
      items,
    };
  }

  async getZabbixPrtgStyleReport(unit: UnitTelemetryInput, period: { from: Date; to: Date }) {
    const generatedAt = new Date();
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true, type: "zabbix" },
      orderBy: { code: "asc" },
    });

    const warnings: string[] = [];
    const candidates: Array<{
      integration: Integration;
      targetUrl: string;
      match: UnitHostMatch;
    }> = [];

    for (const integration of integrations) {
      const targetUrl = this.resolveTargetUrl(integration);

      try {
        const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

        if (!bearerToken) {
          warnings.push(`${integration.code}: credenciais Zabbix ausentes.`);
          continue;
        }

        try {
          const hosts = await this.zabbixRpc<ZabbixHostCandidate[]>(
            targetUrl,
            "host.get",
            this.zabbixHostLookupParams(),
            bearerToken,
          );
          const match = this.selectHostMatch(unit, hosts, integration, targetUrl);

          if (match.status === "matched" && match.hostId) {
            candidates.push({ integration, targetUrl, match });
          } else if (match.status === "ambiguous") {
            warnings.push(`${integration.code}: host ambíguo para ${unit.code}; relatório bloqueado nessa origem.`);
          }
        } finally {
          await this.safeZabbixLogout(targetUrl, logoutToken);
        }
      } catch (error) {
        warnings.push(`${integration.code}: ${error instanceof Error ? error.message : "falha ao consultar Zabbix"}.`);
      }
    }

    const selected = candidates.sort((a, b) => b.match.score - a.match.score)[0];

    const base = {
      generatedAt: generatedAt.toISOString(),
      source: "zabbix",
      deliveryStyle: "prtg-like",
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        timezone: "America/Araguaina",
      },
      unit: {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        city: unit.city,
        state: unit.state,
      },
      partner: unit.partner,
      warnings,
    };

    if (!selected) {
      return {
        ...base,
        integration: null,
        host: null,
        blocks: [],
        warnings: warnings.length
          ? warnings
          : [`Nenhum host Zabbix confiável foi encontrado para a unidade ${unit.code}.`],
      };
    }

    const { integration, targetUrl, match } = selected;
    const host = {
      status: match.status,
      score: match.score,
      confidence: match.confidence,
      integrationCode: match.integrationCode,
      integrationName: match.integrationName,
      hostId: match.hostId,
      host: match.host,
      hostName: match.hostName,
      hostStatus: match.hostStatus,
      matchedBy: match.matchedBy,
      candidates: match.candidates,
      syncReady: match.syncReady,
    };

    try {
      const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

      if (!bearerToken || !match.hostId) {
        return {
          ...base,
          integration: { id: integration.id, code: integration.code, name: integration.name },
          host,
          blocks: [],
          warnings: [...warnings, "Credenciais Zabbix ausentes para leitura de histórico."],
        };
      }

      try {
        const items = await this.zabbixRpc<ZabbixTelemetryItem[]>(
          targetUrl,
          "item.get",
          {
            output: [
              "itemid",
              "hostid",
              "name",
              "key_",
              "lastvalue",
              "lastclock",
              "units",
              "value_type",
              "status",
              "state",
              "error",
            ],
            hostids: [match.hostId],
            filter: { status: "0" },
            sortfield: "name",
          },
          bearerToken,
        );

        const selectedItems = this.selectReportItems(items);
        const historyByItem = await this.readReportHistory(targetUrl, bearerToken, selectedItems, period);
        const blocksByType = new Map<"traffic" | "ping" | "uptime", Array<Record<string, unknown>>>();

        for (const entry of selectedItems) {
          const rawPoints = historyByItem.get(entry.item.itemid) || [];
          const points = rawPoints.map((point) => {
            const value = this.parseNumber(point.value);

            return {
              timestamp: new Date(Number(point.clock) * 1000).toISOString(),
              value: value === null ? null : this.normalizeReportValue(entry.item, value, entry.profile),
            };
          });

          const fallbackValue = this.parseNumber(entry.item.lastvalue);
          const finalPoints =
            points.length || fallbackValue === null
              ? points
              : [
                  {
                    timestamp: entry.item.lastclock
                      ? new Date(Number(entry.item.lastclock) * 1000).toISOString()
                      : generatedAt.toISOString(),
                    value: this.normalizeReportValue(entry.item, fallbackValue, entry.profile),
                  },
                ];
          const values = finalPoints
            .map((point) => point.value)
            .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

          blocksByType.set(entry.profile.block, [
            ...(blocksByType.get(entry.profile.block) || []),
            {
              id: entry.item.itemid,
              name: entry.item.name,
              key: entry.item.key_,
              label: entry.profile.label,
              kind: entry.profile.kind,
              color: entry.profile.color,
              unit: entry.profile.unit,
              zabbixUnits: entry.item.units || "",
              points: finalPoints,
              stats: this.reportStats(values),
            },
          ]);
        }

        const blockOrder: Array<"traffic" | "ping" | "uptime"> = ["traffic", "ping", "uptime"];
        const blocks = blockOrder
          .map((block) => {
            const series = blocksByType.get(block) || [];
            if (!series.length) return null;

            const firstSeries = series[0] as { unit?: string } | undefined;
            const profile = selectedItems.find((entry) => entry.profile.block === block)?.profile;

            return {
              id: block,
              title: this.reportBlockTitle(block, unit.name),
              description: this.reportBlockDescription(block),
              sensorType: profile?.sensorType || "Sensor Zabbix",
              probePath: `${integration.name} > ${match.hostName || match.host || match.hostId}`,
              unit: firstSeries?.unit || "",
              series,
            };
          })
          .filter(Boolean);

        if (!blocks.length) {
          warnings.push("Nenhum item de tráfego, ping ou uptime com histórico numérico foi encontrado no host.");
        }

        return {
          ...base,
          integration: { id: integration.id, code: integration.code, name: integration.name },
          host,
          blocks,
          warnings,
        };
      } finally {
        await this.safeZabbixLogout(targetUrl, logoutToken);
      }
    } catch (error) {
      return {
        ...base,
        integration: { id: integration.id, code: integration.code, name: integration.name },
        host,
        blocks: [],
        warnings: [...warnings, error instanceof Error ? error.message : "Falha ao gerar relatório Zabbix."],
      };
    }
  }

  async syncUnitToZabbix(unit: UnitTelemetryInput): Promise<UnitZabbixSyncResult> {
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true, type: "zabbix" },
      orderBy: { code: "asc" },
    });

    if (!integrations.length) {
      return {
        ok: false,
        status: "skipped",
        message: "Nenhuma integração Zabbix ativa encontrada.",
      };
    }

    const candidates: Array<{
      integration: Integration;
      targetUrl: string;
      match: UnitHostMatch;
    }> = [];
    const sourceErrors: string[] = [];

    for (const integration of integrations) {
      const targetUrl = this.resolveTargetUrl(integration);

      try {
        const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

        if (!bearerToken) {
          sourceErrors.push(
            `${integration.code}: credenciais ausentes (configure authMode/token/usuario em /integracoes)`,
          );
          continue;
        }

        try {
          const hosts = await this.zabbixRpc<ZabbixHostCandidate[]>(
            targetUrl,
            "host.get",
            this.zabbixHostLookupParams(),
            bearerToken,
          );
          const match = this.selectHostMatch(unit, hosts, integration, targetUrl);

          if (match.status !== "unmatched") {
            candidates.push({ integration, targetUrl, match });
          }
        } finally {
          await this.safeZabbixLogout(targetUrl, logoutToken);
        }
      } catch (error) {
        sourceErrors.push(`${integration.code}: ${error instanceof Error ? error.message : "falha ao consultar"}`);
      }
    }

    const viable = candidates
      .filter((item) => item.match.status === "matched" && item.match.syncReady && item.match.hostId)
      .sort((a, b) => b.match.score - a.match.score);
    const best = viable[0];
    const second = viable[1];

    if (!best) {
      return {
        ok: false,
        status: "skipped",
        message:
          sourceErrors.length && !candidates.length
            ? `Não foi possível consultar Zabbix: ${sourceErrors.join("; ")}.`
            : unit.zabbixHost || unit.zabbixVisibleName
              ? `Nenhum host Zabbix corresponde ao vínculo manual informado. Revise o nome do host ou o nome visível antes de sincronizar.`
            : `Nenhum host com vínculo explícito foi encontrado. Use a tag nova.unit_code=${unit.code} no host correto antes de sincronizar.`,
      };
    }

    if (second && best.match.score - second.match.score < 12) {
      return {
        ok: false,
        status: "skipped",
        message: "Mais de um host Zabbix parece corresponder a esta unidade. Sincronização bloqueada por segurança.",
      };
    }

    const { integration, targetUrl, match } = best;

    try {
      const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

      if (!bearerToken || !match.hostId) {
        return {
          ok: false,
          status: "skipped",
          message: "Credenciais Zabbix ausentes para sincronização.",
        };
      }

      try {
        const [host] = await this.zabbixRpc<ZabbixHostCandidate[]>(
          targetUrl,
          "host.get",
          this.zabbixHostLookupParams({ hostids: [match.hostId] }),
          bearerToken,
        );

        if (!host) {
          return {
            ok: false,
            status: "failed",
            message: "Host Zabbix não encontrado no momento da sincronização.",
            integrationCode: integration.code,
            hostId: match.hostId,
          };
        }

        const managedTags = this.managedUnitTags(unit);
        const tags = this.mergeManagedUnitTags(host.tags || [], managedTags);
        const inventory = this.inventoryForUnit(unit);

        await this.zabbixRpc<boolean>(
          targetUrl,
          "host.update",
          {
            hostid: match.hostId,
            inventory_mode: 0,
            inventory,
            tags,
          },
          bearerToken,
        );

        return {
          ok: true,
          status: "synced",
          message: `Host ${host.name || host.host} sincronizado com ${unit.code}.`,
          integrationCode: integration.code,
          hostId: match.hostId,
          hostName: host.name || host.host,
          updatedTags: managedTags.length,
          updatedInventoryFields: Object.keys(inventory),
        };
      } finally {
        await this.safeZabbixLogout(targetUrl, logoutToken);
      }
    } catch (error) {
      return {
        ok: false,
        status: "failed",
        message: error instanceof Error ? error.message : "Falha ao atualizar host Zabbix.",
        integrationCode: integration.code,
        hostId: match.hostId,
        hostName: match.hostName || match.host,
      };
    }
  }

  async testConnectionByEntity(integration: Integration): Promise<IntegrationTestResult> {
    const targetUrl = this.resolveTargetUrl(integration);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      if (integration.type === "zabbix") {
        const version = await this.zabbixRpc<string>(targetUrl, "apiinfo.version", []);
        const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

        try {
          let monitoredHosts: number | undefined;
          let openProblems: number | undefined;

          if (bearerToken) {
            monitoredHosts = Number(
              await this.zabbixRpc<string | number>(
                targetUrl,
                "host.get",
                {
                  monitored_hosts: true,
                  countOutput: true,
                },
                bearerToken,
              ),
            );

            openProblems = Number(
              await this.zabbixRpc<string | number>(
                targetUrl,
                "problem.get",
                {
                  countOutput: true,
                },
                bearerToken,
              ),
            );
          }

          return {
            ok: true,
            message:
              bearerToken
                ? `Zabbix ${version} autenticado com sucesso`
                : `Zabbix ${version} respondeu sem autenticação`,
            targetUrl,
            latencyMs: Date.now() - startedAt,
            version,
            monitoredHosts,
            openProblems,
          };
        } finally {
          await this.safeZabbixLogout(targetUrl, logoutToken);
        }
      }

      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        message: `Endpoint respondeu com HTTP ${response.status}`,
        targetUrl,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Falha ao testar integração",
        targetUrl,
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(id: string) {
    const integration = await this.getIntegrationEntityByIdOrThrow(id);
    return this.testConnectionByEntity(integration);
  }

  async getZabbixSnapshotByEntity(integration: Integration): Promise<ZabbixSnapshot> {
    const targetUrl = this.resolveTargetUrl(integration);

    if (integration.type !== "zabbix") {
      return {
        ok: false,
        targetUrl,
        recentProblems: [],
        message: "Integração não é do tipo zabbix",
      };
    }

    try {
      const version = await this.zabbixRpc<string>(targetUrl, "apiinfo.version", []);
      const { bearerToken, logoutToken } = await this.getZabbixBearerToken(integration, targetUrl);

      if (!bearerToken) {
        return {
          ok: true,
          targetUrl,
          version,
          recentProblems: [],
          message: "Versão lida sem autenticação; configure credenciais para consultar hosts e problemas",
        };
      }

      try {
        const monitoredHosts = Number(
          await this.zabbixRpc<string | number>(
            targetUrl,
            "host.get",
            {
              monitored_hosts: true,
              countOutput: true,
            },
            bearerToken,
          ),
        );

        const openProblems = Number(
          await this.zabbixRpc<string | number>(
            targetUrl,
            "problem.get",
            {
              countOutput: true,
            },
            bearerToken,
          ),
        );

        const recentProblems = await this.zabbixRpc<
          Array<{
            eventid: string;
            name: string;
            severity: string;
            acknowledged: string;
            clock: string;
          }>
        >(
          targetUrl,
          "problem.get",
          {
            output: ["eventid", "name", "severity", "acknowledged", "clock"],
            recent: true,
            sortfield: ["eventid"],
            sortorder: "DESC",
            limit: 10,
          },
          bearerToken,
        );

        return {
          ok: true,
          targetUrl,
          version,
          monitoredHosts,
          openProblems,
          recentProblems,
          message: "Resumo Zabbix carregado com sucesso",
        };
      } finally {
        await this.safeZabbixLogout(targetUrl, logoutToken);
      }
    } catch (error) {
      return {
        ok: false,
        targetUrl,
        recentProblems: [],
        message: error instanceof Error ? error.message : "Falha ao consultar Zabbix",
      };
    }
  }
}
