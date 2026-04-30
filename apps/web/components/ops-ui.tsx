import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

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

const toneDotMap: Record<string, string> = {
  neutral: "bg-slate-500",
  subtle: "bg-slate-600",
  info: "bg-sky-400",
  attention: "bg-amber-400",
  critical: "bg-rose-400",
  success: "bg-emerald-400",
  violet: "bg-indigo-400",
  low: "bg-slate-500",
  medium: "bg-sky-400",
  high: "bg-amber-400",
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
        "nova-surface overflow-hidden rounded-[24px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(17,24,34,0.96),rgba(10,15,22,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.025]",
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
    <div className={cx("nova-section-intro flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", compact && "gap-3")}><div className="min-w-0">
        {eyebrow ? (
          <div className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>
        ) : null}
        <h2 className={cx("mt-2 font-black tracking-[-0.03em] text-slate-50", compact ? "text-[18px] sm:text-[20px]" : "text-[24px] sm:text-[28px]")}>
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400 sm:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
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
        "nova-pill inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.11em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
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
        "nova-filter-chip inline-flex min-h-10 items-center gap-2 rounded-[16px] border px-3.5 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35",
        active
          ? "border-sky-400/35 bg-sky-500/[0.16] text-sky-50 shadow-[0_10px_28px_rgba(14,165,233,0.12)]"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/16 hover:bg-white/[0.07] hover:text-white",
      )}
    ><span>{label}</span>
      {typeof count !== "undefined" ? <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-slate-400">{count}</span> : null}
    </Link>
  );
}

export function TableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("nova-table-shell overflow-x-auto rounded-[20px] border border-white/[0.09] bg-[#080d13] shadow-[0_18px_55px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.025]", className)}>
      {children}
    </div>
  );
}

export function TableWrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <TableShell className={className}>{children}</TableShell>;
}

export function DenseTable({ children }: { children: ReactNode }) {
  return <table className="nova-table min-w-full border-separate border-spacing-0 text-sm text-slate-200">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#111821]/95 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 backdrop-blur">
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
    <td className={cx("px-4 py-4 align-top", className)} {...props}>
      {children}
    </td>
  );
}

const tableActionClass =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.045] px-3.5 py-1.5 text-xs font-bold text-slate-200 transition hover:border-sky-400/25 hover:bg-sky-500/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35";

export function TableActionHeader({
  children = "Ação",
  className = "",
  ...props
}: {
  children?: ReactNode;
  className?: string;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx("nova-table-actions w-32 min-w-[8rem] px-4 py-3 text-right", className)} {...props}>
      {children}
    </th>
  );
}

export function TableActionCell({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableCell className={cx("nova-table-actions w-32 min-w-[8rem] text-right", className)} {...props}>
      {children}
    </TableCell>
  );
}

export function TableActionLink({
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={cx(tableActionClass, "focus-visible:ring-4 focus-visible:ring-sky-500/15", className)} {...props} />;
}

export function TableActionAnchor({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"a">) {
  return <a className={cx(tableActionClass, "focus-visible:ring-4 focus-visible:ring-sky-500/15", className)} {...props} />;
}

export function KpiTile({
  href,
  label,
  value,
  meta,
  tone = "neutral",
  badgeLabel,
}: {
  href?: string;
  label: string;
  value: string | number;
  meta?: string;
  tone?: keyof typeof toneMap | string;
  badgeLabel?: string;
}) {
  const content = (
    <div className="nova-kpi min-h-[118px] rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(17,24,34,0.95),rgba(10,15,22,0.95))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-[#121923]"><div className="flex items-start justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        {badgeLabel ? (
          <TonePill tone={tone}>{badgeLabel}</TonePill>
        ) : (
          <span
            aria-hidden="true"
            className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", toneDotMap[tone] || toneDotMap.neutral)}
          />
        )}
      </div><div className="mt-3 text-[28px] font-black tracking-[-0.04em] text-slate-50">{value}</div>
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
      className="rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(10,15,22,0.92))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-[#121923]"
    ><div className="flex items-start justify-between gap-3"><div className="text-sm font-black tracking-[-0.01em] text-slate-50">{title}</div>
        {badge}
      </div><div className="mt-2 text-sm leading-6 text-slate-400">{description}</div></Link>
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
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.09] bg-[#090f16] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"><div className="text-sm text-slate-400">{label}</div><TonePill tone={tone}>{value}</TonePill></div>
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
    <div className="nova-empty rounded-[22px] border border-dashed border-white/14 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.08),transparent_20rem),#090f16] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><div className="text-sm font-black tracking-[-0.01em] text-slate-50">{title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="nova-field-label text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{children}</div>;
}
