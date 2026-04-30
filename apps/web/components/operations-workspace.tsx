import type { ReactNode } from "react";
import { ActionTile, SectionIntro, Surface, TonePill } from "@/components/ops-ui";

export function OperationsLinkGrid({
  eyebrow = "Trilho",
  title,
  description,
  links,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  links: Array<{
    href: string;
    title: string;
    description: string;
    badge?: ReactNode;
  }>;
}) {
  return (
    <Surface className="p-5 sm:p-6"><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {links.map((link) => (
          <ActionTile
            key={`${link.href}-${link.title}`}
            href={link.href}
            title={link.title}
            description={link.description}
            badge={link.badge}
          />
        ))}
      </div></Surface>
  );
}

export function OperationsGuidanceGrid({
  eyebrow = "Uso",
  title,
  description,
  items,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: Array<{
    label: string;
    title: string;
    description: string;
    tone?: string;
  }>;
}) {
  return (
    <Surface className="p-5 sm:p-6"><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="mt-5 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.title}`}
            className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"
          ><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.label}
              </div><TonePill tone={item.tone || "neutral"}>
                {item.tone === "neutral" || !item.tone ? "base" : item.tone}
              </TonePill></div><div className="mt-3 text-sm font-semibold text-slate-50">{item.title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{item.description}</div></div>
        ))}
      </div></Surface>
  );
}

export function OperationsCommandDeck({
  eyebrow = "Fluxo",
  title,
  description,
  links,
  items,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  links: Array<{
    href: string;
    title: string;
    description: string;
    badge?: ReactNode;
  }>;
  items: Array<{
    label: string;
    title: string;
    description: string;
    tone?: string;
  }>;
}) {
  return (
    <Surface className="p-5 sm:p-6"><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]"><div className="grid gap-3 md:grid-cols-2">
          {links.map((link) => (
            <ActionTile
              key={`${link.href}-${link.title}`}
              href={link.href}
              title={link.title}
              description={link.description}
              badge={link.badge}
            />
          ))}
        </div><div className="grid gap-3">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.title}`}
              className="rounded-[16px] border border-white/[0.08] bg-[#0a0f15] p-4"
            ><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {item.label}
                </div><TonePill tone={item.tone || "neutral"}>
                  {item.tone === "neutral" || !item.tone ? "base" : item.tone}
                </TonePill></div><div className="mt-3 text-sm font-semibold text-slate-50">{item.title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{item.description}</div></div>
          ))}
        </div></div></Surface>
  );
}
