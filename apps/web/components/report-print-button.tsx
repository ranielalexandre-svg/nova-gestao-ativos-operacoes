"use client";

export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
    >
      Exportar PDF
    </button>
  );
}
