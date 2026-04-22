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
  variant?: "primary" | "secondary";
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
      ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-100"
      : state.status === "error"
        ? "border-rose-500/25 bg-rose-500/12 text-rose-100"
        : "";

  return (
    <form action={formAction} className={className}>
      {state.status !== "idle" ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={`mb-4 rounded-[14px] border px-4 py-3 text-sm ${tone} ${noticeClassName}`.trim()}
        >
          {state.message}
        </div>
      ) : null}

      {children}

      {!hideSubmit ? (
        <div className={`mt-4 flex items-center justify-end ${submitClassName}`.trim()}>
          <FormSubmitButton
            idleLabel={submitLabel}
            pendingLabel={pendingLabel}
            variant={variant}
            className="min-w-[148px]"
          />
        </div>
      ) : null}
    </form>
  );
}
