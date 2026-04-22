import type { ReactNode } from "react";
import { ActionTile, InlineStat, SectionIntro, Surface } from "@/components/ops-ui";

export function WorkflowStatsPanel({
  eyebrow,
  title,
  description,
  stats,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats: Array<{
    label: string;
    value: string | number;
    tone?: string;
  }>;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        compact
      />

      <div className="mt-4 grid gap-3">
        {stats.map((item) => (
          <InlineStat
            key={item.label}
            label={item.label}
            value={item.value}
            tone={item.tone || "neutral"}
          />
        ))}
      </div>
    </Surface>
  );
}

export function ConnectedRoutesPanel({
  eyebrow,
  title,
  description,
  routes,
}: {
  eyebrow: string;
  title: string;
  description: string;
  routes: Array<{
    href: string;
    title: string;
    description: string;
    badge?: ReactNode;
  }>;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        compact
      />

      <div className="mt-4 grid gap-3">
        {routes.map((route) => (
          <ActionTile
            key={route.href}
            href={route.href}
            title={route.title}
            description={route.description}
            badge={route.badge}
          />
        ))}
      </div>
    </Surface>
  );
}
