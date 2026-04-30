"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { NavItem } from "@/components/app-sidebar-nav";

const STORAGE_KEY = "nova.sidebar.state";

type SidebarState = "open" | "closed";

type RailItem = {
  href: string;
  label: string;
  short: string;
  icon?: string;
  child?: boolean;
};

const iconPaths: Record<string, string[]> = {
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
};

function applySidebarState(state: SidebarState) {
  if (typeof document === "undefined") return;

  if (state === "closed") {
    document.documentElement.dataset.novaSidebar = "closed";
  } else {
    delete document.documentElement.dataset.novaSidebar;
  }
}

function isBranch(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function flattenItems(items: NavItem[]) {
  const flattened: RailItem[] = [];

  for (const item of items) {
    flattened.push({ href: item.href, label: item.label, short: item.short, icon: item.icon });
    for (const child of item.children || []) {
      flattened.push({ href: child.href, label: child.label, short: child.short, icon: child.icon, child: true });
    }
  }

  return flattened;
}

function RailIcon({ name, fallback }: { name?: string; fallback: string }) {
  const paths = name ? iconPaths[name] : undefined;

  if (!paths) {
    return <span className="text-[10px] font-black tracking-[0.08em]">{fallback}</span>;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function SidebarCollapseControls({ items = [] }: { items?: NavItem[] }) {
  const pathname = usePathname();
  const [state, setState] = useState<SidebarState>("open");
  const railItems = useMemo(() => flattenItems(items), [items]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) === "closed" ? "closed" : "open";
    setState(saved);
    applySidebarState(saved);
  }, []);

  function update(nextState: SidebarState) {
    setState(nextState);
    applySidebarState(nextState);
    window.localStorage.setItem(STORAGE_KEY, nextState);
  }

  return (
    <><button
        type="button"
        className="nova-sidebar-close-floating hidden lg:inline-flex"
        onClick={() => update("closed")}
        aria-label="Recolher barra lateral"
        title="Recolher barra lateral"
      ><span aria-hidden="true" className="text-xl leading-none">‹</span></button>

      {state === "closed" ? (
        <aside className="nova-sidebar-rail hidden lg:flex" aria-label="Navegação compacta"><button
            type="button"
            className="nova-sidebar-rail-open"
            onClick={() => update("open")}
            aria-label="Expandir barra lateral"
            title="Expandir barra lateral"
          ><span aria-hidden="true" className="text-base leading-none">☰</span></button><Link href="/dashboard" className="nova-sidebar-rail-brand" aria-label="Ir para o painel" title="Painel">
            N
          </Link><div className="nova-sidebar-rail-list" role="list">
            {railItems.map((item) => {
              const active = isBranch(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "nova-sidebar-rail-link is-active" : "nova-sidebar-rail-link"}
                  title={item.label}
                ><RailIcon name={item.icon} fallback={item.short} /><span className="sr-only">{item.label}</span></Link>
              );
            })}
          </div></aside>
      ) : null}
    </>
  );
}
