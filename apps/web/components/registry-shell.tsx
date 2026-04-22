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
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        compact
      />
    </Surface>
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
    <Surface className="p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {item.label}
                </div>
                <TonePill tone={item.tone || "neutral"}>
                  {item.tone === "neutral" || !item.tone ? "base" : item.tone}
                </TonePill>
              </div>
              <div className="mt-2 text-[24px] font-semibold tracking-tight text-slate-50">
                {item.value}
              </div>
              {item.meta ? (
                <div className="mt-1 text-sm leading-5 text-slate-400">{item.meta}</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-[14px] border border-white/[0.08] bg-[#0a0f15] px-4 py-4">
          <div className="text-sm font-semibold text-slate-50">{noteTitle}</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">{noteCopy}</div>
        </div>
      </div>
    </Surface>
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
    <Surface className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </div>
          {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h2>
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {meta}
            </div>
          ) : null}
          <div className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</div>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Surface>
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
    <section className={cx("grid gap-4", columnsClassName)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[16px] border border-white/[0.08] bg-[#0f141b] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </div>
            <TonePill tone={item.tone || "neutral"}>
              {item.tone === "neutral" || !item.tone ? "base" : item.tone}
            </TonePill>
          </div>
          <div className="mt-3 text-[26px] font-semibold tracking-tight text-slate-50">
            {item.value}
          </div>
          {item.detail ? (
            <div className="mt-1 text-sm leading-5 text-slate-400">{item.detail}</div>
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
    <div className={cx("grid gap-3", columnsClassName)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cx(
            "rounded-[14px] border border-white/[0.08] bg-[#0a0f15] p-4",
            item.span === "full" && "md:col-span-2",
          )}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {item.label}
          </div>
          <div
            className={cx(
              "mt-2 text-sm font-medium text-slate-100",
              item.breakWords && "break-all",
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
