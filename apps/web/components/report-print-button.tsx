"use client";

export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="nds-button"
      data-variant="primary"
    >
      Exportar PDF
    </button>
  );
}
