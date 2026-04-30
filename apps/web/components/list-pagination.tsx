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
    <div className="flex flex-col gap-3 rounded-[16px] border border-white/[0.08] bg-[#0f141b] px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"><div>
        Página <span className="font-semibold text-slate-100">{meta.page}</span> de{" "}
        <span className="font-semibold text-slate-100">{meta.totalPages}</span> ·{" "}
        <span className="font-semibold text-slate-100">{meta.total}</span> registros
      </div><div className="flex items-center gap-2"><Link
          href={withParams(pathname, searchParams, {
            page: meta.page > 1 ? meta.page - 1 : 1,
          })}
          aria-disabled={!meta.hasPrev}
          className={`rounded-[12px] border px-3 py-2 font-semibold ${
            meta.hasPrev
              ? "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              : "pointer-events-none border-white/[0.05] bg-white/[0.02] text-slate-600"
          }`}
        >
          Anterior
        </Link><Link
          href={withParams(pathname, searchParams, {
            page: meta.page < meta.totalPages ? meta.page + 1 : meta.totalPages,
          })}
          aria-disabled={!meta.hasNext}
          className={`rounded-[12px] border px-3 py-2 font-semibold ${
            meta.hasNext
              ? "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              : "pointer-events-none border-white/[0.05] bg-white/[0.02] text-slate-600"
          }`}
        >
          Próxima
        </Link></div></div>
  );
}
