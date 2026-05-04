import type { ReactNode } from "react";
import { SectionIntro, Surface, TonePill } from "@/components/ops-ui";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function RegistryHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Surface className="nova-registry-hero"><SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        compact
      /></Surface>
  );
}

export function RegistrySummaryStrip({
  items,
  noteTitle,
  noteCopy,
}: {
  items: Array<{
    label: string;
    value: string | number;
    meta?: string;
    tone?: string;
  }>;
  noteTitle: string;
  noteCopy: string;
}) {
  return (
    <Surface className="nova-registry-summary"><div className="nova-side-grid nova-side-grid--300 xl:items-stretch"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="nova-summary-card nds-stat-card"
            ><div className="nds-stat-top"><div className="nds-label">
                  {item.label}
                </div><TonePill tone={item.tone || "neutral"}>
                  {item.tone === "neutral" || !item.tone ? "base" : item.tone}
                </TonePill></div><div className="nds-stat-value">
                {item.value}
              </div>
              {item.meta ? (
                <div className="nds-stat-detail">{item.meta}</div>
              ) : null}
            </div>
          ))}
        </div><div className="nds-card"><div className="text-[12px] font-black text-slate-50">{noteTitle}</div><div className="mt-1 text-[11px] leading-5 text-slate-400">{noteCopy}</div></div></div></Surface>
  );
}

export function RegistryDetailHero({
  eyebrow,
  title,
  description,
  badges,
  meta,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Surface className="nova-detail-hero"><div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0"><div className="nds-label">
            {eyebrow}
          </div>
          {badges ? <div className="mt-2 flex flex-wrap gap-2">{badges}</div> : null}
          <h2 className="mt-2 text-[18px] font-black text-white">
            {title}
          </h2>
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {meta}
            </div>
          ) : null}
          <div className="mt-1 max-w-4xl text-[11px] leading-5 text-slate-400">{description}</div></div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div></Surface>
  );
}

export function RegistryMetricGrid({
  items,
  columnsClassName = "md:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    tone?: string;
  }>;
  columnsClassName?: string;
}) {
  return (
    <section className={cx("grid gap-2", columnsClassName)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="nova-registry-metric nds-stat-card"
        ><div className="nds-stat-top"><div className="nds-label">
              {item.label}
            </div><TonePill tone={item.tone || "neutral"}>
              {item.tone === "neutral" || !item.tone ? "base" : item.tone}
            </TonePill></div><div className="nds-stat-value">
            {item.value}
          </div>
          {item.detail ? (
            <div className="nds-stat-detail">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function RegistryInfoGrid({
  items,
  columnsClassName = "md:grid-cols-2",
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    span?: "full";
    breakWords?: boolean;
  }>;
  columnsClassName?: string;
}) {
  return (
    <div className={cx("grid gap-2", columnsClassName)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cx(
            "nova-info-card nds-card",
            item.span === "full" && "md:col-span-2",
          )}
        ><div className="nds-label">
            {item.label}
          </div><div
            className={cx(
              "mt-1 text-[12px] font-medium text-slate-100",
              item.breakWords && "break-all",
            )}
          >
            {item.value}
          </div></div>
      ))}
    </div>
  );
}
