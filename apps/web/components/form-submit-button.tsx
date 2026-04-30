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

  const base =
    variant === "primary"
      ? "nova-form-submit rounded-[16px] border border-sky-400/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.22),rgba(37,99,235,0.20))] px-4 py-3 text-sm font-black text-slate-50 shadow-[0_14px_32px_rgba(14,165,233,0.12)] transition hover:border-sky-300/45 hover:bg-[#1b2946] disabled:opacity-60"
      : variant === "danger"
        ? "nova-form-submit rounded-[16px] border border-rose-400/35 bg-rose-500/14 px-4 py-3 text-sm font-black text-rose-50 shadow-[0_14px_32px_rgba(244,63,94,0.10)] transition hover:bg-rose-500/22 disabled:opacity-60"
        : "nova-form-submit rounded-[16px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-white/16 hover:bg-white/[0.08] disabled:opacity-60";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`nova-submit-button ${base} ${className}`.trim()}
    ><span className="inline-flex items-center justify-center gap-2">
        {pending ? <span className="nova-submit-spinner" aria-hidden="true" /> : null}
        <span>{pending ? pendingLabel : idleLabel}</span></span></button>
  );
}
