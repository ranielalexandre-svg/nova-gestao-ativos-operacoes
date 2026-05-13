import NovaUnidadesView, {
  type NovaUnitsListResponse,
  type NovaUnitsSearchState,
} from "@/components/unidades/cadastro-unidades-view";
import { apiJson } from "@/lib/server-api";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";

const activeOptions = ["all", "true", "false"] as const;
const sortByOptions = ["createdAt", "code", "name", "city", "state"] as const;
const sortDirOptions = ["asc", "desc"] as const;
const pageSizeOptions = [10, 20, 50] as const;

function isStringOption<T extends readonly string[]>(
  options: T,
  value: string,
): value is T[number] {
  return options.includes(value);
}

function isNumberOption<T extends readonly number[]>(
  options: T,
  value: number,
): value is T[number] {
  return options.includes(value);
}

function readActive(params: RawSearchParams): NovaUnitsSearchState["active"] {
  const value = readStringParam(params, "active", "true");
  return isStringOption(activeOptions, value) ? value : "true";
}

function readSortBy(params: RawSearchParams): NovaUnitsSearchState["sortBy"] {
  const value = readStringParam(params, "sortBy", "createdAt");
  return isStringOption(sortByOptions, value) ? value : "createdAt";
}

function readSortDir(params: RawSearchParams): NovaUnitsSearchState["sortDir"] {
  const value = readStringParam(params, "sortDir", "desc");
  return isStringOption(sortDirOptions, value) ? value : "desc";
}

function readPageSize(params: RawSearchParams): NovaUnitsSearchState["pageSize"] {
  const value = readPositiveIntParam(params, "pageSize", 10);
  return isNumberOption(pageSizeOptions, value) ? value : 10;
}

export default async function UnidadesPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const resolved = await resolveSearchParams(searchParams);

  const state: NovaUnitsSearchState = {
    q: readStringParam(resolved, "q", ""),
    active: readActive(resolved),
    sortBy: readSortBy(resolved),
    sortDir: readSortDir(resolved),
    page: readPositiveIntParam(resolved, "page", 1),
    pageSize: readPageSize(resolved),
  };

  let response: NovaUnitsListResponse;
  let error = "";

  try {
    response = await apiJson<NovaUnitsListResponse>(
      `/units${buildApiQuery({
        q: state.q,
        active: state.active,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        page: state.page,
        pageSize: state.pageSize,
      })}`,
    );
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Não foi possível carregar as unidades.";
    response = {
      items: [],
      meta: {
        page: state.page,
        pageSize: state.pageSize,
        total: 0,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    };
  }

  return <NovaUnidadesView response={response} state={state} error={error} />;
}
