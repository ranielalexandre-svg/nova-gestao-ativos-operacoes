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
    <Surface><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
    <Surface><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="mt-2 grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.title}`}
            className="nds-card"
          ><div className="flex items-center justify-between gap-2"><div className="nds-label">
                {item.label}
              </div><TonePill tone={item.tone || "neutral"}>
                {item.tone === "neutral" || !item.tone ? "base" : item.tone}
              </TonePill></div><div className="mt-2 text-[12px] font-bold text-slate-50">{item.title}</div><div className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{item.description}</div></div>
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
    <Surface><SectionIntro eyebrow={eyebrow} title={title} description={description} compact /><div className="nova-command-deck-grid mt-2"><div className="grid gap-2 md:grid-cols-2">
          {links.map((link) => (
            <ActionTile
              key={`${link.href}-${link.title}`}
              href={link.href}
              title={link.title}
              description={link.description}
              badge={link.badge}
            />
          ))}
        </div><div className="grid gap-2">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.title}`}
              className="nds-card"
            ><div className="flex items-center justify-between gap-2"><div className="nds-label">
                  {item.label}
                </div><TonePill tone={item.tone || "neutral"}>
                  {item.tone === "neutral" || !item.tone ? "base" : item.tone}
                </TonePill></div><div className="mt-2 text-[12px] font-bold text-slate-50">{item.title}</div><div className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">{item.description}</div></div>
          ))}
        </div></div></Surface>
  );
}
