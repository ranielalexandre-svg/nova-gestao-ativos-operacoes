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
        className="nds-button"
        data-variant="danger"
      >
        Excluir
      </button>

      {open ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-2"><button
            type="button"
            aria-label="Cancelar exclusão"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(3,6,11,0.78)]"
          /><div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="nds-panel relative z-[131] w-full max-w-lg overflow-hidden"
          ><div className="border-b border-white/[0.08] px-3 py-2 sm:px-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="nds-label">
                    Exclusão
                  </div><h2
                    id="delete-dialog-title"
                    className="mt-2 text-[16px] font-black text-slate-50"
                  >
                    Excluir {entityLabel}?
                  </h2><p className="mt-2 text-[11px] leading-5 text-slate-400">
                    O cadastro sairá das telas operacionais, mas o histórico continuará preservado.
                  </p></div><button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="nds-icon-button shrink-0"
                >
                  ×
                </button></div></div><form action={formAction}><input type="hidden" name="id" value={entityId} /><input type="hidden" name="confirmDelete" value="yes" />
              {children}

              <div className="px-3 py-2 sm:px-3">
                {state.status !== "idle" ? (
                  <div
                    role={state.status === "error" ? "alert" : "status"}
                    className={`mb-2 rounded-[6px] border px-3 py-2 text-[11px] ${
                      state.status === "success"
                        ? "nds-notice-success"
                        : "nds-notice-error"
                    }`}
                  >
                    {state.message}
                  </div>
                ) : null}

                <div className="rounded-[6px] border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] font-semibold text-slate-100">
                  {entityName}
                </div></div><div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-3 py-2 sm:px-3"><button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="nds-button"
                  data-variant="secondary"
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
