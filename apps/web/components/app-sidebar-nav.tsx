"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName =
  | "dashboard"
  | "partners"
  | "units"
  | "equipment"
  | "satellite"
  | "monitoring"
  | "reports"
  | "incidents"
  | "queue"
  | "exceptions"
  | "automation"
  | "sla"
  | "users"
  | "activity"
  | "import"
  | "reconcile"
  | "integrations"
  | "map"
  | "contracts"
  | "profiles"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon?: IconName;
  section?: string;
  children?: Array<Omit<NavItem, "section" | "children">>;
};

const iconPaths: Record<IconName, string[]> = {
  dashboard: ["M4 13h6V4H4v9Z", "M14 20h6V4h-6v16Z", "M4 20h6v-4H4v4Z"],
  partners: ["M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M3.5 19c.7-3 2.6-5 4.5-5s3.8 2 4.5 5", "M13.5 18c.5-2 1.7-3.4 3.1-3.4 1.6 0 3 1.7 3.6 4.4"],
  units: ["M4 20V8l8-4 8 4v12", "M9 20v-7h6v7", "M8 10h.01", "M16 10h.01"],
  equipment: ["M4 7h16v10H4V7Z", "M8 21h8", "M12 17v4"],
  satellite: ["M12 12l7-7", "M16 5l3 3", "M5 19l6-6", "M4 13a7 7 0 0 1 7 7", "M4 17a3 3 0 0 1 3 3"],
  monitoring: ["M4 13h4l2-6 4 12 2-6h4", "M4 4v16h16"],
  reports: ["M6 3h9l3 3v15H6V3Z", "M14 3v4h4", "M9 13h6", "M9 17h4"],
  incidents: ["M12 3l9 16H3L12 3Z", "M12 9v4", "M12 17h.01"],
  queue: ["M5 7h14", "M5 12h14", "M5 17h10"],
  exceptions: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M8 8l8 8", "M16 8l-8 8"],
  automation: ["M12 8v4l3 3", "M4 12a8 8 0 0 1 13.7-5.7", "M20 12a8 8 0 0 1-13.7 5.7", "M18 4v4h-4", "M6 20v-4h4"],
  sla: ["M12 8v5l3 2", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"],
  users: ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M3.5 20c.8-3.2 2.8-5 5.5-5s4.7 1.8 5.5 5", "M13.5 15.5c1-.4 2-.5 3-.5 2.2 0 3.9 1.4 4.5 4"],
  activity: ["M4 12h4l2-7 4 14 2-7h4"],
  import: ["M12 3v12", "M8 11l4 4 4-4", "M4 21h16"],
  reconcile: ["M7 7h11l-3-3", "M17 17H6l3 3", "M6 7a7 7 0 0 0-1 8", "M18 17a7 7 0 0 0 1-8"],
  integrations: ["M8 12h8", "M9 7H7a5 5 0 0 0 0 10h2", "M15 7h2a5 5 0 0 1 0 10h-2"],
  map: ["M9 18l-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z", "M9 4v14", "M15 6v14"],
  contracts: ["M7 3h8l3 3v15H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z", "M14 3v4h4", "M8 12h7", "M8 16h5"],
  profiles: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21c1.1-4 4-6 8-6s6.9 2 8 6", "M17.5 8.5l1 1 2-2"],
  settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04-1.8 3.12-.06-.02a1.7 1.7 0 0 0-1.92.32l-.02.02a1.7 1.7 0 0 0-.47 1.04H12.4a1.7 1.7 0 0 0-.49-1.05l-.02-.02a1.7 1.7 0 0 0-1.92-.31l-.06.02-1.8-3.12.04-.04A1.7 1.7 0 0 0 8.5 15a1.7 1.7 0 0 0-.34-1.88l-.04-.04 1.8-3.12.06.02a1.7 1.7 0 0 0 1.92-.32l.02-.02a1.7 1.7 0 0 0 .48-1.04h3.2c.07.39.23.75.49 1.04l.02.02a1.7 1.7 0 0 0 1.92.31l.06-.02 1.8 3.12-.04.04A1.7 1.7 0 0 0 19.4 15Z"],
};

function NavIcon({ name, fallback }: { name?: IconName; fallback: string }) {
  if (!name) {
    return <span className="text-[10px] font-bold tracking-[0.08em]">{fallback}</span>;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

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
  const isExact = (href: string) => pathname === href;
  const isBranch = (href: string) => {
    if (pathname === href) return true;
    if (href === "/" || href === "/relatorios") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <nav aria-label="Navegação principal" className="grid gap-6">
      {groups.map((group) => (
        <section key={group.section} className="grid gap-1.5" aria-label={group.section}>
          <div className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
            {group.section}
          </div>

          {group.items.map((item) => {
            const branchActive = isBranch(item.href);
            const exactActive = isExact(item.href);

            return (
              <div key={item.href} className="grid gap-1">
                <Link
                  href={item.href}
                  aria-current={exactActive ? "page" : undefined}
                  className={[
                    "group relative flex min-h-9 items-center gap-2 rounded-xl border px-2 text-[13px] font-medium outline-none transition",
                    "focus-visible:border-orange-300/70 focus-visible:ring-2 focus-visible:ring-orange-400/30",
                    branchActive
                      ? "border-orange-400/25 bg-orange-500/[0.13] text-orange-100 shadow-none"
                      : "border-transparent text-slate-400 hover:bg-white/[0.045] hover:text-white",
                  ].join(" ")}
                >
                  {branchActive ? (
                    <span className="absolute left-[-13px] top-1.5 h-6 w-[3px] rounded-r-full bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.72)]" />
                  ) : null}

                  <span
                    className={[
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition",
                      branchActive
                        ? "border-orange-300/35 bg-orange-500/18 text-orange-100"
                        : "border-transparent bg-transparent text-slate-400 group-hover:text-slate-100",
                    ].join(" ")}
                  >
                    <NavIcon name={item.icon} fallback={item.short} />
                  </span>

                  <span className="min-w-0 flex-1 truncate">{item.label}</span>

                  {item.children?.length ? (
                    <span className={branchActive ? "text-orange-200" : "text-slate-600 group-hover:text-slate-400"} aria-hidden="true">
                      ›
                    </span>
                  ) : null}
                </Link>

                {item.children?.length ? (
                  <div className="ml-6 grid gap-1 border-l border-white/[0.08] py-1 pl-2">
                    {item.children.map((child) => {
                      const childActive = isBranch(child.href);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={[
                            "group flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium outline-none transition",
                            "focus-visible:ring-2 focus-visible:ring-orange-400/30",
                            childActive
                              ? "bg-orange-400/10 text-orange-50"
                              : "text-slate-400 hover:bg-white/[0.045] hover:text-white",
                          ].join(" ")}
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-500 group-hover:text-slate-200">
                            <NavIcon name={child.icon} fallback={child.short} />
                          </span>
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
