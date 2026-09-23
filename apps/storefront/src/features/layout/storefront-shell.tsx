import Link from "next/link";
import type { ReactNode } from "react";

import { SessionControls } from "../auth/session-controls";
import { CartShortcut } from "../cart/cart-shortcut";

export function StorefrontShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950">
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-bold text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#main-content"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-slate-200 bg-white text-slate-950 shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Link
              aria-label="Technology Store, inicio"
              className="group inline-flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-4"
              href="/"
            >
              <StorefrontMark />
              <span className="min-w-0">
                <span className="block truncate text-base font-black tracking-tight sm:text-lg">Technology Store</span>
                <span className="hidden text-xs font-medium text-slate-500 sm:block">Catálogo de tecnología</span>
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="flex items-center">
              <Link
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                href="/"
              >
                Inicio
              </Link>
            </nav>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 md:justify-end">
            <SessionControls />
            <CartShortcut />
          </div>
        </div>
      </header>

      <div className="min-w-0 flex-1" id="main-content" tabIndex={-1}>
        {children}
      </div>

      <footer className="border-t border-slate-200 bg-white text-slate-600">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p className="m-0 font-bold text-slate-800">Technology Store</p>
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
