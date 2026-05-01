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
        "nds-surface nova-surface overflow-hidden",
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
        "nds-badge nova-pill",
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
    <div className={cx("nds-table-shell nova-table-shell", className)}>
      {children}
    </div>
  );
}

export function TableWrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <TableShell className={className}>{children}</TableShell>;
}

export function DenseTable({ children }: { children: ReactNode }) {
  return <table className="nds-table nova-table">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
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
    <td className={cx("align-top", className)} {...props}>
      {children}
    </td>
  );
}

const tableActionClass =
  "nds-button whitespace-nowrap";

export function TableActionHeader({
  children = "Ação",
  className = "",
  ...props
}: {
  children?: ReactNode;
  className?: string;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx("nds-table-actions nova-table-actions", className)} {...props}>
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
    <TableCell className={cx("nds-table-actions nova-table-actions", className)} {...props}>
      {children}
    </TableCell>
  );
}

export function TableActionLink({
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={cx(tableActionClass, className)} data-variant="secondary" {...props} />;
}

export function TableActionAnchor({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"a">) {
  return <a className={cx(tableActionClass, className)} data-variant="secondary" {...props} />;
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
    <div className="nds-empty nova-empty"><div className="text-[13px] font-black tracking-[-0.01em] text-slate-50">{title}</div><div className="mt-2 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="nds-label nova-field-label">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="nds-page-header nova-page-header">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="nds-breadcrumb">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="nds-page-title">
          {title}
        </h1>
        {subtitle ? <p className="nds-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof toneMap | string;
  className?: string;
}) {
  return <TonePill tone={tone} className={className}>{children}</TonePill>;
}

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: keyof typeof toneMap | string;
}) {
  return (
    <div className="nds-stat-card nova-stat-card">
      <div className="nds-stat-top">
        <div className="nds-label">{label}</div>
        <span className="nds-dot" data-tone={tone} />
      </div>
      <div className="nds-stat-value">{value}</div>
      {detail ? <div className="nds-stat-detail">{detail}</div> : null}
    </div>
  );
}

export function FilterBar({
  children,
  actions,
  className = "",
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cx("nova-filter-bar p-4", className)}>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="nds-filter-grid">{children}</div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
    </Surface>
  );
}

export function RightPanel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <aside className="nds-panel nova-right-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-black tracking-[-0.02em] text-white">{title}</h2>
          {description ? <p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-4 grid gap-3">{children}</div>
    </aside>
  );
}

export function ChartCard({
  title,
  subtitle,
  tone = "info",
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: keyof typeof toneMap | string;
  children?: ReactNode;
}) {
  const dotClass = toneDotMap[tone] || toneDotMap.info;

  return (
    <div className="nds-chart-card nova-chart-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-black text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-[10px] leading-4 text-[var(--nova-text-muted)]">{subtitle}</p> : null}
        </div>
        <span className={cx("mt-1 h-2.5 w-2.5 rounded-full", dotClass)} />
      </div>
      <div className="nds-chart-area">
        {children || <FakeChart tone={tone} />}
      </div>
    </div>
  );
}

function FakeChart({ tone = "info" }: { tone?: keyof typeof toneMap | string }) {
  const stroke =
    tone === "attention" ? "#fbbf24" : tone === "critical" ? "#fb7185" : tone === "success" ? "#34d399" : "#f97316";

  return (
    <svg viewBox="0 0 640 170" className="h-full min-h-[160px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`nova-chart-${stroke.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, index) => (
        <line key={`h-${index}`} x1="0" x2="640" y1={20 + index * 30} y2={20 + index * 30} stroke="rgba(255,255,255,0.07)" />
      ))}
      {Array.from({ length: 9 }).map((_, index) => (
        <line key={`v-${index}`} x1={index * 80} x2={index * 80} y1="0" y2="160" stroke="rgba(255,255,255,0.045)" />
      ))}
      <path d="M0 126 C75 118 95 58 160 72 C240 91 240 132 320 94 C392 60 422 112 480 84 C555 48 585 68 640 38 L640 170 L0 170 Z" fill={`url(#nova-chart-${stroke.replace("#", "")})`} />
      <path d="M0 126 C75 118 95 58 160 72 C240 91 240 132 320 94 C392 60 422 112 480 84 C555 48 585 68 640 38" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Stepper({
  steps,
  activeIndex = 0,
}: {
  steps: Array<{ title: string; description?: string }>;
  activeIndex?: number;
}) {
  return (
    <div className="nova-stepper grid gap-2 md:grid-cols-3">
      {steps.map((step, index) => {
        const active = index === activeIndex;
        const completed = index < activeIndex;
        return (
          <div
            key={step.title}
            className={cx(
              "rounded-[14px] border px-4 py-3",
              active
                ? "border-orange-400/35 bg-orange-500/[0.13]"
                : completed
                  ? "border-emerald-400/22 bg-emerald-500/[0.08]"
                  : "border-white/[0.08] bg-[#121923]",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/20 text-xs font-black text-white">
                {index + 1}
              </span>
              <div className="text-sm font-black text-white">{step.title}</div>
            </div>
            {step.description ? <div className="mt-2 text-xs leading-5 text-slate-500">{step.description}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function ReportPreviewCard({
  title,
  format,
  includeCharts,
  units,
}: {
  title: string;
  format: string;
  includeCharts: boolean;
  units: number;
}) {
  return (
    <div className="nova-report-preview-card rounded-[14px] border border-white/[0.08] bg-[#121923] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Prévia</div>
          <div className="mt-2 text-base font-black text-white">{title}</div>
        </div>
        <TonePill tone="attention">{format}</TonePill>
      </div>
      <div className="mt-4 aspect-[0.72] rounded-[12px] border border-white/[0.08] bg-[#f8fafc] p-3 text-slate-900 shadow-inner">
        <div className="h-4 rounded-sm bg-orange-500" />
        <div className="mt-4 h-3 w-2/3 rounded-sm bg-slate-300" />
        <div className="mt-2 h-2 w-full rounded-sm bg-slate-200" />
        <div className="mt-1 h-2 w-5/6 rounded-sm bg-slate-200" />
        {includeCharts ? (
          <div className="mt-4 h-20 rounded-sm border border-slate-200 bg-white">
            <FakeChart tone="attention" />
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <div className="h-5 rounded-sm bg-slate-200" />
            <div className="h-5 rounded-sm bg-slate-200" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <span>{units} unidade(s)</span>
        <span>{includeCharts ? "com gráficos" : "somente indicadores"}</span>
      </div>
    </div>
  );
}
