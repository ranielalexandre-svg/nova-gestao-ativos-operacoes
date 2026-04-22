"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  short: string;
  section?: string;
};

function groupItems(items: NavItem[]) {
  const groups: Array<{ section: string; items: NavItem[] }> = [];
  for (const item of items) {
    const section = item.section || "Geral";
    const found = groups.find((group) => group.section === section);
    if (found) found.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}

export function AppSidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups = groupItems(items);

  return (
    <nav className="grid gap-6">
      {groups.map((group) => (
        <div key={group.section} className="grid gap-1.5">
          <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.section}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex min-h-11 items-center gap-3 rounded-[14px] border px-3 text-sm font-medium transition",
                  active
                    ? "border-sky-500/28 bg-sky-500/12 text-sky-50"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border text-[10px] font-semibold tracking-[0.08em]",
                    active
                      ? "border-sky-400/30 bg-sky-400/16 text-sky-100"
                      : "border-white/10 bg-white/[0.035] text-slate-400 group-hover:text-slate-100",
                  ].join(" ")}
                >
                  {item.short}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
