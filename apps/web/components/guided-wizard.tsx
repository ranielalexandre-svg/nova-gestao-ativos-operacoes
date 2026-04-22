import Link from "next/link";
import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function stepTone(state: "current" | "done" | "available" | "locked") {
  if (state === "current") return "border-sky-500/32 bg-sky-500/[0.14] text-white";
  if (state === "done") return "border-emerald-500/22 bg-emerald-500/10 text-emerald-100";
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
    <div className={cx("flex min-h-[66px] items-center gap-3 rounded-[14px] border px-4 py-3 transition", stepTone(state))}>
      <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xs font-semibold">
        {index}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-slate-400">{description}</div>
      </div>
    </div>
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
    <label htmlFor={htmlFor} className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function WizardSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/7 bg-black/20 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 truncate text-sm text-white">{value || "-"}</div>
    </div>
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
    <div className="rounded-[18px] border border-white/[0.08] bg-[#11171e] p-5 sm:p-6">
      <div>
        <div className="text-[16px] font-semibold tracking-tight text-slate-50">{title}</div>
        <div className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</div>
      </div>
      <div className="mt-5 border-t border-white/[0.08] pt-5">{children}</div>
    </div>
  );
}
