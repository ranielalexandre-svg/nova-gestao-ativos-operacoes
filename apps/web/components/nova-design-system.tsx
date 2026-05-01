import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export type NovaLayoutVariant = "layoutA" | "layoutB" | "layoutC" | "layoutD" | "layoutE" | "layoutF" | "layoutG";
export type NovaTone = "neutral" | "primary" | "success" | "attention" | "warning" | "critical" | "danger" | "info" | "subtle" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function NovaThemeProvider({
  variant = "layoutA",
  children,
}: {
  variant?: NovaLayoutVariant;
  children: ReactNode;
}) {
  return <div data-nova-layout={variant}>{children}</div>;
}

export function NovaShell({ children, variant = "layoutA" }: { children: ReactNode; variant?: NovaLayoutVariant }) {
  return (
    <div className="nds-shell" data-nova-layout={variant}>
      <div className="nds-layout">{children}</div>
    </div>
  );
}

export function NovaSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="nds-sidebar">
      <div className="nds-sidebar-inner">{children}</div>
    </aside>
  );
}

export function NovaTopbar({ title = "Sistema de gestão operacional", actions }: { title?: string; actions?: ReactNode }) {
  return (
    <div className="nds-topbar">
      <div className="nds-topbar-title">
        <span className="nds-topbar-menu" aria-hidden="true">≡</span>
        <span>{title}</span>
      </div>
      {actions ? <div className="nds-topbar-actions">{actions}</div> : null}
    </div>
  );
}

export function NovaButton({
  asChild,
  href,
  variant = "secondary",
  className = "",
  children,
  ...props
}: {
  asChild?: boolean;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">) {
  const classNames = cx("nds-button", className);

  if (href) {
    return (
      <Link href={href} className={classNames} data-variant={variant} aria-disabled={props.disabled || undefined}>
        {children}
      </Link>
    );
  }

  if (asChild) return <span className={classNames} data-variant={variant}>{children}</span>;

  return (
    <button className={classNames} data-variant={variant} {...props}>
      {children}
    </button>
  );
}

export function NovaSurface({
  children,
  className = "",
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
}) {
  const Tag = as;
  return <Tag className={cx("nds-surface", className)}>{children}</Tag>;
}

export function NovaCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("nds-card", className)}>{children}</div>;
}

export function NovaPanel({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cx("nds-panel", className)}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-[13px] font-black tracking-[-0.02em] text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className={title || actions ? "mt-3 grid gap-2" : "grid gap-2"}>{children}</div>
    </aside>
  );
}

export function NovaPageHeader({
  eyebrow = "Nova",
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
    <header className="nds-page-header">
      <div className="min-w-0">
        <div className="nds-breadcrumb">{eyebrow}</div>
        <h1 className="nds-page-title">{title}</h1>
        {subtitle ? <p className="nds-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function NovaStatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: NovaTone | string;
}) {
  return (
    <div className="nds-stat-card">
      <div className="nds-stat-top">
        <div className="nds-label">{label}</div>
        <span className="nds-dot" data-tone={tone} />
      </div>
      <div className="nds-stat-value">{value}</div>
      {detail ? <div className="nds-stat-detail">{detail}</div> : null}
    </div>
  );
}

export function NovaBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: NovaTone | string;
  className?: string;
}) {
  return <span className={cx("nds-badge", className)} data-tone={tone}>{children}</span>;
}

export function NovaInput({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cx("nds-input", className)} {...props} />;
}

export function NovaSelect({ className = "", children, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cx("nds-select", className)} {...props}>{children}</select>;
}

export function NovaToggle({ checked = false }: { checked?: boolean }) {
  return <span className="nds-toggle" data-checked={checked ? "true" : "false"} aria-hidden="true" />;
}

export function NovaProgress({ value, className = "" }: { value: number; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("nds-progress-track", className)}>
      <div className="nds-progress-bar" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function NovaFilterBar({ children, actions, className = "" }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("nds-filter-bar", className)}>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="nds-filter-grid">{children}</div>
        {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function NovaTableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("nds-table-shell", className)}>{children}</div>;
}

export function NovaTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={cx("nds-table", className)}>{children}</table>;
}

export function NovaTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function NovaTableCell({ children, className = "", ...props }: { children: ReactNode; className?: string } & TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={className} {...props}>{children}</td>;
}

export function NovaTableActionHeader({ children = "Ação", className = "", ...props }: { children?: ReactNode; className?: string } & ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx("nds-table-actions", className)} {...props}>{children}</th>;
}

export function NovaTableActionCell({ children, className = "", ...props }: { children: ReactNode; className?: string } & TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("nds-table-actions", className)} {...props}>{children}</td>;
}

