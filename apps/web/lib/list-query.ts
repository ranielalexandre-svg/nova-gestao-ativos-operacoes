export type RawSearchParams = Record<string, string | string[] | undefined>;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginationMeta;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function resolveSearchParams(
  input?: Promise<RawSearchParams> | RawSearchParams,
): Promise<RawSearchParams> {
  return Promise.resolve(input ?? {});
}

export function readStringParam(
  params: RawSearchParams,
  key: string,
  fallback = "",
) {
  return first(params[key]).trim() || fallback;
}

export function readPositiveIntParam(
  params: RawSearchParams,
  key: string,
  fallback: number,
) {
  const value = Number(first(params[key]));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function withParams(
  pathname: string,
  current: RawSearchParams,
  patch: Record<string, string | number | undefined | null>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    const normalized = first(value);
    if (normalized) query.set(key, normalized);
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") {
      query.delete(key);
    } else {
      query.set(key, String(value));
    }
  }

  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function buildApiQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}
