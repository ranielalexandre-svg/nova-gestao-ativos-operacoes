import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode, TdHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const toneMap: Record<string, string> = {
  neutral: "border-slate-700/70 bg-slate-900/70 text-slate-300",
  subtle: "border-white/10 bg-white/[0.04] text-slate-300",
  info: "border-sky-500/25 bg-sky-500/12 text-sky-200",
  attention: "border-amber-500/28 bg-amber-500/12 text-amber-200",
  critical: "border-rose-500/28 bg-rose-500/12 text-rose-200",
  success: "border-emerald-500/28 bg-emerald-500/12 text-emerald-200",
  violet: "border-indigo-500/28 bg-indigo-500/12 text-indigo-200",
  low: "border-slate-700/70 bg-slate-900/70 text-slate-300",
  medium: "border-sky-500/25 bg-sky-500/12 text-sky-200",
  high: "border-amber-500/28 bg-amber-500/12 text-amber-200",
};

export function Surface({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx(
        "nova-surface overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0f141b] shadow-[0_18px_42px_rgba(0,0,0,0.22)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("nova-section-intro flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", compact && "gap-3")}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
        ) : null}
        <h2 className={cx("mt-1 font-semibold tracking-tight text-slate-50", compact ? "text-[15px]" : "text-[19px]")}>
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function TonePill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof toneMap | string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "nova-pill inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
        toneMap[tone] || toneMap.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FilterChip({
  href,
  active = false,
  label,
  count,
}: {
  href: string;
  active?: boolean;
  label: string;
  count?: string | number;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center gap-2 rounded-[14px] border px-3.5 py-2 text-sm font-semibold transition",
        active
          ? "border-sky-500/35 bg-sky-500/14 text-sky-100"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/16 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <span>{label}</span>
      {typeof count !== "undefined" ? <span className="text-slate-500">{count}</span> : null}
    </Link>
  );
}

export function TableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("nova-table-shell overflow-x-auto rounded-[16px] border border-white/[0.08] bg-[#0a0f15]", className)}>
      {children}
    </div>
  );
}

export function TableWrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <TableShell className={className}>{children}</TableShell>;
}

export function DenseTable({ children }: { children: ReactNode }) {
  return <table className="nova-table min-w-full border-collapse text-sm text-slate-200">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#151a21] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {children}
    </thead>
  );
}

export function TableCell({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-4 py-3.5 align-top", className)} {...props}>
      {children}
    </td>
  );
}

export function KpiTile({
  href,
  label,
  value,
  meta,
  tone = "neutral",
}: {
  href?: string;
  label: string;
  value: string | number;
  meta?: string;
  tone?: keyof typeof toneMap | string;
}) {
  const content = (
    <div className="nova-kpi min-h-[112px] rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4 transition hover:border-white/14 hover:bg-[#121923]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <TonePill tone={tone}>{tone === "neutral" ? "base" : tone}</TonePill>
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-tight text-slate-50">{value}</div>
      {meta ? <div className="mt-2 text-sm leading-5 text-slate-400">{meta}</div> : null}
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

export function ActionTile({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[16px] border border-white/[0.08] bg-[#10161d] p-4 transition hover:border-white/14 hover:bg-[#121923]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-50">{title}</div>
        {badge}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
    </Link>
  );
}

export function InlineStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof toneMap | string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3">
      <div className="text-sm text-slate-400">{label}</div>
      <TonePill tone={tone}>{value}</TonePill>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="nova-empty rounded-[16px] border border-dashed border-white/12 bg-[#0a0f15] p-10 text-center">
      <div className="text-sm font-semibold text-slate-50">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="nova-field-label text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</div>;
}
