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
        <div className="storefront-header-inner mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Link
              aria-label="Technology Store, inicio"
              className="storefront-brand group inline-flex min-w-0 items-center gap-3 rounded-xl"
              href="/"
            >
              <StorefrontMark />
              <span className="min-w-0">
                <span className="block truncate text-base font-black tracking-tight sm:text-lg">Technology Store</span>
                <span className="hidden text-xs font-medium text-[var(--ds-text-muted)] sm:block">Catálogo de tecnología</span>
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="flex items-center">
              <StorefrontNavLink
                className="storefront-nav-item"
                href="/"
              >
                Inicio
              </StorefrontNavLink>
              <StorefrontNavLink descendants className="storefront-nav-item" href="/products">Productos</StorefrontNavLink>
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

      <footer data-slot="storefront-footer" className="border-t border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div><p className="m-0 text-lg font-semibold text-[var(--ds-text)]">Technology Store</p>
            <p className="mb-0 mt-2">Tecnología para trabajar, crear y jugar.</p></div>
          <nav aria-label="Enlaces de la tienda" className="flex flex-wrap gap-5">
            <Link className="storefront-footer-link" href="/products">Explorar catálogo</Link>
            <Link className="storefront-footer-link" href="/cart">Ver mi carrito</Link>
            <Link className="storefront-footer-link" href="/account">Mi espacio</Link>
          </nav>
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
      <rect fill="var(--ds-accent-soft)" height="48" rx="15" width="48" />
      <path
        d="M13 17h9l4 7-4 7h-9M26 24h9"
        stroke="var(--ds-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <circle cx="35" cy="24" fill="var(--ds-accent)" r="3" />
      <circle cx="13" cy="17" fill="var(--ds-accent)" r="2" />
      <circle cx="13" cy="31" fill="var(--ds-accent)" r="2" />
    </svg>
  );
}
