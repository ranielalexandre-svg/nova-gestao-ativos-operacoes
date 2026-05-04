export const occurrenceSeverityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export const occurrenceStatusOptions = [
  { value: "open", label: "Aberta" },
  { value: "investigating", label: "Em análise" },
  { value: "resolved", label: "Resolvida" },
  { value: "cancelled", label: "Cancelada" },
];

export const maintenanceTypeOptions = [
  { value: "preventive", label: "Preventiva" },
  { value: "corrective", label: "Corretiva" },
  { value: "inspection", label: "Inspeção" },
];

export const maintenanceStatusOptions = [
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em execução" },
  { value: "done", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

export const equipmentStatusOptions = [
  { value: "active", label: "Ativo" },
  { value: "stock", label: "Estoque" },
  { value: "repair", label: "Reparo" },
  { value: "retired", label: "Retirado" },
];

export const exceptionQueueOptions = [
  { value: "ops-general", label: "Geral" },
  { value: "ops-integracoes", label: "Integrações" },
  { value: "ops-ocorrencias", label: "Alertas" },
  { value: "ops-manutencao", label: "Chamado" },
  { value: "ops-sla", label: "SLA" },
  { value: "ops-automacoes", label: "Automações" },
];

export const exceptionKindOptions = [
  { value: "generic", label: "Geral" },
  { value: "sla", label: "SLA" },
  { value: "integration", label: "Integração" },
  { value: "occurrence", label: "Alerta" },
  { value: "maintenance", label: "Chamado" },
  { value: "automation", label: "Automação" },
];

export const exceptionStatusOptions = [
  { value: "open", label: "Aberta" },
  { value: "acknowledged", label: "Reconhecida" },
  { value: "silenced", label: "Silenciada" },
  { value: "resolved", label: "Resolvida" },
];

export const exceptionTriageOptions = [
  { value: "pending", label: "Pendente" },
  { value: "triaged", label: "Triada" },
  { value: "closed", label: "Fechada" },
];

function labelFor(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLocaleLowerCase("pt-BR")}${value.slice(1)}` : value;
}

export function occurrenceSeverityLabel(value: string) {
  return labelFor(occurrenceSeverityOptions, value);
}

export function occurrenceSeverityTone(value: string) {
  if (value === "critical") return "critical";
  if (value === "high") return "attention";
  if (value === "medium") return "info";
  return "subtle";
}

export function occurrenceStatusLabel(value: string) {
  return labelFor(occurrenceStatusOptions, value);
}

export function occurrenceStatusTone(value: string) {
  if (value === "resolved") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "investigating") return "info";
  return "attention";
}

export function maintenanceTypeLabel(value: string) {
  return labelFor(maintenanceTypeOptions, value);
}

export function maintenanceTypeTone(value: string) {
  if (value === "corrective") return "attention";
  if (value === "inspection") return "info";
  return "success";
}

export function maintenanceStatusLabel(value: string) {
  return labelFor(maintenanceStatusOptions, value);
}

export function maintenanceStatusTone(value: string) {
  if (value === "done") return "success";
  if (value === "cancelled") return "subtle";
  if (value === "in_progress") return "info";
  return "attention";
}

export function equipmentStatusLabel(value: string, casing: "lower" | "title" = "lower") {
  const label = labelFor(equipmentStatusOptions, value);
  return casing === "lower" ? lowerFirst(label) : label;
}

export function equipmentStatusTone(value: string, isActive = true) {
  if (!isActive || value === "retired") return "subtle";
  if (value === "repair") return "attention";
  if (value === "active") return "success";
  return "neutral";
}

export function exceptionQueueLabel(value: string) {
  return labelFor(exceptionQueueOptions, value);
}

export function exceptionKindLabel(value: string) {
  return labelFor(exceptionKindOptions, value);
}

export function exceptionStatusLabel(value: string) {
  return labelFor(exceptionStatusOptions, value);
}

export function exceptionStatusTone(value: string) {
  if (value === "resolved") return "success";
  if (value === "acknowledged") return "info";
  if (value === "silenced") return "violet";
  return "attention";
}

export function exceptionTriageLabel(value: string) {
  return labelFor(exceptionTriageOptions, value);
}

export function exceptionTriageTone(value: string) {
  if (value === "closed") return "success";
  if (value === "triaged") return "info";
  return "attention";
}

export function exceptionLabel(value: string) {
  return (
    exceptionKindOptions.find((option) => option.value === value)?.label ||
    occurrenceSeverityOptions.find((option) => option.value === value)?.label ||
    exceptionStatusOptions.find((option) => option.value === value)?.label ||
    exceptionTriageOptions.find((option) => option.value === value)?.label ||
    value
  );
}

export function exceptionTone(value: string) {
  if (value === "critical") return "critical";
  if (["high", "open", "pending"].includes(value)) return "attention";
  if (["medium", "acknowledged", "triaged"].includes(value)) return "info";
  if (["resolved", "closed"].includes(value)) return "success";
  if (value === "silenced") return "violet";
  return "neutral";
}
