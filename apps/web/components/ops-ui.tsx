import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const toneMap: Record<string, string> = {
  neutral: "neutral",
  subtle: "neutral",
  primary: "primary",
  info: "info",
  attention: "attention",
  warning: "warning",
  critical: "critical",
  danger: "danger",
  success: "success",
  violet: "primary",
  low: "neutral",
  medium: "info",
  high: "attention",
};

function normalizeTone(tone?: keyof typeof toneMap | string) {
  return toneMap[tone || "neutral"] || "neutral";
}

function toneColor(tone?: keyof typeof toneMap | string) {
  const normalized = normalizeTone(tone);

  if (normalized === "primary") return "var(--nova-primary)";
  if (normalized === "success") return "var(--nova-success)";
  if (normalized === "attention" || normalized === "warning") return "var(--nova-warning)";
  if (normalized === "critical" || normalized === "danger") return "var(--nova-danger)";
  if (normalized === "info") return "var(--nova-info)";

  return "var(--nova-text-dim)";
}

export type BarDatum = {
  label: string;
  value: number;
  tone?: keyof typeof toneMap | string;
  meta?: ReactNode;
  href?: string;
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

export function BarList({
  data,
  max,
  emptyLabel = "Sem dados para exibir.",
  valueFormatter = (value) => value.toLocaleString("pt-BR"),
  className = "",
}: {
  data: BarDatum[];
  max?: number;
  emptyLabel?: string;
  valueFormatter?: (value: number) => ReactNode;
  className?: string;
}) {
  const visible = data.filter((item) => Number.isFinite(item.value));
  const chartMax = Math.max(1, max ?? visible.reduce((largest, item) => Math.max(largest, item.value), 0));

  if (!visible.length) {
    return (
      <div className={cx("grid min-h-[102px] place-items-center rounded-[6px] border border-white/[0.06] bg-black/10 px-3 text-center text-[11px] leading-5 text-slate-500", className)}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cx("grid gap-2", className)}>
      {visible.map((item) => {
        const width = item.value > 0 ? Math.max(4, Math.min(100, (item.value / chartMax) * 100)) : 0;
        const barColor = toneColor(item.tone);
        const content = (
          <div className="rounded-[6px] border border-white/[0.06] bg-black/10 px-2 py-2">
            <div className="flex min-w-0 items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate font-bold text-slate-200">{item.label}</span>
              <span className="shrink-0 font-black text-white">{valueFormatter(item.value)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: barColor }} />
            </div>
            {item.meta ? <div className="mt-1 truncate text-[10px] text-slate-500">{item.meta}</div> : null}
          </div>
        );

        if (!item.href) return <div key={item.label}>{content}</div>;

        return (
          <Link key={item.label} href={item.href} className="block transition hover:opacity-90">
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function ProgressLine({
  label,
  value,
  tone = "primary",
  className = "",
}: {
  label: string;
  value: number;
  tone?: keyof typeof toneMap | string;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cx("nova-progress-line", className)} data-tone={normalizeTone(tone)}>
      <div className="nova-progress-line__meta">
        <span>{label}</span>
        <strong>{safeValue}%</strong>
      </div>
      <div className="nds-progress-track">
        <div className="nds-progress-bar" style={{ width: `${safeValue}%`, backgroundColor: toneColor(tone) }} />
      </div>
    </div>
  );
}

export function StackedMeter({
  segments,
  total,
  emptyLabel = "Sem dados para exibir.",
  valueFormatter = (value) => value.toLocaleString("pt-BR"),
}: {
  segments: BarDatum[];
  total?: number;
  emptyLabel?: string;
  valueFormatter?: (value: number) => ReactNode;
}) {
  const visible = segments.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const sum = total ?? visible.reduce((acc, item) => acc + item.value, 0);

  if (!sum) {
    return (
      <div className="grid min-h-[102px] place-items-center rounded-[6px] border border-white/[0.06] bg-black/10 px-3 text-center text-[11px] leading-5 text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {visible.map((item) => {
          return (
            <div
              key={item.label}
              style={{ width: `${Math.max(2, (item.value / sum) * 100)}%`, backgroundColor: toneColor(item.tone) }}
              title={`${item.label}: ${valueFormatter(item.value)}`}
            />
          );
        })}
      </div>
      <div className="grid gap-2">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toneColor(item.tone) }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-bold text-slate-100">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
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
    <div className={cx("nova-section-intro flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between", compact && "gap-2")}><div className="min-w-0">
        {eyebrow ? (
          <div className="nds-label">{eyebrow}</div>
        ) : null}
        <h2 className={cx("font-black text-slate-50", compact ? "mt-1 text-[14px]" : "mt-1 text-[16px]")}>
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-4xl text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</p> : null}
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
      className={cx("nds-badge nova-pill", className)}
      data-tone={normalizeTone(tone)}
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
        "nova-filter-chip inline-flex min-h-[30px] items-center gap-2 rounded-[4px] border px-2 py-1 text-[11px] font-black transition focus-visible:outline-none",
        active
          ? "border-[var(--nova-primary)] bg-[var(--nova-primary-soft)] text-white"
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

export function DenseTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={cx("nds-table nova-table", className)}>{children}</table>;
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
  "nds-button nova-table-action whitespace-nowrap";

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
    <div className="nova-kpi nds-stat-card transition"><div className="nds-stat-top"><div className="nds-label">{label}</div>
        {badgeLabel ? (
          <TonePill tone={tone}>{badgeLabel}</TonePill>
        ) : (
          <span aria-hidden="true" className="nds-dot" data-tone={normalizeTone(tone)} />
        )}
      </div><div className="nds-stat-value">{value}</div>
      {meta ? <div className="nds-stat-detail">{meta}</div> : null}
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
      className="nds-card block transition"
    ><div className="flex items-start justify-between gap-2"><div className="text-[12px] font-black text-slate-50">{title}</div>
        {badge}
      </div><div className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</div></Link>
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
    <div className="nds-card flex min-h-[34px] items-center justify-between gap-2"><div className="text-[11px] text-[var(--nova-text-muted)]">{label}</div><TonePill tone={tone}>{value}</TonePill></div>
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
    <div className="nds-empty nova-empty"><div className="text-[13px] font-black text-slate-50">{title}</div><div className="mt-2 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  label,
  hint,
}: {
  children?: ReactNode;
  htmlFor?: string;
  label?: ReactNode;
  hint?: ReactNode;
}) {
  const content = label ?? children;

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className="block">
        <span className="nds-label nova-field-label">{content}</span>
        {hint ? <span className="mt-1 block text-[10px] text-slate-500">{hint}</span> : null}
      </label>
    );
  }

  return (
    <div className="nds-label nova-field-label">
      {content}
      {hint ? <span className="mt-1 block text-[10px] text-slate-500 normal-case">{hint}</span> : null}
    </div>
  );
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
        <span className="nds-dot" data-tone={normalizeTone(tone)} />
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
    <Surface className={cx("nova-filter-bar", className)}>
      <div className="nova-filter-toolbar">
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
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-black text-white">{title}</h2>
          {description ? <p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-2 grid gap-2">{children}</div>
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
  return (
    <div className="nds-chart-card nova-chart-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-black text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-[10px] leading-4 text-[var(--nova-text-muted)]">{subtitle}</p> : null}
        </div>
        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toneColor(tone) }} />
      </div>
      <div className="nds-chart-area">
        {children || (
          <div className="grid min-h-[102px] place-items-center rounded-[6px] border border-white/[0.06] bg-black/10 px-3 text-center text-[11px] leading-5 text-slate-500">
            Sem dados para exibir.
          </div>
        )}
      </div>
    </div>
  );
}

