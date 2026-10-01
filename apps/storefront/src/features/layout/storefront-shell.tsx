import Link from "next/link";
import type { ReactNode } from "react";

import { SessionControls } from "../auth/session-controls";
import { CartShortcut } from "../cart/cart-shortcut";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontNavLink } from "./storefront-nav-link";

export function StorefrontShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div data-slot="storefront-shell" className="flex min-h-dvh flex-col bg-[var(--ds-canvas)] text-[var(--ds-text)]">
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-bold text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#main-content"
      >
        Saltar al contenido
      </a>

      <StorefrontHeader>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Link
              aria-label="Technology Store, inicio"
              className="group inline-flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#041326]"
              href="/"
            >
              <StorefrontMark />
              <span className="min-w-0">
                <span className="block truncate text-base font-black tracking-tight sm:text-lg">Technology Store</span>
                <span className="hidden text-xs font-medium text-slate-300 sm:block">Catálogo de tecnología</span>
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="flex items-center">
              <StorefrontNavLink
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                href="/"
              >
                Inicio
              </StorefrontNavLink>
              <StorefrontNavLink descendants className="rounded-full px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200" href="/products">Productos</StorefrontNavLink>
            </nav>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 md:justify-end">
            <SessionControls />
            <CartShortcut />
          </div>
        </div>
      </StorefrontHeader>

      <div className="min-w-0 flex-1 scroll-mt-80 md:scroll-mt-40" id="main-content" tabIndex={-1}>
        {children}
      </div>

      <footer className="border-t border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p className="m-0 font-bold text-[var(--ds-text)]">Technology Store</p>
          <p className="m-0">Tecnología para trabajar, crear y jugar.</p>
        </div>
      </footer>
    </div>
  );
}

function StorefrontMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-11 shrink-0"
      fill="none"
      focusable="false"
      viewBox="0 0 48 48"
    >
      <rect fill="#081426" height="48" rx="15" width="48" />
      <path
        d="M13 17h9l4 7-4 7h-9M26 24h9"
        stroke="#67e8f9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <circle cx="35" cy="24" fill="#67e8f9" r="3" />
      <circle cx="13" cy="17" fill="#67e8f9" r="2" />
      <circle cx="13" cy="31" fill="#67e8f9" r="2" />
    </svg>
  );
}
