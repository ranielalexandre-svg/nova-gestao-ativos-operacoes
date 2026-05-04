"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  idleActionFeedback,
  type ActionFeedbackState,
} from "@/lib/action-state";

type ActionFormProps = {
  action: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  children: ReactNode;
  className?: string;
  noticeClassName?: string;
  submitClassName?: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  hideSubmit?: boolean;
};

export function ActionForm({
  action,
  children,
  className = "",
  noticeClassName = "",
  submitClassName = "",
  submitLabel,
  pendingLabel,
  variant = "primary",
  hideSubmit = false,
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, idleActionFeedback);

  const tone =
    state.status === "success"
      ? "nds-notice-success"
      : state.status === "error"
        ? "nds-notice-error"
        : "";

  return (
    <form action={formAction} className={`nova-action-form ${className}`.trim()}>
      {state.status !== "idle" ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={`nova-action-notice mb-2 rounded-[6px] border px-3 py-2 text-[11px] font-semibold ${tone} ${noticeClassName}`.trim()}
        >
          {state.message}
        </div>
      ) : null}

      {children}

      {!hideSubmit ? (
        <div className={`nova-form-actions mt-2 flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center ${submitClassName}`.trim()}><FormSubmitButton
            idleLabel={submitLabel}
            pendingLabel={pendingLabel}
            variant={variant}
            className="min-w-[124px]"
          /></div>
      ) : null}
    </form>
  );
}
