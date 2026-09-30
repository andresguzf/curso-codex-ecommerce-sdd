"use client";

import Link from "next/link";

import { useCart } from "./use-cart";

export function CartShortcut() {
  const { cartQuery } = useCart();
  const quantity = cartQuery.data?.totalQuantity ?? 0;

  return (
    <nav
      aria-label="Acceso rápido al carrito"
      className="shrink-0"
    >
      <Link
        aria-label={`Ver carrito, ${quantity} ${quantity === 1 ? "unidad" : "unidades"}`}
        className="group inline-flex min-h-12 items-center gap-3 rounded-full border border-cyan-100/80 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_14px_35px_-18px_rgba(8,20,38,0.85)] transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#041326] motion-reduce:transform-none"
        href="/cart"
      >
        <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 3h2l3 12h10l3-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
        <span className="hidden sm:inline">Carrito</span>
        <span
          aria-hidden="true"
          className="grid min-w-7 place-items-center rounded-full bg-slate-900 px-2 py-1 font-mono text-xs text-white group-hover:bg-slate-800"
        >
          {quantity}
        </span>
      </Link>
    </nav>
  );
}
