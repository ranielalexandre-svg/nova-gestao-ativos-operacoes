"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  idleActionFeedback,
  type ActionFeedbackState,
} from "@/lib/action-state";

type OperationalDeletePanelProps = {
  action: (state: ActionFeedbackState, formData: FormData) => Promise<ActionFeedbackState>;
  entityId: string;
  entityLabel: string;
  entityName: string;
  blockedReason?: string;
  children?: ReactNode;
};

export function OperationalDeletePanel({
  action,
  entityId,
  entityLabel,
  entityName,
  blockedReason,
  children,
}: OperationalDeletePanelProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idleActionFeedback);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (blockedReason) return null;

  return (
    <><button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-rose-400/25 bg-rose-500/[0.08] px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/[0.14] hover:text-white"
      >
        Excluir
      </button>

      {open ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6"><button
            type="button"
            aria-label="Cancelar exclusão"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(3,6,11,0.78)] backdrop-blur-[10px]"
          /><div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="relative z-[131] w-full max-w-lg overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,#111720,#0d1219)] shadow-[0_34px_90px_rgba(0,0,0,0.45)]"
          ><div className="border-b border-white/[0.08] px-5 py-5 sm:px-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/80">
                    Exclusão
                  </div><h2
                    id="delete-dialog-title"
                    className="mt-2 text-[22px] font-semibold tracking-tight text-slate-50"
                  >
                    Excluir {entityLabel}?
                  </h2><p className="mt-2 text-sm leading-6 text-slate-400">
                    O cadastro sairá das telas operacionais, mas o histórico continuará preservado.
                  </p></div><button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-lg text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  ×
                </button></div></div><form action={formAction}><input type="hidden" name="id" value={entityId} /><input type="hidden" name="confirmDelete" value="yes" />
              {children}

              <div className="px-5 py-5 sm:px-6">
                {state.status !== "idle" ? (
                  <div
                    role={state.status === "error" ? "alert" : "status"}
                    className={`mb-4 rounded-[14px] border px-4 py-3 text-sm ${
                      state.status === "success"
                        ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-100"
                        : "border-rose-500/25 bg-rose-500/12 text-rose-100"
                    }`}
                  >
                    {state.message}
                  </div>
                ) : null}

                <div className="rounded-[16px] border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-semibold text-slate-100">
                  {entityName}
                </div></div><div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-4 sm:px-6"><button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Cancelar
                </button><FormSubmitButton
                  idleLabel={`Excluir ${entityLabel}`}
                  pendingLabel="Excluindo..."
                  variant="danger"
                  className="min-w-[148px]"
                /></div></form></div></div>
      ) : null}
    </>
  );
}
