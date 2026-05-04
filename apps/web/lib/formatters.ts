const FULL_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const SHORT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

function parseDate(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = "-",
) {
  if (!value) return fallback;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : fallback;
  }

  const date = parseDate(value);
  return date ? date.toLocaleDateString("pt-BR") : fallback;
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = "-",
) {
  const date = value ? parseDate(value) : null;
  return date ? date.toLocaleString("pt-BR", FULL_DATE_TIME_OPTIONS) : fallback;
}

export function formatShortDateTime(
  value: string | number | Date | null | undefined,
  fallback = "-",
) {
  const date = value ? parseDate(value) : null;
  return date ? date.toLocaleString("pt-BR", SHORT_DATE_TIME_OPTIONS) : fallback;
}

export function optionLabel<T extends string>(
  options: Array<{ value: T | string; label: string }>,
  value: T | string | null | undefined,
  fallback = "-",
) {
  if (!value) return fallback;
  return options.find((option) => option.value === value)?.label || value;
}
