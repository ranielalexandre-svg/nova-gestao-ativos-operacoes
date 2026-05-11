export type ContractStatus = "draft" | "active" | "expired" | "cancelled";
export type ContractStatusFilter = "all" | ContractStatus;

export type ContractPartner = {
  id: string;
  code: string;
  name: string;
};

export type ContractUnit = {
  id: string;
  role: string;
  status: string;
  addressLine: string | null;
  bandwidthLabel: string | null;
  bandwidthMbps: number | null;
  notes: string | null;
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    isActive: boolean;
    partnerId?: string;
  };
};

export type ContractService = {
  id: string;
  name: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  sortOrder: number;
};

export type ContractBilling = {
  id: string;
  referenceMonth: string;
  amountCents: number | null;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
};

export type ContractContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type ContractRow = {
  id: string;
  code: string;
  title: string | null;
  status: ContractStatus;
  type: string | null;
  source: string;
  sourceContractLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  signedAt: string | null;
  monthlyValueCents: number | null;
  paymentMethod: string | null;
  billingCycle: string | null;
  adjustmentIndex: string | null;
  renewalMode: string | null;
  loyaltyMonths: number | null;
  terminationPenalty: string | null;
  slaPercent: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  partner: ContractPartner;
  units: ContractUnit[];
  services: ContractService[];
  billings: ContractBilling[];
  contacts: ContractContact[];
  unitCount: number;
  serviceCount: number;
  billingCount: number;
  contactCount: number;
  totalBandwidthMbps: number;
  primaryContact: ContractContact | null;
  latestBilling: ContractBilling | null;
};

export const contractStatusOptions = ["all", "draft", "active", "expired", "cancelled"] as const;

export function isContractStatusFilter(value: string): value is ContractStatusFilter {
  return contractStatusOptions.includes(value as ContractStatusFilter);
}

export function contractStatusLabel(status: ContractStatusFilter) {
  switch (status) {
    case "active":
      return "Ativo";
    case "draft":
      return "Rascunho";
    case "expired":
      return "Vencido";
    case "cancelled":
      return "Cancelado";
    default:
      return "Todos";
  }
}

export function contractStatusTone(status: ContractStatusFilter) {
  switch (status) {
    case "active":
      return "green" as const;
    case "draft":
      return "orange" as const;
    case "expired":
      return "red" as const;
    case "cancelled":
      return "slate" as const;
    default:
      return "blue" as const;
  }
}

export function formatMoneyCents(value: number | null | undefined) {
  if (typeof value !== "number") return "não informado";
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export function formatContractDate(value: string | null | undefined) {
  if (!value) return "não informado";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function locationLabel(unit: ContractUnit["unit"]) {
  return [unit.city, unit.state].filter(Boolean).join("/") || "sem cidade";
}

export function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "N";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function contractCompleteness(contract: ContractRow) {
  const checks = [
    contract.partner.id,
    contract.unitCount > 0,
    contract.serviceCount > 0,
    contract.slaPercent !== null && contract.slaPercent !== undefined,
    contract.monthlyValueCents !== null && contract.monthlyValueCents !== undefined,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
