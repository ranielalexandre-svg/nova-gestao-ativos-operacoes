"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`nds-button nova-form-submit nova-submit-button ${className}`.trim()}
      data-variant={variant}
    ><span className="inline-flex items-center justify-center gap-2">
        {pending ? <span className="nova-submit-spinner" aria-hidden="true" /> : null}
        <span>{pending ? pendingLabel : idleLabel}</span></span></button>
  );
}