export function NovaTableActionLink({ className = "", ...props }: ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={cx("nds-button", className)} data-variant="secondary" {...props} />;
}

export function NovaChartCard({
  title,
  subtitle,
  tone = "primary",
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: NovaTone | string;
  children?: ReactNode;
}) {
  return (
    <div className="nds-chart-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-black text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-[10px] text-[var(--nova-text-muted)]">{subtitle}</p> : null}
        </div>
        <span className="nds-dot" data-tone={tone} />
      </div>
      <div className="nds-chart-area">{children || <NovaFakeChart tone={tone} />}</div>
    </div>
  );
}

export function NovaFakeChart({ tone = "primary" }: { tone?: NovaTone | string }) {
  const stroke = tone === "success" ? "var(--nova-success)" : tone === "attention" || tone === "warning" ? "var(--nova-warning)" : tone === "critical" || tone === "danger" ? "var(--nova-danger)" : tone === "info" ? "var(--nova-info)" : "var(--nova-primary)";
  return (
    <svg className="nds-chart-svg" viewBox="0 0 560 130" aria-hidden="true">
      <path d="M0 92 C42 88 60 54 99 56 C152 58 170 95 218 78 C266 61 282 46 331 62 C384 80 400 35 457 46 C500 54 526 39 560 24" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M0 92 C42 88 60 54 99 56 C152 58 170 95 218 78 C266 61 282 46 331 62 C384 80 400 35 457 46 C500 54 526 39 560 24 L560 130 L0 130 Z" fill={stroke} opacity="0.12" />
    </svg>
  );
}

export function NovaStepper({ steps, activeIndex = 0 }: { steps: Array<{ title: string; description?: string }>; activeIndex?: number }) {
  return (
    <div className="nds-stepper">
      {steps.map((step, index) => (
        <div key={step.title} className="nds-step" data-active={index === activeIndex ? "true" : "false"}>
          <div className="flex items-center gap-2">
            <NovaBadge tone={index === activeIndex ? "primary" : index < activeIndex ? "success" : "neutral"}>{index + 1}</NovaBadge>
            <div className="text-[12px] font-black text-white">{step.title}</div>
          </div>
          {step.description ? <div className="mt-2 text-[10px] leading-4 text-[var(--nova-text-muted)]">{step.description}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function NovaReportPreview({ title, format, includeCharts, units }: { title: string; format: string; includeCharts: boolean; units: number }) {
  return (
    <div className="nds-report-preview">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="nds-label">Prévia</div>
          <div className="mt-1 text-[13px] font-black text-white">{title}</div>
        </div>
        <NovaBadge tone="primary">{format}</NovaBadge>
      </div>
      <div className="nds-report-preview-page mt-3">
        <div className="h-3 rounded-sm bg-[var(--nova-primary)]" />
        <div className="mt-4 h-2 w-2/3 rounded-sm bg-slate-300" />
        <div className="mt-2 h-2 w-full rounded-sm bg-slate-200" />
        {includeCharts ? <div className="mt-4 h-20 rounded-sm border border-slate-200 bg-white"><NovaFakeChart tone="primary" /></div> : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--nova-text-muted)]">
        <span>{units} unidade(s)</span>
        <span>{includeCharts ? "com gráficos" : "indicadores"}</span>
      </div>
    </div>
  );
}

export function NovaKanban({ children }: { children: ReactNode }) {
  return <div className="nds-kanban">{children}</div>;
}

export function NovaKanbanColumn({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="nds-kanban-column p-[10px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[12px] font-black text-white">{title}</div>
        {typeof count === "number" ? <NovaBadge>{count}</NovaBadge> : null}
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

export function NovaEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="nds-empty">
      <div className="text-[13px] font-black text-white">{title}</div>
      <div className="mt-2 text-[11px] leading-5 text-[var(--nova-text-muted)]">{description}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function NovaTabs({ tabs }: { tabs: Array<{ href: string; label: string; active?: boolean; count?: number | string }> }) {
  return (
    <div className="nds-surface p-2">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={cx("nds-button justify-between", tab.active && "border-[var(--nova-primary)] bg-[var(--nova-primary-soft)] text-white")} data-variant="secondary">
            <span>{tab.label}</span>
            {typeof tab.count !== "undefined" ? <NovaBadge tone={tab.active ? "primary" : "neutral"}>{tab.count}</NovaBadge> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

export const NovaTableComponents = {
  Shell: NovaTableShell,
  Table: NovaTable,
  Head: NovaTableHead,
  Cell: NovaTableCell,
  ActionHeader: NovaTableActionHeader,
  ActionCell: NovaTableActionCell,
  ActionLink: NovaTableActionLink,
};
