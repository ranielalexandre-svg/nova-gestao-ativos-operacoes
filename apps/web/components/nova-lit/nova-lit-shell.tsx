// @refresh reset
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";


const REACT_INSTRUMENTATION_CHILDREN_WARNING =
  "The children should not have changed if we pass in the same set.";

function isReactInstrumentationChildrenWarning(args: unknown[]) {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return (
        arg.includes(REACT_INSTRUMENTATION_CHILDREN_WARNING) ||
        arg.includes("React instrumentation encountered an error")
      );
    }

    if (arg instanceof Error) {
      return arg.message.includes(REACT_INSTRUMENTATION_CHILDREN_WARNING);
    }

    return false;
  });
}

type BadgeTone = "blue" | "orange" | "red" | "green" | "slate";
type IconName =
  | "activity"
  | "alert"
  | "assets"
  | "automation"
  | "bell"
  | "building"
  | "chart"
  | "chevron"
  | "contract"
  | "dashboard"
  | "help"
  | "import"
  | "integrations"
  | "map"
  | "operation"
  | "partners"
  | "performance"
  | "pin"
  | "queue"
  | "reports"
  | "search"
  | "sensor"
  | "settings"
  | "shield"
  | "sync"
  | "ticket"
  | "user";

type NavBadge = {
  key: string;
  tone: BadgeTone;
  fallback?: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  badge?: NavBadge;
  children?: NavItem[];
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

type FlatNavItem = NavItem & {
  section: string;
  parent?: string;
};

type NovaLitShellProps = {
  children: ReactNode;
  activeHref?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hidePageHeader?: boolean;
};

const FAVORITES_STORAGE_KEY = "nova-lit-menu-favorites-v2";
const SECTIONS_STORAGE_KEY = "nova-lit-menu-sections-open-v2";
const ITEMS_STORAGE_KEY = "nova-lit-menu-items-open-v2";
const COLLAPSED_STORAGE_KEY = "nova-lit-menu-collapsed-v2";

const MENU_SECTIONS: NavSection[] = [
  {
    id: "geral",
    label: "Geral",
    items: [
      { label: "Visão geral", href: "/dashboard", icon: "dashboard" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { label: "Resumo do turno", href: "/operacao", icon: "operation" },
      { label: "Fila priorizada", href: "/operacao/fila", icon: "queue" },
      { label: "Alertas", href: "/alertas", icon: "bell", badge: { key: "alertas", tone: "orange", fallback: 24 } },
      { label: "Chamados", href: "/chamados", icon: "ticket", badge: { key: "chamados", tone: "blue", fallback: 12 } },
      { label: "Exceções", href: "/operacao/excecoes", icon: "alert", badge: { key: "excecoes", tone: "orange", fallback: 3 } },
      { label: "Atividade", href: "/operacao/atividade", icon: "activity" },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    items: [
      { label: "Saúde da rede", href: "/monitoramento", icon: "chart" },
      { label: "Sensores NOC", href: "/monitoramento/sensores", icon: "sensor" },
      { label: "Mapa operacional", href: "/monitoramento/mapas", icon: "map" },
      { label: "Fontes de dados", href: "/monitoramento/fontes", icon: "integrations" },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    items: [
      { label: "Parceiros", href: "/parceiros", icon: "partners" },
      { label: "Unidades", href: "/unidades", icon: "building" },
      {
        label: "Ativos",
        href: "/ativos",
        icon: "assets",
        children: [
          { label: "Todos os ativos", href: "/ativos", icon: "assets" },
          { label: "Starlinks", href: "/ativos/starlinks", icon: "assets" },
          { label: "ONUs", href: "/ativos/onus", icon: "assets" },
          { label: "Switches", href: "/ativos/switches", icon: "assets" },
          { label: "Outros / SAD", href: "/ativos/outros", icon: "assets" },
        ],
      },
    ],
  },
  {
    id: "contratos",
    label: "Contratos",
    items: [
      { label: "Contratos", href: "/contratos", icon: "contract" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    items: [
      { label: "Central", href: "/relatorios", icon: "reports" },
      { label: "Monitoramento", href: "/relatorios/monitoramento", icon: "chart" },
      { label: "Consumo", href: "/relatorios/consumo", icon: "reports" },
      { label: "Disponibilidade", href: "/relatorios/disponibilidade", icon: "shield" },
      { label: "Performance", href: "/relatorios/performance", icon: "performance" },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { label: "Usuários", href: "/usuarios", icon: "user" },
      { label: "Perfis", href: "/perfis", icon: "shield" },
      { label: "Integrações", href: "/integracoes", icon: "integrations" },
      { label: "Importação", href: "/operacao/importacao", icon: "import" },
      { label: "Reconciliação", href: "/administracao/reconciliacao", icon: "sync" },
      { label: "Automações", href: "/administracao/automacoes", icon: "automation" },
      { label: "Políticas SLA", href: "/operacao/sla", icon: "shield" },
      { label: "Sistema", href: "/configuracoes", icon: "settings" },
    ],
  },
];

const DEFAULT_FAVORITES = ["/dashboard", "/operacao/fila", "/alertas"];

const ACTIVE_HREF_ALIASES: Record<string, string> = {
  "/sensores": "/monitoramento/sensores",
  "/monitoramento/mapas": "/monitoramento",
  "/monitoramento/fontes": "/integracoes",
  "/excecoes": "/operacao/excecoes",
  "/excecoes/cadastro": "/operacao/excecoes",
  "/excecoes/nova": "/operacao/excecoes",
  "/operacao/excecoes/cadastro": "/operacao/excecoes",
  "/operacao/excecoes/nova": "/operacao/excecoes",
  "/mapas": "/monitoramento/mapas",
  "/equipamentos": "/ativos",
  "/ocorrencias": "/alertas",
  "/manutencoes": "/chamados",
  "/automacao": "/administracao/automacoes",
  "/operacao/automacoes": "/administracao/automacoes",
  "/importacao": "/operacao/importacao",
  "/administracao/importacao": "/operacao/importacao",
  "/reconciliacao": "/administracao/reconciliacao",
  "/reconciliacao-central": "/administracao/reconciliacao",
  "/administracao/sla": "/operacao/sla",
};

function canonicalHref(value: string) {
  const exact = ACTIVE_HREF_ALIASES[value];
  if (exact) return exact;

  const match = Object.entries(ACTIVE_HREF_ALIASES)
    .filter(([alias]) => value === alias || value.startsWith(`${alias}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  if (match) {
    const [alias, canonical] = match;
    return `${canonical}${value.slice(alias.length)}`;
  }

  return value;
}



function flattenMenu(sections: NavSection[]): FlatNavItem[] {
  const items: FlatNavItem[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      items.push({ ...item, section: section.label });

      for (const child of item.children ?? []) {
        items.push({ ...child, section: section.label, parent: item.label });
      }
    }
  }

  return items;
}

const FLAT_MENU = flattenMenu(MENU_SECTIONS);

const FAVORITE_CANDIDATES = FLAT_MENU.reduce<FlatNavItem[]>((acc, item) => {
  if (acc.some((candidate) => candidate.href === item.href)) return acc;
  acc.push(item);
  return acc;
}, []);

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage pode estar indisponível em navegação privada.
  }
}

function navItemKey(item: Pick<FlatNavItem, "href" | "label" | "section" | "parent">, prefix: string, index?: number) {
  return [
    prefix,
    item.section,
    item.parent ?? "root",
    item.href,
    item.label,
    typeof index === "number" ? String(index) : "",
  ]
    .join("::")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function sectionDefaults() {
  return MENU_SECTIONS.reduce<Record<string, boolean>>(
    (acc, section) => {
      acc[section.id] = true;
      return acc;
    },
    { favoritos: true }
  );
}

function itemDefaults() {
  return {
    "/ativos": true,
  };
}

function NavIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="11" cy="11" r="7" />
          <path {...common} d="m20 20-3.5-3.5" />
        </svg>
      );
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
      );
    case "operation":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="8" />
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case "queue":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M9 6h11M9 12h11M9 18h11" />
          <path {...common} d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "ticket":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 13v-1a7 7 0 0 1 14 0v1" />
          <path {...common} d="M5 13h3v5H5zM16 13h3v5h-3z" />
          <path {...common} d="M19 18a4 4 0 0 1-4 4h-2" />
        </svg>
      );
    case "alert":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 3 22 20H2L12 3z" />
          <path {...common} d="M12 9v5M12 17h.01" />
        </svg>
      );
    case "activity":
    case "performance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 17 9 12l4 4 7-9" />
          <path {...common} d="M15 7h5v5" />
        </svg>
      );
    case "building":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 21V4h14v17" />
          <path {...common} d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M3 21h18" />
        </svg>
      );
    case "sensor":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 18h.01" />
          <path {...common} d="M8.5 14.5a5 5 0 0 1 7 0" />
          <path {...common} d="M5.5 11.5a9 9 0 0 1 13 0" />
          <path {...common} d="M2.5 8.5a13 13 0 0 1 19 0" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" />
          <path {...common} d="M9 4v14M15 6v14" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
          <path {...common} d="M10 21h4" />
        </svg>
      );
    case "assets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path {...common} d="M12 12 4.5 7.8M12 12l7.5-4.2M12 12v8.5" />
        </svg>
      );
    case "partners":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle {...common} cx="9.5" cy="7" r="4" />
          <path {...common} d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.3a4 4 0 0 1 0 7.4" />
        </svg>
      );
    case "contract":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6 3h9l3 3v15H6z" />
          <path {...common} d="M14 3v4h4M9 12h6M9 16h6M9 8h2" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path {...common} d="m9 12 2 2 4-5" />
        </svg>
      );
    case "automation":
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 20V4M4 20h16" />
          <path {...common} d="M8 16v-5M12 16V7M16 16v-8" />
        </svg>
      );
    case "reports":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M21 12a9 9 0 1 1-9-9v9z" />
          <path {...common} d="M12 3a9 9 0 0 1 9 9h-9z" />
        </svg>
      );
    case "import":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M16 16 12 12 8 16M12 12v9" />
          <path {...common} d="M20 17.6A5 5 0 0 0 18 8h-1.3A7 7 0 1 0 5 14.7" />
        </svg>
      );
    case "sync":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M21 12a9 9 0 0 0-15.5-6.3L3 8" />
          <path {...common} d="M3 3v5h5" />
          <path {...common} d="M3 12a9 9 0 0 0 15.5 6.3L21 16" />
          <path {...common} d="M21 21v-5h-5" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="8" r="4" />
          <path {...common} d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "integrations":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M8 3h5v5h5v5h-5v8H8v-8H3V8h5z" />
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M14 4 20 10M16 8l-7 7M8 16l-4 4M9 4l11 11" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M9.5 9a2.7 2.7 0 0 1 5.2.9c0 2-2.7 2.1-2.7 4.1M12 17h.01" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m8 10 4 4 4-4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export function NovaLitShell({
  children,
  activeHref,
  title,
  subtitle,
  actions,
  hidePageHeader,
}: NovaLitShellProps) {

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      if (isReactInstrumentationChildrenWarning(args)) return;
      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      if (isReactInstrumentationChildrenWarning(args)) return;
      originalWarn(...args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);


  const pathname = usePathname();
  const router = useRouter();
  const currentHref = canonicalHref(activeHref || pathname || "/dashboard");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(sectionDefaults());
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(itemDefaults());
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);
  const [badgeCounts] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsCollapsed(readJson(COLLAPSED_STORAGE_KEY, false));
      setOpenSections(readJson(SECTIONS_STORAGE_KEY, sectionDefaults()));
      setOpenItems(readJson(ITEMS_STORAGE_KEY, itemDefaults()));
      setFavorites(readJson(FAVORITES_STORAGE_KEY, DEFAULT_FAVORITES));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isCommandK) return;

      event.preventDefault();
      setIsCollapsed(false);
      setIsMobileMenuOpen(true);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMobileMenuOpen(false);
      setQuery("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!currentHref.startsWith("/ativos")) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpenItems((previous) => {
        const next = { ...previous, "/ativos": true };
        writeJson(ITEMS_STORAGE_KEY, next);
        return next;
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentHref]);

  const searchResults = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];

    return FLAT_MENU.filter((item) => {
      const haystack = normalizeSearch(
        [item.label, item.href, item.section, item.parent].filter(Boolean).join(" ")
      );
      return haystack.includes(normalized);
    }).slice(0, 7);
  }, [query]);

  function isItemActive(item: NavItem) {
    if (item.children?.some((child) => isItemActive(child))) return true;
    return currentHref === item.href || currentHref.startsWith(`${item.href}/`);
  }

  function toggleCollapsed() {
    setIsCollapsed((previous) => {
      const next = !previous;
      writeJson(COLLAPSED_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleMobileMenu() {
    setIsMobileMenuOpen((previous) => !previous);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function toggleSection(sectionId: string) {
    setOpenSections((previous) => {
      const next = { ...previous, [sectionId]: !previous[sectionId] };
      writeJson(SECTIONS_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleItem(href: string, event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    setOpenItems((previous) => {
      const next = { ...previous, [href]: !previous[href] };
      writeJson(ITEMS_STORAGE_KEY, next);
      return next;
    });
  }

  function toggleFavorite(href: string, event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    setFavorites((previous) => {
      const exists = previous.includes(href);
      const next = exists ? previous.filter((item) => item !== href) : [href, ...previous].slice(0, 6);
      writeJson(FAVORITES_STORAGE_KEY, next);
      return next;
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (searchResults[0]) {
      router.push(searchResults[0].href);
      setQuery("");
    }
  }

  function renderBadge(item: NavItem) {
    if (!item.badge) return null;

    const value = badgeCounts[item.badge.key] ?? item.badge.fallback;
    if (!value) return null;

    return (
      <span className={`nova-lit-menu-badge tone-${item.badge.tone}`} aria-label={`${value} pendência(s)`}>
        {value}
      </span>
    );
  }

  function renderItem(item: NavItem, depth = 0) {
    const active = isItemActive(item);
    const hasChildren = Boolean(item.children?.length);
    const childrenOpen = openItems[item.href] ?? active;

    return (
      <li key={navItemKey({ ...item, section: "nav", parent: depth ? "child" : "root" }, `item-${depth}`)} className={`nova-lit-nav-item depth-${depth}`}>
        <div
          className={[
            "nova-lit-nav-row",
            `depth-${depth}`,
            active ? "is-active" : "",
            hasChildren ? "has-children" : "",
          ].join(" ")}
        >
          <Link
            href={item.href}
            className="nova-lit-nav-link"
            aria-current={active && !hasChildren ? "page" : undefined}
            title={item.label}
            onClick={closeMobileMenu}
          >
            {depth > 0 ? <span className="nova-lit-sub-dot" aria-hidden="true" /> : <NavIcon name={item.icon} />}
            <span className="nova-lit-nav-label">{item.label}</span>
          </Link>

          {renderBadge(item)}

          {hasChildren ? (
            <button
              type="button"
              className={`nova-lit-inline-toggle ${childrenOpen ? "is-open" : ""}`}
              onClick={(event) => toggleItem(item.href, event)}
              aria-label={childrenOpen ? `Recolher ${item.label}` : `Expandir ${item.label}`}
              aria-expanded={childrenOpen}
            >
              <NavIcon name="chevron" />
            </button>
          ) : null}
        </div>

        {hasChildren ? (
          <ul
            className={`nova-lit-submenu ${childrenOpen ? "is-open" : "is-closed"}`}
            aria-hidden={!childrenOpen}
            data-open={childrenOpen ? "true" : "false"}
          >
            {item.children?.map((child) => renderItem(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className={`nova-lit-shell-v2 ${isCollapsed ? "is-collapsed" : ""} ${isMobileMenuOpen ? "is-mobile-menu-open" : ""}`}>
      <button
        type="button"
        className="nova-lit-mobile-scrim"
        onClick={closeMobileMenu}
        aria-label="Fechar menu"
        tabIndex={isMobileMenuOpen ? 0 : -1}
      />

      <aside className="nova-lit-sidebar-v2" id="nova-lit-menu" aria-label="Menu principal">
        <div className="nova-lit-sidebar-top">
          <Link href="/dashboard" className="nova-lit-logo" aria-label="NOVA Telecom" onClick={closeMobileMenu}>
            <Image
              className="nova-lit-logo-img"
              src="/brand/nova-telecom-logo.svg"
              alt="NOVA Telecom"
              width={164}
              height={52}
              loading="eager"
            />
            <Image
              className="nova-lit-logo-mark"
              src="/brand/nova-telecom-mark.svg"
              alt="NOVA"
              width={44}
              height={44}
            />
          </Link>

          <button
            type="button"
            className="nova-lit-collapse-button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!isCollapsed}
          >
            «
          </button>

          <button
            type="button"
            className="nova-lit-drawer-close"
            onClick={closeMobileMenu}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <form className="nova-lit-menu-search" onSubmit={handleSearchSubmit} role="search">
          <NavIcon name="search" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ou navegar"
            aria-label="Buscar ou navegar"
          />
          <kbd>⌘ K</kbd>

          {query ? (
            <div className="nova-lit-search-results" role="listbox">
              {searchResults.length ? (
                searchResults.map((item, index) => (
                  <div key={navItemKey(item, "search", index)} className="nova-lit-search-result">
                    <Link href={item.href} onClick={() => {
                      setQuery("");
                      closeMobileMenu();
                    }}>
                      <span>{item.label}</span>
                      <small>{item.parent ? `${item.section} / ${item.parent}` : item.section}</small>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => toggleFavorite(item.href, event)}
                      aria-label={favorites.includes(item.href) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <NavIcon name="pin" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="nova-lit-search-empty">Nenhuma rota encontrada</div>
              )}
            </div>
          ) : null}
        </form>

        <nav className="nova-lit-menu" aria-label="Navegação">
          <section className="nova-lit-menu-section favorites-section">
            <button
              type="button"
              className="nova-lit-section-heading as-button"
              onClick={() => toggleSection("favoritos")}
              aria-expanded={openSections.favoritos ?? true}
            >
              <span>Favoritos</span>
              <span className="nova-lit-heading-line" />
              <span className={`nova-lit-heading-chevron ${(openSections.favoritos ?? true) ? "is-open" : ""}`}>
                <NavIcon name="chevron" />
              </span>
            </button>

            <ul
              className={`nova-lit-section-list ${(openSections.favoritos ?? true) ? "is-open" : "is-closed"}`}
              aria-hidden={!(openSections.favoritos ?? true)}
              data-open={(openSections.favoritos ?? true) ? "true" : "false"}
            >
              {FAVORITE_CANDIDATES.map((item) => {
                const isFavorite = favorites.includes(item.href);
                return (
                  <li
                    key={navItemKey(item, "favorite")}
                    className={`nova-lit-nav-item favorite-candidate ${isFavorite ? "is-visible" : "is-hidden"}`}
                    aria-hidden={!isFavorite}
                    data-favorite={isFavorite ? "true" : "false"}
                  >
                    <div className={`nova-lit-nav-row favorite-row ${currentHref === item.href ? "is-active" : ""}`}>
                      <Link href={item.href} className="nova-lit-nav-link" title={item.label} tabIndex={isFavorite ? 0 : -1} onClick={closeMobileMenu}>
                        <NavIcon name={item.icon} />
                        <span className="nova-lit-nav-label">{item.label}</span>
                      </Link>
                      {renderBadge(item)}
                      <button
                        type="button"
                        className="nova-lit-favorite-button"
                        onClick={(event) => toggleFavorite(item.href, event)}
                        aria-label={`Remover ${item.label} dos favoritos`}
                        tabIndex={isFavorite ? 0 : -1}
                      >
                        <NavIcon name="pin" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {MENU_SECTIONS.map((section) => {
            const open = openSections[section.id];

            return (
              <section key={section.id} className="nova-lit-menu-section">
                <button
                  type="button"
                  className="nova-lit-section-heading as-button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                >
                  <span>{section.label}</span>
                  <span className="nova-lit-heading-line" />
                  <span className={`nova-lit-heading-chevron ${open ? "is-open" : ""}`}>
                    <NavIcon name="chevron" />
                  </span>
                </button>

                <ul
                  className={`nova-lit-section-list ${open ? "is-open" : "is-closed"}`}
                  aria-hidden={!open}
                  data-open={open ? "true" : "false"}
                >
                  {section.items.map((item) => renderItem(item))}
                </ul>
              </section>
            );
          })}
        </nav>

        <footer className="nova-lit-sidebar-footer">
          <div className="nova-lit-user-avatar">
            A
            <span />
          </div>

          <div className="nova-lit-user-meta">
            <strong>Admin NOVA</strong>
            <span>Administrador</span>
          </div>

          <div className="nova-lit-footer-actions">
            <Link href="/configuracoes" aria-label="Configurações">
              <NavIcon name="settings" />
            </Link>
            <Link href="/operacao/atividade" aria-label="Ajuda e auditoria">
              <NavIcon name="help" />
            </Link>
          </div>
        </footer>
      </aside>

      <div className="nova-lit-main-v2">
        <header className="nova-lit-topbar-v2">
          <div>
            <button
              type="button"
              className="nova-lit-mobile-menu"
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-controls="nova-lit-menu"
              aria-expanded={isMobileMenuOpen}
            >
              ☰
            </button>
            <span>Sistema de Gestão Operacional</span>
          </div>

          <div className="nova-lit-topbar-actions">
            <Link href="/alertas" className="nova-lit-topbar-icon" aria-label="Alertas">
              <NavIcon name="bell" />
            </Link>
            <Link href="/configuracoes" className="nova-lit-topbar-icon" aria-label="Sistema">
              <NavIcon name="settings" />
            </Link>
            <Link href="/usuarios" className="nova-lit-topbar-user">
              <span>Admin NOVA</span>
              <strong>A</strong>
            </Link>
          </div>
        </header>

        <main className="nova-lit-content-v2">
          {!hidePageHeader && (title || subtitle || actions) ? (
            <section className="nova-lit-page-heading">
              <div>
                {title ? <h1>{title}</h1> : null}
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
              {actions ? <div>{actions}</div> : null}
            </section>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}

export default NovaLitShell;
