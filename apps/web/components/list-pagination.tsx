import Link from "next/link";
import { type PaginationMeta, type RawSearchParams, withParams } from "@/lib/list-query";

export function ListPagination({
  pathname,
  searchParams,
  meta,
}: {
  pathname: string;
  searchParams: RawSearchParams;
  meta: PaginationMeta;
}) {
  if (meta.totalPages <= 1) return null;

  return (
    <div className="nds-card flex flex-col gap-2 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><div>
        Página <span className="font-semibold text-slate-100">{meta.page}</span> de{" "}
        <span className="font-semibold text-slate-100">{meta.totalPages}</span> ·{" "}
        <span className="font-semibold text-slate-100">{meta.total}</span> registros
      </div><div className="flex items-center gap-2"><Link
          href={withParams(pathname, searchParams, {
            page: meta.page > 1 ? meta.page - 1 : 1,
          })}
          aria-disabled={!meta.hasPrev}
          className={`nds-button ${
            meta.hasPrev
              ? "text-slate-100"
              : "pointer-events-none text-slate-600 opacity-45"
          }`}
          data-variant="secondary"
        >
          Anterior
        </Link><Link
          href={withParams(pathname, searchParams, {
            page: meta.page < meta.totalPages ? meta.page + 1 : meta.totalPages,
          })}
          aria-disabled={!meta.hasNext}
          className={`nds-button ${
            meta.hasNext
              ? "text-slate-100"
              : "pointer-events-none text-slate-600 opacity-45"
          }`}
          data-variant="secondary"
        >
          Próxima
        </Link></div></div>
  );
}
