export type LegacyLink = {
  legacyId: string;
  partnerCode: string;
  serviceType: string;
  connectionType: string;
  routerPort: string;
  technology: string;
  latency: string;
  macOnu: string;
  phone: string;
  notes: string;
  contractIxc: string;
};

export type LegacyPartnerContact = {
  legacyId: string;
  city: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
};

export type LegacyPartner = {
  code: string;
  name: string;
  contacts: LegacyPartnerContact[];
  legacyContactIds: string[];
  primaryUnitCount: number;
  backupUnitCount: number;
};

export type LegacyUnit = {
  key: string;
  code: string;
  name: string;
  group: string;
  city: string;
  state: string;
  partnerCode: string;
  legacyContactIds: string[];
  links: LegacyLink[];
  backupLinks: LegacyLink[];
  phones: string[];
  contracts: string[];
  notes: string[];
};

export type LegacyEquipment = {
  tag: string;
  name: string;
  type: string;
  serialNumber: string;
  status: string;
  unitKey: string;
  unitCode: string;
  partnerCode: string;
  source: string;
  legacyId: string;
};

export type LegacyStarlink = {
  legacyId: string;
  antennaId: string;
  email: string;
  password: string;
  plan: string;
  card: string;
  localRaw: string;
  localLegacyContactId: string;
  localName: string;
  unitKey: string;
  kitSerial: string;
  antennaSerial: string;
  ipvpn: string;
  installer: string;
  installedAt: string;
  notes: string;
};

export type LegacyStarlinkHistory = {
  legacyId: string;
  starlinkLegacyId: string;
  action: string;
  details: string;
  user: string;
  datetime: string;
};

export type LegacyBundle = {
  version: number;
  generatedAt: string;
  redactedSecrets: boolean;
  sources: Record<string, string>;
  summary: {
    raw: Record<string, number>;
    normalized: Record<string, number>;
  };
  normalized: {
    partners: LegacyPartner[];
    units: LegacyUnit[];
    equipments: LegacyEquipment[];
    starlinks: LegacyStarlink[];
    starlinkHistory: LegacyStarlinkHistory[];
  };
  raw?: Record<string, unknown[]>;
};