function FakeChart({ tone = "info" }: { tone?: keyof typeof toneMap | string }) {
  const normalized = normalizeTone(tone);
  const stroke = toneColor(tone);

  return (
    <svg viewBox="0 0 640 132" className="h-full min-h-[118px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`nova-chart-${normalized}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, index) => (
        <line key={`h-${index}`} x1="0" x2="640" y1={18 + index * 23} y2={18 + index * 23} stroke="rgba(255,255,255,0.07)" />
      ))}
      {Array.from({ length: 9 }).map((_, index) => (
        <line key={`v-${index}`} x1={index * 80} x2={index * 80} y1="0" y2="124" stroke="rgba(255,255,255,0.045)" />
      ))}
      <path d="M0 98 C75 92 95 45 160 56 C240 70 240 104 320 74 C392 47 422 87 480 65 C555 37 585 52 640 30 L640 132 L0 132 Z" fill={`url(#nova-chart-${normalized})`} />
      <path d="M0 98 C75 92 95 45 160 56 C240 70 240 104 320 74 C392 47 422 87 480 65 C555 37 585 52 640 30" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
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
    <div className="nds-stepper nova-stepper">
      {steps.map((step, index) => {
        const active = index === activeIndex;
        const completed = index < activeIndex;
        return (
          <div
            key={step.title}
            className="nds-step"
            data-active={active}
            data-completed={completed}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-black/20 text-[10px] font-black text-white">
                {index + 1}
              </span>
              <div className="text-[11px] font-black text-white">{step.title}</div>
            </div>
            {step.description ? <div className="mt-1 text-[10px] leading-4 text-slate-500">{step.description}</div> : null}
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
    <div className="nds-report-preview nova-report-preview-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="nds-label">Prévia</div>
          <div className="mt-1 text-[13px] font-black text-white">{title}</div>
        </div>
        <TonePill tone="attention">{format}</TonePill>
      </div>
      <div className="nds-report-preview-page mt-2">
        <div className="h-3 rounded-sm bg-[var(--nova-primary)]" />
        <div className="mt-2 h-2.5 w-2/3 rounded-sm bg-white/[0.16]" />
        <div className="mt-2 h-2 w-full rounded-sm bg-white/[0.10]" />
        <div className="mt-1 h-2 w-5/6 rounded-sm bg-white/[0.10]" />
        {includeCharts ? (
          <div className="mt-2 h-20 rounded-sm border border-white/[0.08] bg-black/20">
            <FakeChart tone="attention" />
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            <div className="h-5 rounded-sm bg-white/[0.10]" />
            <div className="h-5 rounded-sm bg-white/[0.10]" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>{units} unidade(s)</span>
        <span>{includeCharts ? "com gráficos" : "somente indicadores"}</span>
      </div>
    </div>
  );
}
