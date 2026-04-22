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
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();

  const base =
    variant === "primary"
      ? "rounded-[14px] border border-blue-400/30 bg-[#17213a] px-4 py-3 text-sm font-semibold text-slate-50 shadow-[0_12px_26px_rgba(0,0,0,0.22)] transition hover:bg-[#1b2946] disabled:opacity-60"
      : "rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={`${base} ${className}`.trim()}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
