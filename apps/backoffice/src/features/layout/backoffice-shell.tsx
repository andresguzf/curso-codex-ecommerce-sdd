"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { LogoutButton } from "../auth/logout-button";
import { useSessionStore } from "../auth/session";

type NavigationIcon = "home" | "products" | "categories" | "tags" | "orders" | "invoices" | "users" | "company";
type NavigationItem = Readonly<{
  href: string;
  icon: NavigationIcon;
  label: string;
}>;

const ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { href: "/", icon: "home", label: "Inicio" },
  { href: "/products", icon: "products", label: "Productos" },
  { href: "/inventory", icon: "products", label: "Inventario" },
  { href: "/categories", icon: "categories", label: "Categorías" },
  { href: "/tags", icon: "tags", label: "Etiquetas" },
  { href: "/users", icon: "users", label: "Usuarios" },
  { href: "/users?role=CUSTOMER", icon: "users", label: "Clientes" },
  { href: "/orders", icon: "orders", label: "Órdenes" },
  { href: "/invoices", icon: "invoices", label: "Facturas" },
  { href: "/store-profile", icon: "company", label: "Empresa" },
];

const BILLING_NAVIGATION: readonly NavigationItem[] = [
  { href: "/", icon: "home", label: "Inicio" },
  { href: "/orders", icon: "orders", label: "Órdenes" },
  { href: "/invoices", icon: "invoices", label: "Facturas" },
  { href: "/store-profile", icon: "company", label: "Empresa" },
];

export function BackofficeShell({ children }: Readonly<{ children: ReactNode }>) {
  const session = useSessionStore((state) => state.session);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "BILLING")) return children;

  const role = session.user.role;
  const navigation = role === "ADMIN" ? ADMIN_NAVIGATION : BILLING_NAVIGATION;
  const roleLabel = role === "ADMIN" ? "Administración" : "Facturación";

  function handleShellKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    }
  }

  function closeMobileNavigation() {
    setIsMobileMenuOpen(false);
  }

  return (
    <div
      className="flex min-h-dvh bg-slate-100 text-slate-950"
      onKeyDown={handleShellKeyDown}
      style={{ backgroundColor: "var(--admin-page)", color: "var(--admin-text)" }}
    >
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-bold text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#backoffice-main-content"
      >
        Saltar al contenido
      </a>

      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-white/10 bg-[#0c1d34] text-slate-100 transition-[width] duration-200 motion-reduce:transition-none lg:flex ${isCollapsed ? "w-20" : "w-64"}`}
      >
        <div className={`flex min-h-20 items-center gap-3 border-b border-white/10 px-4 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <Link
            aria-label="Nexo Operations, inicio"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1d34]"
            href="/"
          >
            <NexoMark />
            <span className={isCollapsed ? "sr-only" : "min-w-0"}>
              <span className="block font-black tracking-wide text-white">NEXO</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">Operations</span>
            </span>
          </Link>
          <button
            aria-controls="backoffice-desktop-navigation"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expandir navegación lateral" : "Contraer navegación lateral"}
            className={`hidden min-h-10 min-w-10 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:inline-flex ${isCollapsed ? "absolute right-[-0.8rem] top-[4.5rem] min-h-8 min-w-8 rounded-full border border-slate-300 bg-white text-slate-700 shadow-md hover:bg-slate-100 focus-visible:ring-blue-600" : "text-blue-100 hover:bg-white/10"}`}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            type="button"
          >
            <ChevronIcon direction={isCollapsed ? "right" : "left"} />
          </button>
        </div>

        <nav
          aria-label="Navegación administrativa"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
          id="backoffice-desktop-navigation"
        >
          <NavigationLinks collapsed={isCollapsed} items={navigation} />
        </nav>

        <div className={`border-t border-white/10 px-4 py-4 text-xs text-blue-100 ${isCollapsed ? "text-center" : ""}`}>
          {isCollapsed ? <span aria-label={roleLabel}>{role === "ADMIN" ? "A" : "B"}</span> : <span>{roleLabel}</span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 border-b px-4 py-3 sm:px-6"
          style={{ backgroundColor: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
        >
          <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-controls="backoffice-mobile-navigation"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? "Cerrar navegación administrativa" : "Abrir navegación administrativa"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                ref={mobileMenuButtonRef}
                type="button"
              >
                {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-black tracking-wide text-slate-900">Nexo Operations</p>
                <p className="m-0 mt-0.5 text-xs text-slate-500">{roleLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="hidden max-w-56 truncate text-sm font-semibold text-slate-600 sm:inline" title={session.user.displayName}>
                {session.user.displayName}
              </span>
              <LogoutButton />
            </div>
          </div>
          <nav
            aria-label="Navegación administrativa móvil"
            className="border-t border-slate-200 py-3 lg:hidden"
            hidden={!isMobileMenuOpen}
            id="backoffice-mobile-navigation"
          >
            <NavigationLinks items={navigation} onNavigate={closeMobileNavigation} />
          </nav>
        </header>

        <div className="min-w-0 flex-1" id="backoffice-main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}

function NavigationLinks({
  collapsed = false,
  items,
  onNavigate,
}: Readonly<{
  collapsed?: boolean;
  items: readonly NavigationItem[];
  onNavigate?: () => void;
}>) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            aria-label={collapsed ? item.label : undefined}
            className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${collapsed ? "justify-center" : ""}`}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
          >
            <NavigationGlyph icon={item.icon} />
            <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NexoMark() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/30 bg-[#15345b] text-lg font-black text-cyan-200 shadow-inner">
      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
        <path d="M5 18V6l14 12V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

function NavigationGlyph({ icon }: Readonly<{ icon: NavigationIcon }>) {
  const common = {
    "aria-hidden": true as const,
    className: "size-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  if (icon === "home") {
    return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg>;
  }
  if (icon === "products") {
    return <svg {...common}><rect height="7" rx="1.4" width="7" x="3" y="3" /><rect height="7" rx="1.4" width="7" x="14" y="3" /><rect height="7" rx="1.4" width="7" x="3" y="14" /><rect height="7" rx="1.4" width="7" x="14" y="14" /></svg>;
  }
  if (icon === "categories") {
    return <svg {...common}><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V5a2 2 0 0 1 2-2h5l2 2" /></svg>;
  }
  if (icon === "tags") {
    return <svg {...common}><path d="M3 4h9l9 9-8 8-9-9V4Z" /><circle cx="8" cy="8" r="1.5" /></svg>;
  }
  if (icon === "users") {
    return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5" /></svg>;
  }
  if (icon === "company") {
    return <svg {...common}><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M8 10h1M15 10h1" /></svg>;
  }
  if (icon === "orders") {
    return <svg {...common}><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M15 3v5h5M9 12h6M9 16h6" /></svg>;
  }
  return <svg {...common}><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 12h8M8 16h8" /></svg>;
}

function ChevronIcon({ direction }: Readonly<{ direction: "left" | "right" }>) {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
