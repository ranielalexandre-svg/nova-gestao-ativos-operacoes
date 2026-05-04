import Link from "next/link";
import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function stepTone(state: "current" | "done" | "available" | "locked") {
  if (state === "current") return "border-[var(--nova-primary)] bg-[var(--nova-primary-soft)] text-white";
  if (state === "done") return "nds-step-complete";
  if (state === "available") {
    return "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]";
  }
  return "border-white/7 bg-black/20 text-slate-500";
}

export function WizardStep({
  index,
  title,
  description,
  state,
  href,
}: {
  index: number;
  title: string;
  description: string;
  state: "current" | "done" | "available" | "locked";
  href?: string;
}) {
  const content = (
    <div className={cx("flex min-h-[36px] items-center gap-2 rounded-[6px] border px-2 py-1.5 transition", stepTone(state))}><div className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[10px] font-black">
        {index}
      </div><div className="min-w-0"><div className="text-[11px] font-black">{title}</div><div className="mt-0.5 text-[10px] leading-4 text-slate-400">{description}</div></div></div>
  );

  if (!href || state === "current" || state === "locked") return content;
  return <Link href={href}>{content}</Link>;
}

export function WizardFieldLabel({
  htmlFor,
  label,
  hint,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block"><span className="nds-label">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-[10px] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function WizardSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="nds-card"><div className="nds-label">
        {label}
      </div><div className="mt-2 truncate text-[12px] font-bold text-white">{value || "-"}</div></div>
  );
}

export function WizardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="nds-panel"><div><div className="text-[13px] font-black text-slate-50">{title}</div><div className="mt-1 max-w-4xl text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</div></div><div className="mt-2 border-t border-[var(--nova-border-soft)] pt-2">{children}</div></div>
  );
}
